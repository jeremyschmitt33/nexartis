import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs Nexartis — 15€ ou 25€/mois | Logiciel BTP artisan",
  description:
    "Deux offres claires sans engagement : Essentiel à 15€/mois (devis et factures BTP conformes) ou Complet à 25€/mois (planning d'équipe + IA vocale). 14 jours d'essai sans carte bancaire.",
  alternates: {
    canonical: '/tarifs',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
