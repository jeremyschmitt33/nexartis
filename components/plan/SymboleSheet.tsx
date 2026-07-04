'use client'

/**
 * SymboleSheet — Panneau du symbole sélectionné (Push 3a, 03/07/2026).
 * Type, pièce d'appartenance, calque, suppression (bouton ou touche Suppr).
 */

import type { Piece, Symbole } from '@/lib/plan/types'
import { labelSymbole } from '@/lib/plan/symboles'
import { IconeSymbole } from './SymboleSvg'

export interface SymboleSheetProps {
  symbole: Symbole
  /** Pièce d'appartenance (résolue par l'éditeur), ou null si hors pièce. */
  piece: Piece | null
  onSupprimer: () => void
  onFermer: () => void
}

export default function SymboleSheet({ symbole, piece, onSupprimer, onFermer }: SymboleSheetProps) {
  const projet = symbole.layer === 'projet'
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-hanken text-[13px] font-extrabold uppercase tracking-wider text-navy">
          Symbole sélectionné
        </h2>
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
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-3">
          <IconeSymbole type={symbole.type} className={`h-8 w-8 flex-shrink-0 ${projet ? 'text-orange' : 'text-navy'}`} />
          <div className="min-w-0">
            <p className="truncate font-hanken text-[14px] font-bold text-navy">{labelSymbole(symbole.type)}</p>
            <p className="mt-0.5 font-hanken text-[12px] text-gray-500">
              {piece ? `Dans « ${piece.name} »` : 'Hors pièce — non compté dans les métrés'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2.5">
          <span className="font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">Calque</span>
          <span className={`font-hanken text-[13px] font-bold ${projet ? 'text-orange' : 'text-navy'}`}>
            {projet ? 'Projet' : 'Existant'}
          </span>
        </div>

        <p className="font-hanken text-[11.5px] leading-snug text-gray-500">
          Glissez le symbole sur le plan pour le repositionner — il se rattache automatiquement à la pièce
          qui le contient.
        </p>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onSupprimer}
            className="w-full rounded-xl border-[1.5px] border-red-200 bg-white px-3 py-2 font-hanken text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            Supprimer le symbole
          </button>
        </div>
      </div>
    </div>
  )
}
