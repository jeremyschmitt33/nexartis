'use client'

/**
 * ZoomControls — Boutons zoom + / − / ajuster du canvas plan (Push 2).
 */

export interface ZoomControlsProps {
  onZoom: (facteur: number) => void
  onAjuster: () => void
}

const CLS =
  'h-10 w-10 rounded-xl bg-white border-[1.5px] border-gray-200 font-hanken font-bold text-navy shadow-sm hover:border-orange transition-colors'

export default function ZoomControls({ onZoom, onAjuster }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
      <button type="button" aria-label="Zoomer" onClick={() => onZoom(1.25)} className={CLS}>
        +
      </button>
      <button type="button" aria-label="Dézoomer" onClick={() => onZoom(1 / 1.25)} className={CLS}>
        −
      </button>
      <button
        type="button"
        aria-label="Ajuster la vue au plan"
        onClick={onAjuster}
        className={`${CLS} text-[11px]`}
      >
        FIT
      </button>
    </div>
  )
}
