'use client';

/**
 * LandingNav — navigation dark spécifique à la landing nexartis.fr (V4).
 *
 * Différences vs <Header /> (marketing pages classiques) :
 *  - Fond TRANSPARENT au top, devient bg-bgdark/78 + blur au scroll > 24px.
 *  - Palette dark (ink / ink-2 / electric / accent) au lieu de navy/orange clair.
 *  - 4 ancres internes (#fonctionnalites, #planning, #tarifs, #faq) au lieu de
 *    routes Next, parce que la landing est une mono-page scrollée.
 *  - Bouton "Revoir l'intro" qui rappelle l'overlay (window.__nexartisReplayIntro).
 *  - z-[100] pour rester sous l'intro overlay (z-200) mais au-dessus du contenu.
 *
 * Ce composant N'EST PAS injecté par <ConditionalLayout> : il est rendu
 * directement par app/page.tsx (la home), pour ne pas polluer les autres pages.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import InstallPrompt from '@/components/InstallPrompt';

// Augmentation TypeScript pour exposer la fonction globale de replay.
// L'IntroOverlay l'attache à window quand il monte ; on l'appelle au click.
declare global {
  interface Window {
    __nexartisReplayIntro?: () => void;
  }
}

const NAV_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#planning', label: 'Planning' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
] as const;

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auth-aware : on bascule "Se connecter / Essai gratuit" vers "Mon espace"
  // si l'utilisateur a déjà une session Supabase. Pattern repris de Header.tsx.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        setIsLoggedIn(!!user);
      });
  }, []);

  // Scroll state : seuil à 24px (cf. app.js de la maquette).
  // passive:true pour ne pas bloquer le scroll sur mobile.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll(); // initial state (cas où on arrive avec un hash et déjà scrollé)
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleReplayIntro = () => {
    // Si l'IntroOverlay n'est pas monté (déjà skippé/jamais affiché), on no-op.
    // Optional chaining → safe même si la fonction n'a jamais été enregistrée.
    window.__nexartisReplayIntro?.();
  };

  // Drawer mobile — fermeture sur Escape + lock body scroll quand ouvert.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isMenuOpen]);

  // Helper : fermer le drawer (utilisé par tous les liens internes du drawer
  // pour que le scroll vers l'ancre se fasse sans drawer ouvert).
  const closeMenu = () => setIsMenuOpen(false);

  const handleMobileReplayIntro = () => {
    closeMenu();
    // Petit délai pour que le drawer ferme avant l'overlay intro.
    window.setTimeout(() => {
      window.__nexartisReplayIntro?.();
    }, 220);
  };

  return (
    <nav
      className={[
        'fixed top-0 left-0 right-0 z-[100]',
        'transition-[background-color,border-color,padding,backdrop-filter] duration-200 ease-out',
        scrolled
          ? 'bg-bgdark/[0.78] backdrop-blur-[18px] border-b border-white/[0.06] py-2.5'
          : 'bg-transparent border-b border-transparent py-[14px]',
      ].join(' ')}
      aria-label="Navigation principale"
    >
      <div className="max-w-container mx-auto px-7 flex items-center gap-6">
        {/* ---------------- Brand : logo + wordmark ---------------- */}
        <Link
          href="/"
          className="flex items-center gap-[11px] font-hanken font-bold text-[20px] tracking-[-0.02em] text-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgdark rounded-lg"
        >
          {/* Logo officiel en PNG. On garde un alt explicite pour le SEO/a11y. */}
          <Image
            src="/images/logo-nexartis.png"
            alt="Nexartis"
            width={48}
            height={48}
            priority
            quality={100}
            className="h-12 w-12 object-contain rounded-[10px]"
          />
          <span>Nexartis</span>
        </Link>

        {/* ---------------- Liens centraux (lg+) ---------------- */}
        <div className="hidden lg:flex items-center gap-1 ml-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-ink-2 hover:text-ink hover:bg-white/[0.04] font-semibold text-[14.5px] px-[14px] py-[9px] rounded-[10px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* ---------------- Actions droite ---------------- */}
        <div className="ml-auto flex items-center gap-[10px]">
          {/* "Revoir l'intro" — lg+ uniquement, ne s'affiche que pour les
              visiteurs nouveaux/curieux. Inutile pour les users connectés ? On
              le laisse quand même : la home reste accessible aux users connectés. */}
          <button
            type="button"
            onClick={handleReplayIntro}
            className="hidden lg:inline-flex items-center gap-[7px] text-ink-3 hover:text-ink text-[13px] font-semibold px-3 py-2 rounded-[10px] border border-white/[0.08] hover:border-white/[0.16] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60"
            aria-label="Revoir l'intro animée"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Revoir l&apos;intro
          </button>

          {/* "Installer l'app" — visible lg+ uniquement quand le navigateur
              a émis beforeinstallprompt (Chrome/Edge). Le composant gère
              lui-même son affichage (null si déjà installé, refusé, ou non
              supporté côté navigateur — Firefox/Safari iOS). */}
          <div className="hidden lg:inline-flex">
            <InstallPrompt />
          </div>

          {/* "Se connecter" / "Mon espace" — texte simple, lg+ uniquement.
              Sur mobile on garde uniquement le CTA principal pour éviter
              l'encombrement (le burger menu sera ajouté plus tard). */}
          <Link
            href={isLoggedIn ? '/dashboard' : '/login'}
            className="hidden lg:inline-flex items-center text-ink-2 hover:text-ink font-semibold text-[14.5px] px-3 py-[9px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60 rounded-[10px]"
          >
            {isLoggedIn ? 'Mon espace' : 'Se connecter'}
          </Link>

          {/* CTA principal — gradient accent → accent-2 + glow.
              Toujours visible (y compris mobile).
              V2 (09/06/2026) : taille reduite sur mobile (Jerem trouvait le
              bouton "Mon espace" trop gros sur tel — debordait de la ligne).
              Mobile <sm  : padding 3/1.5 + texte 12.5px
              Tablet sm+   : padding 5/3 + texte 14.5px (taille d'origine). */}
          <Link
            href={isLoggedIn ? '/dashboard' : '/register'}
            className="inline-flex items-center bg-gradient-to-br from-accent-2 to-accent text-white font-bold text-[12.5px] sm:text-[14.5px] px-3 sm:px-5 py-1.5 sm:py-3 rounded-[10px] sm:rounded-[13px] shadow-[0_8px_24px_-8px_rgba(255,122,26,0.55)] hover:shadow-[0_12px_32px_-8px_rgba(255,122,26,0.75)] hover:brightness-110 transition-[box-shadow,filter,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgdark whitespace-nowrap"
          >
            {isLoggedIn ? 'Mon espace' : 'Essai gratuit'}
          </Link>

          {/* Icône Install pour mobile uniquement — visible juste à gauche du burger.
              Le composant gère lui-même son affichage (null si non supporté,
              déjà installée ou refusée < 7j). Touch target 44x44 standard. */}
          <div className="lg:hidden">
            <InstallPrompt iconOnly />
          </div>

          {/* ---------------- Bouton burger (<lg) ---------------- */}
          {/* Icône 3 lignes -> croix quand ouvert. Animation via SVG paths. */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-[10px] border border-white/[0.08] hover:border-white/[0.16] text-ink-2 hover:text-ink transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgdark"
            aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isMenuOpen}
            aria-controls="landing-mobile-drawer"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isMenuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ---------------- Drawer mobile plein écran ---------------- */}
      {/* z-[120] : au-dessus de la nav (z-100) mais sous l'intro overlay (z-200/150). */}
      {/* Backdrop cliquable + panneau qui slide depuis le haut. */}
      <div
        id="landing-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        className={[
          'lg:hidden fixed inset-0 z-[120]',
          'transition-opacity duration-300 ease-out',
          isMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {/* Backdrop */}
        <div
          onClick={closeMenu}
          className="absolute inset-0 bg-bgdark/70 backdrop-blur-[6px]"
          aria-hidden="true"
        />

        {/* Panneau drawer */}
        <div
          className={[
            'absolute top-0 left-0 right-0',
            'bg-bgdark-2/95 backdrop-blur-[20px]',
            'border-b border-white/[0.08]',
            'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)]',
            'transition-transform duration-300 ease-out',
            'max-h-[100dvh] overflow-y-auto',
            'pt-[80px] pb-8 px-6',
            isMenuOpen ? 'translate-y-0' : '-translate-y-full',
          ].join(' ')}
        >
          <div className="max-w-container mx-auto flex flex-col gap-2">
            {/* Ancres principales — grosse typo */}
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="block text-ink hover:text-white font-bold text-[22px] tracking-[-0.01em] px-3 py-3.5 rounded-[12px] hover:bg-white/[0.04] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60"
              >
                {link.label}
              </a>
            ))}

            {/* Séparateur */}
            <div className="my-3 h-px bg-white/[0.08]" />

            {/* Installer l'app — drawer mobile. Comme sur desktop, le composant
                gère son affichage (null si non supporté). On l'enveloppe d'un
                wrapper qui ferme le drawer au clic via onClick capture. */}
            <div onClick={closeMenu} className="flex justify-start">
              <InstallPrompt />
            </div>

            {/* Revoir l'intro — secondaire */}
            <button
              type="button"
              onClick={handleMobileReplayIntro}
              className="flex items-center gap-2.5 text-ink-2 hover:text-ink font-semibold text-[15px] px-3 py-3 rounded-[12px] hover:bg-white/[0.04] transition-colors duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Revoir l&apos;intro
            </button>

            {/* Se connecter / Mon espace — secondaire */}
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              onClick={closeMenu}
              className="block text-ink-2 hover:text-ink font-semibold text-[15px] px-3 py-3 rounded-[12px] hover:bg-white/[0.04] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60"
            >
              {isLoggedIn ? 'Mon espace' : 'Se connecter'}
            </Link>

            {/* CTA principal — gradient */}
            <Link
              href={isLoggedIn ? '/dashboard' : '/register'}
              onClick={closeMenu}
              className="mt-4 inline-flex items-center justify-center bg-gradient-to-br from-accent-2 to-accent text-white font-bold text-[15px] px-5 py-3.5 rounded-[13px] shadow-[0_8px_24px_-8px_rgba(255,122,26,0.55)] hover:shadow-[0_12px_32px_-8px_rgba(255,122,26,0.75)] hover:brightness-110 transition-[box-shadow,filter,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgdark"
            >
              {isLoggedIn ? 'Mon espace' : 'Essai gratuit'}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
