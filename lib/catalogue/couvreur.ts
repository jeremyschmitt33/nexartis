import type { CatalogueItem } from './types'

export const couvreur: CatalogueItem[] = [
  // --- Dépose et préparation ---
  { designation: "Dépose de couverture existante", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de gouttières et descentes", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de fenêtre de toit", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Mise en place de protection de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Écran et liteaunage ---
  { designation: "Fourniture et pose d'écran sous-toiture HPV", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de liteaunage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de contre-lattage", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Couverture tuiles ---
  { designation: "Couverture en tuiles mécaniques", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Couverture en tuiles plates", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Couverture en tuiles canal", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de tuiles à emboîtement", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement de tuiles cassées", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Couverture ardoises ---
  { designation: "Couverture en ardoises naturelles", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Couverture en ardoises fibres-ciment", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement d'ardoises avec crochets", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Bac acier et zinc ---
  { designation: "Couverture en bac acier", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Couverture en panneaux sandwich isolés", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Couverture en zinc à joint debout", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de bardage zinc", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Faîtage, arêtier, noue, rives ---
  { designation: "Fourniture et pose de faîtage", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de closoir ventilé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'arêtier", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Façonnage et pose de noue en zinc", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de rive", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de tuiles de rive", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Solins, bandeaux, abergements ---
  { designation: "Fourniture et pose de solin en zinc", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'un solin au mortier", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de bandeau de rive", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'un abergement de souche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de chatière de ventilation", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Évacuation des eaux pluviales ---
  { designation: "Fourniture et pose de gouttière zinc", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de gouttière PVC", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de gouttière aluminium", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de descente d'eaux pluviales", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de naissance et coude", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de dauphin fonte", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Fenêtres de toit ---
  { designation: "Fourniture et pose de fenêtre de toit", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de raccord d'étanchéité Velux", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de châssis de désenfumage", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Isolation sous toiture (rénovation énergétique) ---
  { designation: "Isolation thermique sous toiture par l'extérieur", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Isolation de combles aménagés sous rampants", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de sarking", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },

  // --- Étanchéité toiture-terrasse ---
  { designation: "Étanchéité de toiture-terrasse en membrane EPDM", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Étanchéité bicouche soudée au chalumeau", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de relevé d'étanchéité", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Entretien et réparation ---
  { designation: "Démoussage et traitement hydrofuge de toiture", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Nettoyage de toiture haute pression", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Nettoyage de gouttières et chéneaux", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Recherche et réparation de fuite", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réfection complète de toiture", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Fournitures seules ---
  { designation: "Fourniture de tuiles", unite: 'U', tva: 10, categorie: 'fournitures' },
  { designation: "Fourniture d'ardoises", unite: 'U', tva: 10, categorie: 'fournitures' },
]
