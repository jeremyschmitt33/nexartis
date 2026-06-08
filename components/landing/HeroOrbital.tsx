'use client'

/**
 * V4 (2026-06-08) — Hero refondu "Scène orbitale" pour la landing.
 *
 * Direction : dark premium SaaS fintech.
 * Cf design handoff : Downloads/landing page nexartis/design_handoff_nexartis_home/
 *
 * Composé de :
 *   - Texte centré (eyebrow, H1, sous-titre, 2 CTAs, note)
 *   - Scène orbitale : mockup téléphone central flottant + plateforme
 *     elliptique lumineuse + 2 anneaux pointillés rotatifs +
 *     4 chips flottantes reliées par traits pointillés.
 *   - Parallaxe souris desktop (>= 980px), respecté prefers-reduced-motion.
 *
 * IMPORTANT — Anti-mensonge : tous les textes ont été ajustés pour ne
 * pas faire de promesses fausses (cf audit anti-mensonge 2026-06-08).
 * "Prêt pour Factur-X 2026" au lieu de "Certifié Factur-X 2026".
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'

interface Chip {
  label: string
  sublabel: string
  dotColor: string
  /** Position cible (translate) en pixels par rapport au centre du téléphone. */
  x: number
  y: number
  /** Délai d'apparition reveal (s). */
  delay: number
}

const CHIPS: Chip[] = [
  { label: 'Devis signé', sublabel: 'M. Dupont',     dotColor: 'var(--mint)',      x: -200, y: -110, delay: 0.2 },
  { label: 'Alerte conflit', sublabel: 'Jeudi matin', dotColor: 'var(--accent)',    x:  210, y: -130, delay: 0.4 },
  { label: '6 620 € facturé', sublabel: 'Ce mois',   dotColor: 'var(--electric)',  x: -220, y:  130, delay: 0.6 },
  { label: 'Relance auto', sublabel: 'F-2026-014',   dotColor: 'var(--landing-violet)', x:  210, y:  150, delay: 0.8 },
]

