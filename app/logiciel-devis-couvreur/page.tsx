import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Couvreur — Nexartis | 25€/mois tout inclus",
  description:
    "Créez vos devis couverture et toiture en quelques minutes. Situations de travaux incluses. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-couvreur',
  },
};

const data = {
  nom: "Couvreur",
  nomPluriel: "Couvreurs",
  icon: "🏠",
  h1: "Logiciel devis et factures pour couvreurs",
  metaTitle: "Logiciel Devis Couvreur — Nexartis | 25€/mois tout inclus",
  metaDescription:
    "Créez vos devis couverture et toiture en quelques minutes. Situations de travaux incluses. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 10% sur la rénovation de toiture, 5.5% sur l'isolation par la toiture (rénovation énergétique), 20% sur le neuf",
  prestationsExemples: [
    "Réfection couverture tuiles",
    "Remplacement gouttières zinc",
    "Pose velux / fenêtre de toit",
    "Traitement charpente",
    "Isolation sous toiture",
  ],
  keywordPrincipal: "logiciel devis couvreur",
  specificite:
    "Gérez les chantiers longs avec des situations de travaux et des factures d'acompte progressives.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
