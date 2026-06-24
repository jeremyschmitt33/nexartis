import type { CatalogueItem } from './types'

export const plaquiste: CatalogueItem[] = [
  // --- Cloisons ---
  { designation: "Fourniture et pose de cloison BA13 sur ossature métallique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison BA13 hydrofuge", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison BA13 phonique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison coupe-feu", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison double peau", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison alvéolaire", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Doublages ---
  { designation: "Fourniture et pose de doublage collé", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de doublage sur ossature métallique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de doublage thermo-acoustique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de contre-cloison sur rail", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Ossatures ---
  { designation: "Pose d'ossature métallique de cloison", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Pose de rails et montants pour doublage", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réalisation de renfort d'ossature pour charge lourde", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Plafonds ---
  { designation: "Fourniture et pose de faux plafond en plaque de plâtre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plafond suspendu sur ossature", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plafond démontable en dalles", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plafond rampant sous toiture", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de retombée de plafond", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de plénum technique avec trappe", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Isolation (rénovation énergétique : TVA 5.5) ---
  { designation: "Fourniture et pose d'isolation en laine de verre", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'isolation en laine de roche", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'isolant biosourcé en cloison", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'isolation thermique de plafond", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de complexe isolant de doublage", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Pose de membrane pare-vapeur", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },

  // --- Bandes & finitions ---
  { designation: "Réalisation de bandes à joints et enduit", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'enduit de finition prêt à peindre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Traitement des angles avec baguette d'angle", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de bande de renfort sur jonction", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Ponçage de finition avant peinture", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Habillages & coffrages ---
  { designation: "Réalisation de coffrage en plaque de plâtre", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de gaine technique verticale", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Habillage de poutre ou IPN en placo", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de niche ou tablette en placo", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Habillage de conduit de cheminée en plaque coupe-feu", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'arrondi ou courbe en plaque de plâtre", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Accessoires ---
  { designation: "Fourniture et pose de trappe de visite", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Création d'ouverture et habillage de baie", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de bloc-porte sur cloison", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Renfort et réservation pour meuble suspendu", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // --- Dépose ---
  { designation: "Dépose de cloison en plaque de plâtre", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de faux plafond existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de doublage existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Divers ---
  { designation: "Évacuation et mise en décharge des déchets de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Nettoyage et repli de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Main d'oeuvre plaquiste (taux horaire)", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
