import { Metadata } from "next";
import LocalPageTemplate from "@/components/LocalPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Artisan Bordeaux — Nexartis | Fait en Gironde | dès 15€/mois",
  description:
    "Nexartis, le logiciel artisan créé à Bordeaux. Devis, factures, planning pour les artisans de Gironde. dès 15€/mois.",
  alternates: {
    canonical: '/logiciel-artisan-bordeaux',
  },
};

const data = {
  ville: "Bordeaux",
  region: "Gironde",
  codePostal: "33",
  h1: "Logiciel artisan à Bordeaux — Nexartis, fait en Gironde",
  metaTitle:
    "Logiciel Artisan Bordeaux — Nexartis | Fait en Gironde | dès 15€/mois",
  metaDescription:
    "Nexartis, le logiciel artisan créé à Bordeaux. Devis, factures, planning pour les artisans de Gironde. dès 15€/mois.",
  specificite:
    "Nexartis est né à Bordeaux, en Gironde. Notre équipe est ici, et nous comprenons les besoins des artisans locaux.",
  temoignage: {
    quote:
      "Un outil conçu localement, qui comprend la réalité de notre métier. Je crée mes devis directement depuis mon véhicule, et le résultat est professionnel.",
    nom: "Pierre M.",
    metier: "Plombier",
    ville: "Bordeaux (33)",
  },
};

export default function Page() {
  return <LocalPageTemplate {...data} />;
}
