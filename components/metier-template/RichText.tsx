"use client";

/**
 * RichText — Parser markdown inline pour les data files métier.
 *
 * Transforme dans une string :
 *  - **mot ou expression** → <strong>mot ou expression</strong>
 *  - [label](/href) → <Link href="/href">label</Link>  (lien interne)
 *  - [label](https://...) → <a href="https://..." target="_blank" rel="noopener">label</a>  (lien sortant)
 *
 * Usage :
 *   <RichText text="Nexartis gère **la TVA** et permet de **lier vos chantiers**. Voir [tarifs](/tarifs)." />
 */

import Link from "next/link";
import React from "react";

export default function RichText({ text }: { text: string }) {
  if (!text) return null;

  // Parse les liens [label](href) puis les **bold**
  const tokens: (string | React.ReactNode)[] = [];
  let cursor = 0;
  const pattern = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push(text.slice(cursor, match.index));
    }

    const found = match[0];
    if (found.startsWith("[")) {
      // Link
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(found);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const isExternal = /^https?:\/\//.test(href);
        if (isExternal) {
          tokens.push(
            <a
              key={`rt-${key++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#ff7a1a] underline decoration-[#ff7a1a]/30 underline-offset-2 hover:decoration-[#ff7a1a]"
            >
              {label}
            </a>
          );
        } else {
          tokens.push(
            <Link
              key={`rt-${key++}`}
              href={href}
              className="font-semibold text-[#ff7a1a] underline decoration-[#ff7a1a]/30 underline-offset-2 hover:decoration-[#ff7a1a]"
            >
              {label}
            </Link>
          );
        }
      }
    } else if (found.startsWith("**")) {
      // Bold
      const boldContent = found.slice(2, -2);
      tokens.push(
        <strong key={`rt-${key++}`} className="font-bold text-[#0f1a3a]">
          {boldContent}
        </strong>
      );
    }

    cursor = match.index + found.length;
  }

  if (cursor < text.length) {
    tokens.push(text.slice(cursor));
  }

  return <>{tokens.map((t, i) => <React.Fragment key={i}>{t}</React.Fragment>)}</>;
}
