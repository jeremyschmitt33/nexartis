import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit, isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * PUT /api/rapports/[id]/pages
 * Body : { pages: [{ id, type, contenu }] }  (l'ordre = position dans le tableau)
 *
 * Sauvegarde TOUTE la liste des pages d'un rapport (l'editeur est l'unique
 * ecrivain -> pas de conflit jsonb concurrent). Synchronisation par id stable :
 * upsert des pages fournies + suppression de celles qui ne sont plus la.
 * Garde anti-detournement : un id "nouveau" ne doit exister dans AUCUN autre rapport.
 */
export const dynamic = 'force-dynamic'

const PAGE_TYPES = ['photos', 'texte', 'constat', 'fin', 'avap', 'poste', 'photo1', 'photo2']  // nouveaux + anciens (compat)
const MAX_PAGES = 200

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-pages:${ip}`, 120, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const rapportId = params.id
  if (!rapportId) return secureError('id requis')

  let b: { pages?: unknown }
  try { b = await req.json() } catch { return secureError('Requete invalide') }
  if (!Array.isArray(b.pages)) return secureError('pages requis (tableau)')
  if (b.pages.length > MAX_PAGES) return secureError('Trop de pages')

  // Validation + normalisation
  const rows: { id: string; rapport_id: string; ordre: number; type: string; contenu: Record<string, unknown> }[] = []
  for (let i = 0; i < b.pages.length; i++) {
    const p = b.pages[i] as Record<string, unknown>
    const id = String(p?.id || '')
    const type = String(p?.type || '')
    if (!isValidUUID(id)) return secureError('Identifiant de page invalide')
    if (!PAGE_TYPES.includes(type)) return secureError('Type de page invalide')
    const contenu = (p?.contenu && typeof p.contenu === 'object' && !Array.isArray(p.contenu))
      ? (p.contenu as Record<string, unknown>) : {}
    rows.push({ id, rapport_id: rapportId, ordre: i, type, contenu })
  }
  if (JSON.stringify(rows).length > 1_000_000) return secureError('Contenu trop volumineux')

  const db = admin()

  // Propriete du rapport
  const { data: rapport } = await db
    .from('rapports_intervention').select('id')
    .eq('id', rapportId).eq('user_id', user.id).is('deleted_at', null).single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  const incomingIds = rows.map((r) => r.id)

  // Pages deja presentes sur CE rapport
  const { data: existing } = await db
    .from('rapport_pages').select('id').eq('rapport_id', rapportId)
  const existingIds = new Set((existing ?? []).map((e) => e.id as string))

  // Garde anti-detournement : un id non present sur ce rapport ne doit exister nulle part ailleurs
  const newIds = incomingIds.filter((id) => !existingIds.has(id))
  if (newIds.length > 0) {
    const { data: clash } = await db.from('rapport_pages').select('id').in('id', newIds)
    if (clash && clash.length > 0) return secureError('Conflit d identifiant de page', 409)
  }

  // Upsert (insert nouvelles + maj existantes), rapport_id force a CE rapport
  if (rows.length > 0) {
    const { error: upErr } = await db.from('rapport_pages').upsert(rows, { onConflict: 'id' })
    if (upErr) { console.error('[rapport-pages] upsert:', upErr); return secureError('Enregistrement impossible', 500) }
  }

  // Suppression des pages retirees
  let delQ = db.from('rapport_pages').delete().eq('rapport_id', rapportId)
  if (incomingIds.length > 0) delQ = delQ.not('id', 'in', '(' + incomingIds.join(',') + ')')
  const { error: delErr } = await delQ
  if (delErr) { console.error('[rapport-pages] delete:', delErr); return secureError('Enregistrement impossible', 500) }

  await db.from('rapports_intervention').update({ updated_at: new Date().toISOString() })
    .eq('id', rapportId).eq('user_id', user.id)

  return secureJson({ ok: true, count: rows.length })
}
