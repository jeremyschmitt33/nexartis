import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, isValidEmail, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * POST /api/documents/envoyer
 * Body : { document_id, mode: 'devis' | 'manuel', devis_id?, destinataire_email?,
 *          destinataire_nom?, message? }
 *
 * Coffre-fort (Vague 2b). Envoie un document stocke en PIECE JOINTE par email
 * (Brevo). Le destinataire est soit l'email du client d'un devis (mode 'devis'),
 * soit un email/nom saisis librement (mode 'manuel', comme le planning : le
 * destinataire n'a pas besoin d'exister en base). Securite : auth + rate-limit
 * + verif propriete du document + validation email. Le fichier est relu depuis
 * R2 (URL signee GET), encode en base64 et joint au format Brevo.
 */
export const dynamic = 'force-dynamic'
// Honore si l'app passe en plan Pro (60s). Inoffensif en Hobby (plafonne a 10s).
export const maxDuration = 60

// Limite pratique de piece jointe Brevo. On limite le fichier source a 5 Mo
// (base64 +33% => ~6.7 Mo) pour rester sous la limite Brevo avec marge ET
// tenir dans le budget temps Vercel Hobby (10s) : lecture R2 + base64 + envoi.
const MAX_ATTACH_BYTES = 5 * 1024 * 1024
const ATTACH_LIMIT_MSG = 'Fichier trop volumineux pour l\'envoi par email (max 5 Mo). Telechargez-le puis envoyez-le via votre messagerie.'
// Delai max pour relire le fichier depuis R2 avant d'abandonner proprement.
const R2_FETCH_TIMEOUT_MS = 7000

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
    if (!checkRateLimit(`doc-envoi:${ip}`, 10, 60_000)) return rateLimitError()

    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    let b: Record<string, unknown>
    try { b = await req.json() } catch { return secureError('Requete invalide') }

    const documentId = String(b.document_id || '')
    const mode = b.mode === 'devis' ? 'devis' : 'manuel'
    const messageRaw = b.message ? sanitizeString(String(b.message), 2000) : ''

    if (!documentId || !isValidUUID(documentId)) return secureError('Document invalide')

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('documents/envoyer: SUPABASE_SERVICE_ROLE_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }
    if (!process.env.BREVO_API_KEY) {
      console.error('documents/envoyer: BREVO_API_KEY absente')
      return secureError('Configuration serveur invalide', 500)
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Propriete du document
    const { data: doc } = await admin
      .from('documents_stockes')
      .select('id, nom, fichier_url, mime_type, taille_octets, user_id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()
    if (!doc) return secureError('Document introuvable', 404)

    const key = String(doc.fichier_url || '')
    if (!key.startsWith(`${user.id}/`)) return secureError('Cle de fichier invalide', 403)

    if (Number(doc.taille_octets) > MAX_ATTACH_BYTES) {
      return secureError(ATTACH_LIMIT_MSG, 413)
    }

    // Resoudre le destinataire
    let destEmail = ''
    let destNom = ''

    if (mode === 'devis') {
      const devisId = String(b.devis_id || '')
      if (!isValidUUID(devisId)) return secureError('Devis invalide')
      const { data: devis } = await admin
        .from('devis')
        .select('id, client_id, user_id')
        .eq('id', devisId)
        .eq('user_id', user.id)
        .single()
      if (!devis) return secureError('Devis introuvable', 404)
      if (!devis.client_id) return secureError("Ce devis n'a pas de client avec un email.", 400)
      const { data: client } = await admin
        .from('clients')
        .select('nom, prenom, raison_sociale, email')
        .eq('id', devis.client_id)
        .eq('user_id', user.id)
        .single()
      if (!client || !client.email) return secureError("Le client de ce devis n'a pas d'email enregistre.", 400)
      destEmail = String(client.email)
      destNom = (client.raison_sociale || `${client.prenom || ''} ${client.nom || ''}`).trim() || 'Client'
    } else {
      destEmail = String(b.destinataire_email || '').trim()
      destNom = sanitizeString(String(b.destinataire_nom || ''), 120).trim() || destEmail
      if (!isValidEmail(destEmail)) return secureError('Email du destinataire invalide')
    }

    if (!isValidEmail(destEmail)) return secureError('Email du destinataire invalide')

    // Profil entreprise (expediteur affiche + reply-to)
    const { data: entreprise } = await admin
      .from('entreprises')
      .select('nom, email, logo_url')
      .eq('user_id', user.id)
      .single()
    const entNom = (entreprise?.nom as string) || 'Nexartis'

    // Recuperer le fichier depuis R2 (URL signee GET) et l'encoder en base64.
    // Timeout dur (AbortController) pour ne jamais bloquer la fonction serverless
    // au-dela du budget : en cas de depassement on renvoie une erreur claire.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), R2_FETCH_TIMEOUT_MS)
    let arrayBuf: ArrayBuffer
    try {
      const fileRes = await fetch(presignR2Url('GET', key, 120), { signal: controller.signal })
      if (!fileRes.ok) {
        console.error('documents/envoyer: lecture R2 echouee', fileRes.status)
        return secureError('Impossible de recuperer le fichier.', 500)
      }
      arrayBuf = await fileRes.arrayBuffer()
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      if (aborted) {
        console.error('documents/envoyer: lecture R2 timeout')
        return secureError("L'envoi a pris trop de temps. Reessayez ou telechargez le document pour l'envoyer manuellement.", 504)
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
    if (arrayBuf.byteLength > MAX_ATTACH_BYTES) {
      return secureError(ATTACH_LIMIT_MSG, 413)
    }
    const base64 = Buffer.from(arrayBuf).toString('base64')

    const nomFichier = String(doc.nom || 'document')
    const messageHtml = messageRaw
      ? escapeHtml(messageRaw).replace(/\n/g, '<br/>')
      : `Veuillez trouver ci-joint le document <strong>${escapeHtml(nomFichier)}</strong>.`
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
<p style="font-size:15px;color:#0f1a3a;line-height:1.7;margin:0 0 12px;">Bonjour ${escapeHtml(destNom)},</p>
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

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: entNom, email: 'no-reply@nexartis.fr' },
        to: [{ email: destEmail, name: destNom }],
        replyTo: { email: (entreprise?.email as string) || 'no-reply@nexartis.fr', name: entNom },
        subject: `${nomFichier} — ${entNom}`,
        htmlContent: html,
        attachment: [{ content: base64, name: nomFichier }],
      }),
    })

    if (!brevoRes.ok) {
      const errJson = await brevoRes.json().catch(() => ({}))
      console.error('documents/envoyer: Brevo error', errJson)
      return secureError("Echec de l'envoi de l'email.", 502)
    }

    // Journal des envois (best-effort) : on trace l'envoi pour que l'artisan
    // soit couvert (qui a recu quoi et quand). Insertion via service_role
    // (la table documents_envois est en lecture seule cote utilisateur).
    // Si la journalisation echoue, l'email est deja parti : on ne fait PAS
    // echouer la requete, on logue juste l'erreur serveur.
    try {
      const { error: logErr } = await admin.from('documents_envois').insert({
        user_id: user.id,
        document_id: documentId,
        document_nom: nomFichier,
        destinataire_nom: destNom || null,
        destinataire_email: destEmail,
        mode,
        devis_id: mode === 'devis' ? String(b.devis_id || '') || null : null,
        message: messageRaw || null,
      })
      if (logErr) console.error('documents/envoyer: journalisation echouee', logErr)
    } catch (logErr) {
      console.error('documents/envoyer: journalisation exception', logErr)
    }

    return secureJson({ ok: true })
  } catch (error) {
    console.error('documents/envoyer error:', error)
    return secureError("Erreur lors de l'envoi du document.", 500)
  }
}
