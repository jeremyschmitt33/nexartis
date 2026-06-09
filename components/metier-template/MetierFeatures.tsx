"use client";

interface MetierFeaturesProps {
  nomPluriel: string;
  certifications?: string[];
}

const features = [
  {
    icon: "📄",
    title: "Devis en quelques minutes",
    text:
      "Créez vos devis professionnels en quelques clics. Vos clients signent électroniquement depuis leur téléphone.",
  },
  {
    icon: "💶",
    title: "TVA automatique",
    text:
      "Les bons taux de TVA sont appliqués automatiquement selon le type de travaux. Plus de calculs à la main.",
  },
  {
    icon: "⚡",
    title: "Prêt pour Factur-X 2026",
    text:
      "La facture électronique devient obligatoire pour le BTP. Nexartis est prêt pour la facturation électronique 2026.",
  },
  {
    icon: "📅",
    title: "Planning intelligent",
    text:
      "Organisez vos chantiers sur un calendrier visuel. Les conflits d'affectation sont détectés automatiquement.",
  },
  {
    icon: "🔔",
    title: "Suivi des impayés simplifié",
    text:
      "Repérez d'un coup d'œil les factures en retard et relancez vos clients en quelques clics.",
  },
  {
    icon: "📱",
    title: "Mobile & terrain",
    text:
      "Créez un devis depuis votre chantier, sur votre téléphone. Envoyez-le en quelques instants.",
  },
];

export default function MetierFeatures({ nomPluriel, certifications }: MetierFeaturesProps) {
  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0f1a3a]/5 px-4 py-1.5">
            <span className="font-spline-mono text-xs font-bold uppercase tracking-wider text-[#0f1a3a]">
              Fonctionnalités clés
            </span>
          </div>
          <h2 className="font-hanken text-3xl font-extrabold tracking-tight text-[#0f1a3a] md:text-4xl">
            Tout ce dont les {nomPluriel.toLowerCase()} ont besoin
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group flex flex-col rounded-2xl border border-[#0f1a3a]/8 bg-[#f6f8fb] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff7a1a]/30 hover:bg-white hover:shadow-xl hover:shadow-[#0f1a3a]/5"
            >
              <span className="text-4xl leading-none">{f.icon}</span>
              <h3 className="mt-5 font-hanken text-lg font-bold text-[#0f1a3a]">{f.title}</h3>
              <p className="mt-3 flex-1 font-hanken text-sm leading-relaxed text-[#0f1a3a]/65">
                {f.text}
              </p>
            </div>
          ))}
        </div>

        {certifications && certifications.length > 0 && (
          <div className="mt-12 rounded-2xl border border-[#0f1a3a]/10 bg-[#f6f8fb] p-6 sm:p-8">
            <p className="font-hanken text-xs font-semibold uppercase tracking-wider text-[#0f1a3a]/55">
              Compatible avec vos certifications
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {certifications.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full border border-[#0f1a3a]/10 bg-white px-4 py-1.5 font-hanken text-sm font-medium text-[#0f1a3a]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
