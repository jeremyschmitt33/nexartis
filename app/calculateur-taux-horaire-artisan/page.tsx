import type { Metadata } from "next";
import Link from "next/link";
import CalculateurClient from "./CalculateurClient";

export const metadata: Metadata = {
  title: "Calculateur de taux horaire artisan (gratuit) — Nexartis",
  description:
    "Calculez votre taux horaire d'artisan du bâtiment en 1 minute : coût de revient, taux de vente HT et prix à la journée. Outil gratuit basé sur vos charges réelles.",
  alternates: {
    canonical: "/calculateur-taux-horaire-artisan",
  },
  openGraph: {
    title: "Calculateur de taux horaire artisan (gratuit)",
    description:
      "Trouvez votre taux horaire juste : coût de revient, taux de vente HT et prix à la journée, à partir de vos charges réelles.",
    url: "/calculateur-taux-horaire-artisan",
    type: "website",
  },
};

const FAQ = [
  {
    q: "Comment calculer son taux horaire d'artisan ?",
    a: "Additionnez ce que vous devez couvrir sur l'année : le revenu net que vous voulez vous verser, vos charges sociales et impôts, et vos frais professionnels (assurance, véhicule, outillage, comptable). Divisez ce total par votre nombre d'heures réellement facturables (souvent 1 000 à 1 200 h pour un artisan seul) : vous obtenez votre coût de revient horaire. Ajoutez-y votre marge (20 à 30 %) pour fixer votre taux de vente.",
  },
  {
    q: "Pourquoi distinguer heures travaillées et heures facturables ?",
    a: "Un artisan travaille environ 1 600 heures par an mais n'en facture que 60 à 70 %. Les devis, déplacements, préparations de chantier et l'administratif consomment du temps sans générer de revenu. Calculer son taux sur 1 600 h au lieu de 1 200 h sous-estime le coût de revient d'environ un tiers : on travaille alors à perte sans s'en rendre compte.",
  },
  {
    q: "Quelle marge appliquer sur son taux horaire ?",
    a: "Une marge de 20 à 30 % est généralement recommandée dans le bâtiment. Elle assure la pérennité de l'entreprise et finance vos investissements. Vous pouvez la moduler selon la concurrence et le type de chantier, mais ne descendez jamais sous votre coût de revient.",
  },
  {
    q: "Quel est le taux horaire moyen d'un artisan en 2026 ?",
    a: "La moyenne nationale se situe autour de 55 € HT de l'heure, tous métiers confondus, avec une fourchette courante de 35 à 70 € HT. Cette valeur sert à se situer, pas à fixer son prix : seul votre coût de revient réel doit servir de base.",
  },
  {
    q: "Le calcul est-il différent pour un auto-entrepreneur ?",
    a: "Oui, principalement à cause de la structure de charges. L'auto-entrepreneur paie des cotisations sur son chiffre d'affaires sans déduire ses frais réels et, en franchise de TVA, ne récupère pas la TVA sur ses achats. Renseignez vos charges et frais réels dans le calculateur pour obtenir un taux adapté à votre situation.",
  },
];

