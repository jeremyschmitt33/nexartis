"use client";
import Link from "next/link";

export interface MetierPageProps {
  nom: string;
  nomPluriel: string;
  icon: string;
  h1: string;
  metaTitle?: string;
  metaDescription?: string;
  tvaNotes: string;
  prestationsExemples: string[];
  keywordPrincipal?: string;
  specificite: string;
}

const features = [
  {
    icon: "📄",
    title: "Devis en quelques minutes",
    text: "Créez vos devis professionnels en quelques clics. Vos clients signent électroniquement depuis leur téléphone.",
  },
  {
    icon: "💶",
    title: "TVA automatique",
    text: "Les bons taux de TVA sont appliqués automatiquement selon le type de travaux. Plus de calculs à la main.",
  },
  {
    icon: "⚡",
    title: "Prêt pour Factur-X 2026",
    text: "La facture électronique devient obligatoire pour le BTP. Nexartis est prêt pour la facturation électronique 2026.",
  },
  {
    icon: "📅",
    title: "Planning intelligent",
    text: "Organisez vos chantiers sur un calendrier visuel. Les conflits d'affectation sont détectés automatiquement.",
  },
  {
    icon: "🔔",
    title: "Suivi des impayés simplifié",
    text: "Repérez d'un coup d'œil les factures en retard et relancez vos clients en quelques clics. Réduisez vos délais de paiement.",
  },
  {
    icon: "📱",
    title: "Mobile & terrain",
    text: "Créez un devis depuis votre chantier, sur votre téléphone. Envoyez-le en quelques instants.",
  },
];

const allMetiers = [
  { nom: "Plombier", href: "/logiciel-devis-plombier" },
  { nom: "Électricien", href: "/logiciel-devis-electricien" },
  { nom: "Maçon", href: "/logiciel-devis-maconnerie" },
  { nom: "Menuisier", href: "/logiciel-devis-menuisier" },
  { nom: "Peintre", href: "/logiciel-devis-peintre" },
  { nom: "Paysagiste", href: "/logiciel-devis-paysagiste" },
  { nom: "Carreleur", href: "/logiciel-devis-carreleur" },
  { nom: "Couvreur", href: "/logiciel-devis-couvreur" },
  { nom: "Chauffagiste", href: "/logiciel-devis-chauffagiste" },
  { nom: "Auto-entrepreneur", href: "/logiciel-artisan-auto-entrepreneur" },
];

/**
 * Generate realistic prices for devis prestations.
 * Returns objects with unitPrice, qty, unit, tvaRate, and computed totals.
 */
function generateDevisLines(prestations: string[]) {
  const basePrices = [450, 280, 85, 520, 190, 350, 620, 150];
  const units = ["U", "Fft", "U", "Fft", "U", "Fft", "U", "Fft"];
  const qtys = [1, 1, 3, 1, 2, 1, 1, 4];

  return prestations.map((label, i) => {
    const unitPrice = basePrices[i % basePrices.length];
    const qty = qtys[i % qtys.length];
    const unit = units[i % units.length];
    // Alternate TVA: mostly 10%, last item at 20%
    const tvaRate = i === prestations.length - 1 ? 20 : 10;
    const totalHT = unitPrice * qty;
    return { label, unitPrice, qty, unit, tvaRate, totalHT };
  });
}

