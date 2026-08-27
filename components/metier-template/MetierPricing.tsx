"use client";
import Link from "next/link";

interface MetierPricingProps {
  nom: string;
  nomPluriel: string;
}

const essentielFeatures = [
  "Devis et factures illimités",
  "Signature électronique client",
  "Facturation électronique intégrée",
  "TVA BTP automatique",
  "Export PDF + CSV comptable (à venir)",
  "Suivi des impayés et relance en 1 clic",
];

const completFeatures = [
  "Tout l’Essentiel +",
  "Planning d’équipe et chantiers",
  "Gestion intervenants illimités",
  "Dictée vocale IA (devis depuis le chantier)",
  "Matériel & déchèteries",
  "Support prioritaire",
];

export default function MetierPricing({ nom, nomPluriel }: MetierPricingProps) {
  return (
    <section className="bg-[#0f1a3a] py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5">
            <span className="font-spline-mono text-xs font-bold uppercase tracking-wider text-[#ff7a1a]">
              Tarifs honnêtes
            </span>
          </div>
          <h2 className="font-hanken text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Deux offres simples pour les {nomPluriel.toLowerCase()}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-hanken text-base text-white/65">
            Pas de devis sur mesure, pas de surprise. Le prix affiché est le prix payé.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Essentiel */}
          <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <p className="font-hanken text-sm font-semibold uppercase tracking-wider text-white/55">
              Essentiel
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-spline-mono text-5xl font-extrabold text-white">15€</span>
              <span className="font-hanken text-sm text-white/55">/ mois HT</span>
            </div>
            <p className="mt-2 font-hanken text-sm text-white/60">
              Pour le {nom.toLowerCase()} qui veut un outil simple, propre et conforme.
            </p>

            <ul className="mt-6 space-y-3">
              {essentielFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 font-hanken text-sm text-white/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a]/15 text-[#ff7a1a]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 font-hanken text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/10"
            >
              Commencer Essentiel
            </Link>
          </div>

          {/* Complet */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[#ff7a1a]/40 bg-gradient-to-br from-[#ff7a1a]/10 via-white/[0.03] to-transparent p-8 shadow-2xl shadow-[#ff7a1a]/10">
            <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#ff7a1a] px-3 py-1 font-hanken text-xs font-bold uppercase tracking-wider text-white">
              Recommandé
            </div>
            <p className="font-hanken text-sm font-semibold uppercase tracking-wider text-[#ff7a1a]">
              Complet
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-spline-mono text-5xl font-extrabold text-white">25€</span>
              <span className="font-hanken text-sm text-white/55">/ mois HT</span>
            </div>
            <p className="mt-2 font-hanken text-sm text-white/70">
              Pour le {nom.toLowerCase()} qui pilote son activité et son équipe.
            </p>

            <ul className="mt-6 space-y-3">
              {completFeatures.map((f, idx) => (
                <li key={f} className="flex items-start gap-3 font-hanken text-sm text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a] text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span className={idx === 0 ? "font-semibold" : ""}>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[#ff7a1a] px-6 font-hanken text-sm font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition-all hover:bg-[#f09050]"
            >
              Commencer Complet
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center font-hanken text-sm text-white/45">
          14 jours d&apos;essai gratuit · Sans carte bancaire · Annulation en 1 clic
        </p>
      </div>
    </section>
  );
}
