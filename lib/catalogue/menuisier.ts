import type { CatalogueItem } from './types'

export const menuisier: CatalogueItem[] = [
  // Dépose
  { designation: "Dépose d'une ancienne fenêtre", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'une ancienne porte", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'un volet roulant", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'un ancien parquet", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Évacuation et recyclage des menuiseries déposées", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // Fenêtres (isolation thermique renforcée = 5.5)
  { designation: "Fourniture et pose d'une fenêtre PVC double vitrage isolant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une fenêtre aluminium double vitrage isolant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une fenêtre bois double vitrage isolant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte-fenêtre isolante", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une baie vitrée coulissante isolante", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une fenêtre de toit isolante", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Pose en rénovation sur dormant existant", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Volets (isolants = 5.5)
  { designation: "Fourniture et pose d'un volet roulant isolant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un volet battant aluminium", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un volet battant bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Motorisation d'un volet roulant existant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de stores intérieurs", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Portes intérieures
  { designation: "Fourniture et pose d'une porte intérieure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte coulissante à galandage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un bloc-porte avec huisserie", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte de placard coulissante", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réglage et ajustement d'une porte existante", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Portes extérieures et garage
  { designation: "Fourniture et pose d'une porte d'entrée", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte d'entrée isolante", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte de service", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte de garage sectionnelle", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte de garage basculante", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Motorisation d'une porte de garage", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Aménagement et mobilier sur mesure
  { designation: "Fabrication et pose d'un placard sur mesure", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fabrication et pose d'un dressing sur mesure", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fabrication et pose d'une bibliothèque sur mesure", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un plan de travail", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'étagères murales", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Habillage de tableaux et embrasures bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // Sols
  { designation: "Fourniture et pose de parquet flottant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de parquet massif collé", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de parquet contrecollé", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Ponçage et vitrification de parquet", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plinthes bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de seuils de porte", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de barres de seuil", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // Escaliers
  { designation: "Fourniture et pose d'un escalier bois sur mesure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Rénovation et habillage d'un escalier existant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une rampe d'escalier bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de garde-corps bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // Extérieur bois
  { designation: "Fourniture et pose d'une terrasse en bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une terrasse en lames composite", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une pergola bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un bardage bois extérieur", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un claustra bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un abri de jardin bois", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // Divers
  { designation: "Fourniture et pose d'une trappe de visite", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de quincaillerie et serrure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
  { designation: "Main d'oeuvre menuiserie en régie", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
]
