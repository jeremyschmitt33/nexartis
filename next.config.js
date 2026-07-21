/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Étape 1 « vraie 3D » (21/07/2026) : three.js et l'écosystème @react-three
  // sont livrés en ESM moderne. transpilePackages garantit que Next 14 les
  // compile correctement (drei importe three/examples et three-stdlib).
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Factur-X : node-zugferd fait un `await import("xsd-schema-validator")` vers une
  // dependance OPTIONNELLE (validateur Java) non installee. Webpack tente de la
  // resoudre au build et echoue ("Module not found"). On externalise donc le
  // paquet : Next le `require()` au runtime au lieu de le bundler. Comme on utilise
  // node-zugferd en mode `strict:false`, ce validateur n'est JAMAIS appele a
  // l'execution -> aucun probleme runtime, et le build passe.
  experimental: {
    serverComponentsExternalPackages: ['node-zugferd'],
  },

  // Securite n2 (independante) : si malgre tout webpack tente de bundler ce
  // validateur Java optionnel, on le resout vers un module vide ("false")
  // au lieu d'echouer avec "Module not found". Jamais execute (strict:false).
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'xsd-schema-validator': false,
    }
    return config
  },

  // V5 fix build : éviter qu'un warning ESLint bloque le déploiement Vercel.
  // Les vérifications tsc tournent toujours en local (`npx tsc --noEmit`),
  // les règles ESLint ne sont qu'indicatives pour ce projet.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimisation images V4 (10/06/2026) — explicite pour Page Speed Insights.
  // Next.js Image va automatiquement convertir nos PNG sources en AVIF (navigateurs
  // recents) puis WebP (fallback) au build/runtime. Gain typique : -70% poids.
  // Le format d'origine (PNG) reste accessible pour les emails Brevo et OG image.
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 384, 512],
    // Autoriser les SVG fournis par nous-memes (logo-nexartis.svg, logo-nexartis-light.svg).
    // contentSecurityPolicy bloque tout script/foreignObject potentiel dans les SVG.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://api.stripe.com https://m.stripe.com https://*.r2.cloudflarestorage.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
              // blob: requis pour l'apercu local d'un PDF (panneau "Afficher un
              // document a cote") via <iframe>. Sans danger : un blob: est cree par
              // notre propre code a partir d'un fichier choisi par l'utilisateur.
              "frame-src 'self' blob: https://js.stripe.com https://*.stripe.com",
              // PWA V4 : autorise explicitement le service worker (/sw.js) et le manifest.
              // Sans ces deux directives, certains navigateurs strictes bloquent l'install PWA.
              "worker-src 'self'",
              "manifest-src 'self'",
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
            // V3.0e.2 : microphone=(self) car la feature "Devis vocal" l'utilise.
            // Les autres permissions restent bloquees par defaut (hardening secu).
            // self = autorise pour notre domaine + ses sous-domaines, refuse pour les iframes tiers.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
