'use client'

/**
 * BlogArticleLayout — Layout premium pour articles avis/comparatif Nexartis.
 *
 * Design : éditorial light (lecture longue), accents V4 (electric / accent /
 * mint) + polices Hanken/Spline-mono. Reste cohérent avec la landing dark
 * sans sacrifier la lisibilité des longs articles.
 *
 * Fonctionnalités :
 *  - Reading progress bar fixed-top (scroll %)
 *  - Hero éditorial (eyebrow, h1, sous-titre, meta)
 *  - Layout split desktop : TOC sticky | contenu | CTA partage sticky
 *  - TOC scrollspy (IntersectionObserver) avec highlight section active
 *  - Mobile : TOC en accordéon collapsible en haut
 *  - Footer article : bio auteur, articles connexes, CTA final
 *
 * Usage :
 *   <BlogArticleLayout frontmatter={fm}>{markdownContent}</BlogArticleLayout>
 *
 * Le `children` est ce qui sera rendu dans la colonne centrale (typiquement
 * le composant <ArticleMarkdown source={...} /> ).
 */

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

export type BlogFrontmatter = {
  title: string
  description?: string
  category?: string
  date: string // ISO ou "8 mars 2026"
  readingTime?: string // ex: "8 min"
  author?: {
    name: string
    role?: string
    avatar?: string
    bio?: string
  }
  heroImage?: string
  /** Articles connexes (slug + titre + excerpt + catégorie) */
  related?: Array<{
    slug: string
    title: string
    excerpt?: string
    category?: string
  }>
}

type TocItem = { id: string; text: string; level: 2 | 3 }

