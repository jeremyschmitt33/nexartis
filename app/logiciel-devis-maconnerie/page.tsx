import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Maçon — Nexartis | dès 15€/mois",
  description:
    "Créez vos devis maçonnerie en quelques minutes. Gestion des situations de travaux. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-maconnerie',
  },
};

const data = {
  nom: "Maçon",
  nomPluriel: "Maçons",
  icon: "🧱",
  h1: "Logiciel devis et factures pour maçons",
  metaTitle: "Logiciel Devis Maçon — Nexartis | dès 15€/mois",
  metaDescription:
    "Créez vos devis maçonnerie en quelques minutes. Gestion des situations de travaux. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 10% sur la rénovation, 20% sur la construction neuve. Nexartis gère les deux automatiquement.",
  prestationsExemples: [
    "Coulage dalle béton",
    "Montage murs parpaings",
    "Ouverture mur porteur (avec étude structure)",
    "Ravalement façade",
    "Construction extension",
  ],
  keywordPrincipal: "logiciel devis maçon",
  specificite:
    "Gérez facilement vos situations de travaux et acomptes pour les chantiers qui durent plusieurs semaines.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
