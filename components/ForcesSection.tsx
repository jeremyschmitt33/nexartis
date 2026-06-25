import Link from "next/link";
import React from "react";

/**
 * ForcesSection.tsx
 *
 * V4 landing dark premium — section "Forces Nexartis".
 *
 * Place entre <FeaturesSection /> et <PlanningDemoSection /> dans app/page.tsx.
 *
 * Architecture visuelle :
 *  - Eyebrow accent orange + H2 degrade + sous-titre
 *  - Grille 6 cartes differenciateurs (glass effect)
 *      .icone tuile coloree
 *      .titre + texte
 *      .ligne de preuve (border-top, badge mint/electric)
 *  - Mini comparatif "Nexartis vs Solutions classiques"
 *      2 colonnes glass : concurrence (items barres) vs Nexartis (highlight)
 *  - Bloc CTA bas (pill border-gradient + bouton orange)
 *
 * Conventions respectees :
 *  - Server Component (aucun state, aucune interaction)
 *  - Tokens Tailwind V4 uniquement (bgdark, ink, accent, electric, mint, violet)
 *  - `landing-section`, `landing-eyebrow`, `landing-text-grad`, `reveal`
 *  - Anti-mensonge : pas de promesse non livree par le produit
 *  - Mobile-first responsive 375px → desktop 1200px
 *
 * Les placeholders contenu ({{H2}}, {{card_X_title}}, etc.) sont remplaces
 * ici par le contenu cible produit par le copywriter senior. Si une revue
 * editoriale impose un changement, modifier directement les arrays ci-dessous.
 */

interface Force {
  title: string;
  text: string;
  proof: string;
  accent: string;
  proofTone: "mint" | "electric" | "accent" | "violet";
  svgPaths: React.ReactNode;
}

const forces: Force[] = [
  {
    title: "Pense pour les artisans, pas les comptables",
    text: "Vocabulaire metier (chantier, devis, attestation TVA), pas de jargon SaaS. Vous comprenez tout des le premier ecran.",
    proof: "Prise en main en moins de 10 minutes",
    accent: "#ff9d4d",
    proofTone: "accent",
    svgPaths: (
      <>
        <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Conforme legalement, sans y penser",
    text: "Mentions obligatoires, TVA 5,5/10/20 %, attestations renovation, numerotation continue. Tout est genere automatiquement.",
    proof: "Mentions legales francaises completes",
    accent: "#6aa0ff",
    proofTone: "electric",
    svgPaths: (
      <>
        <path d="M3 6h18" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </>
    ),
  },
  {
    title: "Planning anti-conflit, rare sur le marche",
    text: "La plupart des outils BTP grand public ne vous alertent pas en direct quand un membre de l'equipe est affecte deux fois le meme jour. Nexartis le fait.",
    proof: "Rare sur le marche",
    accent: "#ff7a1a",
    proofTone: "accent",
    svgPaths: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M12 14v3" />
        <circle cx="12" cy="19" r="0.5" />
      </>
    ),
  },
  {
    title: "Donnees hebergees en Europe",
    text: "Infrastructure conforme RGPD, isolation par compte (chiffrement et RLS). Vos chantiers et vos clients restent chez vous.",
    proof: "RGPD Europe",
    accent: "#2fd6a0",
    proofTone: "mint",
    svgPaths: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Facturation electronique",
    text: "Recevez des aujourd'hui les factures electroniques de vos fournisseurs dans Nexartis (obligation au 1er septembre 2026), et preparez l'emission de vos propres factures pour l'echeance qui vous concerne (a partir du 1er septembre 2027). Plateforme agreee.",
    proof: "Reception 2026 · Emission 2027",
    accent: "#8b6dff",
    proofTone: "violet",
    svgPaths: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9 15 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Deux offres claires, sans surcout cache",
    text: "Essentiel pour chiffrer et facturer, Complet pour piloter une equipe. A l'interieur de votre offre, tout est inclus : pas de module premium surprise, pas de cout par client ou par chantier.",
    proof: "Aucun surcout cache",
    accent: "#6aa0ff",
    proofTone: "electric",
    svgPaths: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10" />
        <path d="M9 10h4.5a2 2 0 0 1 0 4H9" />
      </>
    ),
  },
];

const comparison = [
  { label: "Vocabulaire metier BTP", classic: false, nexartis: true },
  { label: "Alertes conflit planning en temps reel", classic: false, nexartis: true },
  { label: "Mentions legales francaises automatiques", classic: false, nexartis: true },
  { label: "Donnees hebergees en Europe", classic: false, nexartis: true },
  { label: "Reception des e-factures fournisseurs (2026)", classic: false, nexartis: true },
  { label: "Deux offres claires, sans surcout cache", classic: false, nexartis: true },
];

const proofToneMap: Record<Force["proofTone"], { color: string; bg: string; border: string }> = {
  mint:     { color: "#2fd6a0", bg: "color-mix(in srgb, #2fd6a0 14%, transparent)", border: "color-mix(in srgb, #2fd6a0 32%, transparent)" },
  electric: { color: "#9fc0ff", bg: "color-mix(in srgb, #3f7bff 14%, transparent)", border: "color-mix(in srgb, #3f7bff 32%, transparent)" },
  accent:   { color: "#ffc79a", bg: "color-mix(in srgb, #ff7a1a 14%, transparent)", border: "color-mix(in srgb, #ff7a1a 32%, transparent)" },
  violet:   { color: "#c5b6ff", bg: "color-mix(in srgb, #8b6dff 14%, transparent)", border: "color-mix(in srgb, #8b6dff 32%, transparent)" },
};

