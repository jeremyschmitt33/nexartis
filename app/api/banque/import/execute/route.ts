// ============================================================================
// POST /api/banque/import/execute — Étape 3 de l'import de relevé bancaire
// ----------------------------------------------------------------------------
// Reçoit les lignes normalisées validées à l'étape 2 (aperçu), puis :
//   1. crée la ligne banque_imports (statut en_cours),
//   2. recalcule les hash_dedup CÔTÉ SERVEUR (formule de la migration 04 —
//      on ne fait jamais confiance à un hash envoyé par le client),
//   3. applique les categorisation_regles (système + utilisateur, priorité
//      croissante, sens respecté) → categorie_id = SUGGESTION seulement,
//      statut_pointage reste 'a_pointer',
//   4. insère par chunks de 500 en ignorant les doublons
//      (compte_id + hash_dedup). ⚠️ L'index d'unicité de la migration 04 est
//      PARTIEL (WHERE deleted_at IS NULL) : PostgREST ne sait pas fournir le
//      prédicat à ON CONFLICT, un upsert onConflict échouerait donc en 42P10.
//      → équivalent robuste : pré-filtrage des hashes existants + insertion,
//      avec re-filtrage et nouvelle tentative si une course déclenche un 23505.
//   5. met à jour les compteurs et le statut (termine / erreur).
//
// Sécurité : auth + rate limit + validation stricte + propriété du compte.
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
import { hashDedup, nettoyerLibelle } from '@/lib/banque/csv'
import {
  IMPORT_MAX_LIGNES,
  type ExecuteReponse,
} from '@/lib/banque/types'

// Même réglage que app/api/voice-command/route.ts (plan Vercel Pro : 60 s).
export const maxDuration = 60
export const runtime = 'nodejs'

const TAILLE_CHUNK = 500

interface LigneValidee {
  date: string
  libelle: string
  montant: number
  hash: string
}

interface Regle {
  pattern: string
  type_match: 'contient' | 'commence_par'
  categorie_id: string
  sens: 'debit' | 'credit' | null
  priorite: number
}

