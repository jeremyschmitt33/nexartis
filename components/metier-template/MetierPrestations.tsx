"use client";

/**
 * MetierPrestations — Grille de cartes V4 affichant les prestations typiques
 * du métier (issues de prestationsExemples). Style rounded-2xl + shadow-sm
 * + hover shadow-md, icône métier en haut.
 */
export default function MetierPrestations({
  nomPluriel,
  icon,
  prestationsExemples,
}: {
  nomPluriel: string;
  icon: string;
  prestationsExemples: string[];
}) {
  if (!prestationsExemples || prestationsExemples.length === 0) return null;

  // On limite à 8 cartes pour rester lisible
  const items = prestationsExemples.slice(0, 8);

  return (
    <section className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#0f1a3a]/5 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f1a3a]">
          Prestations couvertes
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        Prestations typiques pour {nomPluriel.toLowerCase()}
      </h2>
      <p className="mt-3 font-hanken text-base text-[#0f1a3a]/60">
        Toutes ces prestations sont préconfigurées dans Nexartis avec leur taux
        de TVA, prêtes à insérer dans un devis en un clic.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((label) => (
          <div
            key={label}
            className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-xl"
            >
              {icon}
            </span>
            <p className="font-hanken text-sm font-semibold leading-snug text-[#0f1a3a]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
