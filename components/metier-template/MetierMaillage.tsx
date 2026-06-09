"use client";

import Link from "next/link";

/**
 * MetierMaillage — Grille de cartes liens internes pour le maillage SEO.
 *
 * Utilise ancresMaillage si fourni, sinon affiche les autres métiers (filtrés
 * pour exclure le métier courant) en fallback.
 */
const allMetiers = [
  { nom: "Plombier", href: "/logiciel-devis-plombier" },
  { nom: "Électricien", href: "/logiciel-devis-electricien" },
  { nom: "Maçon", href: "/logiciel-devis-maconnerie" },
  { nom: "Menuisier", href: "/logiciel-devis-menuisier" },
  { nom: "Peintre", href: "/logiciel-devis-peintre" },
  { nom: "Paysagiste", href: "/logiciel-devis-paysagiste" },
  { nom: "Carreleur", href: "/logiciel-devis-carreleur" },
  { nom: "Couvreur", href: "/logiciel-devis-couvreur" },
  { nom: "Chauffagiste", href: "/logiciel-devis-chauffagiste" },
  { nom: "Auto-entrepreneur", href: "/logiciel-artisan-auto-entrepreneur" },
];

export default function MetierMaillage({
  nom,
  ancresMaillage,
}: {
  nom: string;
  ancresMaillage?: { href: string; label: string }[];
}) {
  const autresMetiers = allMetiers.filter(
    (m) => m.nom.toLowerCase() !== nom.toLowerCase()
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
        Ressources et métiers complémentaires
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Continuez votre lecture avec les pages les plus utiles pour les artisans BTP.
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

      {/* Autres métiers du BTP — chips */}
      <div className="mt-10 border-t border-gray-100 pt-8">
        <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Autres métiers du bâtiment
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {autresMetiers.map((metier) => (
            <Link
              key={metier.href}
              href={metier.href}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 font-hanken text-sm font-medium text-[#0f1a3a]/80 transition-all hover:border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/5 hover:text-[#ff7a1a]"
            >
              {metier.nom}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
