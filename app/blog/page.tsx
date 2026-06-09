/**
 * Route : /blog (index)
 *
 * Liste TOUS les articles publiés dans content/blog/*.md.
 * Tri : plus récent en premier (champ `date` du frontmatter, fallback
 * sur `updated`). Lien vers /blog/[slug] (jamais vers /register).
 *
 * Server Component : lecture FS au build. Aucune dépendance client.
 */

import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://nexartis.fr'
const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

export const metadata: Metadata = {
  title: 'Blog Nexartis — Avis logiciels artisan BTP & guides',
  description:
    'Comparatifs et avis sur les logiciels de devis-facture pour artisans : Tolteck, Henrri, Obat, Vertuoza, Batigest. Notre regard d’artisan-fondateur.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog Nexartis — Avis logiciels artisan BTP & guides',
    description:
      'Comparatifs et avis sur les logiciels de devis-facture pour artisans : Tolteck, Henrri, Obat, Vertuoza, Batigest.',
    type: 'website',
    url: `${SITE_URL}/blog`,
  },
}

type ArticleSummary = {
  slug: string
  title: string
  description: string
  category: string
  date: string
  updated?: string
  readingTime?: string
  authorName?: string
  sortKey: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse minimal du frontmatter (clone de la logique de [slug]/page.tsx,
// allégé : on ne récupère que les champs nécessaires à la fiche listing).
// ─────────────────────────────────────────────────────────────────────────────
function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1)
  }
  return s
}

function parseFrontmatter(raw: string): Record<string, any> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const yaml = match[1]
  const fm: Record<string, any> = {}
  let currentObjectKey: string | null = null
  yaml.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return
    if (line.startsWith('  ') && currentObjectKey) {
      const trimmed = line.trim()
      const i = trimmed.indexOf(':')
      if (i > 0) {
        fm[currentObjectKey][trimmed.slice(0, i).trim()] = stripQuotes(
          trimmed.slice(i + 1).trim()
        )
      }
      return
    }
    const i = line.indexOf(':')
    if (i < 0) return
    const key = line.slice(0, i).trim()
    const val = line.slice(i + 1).trim()
    if (val === '') {
      currentObjectKey = key
      fm[key] = {}
    } else if (val === '[]') {
      fm[key] = []
      currentObjectKey = null
    } else {
      fm[key] = stripQuotes(val)
      currentObjectKey = null
    }
  })
  return fm
}

