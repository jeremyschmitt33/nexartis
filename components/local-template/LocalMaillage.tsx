"use client";

import Link from "next/link";

/**
 * LocalMaillage — Grille de cards éditoriales pour le maillage SEO inter-villes
 * et inter-métiers.
 *
 * Affiche les ancresMaillage fournies + chips fallback vers les autres villes
 * + métiers du BTP pour booster le crawl local.
 */
const otherCities = [
  { nom: "Bordeaux", href: "/logiciel-artisan-bordeaux" },
  { nom: "Lyon", href: "/logiciel-artisan-lyon" },
  { nom: "Marseille", href: "/logiciel-artisan-marseille" },
];

const popularMetiers = [
  { nom: "Plombier", href: "/logiciel-devis-plombier" },
  { nom: "Électricien", href: "/logiciel-devis-electricien" },
  { nom: "Maçon", href: "/logiciel-devis-maconnerie" },
  { nom: "Couvreur", href: "/logiciel-devis-couvreur" },
  { nom: "Chauffagiste", href: "/logiciel-devis-chauffagiste" },
  { nom: "Peintre", href: "/logiciel-devis-peintre" },
  { nom: "Carreleur", href: "/logiciel-devis-carreleur" },
  { nom: "Paysagiste", href: "/logiciel-devis-paysagiste" },
  { nom: "Menuisier", href: "/logiciel-devis-menuisier" },
];

export default function LocalMaillage({
  ville,
  ancresMaillage,
}: {
  ville: string;
  ancresMaillage?: { href: string; label: string }[];
}) {
  const villesAutres = otherCities.filter(
    (v) => v.nom.toLowerCase() !== ville.toLowerCase()
  );

  const hasCustomAncres = ancresMaillage && ancresMaillage.length > 0;

  return (
    <section id="ressources" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#0f1a3a]/5 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f1a3a]">
          Voir aussi
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Ressources et villes complémentaires
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Continuez votre lecture avec les pages les plus utiles pour les artisans du BTP.
      </p>

      {/* Liens éditoriaux (ancresMaillage) — cards avec flèche orange */}
      {hasCustomAncres && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ancresMaillage!.map((anchor) => (
            <Link
              key={anchor.href}
              href={anchor.href}
              className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 hover:shadow-md"
            >
              <span className="font-hanken text-base font-semibold text-[#0f1a3a] group-hover:text-[#ff7a1a]">
                {anchor.label}
              </span>
              <span
                aria-hidden="true"
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a]/10 text-[#ff7a1a] transition-transform group-hover:translate-x-1"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5-5 5M6 12h12"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Autres villes */}
      {villesAutres.length > 0 && (
        <div className="mt-10 border-t border-gray-100 pt-8">
          <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
            Autres villes couvertes
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {villesAutres.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 font-hanken text-sm font-medium text-[#0f1a3a]/80 transition-all hover:border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/5 hover:text-[#ff7a1a]"
              >
                {v.nom}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Métiers du BTP */}
      <div className="mt-8">
        <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Par métier du bâtiment
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {popularMetiers.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 font-hanken text-sm font-medium text-[#0f1a3a]/80 transition-all hover:border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/5 hover:text-[#ff7a1a]"
            >
              {m.nom}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
