"use client";

import RichText from "../metier-template/RichText";

/**
 * LocalFAQ — Accordéon FAQ V4 Édition Signature pour les pages locales.
 *
 * Utilise <details>/<summary> natif (accessible, SEO-friendly).
 * faqCustom prioritaire, fallback générique local.
 */
export default function LocalFAQ({
  ville,
  region,
  codePostal,
  faqCustom,
}: {
  ville: string;
  region: string;
  codePostal: string;
  faqCustom?: { question: string; answer: string }[];
}) {
  const faqsDefault = [
    {
      q: `Nexartis est-il utilisé par des artisans de ${ville} ?`,
      a: `Oui. Des artisans de ${ville} et de ${region} (${codePostal}) utilisent Nexartis au quotidien pour gérer leurs devis, factures et planning de chantiers.`,
    },
    {
      q: "Combien coûte Nexartis ?",
      a: "Deux offres : Essentiel à **15€/mois** (devis et factures) ou Complet à **25€/mois** (avec planning d'équipe et dictée vocale IA). Pas de frais cachés. 14 jours d'essai gratuit sans carte bancaire.",
    },
    {
      q: "Est-ce que je peux essayer avant de payer ?",
      a: "Oui. **14 jours d'essai complet, gratuit, sans carte bancaire**. Vous avez accès à tout pendant ces 14 jours.",
    },
    {
      q: `Y a-t-il un support pour les artisans de ${ville} ?`,
      a: `Notre support est disponible pour tous les artisans, y compris ceux de ${ville}. Vous pouvez nous contacter par email à contact.nexartis@gmail.com pendant les heures ouvrées (8h-18h, du lundi au vendredi).`,
    },
    {
      q: "Est-ce qu'Nexartis est conforme à la réglementation Factur-X ?",
      a: "Oui. **Factur-X 2026** est intégré nativement. Vos factures sont émises en PDF avec XML embarqué, conforme à la nouvelle obligation française.",
    },
  ];

  const faqs =
    faqCustom && faqCustom.length > 0
      ? [
          ...faqCustom.map((f) => ({ q: f.question, a: f.answer })),
          ...faqsDefault.slice(0, Math.max(0, 8 - faqCustom.length)),
        ]
      : faqsDefault;

  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f7bff]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#2d5cd4]">
          Questions fréquentes
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Questions fréquentes — {ville}
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Les réponses concrètes que les artisans de {ville} nous posent le plus souvent.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {faqs.map((faq, i) => (
          <details
            key={i}
            className="group border-b border-gray-100 last:border-b-0 open:bg-[#fef6ef]/30"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-hanken text-base font-bold text-[#0f1a3a] transition-colors hover:bg-gray-50/60 [&::-webkit-details-marker]:hidden md:px-8 md:text-lg">
              <span className="flex-1">{faq.q}</span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a]/10 text-[#ff7a1a] transition-transform group-open:rotate-180"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            </summary>
            <div className="px-6 pb-6 md:px-8">
              {faq.a.split("\n\n").filter((p) => p.trim().length > 0).map((para, idx) => (
                <p
                  key={idx}
                  className="mb-3 font-hanken text-base leading-relaxed text-[#0f1a3a]/75 last:mb-0"
                >
                  <RichText text={para} />
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
