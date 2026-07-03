'use client'

/**
 * useAutosave — Sauvegarde automatique du plan (Push 2, 03/07/2026).
 * Fix P0 03/07/2026 : perte d'une modification à la navigation.
 *
 * Principe anti-perte : on mémorise la dernière version réellement ÉCRITE
 * en base (`sauve`) et on la compare au contenu courant. Le « dirty » ne
 * repose plus uniquement sur un timer de debounce (fragile : un timer annulé
 * = modification silencieusement perdue).
 *
 * - Debounce 2 s après la dernière modification (`version` ou nom) :
 *   UPDATE plans SET name, data, computed, updated_at (client Supabase + RLS).
 * - Si des modifications arrivent PENDANT un save en vol → re-save immédiat
 *   à la fin du vol.
 * - `flush()` exposé : annule le debounce et sauve tout de suite si besoin.
 *   Appelé au clic « retour » (PlanTopbar) et à l'unmount de l'éditeur
 *   (navigation client Next : `pagehide` ne se déclenche pas).
 * - `pagehide` / `visibilitychange(hidden)` : `navigator.sendBeacon` vers
 *   la route MÊME ORIGINE `/api/plan/beacon-save`.
 *   ⚠️ LEÇON (prouvée en prod, 03/07/2026) : un PATCH REST direct vers
 *   Supabase (cross-origin + headers Authorization/apikey) déclenche un
 *   PRÉVOL OPTIONS ; au déchargement de la page, Chrome envoie l'OPTIONS
 *   puis tue la page avant le PATCH → la sauvegarde ne part JAMAIS, même
 *   avec `fetch keepalive` (keepalive ne protège pas les requêtes à prévol).
 *   sendBeacon même origine : zéro prévol, cookies inclus, conçu pour
 *   survivre au déchargement. Le serveur recalcule `computed` lui-même.
 * - Snapshot plan_revisions (reason 'autosave') toutes les 10 min d'édition
 *   active, déclenché à l'issue d'une sauvegarde réussie.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlanData } from '@/lib/plan/types'
import { surfaceCreeeProjetM2, surfaceExterieureM2, surfaceHabitableM2 } from '@/lib/plan/metrics'

export type StatutSauvegarde = 'sauvegarde' | 'encours' | 'erreur'

const DEBOUNCE_MS = 2000
const REVISION_MS = 10 * 60 * 1000
/** Limite navigateur (~64 Ko) sur la file d'attente sendBeacon. */
const BEACON_MAX_OCTETS = 60000

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
  /** Sauvegarde immédiate (annule le debounce). Sans effet si tout est déjà sauvé. */
  flush: () => void
} {
  const [statut, setStatut] = useState<StatutSauvegarde>('sauvegarde')
  const derniereRevision = useRef<number>(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enCours = useRef(false)
  const contenu = useRef({ name, data, version })
  contenu.current = { name, data, version }
  // Dernier contenu effectivement ÉCRIT en base. Au montage, la base
  // contient déjà l'état initial chargé (donc « rien à sauver »).
  const sauve = useRef<{ name: string; version: number }>({ name, version })

  const sauvegarder = useCallback(async () => {
    // Un save est déjà en vol : sa clause finally re-déclenchera si le
    // contenu a bougé entre-temps (plus de dirty flag séparé à perdre).
    if (enCours.current) return
    enCours.current = true
    setStatut('encours')
    const capture = contenu.current
    let ok = false
    try {
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Non connecté')
      const { error } = await supabase
        .from('plans')
        .update({
          name: capture.name,
          data: capture.data,
          computed: calculerComputed(capture.data),
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
      ok = true
      sauve.current = { name: capture.name, version: capture.version }
      // « Enregistré » UNIQUEMENT si rien n'a bougé pendant le vol
      // (sinon l'indicateur mentirait pendant le debounce suivant).
      const c = contenu.current
      if (c.version === capture.version && c.name === capture.name) {
        setStatut('sauvegarde')
      }

      // Snapshot périodique (10 min d'édition active) dans plan_revisions.
      if (Date.now() - derniereRevision.current >= REVISION_MS) {
        derniereRevision.current = Date.now()
        const { error: errRev } = await supabase.from('plan_revisions').insert({
          plan_id: planId,
          user_id: user.id,
          data: capture.data,
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
      // Fix P0 : des modifications sont arrivées pendant le vol → re-save
      // immédiat. (Pas de re-tentative automatique après échec : le statut
      // 'erreur' reste affiché, la prochaine modification ou flush relance.)
      const c = contenu.current
      if (ok && (c.version !== sauve.current.version || c.name !== sauve.current.name)) {
        if (timer.current) {
          clearTimeout(timer.current)
          timer.current = null
        }
        void sauvegarder()
      }
    }
  }, [planId])

  /** Sauvegarde immédiate : annule le debounce et sauve si nécessaire. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const c = contenu.current
    if (c.version !== sauve.current.version || c.name !== sauve.current.name) {
      void sauvegarder()
    }
  }, [sauvegarder])

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
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [version, name, sauvegarder])

  // Flush à l'unmount : couvre la navigation client Next (« retour »,
  // bouton précédent) où pagehide ne se déclenche jamais. La requête
  // supabase-js survit à l'unmount tant que la page reste chargée.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    return () => flushRef.current()
  }, [])

  // Best effort au rechargement/fermeture d'onglet : sendBeacon vers notre
  // route même origine (cookies inclus, pas de prévol CORS — voir en-tête).
  // `computed` n'est plus envoyé : le serveur le recalcule (zéro confiance).
  useEffect(() => {
    const envoyer = () => {
      const c = contenu.current
      const propre = c.version === sauve.current.version && c.name === sauve.current.name
      // Rien à sauver ET aucun save en vol susceptible de mourir → inutile.
      if (propre && !enCours.current) return
      const corps = JSON.stringify({ planId, name: c.name, data: c.data })
      if (corps.length > BEACON_MAX_OCTETS) return
      try {
        navigator.sendBeacon(
          '/api/plan/beacon-save',
          new Blob([corps], { type: 'application/json' })
        )
      } catch (_e) {
        // Best effort : la page est en train de disparaître.
      }
    }
    const onPageHide = () => envoyer()
    const onVisibilite = () => {
      if (document.visibilityState === 'hidden') envoyer()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilite)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilite)
    }
  }, [planId])

  return { statut, flush }
}
