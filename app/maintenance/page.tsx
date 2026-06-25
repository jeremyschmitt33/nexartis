import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Maintenance en cours — Nexartis',
  description:
    'Nexartis est temporairement indisponible le temps que nous améliorions le service. Merci de votre patience.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  const retourEstime =
    process.env.NEXT_PUBLIC_MAINTENANCE_RETURN ?? 'très prochainement'
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contact.nexartis@gmail.com'

  const mailtoNotify = `mailto:${contactEmail}?subject=${encodeURIComponent(
    'Prévenez-moi du retour de Nexartis',
  )}&body=${encodeURIComponent(
    "Bonjour,\n\nMerci de me prévenir dès que Nexartis sera de nouveau accessible.\n\nMon email : \n\nCordialement,",
  )}`

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-navy px-6 py-16 text-cream">
      {/* Décor de fond doux */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-navy-mid/40 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-2xl text-center">
        {/* Wordmark */}
        <div className="mb-10 inline-flex items-center justify-center">
          <span className="font-syne text-3xl font-bold tracking-tight text-cream">
            Nex<span className="text-orange">artis</span>
          </span>
        </div>

        {/* Badge "Maintenance" + pictogramme */}
        <div className="mx-auto mb-8 flex flex-col items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-orange ring-1 ring-orange/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange" />
            </span>
            Maintenance en cours
          </span>

          <div className="mt-2 flex h-20 w-20 items-center justify-center rounded-full bg-orange/15 ring-1 ring-orange/30">
            <svg
              aria-hidden="true"
              className="h-9 w-9 animate-spin text-orange"
              style={{ animationDuration: '12s' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Titre */}
        <h1 className="font-syne text-4xl font-bold leading-tight tracking-tight text-cream sm:text-5xl">
          Nous améliorons Nexartis
        </h1>

        {/* Sous-titre */}
        <p className="mt-6 text-lg leading-relaxed text-cream/85 sm:text-xl">
          Le service sera de nouveau accessible{' '}
          <span className="font-semibold text-orange">{retourEstime}</span>.
        </p>

        {/* Carte rassurance données */}
        <div className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-cream/10 bg-navy-mid/40 p-4 text-left">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 flex-none text-sky"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-cream">Données en sécurité</p>
              <p className="mt-0.5 text-xs text-cream/70">
                Toutes vos données restent chiffrées et seront accessibles dès le
                retour.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-cream/10 bg-navy-mid/40 p-4 text-left">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 flex-none text-orange"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-cream">Améliorations en cours</p>
              <p className="mt-0.5 text-xs text-cream/70">
                Corrections de qualité et facturation électronique.
              </p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href={mailtoNotify}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3 font-medium text-cream shadow-lg shadow-orange/20 transition hover:bg-orange-hover focus:outline-none focus:ring-2 focus:ring-orange/60 focus:ring-offset-2 focus:ring-offset-navy sm:w-auto"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            Me prévenir du retour
          </Link>

          <Link
            href={`mailto:${contactEmail}?subject=${encodeURIComponent('Question pendant la maintenance')}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cream/20 bg-transparent px-6 py-3 font-medium text-cream/90 transition hover:border-cream/40 hover:bg-cream/5 focus:outline-none focus:ring-2 focus:ring-cream/30 focus:ring-offset-2 focus:ring-offset-navy sm:w-auto"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Nous contacter
          </Link>
        </div>

        <p className="mt-8 text-sm text-cream/60">
          Merci pour votre patience — nous revenons avec un outil encore meilleur.
        </p>
      </div>

      {/* Footer minimal */}
      <footer className="absolute bottom-6 left-0 right-0 text-center text-xs text-cream/40">
        © {new Date().getFullYear()} Nexartis — Logiciel de devis et factures
        pour artisans
      </footer>
    </main>
  )
}
