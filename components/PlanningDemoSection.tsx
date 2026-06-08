"use client";

import { useEffect, useRef, useState } from "react";

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] as const;

interface PlanningEntry {
  poseur: string;
  client: string;
  objet: string;
  color: string;
}

type SlotData = PlanningEntry | null;

const planningData: { am: SlotData[]; pm: SlotData[] } = {
  am: [
    { poseur: "Michel R.", client: "M. Dupont", objet: "Instal. chauffe-eau", color: "#5ab4e0" },
    { poseur: "Thomas B.", client: "Mme Martin", objet: "Rénov. salle de bain", color: "#e87a2a" },
    { poseur: "Michel R.", client: "M. Bernard", objet: "Pose carrelage", color: "#22c55e" },
    { poseur: "Lucas D.", client: "M. Petit", objet: "Extension terrasse", color: "#f5c842" },
    { poseur: "Thomas B.", client: "Mme Girard", objet: "Électricité cuisine", color: "#f43f5e" },
  ],
  pm: [
    { poseur: "Michel R.", client: "M. Dupont", objet: "Instal. chauffe-eau", color: "#5ab4e0" },
    { poseur: "Thomas B.", client: "Mme Martin", objet: "Rénov. salle de bain", color: "#e87a2a" },
    { poseur: "Lucas D.", client: "Mme Moreau", objet: "Peinture façade", color: "#8b5cf6" },
    { poseur: "Lucas D.", client: "M. Petit", objet: "Extension terrasse", color: "#f5c842" },
    null,
  ],
};

const conflictCard: PlanningEntry = {
  poseur: "Michel R.",
  client: "M. Bernard",
  objet: "Pose carrelage",
  color: "#22c55e",
};

const advantages = [
  {
    title: "Glissez-déposez vos interventions",
    subtitle: "Aussi simple qu\u2019un agenda",
  },
  {
    title: "Alerte immédiate si un artisan est déjà occupé",
    subtitle: "Plus aucun conflit de planning",
  },
  {
    title: "Vos équipiers reçoivent leur planning sur leur téléphone",
    subtitle: "Toujours à jour, sans appeler",
  },
  {
    title: "Un chantier décalé → la facture se met à jour automatiquement",
    subtitle: "Tout reste synchronisé",
  },
];

