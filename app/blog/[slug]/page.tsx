/**
 * Route dynamique : /blog/[slug]
 *
 * Charge dynamiquement un article markdown depuis content/blog/<slug>.md
 * et le rend via BlogArticleLayout + ArticleMarkdown.
 *
 * - Parser frontmatter YAML simple (clone de l'ancienne page tolteck-avis)
 * - Mini-parser markdown maison (clone de l'ancienne page tolteck-avis)
 * - Schema.org JSON-LD (Article + FAQPage si question H3 dans la section FAQ)
 * - generateStaticParams : SSG sur tous les slugs disponibles
 * - notFound() si le slug n'existe pas
 *
 * À installer pour passer en prod sereinement (refactor futur) :
 *   npm i gray-matter remark remark-gfm remark-html
 */

import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BlogArticleLayout, {
  BlogFrontmatter,
} from '@/components/blog/BlogArticleLayout'
import ArticleMarkdown from '@/components/blog/ArticleMarkdown'

const SITE_URL = 'https://nexartis.fr'
const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ slug: f.replace(/\.md$/, '') }))
}

function loadArticle(slug: string): {
  frontmatter: BlogFrontmatter
  body: string
  html: string
} | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw)
  const html = mdToHtml(body)
  return { frontmatter, body, html }
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const article = loadArticle(params.slug)
  if (!article) {
    return {
      title: 'Article introuvable — Blog Nexartis',
      description: "Cet article n'existe pas ou a été déplacé.",
    }
  }
  const fm = article.frontmatter
  return {
    title: `${fm.title} — Blog Nexartis`,
    description: fm.description,
    alternates: { canonical: `/blog/${params.slug}` },
    openGraph: {
      title: fm.title,
      description: fm.description,
      type: 'article',
      url: `${SITE_URL}/blog/${params.slug}`,
      images: fm.heroImage ? [{ url: fm.heroImage }] : undefined,
    },
  }
}

