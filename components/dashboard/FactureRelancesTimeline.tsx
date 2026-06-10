"use client";

// =====================================================================
// FactureRelancesTimeline — V2.3 10/06/2026
// Affiche sur la fiche facture la timeline des relances deja envoyees
// (table `relances`). Permet a l'artisan de verifier ce qui est parti,
// quand, et quel ton. Idempotent : 1 ligne par envoi.
// =====================================================================

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Send, AlertTriangle } from "lucide-react";

type Niveau = "rappel" | "ferme" | "mise_en_demeure";

interface RelanceRow {
  id: string;
  type: Niveau;
  date_envoi: string;
  statut: string | null;
  contenu: string | null;
}

// Meta par niveau : icone, couleur, label
const NIVEAU_META: Record<Niveau, { label: string; bg: string; bd: string; tx: string; icon: typeof Mail }> = {
  rappel: {
    label: "Rappel courtois (J+7)",
    bg: "bg-sky-50",
    bd: "border-sky-200",
    tx: "text-sky-800",
    icon: Mail,
  },
  ferme: {
    label: "Rappel ferme (J+15)",
    bg: "bg-amber-50",
    bd: "border-amber-200",
    tx: "text-amber-800",
    icon: Send,
  },
  mise_en_demeure: {
    label: "Dernier rappel (J+30)",
    bg: "bg-red-50",
    bd: "border-red-200",
    tx: "text-red-800",
    icon: AlertTriangle,
  },
};

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FactureRelancesTimeline({ factureId }: { factureId: string }) {
  const [loading, setLoading] = useState(true);
  const [relances, setRelances] = useState<RelanceRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("relances")
        .select("id, type, date_envoi, statut, contenu")
        .eq("facture_id", factureId)
        .order("date_envoi", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn("[FactureRelancesTimeline]", error.message);
        setRelances([]);
      } else {
        setRelances((data || []) as RelanceRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [factureId]);

  if (loading) {
    return (
      <div className="rounded-2xl border-[1.5px] border-gray-200 bg-white p-5">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-hanken font-bold text-[15px] text-[#0f1a3a] flex items-center gap-2">
          <Mail size={16} className="text-[#ff7a1a]" aria-hidden="true" />
          Historique des relances
        </h3>
        {relances.length > 0 && (
          <span className="font-hanken font-semibold text-[12px] text-gray-500">
            {relances.length} envoi{relances.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {relances.length === 0 ? (
        <div className="text-center py-6">
          <p className="font-hanken text-[13px] text-gray-500">
            Aucune relance envoyée pour cette facture.
          </p>
          <p className="font-hanken text-[12px] text-gray-400 mt-1">
            Les envois automatiques (cron 9h) et manuels (bouton « Relancer maintenant ») apparaîtront ici.
          </p>
        </div>
      ) : (
        <ol className="space-y-3 relative" aria-label="Historique chronologique des relances">
          {/* Ligne verticale connectant les points de la timeline */}
          <div
            className="absolute left-[14px] top-3 bottom-3 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent"
            aria-hidden="true"
          />
          {relances.map((r, idx) => {
            const meta = NIVEAU_META[r.type] || NIVEAU_META.rappel;
            const Icon = meta.icon;
            const isManuelle =
              typeof r.contenu === "string" && r.contenu.toLowerCase().includes("manuel");
            return (
              <li key={r.id} className="relative pl-10">
                {/* Pastille icone */}
                <span
                  className={`absolute left-0 top-0.5 w-7 h-7 rounded-full ${meta.bg} ${meta.bd} border flex items-center justify-center`}
                  aria-hidden="true"
                >
                  <Icon size={14} className={meta.tx} />
                </span>
                {/* Carte detail */}
                <div className={`rounded-lg ${meta.bg} ${meta.bd} border px-3 py-2`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className={`font-hanken font-bold text-[13.5px] ${meta.tx}`}>
                      {meta.label}
                      {isManuelle && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-white/70 border border-current/10 font-semibold">
                          Manuel
                        </span>
                      )}
                    </p>
                    <time
                      dateTime={r.date_envoi}
                      className={`font-hanken text-[12px] ${meta.tx} opacity-80`}
                    >
                      {formatDateTime(r.date_envoi)}
                    </time>
                  </div>
                  {r.contenu && (
                    <p className={`mt-1 font-hanken text-[12px] ${meta.tx} opacity-90 break-all`}>
                      {r.contenu}
                    </p>
                  )}
                </div>
                {idx === relances.length - 1 && (
                  <span className="sr-only">Dernière relance en date.</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
