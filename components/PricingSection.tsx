"use client";

import Link from "next/link";

// V4 landing dark — section "Tarification".
// Anti-mensonge applique :
// - "Relances impayes automatiques" -> "Suivi des impayes simplifie"
// - "Application mobile iOS & Android" -> "Optimise pour smartphone et tablette"
// - "Facture electronique Factur-X (loi 2026)" -> "Pret pour Factur-X 2026"
// - "Donnees hebergees en France" -> "Donnees hebergees en Europe"
// - "Support par chat et email" -> "Support par email Lun-Ven 9h-18h"

const features = [
  "Devis illimites",
  "Factures illimitees",
  "Signature electronique",
  "Planning chantiers",
  "Alertes conflits equipe",
  "Tableau de bord CA",
  "Suivi des impayes simplifie",
  "Optimise pour smartphone et tablette",
  "Pret pour Factur-X 2026",
  "Bibliotheque de vos prestations",
  "TVA 5.5%, 10%, 20% automatique",
  "Attestations TVA renovation auto",
  "Acomptes et situations de travaux",
  "Avoirs et rectifications",
  "Export comptable (CSV/PDF)",
  "Donnees hebergees en Europe",
  "Support par email Lun-Ven 9h-18h",
  "Mises a jour incluses a vie",
  "Aucune limite de clients",
  "Aucune limite de chantiers",
];

export default function PricingSection() {
  return (
    <section
      id="tarifs"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
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
            Un abonnement unique. Tout est inclus.
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[560px] mx-auto">
            L&apos;integralite des outils pour gerer votre entreprise artisanale.
          </p>
        </div>

        {/* Pricing Card — bg-bgdark-2 avec bordure degradee bleu->orange */}
        <div className="mx-auto max-w-[860px] reveal">
          <div
            className="relative rounded-[28px] p-[1px] overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #3f7bff 60%, transparent) 0%, color-mix(in srgb, #ff7a1a 70%, transparent) 100%)",
            }}
          >
            <div className="relative rounded-[27px] bg-bgdark-2 p-[44px_28px] sm:p-[56px] overflow-hidden">
              {/* Decorative blobs */}
              <div
                aria-hidden
                className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, #3f7bff 22%, transparent) 0%, transparent 65%)",
                }}
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-24 w-[280px] h-[280px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, #ff7a1a 22%, transparent) 0%, transparent 65%)",
                }}
              />

              <div className="relative z-[1]">
                {/* Badge */}
                <div className="text-center mb-6">
                  <span
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-3.5 py-2 rounded-full border"
                    style={{
                      color: "#ffc79a",
                      background: "color-mix(in srgb, #ff7a1a 14%, transparent)",
                      borderColor: "color-mix(in srgb, #ff7a1a 32%, transparent)",
                    }}
                  >
                    ★ Tout inclus · Sans option cachee
                  </span>
                </div>

                {/* Price */}
                <div className="text-center mb-1.5">
                  <span className="text-[72px] sm:text-[80px] font-[800] text-accent-2 tracking-[-0.04em] leading-none tabular-nums">
                    25€
                  </span>
                  <span className="text-[20px] font-semibold text-ink-2 ml-1">
                    /mois HT
                  </span>
                </div>
                <p className="text-center text-[14px] text-ink-3 mb-10">
                  Sans engagement · Resiliation a tout moment · Aucune limite de clients ni de chantiers
                </p>

                <div className="h-px w-full bg-white/10 mb-10" />

                {/* Features grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 gap-x-8 mb-10">
                  {features.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2.5 text-[14px] text-ink-2 font-medium"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2fd6a0"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="flex-shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link href="/register" className="btn-pricing block text-center">
                  Commencer maintenant — 14 jours gratuits
                </Link>
                <p className="text-center text-[13px] text-ink-3 mt-4">
                  Aucune carte bancaire demandee. Annulez quand vous voulez.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
