'use client'

// 2026-06-10 — Toast PWA "Nouvelle version disponible"
// ----------------------------------------------------------------------------
// La landing promet (MobileSection) que l'utilisateur est notifie quand une
// nouvelle version est prete. Ce composant ecoute le service worker
// (public/sw.js) et affiche un toast bas-droite quand un nouveau SW prend
// le controle (= nouveau bundle deployé en prod).
//
// Detection : evenement 'controllerchange' sur navigator.serviceWorker.
// L'evenement est emis quand le SW actif change (apres skipWaiting cote SW
// ou apres install d'une nouvelle version qui prend la main).
//
// Style V4 light : carte blanche, accent line orange en haut, Hanken Grotesk,
// CTA orange compact "Recharger" -> window.location.reload().
//
// Note : composant client (use client) + monte dans app/dashboard/layout.tsx.

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function PWAUpdateToast() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Premier load : on memorise le SW actuel pour ne PAS afficher de toast
    // tant qu'il n'a pas change. Sinon un simple refresh declencherait le toast.
    let initialized = false
    const handleControllerChange = () => {
      // Ignore l'evenement initial (apparait au premier mount quand le SW
      // prend le controle de la page la 1ere fois).
      if (!initialized) {
        initialized = true
        return
      }
      setVisible(true)
    }

    // Si un controller est deja actif au mount, on considere comme initialise.
    if (navigator.serviceWorker.controller) {
      initialized = true
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // En complement : detecter une nouvelle version "waiting" via update().
    // Si le SW expose un worker en attente, on affiche aussi le toast.
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      const checkWaiting = () => {
        if (reg.waiting) {
          setVisible(true)
        }
      }
      checkWaiting()
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouveau SW installe alors qu'un autre est deja en place -> update dispo
            setVisible(true)
          }
        })
      })
    }).catch(() => {
      // Silencieux : si on ne peut pas recuperer la registration, le toast
      // sera tout de meme declenche par controllerchange.
    })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[60] max-w-sm"
      role="status"
      aria-live="polite"
    >
      <div className="relative bg-white rounded-2xl border border-[#0f1a3a]/[0.08] shadow-[0_12px_32px_rgba(15,26,58,0.14),_0_2px_6px_rgba(15,26,58,0.06)] overflow-hidden">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
        <div className="p-4 pr-3 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] flex items-center justify-center text-white shadow-[0_4px_10px_rgba(255,122,26,0.25)]">
            <RefreshCw size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-hanken font-extrabold text-[14px] text-[#0f1a3a] tracking-[-0.01em] leading-tight">
              Nouvelle version disponible
            </p>
            <p className="font-hanken text-[12.5px] text-gray-500 mt-1 leading-relaxed">
              Rechargez Nexartis pour profiter des dernieres ameliorations.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-8 px-4 rounded-lg bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[12.5px] font-bold shadow-[0_4px_10px_rgba(255,122,26,0.25),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                Recharger
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="h-8 px-3 rounded-lg border border-gray-200 bg-white font-hanken text-[12.5px] font-semibold text-gray-600 hover:bg-[#fafbfc] transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="p-1 -mt-1 -mr-1 rounded-md hover:bg-[#fafbfc] transition-colors"
            aria-label="Fermer la notification"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
