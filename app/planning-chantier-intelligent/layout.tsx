import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planning Chantier Intelligent — Nexartis | Alertes conflits incluses",
  description:
    "Le seul planning artisan avec drag-and-drop, alertes conflits automatiques et vue équipe en temps réel. Inclus dans l'offre Complet de Nexartis à 25€/mois.",
  alternates: {
    canonical: '/planning-chantier-intelligent',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
