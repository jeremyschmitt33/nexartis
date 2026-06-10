"use client";

import RichText from "./RichText";

interface MetierTvaSectionProps {
  nom: string;
  tvaNotes: string;
  paragrapheTva?: string;
  tableauTva?: { type: string; taux: string; conditions: string }[];
  reglementation2026?: string[];
}

export default function MetierTvaSection({
  nom,
  tvaNotes,
  paragrapheTva,
  tableauTva,
  reglementation2026,
}: MetierTvaSectionProps) {
  return (
    <section id="tva" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
          TVA BTP
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        TVA {nom.toLowerCase()} : les bons taux appliqués automatiquement
      </h2>
      <p className="mt-6 font-hanken text-base leading-relaxed text-[#0f1a3a]/80">
        <RichText text={tvaNotes} />
      </p>

      {paragrapheTva && (
        <div className="mt-4">
          {paragrapheTva.split("\n\n").filter((p) => p.trim().length > 0).map((para, i) => (
            <p
              key={i}
              className="mb-4 font-hanken text-base leading-relaxed text-[#0f1a3a]/75 last:mb-0"
            >
              <RichText text={para} />
            </p>
          ))}
        </div>
      )}

      {/* ── Graphe SVG : répartition des 3 taux ── */}
      <figure className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#f6f8fb] to-white p-6 md:p-8">
        <figcaption className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Répartition typique des taux en {nom.toLowerCase()}
        </figcaption>

        {/* Barre 3 segments — proportions indicatives : 25/55/20 */}
        <div className="mt-5">
          <svg
            viewBox="0 0 600 60"
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-full"
            role="img"
            aria-label="Répartition des taux de TVA"
          >
            <defs>
              <linearGradient id="tvaG1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2fd6a0" />
                <stop offset="1" stopColor="#1eb88a" />
              </linearGradient>
              <linearGradient id="tvaG2" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ff9d4d" />
                <stop offset="1" stopColor="#ff7a1a" />
              </linearGradient>
              <linearGradient id="tvaG3" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#3f7bff" />
                <stop offset="1" stopColor="#2d5cd4" />
              </linearGradient>
            </defs>
            <rect x="0" y="15" width="150" height="30" rx="6" fill="url(#tvaG1)" />
            <rect x="155" y="15" width="330" height="30" rx="6" fill="url(#tvaG2)" />
            <rect x="490" y="15" width="110" height="30" rx="6" fill="url(#tvaG3)" />
            <text x="75" y="35" textAnchor="middle" fill="#fff" fontFamily="'Spline Sans Mono', monospace" fontSize="14" fontWeight="700">
              5,5%
            </text>
            <text x="320" y="35" textAnchor="middle" fill="#fff" fontFamily="'Spline Sans Mono', monospace" fontSize="14" fontWeight="700">
              10%
            </text>
            <text x="545" y="35" textAnchor="middle" fill="#fff" fontFamily="'Spline Sans Mono', monospace" fontSize="14" fontWeight="700">
              20%
            </text>
          </svg>
        </div>

        {/* Légende 3 cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-baseline gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#2fd6a0]" aria-hidden="true" />
              <p className="font-spline-mono text-2xl font-bold text-[#0f1a3a]">5,5%</p>
            </div>
            <p className="mt-2 font-hanken text-sm font-semibold text-[#0f1a3a]">
              Rénovation énergétique
            </p>
            <p className="mt-1 font-hanken text-xs text-gray-500">
              Pompe à chaleur, isolation, chauffage haute performance
            </p>
          </div>
          <div className="rounded-xl border border-[#ff7a1a]/30 bg-[#ff7a1a]/5 p-4">
            <div className="flex items-baseline gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#ff7a1a]" aria-hidden="true" />
              <p className="font-spline-mono text-2xl font-bold text-[#0f1a3a]">10%</p>
            </div>
            <p className="mt-2 font-hanken text-sm font-semibold text-[#0f1a3a]">
              Amélioration habitat
            </p>
            <p className="mt-1 font-hanken text-xs text-gray-500">
              Logement &gt; 2 ans, entretien, transformation
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-baseline gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#3f7bff]" aria-hidden="true" />
              <p className="font-spline-mono text-2xl font-bold text-[#0f1a3a]">20%</p>
            </div>
            <p className="mt-2 font-hanken text-sm font-semibold text-[#0f1a3a]">
              Travaux neufs
            </p>
            <p className="mt-1 font-hanken text-xs text-gray-500">
              Constructions, locaux pros, piscines
            </p>
          </div>
        </div>
      </figure>

      {/* Tableau TVA structuré (optionnel) */}
      {tableauTva && tableauTva.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f6f8fb]">
                  <th className="px-5 py-3 font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60 sm:px-6">
                    Type de travaux
                  </th>
                  <th className="px-5 py-3 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60">
                    Taux TVA
                  </th>
                  <th className="px-5 py-3 font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60 sm:px-6">
                    Conditions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableauTva.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 last:border-b-0 ${
                      i % 2 === 1 ? "bg-[#f6f8fb]/30" : ""
                    }`}
                  >
                    <td className="px-5 py-3 font-hanken text-sm text-[#0f1a3a]/85 sm:px-6">
                      <RichText text={row.type} />
                    </td>
                    <td className="px-5 py-3 text-center font-spline-mono text-sm font-semibold text-[#ff7a1a]">
                      {row.taux}
                    </td>
                    <td className="px-5 py-3 font-hanken text-sm text-[#0f1a3a]/65 sm:px-6">
                      <RichText text={row.conditions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Réglementation 2026 (optionnel) */}
      {reglementation2026 && reglementation2026.length > 0 && (
        <div className="mt-8 rounded-2xl border border-[#3f7bff]/20 bg-[#3f7bff]/5 p-6 md:p-8">
          <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#2d5cd4]">
            Réglementation 2026 — à savoir
          </p>
          <ul className="mt-4 space-y-3">
            {reglementation2026.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-3 font-hanken text-sm leading-relaxed text-[#0f1a3a]/80"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f7bff]"
                />
                <span><RichText text={point} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-[#ff7a1a]/20 bg-[#fef6ef] p-6 md:p-8">
        <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#c54e00]">
          Comment Nexartis vous aide
        </p>
        <p className="mt-3 font-hanken text-base leading-relaxed text-[#0f1a3a]/80">
          Quand vous créez un devis, Nexartis pré-remplit le bon taux de TVA
          pour chaque ligne de prestation. Vous pouvez toujours le modifier si
          besoin, mais dans 90% des cas, le taux proposé est le bon. La
          mention TVA simplifiée (remplaçant l&apos;attestation 1300-SD
          supprimée le 16 février 2025) est ajoutée automatiquement.
        </p>
      </div>
    </section>
  );
}
