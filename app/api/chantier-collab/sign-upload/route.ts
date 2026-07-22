import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * POST /api/chantier-collab/sign-upload
 * Body : { chantier_id (requis), size }
 *
 * Un SOUS-TRAITANT (B) demande une URL signée pour verser une photo dans le
 * chantier d'un confrère (A). On vérifie que B est collaborateur ACTIF du
 * chantier avec le droit photos, puis on signe une clé dans l'espace R2 du
 * PROPRIÉTAIRE A (la photo compte dans SON stockage, comme s'il l'avait ajoutée).
 */
export const dynamic = 'force-dynamic'

const HARD_LIMIT = 2 * 1024 * 1024 * 1024 // 2 Go

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`collab-photo-sign:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser() // B (sous-traitant)
  if (!user) return unauthorizedError()

  let body: { chantier_id?: string; size?: number }
  try { body = await req.json() } catch { return secureError('Requete invalide') }
  const chantierId = body.chantier_id
  if (!chantierId) return secureError('chantier_id requis')
  const taille = Math.max(0, Math.min(Number(body.size) || 0, 50 * 1024 * 1024))

  const db = admin()

  // B est-il collaborateur ACTIF de ce chantier, avec le droit photos ?
  const { data: partage } = await db
    .from('chantier_partages')
    .select('id')
    .eq('chantier_id', chantierId)
    .eq('collaborateur_id', user.id)
    .eq('statut', 'actif')
    .eq('peut_photos', true)
    .maybeSingle()
  if (!partage) return secureError('Ajout de photos non autorise sur ce chantier', 403)

  // Propriétaire (A) + client du chantier.
  const { data: chantier } = await db
    .from('chantiers')
    .select('user_id, client_id')
    .eq('id', chantierId)
    .single()
  if (!chantier) return secureError('Chantier introuvable', 404)
  const ownerId = chantier.user_id as string
  const clientId = (chantier.client_id as string | null) || ''
  if (!clientId) return secureError('Ce chantier est sans client associe', 400)

  // Quota sur l'espace du PROPRIÉTAIRE (c'est son stockage).
  const { data: rows } = await db
    .from('photos')
    .select('taille_octets')
    .eq('user_id', ownerId)
    .is('deleted_at', null)
  const used = (rows ?? []).reduce((s, r) => s + (Number(r.taille_octets) || 0), 0)
  if (used + taille >= HARD_LIMIT) {
    return secureJson({
      error: 'quota_depasse',
      message: 'Le stockage photos de ce chantier est plein (2 Go). Le proprietaire doit liberer de la place.',
    }, 403)
  }

  const uuid = randomUUID()
  const key = `${ownerId}/${clientId}/${uuid}.jpg` // namespace du PROPRIÉTAIRE
  return secureJson({ key, putUrl: presignR2Url('PUT', key, 900) })
}
