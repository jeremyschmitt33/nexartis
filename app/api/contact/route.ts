/**
 * Route API : envoi d'un message de contact utilisateur vers
 * contact@nexartis.fr via Brevo (cf. lib/email.ts).
 *
 * Types acceptes : 'bug' | 'feature' | 'question'.
 *
 * Securite :
 *  - Auth obligatoire (cf. getAuthenticatedUser)
 *  - Rate-limit : 3 messages par heure par utilisateur (anti-spam)
 *  - Validation stricte des inputs
 *  - Pas de fuite de details techniques dans les reponses
 *  - Sanitisation HTML basique du contenu utilisateur
 */

import { NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  checkRateLimit,
  sanitizeString,
  secureJson,
  secureError,
  rateLimitError,
  unauthorizedError,
} from '@/lib/api-security'
import { sendEmail } from '@/lib/email'

const CONTACT_RECIPIENT = 'contact@nexartis.fr'

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Suggestion',
  question: 'Question',
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth obligatoire
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 2. Rate limit : 3 messages / heure / user
    if (!checkRateLimit(`contact:${user.id}`, 3, 60 * 60 * 1000)) {
      return rateLimitError()
    }

    // 3. Lecture du body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return secureError('Donnees invalides')
    }

    if (!body || typeof body !== 'object') {
      return secureError('Donnees invalides')
    }

    const { type, subject, description } = body as {
      type?: unknown
      subject?: unknown
      description?: unknown
    }

    // 4. Validation manuelle des inputs
    if (
      typeof type !== 'string' ||
      !['bug', 'feature', 'question'].includes(type)
    ) {
      return secureError('Type de message invalide')
    }

    if (typeof subject !== 'string' || subject.trim().length < 3 || subject.length > 100) {
      return secureError('Sujet invalide (3 a 100 caracteres)')
    }

    if (
      typeof description !== 'string' ||
      description.trim().length < 10 ||
      description.length > 2000
    ) {
      return secureError('Description invalide (10 a 2000 caracteres)')
    }

    // 5. Sanitisation HTML basique des inputs
    const safeSubject = sanitizeString(subject.trim(), 100)
    const safeDescription = sanitizeString(description.trim(), 2000)
    const safeEmail = sanitizeString(user.email || 'inconnu', 320)
    const typeLabel = TYPE_LABELS[type]

    // 6. Construction du HTML de l'email
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;background:#f4f6f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <h2 style="margin:0 0 12px;color:#0f1a3a;">${typeLabel} : ${safeSubject}</h2>
      <p style="margin:0 0 6px;color:#374151;font-size:14px;">
        <strong>Utilisateur :</strong> ${safeEmail}
      </p>
      <p style="margin:0 0 18px;color:#374151;font-size:14px;">
        <strong>User ID :</strong> ${user.id}
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
      <h3 style="margin:0 0 8px;color:#0f1a3a;font-size:15px;">Message</h3>
      <p style="margin:0;white-space:pre-wrap;color:#1f2937;font-size:14px;line-height:1.6;">${safeDescription}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
      <p style="margin:0;color:#6b7280;font-size:12px;">
        Repondez directement a ce mail : il sera transmis a l'utilisateur (Reply-To configure sur Brevo cote envoi).
      </p>
    </div>
  </div>
</body>
</html>`

    // 7. Envoi via Brevo (lib/email.ts deja en place)
    try {
      await sendEmail({
        to: { email: CONTACT_RECIPIENT, name: 'Nexartis Support' },
        subject: `[${typeLabel}] ${safeSubject}`,
        html,
      })
    } catch (emailErr) {
      // On log cote serveur uniquement, on ne fuit pas le detail au client
      console.error('[contact] sendEmail error:', emailErr)
      return secureError("Impossible d'envoyer le message pour le moment", 500)
    }

    return secureJson({ ok: true })
  } catch (err) {
    console.error('[contact] Unexpected error:', err)
    return secureError('Erreur serveur', 500)
  }
}
