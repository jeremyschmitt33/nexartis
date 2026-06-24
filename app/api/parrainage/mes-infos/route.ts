import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, secureJson, secureError, unauthorizedError,
} from '@/lib/api-security'

/**
 * GET /api/parrainage/mes-infos
 *
 * Donnees du programme de parrainage pour l'artisan CONNECTE (cote parrain) :
 *   - son code + lien de parrainage
 *   - compteurs (filleuls inscrits / abonnes / mois offerts gagnes + plafond)
 *   - liste de ses filleuls ANONYMISEE (RGPD : aucune identite exposee au parrain)
 */
export const dynamic = 'force-dynamic'

const PLAFOND_PARRAIN = 10

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: entreprise } = await admin
    .from('entreprises')
    .select('id, referral_code')
    .eq('user_id', user.id)
    .single()

  if (!entreprise) return secureError('Profil entreprise introuvable', 404)

  const { data: parrainages } = await admin
    .from('parrainages')
    .select('statut, created_at, filleul_recompense_at')
    .eq('parrain_entreprise_id', entreprise.id)
    .order('created_at', { ascending: false })

  const liste = parrainages ?? []

  // Statuts "filleul a paye" = filleul recompense quel que soit le sort du parrain
  const payes = liste.filter((p) =>
    ['recompense', 'recompense_filleul_seul', 'non_recompense_plafond'].includes(p.statut as string),
  )
  // Mois offerts effectivement gagnes par le parrain
  const moisGagnes = liste.filter((p) => p.statut === 'recompense').length

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'
  const lien = `${siteUrl}/register?ref=${entreprise.referral_code}`

  // Liste anonymisee (aucune identite) pour le parrain
  const filleuls = liste.map((p, i) => ({
    numero: liste.length - i,
    statut: p.statut as string,
    inscrit_le: p.created_at as string,
    recompense_le: (p.filleul_recompense_at as string | null) ?? null,
  }))

  return secureJson({
    code: entreprise.referral_code,
    lien,
    plafond: PLAFOND_PARRAIN,
    stats: {
      inscrits: liste.length,
      abonnes: payes.length,
      mois_gagnes: moisGagnes,
    },
    filleuls,
  })
}
