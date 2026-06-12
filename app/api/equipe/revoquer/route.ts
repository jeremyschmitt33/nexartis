import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit, isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError, forbiddenError,
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
 * POST /api/equipe/revoquer
 * Body : { membreId: string }
 * Réservé au DIRIGEANT actif. Soft-delete (statut='revoque') : on conserve la
 * ligne et les données liées. Règles : pas d'auto-révocation, pas de
 * révocation du dernier dirigeant actif, pas de révocation cross-entreprise.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Auth utilisateur
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    // 2) Rate limit
    const ip = getClientIp(request)
    if (!checkRateLimit(`equipe-revoquer:${user.id}:${ip}`, 30, 3_600_000)) {
      return rateLimitError()
    }

    // 3) Validation du body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return secureError('Requête invalide')
    }
    const { membreId } = (body ?? {}) as { membreId?: unknown }
    if (typeof membreId !== 'string' || !isValidUUID(membreId)) {
      return secureError('Identifiant de membre invalide')
    }

    const supabase = adminSupabase()

    // 4) L'appelant doit être DIRIGEANT actif. On récupère son entreprise.
    const { data: membreAppelant, error: appelantErr } = await supabase
      .from('entreprise_membres')
      .select('id, entreprise_id, role, statut')
      .eq('user_id', user.id)
      .eq('statut', 'actif')
      .maybeSingle()

    if (appelantErr) {
      console.error('[equipe/revoquer] lookup appelant:', appelantErr.message)
      return secureError('Erreur serveur', 500)
    }
    if (!membreAppelant || membreAppelant.role !== 'dirigeant') {
      return forbiddenError()
    }
    const entrepriseId = membreAppelant.entreprise_id as string

    // 5) Charger le membre cible.
    const { data: cible, error: cibleErr } = await supabase
      .from('entreprise_membres')
      .select('id, entreprise_id, role, statut, user_id')
      .eq('id', membreId)
      .maybeSingle()

    if (cibleErr) {
      console.error('[equipe/revoquer] lookup cible:', cibleErr.message)
      return secureError('Erreur serveur', 500)
    }
    if (!cible) {
      return secureError('Membre introuvable', 404)
    }

    // 6) Anti cross-entreprise : la cible doit appartenir à l'entreprise de l'appelant.
    if (cible.entreprise_id !== entrepriseId) {
      return forbiddenError()
    }

    // 7) Interdire l'auto-révocation (par id de ligne ET par user_id).
    if (cible.id === membreAppelant.id || (cible.user_id && cible.user_id === user.id)) {
      return secureError('Vous ne pouvez pas vous révoquer vous-même.', 409)
    }

    // 8) Si déjà révoqué : rien à faire (idempotent).
    if (cible.statut === 'revoque') {
      return secureJson({ ok: true })
    }

    // 9) Interdire la révocation du DERNIER dirigeant actif.
    if (cible.role === 'dirigeant' && cible.statut === 'actif') {
      const { count: dirigeantsActifs, error: countErr } = await supabase
        .from('entreprise_membres')
        .select('id', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId)
        .eq('role', 'dirigeant')
        .eq('statut', 'actif')

      if (countErr) {
        console.error('[equipe/revoquer] count dirigeants:', countErr.message)
        return secureError('Erreur serveur', 500)
      }
      if ((dirigeantsActifs ?? 0) <= 1) {
        return secureError(
          "Impossible de révoquer le dernier dirigeant de l'entreprise.",
          409,
        )
      }
    }

    // 10) Soft-delete : statut='revoque' (on garde la ligne et les données).
    const { error: updateErr } = await supabase
      .from('entreprise_membres')
      .update({ statut: 'revoque', updated_at: new Date().toISOString() })
      .eq('id', membreId)
      .eq('entreprise_id', entrepriseId) // double garde anti cross-entreprise

    if (updateErr) {
      console.error('[equipe/revoquer] update statut:', updateErr.message)
      return secureError('Erreur serveur', 500)
    }

    return secureJson({ ok: true })
  } catch (err) {
    console.error('[equipe/revoquer] erreur:', err instanceof Error ? err.message : String(err))
    return secureError('Erreur serveur', 500)
  }
}
