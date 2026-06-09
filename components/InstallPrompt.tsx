'use client'

/**
 * Composant client "Installer l'app" — Bouton orange CTA pour installer la PWA Nexartis.
 *
 * CYCLE DE VIE DE L'EVENT beforeinstallprompt (lecture obligatoire avant de modifier) :
 *
 *  - Chrome / Edge (Android + Desktop) : le navigateur émet `beforeinstallprompt`
 *    automatiquement quand il détecte que le site est installable (manifest +
 *    SW + critères PWA). On capture l'event, on appelle preventDefault() pour
 *    empêcher le mini-banner natif, puis on stocke le `deferredPrompt` qu'on
 *    pourra rejouer plus tard via `.prompt()` au clic utilisateur.
 *
 *  - Firefox Desktop : n'émet PAS beforeinstallprompt. Le bouton restera caché.
 *    Firefox Android passe par son propre menu "Installer". Pas grave.
 *
 *  - Safari iOS / iPadOS : aucune API d'install. L'utilisateur doit utiliser
 *    "Partager → Sur l'écran d'accueil" manuellement. Ce composant ne montre
 *    rien sur iOS. Cas géré ailleurs (un futur composant pourra afficher des
 *    instructions iOS-specific en s'appuyant sur navigator.userAgent).
 *
 *  - Si déjà installée : `window.matchMedia('(display-mode: standalone)')`
 *    est `true`, on n'affiche rien (l'utilisateur est déjà dans l'app).
 *
 *  - Si refusée : on stocke un timestamp dans localStorage et on attend 7 jours
 *    avant de re-proposer (sinon trop agressif).
 */

import { useEffect, useState } from 'react'

// Type minimal de l'event beforeinstallprompt (pas standardisé dans le DOM types).
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISS_STORAGE_KEY = 'nexartis_pwa_prompt_dismissed_until'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

/**
 * Props du composant InstallPrompt.
 *
 * - iconOnly : variante carrée 44x44px (icône seule, pas de texte). Pensée
 *   pour la nav mobile de la landing (juste à gauche du burger). Touch
 *   target standard iOS/Android.
 *
 * - theme : palette appliquée au bouton.
 *   - 'landing' (défaut) : couleurs V4 dark (bg-accent / text-bgdark).
 *   - 'dashboard' : couleurs V3.0d.2 (#e87a2a sur fond white, contraste
 *     adapté aux écrans du dashboard avec sections blanches).
 */
interface InstallPromptProps {
  iconOnly?: boolean
  theme?: 'landing' | 'dashboard'
}

export default function InstallPrompt({
  iconOnly = false,
  theme = 'landing',
}: InstallPromptProps = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Cas "déjà installée" → on ne capture même pas l'event.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari : propriété non standard mais fiable.
      (navigator as any).standalone === true
    if (isStandalone) return

    // Cas "récemment refusée" → on ignore l'event pendant 7 jours.
    try {
      const dismissedUntilStr = localStorage.getItem(DISMISS_STORAGE_KEY)
      if (dismissedUntilStr) {
        const dismissedUntil = parseInt(dismissedUntilStr, 10)
        if (!isNaN(dismissedUntil) && Date.now() < dismissedUntil) {
          return
        }
      }
    } catch {
      // localStorage indisponible (mode privé Safari ancien) — on ignore et on continue.
    }

    const handleBeforeInstall = (event: Event) => {
      // preventDefault pour bloquer la mini-banner Chrome native, on prend la main.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      // L'utilisateur a accepté → on cache notre bouton.
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Handler clic : on rejoue l'event stocké, on attend le choix utilisateur.
  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      console.log('[PWA] install choice:', choice.outcome)
      if (choice.outcome === 'dismissed') {
        // On note la date pour ne pas re-proposer pendant 7 jours.
        try {
          localStorage.setItem(
            DISMISS_STORAGE_KEY,
            String(Date.now() + DISMISS_DURATION_MS)
          )
        } catch {
          // localStorage HS, on tant pis.
        }
      }
    } catch (err) {
      console.warn('[PWA] install prompt failed:', err)
    } finally {
      // L'event ne peut être rejoué qu'une seule fois, on l'oublie.
      setDeferredPrompt(null)
    }
  }

  if (!deferredPrompt) return null

  // Icône Download partagée entre les deux variantes (texte / icon-only).
  // Inline SVG pour éviter une dépendance lucide-react.
  const downloadIcon = (size: number) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )

  // Sélection des classes de couleur selon le theme.
  // - landing : palette V4 dark (accent orange #ff7a1a sur bgdark).
  // - dashboard : palette V3.0d.2 (orange Nexartis #e87a2a, texte blanc).
  const colorClasses =
    theme === 'dashboard'
      ? 'bg-[#e87a2a] hover:bg-[#f09050] text-white'
      : 'bg-accent hover:bg-accent-2 text-bgdark'

  // ---------- Variante icône carrée 44x44 (mobile nav landing) ----------
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className={[
          colorClasses,
          // Touch target standard 44x44, border-radius cohérent avec le burger
          // adjacent (qui est en rounded-[10px]) — on prend rounded-[12px]
          // pour une légère différenciation visuelle entre les deux carrés.
          'inline-flex items-center justify-center w-11 h-11 rounded-[12px]',
          'shadow-[0_0_20px_rgba(255,122,26,0.4)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgdark',
        ].join(' ')}
        aria-label="Installer l'application Nexartis sur cet appareil"
      >
        {downloadIcon(20)}
      </button>
    )
  }

  // ---------- Variante texte complète (par défaut) ----------
  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className={[
        colorClasses,
        'font-hanken font-bold px-5 py-2.5 rounded-full text-sm',
        'flex items-center gap-2 shadow-[0_0_20px_rgba(255,122,26,0.4)] transition-colors',
      ].join(' ')}
      aria-label="Installer l'application Nexartis sur cet appareil"
    >
      {downloadIcon(16)}
      Installer l&apos;app
    </button>
  )
}
