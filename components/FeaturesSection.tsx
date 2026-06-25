"use client";

import React from "react";

// V4 landing dark — section "Fonctionnalites".
// Atmosphere globale traverse via bg-transparent.
// Anti-mensonge applique :
// - Devis : "envoye par email" (retire "ou SMS" car pas dispo)
// - Impayes : relances email auto + SMS gratuite + relance manuelle 1 clic (livre)
// - E-facture : reception des factures fournisseurs des 2026, emission prete pour 2027
// - Catalogue : "plus de 700 prestations" (pas de nombre precis)
// - Mobile : "Optimise mobile et terrain" (web responsive, pas apps natives)

interface FeatureCard {
  title: string;
  text: string;
  tag: string;
  exclusive?: boolean;
  accent: string;
  svgPaths: React.ReactNode;
}

const cards: FeatureCard[] = [
  {
    title: "Devis et factures en quelques minutes",
    text: "Selectionnez votre client et vos prestations. Le devis est envoye par email. Votre client signe directement sur son telephone.",
    tag: "✓ Conforme legalement",
    accent: "#6aa0ff",
    svgPaths: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    ),
  },
  {
    title: "Planning qui evite les conflits",
    text: "Glissez vos chantiers sur le calendrier. Si vous affectez quelqu'un deux fois le meme jour, une alerte orange apparait immediatement.",
    tag: "★ Exclusif Nexartis",
    exclusive: true,
    accent: "#ff9d4d",
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
    title: "Suivi financier en temps reel",
    text: "Combien vous avez facture ce mois-ci. Ce qui n'est pas encore paye. Ce qui arrive la semaine prochaine. Tout affiche simplement.",
    tag: "✓ Temps reel",
    accent: "#2fd6a0",
    svgPaths: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
  },
  {
    title: "Plus aucun impaye oublie",
    text: "Relances automatiques par email, relance par SMS gratuite et relance manuelle en 1 clic. Vos clients qui doivent encore payer sont mis en avant sur votre tableau de bord.",
    tag: "✓ Relances integrees",
    accent: "#8b6dff",
    svgPaths: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
  },
  {
    title: "Facturation electronique, prete avant l'echeance",
    text: "Recevez des aujourd'hui les factures electroniques de vos fournisseurs, directement dans Nexartis. L'emission de vos propres factures est prete pour l'echeance qui vous concerne. Plateforme agreee, donnees chiffrees.",
    tag: "✓ Reception 2026 · Emission 2027",
    accent: "#ff7a1a",
    svgPaths: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    title: "Vos factures payees plus vite",
    text: "Un QR de virement SEPA est ajoute sur chaque facture PDF. Votre client scanne, le virement est pre-rempli, et vous etes paye sans commission.",
    tag: "✓ QR virement SEPA",
    accent: "#2fd6a0",
    svgPaths: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3" />
        <path d="M21 14v7h-4" />
      </>
    ),
  },
  {
    title: "10 calculatrices metier + aide URSSAF",
    text: "Beton, carrelage, peinture, section de cable, puissance de chauffe, taux horaire... et votre CA encaisse a declarer a l'URSSAF, calcule en 1 clic.",
    tag: "✓ 10 calculatrices",
    accent: "#6aa0ff",
    svgPaths: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="11" x2="8" y2="11" />
        <line x1="12" y1="11" x2="12" y2="11" />
        <line x1="16" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="8" y2="15" />
        <line x1="12" y1="15" x2="12" y2="15" />
      </>
    ),
  },
  {
    title: "Vous ne partez jamais de zero",
    text: "Un catalogue de plus de 700 prestations par metier vous est propose en autocompletion. Ajoutez vos propres lignes dans votre bibliotheque personnelle.",
    tag: "✓ +700 prestations",
    accent: "#2fd6a0",
    svgPaths: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  {
    title: "Vos photos de chantier au bon endroit",
    text: "Vos photos avant/apres sont classees par client et par album. Plus besoin de fouiller votre pellicule pour retrouver le bon chantier.",
    tag: "✓ Photos par client",
    accent: "#ff9d4d",
    svgPaths: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="m21 15-4-4-9 9" />
      </>
    ),
  },
  {
    title: "Optimise mobile et terrain",
    text: "Creez un devis depuis votre chantier sur smartphone ou tablette. Votre client signe directement sur son telephone.",
    tag: "✓ Web responsive",
    accent: "#6aa0ff",
    svgPaths: (
      <>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </>
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section
      id="fonctionnalites"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <div className="text-center mb-[60px] reveal">
          <span
            className="landing-eyebrow mb-5"
            style={{
              color: "#9fc0ff",
              background: "color-mix(in srgb, #3f7bff 12%, transparent)",
              borderColor: "color-mix(in srgb, #3f7bff 30%, transparent)",
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
            Fonctionnalites
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Tout ce dont votre entreprise a besoin
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[560px] mx-auto">
            Prise en main immediate. Efficacite durable.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className={`reveal reveal-delay-${(i % 3) + 1} relative flex flex-col rounded-[20px] p-[32px_28px] transition-all duration-300 hover:-translate-y-[4px] ${
                card.exclusive
                  ? "border border-[color:color-mix(in_srgb,var(--accent,#ff7a1a)_36%,transparent)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--accent,#ff7a1a)_10%,transparent),rgba(255,255,255,0.04))] shadow-[0_0_40px_color-mix(in_srgb,var(--accent,#ff7a1a)_18%,transparent)]"
                  : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.16]"
              }`}
            >
              {/* Tag (top-right) */}
              <span
                className="absolute top-[18px] right-[18px] text-[10.5px] font-bold tracking-[0.04em] uppercase px-2.5 py-1 rounded-md border"
                style={{
                  color: card.exclusive ? "#ffc79a" : card.accent,
                  background: `color-mix(in srgb, ${card.accent} 14%, transparent)`,
                  borderColor: `color-mix(in srgb, ${card.accent} 32%, transparent)`,
                }}
              >
                {card.tag}
              </span>

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-5"
                style={{
                  background: `color-mix(in srgb, ${card.accent} 14%, transparent)`,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={card.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {card.svgPaths}
                </svg>
              </div>

              <h3 className="text-[18px] font-[800] text-ink mb-2 tracking-[-0.01em] pr-[30px]">
                {card.title}
              </h3>
              <p className="flex-1 text-[14px] text-ink-2 font-medium leading-[1.65]">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
