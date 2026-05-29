'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlanningViewMode } from '@/components/planning/shared/types'

const STORAGE_KEY = 'planning_view_mode'

/**
 * Détermine le mode d'affichage du planning :
 *   1. Si l'utilisateur a déjà choisi manuellement → localStorage override
 *   2. Sinon détection auto via forme juridique :
 *      - AE / Micro / EI / EIRL → 'agenda'
 *      - EURL / SARL / SAS / SASU / autres → 'matrix'
 *      - undefined → 'matrix' (défaut sûr = comportement historique)
 *
 * Le toggle expose un setter qui persiste systématiquement dans
 * localStorage, donc le prochain mount restera sur le choix utilisateur.
 *
 * Retourne aussi `isUserOverride` pour permettre à l'UI de signaler
 * "(choix manuel)" si besoin (non utilisé pour l'instant).
 */
export function useViewModeAuto(formeJuridique: string | undefined): {
  viewMode: PlanningViewMode
  setViewMode: (mode: PlanningViewMode) => void
  isUserOverride: boolean
} {
  // SSR-safe : on initialise sur 'matrix' (défaut historique) puis on
  // synchronise au 1er effet (côté client uniquement).
  const [viewMode, setViewModeState] = useState<PlanningViewMode>('matrix')
  const [isUserOverride, setIsUserOverride] = useState(false)
  const initializedRef = useRef(false)

  // Détection au mount + à chaque changement de forme juridique tant que
  // l'utilisateur n'a pas overridé manuellement.
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 1. Override localStorage en priorité (toujours)
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'agenda' || stored === 'matrix') {
      setViewModeState(stored)
      setIsUserOverride(true)
      initializedRef.current = true
      return
    }
    // 2. Auto-détection — uniquement si pas encore initialisé
    //    (pour ne pas écraser un changement utilisateur en cours de session)
    if (initializedRef.current) return
    const forme = (formeJuridique ?? '').toLowerCase().trim()
    let auto: PlanningViewMode = 'matrix' // défaut sûr
    if (
      forme.includes('micro') ||
      forme === 'ae' ||
      forme === 'ei' ||
      forme === 'eirl' ||
      forme.includes('entreprise individuelle') ||
      forme.includes('auto-entrepreneur') ||
      forme.includes('auto entrepreneur')
    ) {
      auto = 'agenda'
    }
    setViewModeState(auto)
    initializedRef.current = true
  }, [formeJuridique])

  const setViewMode = useCallback((mode: PlanningViewMode) => {
    setViewModeState(mode)
    setIsUserOverride(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode)
    }
  }, [])

  return { viewMode, setViewMode, isUserOverride }
}