export default function Page() {
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculateur de taux horaire artisan",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://nexartis.fr/calculateur-taux-horaire-artisan",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    publisher: {
      "@type": "Organization",
      name: "Nexartis",
      url: "https://nexartis.fr",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://nexartis.fr" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Calculateur de taux horaire artisan",
        item: "https://nexartis.fr/calculateur-taux-horaire-artisan",
      },
    ],
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ───── Hero ───── */}
      <section className="bg-gradient-to-b from-cream/70 to-white border-b border-navy/10">
        <div className="max-w-container mx-auto px-5 sm:px-8 pt-28 pb-12 sm:pt-32 sm:pb-16">
          <nav aria-label="Fil d'Ariane" className="text-sm text-navy/50 mb-4">
            <Link href="/" className="hover:text-orange">
              Accueil
            </Link>{" "}
            / <span className="text-navy/70">Calculateur de taux horaire artisan</span>
          </nav>
          <h1 className="font-syne text-3xl sm:text-5xl font-extrabold text-navy max-w-3xl leading-tight">
            Calculateur de taux horaire artisan
          </h1>
          <p className="mt-4 text-lg text-navy/70 max-w-2xl">
            Trouvez votre <strong>taux horaire juste</strong> en une minute. Renseignez
            vos charges réelles, l'outil calcule votre <strong>coût de revient</strong>,
            votre <strong>taux de vente HT</strong> et votre <strong>prix à la journée</strong>.
            Gratuit, sans inscription.
          </p>
        </div>
      </section>

      {/* ───── Calculateur ───── */}
      <section className="max-w-container mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <CalculateurClient />
      </section>

      {/* ───── Méthode ───── */}
      <section className="bg-cream/40 border-y border-navy/10">
        <div className="max-w-container mx-auto px-5 sm:px-8 py-12 sm:py-16">
          <h2 className="font-syne text-2xl sm:text-3xl font-extrabold text-navy mb-6">
            Comment ce calcul fonctionne
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white p-6 border border-navy/10">
              <div className="text-orange font-syne text-3xl font-extrabold mb-2">1</div>
              <h3 className="font-bold text-navy mb-2">Votre coût de revient</h3>
              <p className="text-sm text-navy/70">
                On additionne le revenu que vous voulez vous verser, vos charges sociales
                et impôts, et vos frais professionnels. Ce total, divisé par vos heures
                réellement facturables, donne votre <strong>coût horaire réel</strong> —
                le seuil sous lequel vous travaillez à perte.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 border border-navy/10">
              <div className="text-orange font-syne text-3xl font-extrabold mb-2">2</div>
              <h3 className="font-bold text-navy mb-2">Votre taux de vente</h3>
              <p className="text-sm text-navy/70">
                On applique votre marge (20 à 30 % recommandé) sur le coût de revient.
                C'est le <strong>taux que vous facturez</strong>, celui qui couvre vos
                charges <em>et</em> dégage un bénéfice pour faire vivre l'entreprise.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 border border-navy/10">
              <div className="text-orange font-syne text-3xl font-extrabold mb-2">3</div>
              <h3 className="font-bold text-navy mb-2">Votre prix à la journée</h3>
              <p className="text-sm text-navy/70">
                On multiplie votre taux de vente par le nombre d'heures facturables dans
                une journée. Pratique pour chiffrer un chantier au <strong>forfait jour</strong>{" "}
                sans perdre de marge.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-navy/60">
            Méthode détaillée pas à pas, avec exemple chiffré complet, dans notre guide :{" "}
            <Link
              href="/blog/taux-horaire-artisan-batiment"
              className="text-orange font-semibold hover:underline"
            >
              comment calculer son taux horaire d'artisan en 2026
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="max-w-container mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <h2 className="font-syne text-2xl sm:text-3xl font-extrabold text-navy mb-8">
          Questions fréquentes
        </h2>
        <div className="space-y-4 max-w-3xl">
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border-2 border-navy/10 bg-white p-5 sm:p-6 open:border-orange/40 transition-colors"
            >
              <summary className="cursor-pointer font-bold text-navy text-lg list-none flex items-center justify-between gap-4">
                {f.q}
                <span className="text-orange text-2xl leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-navy/70 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───── CTA / maillage ───── */}
      <section className="bg-navy text-white">
        <div className="max-w-container mx-auto px-5 sm:px-8 py-12 sm:py-16 text-center">
          <h2 className="font-syne text-2xl sm:text-3xl font-extrabold mb-4">
            Votre taux est calculé. Reportez-le sans erreur dans vos devis.
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto mb-8">
            Nexartis enregistre votre taux horaire et l'applique automatiquement sur
            chaque devis, avec les mentions légales obligatoires et la conformité
            Factur-X. Logiciel français de devis, factures et suivi de chantier pour
            les artisans du bâtiment, dès 15 € HT/mois.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="rounded-xl bg-orange hover:bg-orange-hover text-white font-bold px-8 py-4 transition-colors"
            >
              Essai gratuit 14 jours
            </Link>
            <Link
              href="/logiciel-devis-factures"
              className="rounded-xl border-2 border-white/30 hover:border-white text-white font-bold px-8 py-4 transition-colors"
            >
              Découvrir le logiciel
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/50">
            Voir aussi :{" "}
            <Link href="/logiciel-devis-plombier" className="underline hover:text-white">
              logiciel plombier
            </Link>
            ,{" "}
            <Link href="/logiciel-devis-electricien" className="underline hover:text-white">
              logiciel électricien
            </Link>
            ,{" "}
            <Link href="/logiciel-devis-maconnerie" className="underline hover:text-white">
              logiciel maçon
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
