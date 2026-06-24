import type { CatalogueItem } from './types'

export const vitrier: CatalogueItem[] = [
  // Dépannage et remplacement
  { designation: "Remplacement d'une vitre cassée simple vitrage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement d'un vitrage cassé double vitrage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Dépannage d'urgence vitrage cassé", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Sécurisation provisoire par panneau de bois", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Prise de cotes et métré sur site", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // Dépose
  { designation: "Dépose d'un vitrage existant", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'un miroir mural", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Évacuation et recyclage du verre déposé", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // Vitrages
  { designation: "Fourniture et pose d'un double vitrage isolant", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un double vitrage à isolation renforcée", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vitrage feuilleté de sécurité", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vitrage trempé", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vitrage anti-effraction", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vitrage acoustique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un survitrage sur fenêtre existante", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vitrage dépoli ou sablé", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Miroirs
  { designation: "Fourniture et pose d'un miroir sur mesure", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un miroir avec biseau", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un miroir chauffant", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Façonnage et polissage de chants de miroir", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // Verre décoratif et aménagement
  { designation: "Fourniture et pose d'une crédence en verre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une crédence en verre laqué", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un plan de travail en verre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une table en verre sur mesure", unite: 'U', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une étagère en verre", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Verrière et cloisons
  { designation: "Fourniture et pose d'une verrière d'intérieur", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une cloison vitrée", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte vitrée", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une verrière d'atelier sur mesure", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Douche et salle de bain
  { designation: "Fourniture et pose d'une paroi de douche en verre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un pare-douche fixe", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une paroi de douche à l'italienne", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Garde-corps et sécurité
  { designation: "Fourniture et pose d'un garde-corps en verre", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un garde-corps verre et inox", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un panneau de balustrade en verre", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // Vitrines et commerces
  { designation: "Fourniture et pose d'une vitrine de magasin", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Remplacement d'un vitrage de vitrine", unite: 'm²', tva: 20, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une porte de vitrine en verre", unite: 'U', tva: 20, categorie: 'ouvrages' },

  // Films et traitements
  { designation: "Pose d'un film solaire anti-chaleur", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose d'un film dépoli décoratif", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose d'un film de sécurité anti-effraction", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose d'un film occultant ou miroir sans tain", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Finitions
  { designation: "Remplacement des joints d'étanchéité de vitrage", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Remplacement du mastic de vitrerie", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de profilés d'habillage", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Réglage et réparation de ferrures de vitrage", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // Divers
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
  { designation: "Main d'oeuvre vitrerie en régie", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
]
