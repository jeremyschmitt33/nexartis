import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Peintre — Nexartis | 25€/mois tout inclus",
  description:
    "Créez vos devis peinture en quelques minutes. Calcul surfaces automatique. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-peintre',
  },
};

const data = {
  nom: "Peintre",
  nomPluriel: "Peintres",
  icon: "🎨",
  h1: "Logiciel devis et factures pour peintres en bâtiment",
  metaTitle: "Logiciel Devis Peintre — Nexartis | 25€/mois tout inclus",
  metaDescription:
    "Créez vos devis peinture en quelques minutes. Calcul surfaces automatique. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 10% sur les travaux de peinture en rénovation (logement de plus de 2 ans), 20% sur le neuf",
  prestationsExemples: [
    "Peinture intérieure 2 couches",
    "Ravalement façade",
    "Pose papier peint",
    "Traitement anti-humidité murs",
    "Laquage boiseries",
  ],
  keywordPrincipal: "logiciel devis peintre",
  specificite:
    "Décrivez vos prestations au m² et Nexartis calcule le total automatiquement.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
