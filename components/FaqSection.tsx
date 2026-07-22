"use client";

import { useState } from "react";

// V4 landing dark — section FAQ.
// Anti-mensonge applique :
// - Q4 (e-facture) : reception des e-factures fournisseurs des 2026, emission prete pour 2027, plateforme agreee
// - Q8 (donnees) : "France" -> "Union europeenne (Allemagne)" + format export PDF/CSV

const faqs = [
  {
    q: "Nexartis est-il accessible si je n'utilise pas beaucoup les outils informatiques ?",
    a: "Nexartis a été conçu spécifiquement pour les artisans, qu'ils soient ou non à l'aise avec les outils numériques. La prise en main est guidée pas à pas. En règle générale, les premiers devis sont créés dans les dix minutes suivant l'inscription.",
  },
  {
    q: "L'application Nexartis est-elle disponible sur smartphone ?",
    a: "Oui, sur tous les téléphones Android et iPhone via votre navigateur. Nexartis est une application web responsive qui fonctionne aussi bien sur un téléphone que sur un ordinateur. Vous pouvez créer un devis depuis votre chantier.",
  },
  {
    q: "Est-il possible d'essayer Nexartis avant de souscrire ?",
    a: "Oui, et sans risque. 14 jours d'essai complet, gratuit, sans entrer votre carte bancaire. Vous testez tout, en conditions réelles, avant de décider.",
  },
  {
    q: "Nexartis est-il conforme à la réforme de la facturation électronique ?",
    a: "Oui. La réception des factures électroniques de vos fournisseurs est déjà active dans Nexartis — c'est l'obligation qui démarre le 1er septembre 2026. L'émission de vos propres factures au format électronique est prête pour l'échéance qui vous concerne (à partir du 1er septembre 2027 selon la taille de votre entreprise). Nexartis passe par une plateforme agréée.",
  },
  {
    q: "Comment résilier mon abonnement Nexartis ?",
    a: "La résiliation s'effectue directement depuis votre espace Nexartis, sans formulaire, sans appel téléphonique et sans pénalité.",
  },
  {
    q: "Comment fonctionne le planning de chantier Nexartis ?",
    a: "Vous voyez tous vos chantiers sur une semaine, avec des couleurs différentes pour chaque client. Vous pouvez déplacer un chantier en le glissant avec votre doigt. Si vous essayez de mettre deux personnes au même endroit le même jour, Nexartis vous prévient avec une alerte orange.",
  },
  {
    q: "Nexartis gère-t-il les équipes avec plusieurs intervenants ?",
    a: "Oui. Avec l'offre Complet, la gestion d'équipe et des intervenants (chefs de chantier, apprentis) est disponible dans un planning unifié, avec alertes en cas de conflit d'affectation.",
  },
  {
    q: "Où sont hébergées mes données et comment sont-elles protégées ?",
    a: "Vos données sont hébergées dans l'Union européenne (Allemagne), sur des serveurs conformes RGPD. Elles ne sont jamais vendues. Vous pouvez exporter chaque devis et facture au format PDF à tout moment.",
  },
  {
    q: "Nexartis peut-il remplacer mon expert-comptable ?",
    a: "Non, et ce n'est pas son but. Nexartis vous aide à créer vos devis et factures, et à les envoyer à votre comptable en un clic au format qu'il utilise. Ça lui fait gagner du temps, et donc ça vous coûte moins cher.",
  },
  {
    q: "Comment Nexartis propose-t-il autant de fonctionnalités à un prix aussi juste ?",
    a: "Parce qu'on pense qu'un bon logiciel artisan ne devrait pas coûter une fortune. On a fait le choix d'un prix honnête : 15 €/mois pour l'Essentiel, 25 €/mois pour le Complet (avec le planning et le devis vocal par IA). Pas de palier surprise, pas de frais cachés.",
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
            Tout ce que vous vous demandez, sans detour
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
