import type { Metadata, Viewport } from 'next'
import { Syne, Manrope, Plus_Jakarta_Sans, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ConditionalLayout from '@/components/ConditionalLayout'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import CookieConsent from '@/components/CookieConsent'
import PWARegister from '@/components/PWARegister'
import { UIProviders } from '@/components/ui/v4/UIProviders'

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

// V3.0a - Polices du nouveau design devis/facture (PDF + Dashboard).
// Chargees ici pour etre disponibles globalement via les variables CSS
// `--font-hanken` et `--font-spline-mono`. Cf `tailwind.config.ts` pour
// les classes `font-hanken` / `font-spline-mono`.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-spline-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://nexartis.fr'),
  title: 'Logiciel devis facture artisan — Nexartis dès 15€/mois',
  description:
    'Créez devis et factures artisan en quelques clics. Planning et dictée vocale IA en option. Essai 14 jours sans carte bancaire. Dès 15€/mois.',
  keywords:
    'logiciel devis artisan, logiciel facture artisan, logiciel artisan, application artisan, gestion artisan, devis en ligne, facturation artisan',
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
  },
  openGraph: {
    title: 'Logiciel devis facture artisan — Nexartis dès 15€/mois',
    description:
      'Créez devis et factures artisan en quelques clics. Planning et dictée vocale IA en option. Essai 14 jours sans carte bancaire. Dès 15€/mois.',
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
    title: 'Logiciel devis facture artisan — Nexartis dès 15€/mois',
    description: 'Devis et factures en quelques clics. Planning et IA vocale en option. Essai 14 jours sans CB.',
  },
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'FJBByC3CPJtSwTo4mqYE8ijL_ZbvJS3Ha2jITTB3KN8',
  },
  // PWA — Manifest + icônes natives. Le themeColor est dans `viewport` ci-dessous
  // (déplacé hors metadata depuis Next.js 14).
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexartis',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
}

// V4 PWA — Viewport séparé pour respecter Next.js 14.
// `viewportFit: 'cover'` permet d'utiliser tout l'écran sur iPhone (notch / safe areas).
// `themeColor` ici (et non dans metadata) pour conformité Next.js 14.
export const viewport: Viewport = {
  themeColor: '#ff7a1a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Le middleware ajoute l'en-tete `x-maintenance: 1` quand il sert la page
  // de maintenance via un rewrite. On le lit ici cote serveur pour pouvoir
  // forcer le masquage du header / footer marketing (sinon ils apparaissent
  // parce que l'URL cote navigateur reste celle d'origine, ex: /).
  const headersList = headers()
  const isMaintenance = headersList.get('x-maintenance') === '1'

  // Schema.org Organization + Person (founder) - present sur toutes les pages
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
      "Logiciel francais de gestion pour artisans du BTP : devis, factures, planning chantier, gestion equipe. Aussi performant que les leaders du marche, a partir de 15 EUR/mois (offre Essentiel) ou 25 EUR/mois tout inclus (offre Complet).",
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
      email: 'contact.nexartis@gmail.com',
      availableLanguage: ['French'],
      areaServed: 'FR',
    },
    knowsLanguage: 'fr',
    inLanguage: 'fr',
  }

  return (
    <html lang="fr" className={`${syne.variable} ${manrope.variable} ${jakarta.variable} ${hanken.variable} ${splineMono.variable}`}>
      <body className="font-manrope bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <GoogleAnalytics />
        <UIProviders>
          <ConditionalLayout
            header={<Header />}
            footer={<Footer />}
            forceHidden={isMaintenance}
          >
            {children}
          </ConditionalLayout>
        </UIProviders>
        {/* PWA — Enregistre le service worker et gère le toast "Nouvelle version".
            Composant client, monté une seule fois ici pour couvrir toute l'app. */}
        <PWARegister />
        <CookieConsent />
      </body>
    </html>
  )
}
