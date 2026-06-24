import type { CatalogueItem } from './types'

export const charpentier: CatalogueItem[] = [
  // --- Dépose et préparation ---
  { designation: "Dépose de charpente existante", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose de plancher bois", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Étude et plan d'exécution de charpente", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Charpente traditionnelle ---
  { designation: "Charpente traditionnelle en bois massif", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de fermes traditionnelles", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de pannes", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de chevrons", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de voliges", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de sablière", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'entrait", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Fermettes industrielles ---
  { designation: "Charpente en fermettes industrielles", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de fermettes", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Contreventement de charpente fermette", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // --- Ossature et structure bois ---
  { designation: "Mur à ossature bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de poutre porteuse", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de poutre lamellé-collé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de poteau bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'un solivage bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de solives", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Planchers et lambris ---
  { designation: "Fourniture et pose de plancher bois massif", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plancher OSB", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plancher de combles", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de lambris bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plafond à la française", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Renforcement et réparation ---
  { designation: "Renforcement de charpente existante", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement de pièce de charpente", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réparation de tête de poutre par greffe", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de moises de renfort", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Remise à niveau de plancher", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Traitement du bois ---
  { designation: "Traitement de charpente contre insectes xylophages", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Traitement curatif contre les termites", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Traitement préventif fongicide et insecticide", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Application de lasure ou saturateur sur bois", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Escaliers ---
  { designation: "Fourniture et pose d'escalier bois droit", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'escalier quart tournant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fabrication d'escalier sur mesure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de garde-corps bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Abris, carports, terrasses, pergolas ---
  { designation: "Fourniture et pose de carport bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'abri de jardin bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de pergola bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Structure bois d'auvent", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fabrication de structure terrasse sur pilotis", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Bardage et habillage ---
  { designation: "Fourniture et pose de bardage bois", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de tasseaux pour bardage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Habillage de débord de toiture", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Isolation associée ---
  { designation: "Isolation de mur ossature bois", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },

  // --- Levage et fournitures ---
  { designation: "Levage et mise en oeuvre de charpente", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Fourniture de bois de charpente", unite: 'Fft', tva: 10, categorie: 'fournitures' },
  { designation: "Fourniture de quincaillerie et connecteurs", unite: 'Fft', tva: 10, categorie: 'fournitures' },
]