export default function BlogArticlePage({ params }: { params: Params }) {
  const article = loadArticle(params.slug)
  if (!article) {
    notFound()
  }
  const { frontmatter, body, html } = article!

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: frontmatter.title,
    description: frontmatter.description,
    inLanguage: 'fr',
    datePublished:
      (frontmatter as { publishedDate?: string }).publishedDate ||
      frontmatter.date,
    dateModified:
      (frontmatter as { updated?: string }).updated ||
      (frontmatter as { publishedDate?: string }).publishedDate ||
      frontmatter.date,
    author: frontmatter.author
      ? {
          '@type': 'Person',
          name: frontmatter.author.name,
          jobTitle: frontmatter.author.role,
          worksFor: {
            '@type': 'Organization',
            '@id': 'https://nexartis.fr/#organization',
            name: 'Nexartis',
          },
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Nexartis',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo-nexartis.png`,
      },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${params.slug}`,
    image: frontmatter.heroImage
      ? `${SITE_URL}${frontmatter.heroImage}`
      : undefined,
  }

  // Extraction FAQ : H3 + paragraphe qui les suit, à l'intérieur de la section
  // FAQ (H2 dont le titre contient "FAQ" ou "questions" ou "fréquentes").
  const faqItems = extractFaqItems(body)
  const faqSchema =
    faqItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((q) => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: q.answer,
            },
          })),
        }
      : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <BlogArticleLayout frontmatter={frontmatter}>
        <ArticleMarkdown html={html} />
      </BlogArticleLayout>
    </>
  )
}

// ═════════════════ Helpers ═════════════════
// Clones EXACTS du parser de l'ancienne page tolteck-avis (déjà éprouvé en
// prod). Ne pas modifier sans test cross-article complet.

function parseFrontmatter(raw: string): {
  frontmatter: BlogFrontmatter
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return {
      frontmatter: { title: 'Sans titre', date: '' } as BlogFrontmatter,
      body: raw,
    }
  }
  const yaml = match[1]
  const body = match[2]
  const fm: any = {}
  let currentArrayKey: string | null = null
  let currentObjectKey: string | null = null
  yaml.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return
    if (line.startsWith('  - ') && currentArrayKey) {
      const obj: any = {}
      const inline = line.slice(4).split(',').map((s) => s.trim())
      inline.forEach((kv) => {
        const i = kv.indexOf(':')
        if (i > 0) obj[kv.slice(0, i).trim()] = stripQuotes(kv.slice(i + 1).trim())
      })
      fm[currentArrayKey].push(obj)
      return
    }
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
      currentArrayKey = null
      fm[key] = {}
    } else if (val === '[]') {
      fm[key] = []
      currentArrayKey = key
      currentObjectKey = null
    } else {
      fm[key] = stripQuotes(val)
      currentObjectKey = null
      currentArrayKey = null
    }
  })
  return { frontmatter: fm as BlogFrontmatter, body }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/**
 * Mini markdown→HTML (best-effort). Couvre : H2/H3, p, ul/ol, **bold**,
 * *italic*, [link](url), `inline`, blockquote, table GFM. NE PAS utiliser
 * en prod sur du contenu non-confiance. → remplacer par `remark` ASAP.
 */
function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let i = 0

  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  const slug = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    let m: RegExpMatchArray | null
    if ((m = line.match(/^###\s+(.+)$/))) {
      out.push(`<h3 id="${slug(m[1])}">${inline(m[1])}</h3>`)
      i++
      continue
    }
    if ((m = line.match(/^##\s+(.+)$/))) {
      out.push(`<h2 id="${slug(m[1])}">${inline(m[1])}</h2>`)
      i++
      continue
    }
    if ((m = line.match(/^#\s+(.+)$/))) {
      // H1 ignoré : déjà affiché en hero
      i++
      continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out.push('<hr/>')
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2))
        i++
      }
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`)
      continue
    }

    // Table GFM
    if (line.includes('|') && lines[i + 1] && /^\s*\|?\s*[:\- ]+\|/.test(lines[i + 1])) {
      const headers = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]))
        i++
      }
      let t = '<div class="table-wrapper"><table><thead><tr>'
      headers.forEach((h) => (t += `<th>${inline(h)}</th>`))
      t += '</tr></thead><tbody>'
      rows.forEach((r) => {
        t += '<tr>'
        r.forEach((c) => (t += `<td>${inline(c)}</td>`))
        t += '</tr>'
      })
      t += '</tbody></table></div>'
      out.push(t)
      continue
    }

    // Listes
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      out.push('<ul>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>')
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      out.push('<ol>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ol>')
      continue
    }

    // Paragraphe (regrouper jusqu'à ligne vide)
    if (line.trim() === '') {
      i++
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|>\s|[-*]\s|\d+\.\s|\|)/.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }

  return out.join('\n')
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((s) => s.trim())
}

/**
 * Extrait les FAQ (H3 + paragraphe suivant) d'une section H2 qui contient
 * "FAQ" ou "questions fréquentes". Utilisé pour le Schema.org FAQPage.
 */
function extractFaqItems(
  md: string
): Array<{ question: string; answer: string }> {
  const lines = md.split(/\r?\n/)
  const items: Array<{ question: string; answer: string }> = []
  let inFaqSection = false
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      const titleLower = h2[1].toLowerCase()
      inFaqSection =
        titleLower.includes('faq') ||
        titleLower.includes('questions fréquent') ||
        titleLower.includes('questions frequent')
      i++
      continue
    }
    if (!inFaqSection) {
      i++
      continue
    }
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      const question = h3[1].trim()
      i++
      const answerBuf: string[] = []
      while (
        i < lines.length &&
        !/^##\s+/.test(lines[i]) &&
        !/^###\s+/.test(lines[i])
      ) {
        if (lines[i].trim() !== '') answerBuf.push(lines[i].trim())
        i++
      }
      const answer = answerBuf.join(' ').replace(/\s+/g, ' ').trim()
      if (answer) items.push({ question, answer })
      continue
    }
    i++
  }
  return items
}
