"use client";

import Link from "next/link";

/**
 * LocalTarifs — Bloc tarifaire éditorial Essentiel / Complet.
 *
 * Affiche les 2 offres Nexartis avec features clés + CTA double.
 * Réplique le bloc Pricing du template métier en l'adaptant au contexte local.
 */
export default function LocalTarifs({ ville }: { ville: string }) {
  return (
    <section id="tarifs" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
          Tarifs &amp; abonnement
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Combien ça coûte pour un artisan à {ville} ?
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Deux offres claires, sans engagement. <strong className="font-semibold text-[#0f1a3a]">14 jours d&apos;essai gratuit</strong>, sans carte bancaire.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Essentiel */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-7">
          <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
            Essentiel
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-spline-mono text-4xl font-extrabold text-[#0f1a3a]">15€</span>
            <span className="font-hanken text-sm text-gray-500">HT/mois</span>
          </div>
          <p className="mt-3 font-hanken text-sm text-[#0f1a3a]/70">
            Devis et factures conformes BTP, illimités.
          </p>
          <ul className="mt-5 space-y-2.5 font-hanken text-sm text-[#0f1a3a]/80">
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Devis et factures illimités</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Mentions légales BTP automatiques (décennale, médiateur)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Signature électronique native</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Mentions Factur-X 2026 incluses</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Suivi des impayés et relance en 1 clic</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 font-hanken text-sm font-semibold text-[#0f1a3a] transition-all hover:border-[#ff7a1a]/30 hover:text-[#ff7a1a]"
          >
            Essayer Essentiel
          </Link>
        </div>

        {/* Complet — mis en avant */}
        <div className="relative flex flex-col rounded-2xl border-2 border-[#ff7a1a] bg-gradient-to-br from-[#fef6ef] to-white p-6 shadow-md md:p-7">
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-[#ff7a1a] px-3 py-1 font-hanken text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            Recommandé
          </span>
          <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
            Complet
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-spline-mono text-4xl font-extrabold text-[#0f1a3a]">25€</span>
            <span className="font-hanken text-sm text-gray-500">HT/mois</span>
          </div>
          <p className="mt-3 font-hanken text-sm text-[#0f1a3a]/70">
            Tout l&apos;Essentiel + planning, équipe et dictée vocale IA.
          </p>
          <ul className="mt-5 space-y-2.5 font-hanken text-sm text-[#0f1a3a]/80">
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span><strong className="font-semibold">Tout l&apos;Essentiel</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Planning chantier visuel</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Gestion d&apos;équipe (intervenants, conflits)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Dictée vocale IA (devis à la voix)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#ff7a1a]" aria-hidden="true">&#10003;</span>
              <span>Pacte de chantier (cadre clair client)</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#ff7a1a] px-5 font-hanken text-sm font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition-all hover:bg-[#f09050] hover:shadow-xl"
          >
            Essayer Complet
          </Link>
        </div>
      </div>

      <p className="mt-5 font-hanken text-xs text-gray-500">
        Pas de frais cachés. Résiliation en 1 clic. Voir le détail sur <Link href="/tarifs" className="font-semibold text-[#ff7a1a] underline decoration-[#ff7a1a]/30 hover:decoration-[#ff7a1a]">la page tarifs</Link>.
      </p>
    </section>
  );
}
