"use client";

import RichText from "../metier-template/RichText";

/**
 * LocalParticularites — Liste éditoriale des spécificités locales BTP.
 *
 * Affichage en grille de cards 2 colonnes avec accent orange.
 * Chaque ligne accepte du markdown inline (RichText : bold, liens).
 */
export default function LocalParticularites({
  ville,
  particularitesLocales,
}: {
  ville: string;
  particularitesLocales?: string[];
}) {
  if (!particularitesLocales || particularitesLocales.length === 0) return null;

  return (
    <section id="particularites" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f7bff]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#2d5cd4]">
          Particularités locales
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Ce qui rend le BTP {ville} spécifique
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Climat, patrimoine, marché : les contraintes que vous connaissez et que Nexartis prend en compte dans vos devis.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {particularitesLocales.map((point, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a]/10 font-spline-mono text-sm font-bold text-[#ff7a1a]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="flex-1 font-hanken text-sm leading-relaxed text-[#0f1a3a]/85 md:text-base">
              <RichText text={point} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
