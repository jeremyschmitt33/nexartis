import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * GET    /api/rapports/[id]   -> le rapport + ses pages (ordonnees)
 * PATCH  /api/rapports/[id]   -> met a jour les metadonnees / statut
 * DELETE /api/rapports/[id]   -> soft delete
 *
 * Dedie au rapport. Service role + verif propriete manuelle.
 */
export const dynamic = 'force-dynamic'

const STATUTS = ['brouillon', 'finalise', 'envoye']

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function ownedRapport(db: ReturnType<typeof admin>, id: string, userId: string) {
  const { data } = await db
    .from('rapports_intervention').select('id')
    .eq('id', id).eq('user_id', userId).is('deleted_at', null).single()
  return data
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const id = params.id
  if (!id) return secureError('id requis')

  const db = admin()
  const { data: rapport } = await db
    .from('rapports_intervention')
    .select('id, numero, objet, statut, date_intervention, date_fin, client_id, chantier_id, devis_id, facture_id, client_nom_snapshot, adresse_snapshot, adresse_rue, adresse_cp, adresse_ville, created_at, updated_at')
    .eq('id', id).eq('user_id', user.id).is('deleted_at', null).single()
  if (!rapport) return secureError('Rapport introuvable', 404)

  const { data: pages } = await db
    .from('rapport_pages')
    .select('id, ordre, type, contenu')
    .eq('rapport_id', id)
    .order('ordre', { ascending: true })

  let clientEmail: string | null = null
  if (rapport.client_id) {
    const { data: cl } = await db.from('clients').select('email').eq('id', rapport.client_id).eq('user_id', user.id).single()
    clientEmail = (cl?.email as string | null) ?? null
  }

  return secureJson({ rapport: { ...rapport, client_email: clientEmail }, pages: pages ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-patch:${ip}`, 120, 60_000)) return rateLimitError()
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const id = params.id
  if (!id) return secureError('id requis')

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const db = admin()
  if (!(await ownedRapport(db, id, user.id))) return secureError('Rapport introuvable', 404)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.objet === 'string') patch.objet = b.objet.slice(0, 300)
  if (typeof b.adresse_snapshot === 'string') patch.adresse_snapshot = b.adresse_snapshot.slice(0, 300)
  if (typeof b.client_nom_snapshot === 'string') patch.client_nom_snapshot = b.client_nom_snapshot.slice(0, 200)
  if (typeof b.statut === 'string' && STATUTS.includes(b.statut)) patch.statut = b.statut
  if (typeof b.date_intervention === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date_intervention)) patch.date_intervention = b.date_intervention
  if (typeof b.adresse_rue === 'string') patch.adresse_rue = b.adresse_rue.slice(0, 200)
  if (typeof b.adresse_cp === 'string') patch.adresse_cp = b.adresse_cp.slice(0, 20)
  if (typeof b.adresse_ville === 'string') patch.adresse_ville = b.adresse_ville.slice(0, 120)
  if (b.date_fin === null) patch.date_fin = null
  else if (typeof b.date_fin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date_fin)) patch.date_fin = b.date_fin

  const { error } = await db
    .from('rapports_intervention').update(patch)
    .eq('id', id).eq('user_id', user.id).is('deleted_at', null)
  if (error) { console.error('[rapports] patch error:', error); return secureError('Mise a jour impossible', 500) }
  return secureJson({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-delete:${ip}`, 60, 60_000)) return rateLimitError()
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const id = params.id
  if (!id) return secureError('id requis')

  const db = admin()
  if (!(await ownedRapport(db, id, user.id))) return secureError('Rapport introuvable', 404)

  // Soft delete : on conserve les pages et on NE purge PAS R2 (les photos
  // appartiennent au chantier / restent referencables).
  const { error } = await db
    .from('rapports_intervention')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
  if (error) { console.error('[rapports] delete error:', error); return secureError('Suppression impossible', 500) }
  return secureJson({ ok: true })
}