export default function ForcesSection() {
  return (
    <section
      id="forces"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* ───────── Header ───────── */}
        <div className="text-center mb-[60px] reveal">
          <span className="landing-eyebrow landing-eyebrow--accent mb-5">
            <span
              className="dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "currentColor",
                boxShadow: "0 0 10px currentColor",
              }}
            />
            Nos forces
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Pourquoi Nexartis fait la difference
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[620px] mx-auto">
            Six raisons concretes pour lesquelles les artisans francais choisissent Nexartis plutot qu&apos;un outil generaliste.
          </p>
        </div>

        {/* ───────── Grille differenciateurs ───────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-[80px]">
          {forces.map((force, i) => {
            const tone = proofToneMap[force.proofTone];
            return (
              <div
                key={force.title}
                className={`reveal reveal-delay-${(i % 3) + 1} group relative flex flex-col rounded-[20px] p-[28px] bg-white/[0.04] border border-white/[0.08] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-[4px] hover:bg-white/[0.07] hover:border-white/[0.16]`}
              >
                {/* Icone */}
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-5"
                  style={{
                    background: `color-mix(in srgb, ${force.accent} 14%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${force.accent} 22%, transparent)`,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={force.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {force.svgPaths}
                  </svg>
                </div>

                <h3 className="text-[18px] font-[800] text-ink mb-2 tracking-[-0.01em]">
                  {force.title}
                </h3>
                <p className="flex-1 text-[14px] text-ink-2 font-medium leading-[1.65]">
                  {force.text}
                </p>

                {/* Ligne de preuve */}
                <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.03em] uppercase px-2.5 py-1 rounded-md border"
                    style={{
                      color: tone.color,
                      background: tone.bg,
                      borderColor: tone.border,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {force.proof}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ───────── Comparatif Nexartis vs classiques ───────── */}
        <div className="reveal mb-[60px]">
          <div className="text-center mb-8">
            <h3 className="text-[22px] sm:text-[28px] font-[800] text-ink tracking-[-0.02em] mb-2">
              Nexartis vs solutions classiques
            </h3>
            <p className="text-[15px] text-ink-3 font-medium">
              Ce que vous obtenez ailleurs, et ce que vous obtenez chez Nexartis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            {/* Colonne concurrence */}
            <div className="rounded-[20px] p-[28px] bg-white/[0.025] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  Solutions classiques
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
                  Generaliste
                </span>
              </div>
              <ul className="space-y-3">
                {comparison.map((row) => (
                  <li key={`c-${row.label}`} className="flex items-start gap-3 text-[14px] text-ink-3 line-through decoration-white/20">
                    <span className="mt-[3px] flex-none w-4 h-4 rounded-full border border-white/15 flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                    <span className="font-medium leading-snug">{row.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne Nexartis */}
            <div
              className="relative rounded-[20px] p-[1px] overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, #3f7bff 55%, transparent) 0%, color-mix(in srgb, #ff7a1a 65%, transparent) 100%)",
              }}
            >
              <div className="relative rounded-[19px] p-[28px] bg-bgdark-2 h-full overflow-hidden">
                {/* Glow decoratif */}
                <div
                  aria-hidden
                  className="absolute -top-20 -right-20 w-[260px] h-[260px] rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in srgb, #ff7a1a 28%, transparent), transparent 65%)",
                    filter: "blur(40px)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-ink">
                      Nexartis
                    </span>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-md border"
                      style={{
                        color: "#ffc79a",
                        background: "color-mix(in srgb, #ff7a1a 14%, transparent)",
                        borderColor: "color-mix(in srgb, #ff7a1a 32%, transparent)",
                      }}
                    >
                      Specialise BTP
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {comparison.map((row) => (
                      <li key={`n-${row.label}`} className="flex items-start gap-3 text-[14px] text-ink">
                        <span
                          className="mt-[2px] flex-none w-[18px] h-[18px] rounded-full flex items-center justify-center"
                          style={{
                            background: "color-mix(in srgb, #2fd6a0 22%, transparent)",
                            boxShadow: "inset 0 0 0 1px color-mix(in srgb, #2fd6a0 40%, transparent)",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2fd6a0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span className="font-semibold leading-snug">{row.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────── CTA bas ───────── */}
        <div className="reveal flex flex-col sm:flex-row items-center justify-between gap-5 rounded-[22px] p-[28px] sm:p-[32px] bg-white/[0.04] border border-white/[0.09] backdrop-blur-[6px]">
          <div className="text-center sm:text-left">
            <p className="text-[17px] sm:text-[19px] font-[800] text-ink tracking-[-0.01em] mb-1">
              Pret a tester ces forces sur vos chantiers ?
            </p>
            <p className="text-[14px] text-ink-2 font-medium">
              Essai gratuit 14 jours. Aucune carte bancaire requise.
            </p>
          </div>
          <Link
            href="/register"
            className="btn-hero-primary flex-none whitespace-nowrap"
          >
            Commencer gratuitement
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