function getAllArticles(): ArticleSummary[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))
  const articles: ArticleSummary[] = []
  for (const file of files) {
    const slug = file.replace(/\.md$/, '')
    try {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
      const fm = parseFrontmatter(raw)
      // Tri : on privilégie `updated` (ISO YYYY-MM-DD), sinon `date` (humain).
      let sortKey = 0
      if (typeof fm.updated === 'string') {
        const d = new Date(fm.updated)
        if (!isNaN(d.getTime())) sortKey = d.getTime()
      }
      if (sortKey === 0 && typeof fm.date === 'string') {
        const d = new Date(fm.date)
        if (!isNaN(d.getTime())) sortKey = d.getTime()
      }
      articles.push({
        slug,
        title: fm.title ?? slug,
        description: fm.description ?? '',
        category: fm.category ?? 'Article',
        date: fm.date ?? '',
        updated: fm.updated,
        readingTime: fm.readingTime,
        authorName:
          fm.author && typeof fm.author === 'object'
            ? fm.author.name
            : undefined,
        sortKey,
      })
    } catch {
      // article illisible : on l'ignore plutôt que casser la page
    }
  }
  // Plus récent en premier
  articles.sort((a, b) => b.sortKey - a.sortKey)
  return articles
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs catégorie (palette V4)
// ─────────────────────────────────────────────────────────────────────────────
function categoryBadgeClass(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('avis') || c.includes('comparatif')) {
    return 'bg-[#ff7a1a]/12 text-[#ff7a1a] ring-1 ring-[#ff7a1a]/20'
  }
  if (c.includes('guide')) {
    return 'bg-[#5ab4e0]/15 text-[#1d5b8a] ring-1 ring-[#5ab4e0]/30'
  }
  if (c.includes('actualité') || c.includes('actualite')) {
    return 'bg-[#0f1a3a]/8 text-[#0f1a3a] ring-1 ring-[#0f1a3a]/15'
  }
  return 'bg-[#f5c842]/20 text-[#0f1a3a] ring-1 ring-[#f5c842]/40'
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function BlogPage() {
  const articles = getAllArticles()

  // Schema.org Blog + ItemList pour aider Google à comprendre la structure
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog`,
    name: 'Blog Nexartis',
    description:
      'Comparatifs et avis sur les logiciels de devis-facture pour artisans BTP.',
    url: `${SITE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'Nexartis',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo-nexartis.png`,
      },
    },
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.description,
      url: `${SITE_URL}/blog/${a.slug}`,
      datePublished: a.updated || a.date,
      author: a.authorName
        ? { '@type': 'Person', name: a.authorName }
        : undefined,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="bg-[#0f1a3a] py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="inline-block rounded-full bg-white/8 px-4 py-1.5 font-hanken text-xs font-semibold uppercase tracking-wider text-[#ff7a1a] ring-1 ring-[#ff7a1a]/30">
            Le blog Nexartis
          </span>
          <h1 className="mt-6 font-hanken text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">
            Avis & guides pour artisans BTP
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-hanken text-lg text-gray-300 md:text-xl">
            Comparatifs honnêtes des logiciels de devis-facture (Tolteck,
            Henrri, Obat, Vertuoza, Batigest) et guides pratiques pour mieux
            gérer votre activité. Notre regard d&apos;artisan-fondateur.
          </p>
        </div>
      </section>

      {/* Grille articles */}
      <section className="bg-[#f6f8fb] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          {articles.length === 0 ? (
            <p className="text-center font-hanken text-gray-500">
              Aucun article publié pour le moment.
            </p>
          ) : (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 hover:shadow-lg"
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-hanken text-xs font-semibold ${categoryBadgeClass(
                      a.category
                    )}`}
                  >
                    {a.category}
                  </span>

                  <h2 className="mt-4 font-hanken text-lg font-bold leading-snug text-[#0f1a3a] transition group-hover:text-[#ff7a1a] md:text-xl">
                    {a.title}
                  </h2>

                  {a.description && (
                    <p className="mt-3 flex-1 font-hanken text-sm leading-relaxed text-gray-600">
                      {a.description}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-hanken text-xs text-gray-500">
                    {a.authorName && (
                      <span className="font-medium text-[#0f1a3a]">
                        {a.authorName}
                      </span>
                    )}
                    {a.authorName && a.date && (
                      <span className="h-1 w-1 rounded-full bg-gray-300" />
                    )}
                    {a.date && <span>{a.date}</span>}
                    {a.readingTime && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span>{a.readingTime} de lecture</span>
                      </>
                    )}
                  </div>

                  <span className="mt-5 inline-flex items-center gap-1 font-hanken text-sm font-semibold text-[#ff7a1a]">
                    Lire l&apos;article
                    <svg
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.25 4.25a.75.75 0 0 1 0 1.08l-4.25 4.25a.75.75 0 0 1-1.06-.02Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA légitime : essai gratuit Nexartis */}
      <section className="bg-[#0f1a3a] py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-hanken text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            Vous comparez les logiciels artisan&nbsp;?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-hanken text-gray-300">
            Testez Nexartis gratuitement pendant 14 jours. Sans carte
            bancaire, sans engagement.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-xl bg-[#ff7a1a] px-8 py-4 font-hanken text-lg font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition hover:bg-[#ff8a32]"
          >
            Essayer Nexartis gratuitement
          </Link>
        </div>
      </section>
    </>
  )
}
