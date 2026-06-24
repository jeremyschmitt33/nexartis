import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url, r2HeadContentLength } from '@/lib/r2'

/**
 * GET  /api/chantier-photos?chantier_id=...  -> liste des photos (URLs signees)
 * POST /api/chantier-photos                  -> confirme l'enregistrement (metadonnees)
 *
 * Les binaires vivent sur R2 ; ici on ne gere QUE les metadonnees (Supabase).
 */
export const dynamic = 'force-dynamic'

const ALBUMS = ['avant', 'pendant', 'apres']

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ----------------------- LISTE -----------------------
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const chantierId = req.nextUrl.searchParams.get('chantier_id')
  if (!chantierId) return secureError('chantier_id requis')

  const admin = adminClient()
  const { data: photos } = await admin
    .from('chantier_photos')
    .select('id, album, r2_key, thumb_key, taille_octets, largeur, hauteur, legende, prise_le, created_at')
    .eq('user_id', user.id)
    .eq('chantier_id', chantierId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const list = (photos ?? []).map((p) => ({
    id: p.id,
    album: p.album,
    legende: p.legende,
    prise_le: p.prise_le,
    created_at: p.created_at,
    // URLs signees a duree de vie courte (lecture seule)
    thumb_url: p.thumb_key ? presignR2Url('GET', p.thumb_key as string, 3600) : null,
    url: presignR2Url('GET', p.r2_key as string, 3600),
  }))

  return secureJson({ photos: list })
}

// ----------------------- CONFIRMATION -----------------------
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`photo-confirm:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const chantierId = String(b.chantier_id || '')
  const album = ALBUMS.includes(String(b.album)) ? String(b.album) : 'pendant'
  const r2Key = String(b.r2_key || '')
  const thumbKey = b.thumb_key ? String(b.thumb_key) : null
  if (!chantierId || !r2Key) return secureError('Donnees manquantes')

  // Anti-falsification : la cle DOIT appartenir au prefixe de cet utilisateur + ce chantier.
  const prefix = `${user.id}/${chantierId}/`
  if (!r2Key.startsWith(prefix) || (thumbKey && !thumbKey.startsWith(prefix))) {
    return secureError('Cle de fichier invalide', 403)
  }

  const admin = adminClient()

  // Propriete du chantier
  const { data: chantier } = await admin
    .from('chantiers')
    .select('id')
    .eq('id', chantierId)
    .eq('user_id', user.id)
    .single()
  if (!chantier) return secureError('Chantier introuvable', 404)

  // Taille REELLE lue sur R2 (anti-triche : on ne fait pas confiance au client).
  // Si l'objet n'existe pas, l'upload a echoue -> on refuse la confirmation.
  const realSize = await r2HeadContentLength(r2Key)
  if (realSize === null) return secureError('Fichier introuvable sur le stockage', 400)

  const { data: inserted, error } = await admin
    .from('chantier_photos')
    .insert({
      user_id: user.id,
      chantier_id: chantierId,
      album,
      r2_key: r2Key,
      thumb_key: thumbKey,
      taille_octets: realSize,
      largeur: Number(b.largeur) || null,
      hauteur: Number(b.hauteur) || null,
      legende: b.legende ? String(b.legende).slice(0, 300) : null,
      prise_le: b.prise_le ? new Date(String(b.prise_le)).toISOString() : new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[chantier-photos] insert error:', error)
    return secureError('Enregistrement impossible', 500)
  }

  return secureJson({ ok: true, id: inserted?.id })
}
