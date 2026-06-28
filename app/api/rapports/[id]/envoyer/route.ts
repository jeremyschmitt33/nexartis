import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit, isValidEmail,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * POST /api/rapports/[id]/envoyer
 * Body : { pdf_base64, email, message? }
 * Envoie le rapport (PDF genere cote client, photos incluses) au client en
 * piece jointe (Brevo), puis passe le statut a 'envoye'. Dedie au rapport.
 */
export const dynamic = 'force-dynamic'

const MAX_B64 = 7_000_000 // ~5 Mo de PDF (limite Brevo / corps serverless)
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-envoyer:${ip}`, 30, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const id = params.id
  if (!id) return secureError('id requis')

  let b: { pdf_base64?: string; email?: string; message?: string }
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const email = String(b.email || '').trim()
  const pdf = String(b.pdf_base64 || '')
  if (!isValidEmail(email)) return secureError('Adresse e-mail invalide')
  if (!pdf) return secureError('PDF manquant')
  if (pdf.length > MAX_B64) return secureError('Le PDF est trop volumineux pour un envoi par e-mail. Telechargez-le et envoyez-le manuellement, ou retirez des photos.', 413)

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return secureError('Service e-mail indisponible', 500)

  const db = admin()
  const { data: rapport } = await db
    .from('rapports_intervention').select('id, numero, objet, client_nom_snapshot')
    .eq('id', id).eq('user_id', user.id).is('deleted_at', null).single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  // Nom de l'entreprise (expediteur affiche)
  const { data: ent } = await db.from('entreprises').select('nom').eq('user_id', user.id).maybeSingle()
  const entNom = (ent?.nom as string) || 'Votre artisan'

  const objet = rapport.objet || 'Rapport d’intervention'
  const numero = rapport.numero || ''
  const intro = b.message && String(b.message).trim()
    ? esc(String(b.message).trim()).replace(/\n/g, '<br>')
    : `Bonjour,<br><br>Veuillez trouver ci-joint le rapport d’intervention${objet ? ' concernant : <strong>' + esc(objet) + '</strong>' : ''}.<br><br>Cordialement,<br>${esc(entNom)}`

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#1a1a2e;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#0f1a3a;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px;">${esc(entNom)}</div>
  <div style="background:#fff;padding:22px 20px;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;">
    ${intro}
    <p style="color:#7b8ba3;font-size:12px;margin-top:20px;">Rapport ${esc(numero)} — document en pièce jointe (PDF).</p>
  </div>
</div></body></html>`

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: entNom, email: 'no-reply@nexartis.fr' },
        to: [{ email }],
        subject: `Rapport d’intervention${numero ? ' ' + numero : ''}${objet ? ' — ' + objet : ''}`,
        htmlContent: html,
        attachment: [{ content: pdf, name: `Rapport-${numero || 'intervention'}.pdf` }],
      }),
    })
    if (!res.ok) { console.error('[rapport envoyer] brevo', res.status); return secureError('Envoi e-mail refusé', 502) }
  } catch (e) { console.error('[rapport envoyer]', e); return secureError('Envoi impossible', 500) }

  await db.from('rapports_intervention').update({ statut: 'envoye', updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)

  return secureJson({ ok: true })
}
