import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Électricien — Nexartis | dès 15€/mois",
  description:
    "Créez vos devis électricité en quelques minutes. Normes NF C 15-100 intégrées. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-electricien',
  },
};

const data = {
  nom: "Électricien",
  nomPluriel: "Électriciens",
  icon: "⚡",
  h1: "Logiciel devis et factures pour électriciens",
  metaTitle: "Logiciel Devis Électricien — Nexartis | dès 15€/mois",
  metaDescription:
    "Créez vos devis électricité en quelques minutes. Normes NF C 15-100 intégrées. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 10% sur la rénovation, 5.5% sur les travaux d'économie d'énergie (panneaux solaires, bornes de recharge), 20% sur le neuf",
  prestationsExemples: [
    "Mise aux normes tableau électrique",
    "Installation prises et interrupteurs",
    "Pose borne de recharge véhicule",
    "Câblage réseau informatique",
    "Installation VMC",
  ],
  keywordPrincipal: "logiciel devis électricien",
  specificite:
    "Nexartis inclut les mentions obligatoires liées aux normes électriques NF C 15-100.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
