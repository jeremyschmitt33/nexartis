import type { CatalogueItem } from './types'

export const general: CatalogueItem[] = [
  // --- Déplacements ---
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
  { designation: "Frais kilométriques", unite: 'U', tva: 10, categorie: 'deplacements' },
  { designation: "Déplacement et diagnostic sur site", unite: 'Fft', tva: 10, categorie: 'deplacements' },

  // --- Main d'oeuvre ---
  { designation: "Main d'oeuvre", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Main d'oeuvre à la journée", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Aide ou manoeuvre à la journée", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Heure supplémentaire", unite: 'h', tva: 10, categorie: 'main_oeuvre' },

  // --- Installation et organisation de chantier ---
  { designation: "Installation et repli de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Protection et bâchage des surfaces", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Mise en sécurité et signalisation de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Locations de matériel ---
  { designation: "Location d'échafaudage", unite: 'j', tva: 10, categorie: 'fournitures' },
  { designation: "Location de nacelle élévatrice", unite: 'j', tva: 10, categorie: 'fournitures' },
  { designation: "Location de benne à gravats", unite: 'U', tva: 10, categorie: 'fournitures' },
  { designation: "Location de mini-pelle", unite: 'j', tva: 10, categorie: 'fournitures' },

  // --- Déchets et nettoyage ---
  { designation: "Évacuation et mise en décharge des déchets", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Tri et évacuation de gravats", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Nettoyage de fin de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Fournitures et études ---
  { designation: "Petites fournitures et consommables", unite: 'Fft', tva: 10, categorie: 'fournitures' },
  { designation: "Constat et établissement de diagnostic", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Étude technique et métrés", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Coordination et suivi de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Divers ---
  { designation: "Prestation forfaitaire", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Intervention de dépannage", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
]
