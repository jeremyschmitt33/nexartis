import Link from "next/link";
import React from "react";

/**
 * Plan3dSection.tsx
 *
 * Section landing dark premium — nouveauté "Plan 2D/3D → devis" (Beta).
 *
 * Placée entre <FeaturesSection /> et <ForcesSection /> dans app/page.tsx.
 * Ancre : #plan-3d (offset géré globalement par html { scroll-padding-top: 100px }).
 *
 * Choix produit (validé Jerem 24/07/2026) : "carte simple d'abord" — PAS de
 * démo interactive three.js sur la landing. Illustration statique SVG/CSS,
 * fidèle au niveau réel du produit (métré + murs), sans rendu photoréaliste.
 *
 * Anti-mensonge (verrouillé par le vérificateur + confrontateur) :
 *  - Jamais "génère / remplit tout seul le devis" : le métré est REPORTÉ sans
 *    ressaisie, à partir du plan que l'artisan a dessiné et saisi.
 *  - Badge Beta omniprésent + phrase de cadrage "outil de métré/plan qui
 *    alimente le devis, pas un logiciel d'architecture".
 *  - Aucune garantie absolue ("sans erreur", "sans oubli") : interdites.
 *  - Garde-fous métier affichés : cote sacrée, pas de chiffre intérieur depuis
 *    une surface extérieure, zéro double compte des murs mitoyens.
 *
 * Server Component (aucun state, aucune interaction).
 */

const gardeFous: string[] = [
  "Votre cote saisie, jamais arrondie",
  "Une surface extérieure ne donne jamais un chiffre d'intérieur",
  "Zéro double compte des murs mitoyens",
];

// Lignes de devis illustratives (valeurs cohérentes : 4,20 m × 3,10 m = 13,02 m²).
const lignesDevis: { metier: string; libelle: string; qte: string; accent: string }[] = [
  { metier: "Maçonnerie", libelle: "Dalle béton", qte: "13,02 m²", accent: "#ff9d4d" },
  { metier: "Menuiserie", libelle: "Porte 900 × 2100", qte: "1 u", accent: "#6aa0ff" },
  { metier: "Chauffage", libelle: "Radiateur", qte: "1 u", accent: "#8b6dff" },
];

