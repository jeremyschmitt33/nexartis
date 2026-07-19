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
  CategorieZone,
  Cloture,
  EtatAvancement,
  NatureZone,
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
  /**
   * Gris bleuté de la COTATION (14/07/2026). La cote recule d'un rang derrière
   * le bâti (en navy plein, elle concurrençait les murs).
   *
   * ⚠️ VALEUR PLANCHER — NE PAS ÉCLAIRCIR. Testé en prod : le #8794b0 initial
   * donnait un contraste de ~2,9:1 sur le fond clair → sous le seuil WCAG AA
   * (4,5:1), cotes fantômes. Or la cote est LA donnée de l'artisan (lue sur
   * chantier, parfois en plein soleil ou imprimée en N&B) : elle doit reculer
   * visuellement, jamais devenir difficile à lire. #64748b = ~4,6:1, conforme
   * AA, tout en restant nettement en retrait du navy #0f1a3a des murs.
   */
  cote: '#64748b',
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
 * Mode Avancement (Push 7) — méta par état d'avancement d'une pièce :
 *  - `label` / `court` : libellés d'interface.
 *  - `fill` : teinte de remplissage superposée au fond de la pièce sur le plan
 *    (rgba semi-transparent). `null` pour 'a_faire' → aucune teinte, plan neutre.
 *  - `pctSuggere` : pourcentage d'avancement SUGGÉRÉ (indicatif). ⚠️ Ce n'est
 *    PAS une base de facturation : le Push 7B ne facturera JAMAIS sur ce chiffre
 *    sans confirmation explicite de l'artisan (un « en cours » réel va de 10 %
 *    à 90 %). Le 50 est un point de départ modifiable, pas un montant.
 *
 * Couleurs choisies DISTINCTES pour éviter les collisions et aider les
 * daltoniens (le libellé texte du sélecteur reste la source de vérité) :
 *  - en_cours = violet (ne se confond pas avec l'orange du calque « projet »),
 *  - termine  = vert franc (plus saturé que le vert pelouse),
 *  - receptionne = bleu « validé » (distinct des verts et de la pelouse).
 * Hex/rgba autorisés ICI uniquement (même règle que COULEURS_PLAN).
 */
export const AVANCEMENT_META: Record<
  EtatAvancement,
  { label: string; court: string; fill: string | null; fillPlan: string | null; texte: string; pctSuggere: number }
> = {
  // `texte` = couleur SOLIDE (lisible) du libellé d'état affiché sur la pièce
  // (accessibilité daltonisme : la couleur seule ne suffit pas, cf. WCAG 1.4.1).
  // Alignée sur la palette sombre des badges de SituationParLigne (contraste).
  //
  // ⚠️ DEUX teintes distinctes depuis le 14/07/2026 :
  //  - `fill` : teinte SOUTENUE, utilisée par la VUE 3D (iso.ts) où le sol est
  //    largement masqué par les murs — il faut du punch pour qu'on la voie.
  //  - `fillPlan` : teinte DOUCE, utilisée par le PLAN 2D (PlanRender). L'aplat
  //    à 34 % repeignait la pièce entière : sur un T3 aux pièces terminées, le
  //    plan devenait un à-plat vert et le bâti n'était plus lisible. À 16 %,
  //    « ce qui est vert » reste évident (renforcé par le libellé en toutes
  //    lettres sur la pièce) sans tuer la lecture du plan.
  a_faire: { label: 'À faire', court: 'À faire', fill: null, fillPlan: null, texte: '#6b7280', pctSuggere: 0 },
  en_cours: { label: 'En cours', court: 'En cours', fill: 'rgba(139, 92, 246, 0.26)', fillPlan: 'rgba(139, 92, 246, 0.13)', texte: '#3C3489', pctSuggere: 50 },
  termine: { label: 'Terminé', court: 'Terminé', fill: 'rgba(52, 168, 102, 0.34)', fillPlan: 'rgba(52, 168, 102, 0.16)', texte: '#27500A', pctSuggere: 100 },
  receptionne: { label: 'Réceptionné', court: 'Réceptionné', fill: 'rgba(37, 99, 235, 0.28)', fillPlan: 'rgba(37, 99, 235, 0.14)', texte: '#0C447C', pctSuggere: 100 },
} as const

/** Ordre d'affichage du sélecteur d'avancement (du non-démarré au réceptionné). */
export const AVANCEMENT_ORDRE: readonly EtatAvancement[] = ['a_faire', 'en_cours', 'termine', 'receptionne'] as const

/** État d'avancement effectif d'une pièce (le défaut est 'a_faire'). */
export function avancementDe(p: { avancement?: EtatAvancement }): EtatAvancement {
  return p.avancement ?? 'a_faire'
}

/** Récapitulatif d'avancement d'un niveau (bandeau éditeur). */
export interface RecapAvancement {
  /** Nombre de pièces INTÉRIEURES (les zones ext ne sont pas des « pièces »). */
  total: number
  /** Pièces à 100 % (termine + receptionne). */
  faites: number
  /** Répartition par état (sur les pièces intérieures). */
  parEtat: Record<EtatAvancement, number>
  /** Avancement global 0..100, moyenne pondérée des pctSuggere. */
  pct: number
}

/**
 * Calcule le récap d'avancement d'un niveau. PUR (testable). Ne compte que les
 * pièces intérieures (`cat === 'int'`). Le pct global pondère chaque pièce par
 * son pctSuggere (a_faire 0, en_cours 50, termine/receptionne 100), ce qui
 * reflète honnêtement les pièces « en cours » — pas seulement les terminées.
 */
export function recapAvancement(
  rooms: { cat?: 'int' | 'ext'; layer?: 'existant' | 'projet'; avancement?: EtatAvancement }[],
): RecapAvancement {
  const parEtat: Record<EtatAvancement, number> = { a_faire: 0, en_cours: 0, termine: 0, receptionne: 0 }
  let sommePct = 0
  let total = 0
  for (const r of rooms) {
    // Pièces intérieures EXISTANTES seulement : les pièces « projet » (travaux
    // futurs) ne comptent pas dans l'avancement du chantier existant.
    if (r.cat !== 'int' || r.layer === 'projet') continue
    total += 1
    const etat = avancementDe(r)
    parEtat[etat] += 1
    sommePct += AVANCEMENT_META[etat].pctSuggere
  }
  return {
    total,
    faites: parEtat.termine + parEtat.receptionne,
    parEtat,
    pct: total > 0 ? Math.round(sommePct / total) : 0,
  }
}

/**
 * Teintes dérivées pour la VUE 3D isométrique (Push 6) : ombrage plat
 * 3 tons de la famille navy pour les murs (selon l'orientation de la
 * normale, faces avant/arrière et axes X/Y) + sol intérieur légèrement
 * plus soutenu que cream. Même règle que COULEURS_PLAN : hex uniquement,
 * et defaults.ts reste LE seul fichier du module où des hex sont écrits.
 */
export const COULEURS_ISO = {
  // Push polish 3D (14/07/2026) : contraste creusé (les 4 tons tenaient dans
  // une bande bleu-gris ultra pâle → volume illisible, effet « fil de fer
  // délavé »). Écart tonal élargi + sol intérieur réchauffé. Reste dans la
  // famille navy de la charte. Aucun impact devis (COULEURS_ISO n'est lu que
  // par la vue 3D iso.ts/Iso3dView, jamais par PlanRender ni l'export PNG/PDF).
  solInt: '#e7e2d4',
  murAvantX: '#9fb0d0',
  murAvantY: '#c4cfe6',
  murArriereX: '#b3c0dc',
  murArriereY: '#d7deee',
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

/** Sous-types extérieurs valides (source de vérité runtime). */
export const EXT_TYPES_VALIDES = ['terrasse', 'piscine', 'pelouse', 'autre_ext'] as const

/**
 * ⚠️ ALERTE UNIQUEMENT — NE DÉCIDE JAMAIS LA NATURE D'UNE ZONE.
 * Ancien `extTypeDe` (qui décidait la catégorie via le nom : bug « Grande
 * terrasse »). La nature est désormais posée par l'OUTIL (voir NatureZone +
 * catExtDepuisNature), jamais par le nom. Ne sert QU'À proposer un
 * avertissement doux dans RoomSheet quand un nom évoque l'extérieur alors que
 * la zone est classée intérieur. `includes` (et non `startsWith`) : large
 * exprès, car elle ne décide rien — elle suggère seulement de vérifier.
 */
export function nomEvoqueExterieur(nom: string): TypeExterieur | null {
  const n = nom.toLowerCase()
  if (n.includes('terrasse')) return 'terrasse'
  if (n.includes('piscine') || n.includes('bassin')) return 'piscine'
  if (n.includes('pelouse') || n.includes('gazon') || n.includes('jardin')) return 'pelouse'
  if (n.includes('balcon') || n.includes('cour') || n.includes('terrain') || n.includes('allée') || n.includes('allee')) return 'autre_ext'
  return null
}

/** Mappe la NATURE (décidée par l'outil) vers le couple plat cat/extType stocké. */
export function catExtDepuisNature(nature: NatureZone): { cat: CategorieZone; extType?: TypeExterieur } {
  return nature.kind === 'surface' ? { cat: 'ext', extType: nature.extType } : { cat: 'int' }
}

/**
 * Normalise la FORME d'une pièce venant de la base — JAMAIS sa nature.
 * - `cat` absent/invalide -> 'int' (défaut sûr) ; ne reclasse JAMAIS un 'int'
 *   ou 'ext' valide (ce serait re-deviner en silence = viol de la règle sacrée) ;
 * - surface sans sous-type valide -> 'autre_ext' ;
 * - pièce intérieure : on retire tout extType orphelin (inerte mais trompeur).
 * Purement défensif : aucune valeur légitime n'est modifiée.
 */
export function normaliserPieceForme(p: Piece): Piece {
  if (p.cat !== 'int' && p.cat !== 'ext') {
    // cat absent/corrompu : si un sous-type extérieur valide est présent, on le
    // respecte (surface) ; sinon défaut sûr en intérieur.
    if (EXT_TYPES_VALIDES.includes(p.extType as TypeExterieur)) {
      return { ...p, cat: 'ext', extType: p.extType as TypeExterieur }
    }
    const maj = { ...p }
    delete maj.extType
    maj.cat = 'int'
    return maj
  }
  if (p.cat === 'ext') {
    const extType = EXT_TYPES_VALIDES.includes(p.extType as TypeExterieur) ? (p.extType as TypeExterieur) : 'autre_ext'
    return p.extType === extType ? p : { ...p, extType }
  }
  if (p.extType === undefined) return p
  const maj = { ...p }
  delete maj.extType
  return maj
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

/**
 * mm -> valeur d'un champ de SAISIE, en mètres, SANS AUCUNE PERTE.
 * « 4500 » -> « 4,5 » ; « 4270 » -> « 4,27 » ; « 4275 » -> « 4,275 ».
 *
 * ⚠️⚠️ NE JAMAIS ARRONDIR ICI (bug corrigé le 14/07/2026, frère du bug
 * `redimensionnerParCote`). Cette chaîne n'est pas de l'affichage : c'est la
 * valeur d'un input que l'utilisateur peut réécrire en base au simple BLUR,
 * SANS avoir rien tapé (CoteInput, hauteur sous plafond de RoomSheet).
 * Avec l'ancien `Math.round(mm / 10) / 100`, rouvrir une cote de 4275 mm
 * juste pour la RELIRE la réécrivait à 4280 mm : 5 mm évaporés en silence.
 * Sur la HSP, l'effet était pire encore — elle multiplie tout le périmètre
 * en surface de peinture.
 *
 * Pour de l'AFFICHAGE (étiquettes du plan), utiliser fmtLongueurM/mmVersM :
 * là, arrondir est légitime.
 *
 * Sûr en flottant : tout entier mm (bien en deçà de 2^53) divisé par 1000
 * s'imprime exactement en décimal via String().
 */
export function mmVersSaisieM(mm: number): string {
  return String(mm / 1000).replace('.', ',')
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
    rooms: Array.isArray(niv.rooms) ? niv.rooms.map(normaliserPieceForme) : [],
    clotures: Array.isArray(niv.clotures) ? niv.clotures : [],
    symbols: Array.isArray(niv.symbols) ? niv.symbols : [],
  }))
  if (propres.length === 0) propres.push(niveauVide('RDC', 0))
  return { schemaVersion: 1, unit: 'mm', levels: propres }
}

/** Pièce rectangulaire (sommets CCW). Dimensions et position en mm. */
export function creerPieceRect(
  nature: NatureZone,
  name: string,
  layer: CalqueId,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  hsp: number
): Piece {
  return {
    id: genId(),
    name,
    layer,
    ...catExtDepuisNature(nature),
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
  nature: NatureZone,
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
  return {
    id: genId(),
    name,
    layer,
    ...catExtDepuisNature(nature),
    vertices: normaliserCCW(pts),
    height: hsp,
    openings: [],
  }
}

/** Pièce polygone libre à partir des points cliqués (déjà en mm). */
export function creerPiecePoly(
  nature: NatureZone,
  name: string,
  layer: CalqueId,
  points: PointMm[],
  hsp: number
): Piece {
  return {
    id: genId(),
    name,
    layer,
    ...catExtDepuisNature(nature),
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
