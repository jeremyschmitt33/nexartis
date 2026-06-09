/**
 * Types partagés pour le template métier V4.
 * Centralise les definitions des sous-composants Metier*.tsx.
 */

export interface MetierPageProps {
  // EXISTANTES (préserver pour rétrocompat des 13 data files)
  nom: string;
  nomPluriel: string;
  icon: string;
  h1: string;
  metaTitle?: string;
  metaDescription?: string;
  tvaNotes: string;
  prestationsExemples: string[];
  keywordPrincipal?: string;
  specificite: string;
  faqCustom?: { question: string; answer: string }[];
  motsClesSecondaires?: string[];
  longueIntro?: string;
  paragrapheTva?: string;
  certifications?: string[];
  ancresMaillage?: { href: string; label: string }[];

  // NOUVELLES props V4 (optionnelles, fallback intelligent)
  // casUsage : accepte soit la forme objet historique, soit une simple string narrative
  casUsage?: { titre: string; scene: string } | string;
  pointsFortsNexartis?: {
    titre: string;
    description: string;
    icone?: string;
  }[];
  prestationsDevisExemple?: {
    label: string;
    qty: number;
    unit: string;
    prixUnitaire: number;
    tvaRate: 5.5 | 10 | 20;
  }[];
  articlesConnexes?: {
    href: string;
    titre: string;
    description: string;
  }[];
  paragrapheConclusion?: string;

  // Props éditoriales additionnelles (vague Édition Signature)
  tableauTva?: { type: string; taux: string; conditions: string }[];
  reglementation2026?: string[];
  conseilsRedaction?: string[];
  graphConfig?: {
    type: "donut" | "bars";
    title: string;
    data: { label: string; value: number }[];
  };
}

export type TocItem = { id: string; label: string };

/**
 * Liste centralisée des sections du template (pour TOC + scrollspy).
 * Ordre = ordre d'affichage de la page.
 */
export const METIER_SECTIONS: TocItem[] = [
  { id: "introduction", label: "Introduction" },
  { id: "cas-usage", label: "Cas d'usage concret" },
  { id: "tva", label: "TVA & taux applicables" },
  { id: "devis-exemple", label: "Exemple de devis" },
  { id: "points-forts", label: "Pourquoi Nexartis" },
  { id: "tarifs", label: "Tarifs & abonnement" },
  { id: "faq", label: "Questions fréquentes" },
  { id: "ressources", label: "Voir aussi" },
];
