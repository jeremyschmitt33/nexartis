/**
 * Page exemple : /blog/tolteck-avis
 *
 * Sert de référence pour TOUS les futurs articles avis/comparatif.
 * - Lit le fichier markdown depuis content/blog/tolteck-avis.md
 * - Parse le frontmatter YAML simple (voir helpers ci-dessous)
 * - Rend via BlogArticleLayout + ArticleMarkdown
 * - Injecte le Schema.org JSON-LD (Article)
 *
 * À installer pour passer en prod sereinement :
 *   npm i gray-matter remark remark-gfm remark-html
 * Puis remplacer parseFrontmatter() + mdToHtml() par les vraies libs.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import BlogArticleLayout, {
  BlogFrontmatter,
} from '@/components/blog/BlogArticleLayout'
import ArticleMarkdown from '@/components/blog/ArticleMarkdown'

const SLUG = 'tolteck-avis'
const SITE_URL = 'https://nexartis.fr'

function loadArticle() {
  const filePath = path.join(process.cwd(), 'content', 'blog', `${SLUG}.md`)
  if (!fs.existsSync(filePath)) {
    return {
      frontmatter: {
        title: 'Tolteck — Avis complet (à venir)',
        description: 'Article en cours de rédaction.',
        date: new Date().toLocaleDateString('fr-FR'),
      } as BlogFrontmatter,
      html: '<p>L\'article est en cours de rédaction. Reviens bientôt !</p>',
    }
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw)
  const html = mdToHtml(body)
  return { frontmatter, html }
}

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = loadArticle()
  return {
    title: `${frontmatter.title} — Blog Nexartis`,
    description: frontmatter.description,
    alternates: { canonical: `/blog/${SLUG}` },
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      type: 'article',
      url: `${SITE_URL}/blog/${SLUG}`,
      images: frontmatter.heroImage
        ? [{ url: frontmatter.heroImage }]
        : undefined,
    },
  }
}

export default function ToltectAvisPage() {
  const { frontmatter, html } = loadArticle()

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    author: frontmatter.author
      ? { '@type': 'Person', name: frontmatter.author.name }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Nexartis',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo-nexartis.png`,
      },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${SLUG}`,
    image: frontmatter.heroImage
      ? `${SITE_URL}${frontmatter.heroImage}`
      : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogArticleLayout frontmatter={frontmatter}>
        <ArticleMarkdown html={html} />
      </BlogArticleLayout>
    </>
  )
}

// ═════════════════ Helpers temporaires ═════════════════
// À remplacer par gray-matter + remark dès que possible.

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
      // Soit objet, soit array suivant
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
  // Heuristique : si une clé objet est restée vide après lecture et qu'on a
  // rencontré des "  - " ensuite, c'était en fait un array.
  Object.keys(fm).forEach((k) => {
    if (typeof fm[k] === 'object' && !Array.isArray(fm[k]) && Object.keys(fm[k]).length === 0) {
      // laisser tel quel
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
