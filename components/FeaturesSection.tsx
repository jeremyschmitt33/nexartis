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
    title: "Un devis pro en 2 minutes, pas en 2 heures",
    text: "Choisissez le client, ajoutez vos prestations, envoyez par email. Votre client signe en ligne depuis son téléphone. Le chantier peut démarrer.",
    tag: "✓ Conforme légalement",
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
    title: "Fini les deux équipes sur le même chantier",
    text: "Glissez vos chantiers sur le calendrier. Si vous affectez quelqu'un deux fois le même jour, une alerte orange apparaît aussitôt. Plus jamais de double-booking.",
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
    title: "Savez enfin où vous en êtes, d'un coup d'œil",
    text: "Ce que vous avez facturé ce mois-ci, ce qui reste à encaisser, ce qui tombe la semaine prochaine. Vos chiffres clairs, sans tableur ni calcul.",
    tag: "✓ Temps réel",
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
    title: "Vos relances tournent toutes seules",
    text: "Relances email automatiques, SMS de relance prêt à envoyer depuis votre téléphone (gratuit), ou relance manuelle en 1 clic. Les clients qui n'ont pas payé remontent en haut de votre tableau de bord. Vous n'oubliez plus une facture.",
    tag: "✓ Relances intégrées",
    accent: "#8b6dff",
    svgPaths: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
  },
  {
    title: "La facture électronique, déjà prête pour vous",
    text: "Recevez dès aujourd'hui les factures électroniques de vos fournisseurs dans Nexartis (obligation au 1er septembre 2026). L'émission de vos propres factures est prête pour votre échéance (à partir du 1er septembre 2027). Plateforme agréée, données chiffrées.",
    tag: "✓ Réception 2026 · Émission 2027",
    accent: "#ff7a1a",
    svgPaths: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    title: "Payez-moi : un QR, et c'est viré",
    text: "Chaque facture PDF porte un QR de virement SEPA. Votre client le scanne, son virement est déjà pré-rempli, il valide. Vous êtes payé plus vite, et sans commission car c'est un virement.",
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
    title: "Vos calculs de chantier, sans vous tromper",
    text: "Béton, carrelage, peinture, section de câble, puissance de chauffe, taux horaire... 10 calculatrices métier sous la main. Et votre CA à déclarer à l'URSSAF, calculé en 1 clic.",
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
    title: "Vous ne partez jamais d'une feuille blanche",
    text: "Plus de 700 prestations par métier vous sont proposées en autocomplétion : vous tapez, vous choisissez, c'est rempli. Et vous ajoutez vos propres lignes dans votre bibliothèque perso.",
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
    title: "Vos photos avant/apres, jamais perdues",
    text: "Classées par client et par album, vos photos de chantier sont là quand vous en avez besoin. Fini de scroller 2000 photos pour retrouver le bon chantier.",
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
    title: "Pensé pour le terrain, dans votre poche",
    text: "Faites un devis depuis le chantier, sur smartphone ou tablette. Votre client signe dans la foulée sur son téléphone. Tout marche sans installer d'appli.",
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
            Fonctionnalités
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Tout votre quotidien d&apos;artisan, dans un seul outil
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[560px] mx-auto">
            Du devis au paiement. Simple à prendre en main, fait pour durer.
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
