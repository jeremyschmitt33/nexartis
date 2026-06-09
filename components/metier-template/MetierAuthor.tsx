"use client";

/**
 * MetierAuthor — Bio auteur en fin d'article (Jérémy Schmitt, fondateur).
 *
 * Pas d'avatar disponible côté assets : on génère les initiales sur un
 * gradient orange/navy fidèle à la palette V4. Ce bloc termine l'article
 * et apporte de la confiance (auteur identifié, expert métier).
 */
export default function MetierAuthor() {
  return (
    <section className="mt-20 border-t border-gray-100 pt-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col items-start gap-5 md:flex-row md:gap-6">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] font-hanken text-xl font-extrabold text-white shadow-lg shadow-[#ff7a1a]/20"
          >
            JS
          </div>
          <div className="flex-1">
            <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
              À propos de l&apos;auteur
            </div>
            <div className="mt-1 font-hanken text-lg font-bold text-[#0f1a3a]">
              Jérémy Schmitt
            </div>
            <div className="font-hanken text-sm font-semibold text-[#ff7a1a]">
              Fondateur de Nexartis, à l&apos;écoute des artisans du BTP
            </div>
            <p className="mt-3 font-hanken text-sm leading-relaxed text-[#0f1a3a]/70">
              Jérémy Schmitt a fondé Nexartis avec une obsession : créer le
              logiciel ultime pour les artisans français. En écoutant chaque
              jour les besoins du terrain — devis, factures, planning,
              chantiers — il développe un outil pensé pour leur réalité
              quotidienne.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