export default function MetierPageTemplate({
  nom,
  nomPluriel,
  icon,
  h1,
  tvaNotes,
  prestationsExemples,
  specificite,
}: MetierPageProps) {
  const faqs = [
    {
      q: `Est-ce qu'Nexartis est adapté aux ${nomPluriel.toLowerCase()} ?`,
      a: `Oui. Nexartis a été conçu pour les artisans du bâtiment, y compris les ${nomPluriel.toLowerCase()}. Les prestations, taux de TVA et modèles de devis sont préconfigurés pour votre métier.`,
    },
    {
      q: `Comment fonctionne la TVA pour les ${nomPluriel.toLowerCase()} dans Nexartis ?`,
      a: `${tvaNotes}. Nexartis applique automatiquement le bon taux selon le type de travaux. Vous n'avez qu'à choisir la prestation.`,
    },
    {
      q: "Combien coûte Nexartis ?",
      a: "Deux offres : Essentiel à 15€/mois (devis et factures) ou Complet à 25€/mois (avec planning d'équipe et dictée vocale IA). Pas de frais cachés. 14 jours d'essai gratuit sans carte bancaire.",
    },
    {
      q: "Est-ce que je peux envoyer mes factures à mon comptable ?",
      a: "Oui. Nexartis exporte vos factures au format que votre comptable utilise, en un clic. Ça lui fait gagner du temps et ça vous coûte moins cher.",
    },
    {
      q: `Puis-je importer mes anciens devis de ${nom.toLowerCase()} ?`,
      a: "Oui. Vous pouvez importer vos prestations habituelles depuis un fichier Excel ou les saisir manuellement. En général, la mise en place prend moins de 15 minutes.",
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

  // Devis lines
  const devisLines = generateDevisLines(prestationsExemples);
  const totalHT = devisLines.reduce((sum, l) => sum + l.totalHT, 0);
  const tva10Lines = devisLines.filter((l) => l.tvaRate === 10);
  const tva20Lines = devisLines.filter((l) => l.tvaRate === 20);
  const tva10Amount = tva10Lines.reduce((sum, l) => sum + l.totalHT * 0.1, 0);
  const tva20Amount = tva20Lines.reduce((sum, l) => sum + l.totalHT * 0.2, 0);
  const totalTTC = totalHT + tva10Amount + tva20Amount;

  const formatPrice = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Other trades for internal linking
  const autresMetiers = allMetiers.filter(
    (m) => m.nom.toLowerCase() !== nom.toLowerCase()
  );

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

        <div className="relative mx-auto max-w-5xl px-6">
          {/* Breadcrumb */}
          <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-white/60">
            <ol className="flex items-center gap-1">
              <li>
                <Link href="/" className="underline underline-offset-2 hover:text-white/80 transition-colors">
                  Accueil
                </Link>
              </li>
              <li aria-hidden="true" className="mx-1">&gt;</li>
              <li>
                <span>Métiers</span>
              </li>
              <li aria-hidden="true" className="mx-1">&gt;</li>
              <li>
                <span className="font-bold text-white/90">{nom}</span>
              </li>
            </ol>
          </nav>

          <div className="text-center">
            <span
              className="mb-4 inline-block text-6xl"
            >
              {icon}
            </span>

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
        </div>
      </section>

      {/* ── TVA Section ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div
          >
            <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
              TVA {nom.toLowerCase()} : les taux appliqués automatiquement
            </h2>
            <p className="mt-4 font-manrope text-base leading-relaxed text-navy/75">
              {tvaNotes}
            </p>
            <div className="mt-6 rounded-xl border border-navy/10 bg-white p-6">
              <p className="font-manrope text-sm font-semibold text-navy/60 uppercase tracking-wider">
                Comment Nexartis vous aide
              </p>
              <p className="mt-2 font-manrope text-base leading-relaxed text-navy/80">
                Quand vous créez un devis, Nexartis pré-remplit le bon taux de TVA
                pour chaque ligne de prestation. Vous pouvez toujours le modifier
                si besoin, mais dans 90% des cas, le taux proposé est le bon.
                Simplifiez les échanges avec votre expert-comptable grâce à des exports conformes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Professional Devis Example ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div
          >
            <h2 className="text-center font-syne text-2xl font-extrabold text-navy md:text-3xl">
              Exemple de devis {nom.toLowerCase()}
            </h2>
            <p className="mt-3 text-center font-manrope text-base text-navy/60">
              Voici à quoi ressemble un devis créé avec Nexartis
            </p>

            {/* Devis document */}
            <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
              {/* Header: Company + Devis info */}
              <div className="border-b border-gray-200 p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-6 sm:flex-row">
                  {/* Left: Company */}
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-lg font-bold text-white">
                      A
                    </div>
                    <p className="font-syne text-base font-bold text-navy">
                      SARL Artisan Pro
                    </p>
                    <p className="mt-1 font-manrope text-sm text-navy/60">
                      12 rue des Artisans
                    </p>
                    <p className="font-manrope text-sm text-navy/60">
                      33000 Bordeaux
                    </p>
                    <p className="mt-1 font-manrope text-xs text-navy/40">
                      SIRET : 123 456 789 00012
                    </p>
                    <p className="font-manrope text-xs text-navy/40">
                      Tél : 06 12 34 56 78
                    </p>
                  </div>

                  {/* Right: Devis info */}
                  <div className="text-left sm:text-right">
                    <p className="font-syne text-lg font-bold text-navy">
                      DEVIS N° 2026-0042
                    </p>
                    <p className="mt-1 font-manrope text-sm text-navy/60">
                      Date : 07/04/2026
                    </p>
                    <p className="font-manrope text-sm text-navy/60">
                      Valable jusqu&apos;au : 07/05/2026
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-sky/15 px-3 py-1 font-manrope text-xs font-semibold text-sky">
                      En attente de signature
                    </span>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4 sm:px-8">
                <p className="font-manrope text-xs font-semibold uppercase tracking-wider text-navy/40">
                  Client
                </p>
                <p className="mt-1 font-manrope text-sm font-semibold text-navy">
                  M. Jean Dupont
                </p>
                <p className="font-manrope text-sm text-navy/60">
                  45 allée des Pins
                </p>
                <p className="font-manrope text-sm text-navy/60">
                  33700 Mérignac
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-navy/5">
                      <th className="px-6 py-3 font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60 sm:px-8">
                        Désignation
                      </th>
                      <th className="px-3 py-3 text-center font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60">
                        Qté
                      </th>
                      <th className="px-3 py-3 text-center font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60">
                        Unité
                      </th>
                      <th className="px-3 py-3 text-right font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60">
                        P.U. HT
                      </th>
                      <th className="px-3 py-3 text-center font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60">
                        TVA
                      </th>
                      <th className="px-6 py-3 text-right font-manrope text-xs font-semibold uppercase tracking-wider text-navy/60 sm:px-8">
                        Total HT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {devisLines.map((line, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 ${
                          i % 2 === 1 ? "bg-gray-50/30" : ""
                        }`}
                      >
                        <td className="px-6 py-3 font-manrope text-sm text-navy/80 sm:px-8">
                          {line.label}
                        </td>
                        <td className="px-3 py-3 text-center font-manrope text-sm text-navy/70">
                          {line.qty}
                        </td>
                        <td className="px-3 py-3 text-center font-manrope text-sm text-navy/70">
                          {line.unit}
                        </td>
                        <td className="px-3 py-3 text-right font-manrope text-sm text-navy/70">
                          {formatPrice(line.unitPrice)} €
                        </td>
                        <td className="px-3 py-3 text-center font-manrope text-sm text-navy/70">
                          {line.tvaRate}%
                        </td>
                        <td className="px-6 py-3 text-right font-manrope text-sm font-semibold text-navy sm:px-8">
                          {formatPrice(line.totalHT)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 px-6 py-5 sm:px-8">
                <div className="ml-auto max-w-xs space-y-2">
                  <div className="flex justify-between font-manrope text-sm text-navy/70">
                    <span>Total HT</span>
                    <span>{formatPrice(totalHT)} €</span>
                  </div>
                  {tva10Lines.length > 0 && (
                    <div className="flex justify-between font-manrope text-sm text-navy/70">
                      <span>TVA 10%</span>
                      <span>{formatPrice(tva10Amount)} €</span>
                    </div>
                  )}
                  {tva20Lines.length > 0 && (
                    <div className="flex justify-between font-manrope text-sm text-navy/70">
                      <span>TVA 20%</span>
                      <span>{formatPrice(tva20Amount)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-syne text-lg font-extrabold text-navy">
                    <span>Total TTC</span>
                    <span className="text-orange">{formatPrice(totalTTC)} €</span>
                  </div>
                </div>
              </div>

              {/* Conditions + Signature */}
              <div className="border-t border-gray-200 bg-gray-50/50 px-6 py-5 sm:px-8">
                <div className="space-y-1">
                  <p className="font-manrope text-xs text-navy/50">
                    Conditions de paiement : 30% à la commande, solde à la réception des travaux
                  </p>
                  <p className="font-manrope text-xs text-navy/50">
                    Délai d&apos;intervention : 5 à 10 jours ouvrés
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-6">
                  <div className="flex-1 rounded-lg border border-dashed border-navy/20 p-4 text-center">
                    <p className="font-manrope text-xs font-semibold text-navy/40">
                      Signature électronique
                    </p>
                    <p className="mt-2 font-manrope text-xs italic text-navy/30">
                      En attente...
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg border border-dashed border-navy/20 p-4 text-center">
                    <p className="font-manrope text-xs font-semibold text-navy/40">
                      Bon pour accord
                    </p>
                    <p className="mt-2 font-manrope text-xs italic text-navy/30">
                      En attente...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="bg-navy py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2
            className="text-center font-syne text-2xl font-extrabold text-white md:text-3xl lg:text-4xl"
          >
            Les fonctionnalités dont les {nomPluriel.toLowerCase()} ont besoin
          </h2>

          <div
            className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col rounded-2xl bg-navy-mid p-8 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="text-4xl leading-none">{f.icon}</span>
                <h3 className="mt-5 font-syne text-lg font-bold text-white">
                  {f.title}
                </h3>
                <p className="mt-3 flex-1 font-manrope text-sm leading-relaxed text-white/75">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead Magnet ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div
          >
            <span className="mb-4 inline-block text-5xl">{icon}</span>
            <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
              Téléchargez un modèle de devis professionnel pour{" "}
              {nomPluriel.toLowerCase()} — Format PDF, prêt à l&apos;emploi
            </h2>
            <p className="mt-3 font-manrope text-base text-navy/60">
              Un modèle professionnel au format PDF, prêt à remplir. Gratuit et
              sans engagement.
            </p>

            <form
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Votre adresse email"
                className="h-14 flex-1 rounded-xl border border-navy/10 bg-white px-5 font-manrope text-base text-navy placeholder-gray-400 outline-none focus:ring-2 focus:ring-sky"
              />
              <button
                type="submit"
                className="h-14 shrink-0 rounded-xl bg-orange px-6 font-syne text-base font-bold text-white transition-colors hover:bg-orange-hover"
              >
                Recevoir le modèle
              </button>
            </form>

            <p className="mt-4 font-manrope text-xs text-navy/40">
              Vos données restent privées. Aucun spam.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2
            className="mb-14 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Questions fréquentes — {nomPluriel}
          </h2>

          <div className="mx-auto max-w-3xl">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group border-b border-gray-200 py-5"
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

      {/* ── Autres métiers du bâtiment ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div
          >
            <h2 className="mb-8 text-center font-syne text-2xl font-bold text-navy md:text-3xl">
              Autres métiers du bâtiment
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {autresMetiers.map((metier) => (
                <Link
                  key={metier.href}
                  href={metier.href}
                  className="rounded-full border border-navy/15 bg-white px-5 py-2.5 font-manrope text-sm font-medium text-navy transition-all hover:border-sky hover:bg-sky/10 hover:text-sky"
                >
                  {metier.nom}
                </Link>
              ))}
            </div>
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
              Prêt à simplifier votre quotidien de {nom.toLowerCase()} ?
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
