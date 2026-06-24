import type { CatalogueItem } from './types'

export const carreleur: CatalogueItem[] = [
  // --- Préparation des supports ---
  { designation: "Réalisation de chape de ravoirage avant carrelage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de ragréage autolissant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application de primaire d'accroche", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de forme de pente avant carrelage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Ponçage et préparation du support existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Étanchéité ---
  { designation: "Réalisation de système d'étanchéité sous carrelage (SEL)", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de natte d'étanchéité et désolidarisation", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Traitement d'étanchéité des angles et relevés", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de bande d'étanchéité périphérique", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Carrelage sol ---
  { designation: "Fourniture et pose de carrelage sol grès cérame", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage sol grand format", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage sol en pose droite", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage sol en pose diagonale", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage imitation parquet", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage extérieur antidérapant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage sur plots", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de tomette en terre cuite", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Faïence & murs ---
  { designation: "Fourniture et pose de faïence murale", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de faïence murale grand format", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de crédence de cuisine carrelée", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de mosaïque", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de carrelage mural en pose métro", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de parement mural en pierre", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Finitions & accessoires ---
  { designation: "Fourniture et pose de plinthes carrelées", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de listel décoratif", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de profilé de finition (baguette)", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de nez de marche carrelé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de barre de seuil", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'habillage de marche d'escalier carrelé", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Joints ---
  { designation: "Réalisation de joints de carrelage au mortier", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de joints époxy", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de joints de fractionnement et de dilatation", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de joint silicone périphérique", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Pièces humides ---
  { designation: "Fourniture et pose de receveur de douche carrelé à l'italienne", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de douche à l'italienne avec pente et siphon", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Carrelage de paroi et fond de douche", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de caniveau de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Habillage carrelé de baignoire", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // --- Sols souples & complémentaires ---
  { designation: "Fourniture et pose de carrelage sur plancher chauffant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de calepinage et plan de pose", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Dépose & préparation ---
  { designation: "Dépose de carrelage sol existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de faïence murale existante", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de plinthes existantes", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Piquage et reprise de support après dépose", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Divers ---
  { designation: "Découpe et ajustement autour des réservations", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Évacuation et mise en décharge des gravats", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Nettoyage et repli de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Main d'oeuvre carreleur (taux horaire)", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
