"use client";

import { useState, useMemo } from "react";
import { useFactures, useEntreprise, LoadingSkeleton } from "@/lib/hooks";
import {
  Landmark,
  Copy,
  Check,
  ExternalLink,
  Info,
  Receipt,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────
// Page « Aide à la déclaration URSSAF » (auto-entrepreneur)
// ────────────────────────────────────────────────────────────────────
// Objectif : un AE déclare son CHIFFRE D'AFFAIRES ENCAISSÉ (l'argent
// réellement reçu) sur autoentrepreneur.urssaf.fr. Cette page calcule ce
// montant sur la période choisie et l'affiche, prêt à copier.
//
// LECTURE SEULE : aucune écriture en base. On lit uniquement les factures
// (useFactures, déjà filtré deleted_at IS NULL côté hook) et l'entreprise.
//
// CALCUL — CA encaissé sur la période :
//   Pour chaque facture NON supprimée dont `date_paiement` tombe dans la
//   période ET dont le statut est « payee » ou « partiellement_payee » :
//     - statut « payee »                → on additionne montant_ttc
//     - statut « partiellement_payee »  → on additionne montant_paye
//       (le montant réellement encaissé, < TTC)
//   Pour un AE en franchise de TVA, TTC = HT (pas de TVA).
// ────────────────────────────────────────────────────────────────────

type FactureRow = Record<string, unknown>;

type PeriodId =
  | "mois_dernier"
  | "mois_courant"
  | "trimestre_courant"
  | "annee_courante"
  | "mois_precis";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatCurrency(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Renvoie [début, fin[ (fin exclusive) de la période choisie. */
function getPeriodRange(
  period: PeriodId,
  customMonth: number,
  customYear: number,
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "mois_courant": {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      return { start, end, label: `${MONTH_NAMES[m]} ${y}` };
    }
    case "trimestre_courant": {
      const qStart = Math.floor(m / 3) * 3; // 0, 3, 6 ou 9
      const start = new Date(y, qStart, 1);
      const end = new Date(y, qStart + 3, 1);
      const qNum = qStart / 3 + 1;
      return { start, end, label: `${qNum}ᵉ trimestre ${y}` };
    }
    case "annee_courante": {
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      return { start, end, label: `année ${y}` };
    }
    case "mois_precis": {
      const start = new Date(customYear, customMonth, 1);
      const end = new Date(customYear, customMonth + 1, 1);
      return {
        start,
        end,
        label: `${MONTH_NAMES[customMonth]} ${customYear}`,
      };
    }
    case "mois_dernier":
    default: {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      return {
        start,
        end,
        label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
      };
    }
  }
}

const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: "mois_dernier", label: "Mois dernier" },
  { id: "mois_courant", label: "Mois en cours" },
  { id: "trimestre_courant", label: "Trimestre en cours" },
  { id: "annee_courante", label: "Année en cours" },
  { id: "mois_precis", label: "Mois précis…" },
];

export default function UrssafPage() {
  const { data: factures, loading: loadingF } = useFactures();
  const { entreprise, loading: loadingE } = useEntreprise();
  const loading = loadingF || loadingE;

  const now = new Date();
  const [period, setPeriod] = useState<PeriodId>("mois_dernier");
  const [customMonth, setCustomMonth] = useState(now.getMonth());
  const [customYear, setCustomYear] = useState(now.getFullYear());
  const [taux, setTaux] = useState(""); // taux de cotisation saisi par l'artisan
  const [copied, setCopied] = useState(false);

  const isFranchise = entreprise?.franchise_tva === true;

  const { start, end, label } = useMemo(
    () => getPeriodRange(period, customMonth, customYear),
    [period, customMonth, customYear],
  );

  // ── Calcul CA encaissé sur la période ──
  const result = useMemo(() => {
    const facs = (factures ?? []) as FactureRow[];
    let total = 0;
    let count = 0;

    for (const f of facs) {
      // Sécurité défensive : exclure tout soft delete éventuel
      if (f.deleted_at) continue;

      const statut = (f.statut as string) ?? "";
      if (statut !== "payee" && statut !== "partiellement_payee") continue;

      const dpRaw = f.date_paiement as string | null | undefined;
      if (!dpRaw) continue;
      const dp = new Date(dpRaw);
      if (Number.isNaN(dp.getTime())) continue;
      if (dp < start || dp >= end) continue;

      // « payee » → on prend le TTC complet.
      // « partiellement_payee » → on prend ce qui a réellement été encaissé.
      const montant =
        statut === "partiellement_payee"
          ? (f.montant_paye as number) ?? 0
          : (f.montant_ttc as number) ?? 0;

      if (montant > 0) {
        total += montant;
        count += 1;
      }
    }

    return { total, count };
  }, [factures, start, end]);

  // ── Estimation cotisations (uniquement si un taux est saisi) ──
  const tauxNum = parseFloat(taux.replace(",", "."));
  const tauxValide = !Number.isNaN(tauxNum) && tauxNum > 0;
  const cotisations = tauxValide ? (result.total * tauxNum) / 100 : null;

  const handleCopy = async () => {
    try {
      // On copie une valeur « brute » (point décimal, sans symbole €) pour
      // un collage propre sur le site de l'URSSAF.
      const value = result.total.toFixed(2);
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible (ancien navigateur / contexte non sécurisé)
      setCopied(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-hanken font-extrabold text-3xl text-navy tracking-[-0.025em] mb-8">
          Aide à la déclaration URSSAF
        </h1>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-navy/[0.06]">
            <Landmark size={18} className="text-navy" aria-hidden="true" />
          </span>
          <h1 className="font-hanken font-extrabold text-2xl sm:text-3xl text-navy tracking-[-0.025em] leading-tight">
            Aide à la déclaration URSSAF
          </h1>
        </div>
        <p className="font-hanken font-medium text-sm text-gray-500">
          Retrouvez en un clic le chiffre d&apos;affaires <strong className="text-navy font-semibold">encaissé</strong> à déclarer
          sur la période de votre choix.
        </p>
      </div>

      {/* ── Sélecteur de période ── */}
      <div className="bg-white rounded-2xl p-5 border border-navy/[0.06] shadow-[0_4px_16px_rgba(15,26,58,0.04)] mb-5">
        <p className="font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-500 mb-3">
          Période à déclarer
        </p>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3.5 py-2 rounded-lg font-hanken font-semibold text-sm transition-all duration-150 border ${
                  active
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange hover:bg-cream/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Choix mois / année précis */}
        {period === "mois_precis" && (
          <div className="flex flex-wrap gap-3 mt-4">
            <label className="flex-1 min-w-[140px]">
              <span className="block font-hanken font-medium text-xs text-gray-500 mb-1">
                Mois
              </span>
              <select
                value={customMonth}
                onChange={(e) => setCustomMonth(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-gray-200 bg-white font-hanken text-sm text-navy focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
              >
                {MONTH_NAMES.map((mName, i) => (
                  <option key={i} value={i}>
                    {mName.charAt(0).toUpperCase() + mName.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-[140px]">
              <span className="block font-hanken font-medium text-xs text-gray-500 mb-1">
                Année
              </span>
              <select
                value={customYear}
                onChange={(e) => setCustomYear(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-gray-200 bg-white font-hanken text-sm text-navy focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* ── Bloc principal : Montant à déclarer ── */}
      <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-navy/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06)] overflow-hidden mb-5">
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange via-orange-hover to-orange opacity-90"
        />
        <p className="font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-500">
          Montant à déclarer — {label}
        </p>
        <p className="font-spline-mono font-medium text-4xl sm:text-5xl text-orange mt-2 mb-1 tracking-[-0.01em]">
          {formatCurrency(result.total)} €
        </p>
        <p className="font-hanken text-sm text-gray-500">
          {result.count === 0
            ? "Aucun encaissement sur cette période."
            : `${result.count} facture${result.count > 1 ? "s" : ""} encaissée${
                result.count > 1 ? "s" : ""
              } sur cette période.`}
        </p>

        <button
          onClick={handleCopy}
          disabled={result.total <= 0}
          className="mt-5 inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-navy text-white font-hanken font-bold text-sm transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check size={16} aria-hidden="true" /> Copié&nbsp;!
            </>
          ) : (
            <>
              <Copy size={16} aria-hidden="true" /> Copier le montant
            </>
          )}
        </button>

        {isFranchise && (
          <p className="mt-4 font-hanken text-xs text-gray-400">
            Vous êtes en franchise de TVA : le montant TTC est égal au montant HT
            (pas de TVA à déduire).
          </p>
        )}
      </div>

      {/* ── Estimation cotisations (optionnelle, prudente) ── */}
      <div className="bg-white rounded-2xl p-5 border border-navy/[0.06] shadow-[0_4px_16px_rgba(15,26,58,0.04)] mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={16} className="text-navy" aria-hidden="true" />
          <p className="font-hanken font-bold text-sm text-navy">
            Estimer mes cotisations (facultatif)
          </p>
        </div>

        <label className="block max-w-[220px]">
          <span className="block font-hanken font-medium text-xs text-gray-500 mb-1">
            Mon taux de cotisation
          </span>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={taux}
              onChange={(e) => setTaux(e.target.value)}
              placeholder="ex : 21,2"
              aria-label="Taux de cotisation en pourcentage"
              className="w-full h-11 px-3 pr-8 rounded-lg border border-gray-200 bg-white font-spline-mono text-sm text-navy focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-spline-mono text-sm text-gray-400">
              %
            </span>
          </div>
        </label>

        {cotisations !== null && (
          <p className="mt-4 font-hanken text-sm text-navy">
            Estimation des cotisations :{" "}
            <strong className="font-spline-mono font-medium text-navy">
              {formatCurrency(cotisations)} €
            </strong>
          </p>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-cream/50 border border-gold/30 px-3.5 py-3">
          <Info size={15} className="text-orange flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-hanken text-xs text-gray-600 leading-relaxed">
            Estimation indicative. Le taux dépend de votre activité (vente,
            prestation de service, profession libérale…) et peut évoluer.
            Vérifiez votre taux exact sur{" "}
            <a
              href="https://www.autoentrepreneur.urssaf.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange underline hover:text-orange-hover"
            >
              autoentrepreneur.urssaf.fr
            </a>
            . Ce calcul ne constitue pas un conseil fiscal.
          </p>
        </div>
      </div>

      {/* ── Encart d'aide ── */}
      <div className="rounded-2xl bg-navy/[0.03] border border-navy/[0.08] p-5">
        <p className="font-hanken font-bold text-sm text-navy mb-2">
          Où faire ma déclaration&nbsp;?
        </p>
        <p className="font-hanken text-sm text-gray-600 leading-relaxed mb-3">
          La déclaration de chiffre d&apos;affaires se fait directement sur le
          site officiel de l&apos;URSSAF, selon la périodicité que vous avez
          choisie (mensuelle ou trimestrielle). Reportez le montant ci-dessus
          dans la case « chiffre d&apos;affaires ».
        </p>
        <a
          href="https://www.autoentrepreneur.urssaf.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-hanken font-semibold text-sm text-orange hover:text-orange-hover transition-colors"
        >
          Aller sur autoentrepreneur.urssaf.fr
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
