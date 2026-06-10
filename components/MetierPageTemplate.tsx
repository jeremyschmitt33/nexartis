"use client";

/**
 * MetierPageTemplate — Template V4 Édition Signature.
 *
 * Refonte : la page métier est désormais un VRAI article éditorial (style
 * BlogArticleLayout), pas une landing produit.
 *
 *  ─ Reading progress bar fixed-top (gradient orange V4)
 *  ─ Hero éditorial (eyebrow + h1 + lead + méta auteur/date/reading time)
 *  ─ Layout split desktop : TOC sticky (240px) | contenu (max 860px)
 *  ─ Sections SEO+GEO (intro, cas d'usage, TVA + tableau + 2026, devis exemple,
 *    conseils rédaction, certifications, prestations typiques, FAQ, maillage)
 *  ─ Bio auteur Jérémy Schmitt en fin d'article
 *  ─ Schemas JSON-LD : Article + BreadcrumbList + FAQPage
 *
 * Polices : font-hanken (titres/body) + font-spline-mono (tous les chiffres).
 * Aucun font-syne / font-manrope / font-jakarta dans ce template.
 *
 * Rétrocompat : toutes les props NOUVELLES sont optionnelles. Les 13 data
 * files existants continuent à fonctionner sans modification.
 */

import Link from "next/link";
import { METIER_SECTIONS, type MetierPageProps } from "./metier-template/types";
import MetierProgressBar from "./metier-template/MetierProgressBar";
import MetierTOC from "./metier-template/MetierTOC";
import MetierIntro from "./metier-template/MetierIntro";
import MetierCasUsage from "./metier-template/MetierCasUsage";
import MetierTvaSection from "./metier-template/MetierTvaSection";
import MetierDevisExample from "./metier-template/MetierDevisExample";
import MetierConseils from "./metier-template/MetierConseils";
import MetierCertifications from "./metier-template/MetierCertifications";
import MetierPrestations from "./metier-template/MetierPrestations";
import MetierFAQ from "./metier-template/MetierFAQ";
import MetierMaillage from "./metier-template/MetierMaillage";
import MetierAuthor from "./metier-template/MetierAuthor";

// Re-export pour rétrocompat (les data files importent ce type)
export type { MetierPageProps } from "./metier-template/types";

const AUTHOR_NAME = "Jérémy Schmitt";
const AUTHOR_ROLE = "Fondateur de Nexartis";
const PUBLISH_DATE = "2026-06-09";
const PUBLISH_DATE_FR = "9 juin 2026";
const READING_TIME = "10 min";

/**
 * Détecte le taux de TVA applicable à partir du libellé d'une prestation.
 * - 5,5% : rénovation énergétique éligible (RGE, PAC, IRVE, photovoltaïque,
 *          isolation, chaudière biomasse, etc.)
 * - 20%  : fourniture seule, construction neuve, extension, locaux pros, piscine
 * - 10%  : par défaut (entretien / amélioration logement > 2 ans)
 */
function detectTva(label: string): 5.5 | 10 | 20 {
  const l = label.toLowerCase();
  const k55 = [
    "rge", "pac", "pompe à chaleur", "pompe a chaleur",
    "irve", "borne de recharge", "borne irve",
    "photovoltaïque", "photovoltaique", "panneau solaire", "solaire thermique",
    "isolation", "ite", "iti", "calorifugeage",
    "chaudière biomasse", "chaudiere biomasse", "poêle à granulés", "poele a granules",
    "vmc double flux", "ballon thermodynamique", "thermodynamique",
    "rénovation énergétique", "renovation energetique",
    "doublage thermique", "doublage isolant",
  ];
  if (k55.some((k) => l.includes(k))) return 5.5;
  const k20 = [
    "fourniture seule", "fourniture seul",
    "construction neuve", "construction neuf",
    "extension", "agrandissement",
    "piscine", "local professionnel", "locaux pros", "bureau",
    "véranda", "veranda", "dépose ", "evacuation déchets",
  ];
  if (k20.some((k) => l.includes(k))) return 20;
  return 10;
}

