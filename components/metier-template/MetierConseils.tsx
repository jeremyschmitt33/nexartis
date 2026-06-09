"use client";

/**
 * MetierConseils — Section "Bon à savoir" : 3-5 conseils éditoriaux pour
 * rédiger un devis ou une facture propre dans ce métier (mention décennale,
 * acompte recommandé, délai d'exécution, etc.).
 *
 * Callout stylisé V4 : fond beige clair, bordure gauche orange, icône ampoule.
 */
export default function MetierConseils({
  conseilsRedaction,
}: {
  conseilsRedaction?: string[];
}) {
  if (!conseilsRedaction || conseilsRedaction.length === 0) return null;

  return (
    <section className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-[#ff7a1a]/20 bg-gradient-to-br from-[#fef6ef] via-white to-white">
        <div className="relative p-6 md:p-8">
          <span
            aria-hidden="true"
            className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-[#ff7a1a]"
          />
          <div className="pl-4 md:pl-6">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-xl">💡</span>
              <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
                Bon à savoir
              </p>
            </div>
            <h3 className="mt-2 font-hanken text-xl font-bold text-[#0f1a3a]">
              Les conseils des artisans qui rédigent bien leurs devis
            </h3>
            <ul className="mt-5 space-y-3">
              {conseilsRedaction.map((conseil, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 font-hanken text-base leading-relaxed text-[#0f1a3a]/80"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff7a1a]"
                  />
                  <span>{conseil}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
