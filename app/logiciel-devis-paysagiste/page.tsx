import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Paysagiste — Nexartis | 25€/mois tout inclus",
  description:
    "Créez vos devis paysagisme et entretien espaces verts en quelques minutes. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-paysagiste',
  },
};

const data = {
  nom: "Paysagiste",
  nomPluriel: "Paysagistes",
  icon: "🌿",
  h1: "Logiciel devis et factures pour paysagistes",
  metaTitle: "Logiciel Devis Paysagiste — Nexartis | 25€/mois tout inclus",
  metaDescription:
    "Créez vos devis paysagisme et entretien espaces verts en quelques minutes. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 20% sur l'aménagement paysager et l'entretien. TVA 10% possible pour les travaux liés à l'habitation.",
  prestationsExemples: [
    "Création jardin paysager",
    "Pose clôture et portail",
    "Tonte et entretien mensuel",
    "Plantation haie",
    "Aménagement terrasse bois",
  ],
  keywordPrincipal: "logiciel devis paysagiste",
  specificite:
    "Créez des contrats d'entretien récurrents et générez automatiquement les factures chaque mois.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
