import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique cookies — Nexartis',
  description:
    'Politique de cookies Nexartis : quels cookies, à quoi servent-ils, comment les gérer.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/cookies',
  },
}

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <header className="mb-10">
        <p className="font-manrope text-sm font-semibold uppercase tracking-wider text-orange">
          Transparence
        </p>
        <h1 className="mt-2 font-syne text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Politique cookies
        </h1>
        <p className="mt-3 text-sm text-navy/60">
          Dernière mise à jour : 8 juin 2026 — Conforme aux recommandations CNIL
        </p>
      </header>

      <div className="prose prose-slate max-w-none font-manrope text-[15px] leading-relaxed text-navy">
        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
          <p>
            Un cookie est un petit fichier déposé sur votre ordinateur, votre tablette ou votre téléphone
            lorsque vous visitez un site web. Il permet au site de mémoriser vos actions et préférences
            (langue, taille de police, session de connexion, etc.) pendant une durée déterminée, afin que
            vous n&apos;ayez pas à les redonner à chaque visite.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            2. Cookies utilisés par Nexartis
          </h2>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">
            2.1. Cookies strictement nécessaires (toujours actifs)
          </h3>
          <p>Ces cookies sont indispensables au fonctionnement du site et ne nécessitent pas votre consentement.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy/5">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Nom</th>
                  <th className="px-3 py-2 text-left font-semibold">Finalité</th>
                  <th className="px-3 py-2 text-left font-semibold">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">sb-*-auth-token</td>
                  <td className="px-3 py-2">Authentification Supabase (session connectée)</td>
                  <td className="px-3 py-2">1 heure (renouvelée)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">sb-refresh-token</td>
                  <td className="px-3 py-2">Rafraîchissement automatique de la session</td>
                  <td className="px-3 py-2">7 jours</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">nexartis_consent</td>
                  <td className="px-3 py-2">Mémoriser votre choix de cookies</td>
                  <td className="px-3 py-2">6 mois</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">nexartis_bypass</td>
                  <td className="px-3 py-2">Accès admin pendant maintenance (uniquement éditeur)</td>
                  <td className="px-3 py-2">7 jours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-syne text-lg font-bold text-navy mt-8">
            2.2. Cookies de mesure d&apos;audience (consentement requis)
          </h3>
          <p>
            Ces cookies nous permettent de mesurer la fréquentation du site et de comprendre comment les
            visiteurs interagissent avec lui, de manière anonyme et agrégée. Ils ne sont déposés qu&apos;après
            votre consentement explicite via la bannière cookies.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy/5">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Nom</th>
                  <th className="px-3 py-2 text-left font-semibold">Finalité</th>
                  <th className="px-3 py-2 text-left font-semibold">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">_ga</td>
                  <td className="px-3 py-2">Google Analytics 4 — distinguer les utilisateurs (IP anonymisée)</td>
                  <td className="px-3 py-2">13 mois</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">_ga_*</td>
                  <td className="px-3 py-2">Google Analytics 4 — état de la session</td>
                  <td className="px-3 py-2">13 mois</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-syne text-lg font-bold text-navy mt-8">
            2.3. Cookies publicitaires
          </h3>
          <p>
            <strong>Nexartis n&apos;utilise aucun cookie publicitaire</strong>. Aucune donnée n&apos;est partagée
            avec des régies publicitaires ou des réseaux sociaux à des fins de tracking.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            3. Gérer vos préférences de cookies
          </h2>
          <p>Vous pouvez à tout moment :</p>
          <ul className="list-disc pl-6">
            <li>Modifier vos choix via le bouton « Gérer les cookies » présent dans le bandeau de cookies en bas de page.</li>
            <li>
              Bloquer ou supprimer les cookies depuis les paramètres de votre navigateur :
              <ul className="list-disc pl-6 mt-2">
                <li>
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-sky underline-offset-4 hover:underline">
                    Google Chrome
                  </a>
                </li>
                <li>
                  <a href="https://support.mozilla.org/fr/kb/protection-renforcee-contre-pistage-firefox-ordinateur" target="_blank" rel="noopener noreferrer" className="text-sky underline-offset-4 hover:underline">
                    Mozilla Firefox
                  </a>
                </li>
                <li>
                  <a href="https://support.apple.com/fr-fr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-sky underline-offset-4 hover:underline">
                    Safari
                  </a>
                </li>
                <li>
                  <a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-sky underline-offset-4 hover:underline">
                    Microsoft Edge
                  </a>
                </li>
              </ul>
            </li>
            <li>
              Utiliser un module d&apos;extension de navigateur dédié, comme{' '}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-sky underline-offset-4 hover:underline">
                l&apos;extension de désactivation de Google Analytics
              </a>
              .
            </li>
          </ul>
          <p>
            ⚠️ <strong>Important</strong> : bloquer les cookies strictement nécessaires (notamment ceux d&apos;authentification) vous empêchera de vous connecter à votre espace Nexartis.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">4. Durée de validité de votre choix</h2>
          <p>
            Votre choix de consentement (acceptation ou refus) est conservé pendant <strong>6 mois maximum</strong>{' '}
            conformément à la recommandation CNIL. Au-delà, la bannière vous sera à nouveau présentée.
          </p>
        </section>

        <section>
          <h2 className="font-syne text-2xl font-bold text-navy">5. Pour aller plus loin</h2>
          <p>
            Pour comprendre comment Nexartis traite vos données personnelles dans leur ensemble, consultez
            notre{' '}
            <Link href="/rgpd" className="text-sky underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>
            . Pour toute question sur les cookies, écrivez-nous à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  )
}
