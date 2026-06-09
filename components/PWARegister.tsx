'use client'

/**
 * Composant client qui pilote le cycle de vie du service worker.
 * À monter une seule fois, idéalement dans app/layout.tsx.
 *
 * Rôle :
 *  1. Enregistre /sw.js au mount (uniquement en prod, jamais en dev pour
 *     éviter les caches périmés pendant le développement).
 *  2. Détecte qu'une nouvelle version du SW est installée et propose à
 *     l'utilisateur de recharger via un petit toast en bas à droite.
 *
 * Approche minimaliste : pas de lib externe (next-pwa, workbox), juste l'API
 * native ServiceWorkerRegistration. Cycle de vie documenté ici :
 * https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
 */

import { useEffect, useState } from 'react'

export default function PWARegister() {
  // Quand un nouveau SW est en attente (installed mais pas encore actif),
  // on stocke sa référence pour pouvoir l'activer au clic sur "Recharger".
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    // Vérif environnement : pas en dev, navigateur compatible.
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    let cancelled = false

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        if (cancelled) return

        // Cas 1 — Un SW est déjà en attente au moment de la registration.
        if (registration.waiting) {
          setUpdateReady(true)
        }

        // Cas 2 — Un nouveau SW commence à s'installer après la registration.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // Quand le nouveau SW passe en "installed", il est prêt à prendre la
            // relève. On affiche le toast seulement s'il y a déjà un SW actif
            // (sinon c'est juste l'install initiale, pas une mise à jour).
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })

        // Cas 3 — Le SW prend le contrôle après un skipWaiting → on recharge.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Évite la boucle infinie : on ne recharge qu'une seule fois.
          if ((window as any).__nexartisReloaded) return
          ;(window as any).__nexartisReloaded = true
          window.location.reload()
        })
      } catch (err) {
        // Échec d'enregistrement (HTTPS manquant, CSP, etc.) — on log seulement.
        console.warn('[PWA] Service worker registration failed:', err)
      }
    }

    // On laisse le navigateur respirer (paint initial) avant d'enregistrer.
    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
    }

    return () => {
      cancelled = true
    }
  }, [])

  // Handler du bouton "Recharger" : on demande au SW en attente de prendre la
  // relève via postMessage skipWaiting, puis le reload sera déclenché par
  // l'event controllerchange (cf. plus haut).
  const handleReload = async () => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload()
      return
    }
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      // Fallback : reload direct si pas de SW en waiting.
      window.location.reload()
    }
  }

  if (!updateReady) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 bg-bgdark-2 text-ink border border-electric/30 rounded-xl p-4 shadow-2xl z-[200] max-w-xs animate-[fade-up_0.3s_ease-out]"
    >
      <p className="font-hanken font-bold text-sm mb-1">Nouvelle version disponible</p>
      <p className="font-hanken text-ink-2 text-xs mb-3">
        Une mise à jour de Nexartis est prête.
      </p>
      <button
        type="button"
        onClick={handleReload}
        className="w-full bg-accent hover:bg-accent-2 text-bgdark font-hanken font-bold text-sm px-4 py-2 rounded-full transition-colors"
      >
        Recharger
      </button>
    </div>
  )
}
