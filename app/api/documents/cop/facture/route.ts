import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { createFactureFromCop } from '@/lib/services/cop-facture'

/**
 * POST /api/documents/cop/facture
 * Genere une facture liee a un contrat d'ouverture de porte SIGNE.
 * - Idempotent : si le COP a deja une facture (facture_id), on ne recree rien.
 * - statut facture : 'brouillon' (a encaisser) ou 'payee' si encaisse sur place.
 *
 * Body : { copId, encaisse (bool) }
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`cop-facture:${ip}`, 20, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const copId = String(b.copId ?? '')
  if (!isValidUUID(copId)) return secureError('Contrat invalide')
  const encaisse = b.encaisse === true || b.encaisse === 'true'

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('cop facture: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1) Charger le COP + verifier propriete.
  const { data: cop, error: copErr } = await admin
    .from('contrats_ouverture')
    .select('id, user_id, statut, client_id, facture_id, numero, total_ht, total_tva, total_ttc, lignes')
    .eq('id', copId)
    .eq('user_id', user.id)
    .single()
  if (copErr || !cop) return secureError('Contrat introuvable', 404)

  // 2) Idempotence : facture deja generee.
  if (cop.facture_id) {
    return secureJson({ ok: true, alreadyExists: true, factureId: cop.facture_id })
  }

  // 3) La facture ne se genere que sur un contrat signe.
  if (cop.statut !== 'signe') {
    return secureError('Le contrat doit d\'abord etre signe', 409)
  }

  // 4) Delai de paiement de l'entreprise (pour la date d'echeance).
  // La colonne s'appelle `delai_paiement_defaut` et vaut un TEXT type "30 jours".
  let delaiPaiement: number | null = null
  try {
    const { data: ent } = await admin
      .from('entreprises')
      .select('delai_paiement_defaut')
      .eq('user_id', user.id)
      .single()
    const m = String(ent?.delai_paiement_defaut ?? '').match(/\d+/)
    delaiPaiement = m ? Number(m[0]) : null
  } catch { /* fallback 30 j dans le helper */ }

  // 5) Creer la facture + copier les lignes.
  let facture
  try {
    facture = await createFactureFromCop({
      admin,
      userId: user.id,
      cop: {
        id: String(cop.id),
        client_id: (cop.client_id as string | null) ?? null,
        numero: (cop.numero as string | null) ?? null,
        total_ht: cop.total_ht as number | null,
        total_tva: cop.total_tva as number | null,
        total_ttc: cop.total_ttc as number | null,
        lignes: Array.isArray(cop.lignes) ? cop.lignes : [],
      },
      delaiPaiementJours: delaiPaiement,
      encaisse,
    })
  } catch (e) {
    console.error('[cop-facture] creation:', e)
    return secureError('Creation de la facture impossible', 500)
  }

  // 6) Lier la facture au contrat.
  const { error: linkErr } = await admin
    .from('contrats_ouverture')
    .update({ facture_id: facture.id })
    .eq('id', copId)
    .eq('user_id', user.id)
  if (linkErr) {
    console.error('[cop-facture] lien facture_id:', linkErr)
    // La facture existe : on ne bloque pas, mais on informe.
  }

  return secureJson({ ok: true, factureId: facture.id, factureNumero: facture.numero })
}
