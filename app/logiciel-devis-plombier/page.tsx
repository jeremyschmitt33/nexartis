import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Plombier — Nexartis | dès 15€/mois",
  description:
    "Créez vos devis plomberie en quelques minutes. TVA 10% et 5.5% automatique. Prêt pour Factur-X 2026. Essai gratuit 14 jours.",
  alternates: {
    canonical: '/logiciel-devis-plombier',
  },
};

const data = {
  nom: "Plombier",
  nomPluriel: "Plombiers",
  icon: "🔧",
  h1: "Logiciel devis et factures pour plombiers",
  metaTitle: "Logiciel Devis Plombier — Nexartis | dès 15€/mois",
  metaDescription:
    "Créez vos devis plomberie en quelques minutes. TVA 10% et 5.5% automatique. Prêt pour Factur-X 2026. Essai gratuit 14 jours.",
  tvaNotes:
    "TVA 10% sur les travaux d'amélioration de l'habitat, 5.5% sur la rénovation énergétique, 20% sur le neuf",
  prestationsExemples: [
    "Installation chauffe-eau thermodynamique",
    "Remplacement robinetterie",
    "Débouchage canalisation",
    "Pose douche à l'italienne",
    "Réparation fuite",
  ],
  keywordPrincipal: "logiciel devis plombier",
  specificite:
    "Le logiciel gère automatiquement les 3 taux de TVA que vous utilisez le plus souvent.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
