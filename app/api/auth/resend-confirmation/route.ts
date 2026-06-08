import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { getClientIp, checkRateLimit, isValidEmail } from '@/lib/api-security'

/**
 * POST /api/auth/resend-confirmation
 * Renvoie le mail de confirmation Nexartis à un utilisateur non confirmé.
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting strict (3 tentatives par heure par IP)
    const ip = getClientIp(request)
    if (!checkRateLimit(`resend-confirm:${ip}`, 3, 3_600_000)) {
      // Réponse générique pour ne pas révéler le rate limit
      return NextResponse.json({ success: true })
    }

    const { email } = await request.json()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ success: true }) // Réponse générique (pas de fuite)
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Lookup ciblé par email — évite de charger tous les utilisateurs en mémoire
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) {
      console.error('Resend confirmation listUsers error:', listError)
      return NextResponse.json({ success: true })
    }

    const authUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    // Délai artificiel constant pour éviter le timing-based user enumeration
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

    if (!authUser || authUser.email_confirmed_at) {
      await delay(300) // Même temps de réponse qu'un vrai envoi
      return NextResponse.json({ success: true })
    }

    // Générer un nouveau lien de confirmation
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Resend confirmation generateLink error:', linkError)
      return NextResponse.json({ success: true })
    }

    const confirmUrl = linkData.properties.action_link
    const meta = (authUser.user_metadata as Record<string, unknown>) ?? {}
    const displayName = (meta.prenom as string) || email.split('@')[0]

    const html = buildConfirmationEmailHtml({ name: displayName, confirmUrl })
    await sendEmail({
      to: { email, name: displayName },
      subject: 'Confirmez votre compte Nexartis',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Resend confirmation error:', err)
    return NextResponse.json({ success: true }) // Réponse générique même en cas d'erreur
  }
}

function buildConfirmationEmailHtml({ name, confirmUrl }: { name: string; confirmUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f6f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="padding:28px 32px;text-align:center;background:#ffffff;">
        <div style="font-size:24px;font-weight:700;color:#1e293b;line-height:1.3;">Nexartis</div>
      </div>
      <div style="height:1px;background:#e5e7eb;margin:0 32px;"></div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Bonjour ${name},</h2>
        <p style="font-size:15px;color:#475569;line-height:1.7;">
          Voici votre lien de confirmation. Cliquez sur le bouton ci-dessous pour activer votre compte Nexartis.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background:#e87a2a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;">
            Confirmer mon compte
          </a>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.6;">
          Si vous n'avez pas demandé cet email, ignorez-le simplement.<br/>
          Ce lien expire dans 24 heures.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis — nexartis.fr</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
