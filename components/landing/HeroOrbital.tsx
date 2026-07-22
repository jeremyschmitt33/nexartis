'use client'

// V5 (2026-06-08) - Refonte Hero scene orbitale split (corrigee NULs).
// Layout split desktop (texte gauche, scene droite). Mobile : empile.
// 4 chips orbitales autour du telephone central + 2 anneaux rotatifs.
// Parallaxe souris >= 980px, garde-fous prefers-reduced-motion.
// Anti-mensonge : tous textes valides par jerem.

import { useEffect, useRef } from 'react'
import Link from 'next/link'

// CHIPS

interface Chip {
  label: string
  sublabel: string
  dotColor: string
  corner: 'tl' | 'tr' | 'bl' | 'br'
  offsetX: number
  offsetY: number
  delay: number
  alert?: boolean
}

const CHIPS: Chip[] = [
  { label: 'Devis signé',     sublabel: 'M. Dupont - 2 480 EUR',         dotColor: 'var(--mint)',    corner: 'tl', offsetX: 0, offsetY: 10, delay: 0.20 },
  { label: 'Alerte conflit',  sublabel: 'Michel R. déjà affecté jeudi',  dotColor: 'var(--accent)',  corner: 'tr', offsetX: 0, offsetY: 60, delay: 0.40, alert: true },
  { label: '6 620 EUR facturé', sublabel: 'Ce mois-ci - +18%',           dotColor: 'var(--electric)', corner: 'bl', offsetX: 0, offsetY: 60, delay: 0.60 },
  { label: 'Relance impayés', sublabel: 'Rappel envoyé en 1 clic',       dotColor: 'var(--violet)',   corner: 'br', offsetX: 0, offsetY: 10, delay: 0.80 },
]

function chipPositionClasses(corner: Chip['corner']): string {
  switch (corner) {
    // Positions ajustees 2026-06-09 (fix mobile) :
    // - MOBILE (<640px) : pourcentages POSITIFS pour rester DANS le cadre
    //   du conteneur scene (combine a overflow-hidden plus bas). Evite que
    //   les chips ne sortent de l'ecran a 375px (iPhone SE).
    // - DESKTOP (sm: et +) : pourcentages NEGATIFS conserves pour l'effet
    //   "orbital" qui depasse autour du telephone.
    case 'tl': return 'top-[2%] left-[2%] sm:left-[-14%]'
    case 'tr': return 'top-[14%] right-[2%] sm:right-[-14%]'
    case 'bl': return 'bottom-[24%] left-[2%] sm:left-[-16%]'
    case 'br': return 'bottom-[10%] right-[2%] sm:right-[-14%]'
  }
}

function chipParallaxSign(corner: Chip['corner']): { sx: number; sy: number } {
  switch (corner) {
    case 'tl': return { sx: -1, sy: -1 }
    case 'tr': return { sx:  1, sy: -1 }
    case 'bl': return { sx: -1, sy:  1 }
    case 'br': return { sx:  1, sy:  1 }
  }
}

// COMPONENT

