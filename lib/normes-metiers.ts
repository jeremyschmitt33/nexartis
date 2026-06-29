// ============================================================================
// lib/normes-metiers.ts
// ----------------------------------------------------------------------------
// Référentiel des normes par métier (outil interne de référence).
// Données compilées le 2026-06-29 à partir de recherches (5 agents) puis
// double-vérifiées par un agent challenger contre les sources officielles
// (AFNOR / norminfo, Legifrance, Service-Public, CSTB, ecologie.gouv.fr).
//
// ⚠️ INFORMATIF UNIQUEMENT : à recouper avec les textes officiels (AFNOR/CSTB
// pour les DTU/NF, Legifrance pour les textes réglementaires) avant tout usage
// contractuel. Les DTU étant payants, certains chiffres proviennent de sources
// techniques secondaires recoupées : ils sont marqués en confiance « moyenne ».
// ============================================================================

export const NORMES_MAJ = '29 juin 2026'

export type Confiance = 'haute' | 'moyenne'

export interface NormeFiche {
  reference: string
  intitule: string
  sapplique: string
  pointsCles: string[]
  chiffres?: string[]
  neufVsReno?: string
  version?: string
  source?: string
  confiance: Confiance
  note?: string
}

export interface MetierNormes {
  slug: string
  nom: string
  resume: string
  normes: NormeFiche[]
  transverses: string[]
}