export default function HeroOrbital() {
  const stageRef = useRef<HTMLDivElement>(null)

  // Parallaxe souris desktop (>= 980px). Désactivé si reduced-motion.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.innerWidth < 980) return

    let raf = 0
    const handle = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window
        const dx = (e.clientX - innerWidth / 2) / innerWidth
        const dy = (e.clientY - innerHeight / 2) / innerHeight
        // Les chips bougent plus fort que le téléphone (effet profondeur).
        stage.style.setProperty('--mx', String(dx))
        stage.style.setProperty('--my', String(dy))
      })
    }
    window.addEventListener('pointermove', handle)
    return () => {
      window.removeEventListener('pointermove', handle)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section className="landing-section pt-28 pb-24 px-5 sm:px-7 lg:px-10">
      {/* Bloc texte centré */}
      <div className="mx-auto max-w-3xl text-center relative z-10">
        <div className="reveal landing-eyebrow mb-7">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Conçu en Gironde · Pour les artisans de toute la France
        </div>

        <h1
          className="reveal reveal-delay-1 font-hanken font-extrabold tracking-[-0.035em] leading-[1.04] text-ink"
          style={{ fontSize: 'clamp(40px, 6.4vw, 76px)' }}
        >
          Tous vos outils artisan.
          <br />
          <span className="landing-text-grad">Un seul prix.</span>
          <br />
          <span className="text-accent-2 font-spline-mono tracking-tight">25€/mois.</span>
        </h1>

        <p className="reveal reveal-delay-2 mt-7 mx-auto max-w-[560px] text-[17px] sm:text-[18px] text-ink-2 leading-[1.55]">
          Devis, factures, planning et suivi financier — réunis dans une seule application,
          pensée pour tous les artisans.
        </p>

        <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3.5 justify-center items-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 h-[52px] px-7 rounded-[14px] font-hanken font-bold text-[15px] text-bgdark-ink bg-gradient-to-br from-accent-2 to-accent shadow-[0_8px_30px_color-mix(in_srgb,var(--accent)_45%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_color-mix(in_srgb,var(--accent)_55%,transparent)] transition-all duration-300"
          >
            Essayer gratuitement 14 jours
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link
            href="#planning"
            className="inline-flex items-center gap-2 h-[52px] px-6 rounded-[14px] font-hanken font-semibold text-[14px] text-ink bg-white/[0.04] border border-white/[0.16] backdrop-blur-[10px] hover:bg-white/[0.08] hover:border-white/[0.24] transition-all duration-300"
          >
            Voir le planning intelligent
          </Link>
        </div>

        <p className="reveal reveal-delay-4 mt-5 text-[13px] text-ink-3 font-medium">
          Sans carte bancaire · Sans engagement · Prêt en 10 minutes
        </p>
      </div>

      {/* Scène orbitale */}
      <div
        ref={stageRef}
        className="reveal reveal-delay-3 relative mx-auto mt-16 sm:mt-20 w-full max-w-[820px] aspect-[820/520] [--mx:0] [--my:0]"
        aria-hidden="true"
      >
        {/* Plateforme elliptique lumineuse (sous le téléphone) */}
        <div
          className="absolute left-1/2 bottom-[18%] -translate-x-1/2 w-[440px] max-w-[80%] h-[90px] rounded-[50%]"
          style={{
            background: 'radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--electric) 35%, transparent), transparent 70%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Anneau pointillé 1 (lent) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[88%] aspect-square rounded-full border border-dashed border-white/[0.10] animate-spin-slow" />
        {/* Anneau pointillé 2 (inversé, plus large) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] max-w-[105%] aspect-square rounded-full border border-dashed border-white/[0.06] animate-spin-slow-reverse" />

        {/* Téléphone mockup central */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[262px] h-[540px] max-w-[60vw] animate-float-y"
          style={{
            translate: 'calc(var(--mx) * -10px) calc(var(--my) * -10px)',
            transition: 'translate 0.3s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          <div className="relative w-full h-full rounded-[42px] bg-gradient-to-b from-bgdark-2 to-bgdark-3 border border-white/[0.10] shadow-[0_30px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">
            {/* Bandeau notch */}
            <div className="h-12 bg-bgdark-ink/40 flex items-center justify-between px-6">
              <span className="text-[10px] text-ink-3 font-spline-mono">9:41</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full border border-ink-3/40" />
                <div className="w-3 h-3 rounded-full border border-ink-3/40" />
              </div>
            </div>
            {/* Contenu mini-dashboard */}
            <div className="p-5 space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mb-2" />
                  <div className="text-[18px] font-hanken font-extrabold text-ink tabular-nums tracking-tight">6 620&nbsp;€</div>
                  <div className="text-[9px] text-ink-3 font-semibold mt-0.5 uppercase tracking-wider">CA Facturé</div>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-mint mb-2" />
                  <div className="text-[18px] font-hanken font-extrabold text-ink tabular-nums tracking-tight">2 110&nbsp;€</div>
                  <div className="text-[9px] text-ink-3 font-semibold mt-0.5 uppercase tracking-wider">Encaissé</div>
                </div>
              </div>
              {/* Planning semaine */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
                <div className="text-[10px] text-ink-3 font-semibold mb-2 uppercase tracking-wider">Planning</div>
                {[
                  { col: 'var(--electric)', t: 'Installation tableau', s: 'Lun · 08:30' },
                  { col: 'var(--accent)',   t: 'Rénovation cuisine',   s: 'Jeu · 09:00' },
                  { col: 'var(--mint)',     t: 'Pose carrelage',       s: 'Ven · 14:00' },
                ].map((r) => (
                  <div key={r.t} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-0.5 h-7 rounded-full" style={{ background: r.col }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-ink truncate">{r.t}</div>
                      <div className="text-[9px] text-ink-3 font-medium font-spline-mono">{r.s}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* CTA + Nouveau devis */}
              <button
                className="w-full h-10 rounded-[12px] font-hanken font-bold text-[12px] bg-gradient-to-br from-accent-2 to-accent text-bgdark-ink shadow-[0_6px_20px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
                tabIndex={-1}
              >
                + Nouveau devis
              </button>
            </div>
          </div>
        </div>

        {/* 4 chips flottantes orbitales */}
        {CHIPS.map((chip) => (
          <div
            key={chip.label}
            className="absolute left-1/2 top-1/2 reveal animate-float-y"
            style={{
              translate: `calc(${chip.x}px + var(--mx) * 30px) calc(${chip.y}px + var(--my) * 30px)`,
              transition: 'translate 0.4s cubic-bezier(.22,.61,.36,1)',
              animationDelay: `${chip.delay}s`,
              transitionDelay: `${chip.delay}s`,
            }}
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] bg-bgdark-2/85 border border-white/[0.12] backdrop-blur-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              <div className="w-2 h-2 rounded-full" style={{ background: chip.dotColor, boxShadow: `0 0 12px ${chip.dotColor}` }} />
              <div className="text-left">
                <div className="text-[11px] font-hanken font-bold text-ink leading-none">{chip.label}</div>
                <div className="text-[9px] text-ink-3 font-medium font-spline-mono mt-1 leading-none">{chip.sublabel}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
