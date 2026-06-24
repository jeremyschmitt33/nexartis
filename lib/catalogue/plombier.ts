import type { CatalogueItem } from './types'

export const plombier: CatalogueItem[] = [
  // --- Alimentation (réseau d'eau) ---
  { designation: "Fourniture et pose de tuyauterie cuivre pour alimentation eau", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de canalisation PER pour alimentation eau", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de canalisation multicouche", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une nourrice de distribution PER", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une colonne montante d'alimentation", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un robinet d'arrêt général", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un réducteur de pression", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un clapet anti-retour", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de calorifuge sur canalisation", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Évacuation ---
  { designation: "Fourniture et pose de canalisation d'évacuation PVC Ø40", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de canalisation d'évacuation PVC Ø100", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un siphon", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une ventilation primaire de chute", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Raccordement aux évacuations existantes", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- WC ---
  { designation: "Fourniture et pose d'un WC à poser avec réservoir", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un WC suspendu avec bâti-support", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un WC lave-mains intégré", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un broyeur sanitaire", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement d'un mécanisme de chasse d'eau", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Lavabo / vasque ---
  { designation: "Fourniture et pose d'un lavabo sur colonne", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une vasque sur plan", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un meuble vasque", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un évier de cuisine", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Douche / receveur / baignoire ---
  { designation: "Fourniture et pose d'un receveur de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une douche à l'italienne", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une paroi de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une colonne de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une baignoire", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un tablier de baignoire", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Robinetterie / mitigeurs ---
  { designation: "Fourniture et pose d'un mitigeur de lavabo", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un mitigeur de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un mitigeur thermostatique de douche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un mitigeur de cuisine", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un robinet de machine à laver", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Production eau chaude ---
  { designation: "Fourniture et pose d'un chauffe-eau électrique 200L", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un chauffe-eau thermodynamique", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un groupe de sécurité de chauffe-eau", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Détartrage et entretien d'un chauffe-eau", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Traitement de l'eau ---
  { designation: "Fourniture et pose d'un adoucisseur d'eau", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un filtre anti-impuretés", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Raccordements électroménager ---
  { designation: "Raccordement d'un lave-linge", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Raccordement d'un lave-vaisselle", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Dépannage / interventions ---
  { designation: "Recherche de fuite d'eau", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réparation d'une fuite sur canalisation", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Débouchage de canalisation", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Remplacement d'un joint de robinetterie", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Dépose & main d'oeuvre ---
  { designation: "Dépose d'un appareil sanitaire (WC, lavabo, baignoire)", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'un chauffe-eau existant", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose et évacuation d'une ancienne salle de bains", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réalisation de saignée pour passage de canalisations", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Heure de main d'oeuvre plombier", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Journée de main d'oeuvre plombier", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Frais de déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
