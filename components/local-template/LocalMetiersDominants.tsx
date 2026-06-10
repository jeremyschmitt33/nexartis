"use client";

import RichText from "../metier-template/RichText";

/**
 * LocalMetiersDominants — Cards éditoriales des métiers BTP dominants en ville.
 *
 * Affichage en grille de cards avec puce numérotée, ancrant la page sur l'intent
 * "quels artisans à [ville]" et soutenant le maillage interne implicite.
 */
export default function LocalMetiersDominants({
  ville,
  metiersDominants,
}: {
  ville: string;
  metiersDominants?: string[];
}) {
  if (!metiersDominants || metiersDominants.length === 0) return null;

  return (
    <section id="metiers" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
          Métiers dominants
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Les artisans BTP les plus demandés à {ville}
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Les métiers qui tournent le plus selon le marché local.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-100">
          {metiersDominants.map((metier, i) => (
            <li
              key={i}
              className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[#fef6ef]/40 md:px-6 md:py-5"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] font-spline-mono text-xs font-bold text-white"
              >
                {i + 1}
              </span>
              <p className="flex-1 font-hanken text-sm leading-relaxed text-[#0f1a3a]/85 md:text-base">
                <RichText text={metier} />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
