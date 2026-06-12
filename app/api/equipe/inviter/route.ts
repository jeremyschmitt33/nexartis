import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { sendInvitationEmail } from '@/lib/email'
import { getEffectivePlan } from '@/lib/plans'
import { isUserRole, ROLE_LABELS } from '@/lib/roles'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit, isValidEmail,
  secureJson, secureError, rateLimitError, unauthorizedError, forbiddenError,
} from '@/lib/api-security'

// service_role / API admin → runtime Node obligatoire (PAS edge).
export const runtime = 'nodejs'

/**
 * Nombre maximum de membres (non révoqués) par entreprise.
 * Ajustable : on garde une limite haute pour éviter les abus, tout en
 * laissant largement la place aux équipes d'artisans (dirigeant inclus).
 */
const MAX_MEMBRES = 10

/** Client Supabase service_role (bypass RLS) — même pattern que /api/admin/users. */
function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * POST /api/equipe/inviter
 * Body : { email: string, role: 'commercial' | 'ouvrier' }
 * Réservé au DIRIGEANT actif de l'entreprise. Crée une ligne d'invitation
 * (statut='invite') et envoie l'email d'activation.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Auth utilisateur
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 2) Rate limit — défense en profondeur (correctif audit F2) :
    //    - clé par user.id SEUL : ne peut pas être contournée en faisant
    //      varier x-forwarded-for (l'IP est fournie par le client).
    //    - clé par IP en garde-fou supplémentaire.
    const ip = getClientIp(request)
    if (!checkRateLimit(`equipe-inviter:user:${user.id}`, 20, 3_600_000)) {
      return rateLimitError()
    }
    if (!checkRateLimit(`equipe-inviter:ip:${ip}`, 40, 3_600_000)) {
      return rateLimitError()
    }

    // 3) Parsing + validation du body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return secureError('Requête invalide')
    }
    const { email, role } = (body ?? {}) as { email?: unknown; role?: unknown }

    if (typeof email !== 'string' || !isValidEmail(email)) {
      return secureError('Adresse email invalide')
    }
    if (!isUserRole(role) || role === 'dirigeant') {
      return secureError('Rôle invalide')
    }
    const emailNorm = email.trim().toLowerCase()

    const supabase = adminSupabase()

    // 4) Déterminer l'entreprise de l'appelant ET vérifier qu'il en est
    //    DIRIGEANT actif (lecture via service_role, source de vérité).
    const { data: membreAppelant, error: membreErr } = await supabase
      .from('entreprise_membres')
      .select('entreprise_id, role, statut')
      .eq('user_id', user.id)
      .eq('statut', 'actif')
      .maybeSingle()

    if (membreErr) {
      console.error('[equipe/inviter] lookup membre appelant:', membreErr.message)
      return secureError('Erreur serveur', 500)
    }
    if (!membreAppelant || membreAppelant.role !== 'dirigeant') {
      return forbiddenError()
    }
    const entrepriseId = membreAppelant.entreprise_id as string

    // 5) Gating offre : Complet OU essai en cours uniquement.
    const { data: entreprise, error: entErr } = await supabase
      .from('entreprises')
      .select('nom, abonnement_type, subscription_plan')
      .eq('id', entrepriseId)
      .maybeSingle()

    if (entErr) {
      console.error('[equipe/inviter] lookup entreprise:', entErr.message)
      return secureError('Erreur serveur', 500)
    }

    const planInfo = getEffectivePlan(entreprise)
    if (planInfo.plan !== 'complete' && !planInfo.isTrial) {
      return secureError(
        "Cette fonctionnalité est réservée à l'offre Complet. Passez à l'offre Complet pour inviter votre équipe.",
        403,
      )
    }

    // 6) Quota : nombre de membres non révoqués (dirigeant + invités + actifs).
    const { count: membresVivants, error: countErr } = await supabase
      .from('entreprise_membres')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', entrepriseId)
      .neq('statut', 'revoque')

    if (countErr) {
      console.error('[equipe/inviter] count membres:', countErr.message)
      return secureError('Erreur serveur', 500)
    }
    if ((membresVivants ?? 0) >= MAX_MEMBRES) {
      return secureError(
        `Vous avez atteint la limite de ${MAX_MEMBRES} membres pour votre entreprise.`,
        409,
      )
    }

    // 7) Anti-doublon : un membre vivant (non révoqué) avec cet email existe-t-il déjà ?
    const { data: existant, error: existErr } = await supabase
      .from('entreprise_membres')
      .select('id')
      .eq('entreprise_id', entrepriseId)
      .eq('email_invite', emailNorm)
      .neq('statut', 'revoque')
      .maybeSingle()

    if (existErr) {
      console.error('[equipe/inviter] check doublon:', existErr.message)
      return secureError('Erreur serveur', 500)
    }
    if (existant) {
      return secureError('Cet email a déjà été invité', 409)
    }

    // 8) Insert de l'invitation (service_role bypass RLS).
    const inviteToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await supabase
      .from('entreprise_membres')
      .insert({
        entreprise_id: entrepriseId,
        role,
        statut: 'invite',
        email_invite: emailNorm,
        invite_token: inviteToken,
        invite_expires_at: expiresAt,
        invited_by: user.id,
      })

    if (insertErr) {
      // Gérer proprement la collision sur l'index unique uq_membre_email_live
      // (course entre deux invitations simultanées) plutôt qu'une 500.
      if (insertErr.code === '23505' || /duplicate|unique/i.test(insertErr.message)) {
        return secureError('Cet email a déjà été invité', 409)
      }
      console.error('[equipe/inviter] insert invitation:', insertErr.message)
      return secureError('Erreur serveur', 500)
    }

    // 9) URL d'activation absolue (même env var que le reste du projet).
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'
    const inviteUrl = `${baseUrl}/auth/invitation/${inviteToken}`

    // Nom de l'invitant : metadata auth, sinon email.
    const meta = (user.user_metadata as Record<string, unknown>) ?? {}
    const inviterName =
      `${(meta.prenom as string) || ''} ${(meta.nom as string) || ''}`.trim() ||
      user.email ||
      undefined

    // 10) Email d'invitation (bloquant : si l'email échoue, on le signale,
    //     mais l'invitation est déjà créée → on renvoie quand même ok pour ne
    //     pas re-créer un doublon au prochain essai. Log serveur en cas d'échec).
    try {
      await sendInvitationEmail({
        to: emailNorm,
        entrepriseNom: (entreprise?.nom as string) || 'votre entreprise',
        role: ROLE_LABELS[role],
        inviteUrl,
        inviterName,
        expiresAt,
      })
    } catch (mailErr) {
      console.error(
        '[equipe/inviter] envoi email échoué:',
        mailErr instanceof Error ? mailErr.message : String(mailErr),
      )
      // L'invitation existe en base ; le dirigeant pourra renvoyer plus tard.
    }

    return secureJson({ ok: true })
  } catch (err) {
    console.error('[equipe/inviter] erreur:', err instanceof Error ? err.message : String(err))
    return secureError('Erreur serveur', 500)
  }
}
