"use client";

import Link from "next/link";

/**
 * PricingSection — V4 landing dark, 2 offres (Essentiel + Complet).
 *
 * - Essentiel 15 € HT/mois : artisan solo, devis + factures + conformité BTP
 * - Complet   25 € HT/mois : tout l'Essentiel + planning + équipe + IA vocale
 *
 * Conventions :
 *   - Source de vérité features : lib/plans.ts (ne pas dupliquer ici)
 *   - Affichage simplifié pour ne pas écraser visuellement (top 10 features)
 *   - "Complet" mis en avant via border gradient et badge "Recommandé"
 *
 * Anti-mensonge :
 *   - Toutes les features listées sont livrées par le produit
 *   - Pas de promesse de fonctionnalité non implémentée
 */

interface FeatureRow {
  label: string;
  /** Étiquette optionnelle (ex: "BIENTÔT") affichée à côté du libellé. */
  badge?: string;
}

interface FeatureGroup {
  title: string;
  items: FeatureRow[];
}

/**
 * Fonctionnalités de l'offre Essentiel, regroupées par thème pour un rendu
 * lisible en 2 colonnes (au lieu d'une longue liste plate qui déséquilibrait
 * visuellement la carte).
 *
 * ⚠️ Aligné sur lib/plans.ts (source de vérité du gating) :
 *   - Les "acomptes" sont bien dans l'Essentiel.
 *   - Les "factures de situation" et l'"export comptable" sont réservés au
 *     Complet → ils NE figurent PAS ici, mais dans COMPLETE_EXTRA_FEATURES.
 */
const ESSENTIAL_GROUPS: FeatureGroup[] = [
  {
    title: "Devis, factures & signature",
    items: [
      { label: "Devis illimités" },
      { label: "Factures illimitées" },
      { label: "Acomptes" },
      { label: "Factures d'avoir" },
      { label: "Signature électronique en ligne" },
      { label: "Export PDF des devis et factures" },
    ],
  },
  {
    title: "Conformité BTP & e-facture",
    items: [
      { label: "Mentions légales BTP automatiques" },
      { label: "TVA 5,5 % / 10 % / 20 % automatique" },
      { label: "Attestations TVA rénovation auto" },
      { label: "Facture verrouillée après le 1er envoi" },
      { label: "E-facture : réception 2026 + émission prête 2027" },
    ],
  },
  {
    title: "Paiement & trésorerie",
    items: [
      { label: "Suivi des impayés et relance en 1 clic" },
      { label: "Relances email automatiques + SMS gratuit depuis votre téléphone" },
      { label: "QR de virement SEPA pour être payé plus vite" },
      { label: "Tableau de bord du chiffre d'affaires" },
    ],
  },
  {
    title: "Outils métier & confort",
    items: [
      { label: "10 calculatrices métier + aide URSSAF" },
      { label: "Catalogue de +700 prestations + biblio perso (50 max)" },
      { label: "Rappels assurance décennale" },
      { label: "Photos de chantier par client" },
      { label: "Client particulier ou société (SIREN/SIRET)" },
      { label: "Données hébergées en Europe" },
      { label: "Support email Lun-Ven 9h-18h" },
      { label: "Sans engagement" },
    ],
  },
];

/** Liste aplatie de l'Essentiel, pour le rappel dépliable dans la carte Complet. */
const ESSENTIAL_FLAT: FeatureRow[] = ESSENTIAL_GROUPS.flatMap((g) => g.items);

/**
 * Avantages exclusifs du Complet, "en plus" de tout l'Essentiel.
 * Aligné sur lib/plans.ts (features réservées au plan 'complete').
 * Le rapport d'intervention est marqué BIENTÔT (non encore livré).
 */
const COMPLETE_EXTRA_FEATURES: FeatureRow[] = [
  { label: "Planning chantier visuel" },
  { label: "Alertes conflits d'affectation en temps réel" },
  { label: "Gestion d'équipe et planning intervenants" },
  { label: "Devis vocal par IA (exclusif)" },
  { label: "Factures de situation (#1, #2, #3 avec cumul)" },
  { label: "Export comptable CSV (Sage / EBP)" },
  { label: "Rapport d'intervention" },
  { label: "Bibliothèque prestations illimitée" },
];

