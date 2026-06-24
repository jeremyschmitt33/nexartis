import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url, r2HeadContentLength } from '@/lib/r2'

/**
 * GET  /api/chantier-photos?client_id=|chantier_id=|devis_id=|facture_id=  -> liste
 * POST /api/chantier-photos                                               -> confirme l'enregistrement
 *
 * Photos rattachees au client (lib generale), avec liens optionnels vers
 * chantier / devis / facture. Binaire sur R2, metadonnees en base.
 */
export const dynamic = 'force-dynamic'

const ALBUMS = ['avant', 'pendant', 'apres']
const FILTERS = ['client_id', 'chantier_id', 'devis_id', 'facture_id'] as const

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

  // On filtre par le 1er contexte fourni (client/chantier/devis/facture)
  let filterCol: string | null = null
  let filterVal: string | null = null
  for (const f of FILTERS) {
    const v = req.nextUrl.searchParams.get(f)
    if (v) { filterCol = f; filterVal = v; break }
  }
  if (!filterCol || !filterVal) return secureError('Filtre requis (client_id, chantier_id, devis_id ou facture_id)')

  const admin = adminClient()
  const { data: photos } = await admin
    .from('photos')
    .select('id, album, r2_key, thumb_key, taille_octets, largeur, hauteur, legende, prise_le, created_at, client_id, chantier_id, devis_id, facture_id')
    .eq('user_id', user.id)
    .eq(filterCol, filterVal)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const list = (photos ?? []).map((p) => ({
    id: p.id,
    album: p.album,
    legende: p.legende,
    prise_le: p.prise_le,
    created_at: p.created_at,
    client_id: p.client_id,
    chantier_id: p.chantier_id,
    devis_id: p.devis_id,
    facture_id: p.facture_id,
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

  const clientId = String(b.client_id || '')
  const album = ALBUMS.includes(String(b.album)) ? String(b.album) : 'pendant'
  const r2Key = String(b.r2_key || '')
  const thumbKey = b.thumb_key ? String(b.thumb_key) : null
  if (!clientId || !r2Key) return secureError('Donnees manquantes')

  // Anti-falsification : la cle DOIT appartenir au prefixe de cet utilisateur.
  const prefix = `${user.id}/`
  if (!r2Key.startsWith(prefix) || (thumbKey && !thumbKey.startsWith(prefix))) {
    return secureError('Cle de fichier invalide', 403)
  }

  const admin = adminClient()

  // Propriete du client
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()
  if (!client) return secureError('Client introuvable', 404)

  // Taille REELLE lue sur R2 (anti-triche). Objet absent => upload echoue.
  const realSize = await r2HeadContentLength(r2Key)
  if (realSize === null) return secureError('Fichier introuvable sur le stockage', 400)

  const { data: inserted, error } = await admin
    .from('photos')
    .insert({
      user_id: user.id,
      client_id: clientId,
      chantier_id: b.chantier_id ? String(b.chantier_id) : null,
      devis_id: b.devis_id ? String(b.devis_id) : null,
      facture_id: b.facture_id ? String(b.facture_id) : null,
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
    console.error('[photos] insert error:', error)
    return secureError('Enregistrement impossible', 500)
  }

  return secureJson({ ok: true, id: inserted?.id })
}
