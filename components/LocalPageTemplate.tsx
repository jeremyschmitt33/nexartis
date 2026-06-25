"use client";
import Link from "next/link";

export interface LocalPageProps {
  ville: string;
  region: string;
  codePostal: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  specificite: string;
  temoignage: {
    quote: string;
    nom: string;
    metier: string;
    ville: string;
  };
}

const benefits = [
  {
    icon: "🏗️",
    title: "Conçu pour les artisans du bâtiment",
    text: "Devis, factures, planning — tout ce dont un artisan a besoin, sans les fonctions inutiles des logiciels généralistes.",
  },
  {
    icon: "💶",
    title: "Dès 15€/mois, sans engagement",
    text: "Deux offres claires sans engagement, pas de frais cachés. Un prix honnête pour tous les artisans.",
  },
  {
    icon: "⚡",
    title: "Facturation électronique intégrée",
    text: "Recevez les factures électroniques de vos fournisseurs dès l'obligation du 1er septembre 2026, et émettez les vôtres au format électronique pour l'échéance qui vous concerne (à partir de 2027).",
  },
  {
    icon: "📱",
    title: "Fonctionne sur le terrain",
    text: "Créez un devis depuis votre chantier, sur votre téléphone. Votre client signe sur le sien.",
  },
];

const features = [
  {
    icon: "📄",
    title: "Devis en quelques minutes",
    text: "Créez vos devis professionnels en quelques clics et envoyez-les par email. Votre client signe en ligne.",
  },
  {
    icon: "💶",
    title: "TVA automatique",
    text: "Les bons taux de TVA (5.5%, 10%, 20%) sont appliqués automatiquement selon le type de travaux.",
  },
  {
    icon: "📅",
    title: "Planning intelligent",
    text: "Organisez vos chantiers sur un calendrier visuel avec détection des conflits d'affectation.",
  },
  {
    icon: "🔔",
    title: "Relances impayés en 1 clic",
    text: "Repérez les factures en retard et envoyez un rappel poli au client en un clic, depuis votre tableau de bord.",
  },
  {
    icon: "📊",
    title: "Tableau de bord clair",
    text: "Chiffre d'affaires, factures en attente, prochains chantiers — en temps réel, depuis un tableau de bord clair.",
  },
  {
    icon: "🤝",
    title: "Signature électronique",
    text: "Vos clients signent vos devis directement depuis leur téléphone. Plus rapide, plus pro.",
  },
];

export default function LocalPageTemplate({
  ville,
  region,
  codePostal,
  h1,
  specificite,
  temoignage,
}: LocalPageProps) {
  const faqs = [
    {
      q: `Nexartis est-il utilisé par des artisans de ${ville} ?`,
      a: `Oui. Des artisans de ${ville} et de ${region} (${codePostal}) utilisent Nexartis au quotidien pour gérer leurs devis, factures et planning de chantiers.`,
    },
    {
      q: "Combien coûte Nexartis ?",
      a: "Deux offres : Essentiel à 15€/mois (devis et factures) ou Complet à 25€/mois (avec planning d'équipe et dictée vocale IA). Pas de frais cachés. 14 jours d'essai gratuit sans carte bancaire.",
    },
    {
      q: "Est-ce que je peux essayer avant de payer ?",
      a: "Oui. 14 jours d'essai complet, gratuit, sans entrer votre carte bancaire. Vous avez accès à tout pendant ces 14 jours.",
    },
    {
      q: `Y a-t-il un support pour les artisans de ${ville} ?`,
      a: `Notre support est disponible pour tous les artisans, y compris ceux de ${ville}. Vous pouvez nous contacter par email, du lundi au vendredi de 9h à 18h.`,
    },
    {
      q: "Nexartis est-il prêt pour la facturation électronique ?",
      a: "Oui. La réception des factures électroniques de vos fournisseurs est déjà active dans Nexartis — c'est l'obligation qui démarre le 1er septembre 2026. L'émission de vos propres factures au format électronique est prête pour l'échéance qui vous concerne (à partir du 1er septembre 2027). Nexartis passe par une plateforme agréée.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-navy py-20 lg:py-28">
        <div
          className="absolute left-10 top-10 h-72 w-72 rounded-full bg-sky/5 blur-3xl"
        />
        <div
          className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-orange/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"
          >
            <span className="text-lg">📍</span>
            <span className="font-manrope text-sm font-semibold text-white/80">
              {ville} &middot; {region} ({codePostal})
            </span>
          </div>

          <h1
            className="font-syne text-3xl font-extrabold text-white md:text-4xl lg:text-5xl"
          >
            {h1}
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl font-manrope text-lg text-white/75"
          >
            {specificite}
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/register"
              className="inline-flex h-14 items-center rounded-xl bg-orange px-8 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover"
            >
              Essai gratuit 14 jours &rarr;
            </Link>
            <span className="font-manrope text-sm text-white/50">
              Sans carte bancaire
            </span>
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2
            className="text-center font-syne text-2xl font-extrabold text-navy md:text-3xl"
          >
            Pourquoi les artisans de {ville} choisissent Nexartis
          </h2>

          <div
            className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="text-4xl leading-none">{b.icon}</span>
                <h3 className="mt-4 font-syne text-lg font-bold text-navy">
                  {b.title}
                </h3>
                <p className="mt-2 font-manrope text-sm leading-relaxed text-navy/60">
                  {b.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="bg-cream py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2
            className="text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Tout ce qu&apos;il vous faut, dans un seul logiciel
          </h2>

          <div
            className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col rounded-2xl border border-navy/5 bg-white p-8 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="text-4xl leading-none">{f.icon}</span>
                <h3 className="mt-5 font-syne text-lg font-bold text-navy">
                  {f.title}
                </h3>
                <p className="mt-3 flex-1 font-manrope text-sm leading-relaxed text-navy/60">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div
          >
            <span className="mb-6 inline-block text-5xl text-gold">&ldquo;</span>
            <blockquote className="font-manrope text-xl leading-relaxed text-navy/80 italic md:text-2xl">
              {temoignage.quote}
            </blockquote>
            <div className="mt-8">
              <p className="font-syne text-base font-bold text-navy">
                {temoignage.nom}
              </p>
              <p className="font-manrope text-sm text-navy/50">
                {temoignage.metier} &mdash; {temoignage.ville}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2
            className="mb-14 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Questions fréquentes &mdash; {ville}
          </h2>

          <div className="mx-auto max-w-3xl">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group border-b border-navy/10 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-navy py-20 lg:py-28">
        <div
          className="absolute left-10 top-10 h-72 w-72 rounded-full bg-sky/5 blur-3xl"
        />
        <div
          className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-orange/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-6">
          <div
            className="flex flex-col items-center text-center"
          >
            <h2 className="mb-4 font-syne text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
              Rejoignez les artisans de {ville} sur Nexartis
            </h2>
            <p className="mb-10 max-w-lg font-manrope text-lg font-light text-gray-400">
              14 jours d&apos;essai gratuit. Sans carte bancaire. Sans
              engagement.
            </p>

            <form
              className="flex w-full max-w-xl flex-col gap-4 sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Votre adresse email"
                className="h-16 flex-1 rounded-xl bg-white px-6 font-manrope text-lg text-navy placeholder-gray-400 outline-none focus:ring-2 focus:ring-sky"
              />
              <button
                type="submit"
                className="h-16 shrink-0 rounded-xl bg-orange px-8 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover"
              >
                Commencer gratuitement &rarr;
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
