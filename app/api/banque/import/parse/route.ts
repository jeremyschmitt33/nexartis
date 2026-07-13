// ============================================================================
// POST /api/banque/import/parse — Étape 2 de l'import de relevé bancaire
// ----------------------------------------------------------------------------
// Reçoit le fichier CSV (multipart) + l'identifiant du compte, et renvoie un
// APERÇU complet SANS rien écrire en base :
//   - détection sémantique des colonnes (aucun format imposé),
//   - décodage UTF-8 / Windows-1252,
//   - montants français, colonnes débit/crédit séparées,
//   - dates ambiguës → confirmationDatesRequise (jamais de choix silencieux),
//   - fusion des paires d'écriture double type Clementine,
//   - hash_dedup (formule EXACTE de la migration 04) + pré-marquage des
//     doublons déjà en base,
//   - totaux Entrées/Sorties (repérer les signes inversés) + période détectée.
//
// Sécurité : auth (getUser via lib/api-security), rate limit, validation
// stricte des inputs, vérification que le compte appartient à l'utilisateur.
// RLS active (client Supabase à cookies) : double filet sur toutes les lectures.
// ============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAuthenticatedUser,
  checkRateLimit,
  rateLimitError,
  unauthorizedError,
  secureJson,
  secureError,
  isValidUUID,
} from '@/lib/api-security'
import {
  analyserCsvBancaire,
  decoderFichier,
  hashDedup,
  hashFichier,
  ErreurAnalyseCsv,
  type OrdreDates,
} from '@/lib/banque/csv'
import {
  REGLES_COLONNES,
  trouverRegle,
  type RegleCategorisation,
} from '@/lib/banque/regles'
import {
  IMPORT_MAX_LIGNES,
  IMPORT_MAX_OCTETS,
  type LigneReleve,
  type ParseReponse,
} from '@/lib/banque/types'

