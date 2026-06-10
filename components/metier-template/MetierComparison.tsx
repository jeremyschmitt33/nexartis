"use client";

interface MetierComparisonProps {
  nom: string;
}

const rows = [
  { label: "Spécialisé artisans BTP", nexartis: "Inclus", concurrent1: "Partiel", concurrent2: "—" },
  { label: "TVA 5,5% / 10% / 20% auto", nexartis: "Inclus", concurrent1: "Inclus", concurrent2: "—" },
  { label: "Mentions Factur-X 2026", nexartis: "Inclus", concurrent1: "—", concurrent2: "Partiel" },
  { label: "Signature électronique client", nexartis: "Inclus", concurrent1: "Inclus", concurrent2: "Inclus" },
  { label: "Planning d&apos;équipe & chantiers", nexartis: "Inclus", concurrent1: "—", concurrent2: "Inclus" },
  { label: "Dictée vocale IA terrain", nexartis: "Inclus", concurrent1: "—", concurrent2: "—" },
  { label: "Tarif transparent (15€/25€)", nexartis: "Inclus", concurrent1: "Sur devis", concurrent2: "Variable" },
  { label: "Sans engagement", nexartis: "Inclus", concurrent1: "—", concurrent2: "Partiel" },
];

export default function MetierComparison({ nom }: MetierComparisonProps) {
  return (
    <section className="bg-[#f6f8fb] py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 ring-1 ring-[#0f1a3a]/10">
            <span className="font-spline-mono text-xs font-bold uppercase tracking-wider text-[#0f1a3a]">
              Comparatif factuel
            </span>
          </div>
          <h2 className="font-hanken text-3xl font-extrabold tracking-tight text-[#0f1a3a] md:text-4xl">
            Ce qu&apos;un {nom.toLowerCase()} obtient avec Nexartis
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-hanken text-base text-[#0f1a3a]/60">
            Comparatif factuel des fonctionnalités proposées (sans jugement sur la qualité).
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-[#0f1a3a]/10 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#0f1a3a]/10 bg-[#0f1a3a]/5">
                  <th className="px-5 py-4 font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60 sm:px-8">
                    Fonctionnalité
                  </th>
                  <th className="px-3 py-4 text-center font-hanken text-xs font-bold uppercase tracking-wider text-[#ff7a1a]">
                    Nexartis
                  </th>
                  <th className="px-3 py-4 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/55">
                    Concurrent A
                  </th>
                  <th className="px-3 py-4 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/55 sm:pr-8">
                    Concurrent B
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#0f1a3a]/5 ${i % 2 === 1 ? "bg-[#f6f8fb]/40" : ""}`}
                  >
                    <td
                      className="px-5 py-4 font-hanken text-sm text-[#0f1a3a]/85 sm:px-8"
                      dangerouslySetInnerHTML={{ __html: row.label }}
                    />
                    <td className="px-3 py-4 text-center">
                      {row.nexartis === "Inclus" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ff7a1a]/10 px-2.5 py-1 font-hanken text-xs font-semibold text-[#ff7a1a]">
                          Inclus
                        </span>
                      ) : (
                        <span className="font-hanken text-sm text-[#0f1a3a]/40">{row.nexartis}</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center font-hanken text-sm text-[#0f1a3a]/60">
                      {row.concurrent1}
                    </td>
                    <td className="px-3 py-4 text-center font-hanken text-sm text-[#0f1a3a]/60 sm:pr-8">
                      {row.concurrent2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center font-hanken text-xs text-[#0f1a3a]/45">
          Comparatif fonctionnel basé sur les offres publiques au 1er juin 2026. Ne reflète pas la qualité d&apos;usage ni le service client.
        </p>
      </div>
    </section>
  );
}
