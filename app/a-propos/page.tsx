import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "À propos de Nexartis — L'histoire d'un logiciel artisan fait pour un ami",
  description:
    "Nexartis est né du besoin d'un ami paysagiste qui voulait faire ses devis depuis son téléphone. Découvrez l'histoire et les 4 engagements écrits dans nos CGV.",
  robots: { index: true, follow: true },
  alternates: { canonical: '/a-propos' },
  openGraph: {
    title: 'À propos de Nexartis',
    description:
      "L'histoire d'un logiciel artisan né du besoin réel d'un ami paysagiste, désormais ouvert à tous les artisans de France.",
    url: 'https://nexartis.fr/a-propos',
    type: 'website',
    siteName: 'Nexartis',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'À propos de Nexartis',
    description: "L'histoire d'un logiciel artisan fait pour un ami.",
  },
}

// JSON-LD AboutPage + Organization avec founder pour booster E-E-A-T et citabilité LLM
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  url: 'https://nexartis.fr/a-propos',
  mainEntity: {
    '@type': 'Organization',
    name: 'Nexartis',
    url: 'https://nexartis.fr',
    logo: 'https://nexartis.fr/images/logo-nexartis.png',
    description:
      "Logiciel de gestion devis, factures, planning et chantiers pour artisans du BTP français. Conforme Factur-X 2026.",
    founder: {
      '@type': 'Person',
      name: 'Jeremy Schmitt',
      jobTitle: 'Consultant SEO indépendant et fondateur de Nexartis',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Le Haillan',
        addressRegion: 'Gironde',
        addressCountry: 'FR',
      },
    },
    areaServed: { '@type': 'Country', name: 'France' },
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Le Haillan',
        addressRegion: 'Gironde',
        addressCountry: 'FR',
      },
    },
  },
}

