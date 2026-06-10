'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

/**
 * HelpTooltip — Petit "?" cliquable / hoverable qui ouvre une bulle
 * d'explication au-dessus (ou au-dessous si pas la place).
 *
 * Rendu via React Portal pour échapper à l'overflow:hidden des cartes
 * KPI parentes. Position calculée dynamiquement.
 *
 * Accessibilité :
 *  - Bouton avec aria-label décrivant l'aide.
 *  - Tooltip avec role="tooltip" + aria-describedby.
 *  - Focus-visible (clavier) ouvre la bulle.
 *  - Touch friendly : tap ouvre, tap n'importe où ailleurs ferme.
 */
export function HelpTooltip({
  label,
  content,
  size = 14,
}: {
  /** aria-label du bouton "?". Ex : "Aide CA Facturé". */
  label: string
  /** Contenu de la bulle. */
  content: string
  /** Taille de l'icône (px). 14 par défaut. */
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: true,
  })
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Recalcule la position quand on ouvre.
  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const TOOLTIP_W = 260
    const TOOLTIP_H = 80 // estimation, suffisant pour ces textes courts
    const GAP = 10

    // Centrage horizontal sur le bouton, clamp dans le viewport.
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    if (left < 8) left = 8
    if (left + TOOLTIP_W > window.innerWidth - 8) {
      left = window.innerWidth - TOOLTIP_W - 8
    }

    // Place au-dessus si possible, sinon en dessous.
    const spaceAbove = rect.top
    const placeAbove = spaceAbove > TOOLTIP_H + GAP
    const top = placeAbove
      ? rect.top - GAP - TOOLTIP_H
      : rect.bottom + GAP

    setPos({ top, left, placeAbove })
  }, [open])

  // Fermeture sur clic en dehors + Escape.
  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        btnRef.current?.contains(target) ||
        tipRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer, { passive: true })
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex items-center justify-center rounded-full transition-colors duration-150 text-[#a8b5c5] hover:text-[#445068] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a]/40"
        style={{ width: size + 6, height: size + 6, padding: 0, lineHeight: 0 }}
      >
        <HelpCircle size={size} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && mounted && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="font-hanken pointer-events-none"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 260,
              zIndex: 9999,
              background: '#0f1a3a',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(15,26,58,0.25), 0 2px 6px rgba(15,26,58,0.18)',
              letterSpacing: '-0.005em',
            }}
          >
            {content}
            {/* Petit triangle indicateur */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: 8,
                height: 8,
                background: '#0f1a3a',
                ...(pos.placeAbove
                  ? { bottom: -4 }
                  : { top: -4 }),
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

export default HelpTooltip