function CheckIcon({ color = "#2fd6a0" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#ff9d4d"
      stroke="#ff9d4d"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function PricingSection() {
  return (
    <section
      id="tarifs"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
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
            Tarification
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Un tarif juste, sans mauvaise surprise
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[620px] mx-auto">
            Deux offres claires, sans engagement. Vous changez d&apos;offre quand vous voulez, en un clic.
          </p>
        </div>

        {/* 2 cartes côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-[1080px] mx-auto">
          {/* ───────── Carte ESSENTIEL ───────── */}
          <div className="reveal relative rounded-[24px] p-[1px] bg-white/[0.08]">
            <div className="relative rounded-[23px] bg-bgdark-2 p-[36px_28px] sm:p-[44px_36px] h-full flex flex-col">
              {/* Header carte */}
              <div className="mb-4">
                <h3 className="text-[20px] font-[800] text-ink mb-1.5 tracking-[-0.01em]">
                  Essentiel
                </h3>
                <p className="text-[14px] text-ink-3 font-medium leading-snug">
                  Tout pour chiffrer, facturer et être payé. Parfait quand vous travaillez seul.
                </p>
              </div>

              {/* Prix */}
              <div className="mb-1.5">
                <span className="text-[56px] sm:text-[64px] font-[800] text-ink tracking-[-0.04em] leading-none tabular-nums">
                  15€
                </span>
                <span className="text-[18px] font-semibold text-ink-2 ml-1">
                  /mois HT
                </span>
              </div>
              <p className="text-[13px] text-ink-3 mb-7">
                Sans engagement · Résiliation à tout moment
              </p>

              <div className="h-px w-full bg-white/[0.08] mb-7" />

              {/* Features groupées par thème (2 colonnes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 mb-8 flex-1">
                {ESSENTIAL_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-ink-3 mb-2.5">
                      {group.title}
                    </p>
                    <ul className="space-y-2">
                      {group.items.map((f) => (
                        <li
                          key={f.label}
                          className="flex items-start gap-2 text-[13.5px] text-ink-2 font-medium leading-snug"
                        >
                          <CheckIcon />
                          <span>{f.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                href="/register?plan=essential"
                className="block text-center rounded-[14px] py-3.5 px-6 font-hanken font-bold text-[15px] bg-white/[0.08] text-ink border border-white/[0.16] hover:bg-white/[0.12] hover:border-white/[0.24] transition-all duration-300"
              >
                Démarrer avec Essentiel
              </Link>
              <p className="text-center text-[12px] text-ink-3 mt-3">
                Essai gratuit 14 jours · Sans carte bancaire
              </p>
            </div>
          </div>

          {/* ───────── Carte COMPLET (Recommandée) ───────── */}
          <div
            className="reveal reveal-delay-1 relative rounded-[24px] p-[1px] overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #3f7bff 65%, transparent) 0%, color-mix(in srgb, #ff7a1a 80%, transparent) 100%)",
            }}
          >
            <div className="relative rounded-[23px] bg-bgdark-2 p-[36px_28px] sm:p-[44px_36px] h-full flex flex-col overflow-hidden">
              {/* Blobs décoratifs */}
              <div
                aria-hidden
                className="absolute -top-24 -right-24 w-[260px] h-[260px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, #ff7a1a 26%, transparent) 0%, transparent 65%)",
                  filter: "blur(30px)",
                }}
              />

              <div className="relative z-[1] flex flex-col h-full">
                {/* Badge Recommandé */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[20px] font-[800] text-ink tracking-[-0.01em]">
                    Complet
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1.5 rounded-full border"
                    style={{
                      color: "#ffc79a",
                      background: "color-mix(in srgb, #ff7a1a 14%, transparent)",
                      borderColor: "color-mix(in srgb, #ff7a1a 38%, transparent)",
                    }}
                  >
                    ★ Recommandé
                  </span>
                </div>

                <p className="text-[14px] text-ink-3 font-medium leading-snug mb-4">
                  L&apos;Essentiel + le planning et l&apos;équipe. Pour qui jongle entre plusieurs chantiers.
                </p>

                {/* Prix */}
                <div className="mb-1.5">
                  <span className="text-[56px] sm:text-[64px] font-[800] text-accent-2 tracking-[-0.04em] leading-none tabular-nums">
                    25€
                  </span>
                  <span className="text-[18px] font-semibold text-ink-2 ml-1">
                    /mois HT
                  </span>
                </div>
                <p className="text-[13px] text-ink-3 mb-7">
                  Sans engagement · Résiliation à tout moment · Aucune limite
                </p>

                <div className="h-px w-full bg-white/[0.10] mb-7" />

                {/* En plus de l'Essentiel */}
                <p className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-accent-2 mb-3">
                  Tout l&apos;Essentiel + pour 10 € de plus :
                </p>
                <ul className="space-y-2.5 mb-6">
                  {COMPLETE_EXTRA_FEATURES.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-start gap-2.5 text-[14px] text-ink font-semibold leading-snug"
                    >
                      <StarIcon />
                      <span>
                        {f.label}
                        {f.badge ? (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-white/15 px-1.5 py-0.5 rounded font-bold align-middle">
                            {f.badge}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="h-px w-full bg-white/[0.06] mb-5" />

                {/* Rappel Essentiel */}
                <details className="mb-8 group/details">
                  <summary className="cursor-pointer text-[13px] text-ink-3 font-semibold hover:text-ink-2 transition flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-open/details:rotate-90"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Voir aussi les {ESSENTIAL_FLAT.length} fonctionnalités de l&apos;Essentiel
                  </summary>
                  <ul className="space-y-1.5 mt-3 pl-1">
                    {ESSENTIAL_FLAT.map((f) => (
                      <li
                        key={f.label}
                        className="flex items-start gap-2 text-[13px] text-ink-3 leading-snug"
                      >
                        <CheckIcon color="#2fd6a0" />
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="mt-auto">
                  {/* CTA */}
                  <Link
                    href="/register?plan=complete"
                    className="block text-center rounded-[14px] py-3.5 px-6 font-hanken font-bold text-[15px] bg-gradient-to-br from-accent-2 to-accent text-bgdark-ink shadow-[0_8px_30px_color-mix(in_srgb,var(--accent)_45%,transparent),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_14px_44px_color-mix(in_srgb,var(--accent)_60%,transparent),inset_0_1px_0_rgba(255,255,255,0.5)] transition-all duration-300"
                  >
                    Passer au Complet
                  </Link>
                  <p className="text-center text-[12px] text-ink-3 mt-3">
                    Essai gratuit 14 jours · Sans carte bancaire
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Note bas de section */}
        <p className="text-center mt-12 text-[13px] text-ink-3 font-medium">
          Vous pouvez passer de l&apos;Essentiel au Complet (et inversement) à tout moment depuis votre espace.
        </p>
      </div>
    </section>
  );
}