function ChantierCard({
  poseur,
  client,
  objet,
  color,
  conflict,
  pulsing,
}: {
  poseur: string;
  client: string;
  objet: string;
  color: string;
  conflict?: boolean;
  pulsing?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] p-2.5 text-left min-h-[56px] text-[11px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] ${pulsing ? "animate-pulse" : ""} ${conflict ? "ring-2 ring-red-500" : ""}`}
      style={{ backgroundColor: color }}
    >
      <p className="text-white/70 text-[10px]">👤 {poseur}</p>
      <p className="text-sm font-bold text-white">{client}</p>
      <p className="text-[11px] italic text-white/80">{objet}</p>
    </div>
  );
}

export default function PlanningDemoSection() {
  const [showConflict, setShowConflict] = useState(false);
  const [conflictPulsing, setConflictPulsing] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasAutoTriggered = useRef(false);

  const handleSimulateConflict = () => {
    setShowConflict(true);
    setConflictPulsing(true);
    setTimeout(() => setConflictPulsing(false), 1500);
  };

  const handleReset = () => {
    setShowConflict(false);
    setConflictPulsing(false);
  };

  // V4 — Auto-demo declenchee quand la section entre dans le viewport
  // (40% visible). On declenche une seule fois, l'utilisateur peut reset apres.
  useEffect(() => {
    if (!sectionRef.current) return;
    const node = sectionRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAutoTriggered.current) {
            hasAutoTriggered.current = true;
            // Petit delai pour laisser l'animation reveal entrer en scene
            window.setTimeout(() => {
              handleSimulateConflict();
            }, 600);
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const isMichelCard = (entry: PlanningEntry | null) =>
    entry?.poseur === "Michel R.";

  return (
    <section
      id="planning"
      ref={sectionRef}
      className="landing-section relative overflow-hidden bg-transparent"
    >
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-10 py-[100px]">
        {/* Section header */}
        <div className="text-center mb-[60px] reveal">
          <span
            className="landing-eyebrow landing-eyebrow--accent mb-5"
          >
            <span
              className="dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "currentColor",
                boxShadow: "0 0 10px currentColor",
              }}
            />
            ★ Fonctionnalite exclusive Nexartis
          </span>
          <h2 className="landing-text-grad text-[28px] sm:text-[40px] font-[800] tracking-[-0.03em] mt-5 mb-3.5">
            Le planning qui pense a votre place
          </h2>
          <p className="text-[17px] text-ink-2 font-medium max-w-[560px] mx-auto">
            Chez tous les concurrents, le planning est une simple liste. Chez Nexartis, c&apos;est un vrai outil de travail.
          </p>
        </div>

        {/* Interactive Planning Demo */}
        <div className="mx-auto max-w-5xl">
          <div className="bg-[rgba(13,21,37,0.7)] border border-white/[0.08] rounded-[var(--radius)] overflow-hidden backdrop-blur-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            {/* Demo header bar */}
            <div className="h-11 bg-black/20 flex items-center px-[18px] gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs font-bold uppercase tracking-widest text-white/35">
                Planning — Semaine 15
              </span>
            </div>

            {/* Conflict alert banner */}
            {showConflict && (
              <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/20 to-orange-500/20 px-5 py-3">
                <p className="text-center text-sm font-semibold text-white">
                  ⚠️ Conflit détecté — Michel R. est déjà affecté chez M. Bernard (Pose carrelage) le mercredi après-midi.
                </p>
              </div>
            )}

            {/* Planning grid */}
            <div className="overflow-x-auto p-4 md:p-6">
              <div className="min-w-[640px]">
                {/* Day headers */}
                <div className="mb-2 grid grid-cols-[80px_repeat(5,1fr)] gap-[1px]">
                  <div />
                  {days.map((day, i) => (
                    <div
                      key={day}
                      className={`text-center text-[12px] font-bold uppercase tracking-[0.06em] py-2 px-1 ${
                        i === 2 ? "text-white bg-[rgba(90,180,224,0.15)] rounded-lg" : "text-white/50"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* AM row */}
                <div className="mb-2 grid grid-cols-[80px_repeat(5,1fr)] gap-[1px]">
                  <div className="flex items-center text-[11px] font-semibold uppercase tracking-widest text-white/35 px-2">
                    Matin
                  </div>
                  {planningData.am.map((entry, dayIdx) => (
                    <div key={dayIdx} className="flex min-h-[72px] flex-col gap-1 rounded-lg bg-white/[0.03] p-1.5">
                      {entry && (
                        <ChantierCard
                          poseur={entry.poseur}
                          client={entry.client}
                          objet={entry.objet}
                          color={entry.color}
                          conflict={showConflict && isMichelCard(entry) && dayIdx === 2}
                          pulsing={conflictPulsing && isMichelCard(entry) && dayIdx === 2}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* PM row */}
                <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-[1px]">
                  <div className="flex items-center text-[11px] font-semibold uppercase tracking-widest text-white/35 px-2">
                    Après-midi
                  </div>
                  {planningData.pm.map((entry, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`flex min-h-[72px] flex-col gap-1 rounded-lg p-1.5 ${
                        entry === null && !showConflict
                          ? "border border-dashed border-white/15 bg-white/[0.01]"
                          : "bg-white/[0.03]"
                      }`}
                    >
                      {entry && (
                        <ChantierCard
                          poseur={entry.poseur}
                          client={entry.client}
                          objet={entry.objet}
                          color={entry.color}
                        />
                      )}
                      {showConflict && dayIdx === 2 && (
                        <ChantierCard
                          poseur={conflictCard.poseur}
                          client={conflictCard.client}
                          objet={conflictCard.objet}
                          color={conflictCard.color}
                          conflict
                          pulsing={conflictPulsing}
                        />
                      )}
                      {entry === null && !showConflict && (
                        <p className="m-auto text-[10px] text-white/30">Libre</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-5 py-4">
              {!showConflict ? (
                <button
                  onClick={handleSimulateConflict}
                  className="btn-hero-primary text-sm px-6 py-2.5"
                >
                  Simuler un conflit
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="btn-hero-secondary text-sm px-6 py-2.5"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4 Advantages Grid */}
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {advantages.map((adv, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 rounded-[var(--radius-sm)] border border-white/[0.06] bg-white/[0.03] p-[22px] transition-all hover:bg-white/[0.05]"
            >
              <div className="mt-0.5 w-9 h-9 rounded-[10px] bg-[rgba(90,180,224,0.1)] flex items-center justify-center flex-shrink-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--sky)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h4 className="text-[14px] font-bold leading-snug text-white mb-1">
                  {adv.title}
                </h4>
                <p className="text-[12px] text-white/45 font-medium">
                  {adv.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
