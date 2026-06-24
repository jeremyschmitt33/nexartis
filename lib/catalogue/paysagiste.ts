import type { CatalogueItem } from './types'

export const paysagiste: CatalogueItem[] = [
  // --- Étude et préparation de terrain ---
  { designation: "Conception de plan d'aménagement paysager", unite: 'Fft', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Préparation et nettoyage de terrain", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Décapage de terre végétale", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Nivellement et terrassement de terrain", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Fourniture et épandage de terre végétale", unite: 'm²', tva: 20, categorie: 'ouvrages' },

  // --- Engazonnement et pelouses ---
  { designation: "Engazonnement par semis", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de gazon en rouleau", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de gazon synthétique", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Regarnissage de pelouse", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },

  // --- Plantations ---
  { designation: "Plantation de haie", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Plantation d'arbustes", unite: 'U', tva: 20, categorie: 'ouvrages' },
  { designation: "Plantation d'arbre de haute tige", unite: 'U', tva: 20, categorie: 'ouvrages' },
  { designation: "Création de massif fleuri", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Plantation de couvre-sol", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de paillage", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de toile géotextile", unite: 'm²', tva: 20, categorie: 'ouvrages' },

  // --- Arrosage ---
  { designation: "Installation d'arrosage automatique enterré", unite: 'Fft', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de goutte à goutte", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de programmateur d'arrosage", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // --- Terrasses et sols ---
  { designation: "Fourniture et pose de terrasse en bois", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de terrasse en composite", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de dallage sur plots", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Réalisation d'un pavage", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Réalisation d'une allée gravillonnée", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de pas japonais", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // --- Bordures et délimitations ---
  { designation: "Fourniture et pose de bordure béton", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de bordurette de jardin", unite: 'ml', tva: 20, categorie: 'ouvrages' },

  // --- Clôture et portail ---
  { designation: "Fourniture et pose de clôture grillagée", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de clôture en panneaux rigides", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de brise-vue", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de portail de jardin", unite: 'U', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de portillon", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // --- Maçonnerie paysagère ---
  { designation: "Réalisation d'un mur de soutènement", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Réalisation d'un muret de jardin", unite: 'ml', tva: 20, categorie: 'ouvrages' },
  { designation: "Mise en place d'enrochement", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Création d'un bassin de jardin", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // --- Éclairage extérieur ---
  { designation: "Fourniture et pose d'éclairage extérieur de jardin", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // --- Entretien des espaces verts ---
  { designation: "Tonte de pelouse", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Taille de haie", unite: 'ml', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Taille d'arbuste", unite: 'U', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Élagage d'arbre", unite: 'U', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Abattage d'arbre", unite: 'U', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Dessouchage", unite: 'U', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Débroussaillage de terrain", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Désherbage de massif et allée", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Scarification de pelouse", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Ramassage et évacuation de feuilles", unite: 'm²', tva: 20, categorie: 'main_oeuvre' },
  { designation: "Contrat d'entretien annuel d'espaces verts", unite: 'Fft', tva: 20, categorie: 'main_oeuvre' },

  // --- Fournitures végétales ---
  { designation: "Fourniture de plants et végétaux", unite: 'Fft', tva: 20, categorie: 'fournitures' },
  { designation: "Fourniture de gravier décoratif", unite: 'kg', tva: 20, categorie: 'fournitures' },
]
