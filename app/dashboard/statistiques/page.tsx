"use client";

import { useState, useMemo } from "react";
import { useFactures, useDevis, useChantiers, LoadingSkeleton } from "@/lib/hooks";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MONTH_NAMES = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

function formatCurrency(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

// ============ StatCard V4 Light Premium ============
// Carte blanche premium, label SMALL CAPS, valeur en Spline Mono (chiffres).
// Accent line orange optionnelle si highlight=true.
function StatCard({
  label,
  value,
  valueColor = "text-[#0f1a3a]",
  size = "2xl",
  highlight = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  size?: "2xl" | "3xl";
  highlight?: boolean;
}) {
  return (
    <div
      className="relative bg-white rounded-2xl p-5 border border-[#0f1a3a]/[0.06]
                 shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]
                 transition-all duration-200 hover:-translate-y-0.5
                 hover:shadow-[0_8px_24px_rgba(15,26,58,0.08),_0_2px_4px_rgba(15,26,58,0.04)]
                 overflow-hidden"
    >
      {highlight && (
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
        />
      )}
      <p className="font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </p>
      <p
        className={`font-spline-mono font-medium tracking-[-0.01em] ${
          size === "3xl" ? "text-3xl" : "text-2xl"
        } ${valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}

// ============ SectionHeader (titre de zone) V4 ============
// Titre H2 extrabold Hanken, sans icône (pour structurer les blocs de KPI).
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 mt-10 first:mt-0">
      <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="font-hanken font-medium text-sm text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default function StatistiquesPage() {
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const { data: factures, loading: loadingF } = useFactures();
  const { data: devis, loading: loadingD } = useDevis();
  const { data: chantiers, loading: loadingCh } = useChantiers();

  const loading = loadingF || loadingD || loadingCh;

  const stats = useMemo(() => {
    const facs = factures.map((f) => f as Record<string, unknown>);
    const devs = devis.map((d) => d as Record<string, unknown>);
    const chants = chantiers.map((c) => c as Record<string, unknown>);

    // CA facturé = toutes les factures émises (hors brouillon)
    const emittedFactures = facs.filter((f) => {
      const s = (f.statut as string) ?? "";
      return s !== "brouillon";
    });
    const totalCAFacture = emittedFactures.reduce((s, f) => s + ((f.montant_ttc as number) ?? 0), 0);

    // CA encaissé = factures payées ou archivées
    const paidFactures = facs.filter((f) => {
      const s = (f.statut as string) ?? "";
      return s === "payee" || s === "archivee" || s === "Encaissée";
    });
    const totalCA = paidFactures.reduce((s, f) => s + ((f.montant_ttc as number) ?? 0), 0);

    const resteAEncaisser = totalCAFacture - totalCA;

    const monthlyFacture: number[] = new Array(12).fill(0);
    const monthlyEncaisse: number[] = new Array(12).fill(0);

    for (const f of facs) {
      const statut = (f.statut as string) ?? "";
      if (statut === "brouillon") continue;
      const dateStr = (f.date_emission as string) || (f.created_at as string);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d.getFullYear() !== chartYear) continue;
      const month = d.getMonth();
      monthlyFacture[month] += (f.montant_ttc as number) ?? 0;
      if (statut === "payee" || statut === "archivee" || statut === "Encaissée") {
        monthlyEncaisse[month] += (f.montant_ttc as number) ?? 0;
      }
    }

    const chartData = MONTH_NAMES.map((name, i) => ({
      month: name,
      facture: monthlyFacture[i],
      encaisse: monthlyEncaisse[i],
    }));

    const maxChartValue = Math.max(...chartData.map((d) => d.facture), 1);
    const yMax = Math.ceil(maxChartValue / 5000) * 5000;
    const yAxisValues = [0, Math.round(yMax / 3), Math.round((yMax * 2) / 3), yMax];

    const totalDevis = devs.length;
    const signedDevis = devs.filter((d) => {
      const s = (d.statut as string) ?? "";
      return s === "signe" || s === "facture";
    }).length;
    const tauxTransformation = totalDevis > 0 ? Math.round((signedDevis / totalDevis) * 100) : 0;

    const devisMontants = devs
      .map((d) => (d.montant_ttc as number) ?? 0)
      .filter((m) => m > 0);
    const montantMoyenDevis = devisMontants.length > 0
      ? Math.round(devisMontants.reduce((a, b) => a + b, 0) / devisMontants.length)
      : 0;

    const impayees = facs.filter((f) => {
      const s = (f.statut as string) ?? "";
      return s === "en_retard" || s === "en_attente" || s === "partielle";
    });
    const montantImpaye = impayees.reduce((s, f) => {
      const ttc = (f.montant_ttc as number) ?? 0;
      const paye = (f.montant_paye as number) ?? 0;
      return s + (ttc - paye);
    }, 0);
    const facturesEnRetard = facs.filter((f) => (f.statut as string) === "en_retard").length;

    const totalFacturesTTC = facs.reduce((s, f) => s + ((f.montant_ttc as number) ?? 0), 0);
    const totalPaye = facs.reduce((s, f) => s + ((f.montant_paye as number) ?? 0), 0);
    const tauxEncaissement = totalFacturesTTC > 0
      ? Math.round((totalPaye / totalFacturesTTC) * 100)
      : 0;

    const chantiersActifs = chants.filter((c) => {
      const s = (c.statut as string) ?? "";
      return s === "en_cours" || s === "planifie";
    }).length;

    return {
      totalCA,
      totalCAFacture,
      resteAEncaisser,
      chartData,
      maxChartValue: yMax || 1,
      yAxisValues,
      tauxTransformation,
      montantMoyenDevis,
      montantImpaye,
      facturesEnRetard,
      tauxEncaissement,
      chantiersActifs,
    };
  }, [factures, devis, chantiers, chartYear]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] mb-8">
            Statistiques
          </h1>
          <LoadingSkeleton rows={8} />
        </div>
      </div>
    );
  }

  return (
    // ============ Page Statistiques — V4 Light Premium ============
    // Header de page Hanken extrabold + sous-titre, cartes blanches arrondies
    // 2xl, chiffres en Spline Mono, accent line orange sur les cards mises en
    // avant. Logique recharts préservée à 100% (BarChart, dataKey, formatter).
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header de page */}
        <div className="mb-8">
          <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Statistiques
          </h1>
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
            Suivi de votre chiffre d&apos;affaires, devis, factures et planning
          </p>
        </div>

        <SectionHeader title="Chiffre d'affaires" subtitle="Suivi mensuel du facturé et de l'encaissé" />

        {/* ============ Carte graphique CA — PremiumCard avec accent line ============ */}
        <div
          className="relative bg-white rounded-3xl p-6 sm:p-8 border border-[#0f1a3a]/[0.06]
                     shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]
                     overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-500">
                CA encaissé <span className="font-spline-mono font-medium">{chartYear}</span>
              </p>
              <p className="font-spline-mono font-medium text-3xl text-emerald-600 mt-1 tracking-[-0.01em]">
                {formatCurrency(stats.totalCA)}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <span className="font-hanken text-xs text-gray-500">
                  Facturé : <strong className="text-[#0f1a3a] font-spline-mono font-medium">{formatCurrency(stats.totalCAFacture)}</strong>
                </span>
                <span className="font-hanken text-xs text-gray-500">
                  Reste : <strong className="text-[#ff7a1a] font-spline-mono font-medium">{formatCurrency(stats.resteAEncaisser)}</strong>
                </span>
              </div>
            </div>
            {/* Sélecteur d'année */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChartYear(chartYear - 1)}
                className="px-3 py-1.5 font-hanken font-semibold text-xs text-gray-600 bg-white border-[1.5px] border-gray-200 rounded-lg
                           hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all duration-200"
              >
                &larr; <span className="font-spline-mono font-medium">{chartYear - 1}</span>
              </button>
              <span className="px-3 py-1.5 font-spline-mono font-medium text-xs text-white bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] rounded-lg
                              shadow-[0_4px_12px_rgba(255,122,26,0.3)]">
                {chartYear}
              </span>
              <button
                onClick={() => setChartYear(chartYear + 1)}
                disabled={chartYear >= new Date().getFullYear()}
                className="px-3 py-1.5 font-hanken font-semibold text-xs text-gray-600 bg-white border-[1.5px] border-gray-200 rounded-lg
                           hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all duration-200
                           disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
              >
                <span className="font-spline-mono font-medium">{chartYear + 1}</span> &rarr;
              </button>
            </div>
          </div>

          {/* Logique recharts INTACTE — couleurs adaptées à la palette V4. */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#6b7280', fontFamily: 'var(--font-hanken)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'var(--font-spline-mono)' }}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString('fr-FR')} €`,
                  name === 'facture' ? 'CA facturé' : 'CA encaissé',
                ]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'var(--font-hanken)' }}
              />
              <Legend formatter={(value: string) => value === 'facture' ? 'CA facturé' : 'CA encaissé'} />
              <Bar dataKey="facture" fill="#ff9d4d" radius={[6, 6, 0, 0]} />
              <Bar dataKey="encaisse" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <SectionHeader title="Devis" subtitle="Performance commerciale" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Taux de transformation"
            value={`${stats.tauxTransformation}%`}
            valueColor="text-emerald-600"
            size="3xl"
            highlight
          />
          <StatCard label="Délai moyen signature" value="—" />
          <StatCard label="Montant moyen" value={formatCurrency(stats.montantMoyenDevis)} />
          <StatCard
            label="Devis signés"
            value={`${devis.filter((d) => { const s = ((d as Record<string, unknown>).statut as string) ?? ''; return s === 'signe' || s === 'facture'; }).length}`}
          />
        </div>

        <SectionHeader title="Factures" subtitle="Suivi de l'encaissement" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Délai moyen paiement" value="—" />
          <StatCard
            label="Reste à encaisser"
            value={formatCurrency(stats.resteAEncaisser)}
            valueColor="text-[#ff7a1a]"
            highlight
          />
          <StatCard
            label="Factures en retard"
            value={String(stats.facturesEnRetard)}
            valueColor="text-red-600"
          />
          <StatCard label="Taux encaissement" value={`${stats.tauxEncaissement}%`} />
        </div>

        <SectionHeader title="Planning" subtitle="Activité chantiers" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          <StatCard label="Taux occupation" value="—" />
          <StatCard label="Jour le plus chargé" value="—" />
          <StatCard label="Chantiers actifs" value={String(stats.chantiersActifs)} />
        </div>
      </div>
    </div>
  );
}
