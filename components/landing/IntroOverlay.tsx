'use client'

/**
 * IntroOverlay — Animation cinematique d'introduction de la landing Nexartis.
 *
 * Comportement :
 *  - Joue une timeline de 4 300 ms au premier chargement de la session (sessionStorage).
 *  - Lecture unique par session (clef `nexartis_intro_seen`).
 *  - Skippable via le bouton "Passer l'intro" (en bas a droite).
 *  - Respecte `prefers-reduced-motion` : si reduit, l'overlay ne s'affiche pas.
 *  - Expose `window.__nexartisReplayIntro()` pour rejouer (depuis le bouton "Revoir l'intro").
 *
 * SSR / SEO :
 *  - Composant client uniquement. Retourne `null` au premier render (avant hydratation).
 *  - Le <main> de la home reste dans le DOM cote SSR : l'overlay vient PAR-DESSUS.
 *  - z-index 200, fixed inset-0 — n'affecte pas le LCP du contenu reel.
 *
 * Tokens utilises (Tailwind config.ts) :
 *  - couleurs : bgdark-ink, ink, ink-2, ink-3, accent, electric, electric-2, mint, violet
 *  - polices : font-syne (wordmark), font-manrope (textes)
 *
 * Les animations specifiques de l'intro (spark / letter / fade-up / chip-in / prog / intro-grid)
 * sont injectees inline via <style jsx global> avec un prefixe `intro-` pour eviter toute
 * collision avec d'autres pages.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

// Cle de persistance — lecture unique par session navigateur.
const STORAGE_KEY = 'nexartis_intro_seen'

// Duree totale de la timeline (doit matcher l'animation de la progress-bar).
const INTRO_DURATION_MS = 4300

// Duree du fondu de sortie (doit matcher la transition CSS de .intro-overlay.hide).
const EXIT_DURATION_MS = 800

// Chips en orbite autour du wordmark — positionnees en % sur le viewport.
// Couleurs : tokens Tailwind landing (accent / electric / violet / mint).
const CHIPS: Array<{ label: string; color: string; x: string; y: string; delay: number }> = [
  { label: 'Devis',    color: 'var(--intro-accent)',   x: '16%', y: '26%', delay: 0 },
  { label: 'Mobile',   color: 'var(--intro-electric)', x: '50%', y: '15%', delay: 0.1 },
  { label: 'Factures', color: 'var(--intro-electric)', x: '78%', y: '20%', delay: 0.2 },
  { label: 'Planning', color: 'var(--intro-violet)',   x: '12%', y: '70%', delay: 0.3 },
  { label: 'Suivi CA', color: 'var(--intro-mint)',     x: '82%', y: '72%', delay: 0.4 },
]

export default function IntroOverlay() {
  // hydrated : true uniquement cote client apres montage React.
  //  -> SSR retourne null (pas d'overlay dans le HTML envoye au navigateur).
  const [hydrated, setHydrated] = useState(false)

  // visible : controle l'affichage de l'overlay. False si deja vu OU si reduce-motion.
  const [visible, setVisible] = useState(false)

  // exiting : true pendant le fondu de sortie (0,8s). Permet d'appliquer la classe `.hide`.
  const [exiting, setExiting] = useState(false)

  // playKey : change a chaque replay pour forcer le redemarrage des animations CSS.
  const [playKey, setPlayKey] = useState(0)

  // Refs pour le bouton skip (focus initial) et l'overlay (focus trap).
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const skipButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Timers — nettoyes a chaque demontage / replay.
  const endTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)

  /**
   * Termine l'intro : fondu de sortie + persiste l'etat "vu" + restore focus.
   * Idempotent (ne refait rien si deja en cours de sortie).
   */
  const endIntro = useCallback(() => {
    setExiting((alreadyExiting) => {
      if (alreadyExiting) return true
      // Persiste la lecture pour la session courante.
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // sessionStorage peut etre indispo (mode prive Safari, iframes sandboxees).
      }
      // Apres 800 ms (fin du fondu) on demonte l'overlay.
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = window.setTimeout(() => {
        setVisible(false)
        setExiting(false)
        // Restaure le focus sur l'element initialement focus (CTA Hero generalement).
        const target = previouslyFocusedRef.current
        if (target && typeof target.focus === 'function') {
          target.focus()
        }
        // Debloque le scroll body au cas ou.
        if (typeof document !== 'undefined') {
          document.body.classList.remove('intro-lock')
        }
      }, EXIT_DURATION_MS)
      return true
    })
  }, [])

  /**
   * Lance l'intro : prepare l'etat + planifie la sortie automatique a 4300 ms.
   */
  const playIntro = useCallback(() => {
    // Reset timers eventuels.
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current)
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    setExiting(false)
    setVisible(true)
    setPlayKey((k) => k + 1)
    if (typeof document !== 'undefined') {
      document.body.classList.add('intro-lock')
    }
    // Fin automatique apres la timeline.
    endTimerRef.current = window.setTimeout(() => {
      endIntro()
    }, INTRO_DURATION_MS)
  }, [endIntro])

  // Effet d'hydratation : decide d'afficher ou non l'overlay.
  useEffect(() => {
    setHydrated(true)

    // Capture le focus actuel pour le restaurer apres l'intro.
    if (typeof document !== 'undefined') {
      previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null
    }

    // prefers-reduced-motion : on saute l'intro completement.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Deja vue pendant la session ?
    let alreadySeen = false
    try {
      alreadySeen = sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      alreadySeen = false
    }

    if (prefersReduced || alreadySeen) {
      // Skip integral, on ne monte rien.
      setVisible(false)
    } else {
      playIntro()
    }

    // Expose la fonction de replay sur window (utilisable par le bouton "Revoir l'intro" du Nav).
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __nexartisReplayIntro?: () => void }).__nexartisReplayIntro = () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY)
        } catch {
          // ignore
        }
        // Reset complet puis relance.
        setExiting(false)
        playIntro()
      }
    }

    // Cleanup au demontage.
    return () => {
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current)
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
      if (typeof document !== 'undefined') {
        document.body.classList.remove('intro-lock')
      }
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __nexartisReplayIntro?: () => void }).__nexartisReplayIntro
      }
    }
  }, [playIntro])

  // Focus trap : pendant que l'overlay est visible, on capture Tab dans le bouton skip.
  useEffect(() => {
    if (!visible) return

    // Focus initial sur le bouton skip pour permettre Enter/Space immediat.
    skipButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        endIntro()
        return
      }
      if (event.key === 'Tab') {
        // Un seul focusable -> on garde le focus dessus.
        event.preventDefault()
        skipButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, endIntro])

  // SSR : on ne rend rien avant hydratation. Le contenu reel de la home prend
  // le LCP, l'overlay est greffe ensuite cote client.
  if (!hydrated) return null
  if (!visible) return null

  return (
    <>
      {/*
        Styles inline scoped a l'overlay. Toutes les classes sont prefixees `intro-`
        pour eviter toute collision avec d'autres composants de la landing.
      */}
      <style jsx global>{`
        /* Variables pour les couleurs des chips — tokens reels du tailwind config */
        .intro-overlay {
          --intro-bg: #04060d;
          --intro-ink: #eaf0ff;
          --intro-ink-2: #aab4d4;
          --intro-ink-3: #76819f;
          --intro-accent: #ff7a1a;
          --intro-accent-2: #ff9d4d;
          --intro-electric: #3f7bff;
          --intro-electric-2: #6aa0ff;
          --intro-mint: #2fd6a0;
          --intro-violet: #8b6dff;
          --intro-stroke: rgba(255, 255, 255, 0.08);
          --intro-stroke-2: rgba(255, 255, 255, 0.16);
          --intro-bg-3: #0d1428;
          --intro-ease: cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* Empeche le scroll de la page pendant l'intro */
        body.intro-lock {
          overflow: hidden;
        }

        /* Overlay racine — fondu de sortie via classe .hide */
        .intro-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: var(--intro-bg);
          display: grid;
          place-items: center;
          overflow: hidden;
          transition:
            opacity 0.8s var(--intro-ease),
            transform 0.8s var(--intro-ease);
          opacity: 1;
          transform: none;
        }
        .intro-overlay.intro-hide {
          opacity: 0;
          transform: scale(1.06);
          pointer-events: none;
        }

        /* Grille subtile en arriere-plan */
        .intro-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 54px 54px;
          mask-image: radial-gradient(circle at 50% 50%, #000, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, #000, transparent 70%);
          opacity: 0;
          animation: intro-grid 4s var(--intro-ease) forwards;
          animation-delay: 0s;
        }
        @keyframes intro-grid {
          0% { opacity: 0; }
          25% { opacity: 0.6; }
          100% { opacity: 0.15; }
        }

        /* Coeur central : spark + wordmark + tagline */
        .intro-core {
          position: relative;
          text-align: center;
          z-index: 2;
        }

        /* Spark (cercle qui scale-up + glow) — t = 200ms */
        .intro-spark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 40px 10px var(--intro-electric);
          animation: intro-spark 1.3s var(--intro-ease) forwards;
          animation-delay: 0.2s;
          opacity: 0;
        }
        @keyframes intro-spark {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          18% { opacity: 1; }
          70% {
            width: 520px;
            height: 520px;
            opacity: 0.18;
            box-shadow: 0 0 80px 20px var(--intro-electric);
          }
          100% {
            width: 760px;
            height: 760px;
            opacity: 0;
          }
        }

        /* Logo image animé — fade-in + scale-up, t = 700ms (version LIGHT sur fond sombre) */
        .intro-logo {
          display: block;
          margin: 0 auto;
          width: clamp(320px, 70vw, 720px);
          height: auto;
          opacity: 0;
          transform: scale(0.78);
          filter: drop-shadow(0 18px 60px rgba(255, 122, 26, 0.35));
          animation: intro-logo-in 1.1s var(--intro-ease) forwards;
          animation-delay: 0.7s;
        }
        @keyframes intro-logo-in {
          0%   { opacity: 0; transform: scale(0.78); }
          55%  { opacity: 1; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* Tagline — t = 2000ms */
        .intro-tag {
          margin-top: 18px;
          color: var(--intro-ink-2);
          font-family: 'Manrope', sans-serif;
          font-size: clamp(15px, 2vw, 21px);
          font-weight: 600;
          opacity: 0;
          animation: intro-fade-up 0.8s var(--intro-ease) forwards;
          animation-delay: 2s;
        }
        .intro-tag b {
          color: var(--intro-ink);
        }
        @keyframes intro-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: none; }
        }

        /* Chips en orbite — t = 2500ms (+ stagger 100ms par chip) */
        .intro-chips {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .intro-chip {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--intro-bg-3) 80%, transparent);
          border: 1px solid var(--intro-stroke-2);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-family: 'Manrope', sans-serif;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--intro-ink);
          opacity: 0;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
          transform: translate(-50%, -50%);
          animation: intro-chip-in 0.7s var(--intro-ease) forwards;
        }
        .intro-chip .intro-chip-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 12px currentColor;
        }
        @keyframes intro-chip-in {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6) translateY(20px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) translateY(0); }
        }

        /* Bouton skip — bas droite */
        .intro-skip {
          position: absolute;
          bottom: 32px;
          right: 32px;
          z-index: 3;
          color: var(--intro-ink-3);
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          font-weight: 600;
          background: transparent;
          border: 1px solid var(--intro-stroke);
          padding: 9px 16px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: color 0.2s ease, border-color 0.2s ease;
        }
        .intro-skip:hover,
        .intro-skip:focus-visible {
          color: var(--intro-ink);
          border-color: var(--intro-stroke-2);
          outline: none;
        }

        /* Barre de progression — bas gauche */
        .intro-prog {
          position: absolute;
          bottom: 34px;
          left: 32px;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--intro-ink-3);
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 600;
        }
        .intro-prog .intro-prog-bar {
          width: 120px;
          height: 3px;
          border-radius: 3px;
          background: var(--intro-stroke);
          overflow: hidden;
        }
        .intro-prog .intro-prog-fill {
          display: block;
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, var(--intro-electric), var(--intro-accent));
          transform-origin: left center;
          transform: scaleX(0);
          animation: intro-prog 4.3s linear forwards;
        }
        @keyframes intro-prog {
          to { transform: scaleX(1); }
        }

        /* Mobile : on resserre les marges des controles bas */
        @media (max-width: 640px) {
          .intro-skip { bottom: 20px; right: 16px; padding: 8px 12px; font-size: 12px; }
          .intro-prog { bottom: 22px; left: 16px; }
          .intro-prog .intro-prog-bar { width: 90px; }
        }
      `}</style>

      <div
        ref={overlayRef}
        // key sur playKey -> demonte/remonte le DOM lors d'un replay, redemarre les animations CSS.
        key={playKey}
        className={`intro-overlay ${exiting ? 'intro-hide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Animation d'introduction Nexartis"
      >
        {/* Grille subtile de fond */}
        <div className="intro-grid-bg" aria-hidden="true" />

        {/* Chips en orbite (5 produits) */}
        <div className="intro-chips" aria-hidden="true">
          {CHIPS.map((chip) => (
            <span
              key={chip.label}
              className="intro-chip"
              style={{
                left: chip.x,
                top: chip.y,
                // Delai = 2500ms (chips) + stagger propre a chaque chip.
                animationDelay: `${2.5 + chip.delay}s`,
              }}
            >
              <span className="intro-chip-dot" style={{ color: chip.color }} aria-hidden="true" />
              {chip.label}
            </span>
          ))}
        </div>

        {/* Coeur central : spark + logo image (next/image -> WebP/AVIF auto) + tagline */}
        <div className="intro-core">
          <div className="intro-spark" aria-hidden="true" />
          <Image
            src="/images/logo-nexartis-light.png"
            alt="Nexartis"
            className="intro-logo"
            width={1600}
            height={800}
            priority
            sizes="(max-width: 640px) 75vw, (max-width: 1280px) 60vw, 720px"
            quality={88}
          />
          <p className="intro-tag">
            Tous vos outils artisan. <b>Un seul prix.</b>
          </p>
        </div>

        {/* Barre de progression (bas gauche) */}
        <div className="intro-prog" aria-hidden="true">
          <span>Chargement</span>
          <span className="intro-prog-bar">
            <i className="intro-prog-fill" />
          </span>
        </div>

        {/* Bouton skip (bas droite) — focusable, raccourci Escape egalement gere */}
        <button
          ref={skipButtonRef}
          type="button"
          className="intro-skip"
          onClick={endIntro}
          aria-label="Passer l'animation d'introduction"
        >
          Passer l&apos;intro
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path d="M5 5l7 7-7 7M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  )
}
