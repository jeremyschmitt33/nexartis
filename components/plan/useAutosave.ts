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
 * - `pagehide` / `visibilitychange(hidden)` : PATCH REST direct avec
 *   `fetch(..., { keepalive: true })` — survit au rechargement/fermeture,
 *   contrairement aux requêtes supabase-js qui meurent avec la page.
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
/** Limite navigateur (~64 Ko) sur le corps d'un fetch keepalive. */
const KEEPALIVE_MAX_OCTETS = 60000

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
  // Jeton d'accès maintenu à jour pour le PATCH keepalive du pagehide.
  const jeton = useRef<{ token: string; userId: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let actif = true
    void supabase.auth.getSession().then(({ data: s }) => {
      if (actif && s.session) {
        jeton.current = { token: s.session.access_token, userId: s.session.user.id }
      }
    })
    const { data: abo } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) jeton.current = { token: session.access_token, userId: session.user.id }
    })
    return () => {
      actif = false
      abo.subscription.unsubscribe()
    }
  }, [])

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

  // Best effort au rechargement/fermeture d'onglet : PATCH REST keepalive
  // (les requêtes supabase-js, elles, sont annulées par le navigateur).
  useEffect(() => {
    const envoyer = () => {
      const c = contenu.current
      const propre = c.version === sauve.current.version && c.name === sauve.current.name
      // Rien à sauver ET aucun save en vol susceptible de mourir → inutile.
      if (propre && !enCours.current) return
      const auth = jeton.current
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!auth || !url || !cle) return
      const corps = JSON.stringify({
        name: c.name,
        data: c.data,
        computed: calculerComputed(c.data),
        updated_at: new Date().toISOString(),
      })
      if (corps.length > KEEPALIVE_MAX_OCTETS) return
      try {
        void fetch(
          `${url}/rest/v1/plans?id=eq.${encodeURIComponent(planId)}&user_id=eq.${encodeURIComponent(auth.userId)}`,
          {
            method: 'PATCH',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              apikey: cle,
              Authorization: `Bearer ${auth.token}`,
              Prefer: 'return=minimal',
            },
            body: corps,
          }
        ).catch(() => {
          // Best effort : la page est en train de disparaître.
        })
      } catch (_e) {
        // Best effort : rien d'autre à faire à ce stade.
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