export default function AProposPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        {/* ============ HERO ============ */}
        <header className="mb-12 text-center">
          <p className="font-manrope text-sm font-semibold uppercase tracking-wider text-orange">
            À propos
          </p>
          <h1 className="mt-3 font-syne text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            L&apos;histoire de Nexartis
          </h1>
          <p className="mt-5 font-manrope text-lg text-navy/70 leading-relaxed">
            Un outil né du besoin d&apos;un ami artisan paysagiste — désormais ouvert à tous
            les artisans de France.
          </p>
        </header>

        {/* ============ SECTION 1 — L'ORIGINE ============ */}
        <section className="mb-12">
          <h2 className="font-syne text-2xl sm:text-3xl font-bold text-navy mb-5">
            Tout a commencé par un coup de fil
          </h2>
          <div className="font-manrope text-[16px] leading-[1.7] text-navy space-y-5">
            <p>
              Un ami à moi est paysagiste, à son compte. Comme beaucoup d&apos;artisans qui
              démarrent, il fait peu de devis par mois — mais chacun lui coûte un temps fou.
            </p>
            <p>
              Un soir, il m&apos;a appelé. Il avait essayé plusieurs logiciels pour saisir
              ses devis <strong>depuis son téléphone</strong>. Aucun ne marchait correctement.
              Trop compliqué pour un usage simple, pas adapté au BTP français, et surtout
              impossible à utiliser rapidement entre deux chantiers ou dans le camion juste
              après un rendez-vous.
            </p>
            <p className="italic text-navy/80">
              Je lui ai dit : « Laisse-moi essayer de te construire quelque chose qui marche
              vraiment depuis ton téléphone. »
            </p>
          </div>
        </section>

        {/* ============ SECTION 2 — JEREMY ============ */}
        <section className="mb-12">
          <h2 className="font-syne text-2xl sm:text-3xl font-bold text-navy mb-5">
            Je m&apos;appelle Jeremy. Et je code Nexartis.
          </h2>
          <div className="font-manrope text-[16px] leading-[1.7] text-navy space-y-5">
            <p>
              Je suis <strong>consultant SEO indépendant, basé au Haillan en Gironde</strong>.
              Mon métier au quotidien, c&apos;est d&apos;aider des entreprises à être trouvées
              sur Google. Mais j&apos;ai aussi un côté technique : je code, je connais le web,
              je comprends comment fonctionne un produit numérique.
            </p>
            <p>
              Au fil des mois, l&apos;outil que j&apos;ai construit pour mon ami a grandi.
              D&apos;autres artisans de mon entourage me demandaient comment l&apos;utiliser.
              J&apos;ai décidé d&apos;ouvrir Nexartis à tous les artisans de France, en gardant
              les principes du projet initial : <strong>simple, fiable, conforme au droit
              français, et à un prix juste qui ne grimpe jamais sans préavis</strong>.
            </p>
          </div>
        </section>

        {/* ============ SECTION 3 — 4 ENGAGEMENTS ============ */}
        <section className="mb-12 rounded-2xl border-2 border-orange/20 bg-cream/50 p-6 sm:p-8">
          <h2 className="font-syne text-2xl sm:text-3xl font-bold text-navy mb-2">
            Nos 4 engagements écrits
          </h2>
          <p className="font-manrope text-sm text-navy/60 mb-6">
            Inscrits en clair dans nos{' '}
            <Link href="/cgv" className="underline hover:text-orange">
              Conditions Générales de Vente
            </Link>
            , pas en petits caractères.
          </p>

          <ul className="space-y-4 font-manrope text-[15px] leading-[1.65] text-navy">
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-syne text-orange font-bold">1.</span>
              <span>
                <strong>Préavis 60 jours</strong> sur tout changement de prix. Toujours.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-syne text-orange font-bold">2.</span>
              <span>
                <strong>Un bug remonté = un mois d&apos;abonnement offert.</strong> Pas de
                petits caractères, pas de limite.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-syne text-orange font-bold">3.</span>
              <span>
                <strong>99 % d&apos;uptime garanti</strong>, ou abonnement remboursé pour
                le mois concerné.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-syne text-orange font-bold">4.</span>
              <span>
                <strong>Vos données hébergées en France</strong>, jamais vendues, exportables
                en CSV à tout moment.
              </span>
            </li>
          </ul>
        </section>

        {/* ============ SECTION 4 — UNE SEULE PERSONNE ============ */}
        <section className="mb-12">
          <h2 className="font-syne text-2xl sm:text-3xl font-bold text-navy mb-5">
            Une seule personne derrière Nexartis
          </h2>
          <div className="font-manrope text-[16px] leading-[1.7] text-navy space-y-5">
            <p>
              Pas de fonds d&apos;investissement. Pas d&apos;équipe de 20 personnes. Pas de
              plan de croissance à 50 millions sur 3 ans.
            </p>
            <p>
              Il y a moi, un consultant indépendant basé en Gironde, qui code Nexartis
              tous les jours et qui répond directement aux emails de support. Vous avez une
              question, un bug à signaler, une suggestion ? <strong>C&apos;est moi qui
              réponds.</strong> Pas un robot, pas un chatbot. Une vraie adresse, une vraie
              personne.
            </p>
            <p>
              📧{' '}
              <a
                href="mailto:contact@nexartis.fr"
                className="font-semibold text-sky hover:text-orange underline"
              >
                contact@nexartis.fr
              </a>
            </p>
          </div>
        </section>

        {/* ============ CTA FINAL ============ */}
        <section className="mb-10 rounded-2xl bg-navy text-cream p-8 sm:p-10 text-center">
          <h2 className="font-syne text-2xl sm:text-3xl font-bold mb-3">
            Essayez Nexartis pendant 14 jours
          </h2>
          <p className="font-manrope text-cream/70 mb-6">
            Sans carte bancaire. Sans engagement.
          </p>
          <Link
            href="/register"
            className="inline-block bg-orange hover:bg-orange-hover text-cream font-syne font-bold rounded-lg py-3 px-8 transition shadow-lg"
          >
            Commencer mon essai gratuit →
          </Link>
        </section>

        {/* ============ SIGNATURE ============ */}
        <footer className="text-center font-manrope text-navy/70 pt-6 border-t border-navy/10">
          <p className="font-syne text-lg font-bold text-navy">Jeremy Schmitt</p>
          <p className="text-sm mt-1 italic">
            Fondateur de Nexartis · Le Haillan, Gironde
          </p>
        </footer>
      </article>
    </>
  )
}
