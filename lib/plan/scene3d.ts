/**
 * Module Plan — Géométrie 3D RÉELLE (Étape 1 « vraie 3D orbitable », 21/07/2026)
 *
 * Fonctions PURES, zéro dépendance three.js / React. Sœur de `lib/plan/iso.ts`
 * mais d'une nature différente :
 *
 *  - `iso.ts` PROJETTE déjà le monde 3D en 2D (formule axonométrique figée) et
 *    trie les faces à la main (painter's algorithm) : c'est une image fixe,
 *    d'où l'impossibilité de tourner à la souris dont se plaint l'artisan.
 *  - `scene3d.ts` émet au contraire de VRAIS sommets 3D en mètres (repère
 *    Y-haut, centré sur l'origine). Aucune projection, aucun tri : c'est le GPU
 *    (via three.js dans Scene3dView) qui projette et gère la profondeur avec son
 *    tampon de profondeur. On peut donc orbiter librement.
 *
 * REPÈRE MONDE (mètres, Y vers le haut — convention three.js / OrbitControls) :
 *   worldX = (planX − cx) / 1000     (droite)
 *   worldY =  z / 1000                (hauteur ; sol à 0)
 *   worldZ = (planY − cy) / 1000      (profondeur ; garde l'orientation de la 2D)
 * où (cx, cy) est le centre du niveau en mm : le modèle est CENTRÉ sur l'origine
 * pour qu'OrbitControls tourne autour de son milieu.
 *
 * CE MODULE NE DÉCIDE RIEN DE MÉTIER. Il ne lit aucun prix, ne touche aucun
 * devis. Il n'invente aucune hauteur : les symboles muraux sans hauteur saisie
 * restent « inconnus » (tige pointillée, glyphe au sol), jamais coulés à une
 * valeur plausible. Même règle sacrée que iso.ts.
 *
 * PARITÉ VOULUE avec iso.ts (mêmes découpes d'ouvertures, mêmes cas de symboles)
 * MAIS deux écarts ASSUMÉS, rendus possibles par la vraie 3D :
 *  1. Murs OPAQUES (iso les mettait à 85 % pour « voir dedans » faute de pouvoir
 *     tourner). Ici on tourne : des murs opaques donnent un rendu franc, et
 *     l'éclairage directionnel recrée seul le dégradé 3 tons (chaque mur reçoit
 *     la lumière selon son orientation) — plus besoin de le peindre à la main.
 *  2. Aucun quart-de-tour pré-appliqué : la rotation est celle de la caméra.
 */

import type { CalqueId, Niveau, Ouverture, Piece } from './types'
import { AVANCEMENT_META, COULEURS_PLAN, avancementDe } from './defaults'
import { centreMm, fmtNombreFr } from './geometry'
import { hauteurDe } from './hauteurs'
import { surfaceSolM2 } from './metrics'
import { bornesNiveau } from './viewport'

const C = COULEURS_PLAN

/** Couleur de base des murs (l'éclairage directionnel fait le dégradé 3D). */
const COULEUR_MUR = '#cdd6e8'
/** Sol intérieur : même teinte chaude que la vue iso (COULEURS_ISO.solInt). */
const COULEUR_SOL_INT = '#e7e2d4'

/** Hauteur des poteaux de clôture (mm) — repris d'iso.ts. */
const POTEAU_HAUTEUR_MM = 900
/** Espacement des poteaux le long de la clôture (mm) — repris d'iso.ts. */
const PAS_POTEAU_MM = 1600

/**
 * Épaisseur donnée aux murs en 3D (mm). Les sommets d'une pièce sont les cotes
 * INTÉRIEURES finies : le mur est centré sur l'arête (±moitié de chaque côté),
 * ce qui suffit pour un rendu de présentation. Ce n'est PAS une donnée métier
 * (aucun métré ne l'utilise), juste du relief visuel. ~120 mm ≈ une cloison.
 */
const EPAISSEUR_MUR_MM = 120

/** Point du monde 3D en mètres (Y vers le haut). */
export interface V3 {
  x: number
  y: number
  z: number
}

/** Quadrilatère plan (4 sommets monde). Le composant en fait 2 triangles. */
export type Quad3 = [V3, V3, V3, V3]

