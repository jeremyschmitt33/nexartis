import { Metadata } from "next";
import LocalPageTemplate from "@/components/LocalPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Artisan Lyon — Nexartis | dès 15€/mois",
  description:
    "Nexartis pour les artisans de Lyon et du Rhône. Devis, factures, planning intelligent. dès 15€/mois. Essai gratuit.",
  alternates: {
    canonical: '/logiciel-artisan-lyon',
  },
};

const data = {
  ville: "Lyon",
  region: "Rhône",
  codePostal: "69",
  h1: "Logiciel artisan à Lyon — Devis, factures et planning",
  metaTitle: "Logiciel Artisan Lyon — Nexartis | dès 15€/mois",
  metaDescription:
    "Nexartis pour les artisans de Lyon et du Rhône. Devis, factures, planning intelligent. dès 15€/mois. Essai gratuit.",
  specificite:
    "De nombreux artisans lyonnais utilisent déjà Nexartis pour gérer leurs chantiers dans toute la métropole.",
  temoignage: {
    quote:
      "Je gère 3 chantiers en parallèle dans la métropole lyonnaise. Avec le planning d'Nexartis, je ne me trompe plus jamais d'affectation.",
    nom: "Sylvain D.",
    metier: "Maçon",
    ville: "Lyon (69)",
  },
};

export default function Page() {
  return <LocalPageTemplate {...data} />;
}