export default function HeroOrbital() {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.innerWidth < 980) return

    let raf = 0
    const handlePointer = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window
        const dx = (e.clientX - innerWidth / 2) / innerWidth
        const dy = (e.clientY - innerHeight / 2) / innerHeight
        stage.style.setProperty('--mx', String(dx))
        stage.style.setProperty('--my', String(dy))
      })
    }

    window.addEventListener('pointermove', handlePointer, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointer)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section className="landing-section relative pt-28 lg:pt-32 pb-16 lg:pb-20 px-5 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-container grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-[60px] items-center">

        {/* COLONNE 1 - TEXTE */}
        <div className="text-center lg:text-left relative z-10">

          <div className="reveal mb-6 lg:mb-7 inline-flex">
            <span className="landing-eyebrow landing-eyebrow--accent">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent"
                style={{ boxShadow: '0 0 10px var(--accent)' }}
                aria-hidden="true"
              />
              Conçu en Gironde - Pour les artisans de toute la France
            </span>
          </div>

          <h1
            className="reveal reveal-delay-1 font-hanken font-extrabold tracking-[-0.035em] leading-[1.04] text-ink"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            Tous vos outils artisan.
            <br />
            <span className="landing-text-grad">Une seule appli.</span>{' '}
            <span className="text-accent-2 font-spline-mono tracking-tight whitespace-nowrap">
              Dès 15€/mois.
            </span>
          </h1>

          <p className="reveal reveal-delay-2 mt-5 lg:mt-6 mx-auto lg:mx-0 max-w-[560px] text-[16px] sm:text-[17px] lg:text-[18px] text-ink-2 leading-[1.55]">
            Devis, factures, planning et suivi financier - réunis dans une seule application,
            pensée pour tous les artisans.
          </p>

          <div className="reveal reveal-delay-3 mt-7 lg:mt-8 flex flex-wrap gap-3 justify-center lg:justify-start items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-[52px] px-6 lg:px-7 rounded-[14px] font-hanken font-bold text-[15px] text-bgdark-ink bg-gradient-to-br from-accent-2 to-accent shadow-[0_8px_30px_color-mix(in_srgb,var(--accent)_45%,transparent),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_44px_color-mix(in_srgb,var(--accent)_60%,transparent),inset_0_1px_0_rgba(255,255,255,0.5)] transition-all duration-300"
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

          <p className="reveal reveal-delay-4 mt-4 lg:mt-5 text-[13px] text-ink-3 font-medium">
            Sans carte bancaire <span className="opacity-40 mx-1">-</span>
            Sans engagement <span className="opacity-40 mx-1">-</span>
            Prêt en 10 minutes
          </p>
        </div>

        {/* COLONNE 2 - SCENE ORBITALE */}
        {/*
          Fix mobile 2026-06-09 :
          - overflow-hidden : empeche les chips et anneaux orbitaux de deborder
            sur les cotes a 375px (iPhone SE) une fois passes en positions positives.
          - h-[420px] (mobile) : hauteur reduite pour que le mockup ne chevauche
            plus la TrustBar qui suit dans le flow. Desktop inchange.
        */}
        <div
          ref={stageRef}
          className="reveal reveal-delay-3 relative w-full mx-auto h-[460px] sm:h-[540px] lg:h-[620px] max-w-[560px] overflow-hidden sm:overflow-visible [--mx:0] [--my:0]"
          style={{ '--mx': 0, '--my': 0 } as React.CSSProperties}
          aria-hidden="true"
        >
          {/* Plateforme elliptique */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[8%] w-[420px] max-w-[90%] h-[140px] rounded-[50%] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--electric) 32%, transparent), transparent 70%)',
              filter: 'blur(20px)',
              opacity: 0.8,
            }}
          />

          {/* Anneau 1 - cache sur mobile (overflow-hidden l'aurait clippe de toute facon,
              et a 375px il prendrait toute la largeur ecran sans valeur ajoutee visuelle). */}
          <div
            className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[105%] aspect-square rounded-full border border-dashed border-white/[0.10] animate-spin-slow pointer-events-none"
            aria-hidden="true"
          />
          {/* Anneau 2 - meme logique, reserve au desktop ou il a l'espace de respirer. */}
          <div
            className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] max-w-[130%] aspect-square rounded-full border border-dashed border-white/[0.06] animate-spin-slow-reverse pointer-events-none"
            aria-hidden="true"
          />

          {/* Telephone mockup central — Refonte 2026-06-09 (fix mobile decalage) :
              Structure en 2 wrappers pour separer les transforms qui entraient
              en conflit (le animate-float-y ecrasait le translate de centrage,
              ce qui poussait le mockup en bas a droite sur mobile).

              - WRAPPER EXTERIEUR : positionnement + parallax desktop (transform stable)
              - WRAPPER INTERIEUR : animation flottante verticale (translateY)
              - CONTENU : le smartphone lui-meme

              Mobile : 210x420, parallax desactive (var(--mx) = 0 force).
              Desktop : 240/250 x 490/510, parallax via var(--mx)/var(--my). */}
          <div
            className="absolute left-1/2 top-1/2 w-[210px] sm:w-[240px] lg:w-[250px] h-[420px] sm:h-[490px] lg:h-[510px] will-change-transform"
            style={{
              transform: 'translate(calc(-50% + var(--mx, 0) * -10px), calc(-50% + var(--my, 0) * -10px))',
              transition: 'transform 0.4s cubic-bezier(.22,.61,.36,1)',
            }}
          >
            <div
              className="relative w-full h-full rounded-[36px] border border-white/[0.10] overflow-hidden p-[10px] animate-float-y will-change-transform"
              style={{
                background: 'linear-gradient(160deg, var(--bgdark-2), var(--bgdark-3))',
                boxShadow:
                  '0 40px 90px rgba(0,0,0,.6), 0 0 0 8px rgba(255,255,255,.02), 0 0 80px color-mix(in srgb, var(--electric) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[78px] h-[20px] rounded-b-[12px] z-10"
                style={{ background: 'var(--bgdark)' }}
              />

              <div
                className="w-full h-full rounded-[28px] overflow-hidden flex flex-col"
                style={{ background: 'linear-gradient(180deg, #0b1020, #0a1326)' }}
              >
                <div className="flex items-center justify-between px-4 pt-5 pb-1">
                  <span className="text-[10px] text-ink-2 font-spline-mono font-semibold">9:41</span>
                  <div className="flex gap-1 items-center">
                    <span className="w-3 h-[6px] rounded-sm bg-ink-3/60" />
                    <span className="w-3 h-[6px] rounded-sm bg-ink-3/60" />
                    <span className="w-3 h-[6px] rounded-sm bg-ink-3/60" />
                  </div>
                </div>

                <div className="px-4 pt-2 pb-2">
                  <div className="text-[9px] text-ink-3 font-bold uppercase tracking-[0.1em]">Tableau de bord</div>
                  <div className="text-[15px] font-hanken font-semibold text-ink mt-0.5">Bonjour, Michel</div>
                </div>

                <div className="grid grid-cols-2 gap-2 px-4 pt-1">
                  <div className="rounded-[12px] bg-white/[0.04] border border-white/[0.08] p-2.5">
                    <div className="text-[9px] text-ink-3 font-semibold">CA Facturé</div>
                    <div className="text-[16px] font-hanken font-bold text-electric-2 mt-0.5 tabular-nums">6 620 EUR</div>
                  </div>
                  <div className="rounded-[12px] bg-white/[0.04] border border-white/[0.08] p-2.5">
                    <div className="text-[9px] text-ink-3 font-semibold">Encaissé</div>
                    <div className="text-[16px] font-hanken font-bold mt-0.5 tabular-nums" style={{ color: 'var(--mint)' }}>2 110 EUR</div>
                  </div>
                </div>

                <div className="px-4 pt-3 pb-1 text-[9px] text-ink-3 font-bold uppercase tracking-[0.05em]">
                  Planning de la semaine
                </div>

                <div className="px-4 flex flex-col gap-1.5">
                  {[
                    { col: 'var(--electric)', t: 'Installation tableau', s: 'M. Dupont - Lun 08:30', tick: false },
                    { col: 'var(--accent)',   t: 'Rénovation cuisine',   s: 'M. Martin - Jeu 09:00', tick: true  },
                    { col: 'var(--mint)',     t: 'Pose carrelage',       s: 'M. Bernard - Ven 14:00', tick: false },
                  ].map((r) => (
                    <div
                      key={r.t}
                      className="flex items-center gap-2 rounded-[10px] bg-white/[0.04] border border-white/[0.08] px-2 py-1.5"
                    >
                      <span className="w-[6px] h-[26px] rounded-[3px] flex-none" style={{ background: r.col }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10.5px] font-bold text-ink truncate">{r.t}</div>
                        <div className="text-[9px] text-ink-3 font-medium font-spline-mono mt-0.5">{r.s}</div>
                      </div>
                      {r.tick && <span className="text-[11px]" style={{ color: 'var(--mint)' }}>OK</span>}
                    </div>
                  ))}
                </div>

                <div className="mt-auto px-4 pb-4 pt-3">
                  <div
                    className="w-full rounded-[10px] text-center font-hanken font-extrabold text-[11px] py-2.5"
                    style={{
                      background: 'linear-gradient(180deg, var(--accent-2), var(--accent))',
                      color: 'var(--bgdark-ink)',
                      boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 40%, transparent)',
                    }}
                  >
                    + Nouveau devis
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 chips flottantes — Hero epure mobile (decision Jerem 2026-06-09) :
              Sur mobile (<640px), les chips sont MASQUEES pour que le Hero
              respire et que l'attention aille au mockup smartphone seul.
              L'effet orbital (chips qui flottent autour du telephone) reste
              intact sur tablette/desktop (sm: et +). */}
          {CHIPS.map((chip) => {
            const sign = chipParallaxSign(chip.corner)
            const posClasses = chipPositionClasses(chip.corner)
            const transform = `translate(calc(${chip.offsetX}px + var(--mx) * ${sign.sx * 30}px), calc(${chip.offsetY}px + var(--my) * ${sign.sy * 30}px))`

            return (
              <div
                key={chip.label}
                className={`hidden sm:block absolute ${posClasses} reveal animate-float-y will-change-transform`}
                style={{
                  transform,
                  transition: 'transform 0.5s cubic-bezier(.22,.61,.36,1)',
                  animationDelay: `${chip.delay}s`,
                  transitionDelay: `${chip.delay}s`,
                }}
              >
                <div
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] backdrop-blur-[14px]"
                  style={{
                    background: 'color-mix(in srgb, var(--bgdark-3) 80%, transparent)',
                    border: chip.alert
                      ? '1px solid color-mix(in srgb, var(--accent) 55%, transparent)'
                      : '1px solid rgba(255,255,255,0.16)',
                    boxShadow: chip.alert
                      ? '0 20px 50px rgba(0,0,0,0.5), 0 0 30px color-mix(in srgb, var(--accent) 35%, transparent)'
                      : '0 20px 50px rgba(0,0,0,0.5)',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{
                      background: chip.dotColor,
                      boxShadow: `0 0 12px ${chip.dotColor}`,
                    }}
                  />
                  <div className="text-left whitespace-nowrap">
                    <div className="text-[12.5px] font-hanken font-semibold text-ink leading-tight">{chip.label}</div>
                    <div className="text-[10px] text-ink-3 font-medium mt-0.5 leading-tight">{chip.sublabel}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
