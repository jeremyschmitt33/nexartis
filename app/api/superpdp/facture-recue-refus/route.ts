import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createRlsClient } from '@/lib/supabase/server'
import { sendInvoiceEvent, SuperPdpError } from '@/lib/superpdp/client'
import { getValidAccessTokenForUser } from '@/lib/superpdp/connexion'
import { isValidRefusCode, REFUS_MOTIFS } from '@/lib/superpdp/refus-motifs'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, sanitizeString, rateLimitError, secureError, unauthorizedError, secureJson,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// REFUS MOTIVE d'une facture recue (statut DGFiP fr:210 "Refusee").
// SEULE action destinataire juridiquement obligatoire en 2026. Flux :
//  1. auth + propriete (RLS) ;
//  2. motif obligatoire (code AFNOR XP Z12-012 + texte) ;
//  3. envoi de l'evenement fr:210 a SUPER PDP (POST /v1.beta/invoice_events) ;
//  4. statut interne -> 'refusee' (+ trace motif/horodatage).
// Une facture refusee n'est JAMAIS comptabilisee (cf. UI : exclue des achats).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RefusBody {
  id?: string
  motifCode?: string
  motifText?: string
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`facture-recue-refus:${ip}`, 20, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let body: RefusBody
  try { body = (await req.json()) as RefusBody } catch { return secureError('Corps invalide') }

  const id = body.id || ''
  const motifCode = body.motifCode || ''
  const motifText = sanitizeString((body.motifText || '').trim(), 500)

  if (!isValidUUID(id)) return secureError('Identifiant invalide')
  if (!isValidRefusCode(motifCode)) return secureError('Motif de refus invalide')
  // Texte obligatoire pour "Autre", recommande sinon.
  if (motifCode === 'OTHER' && motifText.length < 3) {
    return secureError('Merci de preciser le motif de refus.')
  }
  const motifLabel = REFUS_MOTIFS.find((m) => m.code === motifCode)?.label || motifCode

  // 1) Propriete via RLS + recuperation de l'id SUPER PDP et du proprietaire.
  const rls = createRlsClient()
  const { data: row, error } = await rls
    .from('factures_recues')
    .select('id, user_id, superpdp_invoice_id, statut')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return secureError('Lecture impossible', 500)
  if (!row) return secureError('Facture introuvable', 404)
  if (row.statut === 'refusee') return secureError('Cette facture est deja refusee.', 409)

  // 2) Jeton du titulaire de la connexion (= proprietaire de la facture).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return secureError('Configuration serveur invalide', 500)
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  let token: string
  try {
    token = await getValidAccessTokenForUser(admin, row.user_id as string)
  } catch (e) {
    const err = e as SuperPdpError
    if (err.status === 409) return secureError('Connexion SUPER PDP absente.', 409)
    if (err.status === 401) return secureError('Reconnexion SUPER PDP requise.', 401)
    return secureError('Acces SUPER PDP impossible.', 500)
  }

  // 3) Envoi de l'evenement fr:210 (Refusee) avec motif.
  try {
    await sendInvoiceEvent(token, {
      invoice_id: Number(row.superpdp_invoice_id),
      status_code: 'fr:210',
      details: [{ code: motifCode, reason: motifText || motifLabel }],
    })
  } catch (e) {
    console.error('facture-recue-refus: envoi evenement echoue', (e as Error).message)
    return secureError('Le refus n a pas pu etre transmis a la plateforme. Reessayez.', 502)
  }

  // 4) Statut interne -> refusee (via RLS : seul le dirigeant autorise).
  const { error: updErr } = await rls
    .from('factures_recues')
    .update({
      statut: 'refusee',
      statut_pdp_code: 'fr:210',
      refus_motif_code: motifCode,
      refus_motif_text: motifText || motifLabel,
      refus_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) {
    // L'evenement est parti chez SUPER PDP mais la trace locale a echoue.
    console.error('facture-recue-refus: maj statut local echouee', updErr.message)
    return secureJson({ ok: true, warning: 'Refus transmis, mise a jour locale a verifier.' })
  }

  return secureJson({ ok: true, statut: 'refusee' })
}