/** Applique la première règle qui matche (priorité croissante, sens respecté). */
function suggererCategorie(regles: Regle[], libelle: string, montant: number): string | null {
  const libelleMaj = libelle.toUpperCase()
  for (const regle of regles) {
    if (regle.sens === 'debit' && montant >= 0) continue
    if (regle.sens === 'credit' && montant <= 0) continue
    const motif = regle.pattern.toUpperCase()
    const ok =
      regle.type_match === 'commence_par'
        ? libelleMaj.startsWith(motif)
        : libelleMaj.includes(motif)
    if (ok) return regle.categorie_id
  }
  return null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  let importId: string | null = null

  try {
    // ── Auth ──
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // ── Rate limit : 6 imports / minute / utilisateur ──
    if (!checkRateLimit(`banque-execute:${user.id}`, 6, 60_000)) {
      return rateLimitError()
    }

    // ── Validation stricte du corps ──
    let corps: unknown
    try {
      corps = await req.json()
    } catch {
      return secureError('Requête invalide.', 400)
    }
    if (typeof corps !== 'object' || corps === null) {
      return secureError('Requête invalide.', 400)
    }
    const { compteId, fichierNom, fichierHash, lignes } = corps as Record<string, unknown>

    if (typeof compteId !== 'string' || !isValidUUID(compteId)) {
      return secureError('Compte invalide.', 400)
    }
    if (typeof fichierNom !== 'string' || !fichierNom || fichierNom.length > 200) {
      return secureError('Nom de fichier invalide.', 400)
    }
    if (typeof fichierHash !== 'string' || !/^[0-9a-f]{64}$/.test(fichierHash)) {
      return secureError('Empreinte de fichier invalide.', 400)
    }
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return secureError('Aucune opération à importer.', 400)
    }
    if (lignes.length > IMPORT_MAX_LIGNES) {
      return secureError(`Trop de lignes (${IMPORT_MAX_LIGNES.toLocaleString('fr-FR')} maximum).`, 400)
    }

    const validees: LigneValidee[] = []
    for (const brute of lignes) {
      if (typeof brute !== 'object' || brute === null) {
        return secureError('Ligne invalide dans le fichier.', 400)
      }
      const { date, libelle, montant } = brute as Record<string, unknown>
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return secureError('Date invalide dans le fichier.', 400)
      }
      if (typeof libelle !== 'string' || !libelle.trim() || libelle.length > 500) {
        return secureError('Libellé invalide dans le fichier.', 400)
      }
      if (typeof montant !== 'number' || !isFinite(montant) || montant === 0 || Math.abs(montant) >= 10_000_000_000) {
        return secureError('Montant invalide dans le fichier.', 400)
      }
      const libelleNettoye = nettoyerLibelle(libelle)
      const montantArrondi = Math.round(montant * 100) / 100
      if (montantArrondi === 0) {
        return secureError('Montant invalide dans le fichier.', 400)
      }
      validees.push({
        date,
        libelle: libelleNettoye,
        montant: montantArrondi,
        // Hash recalculé serveur : formule exacte de la migration 04
        hash: hashDedup(date, montantArrondi, libelleNettoye),
      })
    }

    // ── Propriété du compte ──
    const { data: compte, error: erreurCompte } = await supabase
      .from('comptes_tresorerie')
      .select('id')
      .eq('id', compteId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (erreurCompte) {
      console.error('[banque/import/execute] lecture compte:', erreurCompte.message)
      return secureError('Erreur interne.', 500)
    }
    if (!compte) return secureError('Compte introuvable.', 404)

    // ── Dédoublonnage intra-requête (idempotence : payload trafiqué ou renvoyé 2×) ──
    const vus = new Set<string>()
    let nbDoublons = 0
    const uniques: LigneValidee[] = []
    for (const l of validees) {
      if (vus.has(l.hash)) {
        nbDoublons++
        continue
      }
      vus.add(l.hash)
      uniques.push(l)
    }

    // ── Période détectée ──
    let periodeDebut = uniques[0].date
    let periodeFin = uniques[0].date
    for (const l of uniques) {
      if (l.date < periodeDebut) periodeDebut = l.date
      if (l.date > periodeFin) periodeFin = l.date
    }

    // ── Création de la ligne d'audit banque_imports ──
    const { data: importCree, error: erreurImport } = await supabase
      .from('banque_imports')
      .insert({
        user_id: user.id,
        compte_id: compteId,
        fichier_nom: fichierNom,
        fichier_hash: fichierHash,
        format: 'csv',
        statut: 'en_cours',
        nb_lignes_fichier: lignes.length,
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
      })
      .select('id')
      .single()
    if (erreurImport || !importCree) {
      console.error('[banque/import/execute] création import:', erreurImport?.message)
      return secureError("Impossible de démarrer l'import. Réessayez.", 500)
    }
    importId = importCree.id as string

    // ── Règles de catégorisation (système + utilisateur), priorité croissante ──
    // SUGGESTION seulement : statut_pointage reste 'a_pointer'.
    const { data: reglesBrutes, error: erreurRegles } = await supabase
      .from('categorisation_regles')
      .select('pattern, type_match, categorie_id, sens, priorite')
      .eq('actif', true)
      .is('deleted_at', null)
      .order('priorite', { ascending: true })
    if (erreurRegles) {
      console.error('[banque/import/execute] lecture règles:', erreurRegles.message)
    }
    const regles: Regle[] = (reglesBrutes ?? []) as Regle[]

    // ── Insertion par chunks de 500, doublons base ignorés ──
    let nbImportees = 0
    let nbErreurs = 0
    let nbCategorisees = 0

    for (let i = 0; i < uniques.length; i += TAILLE_CHUNK) {
      const morceau = uniques.slice(i, i + TAILLE_CHUNK)

      // Quels hashes existent déjà sur ce compte ? (équivalent ON CONFLICT DO
      // NOTHING — voir l'en-tête du fichier pour la limite PostgREST/index partiel)
      const { data: existants, error: erreurExistants } = await supabase
        .from('banque_mouvements')
        .select('hash_dedup')
        .eq('compte_id', compteId)
        .is('deleted_at', null)
        .in('hash_dedup', morceau.map((l) => l.hash))
      if (erreurExistants) {
        console.error('[banque/import/execute] lecture doublons:', erreurExistants.message)
        nbErreurs += morceau.length
        continue
      }
      const dejaLa = new Set((existants ?? []).map((e) => e.hash_dedup as string))
      const aInserer = morceau.filter((l) => !dejaLa.has(l.hash))
      nbDoublons += morceau.length - aInserer.length
      if (aInserer.length === 0) continue

      const lignesInsert = aInserer.map((l) => {
        const categorieId = suggererCategorie(regles, l.libelle, l.montant)
        return {
          user_id: user.id,
          compte_id: compteId,
          import_id: importId,
          date_operation: l.date,
          libelle_banque: l.libelle,
          montant: l.montant,
          categorie_id: categorieId,
          statut_pointage: 'a_pointer' as const,
          source: 'import_csv' as const,
        }
      })

      const nbCategoriseesChunk = lignesInsert.filter((l) => l.categorie_id !== null).length

      const { error: erreurInsert } = await supabase
        .from('banque_mouvements')
        .insert(lignesInsert)
      if (!erreurInsert) {
        nbImportees += lignesInsert.length
        nbCategorisees += nbCategoriseesChunk
        continue
      }

      if (erreurInsert.code === '23505') {
        // Course rarissime (double clic / double onglet) : on re-filtre et on retente une fois
        const { data: existants2 } = await supabase
          .from('banque_mouvements')
          .select('hash_dedup')
          .eq('compte_id', compteId)
          .is('deleted_at', null)
          .in('hash_dedup', aInserer.map((l) => l.hash))
        const dejaLa2 = new Set((existants2 ?? []).map((e) => e.hash_dedup as string))
        const restantes = lignesInsert.filter((_, idx) => !dejaLa2.has(aInserer[idx].hash))
        nbDoublons += lignesInsert.length - restantes.length
        if (restantes.length > 0) {
          const { error: erreurRetry } = await supabase.from('banque_mouvements').insert(restantes)
          if (erreurRetry) {
            console.error('[banque/import/execute] insertion (retry):', erreurRetry.message)
            nbErreurs += restantes.length
          } else {
            nbImportees += restantes.length
            nbCategorisees += restantes.filter((l) => l.categorie_id !== null).length
          }
        }
      } else {
        console.error('[banque/import/execute] insertion:', erreurInsert.message)
        nbErreurs += lignesInsert.length
      }
    }

    // ── Compteurs + statut final ──
    const statutFinal = nbErreurs > 0 && nbImportees === 0 ? 'erreur' : 'termine'
    await supabase
      .from('banque_imports')
      .update({
        statut: statutFinal,
        nb_importees: nbImportees,
        nb_doublons: nbDoublons,
        nb_erreurs: nbErreurs,
        erreur_message:
          statutFinal === 'erreur' ? "Aucune opération n'a pu être insérée." : null,
      })
      .eq('id', importId)

    if (statutFinal === 'erreur') {
      return secureError("L'import a échoué : aucune opération n'a pu être enregistrée. Réessayez.", 500)
    }

    const reponse: ExecuteReponse = {
      ok: true,
      importId,
      nbImportees,
      nbDoublons,
      nbErreurs,
      nbCategorisees,
    }
    return secureJson(reponse)
  } catch (e) {
    console.error('[banque/import/execute] erreur inattendue:', e)
    // On marque l'import en erreur pour l'audit, sans bloquer la réponse
    if (importId) {
      try {
        await supabase
          .from('banque_imports')
          .update({ statut: 'erreur', erreur_message: 'Erreur interne pendant l’import.' })
          .eq('id', importId)
      } catch {
        // rien de plus à faire
      }
    }
    return secureError("Erreur pendant l'import. Réessayez.", 500)
  }
}
