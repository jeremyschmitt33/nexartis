import type { CatalogueItem } from './types'

export const electricien: CatalogueItem[] = [
  // --- Tableau électrique & protection ---
  { designation: "Fourniture et pose d'un tableau électrique pré-équipé", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement complet du tableau électrique aux normes NF C 15-100", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un disjoncteur divisionnaire 16A", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un disjoncteur divisionnaire 20A", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un disjoncteur divisionnaire 32A", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un interrupteur différentiel 40A type AC", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un interrupteur différentiel 63A type A", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un disjoncteur de branchement", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un parafoudre de tableau", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un contacteur jour/nuit", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un délesteur électrique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise à la terre de l'installation avec piquet et liaison équipotentielle", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // --- Points lumineux & éclairage ---
  { designation: "Fourniture et pose d'un point lumineux en simple allumage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un point lumineux commandé en va-et-vient", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un point lumineux double allumage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un point lumineux commandé par télérupteur", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un spot LED encastré", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une réglette LED étanche", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une applique murale", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un détecteur de mouvement", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un variateur de lumière", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un projecteur LED extérieur avec détecteur", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un bloc autonome d'éclairage de sécurité (BAES)", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Interrupteurs & commandes ---
  { designation: "Fourniture et pose d'un interrupteur simple", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un interrupteur va-et-vient", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un bouton poussoir", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un interrupteur va-et-vient supplémentaire", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une commande de volet roulant", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Prises ---
  { designation: "Fourniture et pose d'une prise de courant 16A 2P+T", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise spécialisée 20A", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise spécialisée 32A pour plaque de cuisson", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise réseau RJ45 catégorie 6", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise TV/coaxiale", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise USB encastrée", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise étanche extérieure IP44", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Câblage, gaines, saignées ---
  { designation: "Fourniture et pose de câble électrique sous gaine ICTA", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de gaine technique de logement (GTL)", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de saignée dans cloison pour passage de gaines", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Fourniture et pose de goulotte de distribution", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de plinthe électrique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Tirage de câble dans fourreau existant", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Fourniture et pose de chemin de câbles", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Mise en sécurité / aux normes ---
  { designation: "Mise en sécurité électrique du logement", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise aux normes de l'installation électrique existante", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Diagnostic électrique de l'installation existante", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Recherche et réparation de panne électrique", unite: 'h', tva: 10, categorie: 'main_oeuvre' },

  // --- Communication, interphonie, motorisation ---
  { designation: "Fourniture et pose d'un interphone audio", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un visiophone", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une motorisation de portail", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une motorisation de porte de garage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un coffret de communication (brassage)", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un thermostat connecté", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Borne de recharge IRVE ---
  { designation: "Fourniture et pose d'une borne de recharge IRVE 7,4 kW", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une prise renforcée type Green'Up", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Alimentation dédiée depuis le tableau pour borne de recharge", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // --- Dépose & main d'oeuvre ---
  { designation: "Dépose de l'ancien tableau électrique", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'appareillage électrique (prise, interrupteur, point lumineux)", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Heure de main d'oeuvre électricien", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Journée de main d'oeuvre électricien", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Frais de déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
