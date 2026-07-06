'use client'

/**
 * SourcePlanBadge — Badge « vient du plan » sur une ligne de devis (Push 4).
 *
 * Affiché quand la ligne porte un `source_plan` (ligne injectée depuis
 * l'éditeur de plan 2D). Deux états :
 * - lié (lie: true)    : la quantité est encore celle du métré du plan ;
 * - rompu (lie: false) : désignation, quantité ou unité modifiées à la main
 *   (changer le prix ou la TVA ne rompt PAS le lien — comportement voulu).
 *
 * Clic → ouvre le plan d'origine (/dashboard/plans/[planId]).
 * stopPropagation : le badge vit dans des conteneurs cliquables (carte
 * mobile LineCard) dont le tap ouvre l'édition de la ligne.
 */

import Link from 'next/link'
import type { SourcePlan } from '@/lib/plan/types'

/** Libellés français des métrés injectables (lib/plan/injection.ts). */
const METRIC_LABELS: Record<string, string> = {
  murs: 'surface des murs',
  plafond: 'surface du plafond',
  plinthes: 'plinthes (ml)',
  sol_chutes: 'sol + chutes',
  plinthes_carrelage: 'plinthes carrelées (ml)',
  murs_sup25: 'doublage des murs',
  plafond_plaque: 'plafond plaque',
  elec_prises: 'prises courant fort',
  elec_commandes: "commandes d'éclairage",
  elec_lumieres: 'points lumineux',
  elec_cf: 'prises courant faible',
  elec_autres: 'autres équipements élec.',
  elec_tableau: 'tableau électrique',
  eau_points: "points d'eau",
  ext_terrasse: 'terrasse (m²)',
  ext_piscine: 'piscine (m²)',
  ext_pelouse: 'pelouse (m²)',
  ext_autre: 'zone extérieure (m²)',
  cloture_ml: 'clôture (ml)',
  portail_u: 'portails (u)',
}

export default function SourcePlanBadge({ sourcePlan }: { sourcePlan: SourcePlan }) {
  const libelle = METRIC_LABELS[sourcePlan.metric] ?? sourcePlan.metric
  const title = sourcePlan.lie
    ? `Quantité issue du plan — ${libelle}`
    : 'Modifiée à la main — lien avec le plan rompu'
  return (
    <Link
      href={`/dashboard/plans/${sourcePlan.planId}`}
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-hanken text-[10px] font-bold uppercase tracking-wide transition-colors ${
        sourcePlan.lie
          ? 'border-[#c9d6f2] bg-[#eef2fb] text-[#33456e] hover:border-[#33456e]'
          : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-400'
      }`}
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2.5" y="9" width="19" height="6" rx="1.2" />
        <path d="M6.5 9v2.5M10.5 9v2.5M14.5 9v2.5M18.5 9v2.5" />
      </svg>
      Plan
    </Link>
  )
}
