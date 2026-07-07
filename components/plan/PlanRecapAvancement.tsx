'use client'

/**
 * PlanRecapAvancement — Bandeau récap d'avancement du niveau (Push 9).
 *
 * Additif et lecture seule : affiche « X/N pièces terminées — Y % » sous la
 * topbar de l'éditeur, avec une barre de progression et la répartition par
 * état. Ne compte que les pièces INTÉRIEURES (cf. recapAvancement, pur).
 * Ne s'affiche pas s'il n'y a aucune pièce intérieure (évite « 0/0 »).
 */

import type { Piece } from '@/lib/plan/types'
import { AVANCEMENT_META, AVANCEMENT_ORDRE, recapAvancement } from '@/lib/plan/defaults'

export interface PlanRecapAvancementProps {
  rooms: Piece[]
}

export default function PlanRecapAvancement({ rooms }: PlanRecapAvancementProps) {
  const recap = recapAvancement(rooms)
  if (recap.total === 0) return null

  const tout = recap.faites === recap.total
  // Accord grammatical sur `total` (le nom ET l'adjectif) : « 0/5 pièces
  // terminées », « 1/1 pièce terminée ». Éviter « pièces terminée ».
  const s = recap.total > 1 ? 's' : ''

  return (
    <div
      role="status"
      aria-label={`Avancement du chantier : ${recap.faites} sur ${recap.total} pièce${s} terminée${s}, ${recap.pct} pour cent`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200/70 bg-[#fafbfc] px-4 py-2"
    >
      {/* Compteur + pourcentage global */}
      <div className="flex items-baseline gap-2 font-hanken">
        <span className="text-sm font-extrabold text-navy">
          {recap.faites}/{recap.total}
        </span>
        <span className="text-xs font-semibold text-gray-500">
          pièce{s} terminée{s}
        </span>
      </div>

      {/* Barre de progression (avancement global pondéré) */}
      <div className="flex min-w-[140px] flex-1 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${recap.pct}%`,
              backgroundColor: tout ? 'rgb(52, 168, 102)' : 'rgb(139, 92, 246)',
            }}
          />
        </div>
        <span className="w-10 text-right font-hanken text-sm font-extrabold tabular-nums text-navy">
          {recap.pct}%
        </span>
      </div>

      {/* Répartition par état (états présents seulement) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {AVANCEMENT_ORDRE.map((key) => {
          const n = recap.parEtat[key]
          if (n === 0) return null
          const meta = AVANCEMENT_META[key]
          return (
            <span key={key} className="flex items-center gap-1.5 font-hanken text-xs font-semibold text-gray-600">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: meta.fill ?? '#e3e9f2' }}
                aria-hidden="true"
              />
              {n} {meta.court}
            </span>
          )
        })}
      </div>
    </div>
  )
}
