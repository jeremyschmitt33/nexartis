import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * POST /api/documents/cop
 * Cree un "Contrat d'ouverture de porte" (COP) pour l'artisan connecte.
 *
 * SECURITE :
 *  - Auth obligatoire (getAuthenticatedUser).
 *  - Rate limit par IP.
 *  - Validation stricte + sanitize des textes.
 *  - Totaux RECALCULES cote serveur (on ne fait PAS confiance au client).
 *  - Insertion avec user_id de l'utilisateur authentifie ; le trigger SQL
 *    set_cop_numero pose le numero COP-YYYY-####.
 *
 * Body attendu :
 *  {
 *    client_nom, client_prenom, client_adresse, client_cp, client_ville,
 *    statut_occupant ('locataire'|'proprietaire'|null),
 *    identite_verifiee (bool), piece_nature (string|null),
 *    date_intervention (ISO string|null), lieu (string|null),
 *    nature_urgence (string|null),
 *    lignes: [{ designation, quantite, unite, pu_ht, tva_taux }],
 *    renonciation_info, renonciation_execution, renonciation_perte,
 *    attestation_acces, consentement_risque (bool),
 *    client_id (uuid|null)
 *  }
 */
export const dynamic = 'force-dynamic'

const TVA_AUTORISES = [0, 5.5, 10, 20]
const MAX_LIGNES = 40
const STATUTS_OCCUPANT = ['locataire', 'proprietaire']

interface LigneIn {
  designation: string
  quantite: number
  unite: string
  pu_ht: number
  tva_taux: number
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`cop-create:${ip}`, 30, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  // ── Validation des lignes (bareme) ──────────────────────────────────────
  const rawLignes = Array.isArray(b.lignes) ? b.lignes : []
  if (rawLignes.length === 0) return secureError('Au moins une ligne est requise')
  if (rawLignes.length > MAX_LIGNES) return secureError('Trop de lignes')

  const lignes: LigneIn[] = []
  for (const raw of rawLignes) {
    if (typeof raw !== 'object' || raw === null) return secureError('Ligne invalide')
    const r = raw as Record<string, unknown>
    const designation = sanitizeString(String(r.designation ?? ''), 300).trim()
    const quantite = Number(r.quantite)
    const pu_ht = Number(r.pu_ht)
    const tva_taux = Number(r.tva_taux)
    const unite = sanitizeString(String(r.unite ?? ''), 30).trim()

    if (!designation) return secureError('Designation manquante sur une ligne')
    if (!Number.isFinite(quantite) || quantite < 0 || quantite > 100000) return secureError('Quantite invalide')
    if (!Number.isFinite(pu_ht) || pu_ht < 0 || pu_ht > 10_000_000) return secureError('Prix unitaire invalide')
    if (!TVA_AUTORISES.includes(tva_taux)) return secureError('Taux de TVA invalide')

    lignes.push({ designation, quantite, unite, pu_ht, tva_taux })
  }

  // ── Totaux recalcules cote serveur ──────────────────────────────────────
  let totalHt = 0
  const parTaux: Record<string, number> = {}
  for (const l of lignes) {
    const t = l.quantite * l.pu_ht
    totalHt += t
    const key = String(l.tva_taux)
    parTaux[key] = (parTaux[key] ?? 0) + t
  }
  let totalTva = 0
  for (const key of Object.keys(parTaux)) {
    const taux = Number(key)
    if (taux > 0) totalTva += parTaux[key] * (taux / 100)
  }
  totalHt = round2(totalHt)
  totalTva = round2(totalTva)
  const totalTtc = round2(totalHt + totalTva)

  // ── Champs simples valides / sanitizes ──────────────────────────────────
  const clientNom = sanitizeString(String(b.client_nom ?? ''), 120).trim() || null
  const clientPrenom = sanitizeString(String(b.client_prenom ?? ''), 120).trim() || null
  const clientAdresse = sanitizeString(String(b.client_adresse ?? ''), 200).trim() || null
  const clientCp = sanitizeString(String(b.client_cp ?? ''), 12).trim() || null
  const clientVille = sanitizeString(String(b.client_ville ?? ''), 120).trim() || null
  const lieu = sanitizeString(String(b.lieu ?? ''), 200).trim() || null
  const natureUrgence = sanitizeString(String(b.nature_urgence ?? ''), 200).trim() || null
  // RGPD : type de piece uniquement (jamais de numero). On borne court.
  const pieceNature = sanitizeString(String(b.piece_nature ?? ''), 40).trim() || null

  const statutOccupant = STATUTS_OCCUPANT.includes(String(b.statut_occupant))
    ? String(b.statut_occupant)
    : null

  const dateIntervention = b.date_intervention ? String(b.date_intervention) : null
  if (dateIntervention && Number.isNaN(new Date(dateIntervention).getTime())) {
    return secureError('Date d\'intervention invalide')
  }

  const clientId = b.client_id ? String(b.client_id) : null
  if (clientId && !isValidUUID(clientId)) return secureError('Client invalide')

  const bool = (v: unknown) => v === true || v === 'true'

  // ── Insertion via service role (pose user_id de l'utilisateur authentifie) ──
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('cop POST: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Si un client est lie, verifier qu'il appartient bien a l'utilisateur.
  if (clientId) {
    const { data: cl } = await admin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()
    if (!cl) return secureError('Client introuvable', 404)
  }

  try {
    const { data: inserted, error } = await admin
      .from('contrats_ouverture')
      .insert({
        user_id: user.id,
        client_id: clientId,
        statut: 'brouillon',
        client_nom: clientNom,
        client_prenom: clientPrenom,
        client_adresse: clientAdresse,
        client_cp: clientCp,
        client_ville: clientVille,
        statut_occupant: statutOccupant,
        identite_verifiee: bool(b.identite_verifiee),
        piece_nature: pieceNature,
        date_intervention: dateIntervention,
        lieu,
        nature_urgence: natureUrgence,
        lignes,
        total_ht: totalHt,
        total_tva: totalTva,
        total_ttc: totalTtc,
        renonciation_info: bool(b.renonciation_info),
        renonciation_execution: bool(b.renonciation_execution),
        renonciation_perte: bool(b.renonciation_perte),
        attestation_acces: bool(b.attestation_acces),
        consentement_risque: bool(b.consentement_risque),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[cop] insert error:', error)
      return secureError('Enregistrement impossible', 500)
    }

    return secureJson({ ok: true, id: inserted?.id })
  } catch (e) {
    console.error('[cop] POST exception:', e)
    return secureError('Erreur serveur', 500)
  }
}
