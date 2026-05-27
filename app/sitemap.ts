import type { MetadataRoute } from 'next'

/**
 * Sitemap dynamique pour nexartis.fr
 * Génère automatiquement la liste de toutes les pages publiques indexables.
 * Accessible à : https://nexartis.fr/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nexartis.fr'
  // lastModified dynamique = date du dernier build/deploiement.
  // Se met a jour automatiquement a chaque push sur Vercel, donc Google
  // detecte toujours du contenu "frais" sans risquer une date dans le futur.
  const lastModified = new Date()

  // Pages publiques principales
  const mainPages = [
    { url: baseUrl, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/tarifs`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/a-propos`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/blog`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/planning-chantier-intelligent`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/logiciel-devis-factures`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/logiciel-artisan-auto-entrepreneur`, changeFrequency: 'monthly' as const, priority: 0.8 },
  ]

  // Pages par metier (SEO local)
  const metierPages = [
    'electricien', 'plombier', 'chauffagiste', 'carreleur',
    'couvreur', 'menuisier', 'maconnerie', 'peintre', 'paysagiste',
  ].map(metier => ({
    url: `${baseUrl}/logiciel-devis-${metier}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Pages par ville (SEO geographique)
  const villePages = ['lyon', 'marseille', 'bordeaux'].map(ville => ({
    url: `${baseUrl}/logiciel-artisan-${ville}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Pages legales (faible priorite mais indexables)
  const legalPages = [
    { url: `${baseUrl}/mentions-legales`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${baseUrl}/cgv`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${baseUrl}/rgpd`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  return [...mainPages, ...metierPages, ...villePages, ...legalPages].map(page => ({
    ...page,
    lastModified,
  }))
}
