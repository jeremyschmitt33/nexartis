/**
 * Types partagés pour le template LOCAL V4 Édition Signature.
 * Les pages locales (Bordeaux, Lyon, Marseille, etc.) sont des articles
 * éditoriaux centrés sur une ville et sa réalité BTP.
 */

export interface LocalPageProps {
  // Identification ville
  ville: string;
  region: string;
  codePostal: string;

  // Hero
  h1: string;
  metaTitle?: string;
  metaDescription?: string;
  specificite: string;

  // Témoignage (legacy, peut être omis dans le nouveau template)
  temoignage?: {
    quote: string;
    nom: string;
    metier: string;
    ville: string;
  };

  // Sections article
  longueIntro?: string;
  particularitesLocales?: string[];
  metiersDominants?: string[];

  // Cas d'usage : scène narrative concrète à la ville
  casUsage?: { titre: string; scene: string } | string;

  // Mots-clés secondaires (chips en bas d'intro)
  motsClesSecondaires?: string[];

  // FAQ custom
  faqCustom?: { question: string; answer: string }[];

  // Liens de maillage
  ancresMaillage?: { href: string; label: string }[];

  // Données pour le schema LocalBusiness (Place + AreaServed)
  // Optionnel : si absent, fallback sur le siège Le Haillan
  coordinatesGeo?: { latitude: number; longitude: number };
}

export type TocItem = { id: string; label: string };

/**
 * Sections du template LOCAL — ordre d'affichage.
 */
export const LOCAL_SECTIONS: TocItem[] = [
  { id: "introduction", label: "Introduction" },
  { id: "particularites", label: "Particularités locales" },
  { id: "metiers", label: "Métiers dominants" },
  { id: "cas-usage", label: "Cas d'usage concret" },
  { id: "tarifs", label: "Tarifs & abonnement" },
  { id: "faq", label: "Questions fréquentes" },
  { id: "ressources", label: "Voir aussi" },
];
