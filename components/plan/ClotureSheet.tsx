'use client'

/**
 * ClotureSheet — Panneau de la clôture sélectionnée (Push 3b, 06/07/2026).
 * Longueur en ml (moteur lib/plan/metrics), calque, envoi au devis
 * (pré-coche ce métré dans le tiroir), suppression (undo via Ctrl+Z).
 */

import type { Cloture } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { clotureMl } from '@/lib/plan/metrics'

export interface ClotureSheetProps {
  cloture: Cloture
  onEnvoyerDevis: () => void
  onSupprimer: () => void
  onFermer: () => void
}

export default function ClotureSheet({ cloture, onEnvoyerDevis, onSupprimer, onFermer }: ClotureSheetProps) {
  const ml = clotureMl(cloture)
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-hanken text-[13px] font-extrabold uppercase tracking-wider text-navy">Clôture sélectionnée</h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le panneau"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-navy"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2.5 text-center">
          <div className="font-spline-mono text-[17px] font-semibold text-navy">{fmtNombreFr(ml)}</div>
          <div className="mt-0.5 font-hanken text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
            ml de clôture / grillage
          </div>
        </div>

        <p className="font-hanken text-[11.5px] leading-snug text-gray-500">
          Calque : <span className={`font-bold ${cloture.layer === 'projet' ? 'text-orange' : 'text-navy'}`}>{cloture.layer === 'projet' ? 'Projet' : 'Existant'}</span>
          {' · '}longueur réelle de la polyligne tracée, métré indicatif à vérifier avant chiffrage.
        </p>

        <button
          type="button"
          onClick={onEnvoyerDevis}
          className="w-full rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-4 py-2.5 font-hanken text-[13.5px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
        >
          Envoyer au devis ({fmtNombreFr(ml)} ml)
        </button>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onSupprimer}
            className="w-full rounded-xl border-[1.5px] border-red-200 bg-white px-3 py-2 font-hanken text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            Supprimer la clôture
          </button>
        </div>
      </div>
    </div>
  )
}
