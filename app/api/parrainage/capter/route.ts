import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { attacherParrainage } from '@/lib/parrainage'

/**
 * POST /api/parrainage/capter
 *
 * FILET DE SECURITE de la capture de parrainage.
 *
 * Le chemin principal (inscription email/mot de passe) rattache deja le
 * parrainage dans /api/auth/register. Cet endpoint couvre les autres cas :
 *   - inscription via Google (OAuth) qui ne passe pas par /api/auth/register ;
 *   - tout cas ou le rattachement aurait ete manque.
 *
 * Il lit le cookie `nexartis_ref` (pose a l'atterrissage sur /register?ref=CODE),
 * rattache le parrainage pour l'utilisateur CONNECTE, puis efface le cookie.
 * Idempotent : si le parrainage existe deja, ne fait rien (pas d'erreur).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`parrainage-capter:${ip}`, 10, 60_000)) {
    return rateLimitError()
  }

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const ref = cookies().get('nexartis_ref')?.value
  if (!ref) return secureJson({ ok: true, skipped: 'no_cookie' })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let created = false
  let reason: string | undefined
  try {
    const result = await attacherParrainage(admin, user.id, ref)
    created = result.created
    reason = result.reason
  } catch (e) {
    console.error('[parrainage/capter] error:', e)
  }

  const res = secureJson({ ok: true, created })

  // On efface le cookie sauf en cas d'erreur transitoire (on pourra reessayer).
  const transient = reason === 'filleul_introuvable' || reason === 'erreur_insert'
  if (!transient) {
    res.cookies.set('nexartis_ref', '', { maxAge: 0, path: '/' })
  }
  return res
}
