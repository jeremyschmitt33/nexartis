"use client";

// =====================================================================
// DoublonsAlert — alerte discrete sur le dashboard quand le catalogue de
// prestations contient des libelles qui se ressemblent (fautes de frappe,
// pluriel, variantes proches). On SIGNALE seulement : l'artisan va verifier
// et nettoyer dans /dashboard/prestations. Aucune fusion automatique.
//
// Composant defensif : si 0 doublon (ou liste vide / en chargement / en
// erreur), il ne rend RIEN — il ne casse jamais la mise en page du dashboard.
// =====================================================================

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { usePrestations } from "@/lib/hooks";
import { countDuplicates } from "@/lib/prestations-dedup";

export default function DoublonsAlert() {
  const { data: prestations, loading, error } = usePrestations();

  const count = useMemo(() => {
    if (loading || error) return 0;
    return countDuplicates(
      prestations.map((p) => {
        const row = p as Record<string, unknown>;
        return {
          id: row.id as string,
          designation: (row.designation as string) ?? "",
        };
      }),
    );
  }, [prestations, loading, error]);

  if (count === 0) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
        <AlertTriangle size={18} className="text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-hanken text-sm font-bold text-amber-900">
          <span className="font-spline-mono">{count}</span> prestation{count > 1 ? "s" : ""} se ressemblent dans ton catalogue
        </p>
        <p className="font-hanken text-xs font-medium text-amber-700/90 mt-0.5">
          Vérifie et supprime les doublons pour garder un catalogue propre.
        </p>
      </div>
      <Link
        href="/dashboard/prestations"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 font-hanken text-xs font-bold text-white transition-all duration-200 hover:bg-amber-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
      >
        Vérifier
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}
