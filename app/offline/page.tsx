import type { Metadata } from 'next'

/**
 * Page /offline — Fallback hors-ligne de la PWA Nexartis.
 *
 * Affichée par le service worker (sw.js) quand l'utilisateur navigue sans
 * connexion ET que la page demandée n'est pas dans le cache.
 *
 * Design : identité V4 dark premium (fond bgdark, accent orange).
 * Ajoutée à HIDDEN_ROUTES dans ConditionalLayout pour masquer header/footer marketing.
 */

export const metadata: Metadata = {
  title: 'Hors-ligne — Nexartis',
  description: 'Pas de connexion réseau. Reconnectez-vous pour utiliser Nexartis.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bgdark flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Wordmark Nexartis — branding fort, identifie l'app */}
      <div className="font-syne font-extrabold text-5xl sm:text-6xl text-ink mb-12 tracking-tight">
        Nexartis
      </div>

      {/* Icône d'état hors-ligne — pictogramme wifi barré, accent orange */}
      <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mb-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
          aria-hidden="true"
        >
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 13a10 10 0 0 1 5.24-2.76" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      {/* Titre principal */}
      <h1 className="font-hanken font-extrabold text-2xl sm:text-3xl text-ink mb-4">
        Pas de réseau
      </h1>

      {/* Sous-titre explicatif */}
      <p className="font-hanken text-ink-2 max-w-md mb-10 leading-relaxed">
        Vérifie ta connexion 4G/Wifi puis rafraîchis la page.
      </p>

      {/* CTA réessayer — <a href="/"> pour forcer un rechargement complet
          (vs Link Next qui ferait de la navigation client) */}
      <a
        href="/"
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent-2 text-bgdark font-hanken font-bold px-6 py-3 rounded-full transition-colors shadow-[0_0_24px_rgba(255,122,26,0.4)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        Réessayer
      </a>

      {/* Note technique discrète en bas */}
      <p className="font-hanken text-ink-3 text-xs mt-12 max-w-xs">
        Astuce : si tu as installé Nexartis comme application, elle reste accessible même sans connexion.
      </p>
    </div>
  )
}