export const NORMES_METIERS: MetierNormes[] = [
  // ======================================================================
  // ÉLECTRICIEN
  // ======================================================================
  {
    slug: 'electricien',
    nom: 'Électricien',
    resume: 'Installations basse tension, branchement, sécurité, IRVE, diagnostic.',
    normes: [
      {
        reference: 'NF C 15-100',
        intitule: 'Installations électriques à basse tension',
        sapplique: 'Neuf et rénovation totale (logements). LA norme de référence au quotidien.',
        pointsCles: [
          'Tout circuit protégé par un dispositif différentiel ≤ 30 mA.',
          'Mise à la terre + liaison équipotentielle obligatoires.',
          'Équipement minimum imposé pièce par pièce (prises, points lumineux).',
          'Tableau avec réserve d’emplacements libres pour extensions.',
          'Circuits spécialisés dédiés (four, plaque, lave-linge, lave-vaisselle).',
          'Repérage des circuits + schéma de l’installation obligatoires.',
        ],
        chiffres: [
          'Prises : 8 max en 1,5 mm²/16 A, ou 12 max en 2,5 mm²/20 A.',
          'Plaque de cuisson : circuit dédié 6 mm² + 32 A.',
          'Réserve tableau : 20 % d’emplacements libres minimum.',
          'Max 8 circuits par interrupteur différentiel ; min 2 différentiels.',
          'Parafoudre : seuil abaissé à 10 m (révision 2024) ; obligatoire en zone AQ2 (>2,5 impacts/km²/an), paratonnerre, ou ligne aérienne exposée.',
        ],
        neufVsReno: 'Intégralité imposée en neuf et rénovation totale. En réno partielle : exigences de sécurité minimales (terre, différentiel 30 mA) ; le diagnostic NF C 16-600 sert de référentiel sur l’existant.',
        version: 'Révision publiée le 23/08/2024 ; seule version obligatoire depuis le 01/09/2025 (recouvrement jusqu’au 23/08/2025). En vigueur en 2026.',
        source: 'https://www.boutique.afnor.org',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Salle de bains',
        intitule: 'Volumes de sécurité dans les locaux contenant baignoire/douche',
        sapplique: 'Neuf et rénovation, toute salle d’eau.',
        pointsCles: [
          'Découpage en volumes (0, 1, 2) selon la proximité de l’eau.',
          'Indice de protection (IP) minimal imposé par volume.',
          'Liaison équipotentielle locale obligatoire.',
          'Prises 230 V interdites au plus près du point d’eau (hors prise rasoir TBTS).',
        ],
        chiffres: [
          'Volume 0 : IPX7 — Volume 1 : IPX5 — Volume 2 : IPX4.',
          'Hors volumes : prises 230 V autorisées, protégées par différentiel 30 mA.',
        ],
        version: 'Intégrée à la NF C 15-100 (exigences renforcées en révision 2024).',
        source: 'https://www.promotelec.com',
        confiance: 'haute',
        note: 'Vérifier l’IP exact par volume dans la dernière édition (seuils ayant évolué selon les éditions).',
      },
      {
        reference: 'NF C 14-100',
        intitule: 'Installations de branchement à basse tension',
        sapplique: 'Neuf surtout (raccordement réseau Enedis) et toute modification de branchement.',
        pointsCles: [
          'Encadre la partie entre réseau public et installation privée (point de livraison).',
          'Couvre coffret/coupe-circuit, câble de liaison, compteur (Linky), disjoncteur de branchement (AGCP).',
          'Définit l’emplacement et l’accessibilité des organes de coupure.',
        ],
        chiffres: ['Disjoncteur de branchement typiquement 15/45 A réglable (monophasé domestique).'],
        version: 'Édition juillet 2021 (en vigueur en 2026).',
        source: 'https://actualites.consuel.com/nouvelle-edition-de-la-norme-nf-c-14-100/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 16-600',
        intitule: 'Diagnostic de l’installation électrique intérieure (existant)',
        sapplique: 'Existant : vente et location de logements dont l’installation a plus de 15 ans.',
        pointsCles: [
          'Référentiel du diagnostic électrique obligatoire.',
          'Identifie les anomalies sur les points de sécurité (différentiel, terre, protections, salle d’eau…).',
          'Réalisé par un diagnostiqueur certifié et assuré.',
        ],
        chiffres: ['Obligatoire si installation > 15 ans. Validité : 3 ans (vente), 6 ans (location).'],
        version: 'Version NF C 16-600 en vigueur.',
        source: 'https://www.service-public.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-722',
        intitule: 'Alimentation des véhicules électriques (IRVE / bornes de recharge)',
        sapplique: 'Neuf et rénovation, dès l’installation d’une borne / point de recharge.',
        pointsCles: [
          'Circuit dédié exclusif pour chaque point de recharge.',
          'Protection différentielle 30 mA adaptée (type A minimum selon la borne).',
          'Au-delà de 3,7 kW : installation par un électricien certifié IRVE obligatoire.',
        ],
        chiffres: ['Seuil de certification IRVE : 3,7 kW (décret n° 2017-26).'],
        version: 'En vigueur. Complète la NF C 15-100.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'ETEL / GTL',
        intitule: 'Espace et gaine technique du logement (révision 2024)',
        sapplique: 'Neuf et rénovation lourde.',
        pointsCles: [
          'ETEL accessible depuis l’unité de vie, du sol au plafond.',
          'GTL regroupe arrivées/départs, protections, distribution et communications.',
        ],
        chiffres: ['ETEL ≥ 60 cm × 25 cm au sol.'],
        version: 'Exigences renforcées dans la révision NF C 15-100 de 2024.',
        source: 'https://www.legrand.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire AVANT le premier chantier (loi Spinetta 1978).',
      'RC Pro fortement recommandée (dommages aux tiers avant réception).',
      'Attestation Consuel obligatoire avant mise sous tension (neuf + rénovation totale + production).',
      'Qualifelec : qualification valorisée par les assureurs et marchés publics.',
      'RGE obligatoire pour ouvrir droit aux aides (MaPrimeRénov’, CEE).',
      'Certification IRVE obligatoire pour borne > 3,7 kW.',
      'Garantie de parfait achèvement (1 an) + garantie biennale (2 ans).',
    ],
  },

  // ======================================================================
  // PLOMBIER
  // ======================================================================
  {
    slug: 'plombier',
    nom: 'Plombier',
    resume: 'Plomberie sanitaire, dimensionnement, évacuations, protection de l’eau potable.',
    normes: [
      {
        reference: 'NF DTU 60.1',
        intitule: 'Plomberie sanitaire pour bâtiments',
        sapplique: 'Neuf et rénovation, tous bâtiments (alimentation EF/ECS + évacuation + pose sanitaires).',
        pointsCles: [
          'Texte de référence de la plomberie sanitaire.',
          'Matériaux admis : cuivre, PER, multicouche ; PVC pour l’évacuation uniquement.',
          'Règles de fixation, protection corrosion, distances entre réseaux.',
          'Essais d’étanchéité avant mise en service.',
        ],
        chiffres: [
          'Pression de service au puisage 1 à 3 bars ; au-delà de 3 bars, réducteur obligatoire.',
          'Diamètres d’évacuation usuels : 32 mm lavabo, 40 mm évier/douche, 100 mm WC.',
        ],
        version: 'Décembre 2012, amendée décembre 2019.',
        source: 'https://www.ffbatiment.fr',
        confiance: 'haute',
        note: 'Chiffres de détail issus de sources techniques secondaires : à confirmer sur le texte CSTB.',
      },
      {
        reference: 'NF DTU 60.11',
        intitule: 'Règles de calcul (plomberie sanitaire et évacuation des eaux pluviales)',
        sapplique: 'Neuf et rénovation (dimensionnement hydraulique).',
        pointsCles: [
          'Méthode de dimensionnement des diamètres et débits.',
          'Coefficients de simultanéité, pertes de charge, pressions résiduelles.',
          'Partie 3 dédiée aux eaux pluviales (gouttières, descentes).',
        ],
        chiffres: [
          'Pluviométrie de référence 0,05 l/s/m² (métropole), 0,075 l/s/m² (DROM).',
          'Vitesse de distribution recommandée ≤ 2 m/s. Pente EU 1 à 3 cm/m (mini 1 cm/m).',
        ],
        version: 'Parties 1-1, 1-2, 2 et 3 de 2013.',
        source: 'https://boutique.cstb.fr',
        confiance: 'moyenne',
      },
      {
        reference: 'NF DTU 60.33 / 60.32',
        intitule: 'Canalisations PVC — évacuation EU/EV (60.33) et eaux pluviales (60.32)',
        sapplique: 'Neuf et rénovation, évacuation intérieure/extérieure en PVC.',
        pointsCles: [
          '60.33 : pose des réseaux EU/EV (eaux usées/vannes), gestion de la dilatation.',
          '60.32 : descentes et collecteurs d’eaux pluviales.',
        ],
        chiffres: ['EU/EV : adapté aux eaux ≤ ~60 °C ponctuelles. EP : eaux < 30 °C (pas de forte dilatation).'],
        version: '60.33 : octobre 2007 — 60.32 : novembre 2007.',
        source: 'https://www.batirama.com',
        confiance: 'haute',
      },
      {
        reference: 'NF EN 1717',
        intitule: 'Protection contre la pollution de l’eau potable (retours d’eau)',
        sapplique: 'Neuf et rénovation, tout réseau intérieur d’eau potable.',
        pointsCles: [
          'Classe les fluides en 5 catégories de risque et impose le dispositif adapté.',
          'Familles de protection (ex. EA clapet anti-retour, BA disconnecteur contrôlable).',
          'Garde d’air / surverse pour le remplissage de réservoirs.',
        ],
        chiffres: ['Disconnecteur BA contrôlable en tête d’installation à risque ; vérification annuelle recommandée.'],
        version: 'NF EN 1717. Cadre réglementaire : arrêté du 10 septembre 2021 (effet 01/01/2023, remplace celui de 2003).',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'Comptage individuel d’eau',
        intitule: 'Individualisation et télérelève (Code de la construction)',
        sapplique: 'Immeubles collectifs d’habitation.',
        pointsCles: [
          'Compteurs individuels d’eau froide obligatoires (permis postérieur au 01/11/2007).',
          'Compteurs posés depuis le 25/10/2020 : télérelevables.',
          'Télérelève généralisée à tous les compteurs individuels au 01/01/2027.',
        ],
        version: 'Échéance 2027.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (canalisations encastrées, ECS) — défaut puni jusqu’à 75 000 € et 6 mois de prison.',
      'RC Pro recommandée.',
      'Garantie de parfait achèvement (1 an) + garantie biennale (2 ans).',
      'Qualibat / RGE valorisants (RGE requis pour les aides : ECS thermodynamique, solaire).',
    ],
  },

  // ======================================================================
  // CHAUFFAGISTE
  // ======================================================================
  {
    slug: 'chauffagiste',
    nom: 'Chauffagiste',
    resume: 'Chauffage central, gaz, conduits de fumée, PAC, RE2020, entretien.',
    normes: [
      {
        reference: 'NF DTU 65.11',
        intitule: 'Dispositifs de sécurité des installations de chauffage central',
        sapplique: 'Neuf et rénovation, installations à eau chaude.',
        pointsCles: [
          'Soupapes de sécurité, vases d’expansion, anti-surchauffe / anti-débordement.',
          'Intègre une partie des prescriptions de la NF EN 12828.',
        ],
        chiffres: ['Domaine : eau ≤ 105 °C ; soupape tarée selon la pression max de service.'],
        version: 'Septembre 2007.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 61.1',
        intitule: 'Installations de gaz dans les locaux d’habitation',
        sapplique: 'Neuf et rénovation, installations gaz/GPL en aval de l’organe de coupure.',
        pointsCles: [
          'Conception des tuyauteries, organes de coupure, raccordement des appareils.',
          'Ventilation des locaux (aération haute/basse), coffrages.',
          'Distances mini entre canalisation gaz et autres réseaux (fourreau si croisement).',
        ],
        chiffres: ['Distance courante ≥ 3 cm entre canalisation gaz et autre canalisation (sinon fourreau).'],
        version: 'Version 2006 (P45-204). ATTENTION : pas de refonte « 2024 » — les évolutions récentes sont des arrêtés de sécurité, pas le DTU.',
        source: 'https://cegibat.grdf.fr',
        confiance: 'haute',
      },
      {
        reference: 'Arrêté du 23 février 2018',
        intitule: 'Règles techniques et de sécurité des installations de gaz (habitation)',
        sapplique: 'Neuf et rénovation, habitation individuelle/collective + parties communes.',
        pointsCles: [
          'Cadre réglementaire actuel de la sécurité gaz (remplace l’arrêté de 1977).',
          'Évacuation des produits de combustion, ventilation, VMC-gaz.',
          'Sécurité collective VMC-gaz : coupure des appareils en cas de défaut d’extraction.',
        ],
        chiffres: ['Vérification/réglage de la VMC-gaz et de ses sécurités tous les 5 ans.'],
        version: 'En vigueur (modifié par arrêté du 4 mars 2021).',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 24.1',
        intitule: 'Travaux de fumisterie / conduits de fumée',
        sapplique: 'Neuf et rénovation, conduits de fumée et de raccordement, débouchés.',
        pointsCles: [
          'Conception/mise en œuvre des conduits desservant un ou plusieurs appareils.',
          'Plaque signalétique posée par l’installateur (désignation/performance).',
          'Notion de « distance de sécurité » (matériaux combustibles), règles de débouché en toiture.',
        ],
        chiffres: ['Désignation européenne type « T450 N1 D 2 G50 » (température, pression, condensation, distance de sécurité).'],
        version: 'Septembre 2020 (remplace l’édition 2006).',
        source: 'https://www.poujoulat.fr',
        confiance: 'haute',
      },
      {
        reference: 'RE2020 — Chaudières',
        intitule: 'Encadrement des chaudières gaz et fioul',
        sapplique: 'Construction neuve principalement (règles distinctes de l’existant).',
        pointsCles: [
          'Chaudière fioul : installation interdite depuis le 01/07/2022 (neuf et existant).',
          'Chaudière gaz seule : de fait exclue en maison individuelle neuve (RE2020) ; collectif neuf à partir de 2025.',
          'En existant : remplacement gaz autorisé en 2026 (projet d’interdiction abandonné), mais aides supprimées.',
          'En neuf : PAC, réseaux de chaleur, hybrides.',
        ],
        chiffres: ['Plafond RE2020 ≈ 4 kgCO₂/m²/an en maison individuelle neuve (incompatible gaz seul).'],
        version: 'MI neuve depuis 01/01/2022 ; collectif neuf 2025.',
        source: 'https://www.ecologie.gouv.fr',
        confiance: 'haute',
        note: 'Sujet politiquement mouvant — vérifier la date de mise à jour.',
      },
      {
        reference: 'Pompes à chaleur — fluides frigorigènes',
        intitule: 'Attestation de capacité / aptitude + RGE QualiPAC',
        sapplique: 'Neuf et rénovation, installation de PAC (air/eau, air/air, géothermie).',
        pointsCles: [
          'Attestation de capacité (entreprise) + attestation d’aptitude (opérateur) obligatoires pour manipuler un fluide.',
          'RGE QualiPAC requis pour ouvrir droit aux aides.',
          'Contrôle d’étanchéité périodique selon la charge en fluide.',
        ],
        chiffres: ['Attestation de capacité valable 5 ans (audit annuel). F-Gas : restriction des fluides à fort PRG.'],
        version: 'Code de l’environnement (R.543-75 et s.) ; règlement F-Gas (UE) 2024/573.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'moyenne',
      },
      {
        reference: 'Entretien annuel',
        intitule: 'Entretien obligatoire des systèmes de chauffage',
        sapplique: 'Neuf et existant, chaudières et PAC selon puissance.',
        pointsCles: [
          'Entretien annuel obligatoire des chaudières de 4 à 400 kW.',
          'PAC > 12 kW soumises à entretien périodique.',
          'Attestation remise sous 15 jours, à conserver 2 ans.',
        ],
        version: 'Décret 2009-649 + arrêté 15/09/2009 ; décret 2020-912 (PAC/clim).',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (chauffage central, ECS, PAC) — défaut puni jusqu’à 75 000 € et 6 mois de prison.',
      'RC Pro recommandée (dégâts des eaux liés à l’installation).',
      'Certificat de conformité gaz (Qualigaz : CC1 neuf, CC2 modif, CC3 remplacement, CC4 collectif) exigé pour la mise en service.',
      'Attestation de capacité fluides frigorigènes (entreprise) + aptitude (opérateur).',
      'RGE QualiPAC / Qualigaz « Professionnel Gaz » pour les aides.',
      'Garantie de parfait achèvement (1 an) + garantie biennale (2 ans).',
    ],
  },

  // ======================================================================
  // COUVREUR
  // ======================================================================
  {
    slug: 'couvreur',
    nom: 'Couvreur',
    resume: 'Couvertures (ardoise, tuiles, zinc), écrans de sous-toiture, étanchéité, sécurité.',
    normes: [
      {
        reference: 'NF DTU 40.11',
        intitule: 'Couvertures en ardoises naturelles',
        sapplique: 'Neuf et rénovation, couverture en ardoises.',
        pointsCles: [
          'Pose à clous ou crochets ; recouvrement selon pente et zone.',
          'Pureau (partie visible) déterminé par le format.',
          'Ventilation de la sous-face exigée.',
        ],
        chiffres: ['Pente mini ≈ 35 % (~20°) ; recouvrement vertical mini ≈ 6 cm (variable selon format/pente).'],
        version: 'Révision janvier 2023.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
        note: 'Valeurs de recouvrement à recouper sur l’abaque officiel selon le format.',
      },
      {
        reference: 'NF DTU 40.21',
        intitule: 'Tuiles de terre cuite à emboîtement ou à glissement à relief',
        sapplique: 'Neuf et rénovation.',
        pointsCles: [
          'Pente mini selon 3 zones climatiques + situation (protégée/normale/exposée) + longueur de rampant.',
          'Écran de sous-toiture autorise des pentes plus faibles.',
          'Fixation renforcée selon zone de vent.',
        ],
        chiffres: ['Pente mini ~24 % (zone 1 protégée) à ~35 % (zone 3 exposée) ; jusqu’à ~21 % avec écran.'],
        version: 'Octobre 2013.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 40.22 / 40.24 / 40.41',
        intitule: 'Tuiles canal (40.22), tuiles béton (40.24), couverture zinc (40.41)',
        sapplique: 'Neuf et rénovation, selon le matériau.',
        pointsCles: [
          '40.22 : tuiles canal terre cuite (recouvrements importants).',
          '40.24 : tuiles béton — pente jusqu’à 25 % avec écran (mars 2023).',
          '40.41 : couverture zinc (joint debout, tasseaux) — pente mini ≈ 5 %.',
        ],
        chiffres: ['Joint debout zinc fini ≥ 2,5 cm. (Tuiles plates terre cuite = 40.23 ; tuiles planes béton = 40.241.)'],
        version: '40.24 : mars 2023 — 40.41 : octobre 2004 — 40.22 : 1993 + amendements (à recouper).',
        source: 'https://boutique.cstb.fr',
        confiance: 'moyenne',
        note: 'Ne PAS utiliser « DTU 40.14 » (inexistant pour le zinc → 40.41).',
      },
      {
        reference: 'NF DTU 40.29',
        intitule: 'Mise en œuvre des écrans souples de sous-toiture',
        sapplique: 'Neuf et rénovation, pose d’écrans sous couverture en petits éléments.',
        pointsCles: [
          'Couvre écrans bitumineux/synthétiques et écrans HPV (respirants).',
          'Écran HPV (Sd ≤ 0,10 m) admis au contact de l’isolant si pare-vapeur continu côté intérieur.',
          'Sinon lame d’air ventilée requise.',
        ],
        chiffres: ['Lame d’air mini 2 cm sous l’écran lorsqu’elle est requise.'],
        version: 'Novembre 2015.',
        source: 'https://www.batirama.com',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 43.1',
        intitule: 'Étanchéité des toitures-terrasses (support maçonnerie, climat de plaine)',
        sapplique: 'Neuf et rénovation, toitures-terrasses / inclinées sur maçonnerie.',
        pointsCles: [
          'Pare-vapeur, isolation, revêtement d’étanchéité, protection, relevés.',
          'Pentes minimales pour l’écoulement.',
        ],
        chiffres: ['Parties courantes 0 à 5 % ; noues ≥ 0,5 % ; gradins ≥ 1,5 %.'],
        version: 'En vigueur (vérifier la dernière édition CSTB).',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'Code du travail R.4323-58 et s.',
        intitule: 'Travaux temporaires en hauteur (sécurité)',
        sapplique: 'Tous chantiers de couverture.',
        pointsCles: [
          'Priorité à la protection collective (garde-corps rigides).',
          'Protection individuelle (arrêt de chute) uniquement si collective impossible.',
          'Jamais de travailleur seul sous EPI antichute.',
        ],
        chiffres: ['Système d’arrêt de chute ne permettant pas une chute libre > 1 m.'],
        version: 'En vigueur.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (couverture/étanchéité engagent solidité et étanchéité).',
      'Garanties : parfait achèvement (1 an), biennale (2 ans), décennale (10 ans).',
      'RC Pro recommandée ; Qualibat couverture valorisant.',
    ],
  },

  // ======================================================================
  // MAÇON
  // ======================================================================
  {
    slug: 'macon',
    nom: 'Maçon (gros œuvre)',
    resume: 'Maçonnerie, fondations, béton, enduits, Eurocodes, parasismique, déchets.',
    normes: [
      {
        reference: 'NF DTU 20.1',
        intitule: 'Ouvrages en maçonnerie de petits éléments — parois et murs',
        sapplique: 'Neuf et rénovation, murs en blocs béton, briques, etc.',
        pointsCles: [
          'Règles de chaînages, joints, appuis, protection contre l’humidité.',
          'Dispositions constructives minimales détaillées en partie P3.',
          'Tolérances d’exécution.',
        ],
        version: 'Juillet 2020.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 13.1',
        intitule: 'Fondations superficielles (remplace 13.11 et 13.12)',
        sapplique: 'Neuf et rénovation/extension, semelles superficielles, radiers.',
        pointsCles: [
          'Intègre les Eurocodes et exige une étude géotechnique.',
          'Mise hors gel obligatoire ; béton conforme NF EN 206/CN.',
          'Dimensionnement selon la nature du sol.',
        ],
        chiffres: ['Hors gel ≈ 50 cm (zone H1), 65 cm (H2), 85 cm (H3). Semelle filante : hauteur ≥ 20 cm, largeur ≥ 40 cm.'],
        version: 'Septembre 2019.',
        source: 'https://www.batirama.com',
        confiance: 'haute',
        note: 'Ne plus citer 13.11/13.12 (remplacés). Valeurs hors gel selon abaques régionaux.',
      },
      {
        reference: 'NF DTU 21',
        intitule: 'Exécution des ouvrages en béton',
        sapplique: 'Neuf et rénovation, béton armé coulé en place.',
        pointsCles: [
          'Conditions de mise en œuvre (coffrage, ferraillage, coulage, cure).',
          'Complète NF EN 13670 et reprend l’Eurocode 2 (+ annexe nationale).',
        ],
        version: 'Juin 2017.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 26.1',
        intitule: 'Travaux d’enduits de mortiers',
        sapplique: 'Neuf et rénovation, enduits épais (ciment, chaux) intérieurs/extérieurs.',
        pointsCles: [
          'Enduit traditionnel multicouches (gobetis / corps d’enduit / finition).',
          'Classes de résistance CSI à CSIV.',
          'Compatibilité enduit/support + délais de séchage entre couches.',
        ],
        chiffres: ['Dosages indicatifs : gobetis ~500 kg/m³ ; corps d’enduit ~350-400 kg/m³ (ciment).'],
        version: 'P1-2 avril 2008 (vérifier une éventuelle révision plus récente).',
        source: 'https://boutique.cstb.fr',
        confiance: 'moyenne',
      },
      {
        reference: 'Eurocode 8 — NF EN 1998-1',
        intitule: 'Construction parasismique',
        sapplique: 'Neuf et certaines rénovations, en zones sismiques selon catégorie du bâtiment.',
        pointsCles: [
          'Obligatoire pour bâtiments catégorie II en zones 3 ou 4 ; catégorie III dès zone 2.',
          'Pour maison individuelle : règles PS-MI (ou guide CPMI-EC8) en alternative.',
          'Impacte chaînages et dispositions constructives.',
        ],
        chiffres: ['5 zones sismiques (1 très faible → 5 forte).'],
        version: 'Applicable depuis le 1er mai 2014.',
        source: 'https://www.ecologie.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'Diagnostic PEMD (loi AGEC)',
        intitule: 'Gestion des déchets de démolition/rénovation',
        sapplique: 'Rénovation significative et démolition au-delà d’un seuil.',
        pointsCles: [
          'Diagnostic Produits-Équipements-Matériaux-Déchets préalable.',
          'Objectif réemploi / économie circulaire + formulaire de récolement.',
          'REP Bâtiment (PMCB) : reprise/traçabilité des déchets via éco-organismes.',
        ],
        chiffres: ['Obligatoire si surface cumulée de plancher > 1 000 m² (ou substances dangereuses).'],
        version: 'Régime renforcé pour les demandes déposées après le 01/07/2023.',
        source: 'https://www.ecologie.gouv.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (le gros œuvre engage la solidité de l’ouvrage).',
      'Garanties : parfait achèvement (1 an), biennale (2 ans), décennale (10 ans).',
      'Béton conforme NF EN 206/CN ; étude géotechnique (G1/G2, NF P 94-500) avant fondations.',
      'RC Pro recommandée ; Qualibat gros œuvre valorisant.',
    ],
  },

  // ======================================================================
  // MENUISIER
  // ======================================================================
  {
    slug: 'menuisier',
    nom: 'Menuisier',
    resume: 'Fenêtres et portes extérieures, menuiseries intérieures, AEV, RE2020, PMR.',
    normes: [
      {
        reference: 'NF DTU 36.5',
        intitule: 'Mise en œuvre des fenêtres et portes extérieures',
        sapplique: 'Neuf et rénovation, tous matériaux (bois, PVC, alu, acier, mixte).',
        pointsCles: [
          'Pose verticale, fixation directe à la structure sur ≥ 2 côtés opposés du dormant.',
          'Calfeutrement (mastic) périphérique obligatoire entre structure et dormant.',
          'Fixation par collage, mousse ou clouage NON admise.',
          '3 types de pose : applique, tunnel, feuillure.',
        ],
        chiffres: ['Fixation sur ≥ 2 côtés opposés ; calfeutrement périphérique systématique.'],
        neufVsReno: 'Couvre la dépose totale (pose neuve) et la rénovation (sur dormant existant conservé).',
        version: 'Avril 2010.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 36.2',
        intitule: 'Menuiseries intérieures bois et agencement',
        sapplique: 'Neuf et rénovation, locaux secs ou moyennement humides.',
        pointsCles: [
          'Cloisons de distribution, huisseries/bâtis, blocs-portes, plinthes, habillages.',
          'Bois et matériaux dérivés/plaqués.',
        ],
        version: 'Version novembre 2025 (« Menuiseries intérieures agencement bois et matériaux associés ») — remplace celle de 2016.',
        source: 'https://www.ffbatiment.fr',
        confiance: 'haute',
      },
      {
        reference: 'Classement A*E*V* (NF EN 14351-1)',
        intitule: 'Performances Air / Eau / Vent des fenêtres',
        sapplique: 'Toute fenêtre/porte-fenêtre extérieure (marquage CE).',
        pointsCles: [
          'A (Air) : A1 à A4 — E (Eau) : E1 à E9 — V (Vent) : V1 à V5.',
          'Classement obligatoire dans le cadre du marquage CE.',
          'Niveaux supérieurs recommandés en façade très exposée.',
        ],
        chiffres: ['Classement minimal courant exigé par la marque NF : A*3 E*7B V*A3 (à confirmer sur le référentiel NF).'],
        version: 'NF EN 14351-1+A2 (2016).',
        source: 'https://www.boutique.afnor.org',
        confiance: 'moyenne',
      },
      {
        reference: 'RE2020 (volet menuiseries)',
        intitule: 'Performance thermique et étanchéité à l’air',
        sapplique: 'Construction neuve (permis depuis 2022). En réno : RT existant.',
        pointsCles: [
          'Étanchéité à l’air contrôlée par test d’infiltrométrie (neuf).',
          'Confort d’été pris en compte (facteur solaire selon orientation).',
          'La RE2020 raisonne en performance GLOBALE (Bbio/Cep), pas en Uw plancher par fenêtre.',
        ],
        chiffres: ['Uw souvent visé ≤ 1,3 W/m².K (recommandation de marché, pas un seuil réglementaire par menuiserie).'],
        neufVsReno: 'RE2020 = neuf ; rénovation = RT existant (moins exigeant).',
        version: 'En vigueur depuis 2022.',
        source: 'https://www.ecologie.gouv.fr',
        confiance: 'haute',
        note: 'Ne pas présenter un Uw plancher comme une obligation par menuiserie : la RE2020 est globale.',
      },
      {
        reference: 'Accessibilité PMR',
        intitule: 'Seuils et largeurs de passage (logements neufs, ERP)',
        sapplique: 'Logements neufs, maisons individuelles destinées à la vente/location, ERP.',
        pointsCles: [
          'Seuil de menuiserie à ressaut limité.',
          'Largeur de passage utile minimale pour le fauteuil.',
        ],
        chiffres: ['Hauteur de seuil ≤ 20 mm ; largeur utile ≥ 0,83 m (menuiserie nominale ≥ 0,90 m).'],
        version: 'Arrêté 2007 (assoupli par la loi ELAN 2018 — logements « évolutifs »).',
        source: 'https://www.accessibilite-batiment.fr',
        confiance: 'moyenne',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (ouvrages touchant le clos/couvert ou éléments indissociables).',
      'Garantie biennale (2 ans : quincaillerie, ouvrants) + parfait achèvement (1 an).',
      'RC Pro recommandée.',
      'Qualibat / RGE requis pour les aides sur les menuiseries.',
    ],
  },

  // ======================================================================
  // PLAQUISTE
  // ======================================================================
  {
    slug: 'plaquiste',
    nom: 'Plaquiste',
    resume: 'Plaques de plâtre, doublages, locaux humides, feu.',
    normes: [
      {
        reference: 'NF DTU 25.41',
        intitule: 'Ouvrages en plaques de plâtre à faces cartonnées',
        sapplique: 'Neuf et rénovation, cloisons, plafonds, contre-cloisons sur ossature.',
        pointsCles: [
          'Ossature métallique : montants à entraxe 0,40 m ou 0,60 m.',
          'Plafonds : suspentes/fourrures à entraxe max 0,60 m.',
          'Fixation des plaques régulièrement espacée, adaptée au support.',
          'S’applique aux locaux EA, EB et EB+ privatifs.',
        ],
        chiffres: [
          'Entraxe ossature 0,40 ou 0,60 m (réduit à 0,40 m sous carrelage > 1 600 cm²).',
          'Hauteur max cloison ossature métal : 6,35 m (simple parement) / 6,85 m (double).',
        ],
        version: 'Révision applicable depuis le 1er mai 2022.',
        source: 'https://www.placo.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 25.41 — Locaux humides',
        intitule: 'Plaques hydrofuges H1 en pièces humides',
        sapplique: 'Pièces classées EB+ (salles de bains, cuisines).',
        pointsCles: [
          'EB+ privatif : face vue des parois verticales en plaque hydrofuge H1.',
          'EB+ collectif : plaque H1 sur toutes les faces de la paroi verticale.',
          'Locaux EC (piscines, cuisines collectives) : hors DTU, Avis Technique requis.',
        ],
        chiffres: ['Parois sous rampants < 1,80 m du sol également traitées H1.'],
        version: 'Intégré au DTU 25.41 (révision 2022).',
        source: 'https://www.siniat.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 25.42',
        intitule: 'Doublages et habillages en complexes et sandwiches (plaque + isolant)',
        sapplique: 'Neuf et rénovation, doublages collés ou sur ossature.',
        pointsCles: [
          'Doublages collés et sur ossature (confort thermique/acoustique).',
          'Locaux EA, EB et EB+ privatifs.',
          'Compatibilité plaque/isolant/colle exigée selon performance (feu, thermique).',
        ],
        version: 'Décembre 2012.',
        source: 'https://www.boutique.afnor.org',
        confiance: 'haute',
      },
      {
        reference: 'Réaction / résistance au feu',
        intitule: 'Euroclasses et PV feu (parois coupe-feu)',
        sapplique: 'Neuf et rénovation, parties soumises à exigence feu (ERP, collectif, gaines).',
        pointsCles: [
          'La plaque de plâtre standard est classée A2-s1,d0 (incombustible) en réaction au feu.',
          'Les degrés coupe-feu (EI 30, EI 60…) dépendent du SYSTÈME complet (épaisseur, nb de plaques, laine).',
          'Toujours se référer au PV d’essai du système, pas à un degré générique.',
        ],
        version: 'Selon réglementation incendie du bâtiment.',
        source: 'https://www.placo.fr',
        confiance: 'moyenne',
        note: 'Les niveaux de finition Q1–Q4 viennent du référentiel européen Eurogypsum (à ne pas attribuer au DTU 25.41).',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire (cloisons, doublages, plafonds participant à l’isolation/confort).',
      'Garantie biennale (2 ans) + parfait achèvement (1 an).',
      'RC Pro recommandée ; RGE requis pour l’isolation ouvrant droit aux aides.',
    ],
  },

  // ======================================================================
  // PEINTRE
  // ======================================================================
  {
    slug: 'peintre',
    nom: 'Peintre',
    resume: 'Peintures, revêtements muraux, préparation des supports, COV.',
    normes: [
      {
        reference: 'NF DTU 59.1',
        intitule: 'Travaux de peinture des bâtiments',
        sapplique: 'Neuf et rénovation, intérieur et extérieur.',
        pointsCles: [
          'Préparation des subjectiles (propres, dépoussiérés, secs).',
          '3 niveaux de finition : A (soignée), B (courante), C (élémentaire).',
          'Le niveau de finition doit être contractualisé au devis (sinon litige).',
          'Critères de choix produit selon le subjectile.',
        ],
        chiffres: [
          'Températures d’application : 8 à 35 °C (intérieur), 5 à 35 °C (extérieur).',
          'Hygrométrie : < 70 % (intérieur), < 80 % (extérieur).',
          'Finition C : 1 couche d’impression + 2 couches de finition (minimum).',
        ],
        version: 'Juin 2013 (confirmée 2018). ⚠️ Il n’existe PAS de version « janvier 2024 » (info commerciale erronée).',
        source: 'https://norminfo.afnor.org',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 59.4',
        intitule: 'Mise en œuvre des papiers peints et revêtements muraux',
        sapplique: 'Neuf et rénovation, intérieur.',
        pointsCles: [
          'Subjectiles sans taches grasses, efflorescences, salpêtre.',
          'Spécification, classement, préparation, pose, adhérence, vérification.',
        ],
        chiffres: ['Humidité du subjectile < 5 % ; pH ≤ 13 ; pose recommandée entre 10 et 30 °C.'],
        version: 'Janvier 1998 (DTU ancien — vérifier une éventuelle révision).',
        source: 'https://www.batirama.com',
        confiance: 'haute',
      },
      {
        reference: 'Réglementation COV',
        intitule: 'Teneur en COV et étiquetage des émissions',
        sapplique: 'Toutes peintures et vernis (intérieur/extérieur).',
        pointsCles: [
          'Limite la teneur en COV des produits (phases 2007 puis 2010).',
          'Étiquetage émissions obligatoire en France : 4 classes A+, A, B, C.',
          'Le peintre doit utiliser des produits conformes et tracer les fiches techniques.',
        ],
        chiffres: ['Peintures murales intérieures : max 30 g/L (depuis 2010, variable selon sous-catégorie).'],
        version: 'Directive 2004/42/CE + décret 2011-321.',
        source: 'https://aida.ineris.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Décennale NON systématique si travaux purement esthétiques ; OBLIGATOIRE pour fonction technique (imperméabilisation de façade, ITE, anticorrosion).',
      'Garantie biennale (2 ans) + parfait achèvement (1 an).',
      'RC Pro fortement recommandée (projections, mobilier).',
      'Qualibat / RGE requis pour ravalement avec isolation ouvrant droit aux aides.',
    ],
  },

  // ======================================================================
  // CARRELEUR
  // ======================================================================
  {
    slug: 'carreleur',
    nom: 'Carreleur',
    resume: 'Pose collée et scellée, classement UPEC, étanchéité sous carrelage, joints.',
    normes: [
      {
        reference: 'NF DTU 52.2',
        intitule: 'Pose collée des revêtements céramiques et pierres naturelles',
        sapplique: 'Neuf et rénovation, murs et sols, intérieur et extérieur.',
        pointsCles: [
          'LE DTU de référence pour la pose collée (mortier-colle).',
          'Double encollage imposé pour grands formats et en extérieur.',
          'Mortier-colle NF EN 12004 ; privilégier C2 S1/S2 (déformables).',
          'Support propre, sain, cohésif, sec et plan.',
        ],
        chiffres: ['Planéité support ≈ 5 mm sous la règle de 2 m. Formats jusqu’à 3 600 cm² en mur, 10 000 cm² en sol.'],
        neufVsReno: 'En réno : diagnostic du support (pose sur ancien carrelage → primaire d’accrochage).',
        version: 'Parties P1-1 de mai 2022 + règles pro terrasses 2024.',
        source: 'https://www.boutique.afnor.org',
        confiance: 'haute',
      },
      {
        reference: 'NF DTU 52.1',
        intitule: 'Revêtements de sol scellés',
        sapplique: 'Surtout neuf — pose scellée au mortier.',
        pointsCles: [
          'Épaisseurs de mortier, supports admis, cure.',
          'Joints de fractionnement, périphériques, de dilatation.',
        ],
        chiffres: ['Fractionnement ≈ 40-60 m² (intérieur selon pose), bien moindre en extérieur ; joints périphériques ≥ 5 mm.'],
        version: '2020.',
        source: 'https://norminfo.afnor.org',
        confiance: 'moyenne',
      },
      {
        reference: 'Classement UPEC (Cahier CSTB 3782)',
        intitule: 'Adéquation revêtement / usage du local',
        sapplique: 'Choix du carrelage selon l’usage (sols intérieurs). Conditionne l’assurabilité.',
        pointsCles: [
          'U = Usure, P = Poinçonnement, E = Eau, C = agents Chimiques.',
          'Le classement du revêtement doit être ≥ à celui exigé par le local.',
        ],
        chiffres: ['Salle de bains privative ≈ U2sP2E2C1 ; pièces de vie U3P3 mini ; fort trafic U4/P4S.'],
        version: 'Cahier 3782 V2 (juin 2018).',
        source: 'https://www.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'SPEC / SEL',
        intitule: 'Protection à l’eau (SPEC) et étanchéité (SEL) sous carrelage',
        sapplique: 'Locaux humides intérieurs (salles de bains, douches), neuf et réno.',
        pointsCles: [
          'Un SPEC protège le support sensible à l’eau ; il n’assure PAS l’étanchéité (≠ SEL, avec siphon de sol).',
          'SPEC : sols sans siphon classés au plus P3 E2 ; couvre EB+ privatif/collectif, EC.',
          'Pour être assurable : SPEC et SEL doivent disposer d’un Avis Technique / DTA en cours de validité.',
        ],
        chiffres: ['Au-delà (siphon de sol) → SEL exigé.'],
        version: 'e-Cahier CSTB 3756 V3 (juillet 2021).',
        source: 'https://www.ffbatiment.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Décennale obligatoire (décollements généralisés, défauts d’étanchéité) — ne joue que si l’ouvrage respecte un DTU / Avis Technique en vigueur.',
      'Garanties : parfait achèvement (1 an), biennale (2 ans). RC Pro recommandée.',
      'Conformité produits : colles NF EN 12004, carrelage QB UPEC, SPEC/SEL sous Avis Technique valide.',
    ],
  },

  // ======================================================================
  // SERRURIER-MÉTALLIER
  // ======================================================================
  {
    slug: 'serrurier',
    nom: 'Serrurier-métallier',
    resume: 'Charpente acier, garde-corps, portails/portes motorisés, clôtures.',
    normes: [
      {
        reference: 'NF P01-012',
        intitule: 'Dimensions des garde-corps et rampes d’escalier',
        sapplique: 'Neuf et réno, garde-corps de balcons, terrasses, fenêtres, mezzanines, escaliers.',
        pointsCles: [
          'Hauteur et écartements (anti-passage du corps, anti-escalade enfant).',
          'Révision nov. 2024 : zone basse infranchissable portée de 45 cm à 60 cm.',
          'Interdiction des lisses/câbles horizontaux dans les 60 premiers cm (effet échelle).',
        ],
        chiffres: ['Hauteur ≥ 1 m (90 cm admis si garde-corps épais ≥ 50 cm / rampes) ; écartement barreaux ≤ 11 cm ; zone pleine basse 60 cm.'],
        neufVsReno: 'Réno à l’identique d’un existant conforme à l’ancienne norme parfois admise (selon assureur).',
        version: 'Révision novembre 2024 — obligatoire aux permis déposés dès le 01/06/2025 ; pleinement applicable au 01/01/2026.',
        source: 'https://normalisation.afnor.org/thematiques/garde-corps/',
        confiance: 'haute',
      },
      {
        reference: 'NF P01-013',
        intitule: 'Essais des garde-corps (résistance)',
        sapplique: 'Neuf et réno, validation mécanique (complément essais de la NF P01-012).',
        pointsCles: [
          'Méthodes d’essai (charges horizontales, verticales, dynamiques).',
          'Validation des fixations (platines, scellements, soudures).',
        ],
        chiffres: ['Effort horizontal main courante : 40 daN/m (logement privatif), 60 (collectif), 100 (ERP), 170 (forte affluence).'],
        version: 'Août 1988.',
        source: 'https://norminfo.afnor.org',
        confiance: 'moyenne',
      },
      {
        reference: 'NF DTU 32.1',
        intitule: 'Charpentes et ossatures en acier',
        sapplique: 'Neuf et réno, charpentes/ossatures acier.',
        pointsCles: [
          'Fabrication et mise en œuvre (boulonnage, soudage), levage, tolérances.',
          'À articuler avec l’Eurocode 3 (NF EN 1993) et NF EN 1090.',
        ],
        chiffres: ['Classes d’exécution EXC1 à EXC4 (NF EN 1090) selon la criticité.'],
        version: 'Novembre 2020.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF EN 13241 + EN 12453/12445',
        intitule: 'Portails / portes motorisés (marquage CE + sécurité)',
        sapplique: 'Neuf et réno, portails, portes de garage, fermetures.',
        pointsCles: [
          'Norme produit harmonisée : marquage CE + DoP obligatoires.',
          'Sécurité motorisation (anti-pincement/écrasement) : cellules, barre palpeuse, limiteur d’effort.',
          'Portail motorisé = « machine » (Directive Machines 2006/42/CE).',
        ],
        chiffres: ['Efforts de fermeture plafonnés (mesurés selon EN 12445).'],
        neufVsReno: 'Motoriser un portail existant le transforme en machine soumise au CE + déclaration de conformité.',
        version: 'NF EN 13241+A2 (2016) ; EN 12453+A1 (2021).',
        source: 'https://normalisation.afnor.org',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Décennale obligatoire sur les ouvrages affectant solidité / clos-couvert (charpente, garde-corps scellés, escalier, verrière).',
      'Parfait achèvement (1 an), biennale (2 ans : motorisation), RC Pro.',
      'Marquage CE + DoP : NF EN 1090-1 (acier, EXC1-EXC4), NF EN 13241 (portails).',
      'Conformité PLU pour portails et clôtures (hauteur, déclaration préalable souvent requise).',
    ],
  },

  // ======================================================================
  // VITRIER
  // ======================================================================
  {
    slug: 'vitrier',
    nom: 'Vitrier',
    resume: 'Vitrerie-miroiterie, calcul d’épaisseur, verre de sécurité, garde-corps vitrés.',
    normes: [
      {
        reference: 'NF DTU 39',
        intitule: 'Travaux de vitrerie-miroiterie',
        sapplique: 'Neuf et réno/remplacement, vitrages en façade, fenêtres, vérandas, miroiterie.',
        pointsCles: [
          'Règles de l’art opposables : jeux périphériques, calages, garnitures d’étanchéité, pose en feuillure.',
          'Prévention de la casse thermique.',
          'P4 = mémento de calcul des épaisseurs ; P5 = mémento sécurité (choix du verre).',
        ],
        chiffres: ['Domaine des calculs : bâtiments < 100 m de hauteur, altitude < 2 000 m.'],
        version: 'CCT P1-1 de 2006, P4 (2012), P5 (2017) — vérifier la dernière édition consolidée.',
        source: 'https://boutique.cstb.fr',
        confiance: 'haute',
      },
      {
        reference: 'FD DTU 39 P5 + NF EN 12600',
        intitule: 'Choix du verre de sécurité selon le risque',
        sapplique: 'Neuf et réno, toute paroi vitrée exposée au choc, à la chute ou à la blessure.',
        pointsCles: [
          'NF EN 12600 = essai au pendule classant le verre : 1B1, 2B2, 3B3 (1B1 = la plus exigeante).',
          'NF EN ISO 12543 = verre feuilleté ; NF EN 12150 = verre trempé.',
          'Le FD DTU 39 P5 oriente le choix selon la destination.',
        ],
        chiffres: ['Feuilleté « de sécurité » dès classe 3B3 ; garde-corps vitré → feuilleté classé 1B1.'],
        version: 'FD DTU 39 P5 = juillet 2017.',
        source: 'https://www.boutique.afnor.org',
        confiance: 'haute',
      },
      {
        reference: 'NF P01-012 / P01-013 (vitrés)',
        intitule: 'Garde-corps et allèges vitrées',
        sapplique: 'Neuf et réno, allège/garde-corps vitré (risque de chute).',
        pointsCles: [
          'Verre feuilleté (maintien des morceaux), classé 1B1.',
          'Renvoi à l’article R111-15 du CCH en habitation.',
        ],
        chiffres: ['Hauteur de protection ≥ 1 m ; efforts main courante 60 daN (logement), 100 (public), 170 (foule).'],
        version: 'Attention : NF P01-012 révisée en nov. 2024 (voir métier serrurier) — confirmer l’édition applicable.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'moyenne',
      },
      {
        reference: 'NF EN 1279',
        intitule: 'Vitrages isolants (double/triple vitrage)',
        sapplique: 'Neuf et réno, vitrages isolants (marquage CE).',
        pointsCles: [
          'Norme produit harmonisée (CE) : étanchéité, durabilité, thermique/acoustique.',
          'La certification CEKAL (volontaire) va au-delà : garantie 10 ans.',
        ],
        version: 'Série NF EN 1279 (révisions principales 2018) — vérifier la partie applicable.',
        source: 'https://www.cekal.com/',
        confiance: 'moyenne',
      },
    ],
    transverses: [
      'Décennale obligatoire dès que les ouvrages vitrés participent au clos/couvert (façades, vérandas, garde-corps).',
      'Parfait achèvement (1 an), biennale (2 ans), RC Pro.',
      'Marquage CE du verre : NF EN 14449 (feuilleté), 12150 (trempé), 1279 (isolant) + DoP à conserver.',
      'CEKAL et Qualibat (volontaires) ; conformité DTU 39, CCH (R111-15), RE2020 (parois vitrées en neuf).',
    ],
  },

  // ======================================================================
  // PAYSAGISTE
  // ======================================================================
  {
    slug: 'paysagiste',
    nom: 'Paysagiste',
    resume: 'Plantations, gazons, arrosage, terrassement, phytos (loi Labbé), déchets verts, élagage.',
    normes: [
      {
        reference: 'Règles Pro Unep (Travaux du Paysage)',
        intitule: 'Référentiel privé « règles de l’art » (plantation, gazon, arrosage, terrassement)',
        sapplique: 'Travaux du paysage. Référentiel privé Unep (font foi de règles de l’art, non opposable de plein droit).',
        pointsCles: [
          'P.C.2 plantation arbres/arbustes : compatibilité végétal/milieu, devoir de conseil, végétaux conformes aux normes pépinières.',
          'P.C.4 / P.E.5 gazons : préparation du sol, mélanges, obligation de résultat de couverture à la réception.',
          'P.C.6/7 + P.E.4 arrosage intégré : conception, pose, maintenance (hivernage).',
          'C.C.1 terrassement : décaissement, modelage, réemploi de la terre végétale.',
        ],
        chiffres: ['Plantation : diamètre de motte ≥ 3 × la circonférence du tronc (mesurée à 1 m du sol).'],
        version: 'Référentiel Unep actualisé.',
        source: 'https://www.lesentreprisesdupaysage.fr',
        confiance: 'haute',
      },
      {
        reference: 'Fascicule 35 du CCTG',
        intitule: 'Aménagements paysagers, aires de sports et de loisirs',
        sapplique: 'Marchés publics de travaux de paysage (opposable dès qu’un marché le vise).',
        pointsCles: [
          'Opérations préalables à la réception (constat de couverture du gazon, constat de reprise).',
          'Constat de reprise au printemps suivant ; parachèvement / confortement.',
        ],
        chiffres: ['Objectif de reprise 100 % (milieu urbain) ; garantie de reprise souvent 1 à 2 ans.'],
        version: 'Version 2021 (décret du 7 octobre 2021).',
        source: 'https://www.bulletin-officiel.developpement-durable.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'Loi « Labbé » / décret 2022-686',
        intitule: 'Interdiction des produits phytopharmaceutiques de synthèse',
        sapplique: 'Espaces verts, propriétés privées, lieux à usage collectif.',
        pointsCles: [
          'Depuis le 01/07/2022 : un paysagiste ne peut plus appliquer de phytos de synthèse chez un particulier.',
          'Restent autorisés : biocontrôle, substances de base, faible risque, produits utilisables en bio.',
          'Certiphyto obligatoire (valable 5 ans).',
        ],
        version: 'En vigueur 2026.',
        source: 'https://www.service-public.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'Déchets verts & plantations en limite',
        intitule: 'Brûlage interdit + distances (Code de l’environnement / Code civil)',
        sapplique: 'Tous chantiers paysagers.',
        pointsCles: [
          'Brûlage des déchets verts à l’air libre interdit (broyage/paillage, compostage, déchetterie).',
          'Distances de plantation en limite de propriété (art. 671-673 Code civil).',
          'Élagage sur cordes : système à deux cordes obligatoire (Code du travail), formation + EPI antichute.',
        ],
        chiffres: ['Plantation > 2 m de haut → recul 2 m ; ≤ 2 m → recul 0,50 m. Brûlage : amende jusqu’à 450 €.'],
        version: 'En vigueur.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'haute',
      },
    ],
    transverses: [
      'Décennale obligatoire dès qu’il y a ouvrage durable en dur (murets, escaliers, bassins, terrasses maçonnées). Non requise pour le seul entretien.',
      'RC Pro / RC Exploitation incontournable.',
      'Garantie de reprise des végétaux : jusqu’à 100 % en marché public ; 1 à 2 ans en privé (à fixer au devis).',
      'Certiphyto (5 ans) ; Qualipaysage (qualification volontaire).',
    ],
  },
]
