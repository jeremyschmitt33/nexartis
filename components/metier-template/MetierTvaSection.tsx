"use client";

import RichText from "./RichText";
import MetierTvaChart from "./MetierTvaChart";

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

      {/* Graphe TVA spécifique au métier (composant isolé, accessible) */}
      <MetierTvaChart nom={nom} />

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