export default function Plan3dSection() {
  return (
    <section
      id="plan-3d"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* ───────── Header ───────── */}
        <div className="text-center mb-[60px] reveal">
          <span
            className="landing-eyebrow mb-5"
            style={{
              color: "#c5b6ff",
              background: "color-mix(in srgb, #8b6dff 12%, transparent)",
              borderColor: "color-mix(in srgb, #8b6dff 30%, transparent)",
            }}
          >
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
            Nouveau · Beta
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Le plan du chantier qui alimente votre devis
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[640px] mx-auto">
            Dessinez vos pièces, vos murs et vos ouvertures à la cote exacte.
            Nexartis calcule le métré par métier et le reporte dans le devis, sans ressaisie à la main.
          </p>
        </div>

        {/* ───────── Bloc principal 2 colonnes ───────── */}
        <div className="reveal grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">

          {/* Colonne gauche — texte + garde-fous + CTA */}
          <div className="flex flex-col rounded-[22px] p-[28px] sm:p-[34px] bg-white/[0.04] border border-white/[0.09] backdrop-blur-[6px]">
            <p className="text-[15px] text-ink-2 font-medium leading-[1.7] mb-6">
              <strong className="text-ink font-bold">À plat</strong> pour dessiner précisément (cotes cliquables,
              pose des ouvertures), puis <strong className="text-ink font-bold">en vraie 3D</strong> pour vérifier
              d&apos;un coup d&apos;œil : murs avec épaisseur, ouvertures découpées, ombres portées, que l&apos;on
              tourne à la souris. Un même plan, deux façons de le regarder.
            </p>

            {/* Métiers couverts */}
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-2.5">
                Métrés calculés par métier
              </div>
              <div className="flex flex-wrap gap-2">
                {["Maçonnerie", "Menuiserie", "Chauffage", "Terrassement", "Façade"].map((m) => (
                  <span
                    key={m}
                    className="text-[12.5px] font-semibold text-ink-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.10]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Garde-fous (preuve de rigueur) */}
            <div className="flex flex-col gap-2.5 mb-6">
              {gardeFous.map((g) => (
                <div key={g} className="flex items-start gap-2.5">
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
                  <span className="text-[13.5px] text-ink-2 font-semibold leading-snug">{g}</span>
                </div>
              ))}
            </div>

            {/* Cadrage honnête */}
            <p className="text-[12.5px] text-ink-3 font-medium leading-[1.6] mb-5 pl-3 border-l-2 border-white/[0.12]">
              Aperçu du produit. C&apos;est un outil de métré et de plan qui alimente le devis,
              pas un logiciel d&apos;architecture. Fonctionnalité en Beta.
            </p>

            {/* Disponibilité offre */}
            <div className="mb-6 inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 border" style={{ color: "#ffc79a", background: "color-mix(in srgb, #ff7a1a 12%, transparent)", borderColor: "color-mix(in srgb, #ff7a1a 30%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ff9d4d" stroke="#ff9d4d" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-[12px] font-bold tracking-[0.02em]">Inclus dans l&apos;offre Complet · testable pendant l&apos;essai gratuit</span>
            </div>

            <div className="mt-auto">
              <Link href="/register?plan=complete" className="btn-hero-primary whitespace-nowrap">
                Essayer le Plan 3D (Beta)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Colonne droite — illustration statique plan → devis */}
          <div className="relative rounded-[22px] p-[24px] sm:p-[30px] bg-[rgba(13,21,37,0.7)] border border-white/[0.08] backdrop-blur-[10px] overflow-hidden">
            {/* Glow décoratif */}
            <div
              aria-hidden
              className="absolute -top-16 -right-16 w-[240px] h-[240px] rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, color-mix(in srgb, #8b6dff 26%, transparent), transparent 65%)",
                filter: "blur(44px)",
              }}
            />
            {/* Pastille Beta */}
            <span
              className="absolute top-4 right-4 z-10 text-[10.5px] font-bold tracking-[0.06em] uppercase px-2.5 py-1 rounded-md border"
              style={{
                color: "#c5b6ff",
                background: "color-mix(in srgb, #8b6dff 16%, transparent)",
                borderColor: "color-mix(in srgb, #8b6dff 34%, transparent)",
              }}
            >
              Beta
            </span>

            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-3">
                Plan du chantier
              </div>

              {/* Schéma de pièce (SVG net, wireframe assumé) */}
              <svg
                viewBox="0 0 320 200"
                className="w-full h-auto mb-1"
                role="img"
                aria-label="Schéma d'une pièce dessinée : 4 200 mm par 3 100 mm, avec une porte."
              >
                {/* Mur extérieur (double trait = épaisseur) */}
                <rect x="34" y="34" width="252" height="132" rx="3" fill="none" stroke="#6aa0ff" strokeWidth="6" opacity="0.9" />
                <rect x="42" y="42" width="236" height="116" rx="2" fill="color-mix(in srgb, #6aa0ff 6%, transparent)" stroke="#6aa0ff" strokeWidth="1.5" opacity="0.55" />
                {/* Ouverture de porte (trou dans le mur bas + arc) */}
                <rect x="132" y="160" width="46" height="12" fill="#0d1428" />
                <path d="M132 166 A46 46 0 0 1 178 166" fill="none" stroke="#2fd6a0" strokeWidth="2" opacity="0.85" />
                {/* Cote horizontale */}
                <line x1="34" y1="22" x2="286" y2="22" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                <line x1="34" y1="16" x2="34" y2="28" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                <line x1="286" y1="16" x2="286" y2="28" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                {/* Cote verticale */}
                <line x1="300" y1="34" x2="300" y2="166" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                <line x1="294" y1="34" x2="306" y2="34" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                <line x1="294" y1="166" x2="306" y2="166" stroke="#6aa0ff" strokeWidth="1" opacity="0.7" />
                {/* Symbole radiateur */}
                <g opacity="0.9">
                  <rect x="58" y="60" width="30" height="12" rx="2" fill="none" stroke="#8b6dff" strokeWidth="1.5" />
                  <line x1="64" y1="60" x2="64" y2="72" stroke="#8b6dff" strokeWidth="1.2" />
                  <line x1="71" y1="60" x2="71" y2="72" stroke="#8b6dff" strokeWidth="1.2" />
                  <line x1="78" y1="60" x2="78" y2="72" stroke="#8b6dff" strokeWidth="1.2" />
                </g>
              </svg>

              {/* Étiquettes de cotes (police tabulaire, jamais arrondies) */}
              <div className="flex items-center justify-center gap-4 text-[12px] font-spline-mono text-electric-2 mb-5">
                <span className="tabular-nums">4 200 mm</span>
                <span className="text-ink-3">×</span>
                <span className="tabular-nums">3 100 mm</span>
              </div>

              {/* Flèche "reporté au devis" */}
              <div className="flex items-center gap-2 justify-center mb-4">
                <span className="h-px flex-1 bg-white/[0.10]" />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink px-2.5 py-1 rounded-md border" style={{ background: "color-mix(in srgb, #ff7a1a 12%, transparent)", borderColor: "color-mix(in srgb, #ff7a1a 30%, transparent)" }}>
                  Reporté au devis
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
                <span className="h-px flex-1 bg-white/[0.10]" />
              </div>

              {/* Mini-devis */}
              <div className="rounded-[14px] bg-white/[0.03] border border-white/[0.08] p-3.5 flex flex-col gap-2">
                {lignesDevis.map((l) => (
                  <div key={l.metier + l.libelle} className="flex items-center gap-3">
                    <span className="w-1.5 h-8 rounded-full flex-none" style={{ background: l.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3">{l.metier}</div>
                      <div className="text-[13px] font-semibold text-ink truncate">{l.libelle}</div>
                    </div>
                    <span className="text-[12.5px] font-spline-mono text-mint tabular-nums flex-none">{l.qte}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
