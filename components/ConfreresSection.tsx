import React from "react";

/**
 * ConfreresSection.tsx
 *
 * Section landing dark premium — nouveautés collaboratives regroupées :
 * Réseau de confrères (C) + Messagerie unifiée (B) + Chantiers confiés (D).
 *
 * Placée entre <PlanningDemoSection /> et <PricingSection /> dans app/page.tsx.
 * Ancre : #reseau.
 *
 * Décisions (Jerem 24/07/2026 + confrontateur/vérificateur) :
 *  - Ces 3 briques racontent UNE histoire (réseau → messagerie → collaboration)
 *    → une seule section compacte de 3 cartes, JAMAIS 3 cartes noyées dans
 *    FeaturesSection, JAMAIS dans le Hero ni le slogan.
 *  - On vend la CAPACITÉ, pas une communauté déjà peuplée (éviter l'effet
 *    "réseau vide" au démarrage).
 *  - Argument de réassurance NON négociable et bien visible :
 *    "Aucun montant partagé entre confrères — vos paiements sous-traitants
 *    restent privés."
 *  - Messagerie présentée comme brique de support, pas comme héros.
 *
 * Server Component (aucun state, aucune interaction).
 */

interface Carte {
  eyebrow: string;
  title: string;
  text: string;
  accent: string;
  svgPaths: React.ReactNode;
}

const cartes: Carte[] = [
  {
    eyebrow: "Votre réseau",
    title: "Vos confrères de confiance, réunis",
    text: "Invitez vos confrères par e-mail ou par simple lien. Vous gardez la main sur vos demandes reçues et envoyées : votre réseau se construit avec les artisans que vous choisissez.",
    accent: "#6aa0ff",
    svgPaths: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
        <path d="M17 11h5" />
        <path d="M19.5 8.5v5" />
      </>
    ),
  },
  {
    eyebrow: "Messagerie",
    title: "Une seule messagerie, reliée au chantier",
    text: "Fini de jongler entre WhatsApp, mails et SMS. Vos discussions et vos confrères sont au même endroit, avec pièces jointes, et chaque échange reste rattaché à la fiche du chantier concerné.",
    accent: "#2fd6a0",
    svgPaths: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
      </>
    ),
  },
  {
    eyebrow: "Chantiers confiés",
    title: "Confiez un lot, suivez l'avancement en photos",
    text: "Confiez un lot de votre chantier à un confrère : il l'accepte, publie son avancement (à faire, en cours, en attente, terminé) et ses photos. Vous suivez tout depuis la fiche du chantier, sans relancer au téléphone.",
    accent: "#ff9d4d",
    svgPaths: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
  },
];

export default function ConfreresSection() {
  return (
    <section
      id="reseau"
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
            Entre confrères
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Travaillez à plusieurs, gardez vos chiffres pour vous
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[620px] mx-auto">
            Constituez votre réseau, échangez, et confiez un lot de chantier à un confrère —
            chacun garde ses tarifs et ses marges pour lui.
          </p>
        </div>

        {/* ───────── 3 cartes ───────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {cartes.map((carte, i) => (
            <div
              key={carte.title}
              className={`reveal reveal-delay-${i + 1} flex flex-col rounded-[20px] p-[28px] bg-white/[0.04] border border-white/[0.08] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-[4px] hover:bg-white/[0.07] hover:border-white/[0.16]`}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-5"
                style={{
                  background: `color-mix(in srgb, ${carte.accent} 14%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${carte.accent} 22%, transparent)`,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={carte.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {carte.svgPaths}
                </svg>
              </div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2"
                style={{ color: `color-mix(in srgb, ${carte.accent} 70%, white)` }}
              >
                {carte.eyebrow}
              </div>
              <h3 className="text-[18px] font-[800] text-ink mb-2 tracking-[-0.01em]">
                {carte.title}
              </h3>
              <p className="flex-1 text-[14px] text-ink-2 font-medium leading-[1.65]">
                {carte.text}
              </p>
            </div>
          ))}
        </div>

        {/* ───────── Bandeau de réassurance financière ───────── */}
        <div className="reveal flex items-center justify-center gap-3 rounded-[18px] p-[20px] sm:p-[22px] bg-white/[0.04] border border-white/[0.09] backdrop-blur-[6px] text-center">
          <span
            className="flex-none w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, #2fd6a0 18%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, #2fd6a0 36%, transparent)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2fd6a0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <p className="text-[14px] sm:text-[15px] text-ink font-semibold leading-snug">
            Aucun montant partagé entre confrères — vos paiements sous-traitants restent privés.
          </p>
        </div>
      </div>
    </section>
  );
}
