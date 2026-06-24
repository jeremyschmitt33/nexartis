import type { CatalogueItem } from './types'

export const peintre: CatalogueItem[] = [
  // Préparation des supports
  { designation: "Protection des sols et mobilier par bâche plastique", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Protection des plinthes et menuiseries par adhésif de masquage", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Lessivage et dégraissage des murs avant peinture", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Lessivage des plafonds avant peinture", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Égrenage et ponçage léger des supports", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Grattage et brossage des anciennes peintures écaillées", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Réparation de fissures par calicot et enduit", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Rebouchage des trous et saignées à l'enduit", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Application d'enduit de rebouchage sur murs", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'enduit de lissage sur murs", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'enduit de lissage sur plafonds", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Ratissage complet des murs à l'enduit de finition", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Ponçage des enduits avant mise en peinture", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépoussiérage des supports après ponçage", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // Sous-couches et impressions
  { designation: "Application d'une sous-couche d'accrochage sur murs", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'une sous-couche d'accrochage sur plafonds", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'une impression fixante sur supports poreux", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'une sous-couche sur boiseries", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Peinture murs et plafonds
  { designation: "Peinture acrylique mate sur murs en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture acrylique satinée sur murs en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture velours sur murs en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture mate sur plafonds en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture spécifique pièces humides sur murs", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'une couche supplémentaire de peinture murale", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de bandes de couleur et raccords", unite: 'ml', tva: 10, categorie: 'main_oeuvre' },

  // Boiseries et menuiseries
  { designation: "Peinture laquée sur portes en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture laquée sur plinthes", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture des huisseries et chambranles", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en peinture des fenêtres bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture laquée sur radiateurs", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Vernis ou lasure sur boiseries intérieures", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Revêtements muraux
  { designation: "Pose de toile de verre à peindre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Mise en peinture de toile de verre", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de papier peint", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de papier peint intissé", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Pose de frise et bordure décorative", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Dépose d'ancien papier peint", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Dépose d'ancien revêtement mural et préparation", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },

  // Décoration et finitions
  { designation: "Application d'un enduit décoratif à effet", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'un béton ciré mural", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Réalisation de patines décoratives", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Traitements
  { designation: "Traitement anti-humidité et anti-salpêtre des murs", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Traitement anti-moisissures des supports", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'une peinture anti-condensation", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Extérieur
  { designation: "Nettoyage haute pression de façade", unite: 'm²', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Application d'un fixateur de façade", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture de façade en deux couches", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Application d'un revêtement d'imperméabilisation de façade", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture de portail et grille métallique", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture antirouille sur ferronnerie", unite: 'm²', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture de volets bois", unite: 'U', tva: 10, categorie: 'ouvrages' },
  { designation: "Peinture de clôture et barrière bois", unite: 'ml', tva: 10, categorie: 'ouvrages' },
  { designation: "Lasure de bardage bois extérieur", unite: 'm²', tva: 10, categorie: 'ouvrages' },

  // Divers
  { designation: "Nettoyage et évacuation des déchets de chantier", unite: 'Fft', tva: 10, categorie: 'main_oeuvre' },
  { designation: "Forfait déplacement", unite: 'Fft', tva: 10, categorie: 'deplacements' },
  { designation: "Main d'oeuvre peinture en régie", unite: 'h', tva: 10, categorie: 'main_oeuvre' },
]
