"use client";

import { useState } from "react";

// V4 landing dark — section FAQ.
// Anti-mensonge applique :
// - Q4 (Factur-X) : retrait du "certifie conforme" -> phrase honnete sur l'integration progressive
// - Q8 (donnees) : "France" -> "Union europeenne (Allemagne)" + format export PDF/CSV

const faqs = [
  {
    q: "Nexartis est-il accessible si je n'utilise pas beaucoup les outils informatiques ?",
    a: "Nexartis a ete concu specifiquement pour les artisans, qu'ils soient ou non a l'aise avec les outils numeriques. La prise en main est guidee pas a pas. En regle generale, les premiers devis sont crees dans les dix minutes suivant l'inscription.",
  },
  {
    q: "L'application Nexartis est-elle disponible sur smartphone ?",
    a: "Oui, sur tous les telephones Android et iPhone via votre navigateur. Nexartis est une application web responsive qui fonctionne aussi bien sur un telephone que sur un ordinateur. Vous pouvez creer un devis depuis votre chantier.",
  },
  {
    q: "Est-il possible d'essayer Nexartis avant de souscrire ?",
    a: "Oui. 14 jours d'essai complet, gratuit, sans entrer votre carte bancaire. Vous avez acces a tout pendant ces 14 jours.",
  },
  {
    q: "Nexartis est-il conforme a la reforme de la facturation electronique 2026 ?",
    a: "La reforme entre en vigueur progressivement a partir de septembre 2026. Nexartis integre actuellement le format Factur-X pour etre pret avant l'echeance qui vous concerne, et toutes vos factures incluent deja les mentions legales obligatoires francaises.",
  },
  {
    q: "Comment resilier mon abonnement Nexartis ?",
    a: "La resiliation s'effectue directement depuis votre espace Nexartis, sans formulaire, sans appel telephonique et sans penalite.",
  },
  {
    q: "Comment fonctionne le planning de chantier Nexartis ?",
    a: "Vous voyez tous vos chantiers sur une semaine, avec des couleurs differentes pour chaque client. Vous pouvez deplacer un chantier en le glissant avec votre doigt. Si vous essayez de mettre deux personnes au meme endroit le meme jour, Nexartis vous previent avec une alerte orange.",
  },
  {
    q: "Nexartis gere-t-il les equipes avec plusieurs intervenants ?",
    a: "Nexartis inclut la gestion de votre equipe. Chaque membre de votre equipe recoit son planning sur son telephone. Tout le monde sait ou il doit aller et quand.",
  },
  {
    q: "Ou sont hebergees mes donnees et comment sont-elles protegees ?",
    a: "Vos donnees sont hebergees dans l'Union europeenne (Allemagne), sur des serveurs conformes RGPD. Elles ne sont jamais vendues. Vous pouvez les exporter a tout moment au format PDF ou CSV.",
  },
  {
    q: "Nexartis peut-il remplacer mon expert-comptable ?",
    a: "Non, et ce n'est pas son but. Nexartis vous aide a creer vos devis et factures, et a les envoyer a votre comptable en un clic au format qu'il utilise. Ca lui fait gagner du temps, et donc ca vous coute moins cher.",
  },
  {
    q: "Comment Nexartis propose-t-il autant de fonctionnalites a 25 € par mois ?",
    a: "Nous pensons qu'un bon logiciel artisan ne devrait pas couter le prix d'un repas au restaurant par semaine. Nous avons decide de rendre tous les outils accessibles a un prix honnete, sans version premium, sans mauvaise surprise.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section
      id="faq"
      className="landing-section bg-transparent py-[100px] px-5 lg:px-10"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
        <div className="text-center mb-[60px] reveal">
          <span
            className="landing-eyebrow mb-5"
            style={{
              color: "#9fc0ff",
              background: "color-mix(in srgb, #3f7bff 12%, transparent)",
              borderColor: "color-mix(in srgb, #3f7bff 30%, transparent)",
            }}
          >
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
            FAQ
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Vos questions, repondues simplement
          </h2>
        </div>

        {/* FAQ list */}
        <div className="mx-auto max-w-[780px] flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border bg-white/[0.04] overflow-hidden transition-colors duration-300 ${
                  open
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/[0.08]"
                }`}
              >
                <button
                  id={`faq-question-${i}`}
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full flex items-center gap-4 text-left px-5 py-5 text-[16.5px] font-bold text-ink hover:text-white transition-colors"
                >
                  <span className="flex-1">{faq.q}</span>
                  {/* Plus/Cross animé */}
                  <span
                    aria-hidden
                    className="relative w-6 h-6 flex-none"
                  >
                    <span
                      className="absolute left-1/2 top-1/2 w-[13px] h-[2px] rounded bg-accent -translate-x-1/2 -translate-y-1/2"
                    />
                    <span
                      className="absolute left-1/2 top-1/2 w-[2px] h-[13px] rounded bg-accent -translate-x-1/2 -translate-y-1/2 transition-transform duration-300"
                      style={{ transform: open ? "translate(-50%, -50%) scaleY(0)" : "translate(-50%, -50%) scaleY(1)" }}
                    />
                  </span>
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                  className="overflow-hidden transition-[max-height] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    maxHeight: open ? "320px" : "0px",
                  }}
                >
                  <p className="px-5 pb-5 text-[15px] text-ink-2 leading-[1.7] font-medium">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
