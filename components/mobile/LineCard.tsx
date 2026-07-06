'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LineCard — carte verticale lisible pour une ligne de devis/facture (mobile)
// ─────────────────────────────────────────────────────────────────────────────
// Remplace le tableau écrasé sur smartphone portrait. 3 modes selon line.type :
//   • 'section'    → bandeau bleu plein (#a8d4ec) + accent gauche (#1a6fb5),
//                    titre uppercase + subtotal à droite.
//   • 'subsection' → bandeau bleu pâle (#dceefa) + accent (#5ab4e0),
//                    titre semi-bold + subtotal à droite.
//   • 'line'       → carte blanche : désignation grosse en haut puis grille
//                    "Qté × Unité × Prix HT" + total ligne en bleu à droite.
//
// Tap sur le corps = onTap() (ouvre le bottom sheet d'édition).
// Bouton corbeille en haut à droite (icône 16px, gris → rouge au hover).
// ─────────────────────────────────────────────────────────────────────────────

import { Trash2 } from 'lucide-react'

export interface LineCardData {
  id: number
  designation: string
  qty: number
  unit: string
  priceHT: number
  type: 'line' | 'section' | 'subsection' | 'text'
}

interface LineCardProps {
  line: LineCardData
  subtotal: number
  onTap: () => void
  onDelete: () => void
  formatCurrency: (n: number) => string
  /** Push 4 — badge optionnel (ex. « vient du plan »), rendu sous la désignation des lignes classiques. */
  badge?: React.ReactNode
}

export default function LineCard({ line, subtotal, onTap, onDelete, formatCurrency, badge }: LineCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  // ── SECTION ──────────────────────────────────────────────────────────────
  if (line.type === 'section') {
    return (
      <div
        onClick={onTap}
        className="relative bg-[#a8d4ec] border-l-4 border-[#1a6fb5] rounded-xl px-4 py-3 cursor-pointer active:scale-[.99] transition-all flex items-center justify-between gap-3"
      >
        <span className="flex-1 text-[#0f1a3a] font-syne font-extrabold uppercase tracking-wider text-sm leading-tight">
          {line.designation || 'Nouvelle section'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[#1a6fb5] font-bold text-sm">{formatCurrency(subtotal)}</span>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Supprimer la section"
            className="p-1 text-[#1a6fb5]/60 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── SOUS-SECTION ─────────────────────────────────────────────────────────
  if (line.type === 'subsection') {
    return (
      <div
        onClick={onTap}
        className="relative bg-[#dceefa] border-l-4 border-[#5ab4e0] rounded-xl px-4 py-3 cursor-pointer active:scale-[.99] transition-all flex items-center justify-between gap-3"
      >
        <span className="flex-1 text-[#0f1a3a] font-semibold text-sm leading-tight">
          {line.designation || 'Nouvelle sous-section'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[#1a6fb5] font-semibold text-sm">{formatCurrency(subtotal)}</span>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Supprimer la sous-section"
            className="p-1 text-[#1a6fb5]/60 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── TEXTE LIBRE (rare, mais on gère pour parité devis) ───────────────────
  if (line.type === 'text') {
    return (
      <div
        onClick={onTap}
        className="relative bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer active:scale-[.99] transition-all"
      >
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Supprimer le texte"
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={16} />
        </button>
        <p className="text-sm text-gray-600 italic pr-8 leading-snug">
          {line.designation || 'Texte libre (tap pour éditer)'}
        </p>
      </div>
    )
  }

  // ── LIGNE CLASSIQUE ──────────────────────────────────────────────────────
  const total = line.qty * line.priceHT
  return (
    <div
      onClick={onTap}
      className="relative bg-white border border-gray-200 rounded-xl p-4 cursor-pointer active:scale-[.99] transition-all hover:border-[#5ab4e0]/50"
    >
      <button
        type="button"
        onClick={handleDelete}
        aria-label="Supprimer la ligne"
        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors z-10"
      >
        <Trash2 size={16} />
      </button>

      <div className="pr-7">
        <div className="text-base font-medium text-[#0f1a3a] leading-tight break-words">
          {line.designation || <span className="text-gray-400 italic">Désignation à compléter</span>}
        </div>

        {badge && <div className="mt-1.5">{badge}</div>}

        <div className="flex items-center justify-between mt-3 gap-3">
          <span className="text-sm text-gray-600 font-manrope">
            {line.qty} × <span className="font-semibold">{line.unit}</span> × {formatCurrency(line.priceHT)}
          </span>
          <span className="text-[#1a6fb5] font-bold text-base shrink-0">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
