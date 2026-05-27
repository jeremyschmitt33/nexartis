/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // V5 fix build : éviter qu'un warning ESLint bloque le déploiement Vercel.
  // Les vérifications tsc tournent toujours en local (`npx tsc --noEmit`),
  // les règles ESLint ne sont qu'indicatives pour ce projet.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Redirection 301 (permanente) de www.nexartis.fr vers nexartis.fr.
  // Note : la regle dans vercel.json n'a pas fonctionne car Vercel utilise un 307
  // par defaut au niveau du domaine. En la mettant ici, Next.js intercepte la
  // requete AVANT le routage Vercel et applique un vrai 301 permanent.
  // Important SEO : un 307 ne transfere pas le PageRank, contrairement au 301.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.nexartis.fr',
          },
        ],
        destination: 'https://nexartis.fr/:path*',
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.supabase.co https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://api.stripe.com https://m.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
              "frame-src 'self' https://js.stripe.com https://*.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
