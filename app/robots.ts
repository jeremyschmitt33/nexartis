import type { MetadataRoute } from 'next'

/**
 * robots.txt dynamique pour nexartis.fr
 * Indique aux moteurs de recherche quelles pages indexer et lesquelles ignorer.
 * Accessible à : https://nexartis.fr/robots.txt
 *
 * Mode maintenance : si MAINTENANCE_MODE=true, on bloque tout crawl pour éviter
 * que Google n'indexe la page de maintenance. Combiné au code HTTP 503 retourné
 * par le middleware, c'est la procédure recommandée par Google pour une
 * maintenance temporaire sans impact SEO.
 */
export default function robots(): MetadataRoute.Robots {
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  if (maintenanceMode) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      // Pas de sitemap pendant la maintenance
    }
  }

  // Liste mutualisee des chemins prives a ne JAMAIS indexer / crawler
  const privatePaths = [
    '/dashboard/',    // Espace prive des utilisateurs
    '/api/',          // Routes API
    '/login',         // Pages d'auth
    '/register',
    '/auth/',
    '/onboarding',
    '/reset-password',
    '/forgot-password',
    '/subscription-expired',
    '/signer/',       // Pages de signature (privees par token)
    '/maintenance',   // Page de maintenance (ne pas indexer)
    '/_next/',        // Assets internes Next.js
  ]

  // Liste des bots IA explicitement autorises sur le contenu public.
  // GEO 2026 : etre explicitement cite par ChatGPT, Mistral, Perplexity, AIO et Claude
  // necessite que les crawlers de ces moteurs aient acces aux pages publiques.
  // On les liste explicitement pour eviter toute ambiguite (71% des sites bloquent
  // ClaudeBot par accident a cause de regles trop strictes).
  const aiBots = [
    // OpenAI / ChatGPT
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    // Anthropic / Claude
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'anthropic-ai',
    // Perplexity
    'PerplexityBot',
    'Perplexity-User',
    // Google AI Overviews / Gemini
    'Google-Extended',
    // Mistral / Le Chat
    'MistralBot',
    // Apple Intelligence
    'Applebot-Extended',
    // Common Crawl (utilise par de nombreux LLMs en entrainement)
    'CCBot',
  ]

  return {
    rules: [
      // Regle generale : tous les autres user-agents (Googlebot, Bingbot, etc.)
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      // Regles explicites pour chaque bot IA majeur
      ...aiBots.map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: privatePaths,
      })),
    ],
    sitemap: 'https://nexartis.fr/sitemap.xml',
  }
}
