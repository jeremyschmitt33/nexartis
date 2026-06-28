import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * POST /api/rapport-photos/sign-upload
 * Body : { rapport_id, photo_local_id, size }
 *
 * Dedie au RAPPORT (isole du flux photos-chantier). Verifie l'auth + la
 * propriete du rapport + le quota, puis renvoie des URLs signees R2.
 * Cle R2 DETERMINISTE (basee sur photo_local_id) -> un retour-arriere/retry
 * reecrit le MEME objet (idempotence, pas d'orphelin).
 */
export const dynamic = 'force-dynamic'

const SOFT_LIMIT = 1 * 1024 * 1024 * 1024
const HARD_LIMIT = 2 * 1024 * 1024 * 1024
const LOCAL_ID_RE = /^[a-z0-9-]{8,64}$/i

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-photo-sign:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let body: { rapport_id?: string; photo_local_id?: string; size?: number }
  try { body = await req.json() } catch { return secureError('Requete invalide') }

  const rapportId = String(body.rapport_id || '')
  const photoLocalId = String(body.photo_local_id || '')
  if (!rapportId || !photoLocalId) return secureError('Donnees manquantes')
  if (!LOCAL_ID_RE.test(photoLocalId)) return secureError('Identifiant photo invalide')
  const taille = Math.max(0, Math.min(Number(body.size) || 0, 50 * 1024 * 1024))

  const db = admin()

  const { data: rapport } = await db
    .from('rapports_intervention')
    .select('id')
    .eq('id', rapportId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  const { data: rows } = await db
    .from('photos')
    .select('taille_octets')
    .eq('user_id', user.id)
    .is('deleted_at', null)
  const used = (rows ?? []).reduce((s, r) => s + (Number(r.taille_octets) || 0), 0)

  if (used + taille >= HARD_LIMIT) {
    return secureJson({
      error: 'quota_depasse',
      message: 'Limite de stockage photos atteinte (2 Go). Supprimez des photos pour en ajouter.',
      used, hard: HARD_LIMIT,
    }, 403)
  }

  const key = `${user.id}/rapports/${rapportId}/${photoLocalId}.jpg`
  const thumbKey = `${user.id}/rapports/${rapportId}/${photoLocalId}_thumb.jpg`

  return secureJson({
    key, thumbKey,
    putUrl: presignR2Url('PUT', key, 900),
    putThumbUrl: presignR2Url('PUT', thumbKey, 900),
    quota: { used, soft: SOFT_LIMIT, hard: HARD_LIMIT, warn: used + taille >= SOFT_LIMIT },
  })
}
