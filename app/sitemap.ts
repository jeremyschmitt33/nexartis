import type { MetadataRoute } from 'next'
import fs from 'node:fs'
import path from 'node:path'

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

  // ════════════════════════════════════════════════════════════════════
  // Articles de blog (route dynamique /blog/[slug])
  // Scanne le dossier content/blog/ au build et genere une entree par
  // fichier markdown. lastModified = champ "updated" du frontmatter si
  // present, sinon date du build.
  // ════════════════════════════════════════════════════════════════════
  const blogContentDir = path.join(process.cwd(), 'content', 'blog')
  const blogPages: MetadataRoute.Sitemap = []
  if (fs.existsSync(blogContentDir)) {
    const files = fs.readdirSync(blogContentDir).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      let articleLastMod: Date = lastModified
      try {
        const raw = fs.readFileSync(path.join(blogContentDir, file), 'utf8')
        // Extrait la valeur "updated: 2026-06-08" du frontmatter YAML
        const m = raw.match(/^updated:\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})["']?$/m)
        if (m && m[1]) {
          const d = new Date(m[1])
          if (!isNaN(d.getTime())) articleLastMod = d
        }
      } catch {
        // fichier illisible : on garde lastModified du build
      }
      blogPages.push({
        url: `${baseUrl}/blog/${slug}`,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
        lastModified: articleLastMod,
      })
    }
  }

  // Pages publiques principales
  const mainPages = [
    { url: baseUrl, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/tarifs`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/a-propos`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/blog`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/planning-chantier-intelligent`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/calculateur-taux-horaire-artisan`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/logiciel-devis-factures`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/logiciel-artisan-auto-entrepreneur`, changeFrequency: 'monthly' as const, priority: 0.8 },
  ]

  // Pages par metier (SEO local)
  const metierPages = [
    'electricien', 'plombier', 'chauffagiste', 'carreleur',
    'couvreur', 'menuisier', 'maconnerie', 'peintre', 'paysagiste',
    'serrurier', 'vitrier', 'plaquiste',
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

  // Pages statiques : on ajoute lastModified = date du build.
  // Pages blog : lastModified deja calcule depuis le frontmatter "updated".
  const staticPages = [...mainPages, ...metierPages, ...villePages, ...legalPages].map(
    (page) => ({ ...page, lastModified })
  )

  return [...staticPages, ...blogPages]
}
