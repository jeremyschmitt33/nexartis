"use client";

import RichText from "./RichText";

/**
 * MetierIntro — Longue intro éditoriale (150+ mots) + mots-clés secondaires
 * en bas en chips discrets.
 *
 * Ouvre l'article SEO juste après le hero. Apporte le premier paragraphe
 * long que les LLMs (ChatGPT/Perplexity) iront citer en priorité.
 *
 * Le texte longueIntro est parsé via RichText (markdown inline : **bold**
 * et [liens](/href)). Si le texte contient des doubles sauts de ligne
 * (`\n\n`), il est splitté en plusieurs paragraphes.
 */
export default function MetierIntro({
  nom,
  longueIntro,
  motsClesSecondaires,
}: {
  nom: string;
  longueIntro?: string;
  motsClesSecondaires?: string[];
}) {
  if (!longueIntro) return null;

  const paragraphs = longueIntro.split("\n\n").filter((p) => p.trim().length > 0);

  return (
    <section id="introduction" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
          Introduction
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Nexartis pour les {nom.toLowerCase()}s : pourquoi c&apos;est différent
      </h2>
      <div className="prose-metier mt-6">
        {paragraphs.map((para, i) => (
          <p
            key={i}
            className="mb-4 font-hanken text-base leading-relaxed text-[#0f1a3a]/80 last:mb-0 md:text-lg"
          >
            <RichText text={para} />
          </p>
        ))}
      </div>

      {motsClesSecondaires && motsClesSecondaires.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
            Aussi recherché
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {motsClesSecondaires.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-gray-100 px-3 py-1 font-hanken text-xs font-medium text-gray-600"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
