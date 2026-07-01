"use client";

import { useId } from "react";

/**
 * MetierTvaChart — Répartition indicative des taux de TVA, SPÉCIFIQUE au métier.
 *
 * Remplace l'ancienne barre 25/55/20 codée en dur et identique sur les 12 pages.
 * Objectifs (issus du brainstorm V2 du 01/07/2026) :
 *  - Différenciation par métier (données centralisées ci-dessous, faciles à auditer).
 *  - Honnêteté : proportions présentées comme INDICATIVES ; un taux non applicable
 *    (ex : 5,5 % en serrurerie/paysagisme) n'est PAS affiché du tout.
 *  - Accessibilité : plus aucun texte blanc illisible dans la barre
 *    (blanc/mint = 1,61:1, blanc/orange = 2,20:1 → échec WCAG). Les chiffres
 *    vivent dans les cartes légende (texte navy sur fond clair, contraste AAA),
 *    et la barre porte un <title>/<desc> généré depuis les données.
 *
 * Les proportions sont des POIDS RELATIFS RAISONNÉS (pas des statistiques mesurées),
 * cohérents avec les règles TVA en vigueur (dont chaudières gaz/fioul = 20 % depuis
 * le 1er mars 2025). La vérité vit dans la data ci-dessous, séparée du rendu.
 */

type Taux = "5,5" | "10" | "20";

interface RatePart {
  taux: Taux;
  poids: number;
}

interface MixEntry {
  rates: RatePart[];
  contexte: string;
}

const RATE_META: Record<Taux, { color: string; libelle: string; exemples: string }> = {
  "5,5": {
    color: "#2fd6a0",
    libelle: "Rénovation énergétique",
    exemples: "Équipements éligibles RGE, logement de plus de 2 ans",
  },
  "10": {
    color: "#ff7a1a",
    libelle: "Amélioration de l'habitat",
    exemples: "Rénovation et entretien d'un logement de plus de 2 ans",
  },
  "20": {
    color: "#3f7bff",
    libelle: "Travaux neufs & fourniture",
    exemples: "Construction, extension, locaux pros, fourniture seule",
  },
};

/** Données illustratives par métier — auditées ici, jamais inventées ailleurs. */
const TVA_MIX: Record<string, MixEntry> = {
  electricien: {
    rates: [{ taux: "5,5", poids: 8 }, { taux: "10", poids: 62 }, { taux: "20", poids: 30 }],
    contexte:
      "En électricité, la majorité des chantiers de rénovation relèvent du taux à 10 %. Le 20 % concerne le neuf et les locaux professionnels, et le 5,5 % les installations liées à la rénovation énergétique (photovoltaïque en autoconsommation, raccordement de pompe à chaleur).",
  },
  plombier: {
    rates: [{ taux: "5,5", poids: 12 }, { taux: "10", poids: 58 }, { taux: "20", poids: 30 }],
    contexte:
      "En plomberie, le taux à 10 % domine (rénovation de salle de bains, remplacement de sanitaires en logement de plus de 2 ans). Le 5,5 % concerne les équipements de rénovation énergétique éligibles, et le 20 % le neuf et la fourniture seule.",
  },
  macon: {
    rates: [{ taux: "10", poids: 52 }, { taux: "20", poids: 48 }],
    contexte:
      "En maçonnerie, le partage se joue surtout entre 10 % (rénovation d'un logement de plus de 2 ans) et 20 % (gros œuvre neuf, extension). Le taux réduit de 5,5 % ne s'applique qu'exceptionnellement et n'est pas représenté ici.",
  },
  peintre: {
    rates: [{ taux: "10", poids: 80 }, { taux: "20", poids: 20 }],
    contexte:
      "En peinture, le taux à 10 % couvre l'essentiel de l'activité (rafraîchissement et décoration de logements de plus de 2 ans). Le 20 % concerne le neuf et les locaux professionnels.",
  },
  menuisier: {
    rates: [{ taux: "5,5", poids: 22 }, { taux: "10", poids: 48 }, { taux: "20", poids: 30 }],
    contexte:
      "En menuiserie, le 5,5 % est fréquent grâce au remplacement de fenêtres à haute performance énergétique. Le 10 % couvre les aménagements en logement ancien, et le 20 % le neuf et la fourniture seule.",
  },
  carreleur: {
    rates: [{ taux: "10", poids: 75 }, { taux: "20", poids: 25 }],
    contexte:
      "En carrelage, le taux à 10 % domine (pose en rénovation d'un logement de plus de 2 ans). Le 20 % s'applique au neuf et à la fourniture vendue seule.",
  },
  chauffagiste: {
    rates: [{ taux: "5,5", poids: 35 }, { taux: "10", poids: 35 }, { taux: "20", poids: 30 }],
    contexte:
      "Le chauffage est l'un des rares métiers où les trois taux pèsent vraiment : 5,5 % sur les équipements renouvelables éligibles (pompe à chaleur, granulés bois), 10 % sur l'entretien, et 20 % sur le neuf comme sur les chaudières gaz et fioul depuis le 1er mars 2025.",
  },
  couvreur: {
    rates: [{ taux: "5,5", poids: 18 }, { taux: "10", poids: 52 }, { taux: "20", poids: 30 }],
    contexte:
      "En couverture, le 10 % domine (réfection de toiture sur logement ancien). Le 5,5 % s'applique quand la toiture porte une isolation éligible, et le 20 % au neuf et à la charpente en construction.",
  },
  plaquiste: {
    rates: [{ taux: "5,5", poids: 20 }, { taux: "10", poids: 55 }, { taux: "20", poids: 25 }],
    contexte:
      "En plâtrerie, le 10 % couvre l'essentiel (cloisons et doublages en rénovation). Le 5,5 % concerne les doublages isolants d'une rénovation énergétique, et le 20 % le neuf.",
  },
  serrurier: {
    rates: [{ taux: "10", poids: 60 }, { taux: "20", poids: 40 }],
    contexte:
      "En serrurerie, l'essentiel des interventions relève du taux normal à 20 % (dépannage, fourniture, neuf) et du 10 % en rénovation d'un logement de plus de 2 ans. Le taux réduit de 5,5 % ne s'applique pas à ce métier.",
  },
  vitrier: {
    rates: [{ taux: "10", poids: 64 }, { taux: "20", poids: 36 }],
    contexte:
      "En vitrerie, le 10 % domine (remplacement de vitrage en logement de plus de 2 ans). Le 20 % concerne le neuf, la casse et la fourniture seule. Le 5,5 %, réservé au double vitrage à très haute performance, reste marginal et n'est pas représenté ici.",
  },
  paysagiste: {
    rates: [{ taux: "10", poids: 8 }, { taux: "20", poids: 92 }],
    contexte:
      "En paysagisme, l'entretien comme la création relèvent de la TVA à 20 % ; le 10 % reste très marginal et le 5,5 % ne s'applique pas. L'avantage fiscal de votre client passe par le crédit d'impôt services à la personne (50 %), pas par un taux réduit.",
  },
};

