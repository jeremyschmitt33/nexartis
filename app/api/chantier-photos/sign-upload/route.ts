import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * POST /api/chantier-photos/sign-upload
 * Body : { client_id (requis), chantier_id?, devis_id?, facture_id?, size }
 *
 * Verifie l'auth + la propriete du CLIENT + le QUOTA, puis renvoie des URLs
 * signees pour envoyer directement l'original + la miniature vers R2.
 * (Les photos sont rattachees au client ; chantier/devis/facture sont des liens.)
 */
export const dynamic = 'force-dynamic'

const SOFT_LIMIT = 1 * 1024 * 1024 * 1024 // 1 Go : avertissement
const HARD_LIMIT = 2 * 1024 * 1024 * 1024 // 2 Go : blocage

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`photo-sign:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let body: { client_id?: string; size?: number }
  try { body = await req.json() } catch { return secureError('Requete invalide') }
  const clientId = body.client_id
  if (!clientId) return secureError('client_id requis')
  const taille = Math.max(0, Math.min(Number(body.size) || 0, 50 * 1024 * 1024))

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Propriete du client
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()
  if (!client) return secureError('Client introuvable', 404)

  // Quota : somme des tailles des photos non supprimees de l'artisan
  const { data: rows } = await admin
    .from('photos')
    .select('taille_octets')
    .eq('user_id', user.id)
    .is('deleted_at', null)
  const used = (rows ?? []).reduce((s, r) => s + (Number(r.taille_octets) || 0), 0)

  if (used + taille >= HARD_LIMIT) {
    return secureJson({
      error: 'quota_depasse',
      message: 'Vous avez atteint la limite de stockage photos (2 Go). Supprimez des photos pour pouvoir en ajouter de nouvelles.',
      used, hard: HARD_LIMIT,
    }, 403)
  }

  const uuid = randomUUID()
  const key = `${user.id}/${clientId}/${uuid}.jpg`
  const thumbKey = `${user.id}/${clientId}/${uuid}_thumb.jpg`

  return secureJson({
    key,
    thumbKey,
    putUrl: presignR2Url('PUT', key, 900),
    putThumbUrl: presignR2Url('PUT', thumbKey, 900),
    quota: { used, soft: SOFT_LIMIT, hard: HARD_LIMIT, warn: used + taille >= SOFT_LIMIT },
  })
}
