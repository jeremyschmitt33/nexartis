'use client'

/**
 * useCanvasNav — Navigation molette/clavier du canvas (Push 3a, 03/07/2026).
 * Extrait de PlanCanvas (limite de 450 lignes par fichier) :
 * - zoom molette autour du curseur (listener NATIF non passif : preventDefault
 *   est interdit dans un listener passif React) ;
 * - Espace = pan temporaire ; Échap = annulation (délégué au parent).
 */

import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { zoomAutour, type Viewport } from '@/lib/plan/viewport'

export function useCanvasNav(
  svgRef: RefObject<SVGSVGElement>,
  setVp: Dispatch<SetStateAction<Viewport>>,
  vueTouchee: MutableRefObject<boolean>,
  espace: MutableRefObject<boolean>,
  onEchap: () => void
): void {
  // ── Zoom molette ──────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const facteur = e.deltaY < 0 ? 1.12 : 1 / 1.12
      vueTouchee.current = true
      setVp((v) => zoomAutour(v, e.clientX - rect.left, e.clientY - rect.top, facteur))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, setVp, vueTouchee])

  // ── Espace = pan temporaire, Échap = annulation ──────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') espace.current = true
      if (e.key === 'Escape') onEchap()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') espace.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [espace, onEchap])
}
