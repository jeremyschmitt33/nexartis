import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * GET  /api/rapports            -> liste des rapports de l'utilisateur
 * POST /api/rapports            -> cree un rapport (numero RAP-AAAA-xxx, app-side)
 *
 * Dedie au rapport d'intervention. Service role + verifications de propriete
 * manuelles (pattern projet). Pre-remplissage 1-clic depuis un chantier.
 */
export const dynamic = 'force-dynamic'

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
  const n = [c.prenom, c.nom].filter(Boolean).join(' ').trim()
  return n || null
}

async function nextNumero(db: ReturnType<typeof admin>, userId: string, year: number, offset: number): Promise<string> {
  const { data } = await db
    .from('rapports_intervention')
    .select('numero')
    .eq('user_id', userId)
    .like('numero', `RAP-${year}-%`)
  let max = 0
  for (const r of data ?? []) {
    const m = String(r.numero).match(/-(\d+)$/)
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n }
  }
  return `RAP-${year}-${String(max + 1 + offset).padStart(3, '0')}`
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const db = admin()
  const { data } = await db
    .from('rapports_intervention')
    .select('id, numero, objet, statut, date_intervention, client_nom_snapshot, chantier_id, created_at, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
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
  let adresseSnapshot: string | null = null

  // Pre-remplissage depuis le devis (verifie owner) : client / chantier / objet
  if (devisId) {
    const { data: devis } = await db
      .from('devis').select('id, client_id, chantier_id, objet')
      .eq('id', devisId).eq('user_id', user.id).single()
    if (!devis) { devisId = null }
    else {
      if (!clientId && devis.client_id) clientId = devis.client_id as string
      if (!chantierId && devis.chantier_id) chantierId = devis.chantier_id as string
      if (!objet && devis.objet) objet = String(devis.objet).slice(0, 300)
    }
  }

  // Pre-remplissage depuis le chantier (verifie owner)
  if (chantierId) {
    const { data: chantier } = await db
      .from('chantiers')
      .select('id, client_id, titre, adresse_chantier, code_postal_chantier, ville_chantier')
      .eq('id', chantierId).eq('user_id', user.id).single()
    if (!chantier) { chantierId = null }
    else {
      if (!clientId && chantier.client_id) clientId = chantier.client_id as string
      if (!objet && chantier.titre) objet = String(chantier.titre).slice(0, 300)
      adresseSnapshot = [chantier.adresse_chantier, [chantier.code_postal_chantier, chantier.ville_chantier].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null
    }
  }

  // Snapshot du nom client (verifie owner)
  let clientNom: string | null = null
  if (clientId) {
    const { data: client } = await db
      .from('clients').select('id, raison_sociale, prenom, nom')
      .eq('id', clientId).eq('user_id', user.id).single()
    if (!client) { clientId = null }
    else clientNom = clientDisplayName(client)
  }

  const dateInter = (typeof b.date_intervention === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date_intervention)) ? b.date_intervention : null
  const year = new Date().getFullYear()

  for (let attempt = 0; attempt < 6; attempt++) {
    const numero = await nextNumero(db, user.id, year, attempt)
    const { data, error } = await db
      .from('rapports_intervention')
      .insert({
        user_id: user.id,
        numero,
        client_id: clientId,
        chantier_id: chantierId,
        devis_id: devisId,
        objet,
        client_nom_snapshot: clientNom,
        adresse_snapshot: adresseSnapshot,
        date_intervention: dateInter,
        statut: 'brouillon',
      })
      .select('id, numero')
      .single()
    if (!error && data) return secureJson({ ok: true, id: data.id, numero: data.numero })
    const code = (error as { code?: string } | null)?.code
    if (code !== '23505') { console.error('[rapports] create error:', error); return secureError('Creation impossible', 500) }
    // sinon : collision de numero -> on retente avec le suivant
  }
  return secureError('Numerotation momentanement indisponible, reessayez', 409)
}
