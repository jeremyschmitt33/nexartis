/**
 * Module Plan 2D — Constantes, valeurs par défaut et fabriques (Push 2, 03/07/2026)
 *
 * Fonctions PURES, zéro dépendance React. Les listes de types de pièces et
 * les dimensions d'ouvertures reprennent la maquette V2.1 validée par Jerem
 * (mockup_plan_2d_editeur_v2.html).
 *
 * ⚠️ COULEURS_PLAN : miroir unique des couleurs de `tailwind.config.ts`
 * (navy, orange, sky, cream). Les attributs SVG ne peuvent pas recevoir de
 * classes Tailwind si l'on veut un rendu exportable tel quel en PNG/PDF
 * (Push 4) : c'est LE seul endroit du module où des hex sont écrits.
 */

import type {
  CalqueId,
  Cloture,
  Niveau,
  Ouverture,
  Piece,
  PlanData,
  PointMm,
  TypeExterieur,
  TypeOuverture,
} from './types'
import { normaliserCCW, rectanglePolygone } from './geometry'

/** Pas de la grille d'aimantation, en mm (10 cm). */
export const GRILLE_MM = 100
/** Seuil d'aimantation aux bords des pièces voisines, en mm. */
export const AIMANT_MM = 150
/** Hauteur sous plafond par défaut, en mm. */
export const HSP_DEFAUT_MM = 2500
/** Dimensions min/max d'un côté de pièce à la création, en mm. */
export const COTE_MIN_MM = 500
export const COTE_MAX_MM = 30000
/** Distance de fermeture du polygone (clic près du 1er point), en mm. */
export const FERMETURE_POLY_MM = 300

/** Couleurs du plan — miroir de tailwind.config.ts (voir en-tête du fichier). */
export const COULEURS_PLAN = {
  navy: '#0f1a3a',
  navyMid: '#1a2d5a',
  orange: '#e87a2a',
  sky: '#5ab4e0',
  cream: '#f0ede4',
  fond: '#f6f8fb',
  grille: '#e3e9f2',
  blanc: '#ffffff',
  /**
   * ENTORSE PALETTE DOCUMENTÉE (spec V2 §8 bis, maquette V2.1 validée) :
   * vert pelouse, absent de tailwind.config.ts, réservé au trait des zones
   * « Pelouse » du plan. Le fond utilise pelouseFond (12 % d'opacité).
   */
  pelouse: '#7dba8a',
  pelouseFond: 'rgba(125, 186, 138, 0.12)',
  /** Fond des piscines : sky à 18 % (maquette V2.1). */
  piscineFond: 'rgba(90, 180, 224, 0.18)',
} as const

/**
 * Teintes dérivées pour la VUE 3D isométrique (Push 6) : ombrage plat
 * 3 tons de la famille navy pour les murs (selon l'orientation de la
 * normale, faces avant/arrière et axes X/Y) + sol intérieur légèrement
 * plus soutenu que cream. Même règle que COULEURS_PLAN : hex uniquement,
 * et defaults.ts reste LE seul fichier du module où des hex sont écrits.
 */
export const COULEURS_ISO = {
  solInt: '#efece2',
  murAvantX: '#c8d1e4',
  murAvantY: '#e2e7f1',
  murArriereX: '#dbe1ee',
  murArriereY: '#eef1f7',
} as const

/** 8 types de pièces les plus fréquents (chips visibles). */
export const CHIPS_BASE = [
  'Salon',
  'Cuisine',
  'Chambre',
  'Salle de bain',
  'WC',
  'Entrée',
  'Couloir',
  'Garage',
] as const

/** Types supplémentaires derrière « Voir tout » (maquette V2.1). */
export const CHIPS_PLUS = [
  'Séjour',
  "Salle d'eau",
  'Dégagement',
  'Bureau',
  'Buanderie',
  'Cellier',
  'Dressing',
  'Cave',
  'Combles',
  'Mezzanine',
  'Véranda',
  'Terrasse',
  'Piscine',
  'Pelouse',
  'Balcon',
  'Local technique',
  'Escalier',
] as const

/** Dimensions par défaut des ouvertures (spec Push 2). */
export const OUVERTURE_DEFAUTS: Record<
  TypeOuverture,
  { label: string; width: number; height: number; sillHeight: number }
> = {
  porte: { label: 'Porte', width: 830, height: 2040, sillHeight: 0 },
  fenetre: { label: 'Fenêtre', width: 1400, height: 1250, sillHeight: 900 },
  porte_fenetre: { label: 'Porte-fenêtre', width: 2000, height: 2150, sillHeight: 0 },
  baie: { label: 'Baie vitrée', width: 2400, height: 2150, sillHeight: 0 },
}

/** Identifiant unique (crypto.randomUUID avec repli — même pattern que lib/rapport). */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/** « Chambre » -> « Chambre 2 » si le nom existe déjà dans la liste. */
export function nomAvecSuffixe(base: string, existants: string[]): string {
  if (!existants.includes(base)) return base
  let n = 2
  while (existants.includes(base + ' ' + n)) n++
  return base + ' ' + n
}

/** Déduit le sous-type extérieur à partir du nom choisi (Terrasse, Piscine...). */
export function extTypeDe(nom: string): TypeExterieur | null {
  const n = nom.toLowerCase()
  if (n.startsWith('terrasse')) return 'terrasse'
  if (n.startsWith('piscine')) return 'piscine'
  if (n.startsWith('pelouse') || n.startsWith('gazon') || n.startsWith('jardin')) return 'pelouse'
  if (n.startsWith('balcon')) return 'autre_ext'
  return null
}

