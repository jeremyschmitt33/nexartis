/**
 * Module Plan 2D — Types du schéma de données (Push 1, 03/07/2026)
 *
 * RÈGLES FONDAMENTALES (voir PLAN_2D_SPEC_V2_2026-07-02.md) :
 * - Toutes les longueurs sont en MILLIMÈTRES ENTIERS (jamais de flottants stockés).
 * - Les cotes sont "dans-œuvre" (intérieur fini, ce que mesure le télémètre).
 * - Le plan est agnostique du métier : le moteur calcule tout, les profils filtrent.
 * - Une ouverture mitoyenne = UN objet, référencé par ses deux pièces via
 *   `sharedWith` (l'heuristique "÷2" de la maquette est INTERDITE ici, cf. spec §6 bis).
 */

/** Point 2D en millimètres entiers : [x, y]. */
export type PointMm = [number, number];

/** Calques du plan : l'existant (ce qui est là) vs le projet (travaux futurs). */
export type CalqueId = 'existant' | 'projet';

/** Types d'ouvertures. `porte_fenetre` et `baie` touchent le sol (allège 0). */
export type TypeOuverture = 'porte' | 'fenetre' | 'porte_fenetre' | 'baie';

/** Mode de déduction des ouvertures pour la surface murale (règles pro par métier). */
export type ModeDeduction =
  | 'brute' // aucune déduction
  | 'totale' // toutes les ouvertures déduites (carreleur)
  | 'sup05' // seulement les ouvertures > 0,5 m² (usage peintre)
  | 'sup25'; // seulement les ouvertures > 2,5 m² (usage plaquiste / Placo)

/** Catégorie d'une zone : intérieur (compte dans la surface habitable) ou extérieur. */
export type CategorieZone = 'int' | 'ext';

/** Sous-type d'une zone extérieure. */
export type TypeExterieur = 'terrasse' | 'piscine' | 'pelouse' | 'autre_ext';

/**
 * État d'avancement d'une pièce sur le chantier (mode Avancement, Push 7).
 * Absent sur une pièce = 'a_faire' (rien n'a démarré, plan neutre).
 * 'termine' et 'receptionne' valent tous deux 100 % ; 'receptionne' marque
 * en plus l'acceptation du client (utile pour les situations et la preuve).
 */
export type EtatAvancement = 'a_faire' | 'en_cours' | 'termine' | 'receptionne';

/**
 * Ouverture (porte, fenêtre...) attachée à une arête d'une pièce.
 * `edgeIndex` : index de l'arête (sommet i -> sommet i+1) dans `vertices`.
 * `offset` : distance en mm du début de l'arête au bord gauche de l'ouverture.
 * `sillHeight` : hauteur d'allège en mm (0 = touche le sol).
 * `sharedWith` : id de la pièce voisine si l'ouverture est mitoyenne (une seule
 * déclaration pour les deux pièces — le comptage d'unités ne la compte qu'une fois,
 * mais la déduction de surface murale s'applique bien aux DEUX pièces).
 */
export interface Ouverture {
  id: string;
  type: TypeOuverture;
  edgeIndex: number;
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  sharedWith?: string | null;
}

/**
 * Pièce (ou zone extérieure). Polygone simple, sommets en mm entiers,
 * ordre anti-horaire (CCW) garanti par `normaliserCCW` à la création.
 */
export interface Piece {
  id: string;
  name: string;
  layer: CalqueId;
  cat: CategorieZone;
  extType?: TypeExterieur;
  vertices: PointMm[];
  /** Hauteur sous plafond en mm (défaut : heightDefault du niveau). */
  height: number;
  /** Déduction de surface au sol en m² (trémie d'escalier, poteau...). */
  deductionSolM2?: number;
  openings: Ouverture[];
  /**
   * État d'avancement du chantier pour cette pièce (mode Avancement, Push 7).
   * Optionnel et purement additif : les plans créés avant le Push 7 n'ont pas
   * ce champ (traités comme 'a_faire'). N'entre PAS dans les métrés (`computed`).
   */
  avancement?: EtatAvancement;
}

/** Clôture / grillage : polyligne OUVERTE (non fermée), métrée en ml. */
export interface Cloture {
  id: string;
  layer: CalqueId;
  points: PointMm[];
}

/** Symbole métier posé sur le plan (prise, radiateur, portail...). */
export interface Symbole {
  id: string;
  /** Type libre, ex. 'prise_16a', 'interrupteur', 'radiateur', 'portail'. */
  type: string;
  layer: CalqueId;
  position: PointMm;
  rotation: number;
  /** Pièce d'appartenance (pour les comptages par pièce, ex. NF C 15-100). */
  roomId?: string | null;
}

/** Niveau (RDC, Étage 1...). */
export interface Niveau {
  id: string;
  name: string;
  order: number;
  /** HSP par défaut du niveau en mm. */
  heightDefault: number;
  rooms: Piece[];
  clotures: Cloture[];
  symbols: Symbole[];
}

/** Document plan complet (stocké en JSONB dans `plans.data`). */
export interface PlanData {
  schemaVersion: 1;
  unit: 'mm';
  levels: Niveau[];
}

/** Lien vivant ligne de devis -> plan (colonne `devis_lignes.source_plan`). */
export interface SourcePlan {
  planId: string;
  revisionId: string | null;
  roomId: string | null;
  /** Métré injecté, ex. 'sol', 'murs', 'plafond', 'plinthes', 'cloture_ml'. */
  metric: string;
  /** false dès que l'artisan édite la ligne à la main ("lien rompu"). */
  lie: boolean;
  /**
   * Niveau d'origine du métré (Push 5). Sert à sélectionner la ou les images
   * de plan à afficher sur le devis. Optionnel : les lignes injectées avant
   * le Push 5 n'en ont pas (les rendus affichent alors toutes les images du plan).
   */
  niveauId?: string | null;
}

/** Métrés calculés d'une pièce (tout en unités finales : m², ml, u). */
export interface MetresPiece {
  solM2: number;
  plafondM2: number;
  perimetreMl: number;
  /** Surface murale selon les 4 modes de déduction. */
  mursM2: Record<ModeDeduction, number>;
  plinthesMl: number;
  /** Comptage d'ouvertures par type (les mitoyennes comptées UNE fois). */
  ouvertures: Record<TypeOuverture, number>;
}
