import type { CatalogueItem } from './types'

export const terrassier: CatalogueItem[] = [
  // --- Préparation & implantation ---
  { designation: "Implantation et piquetage du terrain", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Débroussaillage et nettoyage du terrain", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Abattage et dessouchage d'arbre", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Décapage de la terre végétale", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en stock de la terre végétale sur site", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Déblai / remblai ---
  { designation: "Réalisation de déblai en pleine masse", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de remblai et compactage", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Apport et mise en oeuvre de remblai d'apport", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de remblai en gros béton", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Réglage et compactage de fond de forme", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Fouilles & fondations ---
  { designation: "Réalisation de fouille en rigole pour fondations", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de fouille en pleine masse pour sous-sol", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de fouille en puits", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de fouille pour fosse ou cuve", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Blindage et étaiement de fouille", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Tranchées & réseaux (VRD) ---
  { designation: "Réalisation de tranchée pour réseaux secs", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de tranchée pour réseaux humides", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de tranchée pour adduction d'eau", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de fourreaux et grillage avertisseur", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de lit de pose et enrobage sable", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Remblaiement et compactage de tranchée", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de regard de visite béton", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de canalisation d'évacuation eaux usées", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Assainissement & drainage ---
  { designation: "Réalisation de drainage périphérique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de drain agricole avec géotextile", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de tranchée drainante", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de puits d'infiltration", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de fosse toutes eaux", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'épandage pour assainissement", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // --- Plateformes & empierrement ---
  { designation: "Réalisation de plateforme stabilisée", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'empierrement en grave concassée", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en oeuvre de couche de forme en grave", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de nivellement et réglage de plateforme", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de géotextile anti-contaminant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation d'accès et chemin d'accès empierré", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Voirie & finitions extérieures ---
  { designation: "Pose de bordure béton préfabriquée", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de caniveau béton", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de cour en grave bitume", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de talus et modelage de terrain", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // --- Évacuation ---
  { designation: "Évacuation et mise en décharge des terres excédentaires", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Évacuation et mise en décharge des gravats", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Chargement et transport des déblais", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Locations & moyens ---
  { designation: "Location de mini-pelle avec chauffeur", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Location de pelle mécanique avec chauffeur", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Location de camion-benne", unite: 'j', tva: 10, categorie: 'fournitures' },
  { designation: "Location de compacteur ou plaque vibrante", unite: 'j', tva: 10, categorie: 'fournitures' },
  { designation: "Amenée et repli d'engin de chantier", unite: 'Fft', tva: 10, categorie: 'deplacements' },

  // --- Divers ---
  { designation: "Nettoyage et remise en état du terrain", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Main d'oeuvre terrassier (taux horaire)", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