/**
 * Lit une saisie en mètres à la française (« 3,5 », « 3.50 », «  4 ») et
 * retourne des MILLIMÈTRES ENTIERS, ou null si la saisie est invalide.
 */
export function lireMetresEnMm(saisie: string): number | null {
  const brut = saisie.trim().replace(',', '.').replace(/\s+/g, '')
  if (brut === '') return null
  const m = Number(brut)
  if (!Number.isFinite(m) || m <= 0) return null
  return Math.round(m * 1000)
}

/** mm -> saisie en mètres pour un input (« 4500 » -> « 4,5 »). */
export function mmVersSaisieM(mm: number): string {
  const m = Math.round(mm / 10) / 100
  return String(m).replace('.', ',')
}

/** Niveau vide (RDC, Étage 1...). */
export function niveauVide(name: string, order: number): Niveau {
  return {
    id: genId(),
    name,
    order,
    heightDefault: HSP_DEFAUT_MM,
    rooms: [],
    clotures: [],
    symbols: [],
  }
}

/** Document plan vide avec un RDC prêt à l'emploi. */
export function planDataVide(): PlanData {
  return { schemaVersion: 1, unit: 'mm', levels: [niveauVide('RDC', 0)] }
}

/**
 * Valide/normalise un `plans.data` venant de la base : garantit au moins un
 * niveau et les tableaux attendus (données créées par défaut en SQL = levels []).
 */
export function normaliserPlanData(brut: unknown): PlanData {
  const d = (brut ?? {}) as Partial<PlanData>
  const levels = Array.isArray(d.levels) ? d.levels : []
  const propres: Niveau[] = levels.map((niv, i) => ({
    id: typeof niv.id === 'string' && niv.id ? niv.id : genId(),
    name: typeof niv.name === 'string' && niv.name ? niv.name : 'Niveau ' + (i + 1),
    order: typeof niv.order === 'number' ? niv.order : i,
    heightDefault:
      typeof niv.heightDefault === 'number' && niv.heightDefault > 0
        ? niv.heightDefault
        : HSP_DEFAUT_MM,
    rooms: Array.isArray(niv.rooms) ? niv.rooms : [],
    clotures: Array.isArray(niv.clotures) ? niv.clotures : [],
    symbols: Array.isArray(niv.symbols) ? niv.symbols : [],
  }))
  if (propres.length === 0) propres.push(niveauVide('RDC', 0))
  return { schemaVersion: 1, unit: 'mm', levels: propres }
}

/** Pièce rectangulaire (sommets CCW). Dimensions et position en mm. */
export function creerPieceRect(
  name: string,
  layer: CalqueId,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  hsp: number
): Piece {
  const ext = extTypeDe(name)
  return {
    id: genId(),
    name,
    layer,
    cat: ext ? 'ext' : 'int',
    ...(ext ? { extType: ext } : {}),
    vertices: rectanglePolygone(x, y, largeur, hauteur),
    height: hsp,
    openings: [],
  }
}

/**
 * Pièce en L : rectangle largeur × hauteur avec une encoche en bas à droite
 * de cutW × cutH (comme la maquette : découpe = moitié arrondie à la grille).
 */
export function creerPieceL(
  name: string,
  layer: CalqueId,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  hsp: number
): Piece {
  const cutW = Math.max(400, Math.round(largeur / 2 / GRILLE_MM) * GRILLE_MM)
  const cutH = Math.max(400, Math.round(hauteur / 2 / GRILLE_MM) * GRILLE_MM)
  const pts: PointMm[] = [
    [x, y],
    [x + largeur, y],
    [x + largeur, y + hauteur - cutH],
    [x + largeur - cutW, y + hauteur - cutH],
    [x + largeur - cutW, y + hauteur],
    [x, y + hauteur],
  ]
  const ext = extTypeDe(name)
  return {
    id: genId(),
    name,
    layer,
    cat: ext ? 'ext' : 'int',
    ...(ext ? { extType: ext } : {}),
    vertices: normaliserCCW(pts),
    height: hsp,
    openings: [],
  }
}

/** Pièce polygone libre à partir des points cliqués (déjà en mm). */
export function creerPiecePoly(
  name: string,
  layer: CalqueId,
  points: PointMm[],
  hsp: number
): Piece {
  const ext = extTypeDe(name)
  return {
    id: genId(),
    name,
    layer,
    cat: ext ? 'ext' : 'int',
    ...(ext ? { extType: ext } : {}),
    vertices: normaliserCCW(points),
    height: hsp,
    openings: [],
  }
}

/** Clôture / grillage : polyligne OUVERTE (points en mm entiers), métrée en ml. */
export function creerCloture(layer: CalqueId, points: PointMm[]): Cloture {
  return {
    id: genId(),
    layer,
    points: points.map(([x, y]): PointMm => [Math.round(x), Math.round(y)]),
  }
}

/** Ouverture par défaut d'un type donné, prête à poser (edgeIndex/offset à fournir). */
export function creerOuverture(type: TypeOuverture, edgeIndex: number, offset: number): Ouverture {
  const d = OUVERTURE_DEFAUTS[type]
  return {
    id: genId(),
    type,
    edgeIndex,
    offset,
    width: d.width,
    height: d.height,
    sillHeight: d.sillHeight,
    sharedWith: null,
  }
}
