import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { r2HeadContentLength, r2Delete, presignR2Url } from '@/lib/r2'

/**
 * POST /api/chantier-collab/confirm
 * Body : { chantier_id, r2_key, album?, legende? }
 *
 * Confirme l'enregistrement d'une photo versée par un SOUS-TRAITANT (B) dans le
 * chantier d'un confrère (A). La ligne `photos` est créée au nom du PROPRIÉTAIRE
 * A (user_id = A), avec uploaded_by = B pour la traçabilité. Anti-triche : la
 * clé doit être dans l'espace de A, et la taille est relue sur R2.
 */
export const dynamic = 'force-dynamic'

const ALBUMS = ['avant', 'pendant', 'apres']
const TAILLE_MAX = 50 * 1024 * 1024 // 50 Mo par photo (comme le flux normal)
const HARD_LIMIT = 2 * 1024 * 1024 * 1024 // 2 Go : quota total du propriétaire

/**
 * Vérifie, en relisant les premiers octets sur R2, que l'objet est bien une
 * VRAIE image (signature binaire), et pas un fichier HTML/SVG/script déguisé.
 * Indispensable ici : la préparation « photo only » est côté client, donc un
 * sous-traitant malveillant pourrait appeler l'API directement avec un contenu
 * arbitraire. Le Content-Type d'un PUT R2 n'étant pas signé, on ne peut pas s'y
 * fier : seule la signature réelle du contenu fait foi.
 */
async function estVraieImage(key: string): Promise<boolean> {
  try {
    const url = presignR2Url('GET', key, 300)
    const res = await fetch(url, { headers: { Range: 'bytes=0-15' } })
    if (!res.ok) return false
    const b = new Uint8Array(await res.arrayBuffer())
    if (b.length < 4) return false
    // JPEG : FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true
    // PNG : 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true
    // WEBP : "RIFF" .... "WEBP"
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true
    // HEIC/HEIF (conteneur ISO-BMFF) : octets 4-7 = "ftyp"
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true
    return false
  } catch {
    return false
  }
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`collab-photo-confirm:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser() // B
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }
  const chantierId = String(b.chantier_id || '')
  const r2Key = String(b.r2_key || '')
  const album = ALBUMS.includes(String(b.album)) ? String(b.album) : 'pendant'
  const legende = b.legende ? String(b.legende).slice(0, 300) : null
  if (!chantierId || !r2Key) return secureError('Donnees manquantes')

  const db = admin()

  // B collaborateur ACTIF avec droit photos ?
  const { data: partage } = await db
    .from('chantier_partages')
    .select('id')
    .eq('chantier_id', chantierId)
    .eq('collaborateur_id', user.id)
    .eq('statut', 'actif')
    .eq('peut_photos', true)
    .maybeSingle()
  if (!partage) return secureError('Non autorise', 403)

  const { data: chantier } = await db
    .from('chantiers')
    .select('user_id, client_id')
    .eq('id', chantierId)
    .single()
  if (!chantier) return secureError('Chantier introuvable', 404)
  const ownerId = chantier.user_id as string
  const clientId = (chantier.client_id as string | null) || ''
  if (!clientId) return secureError('Ce chantier est sans client associe', 400)

  // Anti-falsification : la clé DOIT etre dans l'espace du proprietaire A.
  if (!r2Key.startsWith(`${ownerId}/${clientId}/`)) return secureError('Cle de fichier invalide', 403)

  // Anti-doublon / anti-« résurrection » : refuser une clé déjà connue, même si
  // sa ligne a été supprimée (sinon on pourrait recréer une ligne active pour un
  // objet que le propriétaire avait retiré). On ne filtre donc PAS sur deleted_at.
  const { data: dejaVue } = await db
    .from('photos')
    .select('id')
    .eq('r2_key', r2Key)
    .maybeSingle()
  if (dejaVue) return secureError('Cette photo est deja enregistree', 409)

  const realSize = await r2HeadContentLength(r2Key)
  if (realSize === null) return secureError('Fichier introuvable sur le stockage', 400)

  // Taille réelle plafonnée (le sous-traitant ne peut pas gonfler le stockage de A).
  if (realSize > TAILLE_MAX) {
    await r2Delete(r2Key)
    return secureError('Fichier trop volumineux (50 Mo maximum)', 400)
  }

  // Vrai contenu image (signature binaire), sinon on supprime l'objet et on refuse.
  if (!(await estVraieImage(r2Key))) {
    await r2Delete(r2Key)
    return secureError('Fichier invalide : une image est attendue', 400)
  }

  // Quota RÉEL du propriétaire, recalculé avec la taille effective (le `size`
  // annoncé au sign-upload est fourni par le client et n'est pas fiable).
  const { data: qrows } = await db
    .from('photos')
    .select('taille_octets')
    .eq('user_id', ownerId)
    .is('deleted_at', null)
  const used = (qrows ?? []).reduce((s, r) => s + (Number(r.taille_octets) || 0), 0)
  if (used + realSize >= HARD_LIMIT) {
    await r2Delete(r2Key)
    return secureJson({
      error: 'quota_depasse',
      message: 'Le stockage photos de ce chantier est plein (2 Go). Le proprietaire doit liberer de la place.',
    }, 403)
  }

  const { data: inserted, error } = await db
    .from('photos')
    .insert({
      user_id: ownerId,     // la photo appartient au PROPRIÉTAIRE du chantier
      client_id: clientId,
      chantier_id: chantierId,
      album,
      r2_key: r2Key,
      thumb_key: null,
      taille_octets: realSize,
      legende,
      uploaded_by: user.id, // versee par le sous-traitant B
      prise_le: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[chantier-collab/confirm] insert error:', error)
    return secureError('Enregistrement impossible', 500)
  }
  return secureJson({ ok: true, id: inserted?.id })
}
