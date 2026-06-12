import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { isUserRole } from '@/lib/roles'
import {
  getClientIp, checkRateLimit, isValidUUID,
  secureJson, rateLimitError,
} from '@/lib/api-security'

// service_role → runtime Node obligatoire (PAS edge).
export const runtime = 'nodejs'

/** Client Supabase service_role (bypass RLS) — même pattern que /api/admin/users. */
function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * GET /api/equipe/invitation/[token]
 * Lookup PUBLIC d'une invitation (page d'activation côté front). Rate-limité.
 * Ne renvoie jamais d'autres données que le strict nécessaire (anti-énumération).
 *   200 → { valid: true,  entrepriseNom, role, email }
 *   200 → { valid: false }                 (token inconnu ou mal formé)
 *   200 → { valid: false, expired: true }  (trouvé mais expiré ou déjà utilisé)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    // Rate limit (par IP : 30 lookups / 5 min — la page peut être rechargée).
    const ip = getClientIp(request)
    if (!checkRateLimit(`equipe-invitation:${ip}`, 30, 5 * 60_000)) {
      return rateLimitError()
    }

    const token = params.token
    if (!token || !isValidUUID(token)) {
      return secureJson({ valid: false })
    }

    const supabase = adminSupabase()

    const { data: invitation, error } = await supabase
      .from('entreprise_membres')
      .select('entreprise_id, role, statut, email_invite, invite_expires_at')
      .eq('invite_token', token)
      .maybeSingle()

    if (error) {
      console.error('[equipe/invitation GET] lookup:', error.message)
      // On reste discret côté client.
      return secureJson({ valid: false })
    }
    if (!invitation) {
      return secureJson({ valid: false })
    }

    // Doit être encore au statut 'invite' (sinon déjà activée ou révoquée).
    if (invitation.statut !== 'invite') {
      return secureJson({ valid: false, expired: true })
    }

    // Expiration.
    const expiresAt = invitation.invite_expires_at
      ? new Date(invitation.invite_expires_at as string).getTime()
      : 0
    if (!expiresAt || expiresAt < Date.now()) {
      return secureJson({ valid: false, expired: true })
    }

    // Garde-fou : rôle stocké doit être un rôle invitable connu.
    const role = invitation.role as string
    if (!isUserRole(role) || role === 'dirigeant') {
      // Donnée incohérente : on ne propose pas d'activation.
      return secureJson({ valid: false })
    }

    // Résoudre le nom de l'entreprise (affichage sur la page d'activation).
    const { data: ent } = await supabase
      .from('entreprises')
      .select('nom')
      .eq('id', invitation.entreprise_id as string)
      .maybeSingle()

    return secureJson({
      valid: true,
      entrepriseNom: (ent?.nom as string) || undefined,
      role,
      email: (invitation.email_invite as string) || undefined,
    })
  } catch (err) {
    console.error('[equipe/invitation GET] erreur:', err instanceof Error ? err.message : String(err))
    return secureJson({ valid: false })
  }
}
