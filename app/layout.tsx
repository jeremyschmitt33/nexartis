import type { Metadata } from 'next'
import { Syne, Manrope, Plus_Jakarta_Sans } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ConditionalLayout from '@/components/ConditionalLayout'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import CookieConsent from '@/components/CookieConsent'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['700', '800'],
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600'],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://nexartis.fr'),
  title: 'Nexartis — Logiciel devis facture artisan | 25€/mois tout inclus',
  description:
    'Créez vos devis et factures artisan en quelques minutes. Planning intelligent exclusif. Conforme Factur-X 2026. Essai gratuit 14 jours sans CB.',
  keywords:
    'logiciel devis artisan, logiciel facture artisan, logiciel artisan, application artisan, gestion artisan, devis en ligne, facturation artisan',
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
  },
  openGraph: {
    title: 'Nexartis — Logiciel devis facture artisan | 25€/mois tout inclus',
    description:
      'Créez vos devis et factures artisan en quelques minutes. Planning intelligent exclusif. Conforme Factur-X 2026.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Nexartis',
    url: 'https://nexartis.fr',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Nexartis - Logiciel de gestion pour artisans',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexartis — Logiciel devis facture artisan',
    description: 'Gestion devis factures chantiers pour artisans. Essai gratuit 14 jours.',
  },
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'FJBByC3CPJtSwTo4mqYE8ijL_ZbvJS3Ha2jITTB3KN8',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Le middleware ajoute l'en-tête `x-maintenance: 1` quand il sert la page
  // de maintenance via un rewrite. On le lit ici côté serveur pour pouvoir
  // forcer le masquage du header / footer marketing (sinon ils apparaissent
  // parce que l'URL côté navigateur reste celle d'origine, ex: /).
  const headersList = headers()
  const isMaintenance = headersList.get('x-maintenance') === '1'

  // Schema.org Organization + Person (founder) — present sur toutes les pages
  // pour booster la citabilite par les moteurs IA (Mistral, ChatGPT, Perplexity,
  // Google AI Overviews, Claude). Renforce egalement le signal E-E-A-T pour Google.
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://nexartis.fr/#organization',
    name: 'Nexartis',
    url: 'https://nexartis.fr',
    logo: {
      '@type': 'ImageObject',
      url: 'https://nexartis.fr/images/logo-nexartis.png',
      width: 512,
      height: 512,
    },
    description:
      "Logiciel francais de gestion pour artisans du BTP : devis, factures, planning chantier, gestion equipe. Conforme Factur-X 2026. Aussi performant que les leaders du marche, a un prix juste : 25 EUR/mois tout inclus.",
    foundingDate: '2024',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Le Haillan',
        addressRegion: 'Gironde',
        addressCountry: 'FR',
      },
    },
    founder: {
      '@type': 'Person',
      '@id': 'https://nexartis.fr/#founder',
      name: 'Jeremy Schmitt',
      jobTitle: 'Consultant SEO independant et fondateur de Nexartis',
      worksFor: { '@id': 'https://nexartis.fr/#organization' },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Le Haillan',
        addressRegion: 'Gironde',
        addressCountry: 'FR',
      },
    },
    areaServed: {
      '@type': 'Country',
      name: 'France',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'contact@nexartis.fr',
      availableLanguage: ['French'],
      areaServed: 'FR',
    },
    knowsLanguage: 'fr',
    inLanguage: 'fr',
  }

  return (
    <html lang="fr" className={`${syne.variable} ${manrope.variable} ${jakarta.variable}`}>
      <body className="font-manrope bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <GoogleAnalytics />
        <ConditionalLayout
          header={<Header />}
          footer={<Footer />}
          forceHidden={isMaintenance}
        >
          {children}
        </ConditionalLayout>
        <CookieConsent />
      </body>
    </html>
  )
}
