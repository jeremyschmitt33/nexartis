import type { CatalogueItem } from './types'

export const macon: CatalogueItem[] = [
  // --- Terrassement & fondations ---
  { designation: "Implantation et traçage de l'ouvrage", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réalisation de fouilles en rigole pour fondations", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de semelle filante en béton armé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de plot de fondation béton", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Coulage de béton de propreté", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Dallage & chape ---
  { designation: "Réalisation de dalle béton armé sur terre-plein", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en place de hérisson et film polyane", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de chape de ravoirage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de chape liquide autonivelante", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de dalle béton désactivé extérieure", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de dalle béton balayé", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Maçonnerie en élévation ---
  { designation: "Fourniture et pose de mur en parpaing de 20", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de mur en parpaing de 15", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cloison en carreaux de plâtre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de mur en brique creuse", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de mur en brique monomur", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de mur en pierre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Montage de muret de clôture en parpaing", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Béton armé : structure ---
  { designation: "Réalisation de chaînage horizontal en béton armé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de chaînage vertical (poteau) en béton armé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de poutre béton armé", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de coffrage bois traditionnel", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et mise en oeuvre de ferraillage", unite: 'kg', tva: 10, categorie: 'fournitures' },
  { designation: "Fourniture et pose de prédalle béton", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de plancher hourdis béton", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Ouvertures ---
  { designation: "Ouverture dans mur porteur avec pose de linteau IPN", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de linteau béton préfabriqué", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Création d'ouverture dans cloison non porteuse", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de seuil de porte béton", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'appui de fenêtre", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose d'étaiement provisoire avant ouverture", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Enduits & finitions ---
  { designation: "Réalisation d'enduit de façade taloché", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'enduit de façade gratté", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'enduit monocouche projeté", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de gobetis d'accrochage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'enduit de dressage intérieur", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Jointoiement de mur en pierre", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Escaliers & terrasses ---
  { designation: "Réalisation d'escalier béton avec coffrage", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de terrasse béton sur vide sanitaire", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de margelle de terrasse", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de chape de pente terrasse", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Reprises & réparations ---
  { designation: "Traitement et reprise de fissure structurelle", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de rebouchage et calfeutrement", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Reprise de maçonnerie en sous-oeuvre", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Scellement d'élément (poteau, platine, gond)", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de scellement chimique", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Démolition & dépose ---
  { designation: "Démolition de cloison non porteuse", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Démolition de mur porteur", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Piquage d'enduit existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Démolition de dalle béton existante", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // --- Nettoyage & divers ---
  { designation: "Évacuation et mise en décharge des gravats", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Location et mise en place de benne à gravats", unite: 'U', tva: 10, categorie: 'fournitures' },
  { designation: "Nettoyage et repli de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Main d'oeuvre maçon (taux horaire)", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
