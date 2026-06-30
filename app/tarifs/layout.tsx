import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs Nexartis : prix logiciel devis & facture artisan",
  description:
    "Le prix d'un logiciel de devis et facture pour artisan, sans surprise : 15 €/mois ou 25 €/mois, sans engagement. 14 jours d'essai gratuit, sans carte bancaire.",
  alternates: {
    canonical: "/tarifs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