/**
 * Sol d'une pièce ou zone : contour 2D en mètres dans le plan du sol
 * (couples [worldX, worldZ]). Le composant triangule via THREE.Shape.
 * `yOffset` empile les surfaces superposées (teinte d'avancement) sans
 * bagarre de profondeur (« z-fighting »).
 */
export interface Sol3d {
  contour: [number, number][]
  couleur: string
  opacite: number
  /** Id de la pièce si ce sol est SÉLECTIONNABLE au clic (sols de base des
   * pièces ; absent sur les surfaces superposées comme la teinte d'avancement,
   * qui ne doivent ni intercepter le clic ni être sélectionnées). */
  pieceId?: string
  /** Couleur du liseré de contour (silhouette franche), absent = pas de liseré. */
  bord?: string
  yOffset: number
}

/** Lot de murs opaques d'un calque (fusionnés en une géométrie côté composant). */
export interface MursLot3d {
  quads: Quad3[]
  couleur: string
  opacite: number
}

/** Vitre (fenêtre/baie) : quad translucide bleu ciel. */
export interface Vitre3d {
  quad: Quad3
}

/** Clôture : rail (polyligne au sol) + poteaux verticaux courts. */
export interface Cloture3d {
  rail: V3[]
  poteaux: [V3, V3][]
  couleur: string
}

/**
 * Symbole rendu par le composant : glyphe (billboard face caméra pour les
 * muraux, à plat au sol sinon) + éventuelle tige verticale. On n'invente
 * aucune hauteur (cf. `hauteurDe`).
 */
export interface Symbole3d {
  type: string
  couleur: string
  at: V3
  pose: 'billboard' | 'sol'
  rotationDeg: number
  tige?: { a: V3; b: V3; dash: boolean; opacite: number }
}

/** Étiquette d'une pièce : nom + surface + hauteur, plaquée face caméra. */
export interface Etiquette3d {
  at: V3
  nom: string
  aire: string
  hauteur: string
  couleur: string
  etat?: { court: string; couleur: string }
}

/** Tout le contenu d'un calque (existant / projet). */
export interface Calque3d {
  sols: Sol3d[]
  murs: MursLot3d[]
  vitres: Vitre3d[]
  clotures: Cloture3d[]
  symboles: Symbole3d[]
  etiquettes: Etiquette3d[]
}

/** Scène 3D complète (deux calques) + cadrage caméra. */
export interface Scene3dData {
  existant: Calque3d
  projet: Calque3d
  /** Emprise au sol en mètres (repère centré) pour la grille, ou null si vide. */
  emprise: { minX: number; maxX: number; minZ: number; maxZ: number } | null
  /** Rayon englobant en mètres (place la caméra), au moins 2 m. */
  rayon: number
  /** Hauteur du plus haut mur en mètres (cadrage vertical), au moins 2,5 m. */
  hauteurMax: number
}

function calqueVide(): Calque3d {
  return { sols: [], murs: [], vitres: [], clotures: [], symboles: [], etiquettes: [] }
}

/** Ouverture normalisée (bornée à l'arête et à la HSP) — repris d'iso.ts. */
interface OuvNorm {
  offset: number
  width: number
  sill: number
  top: number
  vitre: boolean
}

function normaliserOuverture(o: Ouverture, longueurMm: number, hsp: number): OuvNorm | null {
  if (o.offset < 0 || o.width <= 0 || o.offset + o.width > longueurMm) return null
  const sill = Math.max(0, Math.min(o.sillHeight, hsp))
  const top = Math.min(hsp, sill + o.height)
  if (top <= sill) return null
  return { offset: o.offset, width: o.width, sill, top, vitre: o.type !== 'porte' }
}

/** Couleur + opacité du sol d'une pièce/zone (parité teintes iso, opacités
 * relevées pour l'extérieur : au sol d'une 3D, 12 % serait invisible). */
