import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, secureJson, secureError, unauthorizedError,
} from '@/lib/api-security'
import { RANGS_MOIS_OFFERT } from '@/lib/parrainage'

/**
 * GET /api/parrainage/mes-infos
 *
 * Donnees du programme de parrainage pour l'artisan CONNECTE (cote parrain) :
 *   - son code + lien de parrainage
 *   - compteurs (filleuls inscrits / abonnes / gains : mois offerts + euros)
 *   - prochain palier « mois offert »
 *   - liste de ses filleuls ANONYMISEE (RGPD : aucune identite exposee au parrain)
 *
 * Regle V2 (15/09/2026) : cf. lib/parrainage.ts.
 */
export const dynamic = 'force-dynamic'

/** Statuts ou le filleul a reellement paye. */
const STATUTS_FILLEUL_PAYE = ['recompense', 'recompense_filleul_seul', 'non_recompense_plafond']

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
    .select('statut, created_at, filleul_recompense_at, parrain_recompense_type')
    .eq('parrain_entreprise_id', entreprise.id)
    .order('created_at', { ascending: false })

  const liste = parrainages ?? []

  // Filleuls ayant reellement paye (quel que soit le sort de la recompense parrain)
  const payes = liste.filter((p) => STATUTS_FILLEUL_PAYE.includes(p.statut as string))

  // Gains effectivement obtenus par le parrain (statut 'recompense').
  // parrain_recompense_type NULL = ancienne regle (1 mois).
  const obtenus = liste.filter((p) => p.statut === 'recompense')
  const moisGagnes = obtenus.filter((p) => p.parrain_recompense_type !== '5eur').length
  const eurosGagnes = obtenus.filter((p) => p.parrain_recompense_type === '5eur').length * 5
  // Recompenses en attente d'abonnement du parrain
  const enAttente = liste.filter((p) => p.statut === 'recompense_filleul_seul').length

  // Prochain palier « mois offert » (1er puis 10e filleul payant).
  const nbPayes = payes.length
  const prochainRang = RANGS_MOIS_OFFERT.find((r) => r > nbPayes) ?? null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'
  const lien = `${siteUrl}/register?ref=${entreprise.referral_code}`

  // Liste anonymisee (aucune identite) pour le parrain
  const filleuls = liste.map((p, i) => ({
    numero: liste.length - i,
    statut: p.statut as string,
    recompense_type: (p.parrain_recompense_type as string | null) ?? null,
    inscrit_le: p.created_at as string,
    recompense_le: (p.filleul_recompense_at as string | null) ?? null,
  }))

  return secureJson({
    code: entreprise.referral_code,
    lien,
    stats: {
      inscrits: liste.length,
      abonnes: nbPayes,
      mois_gagnes: moisGagnes,
      euros_gagnes: eurosGagnes,
      en_attente: enAttente,
    },
    prochain_mois_offert: prochainRang
      ? { rang: prochainRang, restants: prochainRang - nbPayes }
      : null,
    filleuls,
  })
}
