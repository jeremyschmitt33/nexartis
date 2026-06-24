import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import {
  getClientIp, checkRateLimit, isValidEmail,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

/**
 * POST /api/auth/register
 * Crée le compte, génère le lien de confirmation, envoie le mail Nexartis.
 * L'utilisateur DOIT cliquer sur le lien pour activer son compte.
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting strict (3 inscriptions par heure par IP)
    const ip = getClientIp(request)
    if (!checkRateLimit(`register:${ip}`, 3, 3_600_000)) {
      return rateLimitError()
    }

    const { email, password, prenom, nom, entreprise, ref } = await request.json()

    if (!email || !password) {
      return secureError('Email et mot de passe requis')
    }

    // ✅ SÉCURITÉ : Valider l'email
    if (!isValidEmail(email)) return secureError('Format d\'email invalide')

    // ✅ SÉCURITÉ : Valider le mot de passe
    if (password.length < 8) {
      return secureError('Le mot de passe doit contenir au moins 8 caractères')
    }
    if (password.length > 128) {
      return secureError('Le mot de passe est trop long')
    }

    // ✅ SÉCURITÉ : Limiter la longueur des champs texte
    if (prenom && prenom.length > 100) return secureError('Prénom trop long')
    if (nom && nom.length > 100) return secureError('Nom trop long')
    if (entreprise && entreprise.length > 200) return secureError('Nom d\'entreprise trop long')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Créer le compte (sans auto-confirm)
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // PAS de confirmation automatique
      user_metadata: { prenom, nom, entreprise },
    })

    if (signUpError) {
      // Si l'email existe déjà
      if (signUpError.message?.includes('already') || signUpError.message?.includes('duplicate')) {
        return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 })
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    const userId = signUpData.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    // 2. Créer la ligne entreprise
    try {
      await supabaseAdmin.from('entreprises').insert({
        user_id: userId,
        email,
        nom: entreprise || '',
        prenom: prenom || '',
        metier: '',
        abonnement_type: 'trial',
        trial_started_at: new Date().toISOString(),
      })
    } catch {} // Non bloquant

    // 2ter. PARRAINAGE : rattacher le filleul a son parrain si un code ?ref est present.
    // L'entreprise du filleul est creee de maniere synchrone par le trigger
    // handle_new_user pendant createUser, donc elle existe ici. Non bloquant.
    try {
      const { attacherParrainage } = await import('@/lib/parrainage')
      await attacherParrainage(supabaseAdmin, userId, ref)
    } catch (e) {
      console.error('attacherParrainage failed:', e)
    }

    // 2bis. Alerte admin : nouvelle inscription (non bloquant)
    try {
      const { sendNewSignupAlert } = await import('@/lib/email')
      sendNewSignupAlert({
        email,
        prenom,
        nom,
        entreprise,
      }).catch((err: unknown) => console.error('sendNewSignupAlert failed:', err))
    } catch (e) {
      console.error('Admin alert hook error:', e)
    }

    // 3. Générer le lien de confirmation
    // On utilise generateLink pour obtenir une URL signée qu'on intègre dans notre mail Nexartis
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'
    let confirmUrl = ''

    // Générer un lien de confirmation via magiclink
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm` },
    })
    if (!linkError && linkData?.properties?.action_link) {
      confirmUrl = linkData.properties.action_link
    }
    if (linkError) console.error('generateLink error:', linkError.message)

    // 4. Envoyer le mail de confirmation Nexartis
    const displayName = prenom ? `${prenom}` : email.split('@')[0]

    if (confirmUrl) {
      // Mail avec bouton de confirmation
      const html = buildConfirmationEmailHtml({ name: displayName, confirmUrl })
      await sendEmail({
        to: { email, name: `${prenom || ''} ${nom || ''}`.trim() || email },
        subject: 'Confirmez votre compte Nexartis',
        html,
      })
      return NextResponse.json({ success: true, needsConfirmation: true })
    } else {
      // Fallback : impossible de générer le lien → on auto-confirme et envoie un mail de bienvenue
      console.warn('Impossible de générer le lien de confirmation, auto-confirm activé')
      await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true })

      // Envoyer le mail de bienvenue classique (sans lien de confirmation)
      const { sendWelcomeEmail } = await import('@/lib/email')
      await sendWelcomeEmail({ email, name: displayName }).catch(() => {})

      return NextResponse.json({ success: true, needsConfirmation: false })
    }
  } catch (err) {
    console.error('Register route error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// -------------------------------------------------------------------
// Template email de confirmation
// -------------------------------------------------------------------

function buildConfirmationEmailHtml({ name, confirmUrl }: { name: string; confirmUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f6f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

      <!-- Header -->
      <div style="padding:28px 32px;text-align:center;background:#ffffff;">
        <div style="font-size:24px;font-weight:700;color:#1e293b;line-height:1.3;">Nexartis</div>
      </div>
      <div style="height:1px;background:#e5e7eb;margin:0 32px;"></div>

      <!-- Body -->
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Bienvenue ${name} !</h2>
        <p style="font-size:15px;color:#475569;line-height:1.7;">
          Votre compte Nexartis a bien été créé. Il ne reste plus qu'une étape : <strong>confirmez votre adresse email</strong> en cliquant sur le bouton ci-dessous.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background:#e87a2a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;">
            Confirmer mon compte
          </a>
        </div>

        <p style="font-size:15px;color:#475569;line-height:1.7;">
          Une fois confirmé, vous pourrez accéder à votre espace et commencer à gérer vos devis, factures, clients et chantiers.
        </p>

        <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.6;">
          Si vous n'avez pas créé de compte sur Nexartis, ignorez simplement cet email.<br/>
          Ce lien expire dans 24 heures.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis — nexartis.fr</p>
      </div>
    </div>
  </div>
</body>
</html>`
}