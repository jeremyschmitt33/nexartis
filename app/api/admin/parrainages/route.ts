import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser, secureJson, forbiddenError } from '@/lib/api-security'

/**
 * GET /api/admin/parrainages
 *
 * Vue ADMIN : chaque parrain avec la liste de ses filleuls en dessous.
 * Reserve aux administrateurs (role 'admin' dans app_metadata).
 * Contrairement a la vue artisan, l'admin voit les vrais noms (back-office).
 */
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return forbiddenError()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: parrainages } = await supabase
    .from('parrainages')
    .select('id, parrain_entreprise_id, filleul_entreprise_id, statut, created_at, filleul_recompense_at, parrain_recompense_at, parrain_credit_en_attente')
    .order('created_at', { ascending: false })

  const liste = parrainages ?? []

  // Recuperer les noms/emails des entreprises impliquees en une seule requete
  const ids = Array.from(
    new Set(liste.flatMap((p) => [p.parrain_entreprise_id, p.filleul_entreprise_id])),
  )
  const entMap = new Map<string, { nom: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: ents } = await supabase
      .from('entreprises')
      .select('id, nom, email')
      .in('id', ids)
    for (const e of ents ?? []) entMap.set(e.id as string, { nom: e.nom as string | null, email: e.email as string | null })
  }

  // Grouper par parrain
  const parrainsMap = new Map<string, {
    parrain_id: string
    parrain_nom: string | null
    parrain_email: string | null
    filleuls: Array<{
      nom: string | null
      email: string | null
      statut: string
      inscrit_le: string
      recompense_le: string | null
    }>
    mois_gagnes: number
  }>()

  for (const p of liste) {
    const pid = p.parrain_entreprise_id as string
    if (!parrainsMap.has(pid)) {
      const info = entMap.get(pid)
      parrainsMap.set(pid, {
        parrain_id: pid,
        parrain_nom: info?.nom ?? null,
        parrain_email: info?.email ?? null,
        filleuls: [],
        mois_gagnes: 0,
      })
    }
    const bloc = parrainsMap.get(pid)!
    const finfo = entMap.get(p.filleul_entreprise_id as string)
    bloc.filleuls.push({
      nom: finfo?.nom ?? null,
      email: finfo?.email ?? null,
      statut: p.statut as string,
      inscrit_le: p.created_at as string,
      recompense_le: (p.filleul_recompense_at as string | null) ?? null,
    })
    if (p.statut === 'recompense') bloc.mois_gagnes += 1
  }

  const parrains = Array.from(parrainsMap.values()).sort(
    (a, b) => b.filleuls.length - a.filleuls.length,
  )

  return secureJson({
    total_parrainages: liste.length,
    total_parrains: parrains.length,
    parrains,
  })
}