export default function BlogArticleLayout({
  children,
  frontmatter,
  tableOfContents,
}: {
  children: React.ReactNode
  frontmatter: BlogFrontmatter
  /** Si fourni : TOC déjà extrait. Sinon : extrait automatiquement du DOM après mount. */
  tableOfContents?: TocItem[]
}) {
  const [progress, setProgress] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [autoToc, setAutoToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(false)

  const toc = useMemo(
    () => (tableOfContents && tableOfContents.length ? tableOfContents : autoToc),
    [tableOfContents, autoToc]
  )

  // Reading progress bar — calcule scrollY / (scrollHeight - innerHeight)
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const scrollMax = h.scrollHeight - h.clientHeight
      const pct = scrollMax > 0 ? (h.scrollTop / scrollMax) * 100 : 0
      setProgress(Math.min(100, Math.max(0, pct)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-extraction TOC depuis le DOM si non fourni en prop
  useEffect(() => {
    if (tableOfContents && tableOfContents.length) return
    const root = document.getElementById('article-body')
    if (!root) return
    const headings = root.querySelectorAll<HTMLHeadingElement>('h2, h3')
    const items: TocItem[] = []
    headings.forEach((h) => {
      if (!h.id) {
        // slug très basique
        h.id = (h.textContent || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      }
      items.push({
        id: h.id,
        text: h.textContent || '',
        level: h.tagName === 'H2' ? 2 : 3,
      })
    })
    setAutoToc(items)
  }, [tableOfContents])

  // Scrollspy : highlight section active dans le TOC
  useEffect(() => {
    if (!toc.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    )
    toc.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [toc])

  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://nexartis.fr/blog'

  return (
    <article className="bg-white text-[#0f1a3a]">
      {/* ═══════ Reading progress bar (fixed top) ═══════ */}
      <div
        className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full origin-left bg-gradient-to-r from-[#3f7bff] via-[#ff7a1a] to-[#2fd6a0] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ═══════ Hero ═══════ */}
      <header className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-[#f6f8fb] via-white to-[#fef6ef]">
        {/* blob accent décoratif */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#ff7a1a]/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 bottom-0 h-[360px] w-[360px] rounded-full bg-[#3f7bff]/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 md:pb-20 md:pt-28">
          {frontmatter.category && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 px-4 py-1.5 font-hanken text-xs font-bold uppercase tracking-[0.12em] text-[#c54e00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a1a]" />
              {frontmatter.category}
            </span>
          )}

          <h1 className="mt-6 font-hanken text-4xl font-extrabold leading-[1.08] tracking-tight text-[#0f1a3a] md:text-5xl lg:text-6xl">
            {frontmatter.title}
          </h1>

          {frontmatter.description && (
            <p className="mt-6 max-w-3xl font-hanken text-lg leading-relaxed text-gray-600 md:text-xl">
              {frontmatter.description}
            </p>
          )}

          {/* Meta : date, lecture, auteur */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-gray-200/70 pt-6 text-sm">
            {frontmatter.author && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#3f7bff] to-[#8b6dff] font-hanken text-sm font-bold text-white">
                  {frontmatter.author.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontmatter.author.avatar}
                      alt={frontmatter.author.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initialsOf(frontmatter.author.name)
                  )}
                </div>
                <div className="font-hanken">
                  <div className="text-sm font-semibold text-[#0f1a3a]">
                    {frontmatter.author.name}
                  </div>
                  {frontmatter.author.role && (
                    <div className="text-xs text-gray-500">
                      {frontmatter.author.role}
                    </div>
                  )}
                </div>
              </div>
            )}
            <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
            <span className="font-hanken text-gray-500">{frontmatter.date}</span>
            {frontmatter.readingTime && (
              <>
                <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
                <span className="font-hanken text-gray-500">
                  {frontmatter.readingTime} de lecture
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════ Hero image (optionnelle) ═══════ */}
      {frontmatter.heroImage && (
        <div className="mx-auto max-w-5xl px-6 py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frontmatter.heroImage}
            alt={frontmatter.title}
            className="aspect-[16/9] w-full rounded-2xl object-cover shadow-xl shadow-black/5"
          />
        </div>
      )}

      {/* ═══════ Mobile TOC accordion ═══════ */}
      {toc.length > 0 && (
        <div className="mx-auto mt-8 max-w-3xl px-6 lg:hidden">
          <details
            className="rounded-2xl border border-gray-200 bg-gray-50/60 px-5 py-4"
            open={tocOpen}
            onToggle={(e) => setTocOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="flex cursor-pointer items-center justify-between font-hanken text-sm font-bold uppercase tracking-wider text-[#0f1a3a]">
              <span>Sommaire ({toc.length})</span>
              <svg
                className={`h-4 w-4 transition-transform ${tocOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <ul className="mt-4 space-y-2">
              {toc.map((item) => (
                <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setTocOpen(false)}
                    className="block font-hanken text-sm text-gray-600 transition hover:text-[#ff7a1a]"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* ═══════ Layout split desktop ═══════ */}
      <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-10">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)_200px] lg:gap-10">
          {/* ─── Colonne gauche : TOC sticky ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-2">
              <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                Sommaire
              </div>
              <nav className="mt-4">
                <ul className="space-y-1.5 border-l border-gray-200">
                  {toc.map((item) => {
                    const active = activeId === item.id
                    return (
                      <li
                        key={item.id}
                        className={item.level === 3 ? 'pl-5' : 'pl-3'}
                      >
                        <a
                          href={`#${item.id}`}
                          className={`-ml-px block border-l-2 py-1.5 pl-3 font-hanken text-sm leading-snug transition ${
                            active
                              ? 'border-[#ff7a1a] font-semibold text-[#0f1a3a]'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-[#0f1a3a]'
                          }`}
                        >
                          {item.text}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 flex items-center gap-2 font-hanken text-xs font-semibold text-gray-500 transition hover:text-[#ff7a1a]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Retour en haut
              </button>
            </div>
          </aside>

          {/* ─── Colonne centrale : contenu ─── */}
          <div
            id="article-body"
            className="mx-auto w-full max-w-[860px]"
          >
            {children}
          </div>

          {/* ─── Colonne droite : CTA + partage sticky ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {/* Mini CTA Nexartis */}
              <div className="rounded-2xl border border-[#ff7a1a]/20 bg-gradient-to-br from-[#fef6ef] to-white p-5">
                <div className="font-hanken text-[11px] font-bold uppercase tracking-wider text-[#c54e00]">
                  Essai gratuit
                </div>
                <h3 className="mt-2 font-hanken text-base font-bold leading-snug text-[#0f1a3a]">
                  Testez Nexartis 14 jours sans CB
                </h3>
                <p className="mt-2 font-hanken text-xs leading-relaxed text-gray-600">
                  Devis, factures, planning chantier. Dès 15 €/mois ensuite.
                </p>
                <Link
                  href="/register"
                  className="mt-4 block w-full rounded-xl bg-[#ff7a1a] py-2.5 text-center font-hanken text-sm font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition hover:scale-[1.02] hover:bg-[#f09050]"
                >
                  Commencer
                </Link>
              </div>

              {/* Partage */}
              <div>
                <div className="font-hanken text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Partager
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <ShareButton
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(frontmatter.title)}&url=${encodeURIComponent(shareUrl)}`}
                    label="X / Twitter"
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    }
                  />
                  <ShareButton
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    label="LinkedIn"
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 17.66V10.5H6.07v7.16zM7.2 9.5a1.32 1.32 0 1 0 0-2.64 1.32 1.32 0 0 0 0 2.64m10.46 8.16v-3.93c0-2.1-1.12-3.08-2.62-3.08a2.26 2.26 0 0 0-2.05 1.13V10.5h-2.27v7.16h2.27v-4c0-1.06.2-2.08 1.51-2.08 1.3 0 1.31 1.21 1.31 2.15v3.93z" />
                      </svg>
                    }
                  />
                  <ShareButton
                    href={`mailto:?subject=${encodeURIComponent(frontmatter.title)}&body=${encodeURIComponent(shareUrl)}`}
                    label="Email"
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ═══════ Footer article : bio auteur + connexes + CTA ═══════ */}
      <footer className="border-t border-gray-100 bg-[#f6f8fb]">
        <div className="mx-auto max-w-[860px] px-6 py-16">
          {/* Bio auteur complète */}
          {frontmatter.author?.bio && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3f7bff] to-[#8b6dff] font-hanken text-xl font-bold text-white">
                  {frontmatter.author.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontmatter.author.avatar}
                      alt={frontmatter.author.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initialsOf(frontmatter.author.name)
                  )}
                </div>
                <div>
                  <div className="font-hanken text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    À propos de l&apos;auteur
                  </div>
                  <div className="mt-1 font-hanken text-lg font-bold text-[#0f1a3a]">
                    {frontmatter.author.name}
                  </div>
                  {frontmatter.author.role && (
                    <div className="font-hanken text-sm text-[#ff7a1a]">
                      {frontmatter.author.role}
                    </div>
                  )}
                  <p className="mt-3 font-hanken text-sm leading-relaxed text-gray-600">
                    {frontmatter.author.bio}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Articles connexes */}
          {frontmatter.related && frontmatter.related.length > 0 && (
            <div className="mt-14">
              <h2 className="font-hanken text-2xl font-bold text-[#0f1a3a]">
                À lire ensuite
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {frontmatter.related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#ff7a1a]/30 hover:shadow-lg"
                  >
                    {r.category && (
                      <span className="self-start rounded-full bg-[#3f7bff]/10 px-3 py-1 font-hanken text-[11px] font-bold uppercase tracking-wider text-[#3f7bff]">
                        {r.category}
                      </span>
                    )}
                    <h3 className="mt-3 font-hanken text-base font-bold leading-snug text-[#0f1a3a] group-hover:text-[#ff7a1a]">
                      {r.title}
                    </h3>
                    {r.excerpt && (
                      <p className="mt-2 line-clamp-3 font-hanken text-sm leading-relaxed text-gray-600">
                        {r.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA final */}
          <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1a3a] via-[#1a2d5a] to-[#0f1a3a] p-8 text-center md:p-12">
            <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff9d4d]">
              Essai gratuit 14 jours
            </div>
            <h2 className="mt-3 font-hanken text-2xl font-extrabold text-white md:text-3xl">
              Prêt à essayer Nexartis ?
            </h2>
            <p className="mx-auto mt-3 max-w-lg font-hanken text-gray-300">
              Devis, factures, planning chantier. Essai gratuit 14 jours, sans carte bancaire.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-7 py-3.5 font-hanken text-base font-bold text-white shadow-xl shadow-[#ff7a1a]/30 transition hover:scale-[1.02] hover:bg-[#f09050]"
            >
              Commencer maintenant
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </article>
  )
}

// ═══════ Helpers ═══════

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
}

function ShareButton({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 font-hanken text-xs font-semibold text-gray-600 transition hover:border-[#0f1a3a] hover:text-[#0f1a3a]"
      aria-label={`Partager sur ${label}`}
    >
      <span className="text-gray-400 transition group-hover:text-[#ff7a1a]">
        {icon}
      </span>
      {label}
    </a>
  )
}
