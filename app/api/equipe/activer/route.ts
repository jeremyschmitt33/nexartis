import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import {
  getClientIp, checkRateLimit, isValidUUID, sanitizeString,
  secureJson, secureError, rateLimitError,
} from '@/lib/api-security'

// API admin (création de compte auth) → runtime Node obligatoire (PAS edge).
export const runtime = 'nodejs'

/** Client Supabase service_role (bypass RLS) — même pattern que /api/auth/register. */
function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * POST /api/equipe/activer
 * Body : { token: string, password: string, prenom?: string, nom?: string }
 * Route la PLUS sensible : crée le compte auth du collaborateur invité puis
 * rattache son user_id à la ligne d'invitation (statut='actif').
 * Le front se charge ensuite du signInWithPassword.
 *   200 → { ok: true }
 *   400 → invitation invalide/expirée, mot de passe trop court
 *   409 → un compte existe déjà pour cet email (rattachement = Phase 3)
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Rate limit STRICT (création de compte) : 5 / 15 min par IP.
    const ip = getClientIp(request)
    if (!checkRateLimit(`equipe-activer:${ip}`, 5, 15 * 60_000)) {
      return rateLimitError()
    }

    // 2) Parsing + validation.
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return secureError('Requête invalide')
    }
    const { token, password, prenom, nom } = (body ?? {}) as {
      token?: unknown; password?: unknown; prenom?: unknown; nom?: unknown
    }

    if (typeof token !== 'string' || !isValidUUID(token)) {
      return secureError('Invitation invalide ou expirée')
    }
    if (typeof password !== 'string' || password.length < 8) {
      return secureError('Le mot de passe doit contenir au moins 8 caractères')
    }
    if (password.length > 128) {
      return secureError('Le mot de passe est trop long')
    }
    if (prenom !== undefined && prenom !== null && prenom !== '') {
      if (typeof prenom !== 'string' || prenom.length > 100) {
        return secureError('Prénom invalide')
      }
    }
    if (nom !== undefined && nom !== null && nom !== '') {
      if (typeof nom !== 'string' || nom.length > 100) {
        return secureError('Nom invalide')
      }
    }

    const supabase = adminSupabase()

    // 3) Lookup de l'invitation (statut='invite', non expirée).
    const { data: invitation, error: lookupErr } = await supabase
      .from('entreprise_membres')
      .select('id, email_invite, statut, invite_expires_at')
      .eq('invite_token', token)
      .maybeSingle()

    if (lookupErr) {
      console.error('[equipe/activer] lookup invitation:', lookupErr.message)
      return secureError('Erreur serveur', 500)
    }
    if (!invitation || invitation.statut !== 'invite') {
      return secureError('Invitation invalide ou expirée')
    }
    const expiresAt = invitation.invite_expires_at
      ? new Date(invitation.invite_expires_at as string).getTime()
      : 0
    if (!expiresAt || expiresAt < Date.now()) {
      return secureError('Invitation invalide ou expirée')
    }

    const email = (invitation.email_invite as string) || ''
    if (!email) {
      console.error('[equipe/activer] invitation sans email_invite, id:', invitation.id)
      return secureError('Invitation invalide ou expirée')
    }

    // 4) Création du compte auth (email déjà confirmé : flux par invitation).
    //    Même pattern que /api/auth/register (createUser admin).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        prenom: prenom ? sanitizeString(prenom as string, 100) : '',
        nom: nom ? sanitizeString(nom as string, 100) : '',
      },
    })

    if (createErr) {
      // TODO Phase 3 : rattacher une invitation à un compte AUTH EXISTANT
      // (l'utilisateur a déjà un compte Nexartis sur une autre entreprise, ou
      // s'est inscrit avant d'être invité). Cela nécessite un flux de
      // confirmation côté utilisateur connecté + respect de l'unique
      // « 1 user = 1 entreprise active ». Hors périmètre du Push 1.
      if (/already|registered|exists|duplicate/i.test(createErr.message)) {
        return secureError(
          'Un compte existe déjà pour cet email. Connectez-vous puis contactez votre dirigeant.',
          409,
        )
      }
      console.error('[equipe/activer] createUser:', createErr.message)
      return secureError('Erreur serveur', 500)
    }

    const newUserId = created.user?.id
    if (!newUserId) {
      console.error('[equipe/activer] createUser sans user.id')
      return secureError('Erreur serveur', 500)
    }

    // 5) Rattacher le compte à l'invitation → membre actif.
    const { error: updateErr } = await supabase
      .from('entreprise_membres')
      .update({
        user_id: newUserId,
        statut: 'actif',
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .eq('statut', 'invite') // garde anti-double-activation (course)

    if (updateErr) {
      // L'index unique uq_membre_user_actif (1 user = 1 entreprise active)
      // peut bloquer si ce user_id est déjà actif ailleurs.
      // On nettoie le compte auth fraîchement créé pour ne pas laisser
      // d'orphelin, puis on renvoie un message clair.
      console.error('[equipe/activer] update membre:', updateErr.message)
      try {
        await supabase.auth.admin.deleteUser(newUserId)
      } catch (cleanupErr) {
        // Correctif audit F3 : si le nettoyage échoue, on logge l'email + l'id
        // du compte auth orphelin de façon exploitable pour un nettoyage manuel
        // côté support (sinon l'invité ne pourra plus jamais s'inscrire).
        console.error(
          `[equipe/activer] COMPTE ORPHELIN A NETTOYER MANUELLEMENT — email=${invitation.email_invite} user_id=${newUserId} :`,
          cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        )
      }
      if (updateErr.code === '23505' || /duplicate|unique/i.test(updateErr.message)) {
        return secureError(
          'Ce compte est déjà rattaché à une entreprise. Contactez votre dirigeant.',
          409,
        )
      }
      return secureError('Erreur serveur', 500)
    }

    return secureJson({ ok: true })
  } catch (err) {
    console.error('[equipe/activer] erreur:', err instanceof Error ? err.message : String(err))
    return secureError('Erreur serveur', 500)
  }
}
