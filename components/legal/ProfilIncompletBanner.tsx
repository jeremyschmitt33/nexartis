'use client'

/**
 * components/legal/ProfilIncompletBanner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bannière jaune affichée en haut d'un devis ou facture quand le profil
 * entreprise est INCOMPLET au sens légal (un champ obligatoire manquant rend
 * le document juridiquement non conforme — Code de commerce L441-9).
 *
 * Source de vérité : champsLegauxManquants() dans lib/legal-mentions.ts.
 *
 * V2.4a — Câblé sur :
 *   - app/dashboard/devis/[id]/page.tsx
 *   - app/dashboard/factures/[id]/page.tsx
 *
 * Cliquable → redirige vers /dashboard/parametres pour compléter.
 */

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { champsLegauxManquants } from '@/lib/legal-mentions'

type Props = {
  entreprise: Record<string, unknown> | null | undefined
  className?: string
}

export default function ProfilIncompletBanner({ entreprise, className = '' }: Props) {
  const manquants = champsLegauxManquants(entreprise)
  if (manquants.length === 0) return null

  return (
    <div
      className={`no-print bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900 font-manrope">
          Mentions légales incomplètes
        </p>
        <p className="text-xs text-amber-800 font-manrope mt-1">
          Les champs suivants ne sont pas renseignés : {manquants.join(', ')}.
        </p>
        <Link
          href="/dashboard/parametres"
          className="text-xs font-bold text-amber-900 underline hover:text-amber-700 mt-1.5 inline-block"
        >
          Compléter mes informations
        </Link>
      </div>
    </div>
  )
}
