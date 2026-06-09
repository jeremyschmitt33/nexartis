import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Devis Chauffagiste — Nexartis | dès 15€/mois",
  description:
    "Créez vos devis chauffage et climatisation en quelques minutes. TVA réduite automatique. Prêt pour Factur-X 2026. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-devis-chauffagiste',
  },
};

const data = {
  nom: "Chauffagiste",
  nomPluriel: "Chauffagistes",
  icon: "🔥",
  h1: "Logiciel devis et factures pour chauffagistes",
  metaTitle: "Logiciel Devis Chauffagiste — Nexartis | dès 15€/mois",
  metaDescription:
    "Créez vos devis chauffage et climatisation en quelques minutes. TVA réduite automatique. Prêt pour Factur-X 2026. Essai gratuit.",
  tvaNotes:
    "TVA 5.5% sur l'installation de pompe à chaleur et chaudière haute performance, 10% sur l'entretien, 20% sur le neuf",
  prestationsExemples: [
    "Installation pompe à chaleur air/eau",
    "Remplacement chaudière gaz condensation",
    "Pose plancher chauffant",
    "Entretien annuel chaudière",
    "Installation climatisation réversible",
  ],
  keywordPrincipal: "logiciel devis chauffagiste",
  specificite:
    "TVA 5.5% automatique sur les équipements de rénovation énergétique — plus besoin de calculer à la main.",
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
