import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url, r2HeadContentLength } from '@/lib/r2'

/**
 * GET  /api/rapport-photos?rapport_id=  -> liste des photos d'un rapport
 * POST /api/rapport-photos              -> confirme l'enregistrement (idempotent)
 *
 * Dedie au RAPPORT (isole du flux photos-chantier). Photos rattachees au
 * rapport (chantier_id NULL), SANS watermark. Confirm idempotent grace a
 * l'index unique (user_id, r2_key).
 */
export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const rapportId = req.nextUrl.searchParams.get('rapport_id')
  if (!rapportId) return secureError('rapport_id requis')

  const db = admin()
  const { data: rapport } = await db
    .from('rapports_intervention').select('id')
    .eq('id', rapportId).eq('user_id', user.id).is('deleted_at', null).single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  const { data: photos } = await db
    .from('photos')
    .select('id, r2_key, thumb_key, largeur, hauteur, legende, prise_le, created_at')
    .eq('user_id', user.id)
    .eq('rapport_id', rapportId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const list = (photos ?? []).map((p) => ({
    id: p.id,
    largeur: p.largeur,
    hauteur: p.hauteur,
    legende: p.legende,
    prise_le: p.prise_le,
    created_at: p.created_at,
    thumb_url: p.thumb_key ? presignR2Url('GET', p.thumb_key as string, 3600) : null,
    url: presignR2Url('GET', p.r2_key as string, 3600),
  }))

  return secureJson({ photos: list })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-photo-confirm:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const rapportId = String(b.rapport_id || '')
  const r2Key = String(b.r2_key || '')
  const thumbKey = b.thumb_key ? String(b.thumb_key) : null
  if (!rapportId || !r2Key) return secureError('Donnees manquantes')

  const prefix = `${user.id}/`
  if (!r2Key.startsWith(prefix) || (thumbKey && !thumbKey.startsWith(prefix))) {
    return secureError('Cle de fichier invalide', 403)
  }
  // La cle doit appartenir a CE rapport (anti-falsification ciblee)
  if (!r2Key.startsWith(`${user.id}/rapports/${rapportId}/`)) {
    return secureError('Cle de fichier invalide', 403)
  }

  const db = admin()
  const { data: rapport } = await db
    .from('rapports_intervention').select('id, client_id')
    .eq('id', rapportId).eq('user_id', user.id).is('deleted_at', null).single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  // Taille REELLE lue sur R2 (anti-triche ; objet absent => upload echoue)
  const realSize = await r2HeadContentLength(r2Key)
  if (realSize === null) return secureError('Fichier introuvable sur le stockage', 400)

  // prise_le : date absente/invalide toleree -> maintenant
  let priseLe = new Date().toISOString()
  if (b.prise_le) { const d = new Date(String(b.prise_le)); if (!isNaN(d.getTime())) priseLe = d.toISOString() }

  const row = {
    user_id: user.id,
    rapport_id: rapportId,
    // Source de verite = le rapport (deja verifie owner). On NE fait PAS
    // confiance a un client_id fourni dans le body (anti-forge de reference).
    client_id: (rapport.client_id as string | null) ?? null,
    chantier_id: null,
    r2_key: r2Key,
    thumb_key: thumbKey,
    taille_octets: realSize,
    largeur: Number(b.largeur) || null,
    hauteur: Number(b.hauteur) || null,
    legende: b.legende ? String(b.legende).slice(0, 300) : null,
    prise_le: priseLe,
  }

  const { data: inserted, error } = await db.from('photos').insert(row).select('id').single()
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') {
      // Deja confirmee (double-tap / retry apres crash) -> idempotent
      const { data: existing } = await db
        .from('photos').select('id')
        .eq('user_id', user.id).eq('r2_key', r2Key).is('deleted_at', null).single()
      if (existing) return secureJson({ ok: true, id: existing.id, deduped: true })
    }
    console.error('[rapport-photos] insert error:', error)
    return secureError('Enregistrement impossible', 500)
  }

  return secureJson({ ok: true, id: inserted?.id })
}