/**
 * Génère un devis exemple à partir de prestationsExemples.
 * TVA déterminée intelligemment par detectTva (5,5% / 10% / 20%).
 */
function buildDevisExample(prestations: string[]) {
  const basePrices = [450, 280, 85, 520, 190, 350, 620, 150];
  const units = ["U", "Fft", "U", "Fft", "U", "Fft", "U", "Fft"];
  const qtys = [1, 1, 3, 1, 2, 1, 1, 4];

  // On limite à 5 lignes pour rester lisible
  const sliced = prestations.slice(0, 5);
  const lines = sliced.map((label, i) => {
    const unitPrice = basePrices[i % basePrices.length];
    const qty = qtys[i % qtys.length];
    const unit = units[i % units.length];
    const tvaRate = detectTva(label);
    return { label, unitPrice, qty, unit, tvaRate, totalHT: unitPrice * qty };
  });

  const totalHT = lines.reduce((s, l) => s + l.totalHT, 0);
  const tva55Lines = lines.filter((l) => l.tvaRate === 5.5);
  const tva10Lines = lines.filter((l) => l.tvaRate === 10);
  const tva20Lines = lines.filter((l) => l.tvaRate === 20);
  const tva55Amount = tva55Lines.reduce((s, l) => s + l.totalHT * 0.055, 0);
  const tva10Amount = tva10Lines.reduce((s, l) => s + l.totalHT * 0.1, 0);
  const tva20Amount = tva20Lines.reduce((s, l) => s + l.totalHT * 0.2, 0);
  const totalTTC = totalHT + tva55Amount + tva10Amount + tva20Amount;

  return {
    lines,
    totalHT,
    tva55Lines,
    tva10Lines,
    tva20Lines,
    tva55Amount,
    tva10Amount,
    tva20Amount,
    totalTTC,
  };
}

