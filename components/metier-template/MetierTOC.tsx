"use client";
import { useEffect, useState } from "react";
import type { TocItem } from "./types";

/**
 * MetierTOC — Sommaire sticky desktop + accordéon mobile.
 *
 * Pattern repris de BlogArticleLayout : scrollspy via IntersectionObserver,
 * highlight de la section active, retour en haut.
 *
 * Layout :
 *  - Desktop (lg+) : sticky 240px à gauche
 *  - Mobile (<lg)  : accordéon collapsible en haut
 *
 * Le composant gère lui-même les deux variantes via les classes Tailwind.
 */
export default function MetierTOC({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop
          );
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  return (
    <>
      {/* ─── Mobile : accordéon ─── */}
      <div className="lg:hidden">
        <details
          className="rounded-2xl border border-gray-200 bg-gray-50/60 px-5 py-4"
          open={tocOpen}
          onToggle={(e) => setTocOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer items-center justify-between font-hanken text-sm font-bold uppercase tracking-wider text-[#0f1a3a]">
            <span>Sommaire ({items.length})</span>
            <svg
              className={`h-4 w-4 transition-transform ${tocOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setTocOpen(false)}
                  className="block font-hanken text-sm text-gray-600 transition hover:text-[#ff7a1a]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* ─── Desktop : sticky aside ─── */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-2">
          <div className="font-hanken text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Sommaire
          </div>
          <nav className="mt-4">
            <ul className="space-y-1.5 border-l border-gray-200">
              {items.map((item) => {
                const active = activeId === item.id;
                return (
                  <li key={item.id} className="pl-3">
                    <a
                      href={`#${item.id}`}
                      className={`-ml-px block border-l-2 py-1.5 pl-3 font-hanken text-sm leading-snug transition ${
                        active
                          ? "border-[#ff7a1a] font-semibold text-[#0f1a3a]"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-[#0f1a3a]"
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-8 flex items-center gap-2 font-hanken text-xs font-semibold text-gray-500 transition hover:text-[#ff7a1a]"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
            Retour en haut
          </button>
        </div>
      </aside>
    </>
  );
}
