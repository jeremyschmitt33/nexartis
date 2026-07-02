import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * POST /api/documents/cop/send
 * Envoie au client, par email, un lien vers sa COPIE du contrat d'ouverture
 * de porte (page publique /signer/cop/[token], lecture seule + impression).
 *
 * Body : { copId, email }
 */
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 jours

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`cop-send:${ip}`, 15, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const copId = String(b.copId ?? '')
  if (!isValidUUID(copId)) return secureError('Contrat invalide')

  const email = String(b.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 200) return secureError('Adresse email invalide')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('cop send: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1) Charger le contrat + verifier propriete.
  const { data: cop, error: copErr } = await admin
    .from('contrats_ouverture')
    .select('id, user_id, numero, signature_token, signature_token_expire_at')
    .eq('id', copId)
    .eq('user_id', user.id)
    .single()
  if (copErr || !cop) return secureError('Contrat introuvable', 404)

  // 2) S'assurer d'un token public valide (genere si absent ou expire).
  let token = (cop.signature_token as string | null) ?? null
  const expired = cop.signature_token_expire_at
    ? new Date(cop.signature_token_expire_at as string).getTime() < Date.now()
    : true
  if (!token || expired) {
    token = randomUUID()
    const { error: updErr } = await admin
      .from('contrats_ouverture')
      .update({
        signature_token: token,
        signature_token_expire_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      })
      .eq('id', copId)
      .eq('user_id', user.id)
    if (updErr) {
      console.error('[cop-send] token update:', updErr)
      return secureError('Envoi impossible', 500)
    }
  }

  // 3) Nom de l'entreprise (pour l'email).
  const { data: ent } = await admin
    .from('entreprises')
    .select('nom')
    .eq('user_id', user.id)
    .single()
  const entrepriseNom = sanitizeString(String(ent?.nom ?? 'Votre serrurier'), 120)
  const numero = sanitizeString(String(cop.numero ?? ''), 40)

  // 4) Envoyer l'email via Brevo.
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.error('cop send: BREVO_API_KEY absente')
    return secureError('Service email indisponible', 500)
  }
  const link = `https://nexartis.fr/signer/cop/${token}`
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px;">
<div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<div style="background:#0f1a3a;border-radius:8px 8px 0 0;padding:20px 28px;">
<h1 style="margin:0;color:#fff;font-size:18px;">Votre contrat d'ouverture de porte</h1>
</div>
<div style="padding:28px;">
<p style="font-size:15px;color:#374151;margin:0 0 16px;line-height:1.6;">Bonjour,<br><br>${entrepriseNom} vous transmet une copie de votre contrat d'ouverture de porte${numero ? ` (n&deg; ${numero})` : ''}. Vous pouvez le consulter et l'imprimer via le lien ci-dessous.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${link}" style="background:#e87a2a;color:#ffffff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Voir mon contrat</a>
</div>
<p style="font-size:12px;color:#9ca3af;margin:16px 0 0;word-break:break-all;">Ou copiez ce lien : ${link}</p>
</div>
<div style="padding:12px 28px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Envoye via Nexartis — nexartis.fr</p>
</div>
</div>
</div>
</body></html>`

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Nexartis', email: 'no-reply@nexartis.fr' },
        to: [{ email }],
        subject: `Votre contrat d'ouverture de porte${numero ? ` n° ${numero}` : ''}`,
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      console.error('[cop-send] Brevo status', res.status)
      return secureError('L\'email n\'a pas pu etre envoye', 502)
    }
  } catch (e) {
    console.error('[cop-send] Brevo exception:', e)
    return secureError('L\'email n\'a pas pu etre envoye', 502)
  }

  return secureJson({ ok: true })
}
