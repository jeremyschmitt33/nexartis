import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * GET  /api/rapports   -> liste des rapports
 * POST /api/rapports   -> cree un rapport (numero RAP-AAAA-xxx, app-side)
 * Service role + verifs de propriete manuelles. Pre-remplissage depuis devis/chantier.
 */
export const dynamic = 'force-dynamic'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
function clientDisplayName(c: { raison_sociale?: string | null; prenom?: string | null; nom?: string | null } | null): string | null {
  if (!c) return null
  if (c.raison_sociale) return c.raison_sociale
  return [c.prenom, c.nom].filter(Boolean).join(' ').trim() || null
}
async function nextNumero(db: ReturnType<typeof admin>, userId: string, year: number, offset: number): Promise<string> {
  const { data } = await db.from('rapports_intervention').select('numero')
    .eq('user_id', userId).like('numero', `RAP-${year}-%`)
  let max = 0
  for (const r of data ?? []) { const m = String(r.numero).match(/-(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > max) max = n } }
  return `RAP-${year}-${String(max + 1 + offset).padStart(3, '0')}`
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const db = admin()
  const { data } = await db.from('rapports_intervention')
    .select('id, numero, objet, statut, date_intervention, client_nom_snapshot, chantier_id, created_at, updated_at')
    .eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false })
  return secureJson({ rapports: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`rapport-create:${ip}`, 60, 60_000)) return rateLimitError()
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }
  const db = admin()

  let clientId = b.client_id ? String(b.client_id) : null
  let chantierId = b.chantier_id ? String(b.chantier_id) : null
  let devisId = b.devis_id ? String(b.devis_id) : null
  let objet = b.objet ? String(b.objet).slice(0, 300) : null
  let rue: string | null = null, cp: string | null = null, ville: string | null = null

  if (devisId) {
    const { data: devis } = await db.from('devis').select('id, client_id, chantier_id, objet')
      .eq('id', devisId).eq('user_id', user.id).single()
    if (!devis) { devisId = null }
    else {
      if (!clientId && devis.client_id) clientId = devis.client_id as string
      if (!chantierId && devis.chantier_id) chantierId = devis.chantier_id as string
      if (!objet && devis.objet) objet = String(devis.objet).slice(0, 300)
    }
  }
  if (chantierId) {
    const { data: chantier } = await db.from('chantiers')
      .select('id, client_id, titre, adresse_chantier, code_postal_chantier, ville_chantier')
      .eq('id', chantierId).eq('user_id', user.id).single()
    if (!chantier) { chantierId = null }
    else {
      if (!clientId && chantier.client_id) clientId = chantier.client_id as string
      if (!objet && chantier.titre) objet = String(chantier.titre).slice(0, 300)
      rue = (chantier.adresse_chantier as string | null) ?? null
      cp = (chantier.code_postal_chantier as string | null) ?? null
      ville = (chantier.ville_chantier as string | null) ?? null
    }
  }

  let clientNom: string | null = null
  if (clientId) {
    const { data: client } = await db.from('clients').select('id, raison_sociale, prenom, nom, adresse, code_postal, ville')
      .eq('id', clientId).eq('user_id', user.id).single()
    if (!client) { clientId = null }
    else {
      clientNom = clientDisplayName(client)
      if (!rue && !cp && !ville) { rue = (client.adresse as string | null) ?? null; cp = (client.code_postal as string | null) ?? null; ville = (client.ville as string | null) ?? null }
    }
  }

  const dateInter = (typeof b.date_intervention === 'string' && DATE_RE.test(b.date_intervention)) ? b.date_intervention : null
  const dateFin = (typeof b.date_fin === 'string' && DATE_RE.test(b.date_fin)) ? b.date_fin : null
  const year = new Date().getFullYear()

  for (let attempt = 0; attempt < 6; attempt++) {
    const numero = await nextNumero(db, user.id, year, attempt)
    const { data, error } = await db.from('rapports_intervention').insert({
      user_id: user.id, numero, client_id: clientId, chantier_id: chantierId, devis_id: devisId,
      objet, client_nom_snapshot: clientNom, adresse_rue: rue, adresse_cp: cp, adresse_ville: ville,
      date_intervention: dateInter, date_fin: dateFin, statut: 'brouillon',
    }).select('id, numero').single()
    if (!error && data) return secureJson({ ok: true, id: data.id, numero: data.numero })
    const code = (error as { code?: string } | null)?.code
    if (code !== '23505') { console.error('[rapports] create error:', error); return secureError('Creation impossible', 500) }
  }
  return secureError('Numerotation momentanement indisponible, reessayez', 409)
}