function solDe(piece: Piece): { couleur: string; opacite: number; bord?: string } {
  const projet = piece.layer === 'projet'
  if (projet) return { couleur: C.orange, opacite: 0.18, bord: C.orange }
  if (piece.cat === 'ext') {
    if (piece.extType === 'piscine') return { couleur: C.sky, opacite: 0.45, bord: C.sky }
    if (piece.extType === 'pelouse') return { couleur: C.pelouse, opacite: 0.4, bord: C.pelouse }
    if (piece.extType === 'allee') return { couleur: '#c9c4bb', opacite: 0.8, bord: C.navy }
    return { couleur: C.blanc, opacite: 0.85, bord: C.navy }
  }
  return { couleur: COULEUR_SOL_INT, opacite: 1, bord: C.navy }
}

/**
 * Construit la géométrie 3D réelle du niveau. `options.avancementVisible`
 * superpose la teinte d'avancement (même `fill` soutenu que la vue iso).
 */
export function construireScene3dReelle(
  niveau: Niveau,
  options?: { avancementVisible?: boolean },
): Scene3dData {
  const avancementVisible = options?.avancementVisible === true
  const calques: Record<CalqueId, Calque3d> = { existant: calqueVide(), projet: calqueVide() }

  const bn = bornesNiveau(niveau)
  if (!bn) return { existant: calques.existant, projet: calques.projet, emprise: null, rayon: 2, hauteurMax: 2.5 }

  const cx = (bn.x1 + bn.x2) / 2
  const cy = (bn.y1 + bn.y2) / 2

  /** Sommet monde en mètres, centré, Y-haut. */
  const P = (xMm: number, yMm: number, zMm: number): V3 => ({
    x: (xMm - cx) / 1000,
    y: zMm / 1000,
    z: (yMm - cy) / 1000,
  })

  /** HSP réelle par pièce (résolution des tiges plafond/inconnue). */
  const hspParPiece = new Map<string, number>()
  let hauteurMaxMm = 2500

  // ── Pièces : sols, murs découpés, vitres, étiquettes ──────────────────────
  for (const piece of niveau.rooms) {
    const hsp = piece.height > 0 ? piece.height : niveau.heightDefault
    hspParPiece.set(piece.id, hsp)
    const sc = calques[piece.layer]
    const verts = piece.vertices
    const n = verts.length
    if (n < 3) continue

    const contour = verts.map((v): [number, number] => [(v[0] - cx) / 1000, (v[1] - cy) / 1000])
    const stylesSol = solDe(piece)
    sc.sols.push({ contour, couleur: stylesSol.couleur, opacite: stylesSol.opacite, bord: stylesSol.bord, yOffset: 0, pieceId: piece.id })

    // Teinte d'avancement (parité 2D/iso) : superposée, sans liseré, calque
    // existant seulement, au-dessus de son sol.
    if (avancementVisible && piece.layer !== 'projet') {
      const teinte = AVANCEMENT_META[avancementDe(piece)].fill
      if (teinte) {
        const { hex, alpha } = rgbaVersHexAlpha(teinte)
        sc.sols.push({ contour, couleur: hex, opacite: alpha, yOffset: 0.004 })
      }
    }

    // Zones extérieures : à plat uniquement (pas de murs, pas d'étiquette 3D).
    if (piece.cat !== 'int') continue
    if (hsp > hauteurMaxMm) hauteurMaxMm = hsp

    // Ouvertures groupées par arête (le modèle porte edgeIndex + offset).
    const parArete = new Map<number, Ouverture[]>()
    for (const o of piece.openings) {
      if (o.edgeIndex < 0 || o.edgeIndex >= n) continue
      const liste = parArete.get(o.edgeIndex) ?? []
      liste.push(o)
      parArete.set(o.edgeIndex, liste)
    }

    const quads: Quad3[] = []
    const half = EPAISSEUR_MUR_MM / 2
    for (let i = 0; i < n; i++) {
      const a = verts[i]
      const b = verts[(i + 1) % n]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const L = Math.hypot(dx, dy)
      if (L < 1) continue
      const ux = dx / L
      const uy = dy / L
      // Normale horizontale de l'arête (direction de l'épaisseur du mur).
      const nx = uy
      const ny = -ux

      /** Surface CENTRALE du mur (sans épaisseur) — utilisée pour les vitres. */
      const quad = (t1: number, t2: number, z1: number, z2: number): Quad3 => {
        const x1 = a[0] + ux * t1
        const y1 = a[1] + uy * t1
        const x2 = a[0] + ux * t2
        const y2 = a[1] + uy * t2
        return [P(x1, y1, z1), P(x2, y1, z1), P(x2, y2, z2), P(x1, y2, z2)]
      }

      /** Sommet du mur ÉPAIS : décalé de s·half le long de la normale (s = ±1). */
      const q = (t: number, z: number, s: number): V3 =>
        P(a[0] + ux * t + s * half * nx, a[1] + uy * t + s * half * ny, z)

      /**
       * Les 6 faces d'un tronçon de mur ÉPAIS (t1..t2, z1..z2). C'est ce qui
       * donne le relief plein ET les TABLEAUX d'ouverture : le dessous d'un
       * linteau et les côtés (jambages) d'une baie deviennent visibles.
       * DoubleSide dans la vue -> le sens d'enroulement n'affecte pas l'affichage.
       */
      const boxFaces = (t1: number, t2: number, z1: number, z2: number): Quad3[] => {
        const A1o = q(t1, z1, 1), B1o = q(t2, z1, 1), B2o = q(t2, z2, 1), A2o = q(t1, z2, 1)
        const A1i = q(t1, z1, -1), B1i = q(t2, z1, -1), B2i = q(t2, z2, -1), A2i = q(t1, z2, -1)
        return [
          [A1o, B1o, B2o, A2o], // face extérieure
          [B1i, A1i, A2i, B2i], // face intérieure
          [A2o, B2o, B2i, A2i], // dessus (arase)
          [B1o, A1o, A1i, B1i], // dessous
          [A1i, A1o, A2o, A2i], // about côté t1 (tableau)
          [B1o, B1i, B2i, B2o], // about côté t2 (tableau)
        ]
      }

      /**
       * Tronçon de mur PLEIN (0..hsp). Aux VRAIS coins de la pièce (début t=0 /
       * fin t=L de l'arête), on prolonge de `half` : les deux murs perpendiculaires
       * se chevauchent alors franchement au lieu de laisser une petite marche à
       * l'angle. Invisible ailleurs (même couleur), corrige le défaut d'angle.
       */
      const mur = (t1: number, t2: number): Quad3[] =>
        boxFaces(t1 === 0 ? -half : t1, t2 === L ? L + half : t2, 0, hsp)

      const ouvertures = (parArete.get(i) ?? [])
        .map((o) => normaliserOuverture(o, L, hsp))
        .filter((o): o is OuvNorm => o !== null)
        .sort((u, v) => u.offset - v.offset)

      let cur = 0
      for (const o of ouvertures) {
        if (o.offset < cur) continue // chevauchement : 2e ouverture ignorée (parité iso)
        if (o.offset > cur) quads.push(...mur(cur, o.offset))
        const fin = o.offset + o.width
        if (o.sill > 0) quads.push(...boxFaces(o.offset, fin, 0, o.sill)) // sous l'allège
        if (o.top < hsp) quads.push(...boxFaces(o.offset, fin, o.top, hsp)) // linteau
        if (o.vitre) sc.vitres.push({ quad: quad(o.offset, fin, o.sill, o.top) })
        cur = fin
      }
      if (cur < L) quads.push(...mur(cur, L))
    }
    const projet = piece.layer === 'projet'
    sc.murs.push({ quads, couleur: projet ? C.orange : COULEUR_MUR, opacite: projet ? 0.5 : 1 })

    const [ex, ey] = centreMm(piece.vertices)
    sc.etiquettes.push({
      at: P(ex, ey, Math.min(hsp * 0.5, 1300)),
      nom: piece.name,
      aire: fmtNombreFr(surfaceSolM2(piece), 1) + ' m²',
      hauteur: 'H ' + fmtNombreFr(hsp / 1000, 2) + ' m',
      couleur: projet ? C.orange : C.navy,
    })
  }

  // ── Clôtures : rail au sol + poteaux verticaux courts ─────────────────────
  for (const cl of niveau.clotures) {
    if (cl.points.length < 2) continue
    const sc = calques[cl.layer]
    const couleur = cl.layer === 'projet' ? C.orange : C.navy
    const rail = cl.points.map((p) => P(p[0], p[1], 0))
    const poteaux: [V3, V3][] = []
    for (let i = 0; i < cl.points.length - 1; i++) {
      const [x1, y1] = cl.points[i]
      const [x2, y2] = cl.points[i + 1]
      const L = Math.hypot(x2 - x1, y2 - y1)
      if (L < 1) continue
      for (let k = 0; k * PAS_POTEAU_MM <= L; k++) {
        const t = (k * PAS_POTEAU_MM) / L
        const x = x1 + (x2 - x1) * t
        const y = y1 + (y2 - y1) * t
        poteaux.push([P(x, y, 0), P(x, y, POTEAU_HAUTEUR_MM)])
      }
    }
    sc.clotures.push({ rail, poteaux, couleur })
  }

  // ── Symboles : muraux sur tige / plafond / sol (aucune hauteur inventée) ───
  for (const s of niveau.symbols) {
    const sc = calques[s.layer]
    const couleur = s.layer === 'projet' ? C.orange : C.navy
    const info = hauteurDe(s)
    const rot = s.rotation || 0

    if (info.kind === 'mural') {
      const hMur = info.mm
      sc.symboles.push({
        type: s.type,
        couleur,
        at: P(s.position[0], s.position[1], hMur),
        pose: 'billboard',
        rotationDeg: 0,
        tige: { a: P(s.position[0], s.position[1], 0), b: P(s.position[0], s.position[1], hMur), dash: false, opacite: 0.55 },
      })
      continue
    }

    if (info.kind === 'mural-inconnue') {
      const hsp = (s.roomId ? hspParPiece.get(s.roomId) : undefined) ?? niveau.heightDefault
      sc.symboles.push({
        type: s.type,
        couleur,
        at: P(s.position[0], s.position[1], 0),
        pose: 'billboard',
        rotationDeg: 0,
        tige: { a: P(s.position[0], s.position[1], 0), b: P(s.position[0], s.position[1], hsp), dash: true, opacite: 0.3 },
      })
      continue
    }

    if (info.kind === 'plafond') {
      const hsp = (s.roomId ? hspParPiece.get(s.roomId) : undefined) ?? niveau.heightDefault
      sc.symboles.push({
        type: s.type,
        couleur,
        at: P(s.position[0], s.position[1], hsp),
        pose: 'sol',
        rotationDeg: rot,
        tige: { a: P(s.position[0], s.position[1], 0), b: P(s.position[0], s.position[1], hsp), dash: true, opacite: 0.35 },
      })
      continue
    }

    // info.kind === 'sol' — WC, évier, portail... : glyphe à plat au sol.
    sc.symboles.push({
      type: s.type,
      couleur,
      at: P(s.position[0], s.position[1], 0),
      pose: 'sol',
      rotationDeg: rot,
    })
  }

  const largeurM = (bn.x2 - bn.x1) / 1000
  const profondeurM = (bn.y2 - bn.y1) / 1000
  const rayon = Math.max(2, 0.5 * Math.hypot(largeurM, profondeurM))
  const emprise = {
    minX: (bn.x1 - cx) / 1000,
    maxX: (bn.x2 - cx) / 1000,
    minZ: (bn.y1 - cy) / 1000,
    maxZ: (bn.y2 - cy) / 1000,
  }

  return {
    existant: calques.existant,
    projet: calques.projet,
    emprise,
    rayon,
    hauteurMax: Math.max(2.5, hauteurMaxMm / 1000),
  }
}

/**
 * Convertit une chaîne `rgba(r, g, b, a)` (celles d'AVANCEMENT_META) en
 * { hex, alpha } : three.js sépare la couleur (hex) de l'opacité (matériau).
 * Repli neutre si la forme n'est pas reconnue (jamais d'exception).
 */
function rgbaVersHexAlpha(rgba: string): { hex: string; alpha: number } {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/)
  if (!m) return { hex: '#888888', alpha: 0.3 }
  const to2 = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  const hex = '#' + to2(parseInt(m[1], 10)) + to2(parseInt(m[2], 10)) + to2(parseInt(m[3], 10))
  const alpha = m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1
  return { hex, alpha }
}
