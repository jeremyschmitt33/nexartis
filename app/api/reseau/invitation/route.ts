import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendEmail, isOptedOut, buildUnsubscribeUrl } from '@/lib/email'
import {
  getClientIp, checkRateLimit, isValidEmail,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

// ============================================================================
// POST /api/reseau/invitation
// Envoie l'email d'invitation "confrère" à une adresse NON encore inscrite.
// La relation (artisan_relations) a déjà été créée côté client via le RPC
// `envoyer_invitation_confrere` (qui renvoie le token). Cette route ne fait
// QUE l'envoi de l'email — la seule chose qui doit rester côté serveur (clé
// Brevo). On revérifie que le token appartient bien à une invitation de
// l'utilisateur connecté (anti-abus).
// ============================================================================

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`reseau-invitation:${ip}`, 10, 60_000)) return rateLimitError()

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return unauthorizedError()

    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const token = typeof body?.token === 'string' ? body.token : ''
    if (!email || !token || !isValidEmail(email)) return secureError('Paramètres invalides')

    // Vérifie que ce token est bien une invitation de CET utilisateur.
    const { data: rel } = await supabase
      .from('artisan_relations')
      .select('demandeur_id, destinataire_email')
      .eq('token', token)
      .is('deleted_at', null)
      .maybeSingle()
    if (!rel || rel.demandeur_id !== user.id) return secureError('Invitation introuvable', 404)

    // SÉCURITÉ : on envoie à l'adresse enregistrée EN BASE pour cette invitation,
    // JAMAIS à l'email fourni par le client (sinon un jeton valide permettrait
    // d'envoyer des emails à des tiers arbitraires — relais de spam).
    const dest = (rel.destinataire_email as string | null)?.trim()
    if (!dest) return secureError('Invitation sans destinataire', 400)

    // RGPD : si le destinataire s'est désinscrit des emails Nexartis, on
    // n'envoie RIEN. La relation existe déjà (créée côté client) : l'inviteur
    // pourra lui partager le lien manuellement. On le signale au client.
    if (await isOptedOut(dest)) {
      return secureJson({ success: true, email_envoye: false, reason: 'optout' })
    }

    // Nom de l'inviteur (son entreprise).
    const { data: ent } = await supabase
      .from('entreprises').select('nom').eq('user_id', user.id).maybeSingle()
    const inviterName = (ent?.nom as string | undefined)?.trim() || 'Un artisan'

    const origin = req.nextUrl.origin
    const lien = `${origin}/invitation/${token}`
    // Lien de désinscription signé (RGPD) : affiché dans le pied de page ET
    // envoyé dans l'en-tête List-Unsubscribe (désinscription 1-clic côté mail).
    const unsubUrl = buildUnsubscribeUrl(dest)

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:8px;">
        <h2 style="font-size:22px;color:#0f1a3a;font-weight:800;margin:0 0 16px;">
          ${esc(inviterName)} vous invite sur Nexartis
        </h2>
        <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 14px;">
          Bonjour,<br/><br/>
          <strong>${esc(inviterName)}</strong> souhaite pouvoir échanger des messages et des documents
          avec vous directement sur <strong>Nexartis</strong>, l'outil de gestion pensé pour les artisans.
        </p>
        <div style="text-align:center;margin:26px 0;">
          <a href="${esc(lien)}" style="display:inline-block;background:#e87a2a;color:#fff;text-decoration:none;
             font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">
            Voir l'invitation
          </a>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:4px 0 0;word-break:break-all;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
          <a href="${esc(lien)}" style="color:#2563eb;">${esc(lien)}</a>
        </p>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:22px 0 0;">
          Vous recevez cet email parce qu'un artisan vous a invité sur Nexartis.
          Si vous n'êtes pas concerné(e), ignorez simplement ce message.
          <br/>
          <a href="${esc(unsubUrl)}" style="color:#94a3b8;text-decoration:underline;">Ne plus recevoir d'emails de Nexartis</a>.
        </p>
      </div>`

    // Anti-spam : plafond par UTILISATEUR (20 invitations réellement envoyées
    // par jour), en plus du rate-limit par IP en tête de route. Placé ICI —
    // après opt-out et validation — pour ne décompter que les envois réels.
    if (!checkRateLimit(`reseau-invit-user:${user.id}`, 20, 86_400_000)) return rateLimitError()

    await sendEmail({
      to: { email: dest },
      senderName: `${inviterName} via Nexartis`,
      subject: `${inviterName} vous invite à échanger sur Nexartis`,
      html,
      listUnsubscribeUrl: unsubUrl,
    })

    return secureJson({ success: true, email_envoye: true })
  } catch (error) {
    console.error('reseau invitation email error:', error)
    return secureError('Erreur serveur', 500)
  }
}
