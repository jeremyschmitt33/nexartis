import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { sanitizeReferralCode, validerCodePersonnalise } from '@/lib/parrainage'

/**
 * /api/parrainage/code — Parrainage V2 (15/09/2026)
 *
 *   GET  ?code=XXXX  (public, page d'inscription) : ce code de parrain existe-t-il ?
 *                    Reponse minimale { valide: boolean } — aucune identite exposee.
 *   POST { code }    (artisan connecte) : personnaliser SON code de parrainage.
 *                    Les anciens liens (ancien code) cessent de fonctionner.
 */
export const dynamic = 'force-dynamic'

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    // Anti-enumeration : 20 verifications / minute par IP.
    if (!checkRateLimit(`parrain-code-check:${ip}`, 20, 60_000)) return rateLimitError()

    const code = sanitizeReferralCode(req.nextUrl.searchParams.get('code'))
    if (!code) return secureJson({ valide: false })

    const admin = adminClient()
    if (!admin) return secureError('Configuration serveur invalide', 500)

    const { data } = await admin
      .from('entreprises')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    return secureJson({ valide: !!data })
  } catch (error) {
    console.error('[parrainage/code GET] erreur:', error)
    return secureError('Erreur serveur', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedError()

    if (!checkRateLimit(`parrain-code-set:${user.id}`, 5, 60_000)) return rateLimitError()

    let body: { code?: unknown }
    try {
      body = await req.json()
    } catch {
      return secureError('Requête invalide')
    }

    const v = validerCodePersonnalise(body.code)
    if (!v.ok) return secureError(v.erreur, 400)

    const admin = adminClient()
    if (!admin) return secureError('Configuration serveur invalide', 500)

    const { data: entreprise } = await admin
      .from('entreprises')
      .select('id, referral_code')
      .eq('user_id', user.id)
      .single()
    if (!entreprise) return secureError('Profil entreprise introuvable', 404)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'

    if (entreprise.referral_code === v.code) {
      return secureJson({ code: v.code, lien: `${siteUrl}/register?ref=${v.code}` })
    }

    const { error } = await admin
      .from('entreprises')
      .update({ referral_code: v.code })
      .eq('id', entreprise.id)

    if (error) {
      // 23505 = index unique idx_entreprises_referral_code : code deja pris.
      if ((error as { code?: string }).code === '23505') {
        return secureError('Ce code est déjà utilisé par un autre artisan. Choisissez-en un autre.', 409)
      }
      console.error('[parrainage/code POST] update error:', error)
      return secureError('Erreur serveur', 500)
    }

    return secureJson({ code: v.code, lien: `${siteUrl}/register?ref=${v.code}` })
  } catch (error) {
    console.error('[parrainage/code POST] erreur:', error)
    return secureError('Erreur serveur', 500)
  }
}
