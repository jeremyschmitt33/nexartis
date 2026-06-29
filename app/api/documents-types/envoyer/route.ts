import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, isValidEmail, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { buildDocumentTypePdf } from '@/lib/pdf-document-type'

/**
 * POST /api/documents-types/envoyer
 * Body : { document_id, destinataire_email, destinataire_nom?, message? }
 *
 * Envoie un DOCUMENT GÉNÉRÉ (CGV, courrier, PV…) en pièce jointe PDF par email
 * (Brevo). Le PDF est généré CÔTÉ SERVEUR à partir du contenu stocké (même
 * approche que l'envoi de devis). Sécurité : auth + rate-limit + vérif de
 * propriété du document + validation email. L'envoi est journalisé dans
 * documents_envois (pour apparaître dans « Historique des envois »).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`doctype-envoi:${ip}`, 10, 60_000)) return rateLimitError()

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    let b: Record<string, unknown>
    try { b = await req.json() } catch { return secureError('Requete invalide') }

    const documentId = String(b.document_id || '')
    const destEmail = String(b.destinataire_email || '').trim()
    const destNom = sanitizeString(String(b.destinataire_nom || ''), 120).trim()
    const messageRaw = b.message ? sanitizeString(String(b.message), 2000) : ''

    if (!documentId || !isValidUUID(documentId)) return secureError('Document invalide')
    if (!isValidEmail(destEmail)) return secureError('Email du destinataire invalide')

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('documents-types/envoyer: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }
    if (!process.env.BREVO_API_KEY) {
      console.error('documents-types/envoyer: BREVO_API_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Propriété du document généré
    const { data: doc } = await admin
      .from('documents_types')
      .select('id, titre, contenu, user_id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()
    if (!doc) return secureError('Document introuvable', 404)

    // Profil entreprise (en-tête du PDF + expéditeur affiché)
    const { data: entreprise } = await admin
      .from('entreprises')
      .select('*')
      .eq('user_id', user.id)
      .single()
    const entNom = (entreprise?.nom as string) || 'Nexartis'

    // Génération du PDF côté serveur, puis encodage base64 pour Brevo.
    const titre = String(doc.titre || 'Document')
    let pdfBase64: string
    try {
      const pdfDoc = buildDocumentTypePdf(titre, String(doc.contenu || ''), entreprise)
      const dataUri = pdfDoc.output('datauristring') as string
      pdfBase64 = dataUri.split('base64,')[1] || ''
      if (!pdfBase64) throw new Error('PDF vide')
    } catch (e) {
      console.error('documents-types/envoyer: generation PDF echouee', e)
      return secureError('Impossible de generer le PDF du document.', 500)
    }

    const messageHtml = messageRaw
      ? escapeHtml(messageRaw).replace(/\n/g, '<br/>')
      : `Veuillez trouver ci-joint le document <strong>${escapeHtml(titre)}</strong>.`
    const logoImg = entreprise?.logo_url
      ? `<img src="${entreprise.logo_url}" alt="${escapeHtml(entNom)}" style="max-height:64px;max-width:220px;object-fit:contain;display:block;margin:0 auto 8px;" />`
      : ''

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
<div style="padding:28px 32px;text-align:center;">${logoImg}<div style="font-size:22px;font-weight:700;color:#0f1a3a;">${escapeHtml(entNom)}</div></div>
<div style="height:1px;background:#e5e7eb;margin:0 32px;"></div>
<div style="padding:32px;">
<p style="font-size:15px;color:#0f1a3a;line-height:1.7;margin:0 0 12px;">Bonjour${destNom ? ' ' + escapeHtml(destNom) : ''},</p>
<p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px;">${messageHtml}</p>
<p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">Le document est en piece jointe de cet email.</p>
<p style="font-size:15px;color:#0f1a3a;line-height:1.7;margin-top:24px;">Cordialement,<br/><strong>${escapeHtml(entNom)}</strong></p>
</div>
<div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Envoye via Nexartis &mdash; nexartis.fr</p>
</div>
</div>
</div>
</body></html>`

    const nomFichier = `${titre}.pdf`
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: entNom, email: 'no-reply@nexartis.fr' },
        to: [{ email: destEmail, name: destNom || destEmail }],
        replyTo: { email: (entreprise?.email as string) || 'no-reply@nexartis.fr', name: entNom },
        subject: `${titre} — ${entNom}`,
        htmlContent: html,
        attachment: [{ content: pdfBase64, name: nomFichier }],
      }),
    })

    if (!brevoRes.ok) {
      const errJson = await brevoRes.json().catch(() => ({}))
      console.error('documents-types/envoyer: Brevo error', errJson)
      return secureError("Echec de l'envoi de l'email.", 502)
    }

    // Journal des envois (best-effort) : apparait dans « Historique des envois ».
    try {
      const { error: logErr } = await admin.from('documents_envois').insert({
        user_id: user.id,
        document_id: null,
        document_nom: titre,
        destinataire_nom: destNom || null,
        destinataire_email: destEmail,
        mode: 'manuel',
        devis_id: null,
        message: messageRaw || null,
      })
      if (logErr) console.error('documents-types/envoyer: journalisation echouee', logErr)
    } catch (logErr) {
      console.error('documents-types/envoyer: journalisation exception', logErr)
    }

    return secureJson({ ok: true })
  } catch (error) {
    console.error('documents-types/envoyer error:', error)
    return secureError("Erreur lors de l'envoi du document.", 500)
  }
}
