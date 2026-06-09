import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Menuisier — Nexartis | dès 15€/mois",
  description:
    "Créez vos devis menuiserie en quelques minutes. Fournitures et pose détaillées. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-menuisier',
  },
};

const data = {
  nom: "Menuisier",
  nomPluriel: "Menuisiers",
  icon: "🪚",
  h1: "Logiciel devis et factures pour menuisiers",
  metaTitle: "Logiciel Devis Menuisier — Nexartis | dès 15€/mois",
  metaDescription:
    "Créez vos devis menuiserie en quelques minutes. Fournitures et pose détaillées. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 10% sur la pose en rénovation, 20% sur les fournitures seules et le neuf",
  prestationsExemples: [
    "Pose fenêtres PVC double vitrage",
    "Fabrication escalier bois sur mesure",
    "Installation porte d'entrée",
    "Aménagement placard",
    "Pose parquet massif",
  ],
  keywordPrincipal: "logiciel devis menuisier",
  specificite:
    "Séparez facilement fournitures et main d'œuvre sur vos devis, avec le bon taux de TVA pour chaque ligne.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
