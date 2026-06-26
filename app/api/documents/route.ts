import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { r2HeadContentLength } from '@/lib/r2'

/**
 * POST /api/documents
 * Body : { r2_key, nom, categorie, mime_type, devis_id? }
 *
 * Coffre-fort (Vague 2b). Confirme l'enregistrement APRES upload R2 reussi :
 * verifie l'auth, que la cle appartient bien a l'utilisateur, relit la taille
 * REELLE du fichier sur R2 (anti-triche, comme les photos), puis insere la
 * ligne de metadonnees. Meme pattern que POST /api/chantier-photos.
 */
export const dynamic = 'force-dynamic'

const CATEGORIES = ['rib', 'decennale', 'rc_pro', 'ouverture', 'genere', 'autre']

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`doc-confirm:${ip}`, 60, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const r2Key = String(b.r2_key || '')
  const nom = sanitizeString(String(b.nom || ''), 200).trim()
  const categorie = CATEGORIES.includes(String(b.categorie)) ? String(b.categorie) : 'autre'
  const mimeType = String(b.mime_type || '').slice(0, 120)
  const devisId = b.devis_id ? String(b.devis_id) : null

  if (!r2Key || !nom) return secureError('Donnees manquantes')

  // Anti-falsification : la cle DOIT appartenir au prefixe coffre de cet utilisateur.
  if (!r2Key.startsWith(`${user.id}/coffre/`)) return secureError('Cle de fichier invalide', 403)
  if (devisId && !isValidUUID(devisId)) return secureError('Devis invalide')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('documents POST: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Si un devis est lie, verifier qu'il appartient bien a l'utilisateur.
  if (devisId) {
    const { data: dv } = await admin
      .from('devis')
      .select('id')
      .eq('id', devisId)
      .eq('user_id', user.id)
      .single()
    if (!dv) return secureError('Devis introuvable', 404)
  }

  // Taille REELLE lue sur R2 (anti-triche). Objet absent => upload echoue.
  const realSize = await r2HeadContentLength(r2Key)
  if (realSize === null) return secureError('Fichier introuvable sur le stockage', 400)

  const { data: inserted, error } = await admin
    .from('documents_stockes')
    .insert({
      user_id: user.id,
      nom,
      categorie,
      fichier_url: r2Key,
      mime_type: mimeType || null,
      taille_octets: realSize,
      devis_id: devisId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[documents] insert error:', error)
    return secureError('Enregistrement impossible', 500)
  }

  return secureJson({ ok: true, id: inserted?.id })
}
