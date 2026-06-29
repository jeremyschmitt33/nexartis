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
    resume: 'Installations basse tension : équipement, protections, câbles, terre, comms, IRVE, photovoltaïque. Le métier avec le plus de règles — fiches détaillées ci-dessous.',
    normes: [
      {
        reference: 'NF C 15-100 — Cadre & révision 2024',
        intitule: 'Installations électriques à basse tension : la norme de référence',
        sapplique: 'Neuf et rénovation totale (logements). En réno partielle : mise en sécurité des circuits touchés.',
        pointsCles: [
          'Encadre TOUTE l’installation en aval du disjoncteur de branchement.',
          'Tout circuit protégé par différentiel 30 mA + disjoncteur adapté à la section.',
          'Mise à la terre + liaison équipotentielle obligatoires.',
          'Révision 2024 : passage à une collection de 21 normes (NF C 15-100-X).',
          'Nouveautés 2024 : circuit dédié borne VE (partie 7-722), différentiel type F, AFDD (détecteur d’arc) recommandé sur locaux à risque, parafoudre complémentaire au-delà de 10 m, euroclasses de réaction au feu des câbles.',
        ],
        chiffres: ['Application volontaire dès le 21/08/2024 ; seule version obligatoire depuis le 01/09/2025.'],
        neufVsReno: 'Intégralité en neuf et réno totale. En réno partielle : exigences de sécurité minimales (terre, 30 mA) sur les circuits modifiés.',
        version: 'Série NF C 15-100 révision 2024, en vigueur en 2026.',
        source: 'https://actualites.consuel.com/la-nouvelle-norme-nf-c-15-100-est-arrivee/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Prises par pièce',
        intitule: 'Équipement minimum : nombre de socles de prises imposé par local',
        sapplique: 'Neuf et rénovation totale.',
        pointsCles: [
          'Le décompte se fait socle par socle (une boîte double = 2 prises).',
          'Séjour : 1 socle par tranche de 4 m², avec un minimum de 5.',
          'Cuisine > 4 m² : 6 socles non spécialisés dont 4 au-dessus du plan de travail (sur circuit dédié 2,5 mm²/20 A).',
          'Chambre : 3 socles minimum, quelle que soit la surface.',
          'Prises interdites au-dessus de l’évier et des plaques de cuisson.',
        ],
        chiffres: [
          'Séjour : 1 socle / 4 m², minimum 5 (ex. 24 m² → 6, 28 m² → 7).',
          'Cuisine ≤ 4 m² : 3 socles. Cuisine > 4 m² : 6 socles (dont 4 plan de travail).',
          'Chambre : 3 socles. Circulation / local ≥ 4 m² : 1 socle. WC : prise non obligatoire.',
          'Extérieur : prises étanches IP44, ≥ 1 m du sol.',
        ],
        neufVsReno: 'Valeurs strictes en neuf et réno totale ; cibles à viser en réno partielle.',
        version: 'NF C 15-100 (quantités stables en 2024).',
        source: 'https://www.promotelec.com/particuliers/fiche/quel-equipement-minimal-prevoir-pour-votre-installation-electrique/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Éclairage & DCL',
        intitule: 'Points lumineux obligatoires et dispositif de connexion luminaire',
        sapplique: 'Neuf et rénovation totale.',
        pointsCles: [
          'Au moins 1 point d’éclairage par pièce principale, pièce de service et circulation.',
          'Séjour, cuisine, chambres : 1 point de centre en plafond équipé d’un socle DCL.',
          'DCL obligatoire quand la canalisation est encastrée.',
          'Une prise commandée vaut 1 point lumineux — interdite en salle de bains, salle d’eau et WC.',
        ],
        chiffres: ['Maximum 8 points d’éclairage par circuit. Circuit 1,5 mm², protection 16 A max (souvent 10 A).'],
        version: 'NF C 15-100 (inchangé sur le fond en 2024).',
        source: 'https://www.legrand.fr/actualites/norme-nf-c-15-100-les-lumieres',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Circuits spécialisés',
        intitule: 'Circuits dédiés au gros électroménager',
        sapplique: 'Neuf et rénovation totale.',
        pointsCles: [
          'Un circuit spécialisé = dédié à un seul appareil de forte puissance.',
          'Minimum 4 circuits spécialisés : cuisson + 3 circuits avec socle (lave-linge, lave-vaisselle, four…).',
          'Plaque/cuisinière : toujours son propre circuit.',
          'Chauffe-eau, sèche-linge, congélateur : chacun sur circuit dédié.',
        ],
        chiffres: [
          'Plaque/cuisinière monophasé : 32 A / 6 mm² (sortie de câble). Triphasé : 20 A / 2,5 mm².',
          'Lave-linge, lave-vaisselle, four, sèche-linge, chauffe-eau : 20 A / 2,5 mm² (1 appareil par circuit).',
          'Le 16 A est insuffisant pour ces circuits spécialisés à socle : 20 A / 2,5 mm².',
        ],
        version: 'NF C 15-100 (révision 2024 ajoute le circuit dédié borne VE).',
        source: 'https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/cuisine/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Sections de câbles & calibres',
        intitule: 'Tableau section ↔ calibre ↔ usage (le mémo du quotidien)',
        sapplique: 'Tous les circuits terminaux d’un logement.',
        pointsCles: [
          'À chaque usage correspond une section mini (cuivre) et un calibre max de disjoncteur.',
          'Ne jamais surcalibrer un disjoncteur par rapport à la section du câble.',
          'Le calibre découle de la section : 1,5 mm² → 16 A ; 2,5 mm² → 20 A ; 6 mm² → 32 A.',
        ],
        chiffres: [
          'Éclairage : 1,5 mm² / 16 A (10 A conseillé) — 8 points max.',
          'Prises 16 A : 1,5 mm² / 16 A (8 prises max) OU 2,5 mm² / 20 A (12 prises max).',
          'Prises plan de travail cuisine : 2,5 mm² / 20 A (6 socles max, circuit dédié).',
          'Lave-linge / lave-vaisselle / four / sèche-linge / chauffe-eau / réfrigérateur : 2,5 mm² / 20 A.',
          'Plaque mono : 6 mm² / 32 A. VMC & fil pilote : 1,5 mm² / 2 A. Volets : 1,5 mm² / 16 A.',
          'Chauffage 230 V : 3500 W→1,5/16 A ; 4500 W→2,5/20 A ; 5750 W→4/25 A ; 7250 W→6/32 A.',
          'IRVE : borne 16 A → 2,5 mm² / 20 A ; borne 32 A → 10 mm² / 40 A.',
        ],
        version: 'NF C 15-100 (Tableau 10-1F ; valeurs stables).',
        source: 'https://home.nexans.fr/section-des-conducteurs-et-calibres-de-protection',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Différentiels 30 mA',
        intitule: 'Interrupteurs différentiels : nombre, types et répartition',
        sapplique: 'Tableau de répartition de tout logement.',
        pointsCles: [
          'Tous les circuits protégés par différentiel haute sensibilité 30 mA (protection des personnes).',
          'Minimum 2 interrupteurs différentiels par logement (au moins 1 type A + 1 type AC).',
          'Type A OBLIGATOIRE sur : plaque de cuisson + lave-linge (+ bornes IRVE selon mode).',
          'Nouveauté 2024 : type F (immunité renforcée) pour appareils à variateur (PAC, clim, pompe piscine) ; AFDD/détecteur d’arc recommandé (non obligatoire en logement standard).',
          'Équilibrer les circuits entre les différentiels (pas tous les essentiels sur le même).',
        ],
        chiffres: [
          'Sensibilité 30 mA. Maximum 8 circuits en aval d’un même différentiel.',
          'Calibre du différentiel : 40 A en général, 63 A si forte charge simultanée (ex. chauffage important).',
        ],
        neufVsReno: 'En réno partielle, le 30 mA est exigé sur les circuits touchés (mise en sécurité).',
        version: 'NF C 15-100 révision 2024.',
        source: 'https://www.123elec.com/norme_protection_differentielle',
        confiance: 'haute',
        note: 'Le nombre exact de différentiels par tranche de surface varie selon les sources de vulgarisation : à confirmer sur le guide officiel.',
      },
      {
        reference: 'NF C 15-100 — Terre & équipotentielle',
        intitule: 'Prise de terre et liaisons équipotentielles (LEP / LES)',
        sapplique: 'Tout logement (régime de neutre TT, standard en France).',
        pointsCles: [
          'En régime TT, la sécurité repose sur l’association prise de terre + différentiel 30 mA.',
          'Liaison équipotentielle principale (LEP) : relie au bornier de terre les éléments conducteurs entrants (eau/gaz métalliques, charpente…).',
          'Liaison équipotentielle supplémentaire (LES) en salle de bains : relie toutes les masses et éléments conducteurs.',
        ],
        chiffres: [
          'Résistance de terre ≤ 100 Ω (valeur de référence Consuel, issue du disjoncteur de branchement 500 mA / tension limite 50 V).',
          'Conducteur de terre : 16 mm² cuivre isolé, ou 25 mm² cuivre nu.',
          'LES salle de bains : 2,5 mm² cuivre si protégé (sous conduit), 4 mm² si non protégé. Continuité ≤ 2 Ω.',
        ],
        version: 'NF C 15-100 (valeurs stables).',
        source: 'https://www.installation-renovation-electrique.com/valeur-prise-de-terre-norme-100-ohms/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Parafoudre',
        intitule: 'Protection contre les surtensions',
        sapplique: 'Origine de l’installation (tableau) + réseau de communication.',
        pointsCles: [
          'Obligatoire selon la densité de foudroiement et le type d’alimentation (aérienne).',
          'Nouveauté 2024 : si un parafoudre protège la puissance et que le réseau communication est en cuivre, il faut aussi protéger ce réseau.',
          'Types : 1 (bâtiment avec paratonnerre), 2 (cas courant au tableau), 3 (près du matériel sensible).',
        ],
        chiffres: [
          'Obligatoire en zone AQ2 : Ng > 2,5 impacts/km²/an (ou Nk > 25 j/an) avec alimentation BT aérienne.',
          'Parafoudre complémentaire si matériel à protéger à plus de 10 m du parafoudre de tête.',
        ],
        version: 'NF C 15-100 révision 2024.',
        source: 'https://www.promotelec.com/actualite/serie-de-normes-nf-c15-100-2024-les-grandes-evolutions/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Hauteurs',
        intitule: 'Hauteurs réglementaires d’axe des appareillages',
        sapplique: 'Pose des prises, interrupteurs et tableau.',
        pointsCles: [
          'Hauteurs mesurées à l’axe de l’appareillage par rapport au sol fini.',
          'Commandes d’éclairage dans la fourchette accessible (PMR).',
          'Prises plan de travail cuisine au-dessus du plan, jamais au-dessus de l’évier ni des plaques.',
        ],
        chiffres: [
          'Prises 16 A : axe ≥ 5 cm du sol fini. Prises 32 A (plaque) : axe ≥ 12 cm.',
          'Interrupteurs / commandes : entre 0,90 m et 1,30 m (idéal ~1,10 m).',
          'Prises plan de travail : 8 à 25 cm au-dessus du plan.',
          'Tableau (GTL) : poignées des disjoncteurs entre 0,90 et 1,30 m ; bord supérieur ≤ 1,80 m.',
        ],
        version: 'NF C 15-100 (valeurs stables).',
        source: 'https://www.se.com/fr/fr/work/support/local/reglementation/norme-nfc15-100/chambre/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — Salle de bains',
        intitule: 'Volumes de sécurité dans les locaux avec baignoire/douche',
        sapplique: 'Neuf et rénovation, toute salle d’eau.',
        pointsCles: [
          'Découpage en volumes (0, 1, 2) selon la proximité de l’eau.',
          'Indice de protection (IP) minimal imposé par volume.',
          'Liaison équipotentielle supplémentaire (LES) obligatoire.',
          'Prises 230 V et prises commandées interdites au plus près du point d’eau (hors prise rasoir TBTS).',
        ],
        chiffres: [
          'Volume 0 : IPX7 — Volume 1 : IPX5 — Volume 2 : IPX4.',
          'Hors volumes : prises 230 V autorisées, sous différentiel 30 mA.',
        ],
        version: 'NF C 15-100 (exigences renforcées en 2024).',
        source: 'https://home.nexans.fr/salle-de-bain-ou-pieces-contenant-une-baignoire-douche-et-les-liaison-equipotentielle-supplementaire',
        confiance: 'haute',
        note: 'Vérifier l’IP exact par volume dans la dernière édition.',
      },
      {
        reference: 'NF C 15-100 — Réseau de communication',
        intitule: 'Câblage RJ45 / TV / fibre et coffret de communication',
        sapplique: 'Neuf et rénovation totale.',
        pointsCles: [
          'Câblage RJ45 généralisé (grade minimum réglementaire : Grade 2 ; Grade 3 conseillé pour la fibre).',
          'Le coffret de communication fait partie de la GTL.',
          'DTIo (point de terminaison optique) prévu pour la fibre, gaine en attente même sans raccordement.',
          'Au moins une prise RJ45 par pièce principale.',
        ],
        chiffres: [
          'Logement < 100 m² : 2 prises RJ45 au séjour + 1 par chambre.',
          'Logement ≥ 100 m² : 3 prises RJ45 au séjour.',
          'Coffret : mise à la terre + DTI/DTIo + répartiteur + au moins 4 socles RJ45.',
        ],
        version: 'NF C 15-100 (fibre/DTIo renforcés en 2024).',
        source: 'https://www.blog.123elec.com/norme-nf-c-15-100-reseau-de-communication/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100 — GTL / ETEL / tableau',
        intitule: 'Gaine et espace technique du logement, réserve du tableau',
        sapplique: 'Neuf et rénovation lourde.',
        pointsCles: [
          'ETEL = volume technique réservé du sol au plafond ; GTL = gaine regroupant arrivées, protections, distribution et communications.',
          'La GTL contient le tableau de répartition + le coffret de communication.',
          'Disjoncteur de branchement accessible depuis l’intérieur (calibre 60 A compatible Linky).',
        ],
        chiffres: [
          'ETEL : largeur ≥ 600 mm, profondeur ≥ 250 mm.',
          'Tableau : réserve ≥ 20 % de modules libres (individuel) ; ≥ 6 modules libres par rangée en collectif.',
        ],
        version: 'NF C 15-100 révision 2024.',
        source: 'https://www.legrand.fr/actualites/norme-nf-c-15-100-la-gtl-et-le-tableau-electrique',
        confiance: 'haute',
      },
      {
        reference: 'NF C 14-100',
        intitule: 'Installations de branchement à basse tension (partie amont)',
        sapplique: 'Entre le réseau public (Enedis) et le point de livraison. Domaine du gestionnaire de réseau.',
        pointsCles: [
          'Le disjoncteur de branchement est la frontière : amont = NF C 14-100 (Enedis) ; aval = NF C 15-100 (installateur).',
          'Couvre branchements individuels et collectifs, type (aérien/souterrain), section, comptage.',
          'Concerne surtout le neuf et les modifications (augmentation de puissance, passage mono→triphasé).',
        ],
        chiffres: ['Édition juillet 2021 (remplace 2011/2012/2014/2016). Co-éditée AFNOR + Enedis.'],
        version: 'NF C 14-100 (édition juillet 2021).',
        source: 'https://actualites.consuel.com/nouvelle-edition-de-la-norme-nf-c-14-100/',
        confiance: 'haute',
      },
      {
        reference: 'NF C 16-600',
        intitule: 'Diagnostic de l’installation électrique (existant)',
        sapplique: 'Vente ou location de logements dont l’installation a plus de 15 ans.',
        pointsCles: [
          'Examine 6 domaines de sécurité essentiels (disjoncteur accessible, différentiel adapté, protections par circuit, salle de bains, matériels vétustes, conducteurs non protégés).',
          'Réalisé par un diagnostiqueur certifié et assuré.',
          'Aboutit à un constat listant les anomalies.',
        ],
        chiffres: ['Obligatoire si installation > 15 ans. Validité : 3 ans (vente), 6 ans (location).'],
        version: 'NF C 16-600 en vigueur.',
        source: 'https://www.service-public.gouv.fr',
        confiance: 'haute',
      },
      {
        reference: 'NF C 15-100-7-722 (IRVE)',
        intitule: 'Recharge des véhicules électriques (bornes)',
        sapplique: 'Toute installation d’un point de recharge (résidentiel, copropriété, tertiaire).',
        pointsCles: [
          'Circuit dédié exclusif à la borne.',
          'Au-delà de 3,7 kW : installateur qualifié IRVE obligatoire.',
          'Protection des défauts continus : 30 mA type A admis SI détection 6 mA intégrée à la borne, sinon type B.',
          'En triphasé (11–22 kW) : type B en pratique.',
        ],
        chiffres: ['Seuil pro qualifié : 3,7 kW (décret n° 2017-26). Détection courant continu : 6 mA.'],
        version: 'NF C 15-100 partie 7-722 (référentiel unique depuis sept. 2025).',
        source: 'https://www.voltwork.fr/irve/norme-installation-borne-de-recharge/',
        confiance: 'haute',
        note: 'Appellations équivalentes rencontrées : NF C 15-722 / UTE C 15-722 / NF C 15-100-7-722.',
      },
      {
        reference: 'UTE C 15-712 (Photovoltaïque)',
        intitule: 'Installations photovoltaïques (partie courant continu)',
        sapplique: 'Complément de la NF C 15-100 dès qu’il y a des panneaux PV. Neuf et ajout sur existant.',
        pointsCles: [
          '15-712-1 : raccordé réseau sans stockage. 15-712-2 : autonome (site isolé). 15-712-3 : raccordé avec stockage.',
          'Ajoute les règles côté continu (DC) : câbles, protections, sectionnement, défaut d’isolement.',
          'Interrupteur-sectionneur DC obligatoire pour isoler la partie continue.',
          'Signalétique renforcée (le DC reste sous tension tant qu’il y a du soleil) + coupure d’urgence pompiers.',
        ],
        chiffres: ['15-712-1 : base 2013, guide complémentaire mis à jour janvier 2025. Attestation Consuel bleue (sans batterie) ou violette (avec batterie).'],
        version: 'UTE C 15-712-1/-2 (2013) ; XP C 15-712-3 (2019, expérimentale).',
        source: 'https://www.photovoltaique.info',
        confiance: 'moyenne',
        note: 'Vérifier l’intitulé exact de chaque partie sur AFNOR avant usage contractuel.',
      },
      {
        reference: 'NF C 13-100 / NF C 13-200 (HTA)',
        intitule: 'Postes de livraison et installations haute tension (tertiaire/industrie)',
        sapplique: 'Dès que la tension dépasse 1000 V AC. Tertiaire/industrie raccordé en HTA — jamais le résidentiel BT.',
        pointsCles: [
          '13-100 : poste de livraison alimenté par le réseau public HTA.',
          '13-200 : installations HT au-delà du poste (industrie, tertiaire, agricole).',
          'Exige des compétences et habilitations HT spécifiques (indices H).',
        ],
        chiffres: ['Seuil HT : > 1000 V AC (ou > 1500 V DC).'],
        version: 'NF C 13-100 (en cours de révision — vérifier l’édition) / NF C 13-200.',
        source: 'https://www.boutique.afnor.org',
        confiance: 'moyenne',
      },
      {
        reference: 'ERP & lieux de travail',
        intitule: 'Exigences supplémentaires (au-delà du résidentiel)',
        sapplique: 'Tout local recevant du public ou des travailleurs — la NF C 15-100 seule ne suffit pas.',
        pointsCles: [
          'Éclairage de sécurité obligatoire (balisage + ambiance), sur source de sécurité.',
          'Coupure d’urgence générale accessible aux secours, inaccessible au public.',
          'Conformité au Code du travail ; vérifications périodiques par organisme agréé.',
        ],
        chiffres: ['Autonomie éclairage de sécurité ≥ 1 h. Vérification périodique généralement annuelle.'],
        version: 'Règlement de sécurité ERP (arrêté 25/06/1980, articles EC/EL) + Code du travail.',
        source: 'https://www.legifrance.gouv.fr',
        confiance: 'moyenne',
        note: 'Aperçu / signal d’alerte : corpus réglementaire ERP à approfondir selon la catégorie.',
      },
    ],
    transverses: [
      'Assurance décennale obligatoire AVANT le premier chantier (loi Spinetta 1978).',
      'RC Pro fortement recommandée (dommages aux tiers avant réception).',
      'Attestation Consuel obligatoire avant mise sous tension : jaune (habitation), vert (locaux pro), bleu (production PV sans stockage), violet (avec stockage).',
      'Habilitation électrique (réf. NF C 18-510) obligatoire pour tout salarié intervenant : B1/B2/BR/BC… (BR = intervention BT générale).',
      'Certification IRVE obligatoire pour borne > 3,7 kW (décret 2017-26) — conditionne la prime ADVENIR.',
      'Pré-équipement IRVE (loi LOM) : 100 % des places en résidentiel neuf ≥ 10 places ; 20 % en tertiaire neuf.',
      'RGE obligatoire pour ouvrir droit aux aides (MaPrimeRénov’, CEE) ; Qualifelec valorisant.',
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

// ============================================================================
// Aide-mémoire « process & jalons » par métier (assistant de conformité).
// ----------------------------------------------------------------------------
// Architecture GÉNÉRIQUE : chaque métier PEUT avoir son aide-mémoire ; seul
// l'électricien est rempli aujourd'hui. Ajouter un métier plus tard = ajouter
// une entrée dans AIDE_MEMOIRE (la page Normes l'affichera automatiquement
// quand l'artisan sélectionne ce métier). Le contenu est orienté DÉMARCHES /
// JALONS (Consuel, schéma, étapes), PAS les points techniques détaillés (ceux-ci
// restent dans les fiches NORMES_METIERS, vers lesquelles on renvoie).
// Indicatif : ne certifie rien, l'artisan reste responsable de la conformité.
// ============================================================================

export type TravauxType = 'neuf' | 'reno_totale' | 'reno_partielle'
export type BatimentType = 'logement' | 'logement_social' | 'erp' | 'locaux_travail'

export const TRAVAUX_LABELS: Record<TravauxType, string> = {
  neuf: 'Neuf',
  reno_totale: 'Réno totale',
  reno_partielle: 'Réno partielle',
}

export const BATIMENT_LABELS: Record<BatimentType, string> = {
  logement: 'Logement',
  logement_social: 'Logement social',
  erp: 'ERP (public)',
  locaux_travail: 'Locaux de travail',
}

export interface JalonConformite {
  id: string
  intitule: string
  detail: string
  /** Contextes concernés ; absent = tous les types de travaux. */
  travaux?: TravauxType[]
  /** Contextes concernés ; absent = tous les types de bâtiment. */
  batiment?: BatimentType[]
  confiance: Confiance
  source?: string
}

export interface AideMemoireMetier {
  intro: string
  jalons: JalonConformite[]
}

/** Aide-mémoire par slug de métier. Seul 'electricien' est rempli au lancement. */
export const AIDE_MEMOIRE: Record<string, AideMemoireMetier> = {
  electricien: {
    intro:
      'Rappel des grandes démarches à ne pas oublier, selon le type de travaux et de bâtiment. Indicatif : ne remplace pas la lecture des normes ni l’avis du Consuel.',
    jalons: [
      {
        id: 'etude',
        intitule: 'Étude et dimensionnement',
        detail: 'Dimensionner l’installation (puissance, nombre de circuits, sections) avant de chiffrer.',
        confiance: 'haute',
      },
      {
        id: 'schema',
        intitule: 'Schéma unifilaire à jour',
        detail: 'Établir ou mettre à jour le schéma unifilaire du tableau de répartition.',
        travaux: ['neuf', 'reno_totale'],
        confiance: 'haute',
      },
      {
        id: 'gtl',
        intitule: 'GTL / ETEL à prévoir',
        detail: 'Prévoir la Gaine Technique Logement (emplacement, dimensions, réserve dans le tableau).',
        travaux: ['neuf', 'reno_totale'],
        batiment: ['logement', 'logement_social'],
        confiance: 'haute',
      },
      {
        id: 'securite_partielle',
        intitule: 'Mise en sécurité des circuits touchés',
        detail: 'En rénovation partielle, sécuriser les circuits modifiés : liaison à la terre et différentiel 30 mA.',
        travaux: ['reno_partielle'],
        confiance: 'haute',
      },
      {
        id: 'consuel_jaune',
        intitule: 'Attestation Consuel jaune (habitation)',
        detail:
          'Habitation : attestation Consuel jaune. Obligatoire en neuf et en rénovation totale ayant nécessité une mise hors tension par Enedis — à obtenir avant la (re)mise sous tension.',
        batiment: ['logement', 'logement_social'],
        confiance: 'haute',
        source: 'https://www.consuel.com',
      },
      {
        id: 'consuel_vert',
        intitule: 'Attestation Consuel verte (non domestique)',
        detail: 'Usage non domestique (ERP, locaux professionnels, parties communes) : attestation Consuel verte.',
        batiment: ['erp', 'locaux_travail'],
        confiance: 'haute',
        source: 'https://www.consuel.com',
      },
      {
        id: 'consuel_partielle',
        intitule: 'Consuel souvent non requis en réno partielle',
        detail:
          'Rénovation partielle sans coupure Enedis : pas d’attestation Consuel obligatoire en général. Conservez tout de même vos justificatifs.',
        travaux: ['reno_partielle'],
        batiment: ['logement', 'logement_social'],
        confiance: 'moyenne',
      },
      {
        id: 'verif_travail',
        intitule: 'Vérification initiale (locaux de travail)',
        detail:
          'Locaux de travail : vérification initiale de l’installation par un organisme accrédité (Code du travail), puis vérifications périodiques.',
        batiment: ['locaux_travail'],
        confiance: 'moyenne',
      },
      {
        id: 'erp_secu',
        intitule: 'ERP : éclairage de sécurité et contrôles',
        detail:
          'ERP : éclairage de sécurité (BAES) selon la catégorie et l’effectif, et vérification périodique annuelle par un organisme agréé.',
        batiment: ['erp'],
        confiance: 'moyenne',
      },
      {
        id: 'diagnostic',
        intitule: 'Diagnostic électrique (logement ancien)',
        detail:
          'Logement de plus de 15 ans mis en vente ou en location : un diagnostic électrique de sécurité peut être exigé.',
        travaux: ['reno_partielle', 'reno_totale'],
        batiment: ['logement', 'logement_social'],
        confiance: 'moyenne',
      },
    ],
  },
}

/** Retourne l'aide-mémoire d'un métier (ou undefined si pas encore couvert). */
export function getAideMemoire(slug: string): AideMemoireMetier | undefined {
  return AIDE_MEMOIRE[slug]
}

/** Filtre les jalons selon le type de travaux et de bâtiment choisis. */
export function filtrerJalons(
  am: AideMemoireMetier,
  travaux: TravauxType,
  batiment: BatimentType,
): JalonConformite[] {
  return am.jalons.filter(
    (j) =>
      (!j.travaux || j.travaux.includes(travaux)) &&
      (!j.batiment || j.batiment.includes(batiment)),
  )
}