const DEFAULT_MIX: MixEntry = {
  rates: [{ taux: "5,5", poids: 20 }, { taux: "10", poids: 55 }, { taux: "20", poids: 25 }],
  contexte:
    "Trois taux de TVA coexistent dans le bâtiment : 5,5 % pour la rénovation énergétique éligible, 10 % pour l'amélioration d'un logement de plus de 2 ans, et 20 % pour le neuf et la fourniture seule.",
};

function slugMetier(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

/** Ordre d'affichage stable : 5,5 puis 10 puis 20 (mint, orange, bleu). */
const ORDER: Taux[] = ["5,5", "10", "20"];

interface MetierTvaChartProps {
  nom: string;
}

export default function MetierTvaChart({ nom }: MetierTvaChartProps) {
  const id = useId();
  const entry = TVA_MIX[slugMetier(nom)] ?? DEFAULT_MIX;

  const rates = [...entry.rates].sort(
    (a, b) => ORDER.indexOf(a.taux) - ORDER.indexOf(b.taux),
  );

  // ── Calcul des largeurs de segments (viewBox 600), avec plancher lisibilité ──
  const VB_W = 600;
  const VB_H = 30;
  const GAP = 3;
  const MIN = 52;
  const total = rates.reduce((s, r) => s + r.poids, 0) || 1;
  const usable = VB_W - GAP * (rates.length - 1);

  let widths = rates.map((r) => Math.max(MIN, (r.poids / total) * usable));
  const wSum = widths.reduce((s, w) => s + w, 0);
  if (wSum > usable) {
    const scale = usable / wSum;
    widths = widths.map((w) => w * scale);
  }

  const segments = rates.map((r, i) => {
    const x = widths.slice(0, i).reduce((s, w) => s + w + GAP, 0);
    return { taux: r.taux, x, w: widths[i], color: RATE_META[r.taux].color };
  });

  // ── Description textuelle a11y + GEO (générée depuis la data) ──
  const present = rates.map((r) => `${r.taux} %`).join(", ");
  const absents = ORDER.filter((t) => !rates.some((r) => r.taux === t));
  const desc =
    `Répartition indicative des taux de TVA en ${nom.toLowerCase()} : ${present}.` +
    (absents.length > 0
      ? ` Le taux ${absents.map((t) => `${t} %`).join(" et ")} ne s'applique pas ou reste marginal dans ce métier.`
      : "");

  const titleId = `${id}-t`;
  const descId = `${id}-d`;

  return (
    <figure className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#f6f8fb] to-white p-6 md:p-8">
      <figcaption className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
        Répartition indicative des taux en {nom.toLowerCase()}
      </figcaption>

      {/* Barre segmentée (purement visuelle : aucun texte dedans → a11y OK) */}
      <div className="mt-5">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height={VB_H}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="h-[26px] w-full"
        >
          <title id={titleId}>Taux de TVA applicables en {nom.toLowerCase()}</title>
          <desc id={descId}>{desc}</desc>
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x="0" y="0" width={VB_W} height={VB_H} rx={VB_H / 2} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-clip)`}>
            {segments.map((s) => (
              <rect key={s.taux} x={s.x} y="0" width={s.w} height={VB_H} fill={s.color} />
            ))}
          </g>
        </svg>
      </div>

      {/* Cartes légende — source de vérité textuelle (contraste garanti) */}
      <ul
        className={`mt-6 grid grid-cols-1 gap-4 ${
          rates.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {rates.map((r) => {
          const meta = RATE_META[r.taux];
          return (
            <li key={r.taux} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-baseline gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <p className="font-spline-mono text-2xl font-bold text-[#0f1a3a]">{r.taux}%</p>
              </div>
              <p className="mt-2 font-hanken text-sm font-semibold text-[#0f1a3a]">{meta.libelle}</p>
              <p className="mt-1 font-hanken text-xs text-gray-500">{meta.exemples}</p>
            </li>
          );
        })}
      </ul>

      {/* Phrase de contexte unique par métier (anti near-duplicate + citabilité IA) */}
      <p className="mt-6 font-hanken text-sm leading-relaxed text-[#0f1a3a]/75">{entry.contexte}</p>
      <p className="mt-2 font-hanken text-xs text-gray-400">
        Proportions indicatives selon la nature des travaux — le taux réel dépend de l'éligibilité et
        de l'ancienneté du logement.
      </p>
    </figure>
  );
}
