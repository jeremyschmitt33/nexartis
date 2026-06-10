"use client";

// =====================================================================
// DecennaleBanner — V2 du systeme de rappels decennale (10/06/2026)
// Affiche un bandeau persistant sur le dashboard selon l'etat de la
// garantie decennale (date_fin). 4 etats :
//   - absente   : aucune date renseignee -> bandeau orange + CTA Parametres
//   - urgente   : <=7 jours restants     -> bandeau rouge URGENT
//   - warning   : <=30 jours restants    -> bandeau orange
//   - expiree   : date passee            -> bandeau rouge "non couvert"
// Sinon : pas de bandeau (date >30j ou colonne absente cote DB).
//
// Dismiss : sauf cas "urgent" et "expiree", le user peut masquer pour 7j.
// Persistance dans localStorage (cle "nexartis_decennale_dismissed_until").
// =====================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { InfoBanner } from "@/components/ui/v4";

const DISMISS_KEY = "nexartis_decennale_dismissed_until";

type BannerState =
  | { variant: "absente" }
  | { variant: "expiree"; daysOver: number }
  | { variant: "urgente"; daysLeft: number }
  | { variant: "warning"; daysLeft: number }
  | null;

function computeState(dateFin?: string | null): BannerState {
  if (!dateFin) return { variant: "absente" };
  const target = new Date(`${dateFin}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { variant: "expiree", daysOver: Math.abs(diffDays) };
  if (diffDays <= 7) return { variant: "urgente", daysLeft: diffDays };
  if (diffDays <= 30) return { variant: "warning", daysLeft: diffDays };
  return null;
}

export default function DecennaleBanner({ dateFin }: { dateFin?: string | null }) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(DISMISS_KEY);
      if (stored) {
        const until = new Date(stored).getTime();
        if (!Number.isNaN(until) && until > Date.now()) {
          setDismissed(true);
        }
      }
    } catch {
      // localStorage indisponible (SSR / mode prive) : on ignore
    }
  }, []);

  if (!mounted) return null;
  const state = computeState(dateFin);
  if (!state) return null;

  // Les paliers "absente" / "warning" sont dismissibles pour 7 jours.
  // Les paliers "urgente" et "expiree" ne le sont JAMAIS (risque metier).
  const canDismiss = state.variant === "absente" || state.variant === "warning";
  if (canDismiss && dismissed) return null;

  const handleDismiss = () => {
    try {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      window.localStorage.setItem(DISMISS_KEY, until.toISOString());
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const isCritical = state.variant === "urgente" || state.variant === "expiree";
  const variant: "warn" | "danger" = isCritical ? "danger" : "warn";
  const accent = isCritical ? "#b91c1c" : "#d97706";
  const textTitle = isCritical ? "text-red-900" : "text-amber-900";
  const textBody = isCritical ? "text-red-800" : "text-amber-800";
  const dismissBtnClasses = isCritical
    ? "border border-red-300 text-red-800 hover:bg-red-100 focus-visible:ring-red-400"
    : "border border-amber-300 text-amber-800 hover:bg-amber-100 focus-visible:ring-amber-400";

  let title = "";
  let body = "";
  let ctaLabel = "Renseigner la date";
  let ctaHref = "/dashboard/parametres";

  if (state.variant === "absente") {
    title = "Date de fin de décennale non renseignée";
    body =
      "Renseignez la date de fin de validité de votre décennale dans vos paramètres pour activer les rappels automatiques (J-60, J-30, J-7).";
    ctaLabel = "Renseigner la date";
  } else if (state.variant === "warning") {
    title = `Décennale à renouveler dans ${state.daysLeft} jours`;
    body =
      "Pensez à comparer les offres et à valider votre renouvellement pour éviter toute rupture de couverture sur vos chantiers en cours.";
    ctaLabel = "Mettre à jour la date";
  } else if (state.variant === "urgente") {
    title = `🚨 URGENT — Décennale expire dans ${state.daysLeft} jour${state.daysLeft > 1 ? "s" : ""}`;
    body =
      "Sans décennale valide, vous ne pouvez plus signer de devis ni démarrer de chantier. Contactez votre assureur dès aujourd'hui.";
    ctaLabel = "Mettre à jour la date";
  } else {
    title = `Décennale EXPIRÉE depuis ${state.daysOver} jour${state.daysOver > 1 ? "s" : ""}`;
    body =
      "Vos chantiers ne sont plus couverts. Vous engagez votre responsabilité personnelle illimitée à chaque intervention. Régularisez immédiatement.";
    ctaLabel = "Mettre à jour la date";
  }

  return (
    <div className="mb-6">
      <InfoBanner
        variant={variant}
        icon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <p className={`font-hanken font-bold text-[15px] ${textTitle} mb-1`}>{title}</p>
            <p className={`font-hanken text-sm ${textBody} mb-3`}>{body}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white
                           font-hanken font-bold text-sm
                           shadow-[0_4px_12px_rgba(255,122,26,0.25)]
                           hover:-translate-y-0.5 hover:brightness-105 transition-all duration-200
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
              >
                {ctaLabel}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
              {canDismiss && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className={`inline-flex items-center px-3 py-2 rounded-xl font-hanken font-semibold text-xs
                              ${dismissBtnClasses}
                              transition-all duration-200
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
                  aria-label="Masquer ce rappel pendant 7 jours"
                >
                  Masquer 7 jours
                </button>
              )}
            </div>
          </div>
        </div>
      </InfoBanner>
    </div>
  );
}
