import type { CatalogueItem } from './types'

export const serrurier: CatalogueItem[] = [
  // Dépannage et ouverture
  { designation: "Ouverture de porte claquée sans dégât", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Ouverture de porte fermée à clé", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Ouverture de porte blindée", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Dépannage serrurerie d'urgence", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Extraction d'une clé cassée dans la serrure", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réglage et entretien d'une serrure existante", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Dépose
  { designation: "Dépose d'une ancienne serrure", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'une porte existante", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Évacuation et recyclage du matériel déposé", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // Serrures et cylindres
  { designation: "Fourniture et pose d'une serrure en applique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une serrure à encastrer", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une serrure multipoints", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une serrure carénée multipoints", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un cylindre de serrure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un cylindre haute sécurité", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement d'un barillet de serrure", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en passe d'un ensemble de cylindres", unite: 'ens', tva: 10, categorie: 'ouvrages' },
  { designation: "Reproduction de clés", unite: 'U', tva: 10, categorie: 'fournitures' },

  // Verrous et points de fermeture
  { designation: "Fourniture et pose d'un verrou de sûreté", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un verrou à bouton et clé", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de cornières anti-pince", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de paumelles renforcées", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Blindage et portes de sécurité
  { designation: "Fourniture et pose d'une porte blindée", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Blindage d'une porte existante par tôle acier", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un bloc-porte blindé", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Renforcement d'un encadrement de porte", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Contrôle d'accès
  { designation: "Fourniture et pose d'une gâche électrique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un ferme-porte hydraulique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un digicode", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une serrure connectée", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une ventouse électromagnétique", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Protection des ouvertures
  { designation: "Fourniture et pose d'une grille de défense", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de barreaux de fenêtre", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un rideau métallique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Motorisation d'un rideau métallique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réparation d'un rideau métallique", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Ferronnerie et métallerie
  { designation: "Fourniture et pose d'un garde-corps métallique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une rampe d'escalier métallique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un portail métallique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un portillon métallique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une clôture métallique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Motorisation d'un portail battant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Motorisation d'un portail coulissant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Réparation et réglage d'un portail existant", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Coffres
  { designation: "Fourniture et pose d'un coffre-fort", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Ouverture d'un coffre-fort", unite: 'Fft', tva: 10, categorie: 'ouvrages' },

  // Divers
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
  { designation: "Main d'oeuvre serrurerie en régie", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
]
