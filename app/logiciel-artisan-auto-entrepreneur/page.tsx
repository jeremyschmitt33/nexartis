import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Auto-Entrepreneur Artisan — Nexartis | dès 15€/mois",
  description:
    "Le logiciel le moins cher pour les auto-entrepreneurs du bâtiment. Devis, factures, planning. dès 15€/mois. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-artisan-auto-entrepreneur',
  },
};

const data = {
  nom: "Auto-entrepreneur",
  nomPluriel: "Auto-entrepreneurs",
  icon: "👷",
  h1: "Logiciel devis et factures pour auto-entrepreneurs du bâtiment",
  metaTitle:
    "Logiciel Auto-Entrepreneur Artisan — Nexartis | dès 15€/mois",
  metaDescription:
    "Le logiciel le moins cher pour les auto-entrepreneurs du bâtiment. Devis, factures, planning. dès 15€/mois. Essai gratuit.",
  tvaNotes:
    "En franchise de TVA (mention obligatoire sur les factures). Nexartis ajoute automatiquement la mention 'TVA non applicable, art. 293 B du CGI'.",
  prestationsExemples: [
    "Petits travaux de rénovation",
    "Dépannage et réparation",
    "Pose et installation",
    "Entretien et maintenance",
    "Travaux de finition",
  ],
  keywordPrincipal: "logiciel auto-entrepreneur bâtiment",
  specificite:
    "La mention de franchise de TVA est ajoutée automatiquement sur tous vos documents. Vous ne risquez aucune erreur.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
