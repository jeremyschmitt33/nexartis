import type { CatalogueItem } from './types'

export const chauffagiste: CatalogueItem[] = [
  // --- Chaudières ---
  { designation: "Fourniture et pose d'une chaudière gaz à condensation", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une chaudière gaz THPE", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une chaudière à granulés de bois", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un kit d'évacuation ventouse", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Raccordement gaz de la chaudière", unite: 'Fft', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en service et réglage de la chaudière", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Pompes à chaleur ---
  { designation: "Fourniture et pose d'une pompe à chaleur air/eau", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une pompe à chaleur air/air", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une unité intérieure de PAC air/air (split)", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un module hydraulique de PAC", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Réalisation de la liaison frigorifique", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en service et tirage au vide d'une PAC", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },

  // --- Radiateurs ---
  { designation: "Fourniture et pose d'un radiateur acier eau chaude", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un radiateur fonte eau chaude", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un radiateur sèche-serviette eau chaude", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un radiateur sèche-serviette électrique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un radiateur électrique à inertie", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une vanne thermostatique", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un robinet de radiateur et té de réglage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Dépose et repose d'un radiateur pour travaux", unite: 'U', tva: 10, categorie: 'main_oeuvre' },

  // --- Plancher chauffant ---
  { designation: "Fourniture et pose d'un plancher chauffant hydraulique", unite: 'm²', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un collecteur de plancher chauffant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une régulation de plancher chauffant", unite: 'U', tva: 5.5, categorie: 'ouvrages' },

  // --- Réseau hydraulique & accessoires ---
  { designation: "Fourniture et pose de tube cuivre pour réseau de chauffage", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de tube multicouche pour réseau de chauffage", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un vase d'expansion", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un circulateur de chauffage", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un ballon tampon", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un ballon d'eau chaude sanitaire", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un pot à boue magnétique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une bouteille de découplage hydraulique", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un groupe de sécurité", unite: 'U', tva: 10, categorie: 'ouvrages' },

  // --- Régulation / programmation ---
  { designation: "Fourniture et pose d'un thermostat d'ambiance programmable", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'un thermostat connecté", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une sonde extérieure et régulation climatique", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de têtes de robinet thermostatiques connectées", unite: 'U', tva: 5.5, categorie: 'ouvrages' },

  // --- Ventilation ---
  { designation: "Fourniture et pose d'une VMC simple flux", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Fourniture et pose d'une VMC double flux", unite: 'U', tva: 5.5, categorie: 'ouvrages' },
  { designation: "Fourniture et pose de réseau de gaines de VMC", unite: 'ml', tva: 10, categorie: 'ouvrages' },

  // --- Entretien & maintenance ---
  { designation: "Entretien annuel d'une chaudière gaz", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Entretien annuel d'une pompe à chaleur", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Désembouage du circuit de chauffage", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Purge et rééquilibrage du réseau de chauffage", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Recharge en fluide frigorigène", unite: 'kg', tva: 10, categorie: 'fournitures' },
  { designation: "Recherche et réparation de panne de chauffage", unite: 'h', tva: 10, categorie: 'main_oeuvre' },

  // --- Dépose & main d'oeuvre ---
  { designation: "Dépose et évacuation d'une ancienne chaudière", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'une cuve à fioul", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'un radiateur existant", unite: 'U', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Heure de main d'oeuvre chauffagiste", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Journée de main d'oeuvre chauffagiste", unite: 'j', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Frais de déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
]
