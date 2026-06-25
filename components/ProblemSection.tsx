"use client";

// V4 landing dark — section "Pourquoi Nexartis".
// Tous les hex hardcodes light retires. Atmosphere globale traverse via bg-transparent.

const problems = [
  {
    num: "01",
    title: "Des tarifs transparents et maitrises",
    text: "Les solutions du marche atteignent souvent 50 a 100 euros par mois pour acceder a l'ensemble des fonctionnalites. Nexartis demarre a 15 euros par mois, sans restriction ni option cachee.",
    accent: "var(--mint, #2fd6a0)",
    svgPaths: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M14.5 8a4 4 0 1 0 0 8H9" />
        <path d="M8 12h6" />
      </>
    ),
  },
  {
    num: "02",
    title: "Une planification fiable, sans conflit d'affectation",
    text: "Les logiciels existants proposent un calendrier basique, sans detection de conflits. Nexartis vous alerte immediatement si un intervenant est deja affecte a un autre chantier le meme jour.",
    accent: "var(--accent-2, #ff9d4d)",
    svgPaths: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  {
    num: "03",
    title: "Concu pour une utilisation sur le terrain",
    text: "Nexartis fonctionne parfaitement sur smartphone comme sur ordinateur. L'interface a ete pensee pour etre utilisee rapidement, en situation de mobilite, directement depuis vos chantiers.",
    accent: "var(--electric-2, #6aa0ff)",
    svgPaths: (
      <>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </>
    ),
  },
];

export default function ProblemSection() {
  return (
    <section
      id="pourquoi"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
        <div className="text-center mb-[60px] reveal">
          <span className="landing-eyebrow mb-5" style={{
            color: "#9fffd9",
            background: "color-mix(in srgb, #2fd6a0 12%, transparent)",
            borderColor: "color-mix(in srgb, #2fd6a0 28%, transparent)",
          }}>
            <span className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", boxShadow: "0 0 10px currentColor" }} />
            Pourquoi Nexartis
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Des outils professionnels a la hauteur de votre activite
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[560px] mx-auto">
            Trois problemes que les artisans rencontrent tous les jours, resolus en un seul logiciel.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${i + 1} relative overflow-hidden rounded-[22px] p-[36px_30px] border bg-white/[0.04] border-white/[0.08] transition-all duration-300 hover:bg-white/[0.07] hover:border-white/[0.16] hover:-translate-y-[6px]`}
            >
              {/* Halo discret en coin */}
              <div
                aria-hidden
                className="absolute -top-12 -right-12 w-[160px] h-[160px] rounded-full opacity-30 pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${problem.accent}, transparent 70%)`,
                }}
              />
              <div className="relative">
                <div
                  className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center mb-5"
                  style={{
                    background: "color-mix(in srgb, " + problem.accent + " 14%, transparent)",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={problem.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {problem.svgPaths}
                  </svg>
                </div>
                <div className="text-[12px] font-bold tracking-[0.12em] text-ink-3 mb-2 font-spline-mono">
                  {problem.num}
                </div>
                <h3 className="text-[20px] font-[800] text-ink mb-2.5 tracking-[-0.01em]">
                  {problem.title}
                </h3>
                <p className="text-[14.5px] text-ink-2 font-medium leading-[1.65]">
                  {problem.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
