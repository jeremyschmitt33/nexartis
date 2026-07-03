'use client'

/**
 * useAutosave — Sauvegarde automatique du plan (Push 2, 03/07/2026).
 *
 * - Debounce 2 s après la dernière modification (`version` change) :
 *   UPDATE plans SET name, data, computed, updated_at (client Supabase + RLS).
 * - Snapshot plan_revisions (reason 'autosave') toutes les 10 min d'édition
 *   active, déclenché à l'issue d'une sauvegarde réussie.
 * - Best effort au `pagehide` (fermeture d'onglet pendant le debounce).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlanData } from '@/lib/plan/types'
import { surfaceCreeeProjetM2, surfaceExterieureM2, surfaceHabitableM2 } from '@/lib/plan/metrics'

export type StatutSauvegarde = 'sauvegarde' | 'encours' | 'erreur'

const DEBOUNCE_MS = 2000
const REVISION_MS = 10 * 60 * 1000

/** Métrés dénormalisés stockés dans plans.computed (résumé léger, Push 2). */
export function calculerComputed(data: PlanData): Record<string, unknown> {
  const toutes = data.levels.flatMap((n) => n.rooms)
  return {
    habitableM2: surfaceHabitableM2(toutes),
    exterieureM2: surfaceExterieureM2(toutes),
    creeeProjetM2: surfaceCreeeProjetM2(toutes),
    niveaux: data.levels.map((n) => ({
      id: n.id,
      name: n.name,
      habitableM2: surfaceHabitableM2(n.rooms),
      pieces: n.rooms.length,
    })),
  }
}

export function useAutosave(planId: string, name: string, data: PlanData, version: number): {
  statut: StatutSauvegarde
} {
  const [statut, setStatut] = useState<StatutSauvegarde>('sauvegarde')
  const derniereRevision = useRef<number>(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enCours = useRef(false)
  const aSauver = useRef(false)
  const contenu = useRef({ name, data })
  contenu.current = { name, data }

  const sauvegarder = useCallback(async () => {
    if (enCours.current) {
      aSauver.current = true
      return
    }
    enCours.current = true
    setStatut('encours')
    try {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Non connecté')
      const { name: nomActuel, data: dataActuel } = contenu.current
      const { error } = await supabase
        .from('plans')
        .update({
          name: nomActuel,
          data: dataActuel,
          computed: calculerComputed(dataActuel),
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
      setStatut('sauvegarde')

      // Snapshot périodique (10 min d'édition active) dans plan_revisions.
      if (Date.now() - derniereRevision.current >= REVISION_MS) {
        derniereRevision.current = Date.now()
        const { error: errRev } = await supabase.from('plan_revisions').insert({
          plan_id: planId,
          user_id: user.id,
          data: dataActuel,
          reason: 'autosave',
        })
        if (errRev) {
          // Non bloquant : le plan est sauvé, seul le snapshot a échoué.
          console.error('[plan] snapshot revision échoué')
        }
      }
    } catch (_e) {
      console.error('[plan] autosave échoué')
      setStatut('erreur')
    } finally {
      enCours.current = false
      if (aSauver.current) {
        aSauver.current = false
        void sauvegarder()
      }
    }
  }, [planId])

  // Debounce 2 s sur chaque modification (version) ou renommage.
  const premierRendu = useRef(true)
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false
      return
    }
    setStatut('encours')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void sauvegarder()
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [version, name, sauvegarder])

  // Best effort : si l'onglet se ferme pendant le debounce, on tente la sauvegarde.
  useEffect(() => {
    const onPageHide = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void sauvegarder()
      }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [sauvegarder])

  return { statut }
}
