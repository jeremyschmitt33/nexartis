'use client'

/**
 * InstallReminderBanner — Bandeau de rappel d'installation PWA dans le dashboard.
 *
 * Affiche un bandeau orange discret en haut du dashboard rappelant a l'artisan
 * qu'il peut installer Nexartis comme app native sur son appareil. Bouton
 * "Installer" pour declencher directement le prompt natif Chrome, ou croix
 * pour fermer (caché 7 jours via localStorage).
 *
 * Visibilite :
 *  - Affiche UNIQUEMENT si l'event `beforeinstallprompt` a ete capture (sinon
 *    bouton sans action, on evite la fausse promesse).
 *  - Cache si l'utilisateur a clique sur la croix < 7 jours.
 *  - Cache si l'utilisateur est deja dans la PWA (display-mode: standalone).
 *  - Cache automatiquement apres acceptation du prompt.
 *
 * Style V4 light premium dashboard :
 *  - Fond degrade orange tres pale + bordure orange subtile
 *  - Icone Smartphone gradient orange
 *  - Texte Hanken Grotesk
 *  - Bouton install gradient orange (#ff7a1a + #ff9d4d)
 *  - Croix de dismiss en haut a droite
 */

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISS_STORAGE_KEY = 'nexartis_dashboard_install_banner_dismissed_until'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

export default function InstallReminderBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true) // hide by default to avoid SSR flash

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Cas "deja installee" → ne rien afficher dans le dashboard PWA standalone.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Cas "recemment dismissed" → on attend 7 jours.
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY)
      if (stored) {
        const until = parseInt(stored, 10)
        if (!isNaN(until) && Date.now() < until) return
      }
    } catch {
      // localStorage indisponible : on continue (mode prive Safari ancien)
    }

    // Pas dismissed, pas installee : on peut afficher si le navigateur
    // emet beforeinstallprompt. setDismissed(false) seulement quand on a
    // l'event en main.
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setDismissed(false)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setDismissed(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      console.log('[PWA dashboard banner] install choice:', choice.outcome)
      if (choice.outcome === 'dismissed') {
        // Si refuse via le prompt natif, on note la date pour cacher 7j.
        try {
          localStorage.setItem(
            DISMISS_STORAGE_KEY,
            String(Date.now() + DISMISS_DURATION_MS),
          )
        } catch {}
      }
    } catch (err) {
      console.warn('[PWA dashboard banner] prompt failed:', err)
    } finally {
      setDeferredPrompt(null)
      setDismissed(true)
    }
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        String(Date.now() + DISMISS_DURATION_MS),
      )
    } catch {}
    setDismissed(true)
  }

  if (dismissed || !deferredPrompt) return null

  return (
    <div
      role="status"
      className="relative bg-gradient-to-r from-[#fff5ec] via-[#fff9f2] to-[#fff5ec] border-b border-[#ff7a1a]/20 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap"
    >
      {/* Icone Smartphone gradient orange */}
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white
                   bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                   shadow-[0_4px_12px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
      >
        <Smartphone size={18} strokeWidth={2.2} />
      </div>

      {/* Texte */}
      <div className="flex-1 min-w-[200px]">
        <p className="font-hanken font-bold text-[14px] text-[#0f1a3a] leading-tight">
          Installez Nexartis comme application
        </p>
        <p className="font-hanken text-[12.5px] text-gray-600 leading-snug mt-0.5">
          Acces en un clic depuis votre ecran d&apos;accueil, sans navigateur.
        </p>
      </div>

      {/* Bouton install gradient orange V4 */}
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                   bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
                   text-white font-hanken font-bold text-[13px]
                   shadow-[0_4px_12px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
                   hover:brightness-105 hover:-translate-y-0.5
                   active:translate-y-0
                   transition-all duration-200"
      >
        Installer
      </button>

      {/* Croix dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center
                   text-gray-500 hover:text-[#0f1a3a] hover:bg-[#0f1a3a]/[0.04]
                   transition-colors duration-150"
        aria-label="Fermer le bandeau d'installation"
        title="Masquer pendant 7 jours"
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  )
}
