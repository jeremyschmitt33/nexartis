"use client";

interface DevisLine {
  label: string;
  unitPrice: number;
  qty: number;
  unit: string;
  tvaRate: number;
  totalHT: number;
}

interface MetierDevisExampleProps {
  nom: string;
  devisLines: DevisLine[];
  totalHT: number;
  tva55Lines?: DevisLine[];
  tva10Lines: DevisLine[];
  tva20Lines: DevisLine[];
  tva55Amount?: number;
  tva10Amount: number;
  tva20Amount: number;
  totalTTC: number;
  formatPrice: (n: number) => string;
}

export default function MetierDevisExample({
  nom,
  devisLines,
  totalHT,
  tva55Lines = [],
  tva10Lines,
  tva20Lines,
  tva55Amount = 0,
  tva10Amount,
  tva20Amount,
  totalTTC,
  formatPrice,
}: MetierDevisExampleProps) {
  return (
    <section id="devis-exemple" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#0f1a3a]/5 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f1a3a]">
          Exemple concret
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold tracking-tight text-[#0f1a3a] md:text-3xl">
        Un devis {nom.toLowerCase()} créé en 3 minutes
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Aperçu d&apos;un devis professionnel généré par Nexartis, avec les bons
        taux de TVA et les mentions légales obligatoires.
      </p>

      <div className="mt-8">
        <div className="overflow-hidden rounded-2xl border border-[#0f1a3a]/10 bg-white shadow-2xl shadow-[#0f1a3a]/5">
          <div className="border-b border-[#0f1a3a]/10 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f1a3a] font-hanken text-lg font-bold text-white">
                  A
                </div>
                <p className="font-hanken text-base font-bold text-[#0f1a3a]">
                  SARL Artisan Pro
                </p>
                <p className="mt-1 font-hanken text-sm text-[#0f1a3a]/60">12 rue des Artisans</p>
                <p className="font-hanken text-sm text-[#0f1a3a]/60">33000 Bordeaux</p>
                <p className="mt-1 font-spline-mono text-xs text-[#0f1a3a]/40">
                  SIRET : 123 456 789 00012
                </p>
                <p className="font-spline-mono text-xs text-[#0f1a3a]/40">Tél : 06 12 34 56 78</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-hanken text-lg font-bold text-[#0f1a3a]">
                  DEVIS N° <span className="font-spline-mono">2026-0042</span>
                </p>
                <p className="mt-1 font-spline-mono text-sm text-[#0f1a3a]/60">Date : 07/04/2026</p>
                <p className="font-spline-mono text-sm text-[#0f1a3a]/60">
                  Valable jusqu&apos;au : 07/05/2026
                </p>
                <span className="mt-2 inline-block rounded-full bg-[#ff7a1a]/10 px-3 py-1 font-hanken text-xs font-semibold text-[#ff7a1a]">
                  En attente de signature
                </span>
              </div>
            </div>
          </div>

          <div className="border-b border-[#0f1a3a]/10 bg-[#f6f8fb] px-6 py-4 sm:px-8">
            <p className="font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/40">
              Client
            </p>
            <p className="mt-1 font-hanken text-sm font-semibold text-[#0f1a3a]">M. Jean Dupont</p>
            <p className="font-hanken text-sm text-[#0f1a3a]/60">45 allée des Pins</p>
            <p className="font-hanken text-sm text-[#0f1a3a]/60">33700 Mérignac</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#0f1a3a]/10 bg-[#0f1a3a]/5">
                  <th className="px-6 py-3 font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60 sm:px-8">
                    Désignation
                  </th>
                  <th className="px-3 py-3 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60">
                    Qté
                  </th>
                  <th className="px-3 py-3 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60">
                    Unité
                  </th>
                  <th className="px-3 py-3 text-right font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60">
                    P.U. HT
                  </th>
                  <th className="px-3 py-3 text-center font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60">
                    TVA
                  </th>
                  <th className="px-6 py-3 text-right font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/60 sm:px-8">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {devisLines.map((line, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#0f1a3a]/5 ${i % 2 === 1 ? "bg-[#f6f8fb]/40" : ""}`}
                  >
                    <td className="px-6 py-3 font-hanken text-sm text-[#0f1a3a]/80 sm:px-8">
                      {line.label}
                    </td>
                    <td className="px-3 py-3 text-center font-spline-mono text-sm text-[#0f1a3a]/70">
                      {line.qty}
                    </td>
                    <td className="px-3 py-3 text-center font-hanken text-sm text-[#0f1a3a]/70">
                      {line.unit}
                    </td>
                    <td className="px-3 py-3 text-right font-spline-mono text-sm text-[#0f1a3a]/70">
                      {formatPrice(line.unitPrice)} €
                    </td>
                    <td className="px-3 py-3 text-center font-spline-mono text-sm text-[#0f1a3a]/70">
                      {line.tvaRate}%
                    </td>
                    <td className="px-6 py-3 text-right font-spline-mono text-sm font-semibold text-[#0f1a3a] sm:px-8">
                      {formatPrice(line.totalHT)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#0f1a3a]/10 px-6 py-5 sm:px-8">
            <div className="ml-auto max-w-xs space-y-2">
              <div className="flex justify-between font-hanken text-sm text-[#0f1a3a]/70">
                <span>Total HT</span>
                <span className="font-spline-mono">{formatPrice(totalHT)} €</span>
              </div>
              {tva55Lines.length > 0 && (
                <div className="flex justify-between font-hanken text-sm text-[#0f1a3a]/70">
                  <span>TVA <span className="font-spline-mono">5,5%</span></span>
                  <span className="font-spline-mono">{formatPrice(tva55Amount)} €</span>
                </div>
              )}
              {tva10Lines.length > 0 && (
                <div className="flex justify-between font-hanken text-sm text-[#0f1a3a]/70">
                  <span>TVA <span className="font-spline-mono">10%</span></span>
                  <span className="font-spline-mono">{formatPrice(tva10Amount)} €</span>
                </div>
              )}
              {tva20Lines.length > 0 && (
                <div className="flex justify-between font-hanken text-sm text-[#0f1a3a]/70">
                  <span>TVA <span className="font-spline-mono">20%</span></span>
                  <span className="font-spline-mono">{formatPrice(tva20Amount)} €</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#0f1a3a]/10 pt-2 font-hanken text-lg font-extrabold text-[#0f1a3a]">
                <span>Total TTC</span>
                <span className="font-spline-mono text-[#ff7a1a]">{formatPrice(totalTTC)} €</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#0f1a3a]/10 bg-[#f6f8fb] px-6 py-5 sm:px-8">
            <div className="space-y-1">
              <p className="font-hanken text-xs text-[#0f1a3a]/50">
                Conditions de paiement : 30% à la commande, solde à la réception des travaux
              </p>
              <p className="font-hanken text-xs text-[#0f1a3a]/50">
                Délai d&apos;intervention : 5 à 10 jours ouvrés
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="flex-1 rounded-lg border border-dashed border-[#0f1a3a]/20 p-4 text-center">
                <p className="font-hanken text-xs font-semibold text-[#0f1a3a]/40">
                  Signature électronique
                </p>
                <p className="mt-2 font-hanken text-xs italic text-[#0f1a3a]/30">En attente...</p>
              </div>
              <div className="flex-1 rounded-lg border border-dashed border-[#0f1a3a]/20 p-4 text-center">
                <p className="font-hanken text-xs font-semibold text-[#0f1a3a]/40">
                  Bon pour accord
                </p>
                <p className="mt-2 font-hanken text-xs italic text-[#0f1a3a]/30">En attente...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