const formatPrice = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MetierPageTemplate(props: MetierPageProps) {
  const {
    nom,
    nomPluriel,
    icon,
    h1,
    tvaNotes,
    prestationsExemples,
    specificite,
    faqCustom,
    motsClesSecondaires,
    longueIntro,
    paragrapheTva,
    certifications,
    ancresMaillage,
    casUsage,
    tableauTva,
    reglementation2026,
    conseilsRedaction,
    metaTitle,
    metaDescription,
  } = props;

  const devis = buildDevisExample(prestationsExemples);

  // ── Schemas JSON-LD enrichis ──────────────────────────────────────────────
  const faqsForSchema = (() => {
    if (faqCustom && faqCustom.length > 0) {
      return faqCustom.map((f) => ({ q: f.question, a: f.answer }));
    }
    return [
      {
        q: `Est-ce qu'Nexartis est adapté aux ${nomPluriel.toLowerCase()} ?`,
        a: `Oui. Nexartis a été conçu pour les artisans du bâtiment, y compris les ${nomPluriel.toLowerCase()}.`,
      },
      {
        q: `Comment fonctionne la TVA pour les ${nomPluriel.toLowerCase()} ?`,
        a: `${tvaNotes}. Nexartis applique automatiquement le bon taux.`,
      },
    ];
  })();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsForSchema.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  // Slug métier pour URL canonical (utilisé par Article + mainEntityOfPage)
  // ⚠️ Les pages métier ont le préfixe "logiciel-devis-" (ex: /logiciel-devis-plombier)
  // sauf pour les contextes locaux qui ont "logiciel-artisan-" (Bordeaux, Lyon, etc.)
  const metierSlug = nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Correspondances spéciales pour les slugs qui ne sont pas le nom direct
  const slugMap: Record<string, string> = {
    "macon": "logiciel-devis-maconnerie",
    "auto-entrepreneur": "logiciel-artisan-auto-entrepreneur",
  };
  const canonicalPath = slugMap[metierSlug] || `logiciel-devis-${metierSlug}`;
  const canonicalUrl = `https://nexartis.fr/${canonicalPath}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: metaTitle || h1,
    description: metaDescription || specificite,
    image: "https://nexartis.fr/og-image.jpg",
    datePublished: PUBLISH_DATE,
    dateModified: PUBLISH_DATE,
    author: {
      "@type": "Person",
      name: AUTHOR_NAME,
      jobTitle: AUTHOR_ROLE,
      url: "https://nexartis.fr",
    },
    publisher: {
      "@type": "Organization",
      name: "Nexartis",
      url: "https://nexartis.fr",
      logo: {
        "@type": "ImageObject",
        url: "https://nexartis.fr/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://nexartis.fr",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Métiers",
        item: "https://nexartis.fr/#metiers",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: nom,
      },
    ],
  };

  // ── Schemas GEO additionnels (citabilité LLM) ─────────────────────────────
  // Schema SoftwareApplication — Nexartis comme produit logiciel
  const softwareApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nexartis",
    description:
      "Logiciel devis facture artisan BTP français. Gestion devis, factures, planning chantier, équipe, conforme Factur-X 2026.",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Devis & Facturation",
    operatingSystem: "Web (Windows, macOS, Linux, iOS, Android)",
    url: "https://nexartis.fr",
    inLanguage: "fr-FR",
    offers: [
      {
        "@type": "Offer",
        name: "Essentiel",
        price: "15",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "15",
          priceCurrency: "EUR",
          unitText: "MONTH",
        },
        description:
          "Devis et factures illimités, mentions légales BTP automatiques, signature électronique, suivi des paiements.",
        availability: "https://schema.org/InStock",
        url: "https://nexartis.fr/tarifs",
      },
      {
        "@type": "Offer",
        name: "Complet",
        price: "25",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "25",
          priceCurrency: "EUR",
          unitText: "MONTH",
        },
        description:
          "Tout l'Essentiel + planning chantier visuel + gestion d'équipe + dictée vocale IA + chantiers + Pacte de chantier.",
        availability: "https://schema.org/InStock",
        url: "https://nexartis.fr/tarifs",
      },
    ],
    featureList: [
      "Devis conformes BTP en moins de 2 minutes",
      "TVA réduite automatique (5,5% / 10% / 20%)",
      "Mention décennale obligatoire automatique",
      "Conforme Factur-X 2026",
      "Signature électronique native",
      "Planning chantier visuel (offre Complet)",
      "Dictée vocale IA (offre Complet)",
      "Application installable PWA mobile",
      "Données hébergées en France/Europe RGPD",
    ],
    publisher: {
      "@type": "Organization",
      name: "Nexartis",
      url: "https://nexartis.fr",
      logo: {
        "@type": "ImageObject",
        url: "https://nexartis.fr/images/logo-nexartis.png",
      },
    },
  };

  // Schema Organization — Nexartis (global, plus complet que celui dans Article)
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://nexartis.fr/#organization",
    name: "Nexartis",
    url: "https://nexartis.fr",
    logo: {
      "@type": "ImageObject",
      url: "https://nexartis.fr/images/logo-nexartis.png",
      width: 512,
      height: 512,
    },
    description:
      "Logiciel français de devis-facture-planning pour artisans du BTP. Conçu à Bordeaux. Dès 15€ HT/mois.",
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Le Haillan",
        addressRegion: "Gironde",
        addressCountry: "FR",
      },
    },
    founder: {
      "@type": "Person",
      "@id": "https://nexartis.fr/#founder",
      name: "Jérémy Schmitt",
      jobTitle: "Fondateur de Nexartis",
      description:
        "À l'écoute des artisans du BTP, créateur du logiciel ultime pour leur quotidien.",
    },
    areaServed: {
      "@type": "Country",
      name: "France",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact.nexartis@gmail.com",
      availableLanguage: ["French"],
      areaServed: "FR",
    },
    knowsLanguage: "fr-FR",
    inLanguage: "fr-FR",
  };

  // Schema HowTo — créer un devis en 2 min
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Créer un devis ${nom.toLowerCase()} en 2 minutes avec Nexartis`,
    description: `Méthode rapide pour éditer un devis ${nom.toLowerCase()} conforme BTP depuis le chantier.`,
    totalTime: "PT2M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: "15",
    },
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Ouvrir Nexartis",
        text: "Lancez Nexartis depuis votre téléphone ou ordinateur. L'application est installable comme une PWA.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Sélectionner le client",
        text: "Choisissez un client existant ou créez-en un nouveau en quelques secondes.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Ajouter les prestations",
        text: "Sélectionnez vos prestations habituelles dans la bibliothèque, ou saisissez-les rapidement. Le bon taux de TVA s'applique automatiquement.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Envoyer pour signature",
        text: "Envoyez le devis par email. Votre client signe électroniquement depuis son téléphone.",
      },
    ],
  };

  // Eyebrow catégorie pour le hero éditorial
  const categoryLabel = `Métier · ${nom}`;

  return (
    <article className="bg-white text-[#0f1a3a]">
      {/* ═══════ JSON-LD ═══════ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      {/* ═══════ Reading progress bar ═══════ */}
      <MetierProgressBar />

      {/* ═══════ Hero éditorial ═══════ */}
      <header className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-[#f6f8fb] via-white to-[#fef6ef]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#ff7a1a]/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-[#3f7bff]/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-16 sm:px-8 md:pb-20 md:pt-24">
          {/* Breadcrumb */}
          <nav
            aria-label="Fil d'Ariane"
            className="mb-8 font-hanken text-sm text-gray-500"
          >
            <ol className="flex items-center gap-1.5">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-[#0f1a3a]"
                >
                  Accueil
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li>
                <Link
                  href="/#metiers"
                  className="transition-colors hover:text-[#0f1a3a]"
                >
                  Métiers
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li>
                <span className="font-semibold text-[#0f1a3a]">{nom}</span>
              </li>
            </ol>
          </nav>

          {/* Eyebrow */}
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 px-4 py-1.5 font-hanken text-xs font-bold uppercase tracking-[0.12em] text-[#c54e00]">
            <span aria-hidden="true" className="text-base">{icon}</span>
            {categoryLabel}
          </span>

          {/* H1 */}
          <h1 className="mt-6 font-hanken text-4xl font-extrabold leading-[1.08] tracking-tight text-[#0f1a3a] md:text-5xl lg:text-6xl">
            {h1}
          </h1>

          {/* Lead */}
          <p className="mt-6 max-w-3xl font-hanken text-lg leading-relaxed text-gray-600 md:text-xl">
            {specificite}
          </p>

          {/* Méta : auteur + date + reading time */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-gray-200/70 pt-6 text-sm">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] font-hanken text-sm font-bold text-white"
              >
                JS
              </div>
              <div className="font-hanken">
                <div className="text-sm font-semibold text-[#0f1a3a]">
                  {AUTHOR_NAME}
                </div>
                <div className="text-xs text-gray-500">{AUTHOR_ROLE}</div>
              </div>
            </div>
            <span aria-hidden="true" className="h-4 w-px bg-gray-300" />
            <span className="font-hanken text-gray-500">{PUBLISH_DATE_FR}</span>
            <span aria-hidden="true" className="h-4 w-px bg-gray-300" />
            <span className="font-hanken text-gray-500">
              {READING_TIME} de lecture
            </span>
          </div>

          {/* CTA primaire dans le hero */}
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-xl bg-[#ff7a1a] px-6 font-hanken text-sm font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition-all hover:bg-[#f09050] hover:shadow-xl hover:shadow-[#ff7a1a]/30"
            >
              Essai gratuit 14 jours
              <span aria-hidden="true" className="ml-2">&rarr;</span>
            </Link>
            <Link
              href="/tarifs"
              className="inline-flex h-12 items-center rounded-xl border border-gray-200 bg-white px-6 font-hanken text-sm font-semibold text-[#0f1a3a] transition-all hover:border-[#ff7a1a]/30 hover:text-[#ff7a1a]"
            >
              Voir les tarifs
            </Link>
            <span className="font-hanken text-xs text-gray-500">
              Sans carte bancaire
            </span>
          </div>
        </div>
      </header>

      {/* ═══════ Layout split desktop ═══════ */}
      <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-10 sm:px-8">
        {/* TOC : MetierTOC gère lui-même mobile (accordéon en haut, lg:hidden)
            ET desktop (sticky aside, hidden lg:block). Une seule instance placée
            avant la grille pour le mobile. La version desktop est rendue par la
            même instance via classes Tailwind. */}
        <div className="mb-8 lg:hidden">
          <MetierTOC items={METIER_SECTIONS} />
        </div>

        <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
          {/* ─── Colonne gauche : TOC sticky (desktop only via composant) ─── */}
          <div className="hidden lg:block lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <MetierTOC items={METIER_SECTIONS} />
          </div>

          {/* ─── Colonne centrale : contenu article ─── */}
          <div id="article-body" className="mx-auto w-full max-w-[860px] space-y-16 lg:space-y-20">
            {/* A — Introduction longue */}
            <MetierIntro
              nom={nom}
              longueIntro={longueIntro}
              motsClesSecondaires={motsClesSecondaires}
            />

            {/* B — Cas d'usage subtil */}
            <MetierCasUsage nom={nom} casUsage={casUsage} />

            {/* C — TVA + tableau + réglementation 2026 */}
            <MetierTvaSection
              nom={nom}
              tvaNotes={tvaNotes}
              paragrapheTva={paragrapheTva}
              tableauTva={tableauTva}
              reglementation2026={reglementation2026}
            />

            {/* D — Exemple de devis Nexartis adapté */}
            <MetierDevisExample
              nom={nom}
              devisLines={devis.lines}
              totalHT={devis.totalHT}
              tva55Lines={devis.tva55Lines}
              tva10Lines={devis.tva10Lines}
              tva20Lines={devis.tva20Lines}
              tva55Amount={devis.tva55Amount}
              tva10Amount={devis.tva10Amount}
              tva20Amount={devis.tva20Amount}
              totalTTC={devis.totalTTC}
              formatPrice={formatPrice}
            />

            {/* E — Conseils de rédaction (callout "Bon à savoir") */}
            <MetierConseils conseilsRedaction={conseilsRedaction} />

            {/* F — Certifications & labels */}
            <MetierCertifications certifications={certifications} />

            {/* G — Prestations typiques (cards) */}
            <MetierPrestations
              nomPluriel={nomPluriel}
              icon={icon}
              prestationsExemples={prestationsExemples}
            />

            {/* H — FAQ accordéon V4 */}
            <MetierFAQ
              nom={nom}
              nomPluriel={nomPluriel}
              tvaNotes={tvaNotes}
              faqCustom={faqCustom}
            />

            {/* I — Ressources et liens de maillage */}
            <MetierMaillage nom={nom} ancresMaillage={ancresMaillage} />

            {/* Bio auteur */}
            <MetierAuthor />
          </div>
        </div>
      </div>

      {/* ═══════ J — CTA final navy/orange ═══════ */}
      <section className="bg-[#f6f8fb] py-16 lg:py-20">
        <div className="mx-auto max-w-[860px] px-6 sm:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1a3a] via-[#1a2d5a] to-[#0f1a3a] p-8 text-center md:p-12">
            <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff9d4d]">
              Essai gratuit 14 jours
            </div>
            <h2 className="mt-3 font-hanken text-2xl font-extrabold text-white md:text-3xl lg:text-4xl">
              Prêt à simplifier votre quotidien de {nom.toLowerCase()} ?
            </h2>
            <p className="mx-auto mt-3 max-w-lg font-hanken text-base text-gray-300 md:text-lg">
              Devis, factures, planning chantier. Tout inclus, sans carte
              bancaire, sans engagement.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-7 py-3.5 font-hanken text-base font-bold text-white shadow-xl shadow-[#ff7a1a]/30 transition hover:scale-[1.02] hover:bg-[#f09050]"
            >
              Commencer maintenant
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
                  d="M13 7l5 5-5 5M6 12h12"
                />
              </svg>
            </Link>
            <p className="mt-5 font-hanken text-xs text-white/45">
              Dès <span className="font-spline-mono">15€/mois</span> ensuite ·
              Annulation en 1 clic
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
