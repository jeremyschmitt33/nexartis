/**
 * ArticleMarkdown — Rendu styling premium des articles blog.
 *
 * Cas 1 (par défaut) : la prop `html` est passée (Markdown déjà converti en
 * HTML côté serveur via `remark`/`marked`/`micromark`...). Le composant
 * applique le styling éditorial via la classe `.article-prose` et les
 * sélecteurs CSS-in-JSX ci-dessous.
 *
 * Cas 2 : la prop `children` est passée (JSX direct) — utile si tu préfères
 * écrire ton contenu en MDX/React directement.
 *
 * → Pour activer le rendu markdown→html, installer en complément :
 *      npm i react-markdown remark-gfm
 *   et créer une variante client `<ReactMarkdownRenderer source={...}/>`
 *   qui consomme ce composant via `<ArticleMarkdown html={renderedHtml} />`.
 *
 * Styling éditorial (cf. skill writing) :
 *  - max-w-[860px] (parent), line-height 1.7
 *  - H2 : marge top 3rem, taille 2rem
 *  - H3 : marge top 2rem, taille 1.5rem
 *  - p  : margin-bottom 1.25rem
 *  - ul/ol : padding-left 1.5rem, marker accent
 *  - blockquote : encart "À retenir" accent
 *  - table : header accent, hover row
 */

import type { ReactNode } from 'react'

export default function ArticleMarkdown({
  html,
  children,
}: {
  /** HTML string (markdown pré-rendu). Inséré via dangerouslySetInnerHTML. */
  html?: string
  /** Alternative : contenu JSX direct (sera enveloppé du même styling). */
  children?: ReactNode
}) {
  return (
    <div className="article-prose font-hanken text-[17px] leading-[1.75] text-[#1f2937]">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        children
      )}

      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx global>{`
        .article-prose > div > *:first-child,
        .article-prose > *:first-child {
          margin-top: 0;
        }

        /* ───── Headings ───── */
        .article-prose h2 {
          margin-top: 3.5rem;
          margin-bottom: 1.25rem;
          font-family: var(--font-hanken), 'Hanken Grotesk', sans-serif;
          font-size: 2rem;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.015em;
          color: #0f1a3a;
          scroll-margin-top: 100px;
          position: relative;
        }
        .article-prose h2::before {
          content: '';
          position: absolute;
          left: -1.25rem;
          top: 0.6rem;
          width: 4px;
          height: 1.6rem;
          background: linear-gradient(180deg, #ff7a1a, #3f7bff);
          border-radius: 2px;
        }
        .article-prose h3 {
          margin-top: 2.25rem;
          margin-bottom: 0.85rem;
          font-family: var(--font-hanken), sans-serif;
          font-size: 1.4rem;
          font-weight: 700;
          line-height: 1.3;
          letter-spacing: -0.01em;
          color: #0f1a3a;
          scroll-margin-top: 100px;
        }
        .article-prose h4 {
          margin-top: 1.75rem;
          margin-bottom: 0.6rem;
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f1a3a;
        }

        /* ───── Paragraphes ───── */
        .article-prose p {
          margin-bottom: 1.25rem;
        }
        .article-prose strong {
          color: #0f1a3a;
          font-weight: 700;
        }
        .article-prose em {
          color: #c54e00;
          font-style: normal;
          font-weight: 600;
        }

        /* ───── Liens ───── */
        .article-prose a {
          color: #3f7bff;
          font-weight: 600;
          text-decoration: underline;
          text-decoration-color: rgba(63, 123, 255, 0.35);
          text-underline-offset: 3px;
          transition: all 0.15s ease;
        }
        .article-prose a:hover {
          color: #ff7a1a;
          text-decoration-color: #ff7a1a;
        }

        /* ───── Listes ───── */
        .article-prose ul,
        .article-prose ol {
          margin-bottom: 1.5rem;
          padding-left: 1.6rem;
        }
        .article-prose ul {
          list-style: disc;
        }
        .article-prose ol {
          list-style: decimal;
        }
        .article-prose li {
          margin-bottom: 0.5rem;
          padding-left: 0.25rem;
        }
        .article-prose li::marker {
          color: #ff7a1a;
          font-weight: 700;
        }
        .article-prose li > ul,
        .article-prose li > ol {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }

        /* ───── Blockquote = encart "À retenir" ───── */
        .article-prose blockquote {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem;
          border-left: 4px solid #ff7a1a;
          background: linear-gradient(
            135deg,
            rgba(255, 122, 26, 0.07),
            rgba(255, 122, 26, 0.02)
          );
          border-radius: 0 12px 12px 0;
          font-size: 1.05rem;
          color: #0f1a3a;
        }
        .article-prose blockquote p:last-child {
          margin-bottom: 0;
        }
        .article-prose blockquote::before {
          content: '✦ À retenir';
          display: block;
          margin-bottom: 0.5rem;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c54e00;
        }

        /* ───── Tableaux ───── */
        .article-prose .table-wrapper,
        .article-prose figure.table {
          margin: 2rem 0;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .article-prose table {
          width: 100%;
          min-width: 540px;
          border-collapse: collapse;
          font-size: 0.95rem;
        }
        .article-prose thead th {
          background: linear-gradient(180deg, #0f1a3a, #1a2d5a);
          color: #fff;
          font-family: var(--font-hanken), sans-serif;
          font-weight: 700;
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 14px 16px;
          text-align: left;
        }
        .article-prose tbody td {
          padding: 14px 16px;
          border-top: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: top;
        }
        .article-prose tbody tr {
          transition: background 0.15s;
        }
        .article-prose tbody tr:hover {
          background: #fef6ef;
        }
        .article-prose tbody tr:nth-child(even) {
          background: #fafbfd;
        }
        .article-prose tbody tr:nth-child(even):hover {
          background: #fef0e3;
        }

        /* ───── Code ───── */
        .article-prose code {
          background: #f1f5f9;
          color: #1e293b;
          padding: 0.15rem 0.4rem;
          border-radius: 6px;
          font-family: var(--font-spline-mono), 'Spline Sans Mono', monospace;
          font-size: 0.9em;
        }
        .article-prose pre {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem;
          background: #0f1a3a;
          color: #eaf0ff;
          border-radius: 14px;
          overflow-x: auto;
          font-family: var(--font-spline-mono), monospace;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .article-prose pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }

        /* ───── HR ───── */
        .article-prose hr {
          margin: 3rem 0;
          border: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            #e5e7eb 30%,
            #e5e7eb 70%,
            transparent
          );
        }

        /* ───── Images ───── */
        .article-prose img {
          margin: 2rem auto;
          max-width: 100%;
          height: auto;
          border-radius: 14px;
          box-shadow: 0 12px 32px rgba(15, 26, 58, 0.08);
        }

        /* ───── Numbers (.num) helper si markdown rend chiffres en <span class="num"> ───── */
        .article-prose .num,
        .article-prose .score {
          font-family: var(--font-spline-mono), monospace;
          font-feature-settings: 'tnum';
        }

        /* Mobile : réduire un peu les marges */
        @media (max-width: 640px) {
          .article-prose {
            font-size: 16px;
          }
          .article-prose h2 {
            font-size: 1.65rem;
            margin-top: 2.75rem;
          }
          .article-prose h2::before {
            left: -0.85rem;
          }
          .article-prose h3 {
            font-size: 1.2rem;
            margin-top: 2rem;
          }
        }
      `}</style>
    </div>
  )
}