// Même réglage que app/api/voice-command/route.ts (plan Vercel Pro : 60 s).
export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // ── Rate limit : 10 analyses / minute / utilisateur ──
    if (!checkRateLimit(`banque-parse:${user.id}`, 10, 60_000)) {
      return rateLimitError()
    }

    // ── Lecture et validation du formulaire ──
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return secureError('Requête invalide.', 400)
    }

    const fichier = form.get('fichier')
    const compteId = String(form.get('compteId') ?? '')
    const ordreDatesBrut = form.get('ordreDates')

    if (!(fichier instanceof File)) {
      return secureError('Aucun fichier reçu.', 400)
    }
    if (!isValidUUID(compteId)) {
      return secureError('Compte invalide.', 400)
    }
    let ordreForce: OrdreDates | undefined
    if (ordreDatesBrut !== null) {
      if (ordreDatesBrut !== 'jma' && ordreDatesBrut !== 'mja') {
        return secureError('Ordre de dates invalide.', 400)
      }
      ordreForce = ordreDatesBrut
    }

    // V1 : CSV uniquement, 4 Mo max
    const nomFichier = (fichier.name || 'releve.csv').slice(0, 200)
    if (!/\.csv$/i.test(nomFichier)) {
      return secureError(
        'Seuls les fichiers CSV sont acceptés pour le moment. Téléchargez la version CSV du relevé depuis votre banque.',
        400,
      )
    }
    if (fichier.size > IMPORT_MAX_OCTETS) {
      return secureError('Fichier trop volumineux (4 Mo maximum).', 400)
    }

    // ── Le compte appartient-il bien à l'utilisateur ? (RLS + ceinture) ──
    const supabase = createClient()
    const { data: compte, error: erreurCompte } = await supabase
      .from('comptes_tresorerie')
      .select('id')
      .eq('id', compteId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (erreurCompte) {
      console.error('[banque/import/parse] lecture compte:', erreurCompte.message)
      return secureError('Erreur interne.', 500)
    }
    if (!compte) {
      return secureError('Compte introuvable.', 404)
    }

    // ── Décodage + analyse ──
    const tampon = await fichier.arrayBuffer()
    const empreinteFichier = hashFichier(tampon)
    const texte = decoderFichier(tampon)

    let analyse
    try {
      analyse = analyserCsvBancaire(texte, ordreForce)
    } catch (e) {
      if (e instanceof ErreurAnalyseCsv) return secureError(e.message, 400)
      throw e
    }

    if (analyse.nbLignesFichier > IMPORT_MAX_LIGNES) {
      return secureError(
        `Le fichier contient plus de ${IMPORT_MAX_LIGNES.toLocaleString('fr-FR')} lignes. Découpez-le (par exemple un semestre à la fois) et réessayez.`,
        400,
      )
    }

    // ── Dates ambiguës : on s'arrête et on demande ──
    if (analyse.confirmationDatesRequise) {
      const reponse: ParseReponse = {
        ok: true,
        confirmationDatesRequise: true,
        ordreDatesUtilise: 'jma',
        lignes: [],
        fichierNom: nomFichier,
        fichierHash: empreinteFichier,
        fichierDejaImporte: false,
        nbLignesFichier: analyse.nbLignesFichier,
        nbErreurs: 0,
        nbPairesFusionnees: 0,
        nbDejaImportees: 0,
        nbTriablesAuto: 0,
        nbSuggerables: 0,
        totalEntrees: 0,
        totalSorties: 0,
        periodeDebut: null,
        periodeFin: null,
        colonnes: analyse.colonnes.noms,
      }
      return secureJson(reponse)
    }

    if (analyse.lignes.length === 0) {
      return secureError(
        "Aucune opération lisible dans ce fichier. Vérifiez que c'est bien le relevé CSV téléchargé depuis votre banque.",
        400,
      )
    }

    // ── Le même fichier a-t-il déjà été importé (niveau 1 d'idempotence) ? ──
    const { data: importExistant } = await supabase
      .from('banque_imports')
      .select('id')
      .eq('user_id', user.id)
      .eq('compte_id', compteId)
      .eq('fichier_hash', empreinteFichier)
      .eq('statut', 'termine')
      .is('deleted_at', null)
      .limit(1)
    const fichierDejaImporte = (importExistant?.length ?? 0) > 0

    // ── Pré-marquage des doublons déjà en base (niveau 3 : hash de ligne) ──
    const hashes = analyse.lignes.map((l) => hashDedup(l.date, l.montant, l.libelle))
    const dejaEnBase = new Set<string>()
    for (let i = 0; i < hashes.length; i += 500) {
      const morceau = hashes.slice(i, i + 500)
      const { data: existants, error: erreurHash } = await supabase
        .from('banque_mouvements')
        .select('hash_dedup')
        .eq('compte_id', compteId)
        .is('deleted_at', null)
        .in('hash_dedup', morceau)
      if (erreurHash) {
        console.error('[banque/import/parse] lecture hashes:', erreurHash.message)
        return secureError('Erreur interne.', 500)
      }
      for (const e of existants ?? []) {
        if (typeof e.hash_dedup === 'string') dejaEnBase.add(e.hash_dedup)
      }
    }

    // ── Règles (apprises + système, priorité croissante) : combien de débits
    //    seront triés automatiquement à l'import ? (aperçu honnête, rien d'écrit) ──
    const { data: reglesBrutes, error: erreurRegles } = await supabase
      .from('categorisation_regles')
      .select(REGLES_COLONNES)
      .eq('actif', true)
      .is('deleted_at', null)
      .order('priorite', { ascending: true })
      .order('created_at', { ascending: true })
    if (erreurRegles) {
      console.error('[banque/import/parse] lecture règles:', erreurRegles.message)
    }
    const regles: RegleCategorisation[] = (reglesBrutes ?? []) as RegleCategorisation[]

    // ── Construction de l'aperçu ──
    let totalEntrees = 0
    let totalSorties = 0
    let nbTriablesAuto = 0 // débits reconnus 1a (classés + pointés d'office)
    let nbSuggerables = 0 // débits reconnus 1b (à confirmer)
    let periodeDebut: string | null = null
    let periodeFin: string | null = null
    const lignes: LigneReleve[] = analyse.lignes.map((l, i) => {
      if (l.montant > 0) totalEntrees += l.montant
      else totalSorties += -l.montant
      if (!periodeDebut || l.date < periodeDebut) periodeDebut = l.date
      if (!periodeFin || l.date > periodeFin) periodeFin = l.date
      const dejaImporte = dejaEnBase.has(hashes[i])
      // Même critère que la route execute : DÉBIT + règle qui matche. On sépare
      // 1a (auto_point=true → classé) et 1b (auto_point=false → à confirmer).
      if (!dejaImporte && l.montant < 0) {
        const regle = trouverRegle(regles, l.libelle, l.montant)
        if (regle) {
          if (regle.auto_point) nbTriablesAuto++
          else nbSuggerables++
        }
      }
      return {
        date: l.date,
        libelle: l.libelle,
        montant: l.montant,
        dejaImporte,
      }
    })

    const reponse: ParseReponse = {
      ok: true,
      confirmationDatesRequise: false,
      ordreDatesUtilise: analyse.ordreDatesUtilise,
      lignes,
      fichierNom: nomFichier,
      fichierHash: empreinteFichier,
      fichierDejaImporte,
      nbLignesFichier: analyse.nbLignesFichier,
      nbErreurs: analyse.nbErreurs,
      nbPairesFusionnees: analyse.nbPairesFusionnees,
      nbDejaImportees: lignes.filter((l) => l.dejaImporte).length,
      nbTriablesAuto,
      nbSuggerables,
      totalEntrees: Math.round(totalEntrees * 100) / 100,
      totalSorties: Math.round(totalSorties * 100) / 100,
      periodeDebut,
      periodeFin,
      colonnes: analyse.colonnes.noms,
    }
    return secureJson(reponse)
  } catch (e) {
    // Jamais de message brut vers le client (fuite d'info)
    console.error('[banque/import/parse] erreur inattendue:', e)
    return secureError("Erreur pendant l'analyse du fichier. Réessayez.", 500)
  }
}
