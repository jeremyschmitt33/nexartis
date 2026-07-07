/**
 * Module Plan 2D — Moteur de la vue 3D isométrique (Push 6, 06/07/2026)
 *
 * Fonctions PURES, zéro dépendance React. Reprend la vue 3D validée de la
 * maquette V2.1 (mockup_plan_2d_editeur_v2.html, fonction render3d), en
 * généralisant aux polygones quelconques et aux ouvertures du vrai modèle.
 *
 * Projection axonométrique d'un point monde (x, y, z) en mm :
 *   sx = (x − y) · 0,866   ;   sy = (x + y) · 0,5 − z
 *
 * Le moteur produit des PRIMITIVES de dessin DÉJÀ TRIÉES (painter's
 * algorithm) que le composant Iso3dView convertit en éléments SVG :
 *  - SOLS à plat (pièces + zones extérieures, aucune extrusion des zones
 *    ext), triés par profondeur (x + y) croissante, dessinés d'abord ;
 *  - MURS des pièces intérieures extrudés z = 0 → HSP, avec découpe des
 *    ouvertures (sous-allège / linteau / vitre sky semi-transparente,
 *    porte = trou pleine hauteur) ; murs « arrière » (normale vers −x/−y)
 *    opaques, murs « avant » à 85 % pour voir l'intérieur ; ombrage plat
 *    3 tons COULEURS_ISO selon l'orientation de la normale ;
 *  - CLÔTURES à plat + poteaux verticaux courts tous les ~1,6 m ;
 *  - SYMBOLES (demande du fondateur) : muraux sur tige verticale fine
 *    (prises ~250 mm, interrupteurs ~1 100 mm, appliques ~1 800 mm),
 *    symboles de sol à plat au sol, DCL au plafond (trait vertical +
 *    glyphe à HSP) ; ils participent au tri painter's par leur position ;
 *  - ÉTIQUETTES nom + m² des pièces intérieures (dessinées en dernier).
 *
 * Chaque calque (existant / projet) a sa propre scène triée : le composant
 * fond le calque projet pour le segmented « Avant | Après ».
 *
 * ROTATION : quarts de tour = permutation des coordonnées monde autour du
 * centre du niveau AVANT projection (4 quarts = identité, vérifié).
 */

import type { CalqueId, Niveau, Ouverture, Piece, PointMm } from './types'
import { AVANCEMENT_META, COULEURS_ISO, COULEURS_PLAN, avancementDe } from './defaults'
import { centreMm, fmtNombreFr } from './geometry'
import { surfaceSolM2 } from './metrics'
import { bornesNiveau } from './viewport'

const C = COULEURS_PLAN
const I = COULEURS_ISO

/** Point projeté écran (unités « mm projetés »). */
export type P2 = [number, number]

/** Cosinus / sinus de la projection (30° isométrique classique). */
export const ISO_COS = 0.866
export const ISO_SIN = 0.5

/** Hauteur des poteaux de clôture (traits verticaux courts), en mm. */
const POTEAU_HAUTEUR_MM = 900
/** Espacement des poteaux le long de la clôture, en mm. */
const PAS_POTEAU_MM = 1600

/**
 * Hauteurs de pose des symboles MURAUX (mm au-dessus du sol) : le glyphe
 * est plaqué en haut d'une tige verticale fine pour rester lisible.
 * Tout type absent de cette table est traité comme symbole de sol
 * (glyphe à plat), sauf `dcl_plafond` (plafond).
 */
export const HAUTEURS_MURALES_MM: Record<string, number> = {
  prise_16a: 250,
  prise_double: 250,
  prise_32a: 250,
  prise_rj45: 250,
  prise_tv: 250,
  sortie_cable: 250,
  interrupteur: 1100,
  va_et_vient: 1100,
  applique: 1800,
}

/** Projection isométrique d'un point monde (mm). */
export function projeterIso(x: number, y: number, z: number): P2 {
  return [(x - y) * ISO_COS, (x + y) * ISO_SIN - z]
}

/** Rectangle englobant projeté (pour le viewBox auto-fit du composant). */
export interface IsoBornes {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Primitive de dessin projetée (le composant la convertit en SVG). */
export type IsoPrim =
  | {
      prim: 'poly'
      pts: P2[]
      fill: string
      fillOpacity?: number
      stroke?: string
      strokeWidth?: number
      dash?: string
    }
  | { prim: 'polyligne'; pts: P2[]; stroke: string; strokeWidth: number; dash?: string }
  | { prim: 'ligne'; a: P2; b: P2; stroke: string; strokeWidth: number; dash?: string; opacite?: number }

/**
 * Glyphe de symbole à rendre par le composant (formes de lib/plan/symboles
 * via SymboleSvg) : `billboard` = plaqué face caméra (symboles muraux),
 * `sol` = aplati sur le plan du sol (matrice de projection du composant).
 */
export interface IsoGlyphe {
  type: string
  couleur: string
  at: P2
  pose: 'billboard' | 'sol'
  /** Rotation locale (pose 'sol') : rotation monde des quarts de tour + rotation du symbole. */
  rotationDeg: number
}

/** Face triée du painter's : primitives d'un mur, d'une clôture ou d'un symbole. */
export interface IsoFace {
  prof: number
  prims: IsoPrim[]
  glyphe?: IsoGlyphe
}

export interface IsoEtiquette {
  at: P2
  nom: string
  aire: string
  couleur: string
}

/** Scène d'un calque : sols triés, faces triées, étiquettes par-dessus. */
export interface IsoCalque {
  sols: IsoPrim[]
  faces: IsoFace[]
  etiquettes: IsoEtiquette[]
}

export interface IsoScene {
  existant: IsoCalque
  projet: IsoCalque
  bornes: IsoBornes | null
}

/** Quart(s) de tour d'un point monde autour de (cx, cy). 4 tours = identité. */
function tournerQuart(x: number, y: number, cx: number, cy: number, quarts: number): P2 {
  let px = x
  let py = y
  for (let i = 0; i < quarts; i++) {
    const nx = cx + (py - cy)
    const ny = cy - (px - cx)
    px = nx
    py = ny
  }
  return [px, py]
}

/** Ouverture normalisée pour la découpe d'un mur (bornée à l'arête et à la HSP). */
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

/** Remplissage du sol d'une pièce ou zone (à plat, aucune extrusion des zones ext). */
function solDe(piece: Piece, pts: P2[]): IsoPrim {
  const projet = piece.layer === 'projet'
  if (piece.cat === 'ext') {
    if (projet) {
      return { prim: 'poly', pts, fill: C.orange, fillOpacity: 0.12, stroke: C.orange, strokeWidth: 1.6, dash: '8 5' }
    }
    if (piece.extType === 'piscine') {
      return { prim: 'poly', pts, fill: C.piscineFond, stroke: C.sky, strokeWidth: 1.6 }
    }
    if (piece.extType === 'pelouse') {
      return { prim: 'poly', pts, fill: C.pelouseFond, stroke: C.pelouse, strokeWidth: 1.6 }
    }
    // Terrasse et autres zones : teinte simple (les lattes 2D ne se projettent pas).
    return { prim: 'poly', pts, fill: C.blanc, stroke: C.navy, strokeWidth: 1.6 }
  }
  if (projet) {
    return { prim: 'poly', pts, fill: C.orange, fillOpacity: 0.16, stroke: C.orange, strokeWidth: 1.8, dash: '8 5' }
  }
  return { prim: 'poly', pts, fill: I.solInt, stroke: C.navy, strokeWidth: 2.2 }
}

/**
 * Construit la scène 3D complète du niveau : deux calques triés
 * (painter's algorithm) + bornes projetées. `quartsDeTour` : 0..3
 * (toute valeur entière est ramenée modulo 4).
 *
 * `options.avancementVisible` : superpose sur chaque sol de pièce la teinte
 * d'avancement (même rgba que la 2D, cf. AVANCEMENT_META) — désactivé par
 * défaut pour ne rien changer aux rendus existants.
 */
export function construireScene3d(
  niveau: Niveau,
  quartsDeTour: number,
  options?: { avancementVisible?: boolean },
): IsoScene {
  const avancementVisible = options?.avancementVisible === true
  const calques: Record<CalqueId, IsoCalque> = {
    existant: { sols: [], faces: [], etiquettes: [] },
    projet: { sols: [], faces: [], etiquettes: [] },
  }
  const bn = bornesNiveau(niveau)
  if (!bn) return { existant: calques.existant, projet: calques.projet, bornes: null }

  const cx = (bn.x1 + bn.x2) / 2
  const cy = (bn.y1 + bn.y2) / 2
  const q = ((Math.round(quartsDeTour) % 4) + 4) % 4
  /** Rotation locale équivalente pour les glyphes à plat (SVG : + = horaire). */
  const rotationMondeDeg = -90 * q

  // Suivi des bornes projetées : CHAQUE point projeté passe par P().
  let bornes: IsoBornes | null = null
  const P = (x: number, y: number, z: number): P2 => {
    const p = projeterIso(x, y, z)
    if (!bornes) bornes = { x1: p[0], y1: p[1], x2: p[0], y2: p[1] }
    else {
      if (p[0] < bornes.x1) bornes.x1 = p[0]
      if (p[0] > bornes.x2) bornes.x2 = p[0]
      if (p[1] < bornes.y1) bornes.y1 = p[1]
      if (p[1] > bornes.y2) bornes.y2 = p[1]
    }
    return p
  }
  const rot = (p: PointMm): P2 => tournerQuart(p[0], p[1], cx, cy, q)

  // Tri différé des sols : on accumule avec leur profondeur puis on trie.
  const solsTri: Record<CalqueId, { prof: number; prim: IsoPrim }[]> = { existant: [], projet: [] }
  /** HSP réelle par pièce (tige des DCL au plafond). */
  const hspParPiece = new Map<string, number>()

  // ── Pièces : sols, murs découpés, étiquettes ──────────────────────────────
  for (const piece of niveau.rooms) {
    const hsp = piece.height > 0 ? piece.height : niveau.heightDefault
    hspParPiece.set(piece.id, hsp)
    const sc = calques[piece.layer]
    const base = piece.vertices.map(rot)
    const n = base.length
    if (n < 3) continue
    const profSol = base.reduce((s, p) => s + p[0] + p[1], 0) / n
    const ptsSol = base.map((p) => P(p[0], p[1], 0))
    solsTri[piece.layer].push({ prof: profSol, prim: solDe(piece, ptsSol) })

    // Teinte d'avancement (parité avec la 2D) : polygone semi-transparent
    // superposé au sol, avec la MÊME rgba que AVANCEMENT_META. Poussé juste
    // après le sol de base et à la même profondeur → le tri stable le garde
    // au-dessus de son propre sol. Sans bord (le sol de base garde le sien).
    if (avancementVisible) {
      const teinte = AVANCEMENT_META[avancementDe(piece)].fill
      if (teinte) {
        solsTri[piece.layer].push({ prof: profSol, prim: { prim: 'poly', pts: ptsSol, fill: teinte } })
      }
    }

    // Zones extérieures : à plat uniquement (pas de murs, pas d'étiquette 3D).
    if (piece.cat !== 'int') continue

    const projet = piece.layer === 'projet'
    const strokeMur = projet ? C.orange : C.navy
    const dashMur = projet ? '7 4' : undefined

    // Ouvertures groupées par arête (le modèle porte edgeIndex + offset).
    const parArete = new Map<number, Ouverture[]>()
    for (const o of piece.openings) {
      if (o.edgeIndex < 0 || o.edgeIndex >= n) continue
      const liste = parArete.get(o.edgeIndex) ?? []
      liste.push(o)
      parArete.set(o.edgeIndex, liste)
    }

    for (let i = 0; i < n; i++) {
      const a = base[i]
      const b = base[(i + 1) % n]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const L = Math.hypot(dx, dy)
      if (L < 1) continue
      // Normale extérieure (sommets à aire signée positive, cf. normaliserCCW).
      const nx = dy / L
      const ny = -dx / L
      const arriere = nx + ny < 0
      const versX = Math.abs(nx) > Math.abs(ny)
      const fill = projet
        ? C.orange
        : arriere
          ? versX
            ? I.murArriereX
            : I.murArriereY
          : versX
            ? I.murAvantX
            : I.murAvantY
      // Murs avant à 85 % pour voir l'intérieur ; projet : orange translucide.
      const opaciteBase = arriere ? 1 : 0.85
      const fillOpacity = projet ? (versX ? 0.42 : 0.28) * opaciteBase : opaciteBase

      /** Sous-quad du mur entre t1..t2 mm le long de l'arête, z1..z2 mm. */
      const quad = (t1: number, t2: number, z1: number, z2: number): P2[] => {
        const x1 = a[0] + (dx / L) * t1
        const y1 = a[1] + (dy / L) * t1
        const x2 = a[0] + (dx / L) * t2
        const y2 = a[1] + (dy / L) * t2
        return [P(x1, y1, z1), P(x2, y2, z1), P(x2, y2, z2), P(x1, y1, z2)]
      }
      const plein = (t1: number, t2: number, z1: number, z2: number): IsoPrim => ({
        prim: 'poly',
        pts: quad(t1, t2, z1, z2),
        fill,
        fillOpacity,
        stroke: strokeMur,
        strokeWidth: 1.2,
        dash: dashMur,
      })

      const ouvertures = (parArete.get(i) ?? [])
        .map((o) => normaliserOuverture(o, L, hsp))
        .filter((o): o is OuvNorm => o !== null)
        .sort((u, v) => u.offset - v.offset)

      const prims: IsoPrim[] = []
      const vitres: IsoPrim[] = []
      let cur = 0
      for (const o of ouvertures) {
        if (o.offset < cur) continue // chevauchement : la 2e ouverture est ignorée
        if (o.offset > cur) prims.push(plein(cur, o.offset, 0, hsp))
        const fin = o.offset + o.width
        if (o.sill > 0) prims.push(plein(o.offset, fin, 0, o.sill)) // sous l'allège
        if (o.top < hsp) prims.push(plein(o.offset, fin, o.top, hsp)) // linteau
        if (o.vitre) {
          vitres.push({
            prim: 'poly',
            pts: quad(o.offset, fin, o.sill, o.top),
            fill: C.sky,
            fillOpacity: 0.5,
            stroke: C.sky,
            strokeWidth: 1.2,
          })
        }
        cur = fin
      }
      if (cur < L) prims.push(plein(cur, L, 0, hsp))

      sc.faces.push({ prof: (a[0] + a[1] + b[0] + b[1]) / 2, prims: [...prims, ...vitres] })
    }

    const [ex, ey] = rot(centreMm(piece.vertices))
    sc.etiquettes.push({
      at: P(ex, ey, 0),
      nom: piece.name,
      aire: fmtNombreFr(surfaceSolM2(piece), 1) + ' m²',
      couleur: projet ? C.orange : C.navy,
    })
  }

  // ── Clôtures : polyligne à plat + poteaux verticaux courts ────────────────
  for (const cl of niveau.clotures) {
    if (cl.points.length < 2) continue
    const sc = calques[cl.layer]
    const pts = cl.points.map(rot)
    const couleur = cl.layer === 'projet' ? C.orange : C.navy
    const prims: IsoPrim[] = [
      {
        prim: 'polyligne',
        pts: pts.map((p) => P(p[0], p[1], 0)),
        stroke: couleur,
        strokeWidth: 1.6,
        dash: '10 6',
      },
    ]
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      const L = Math.hypot(x2 - x1, y2 - y1)
      if (L < 1) continue
      for (let k = 0; k * PAS_POTEAU_MM <= L; k++) {
        const t = (k * PAS_POTEAU_MM) / L
        const x = x1 + (x2 - x1) * t
        const y = y1 + (y2 - y1) * t
        prims.push({
          prim: 'ligne',
          a: P(x, y, 0),
          b: P(x, y, POTEAU_HAUTEUR_MM),
          stroke: couleur,
          strokeWidth: 1.4,
        })
      }
    }
    const prof = pts.reduce((s, p) => s + p[0] + p[1], 0) / pts.length
    sc.faces.push({ prof, prims })
  }

  // ── Symboles : muraux sur tige / sol à plat / DCL au plafond ──────────────
  for (const s of niveau.symbols) {
    const sc = calques[s.layer]
    const [x, y] = rot(s.position)
    const prof = x + y
    const couleur = s.layer === 'projet' ? C.orange : C.navy
    const hMur = HAUTEURS_MURALES_MM[s.type]
    if (hMur !== undefined) {
      sc.faces.push({
        prof,
        prims: [
          { prim: 'ligne', a: P(x, y, 0), b: P(x, y, hMur), stroke: couleur, strokeWidth: 1, opacite: 0.55 },
        ],
        glyphe: { type: s.type, couleur, at: P(x, y, hMur), pose: 'billboard', rotationDeg: 0 },
      })
      continue
    }
    if (s.type === 'dcl_plafond') {
      const hsp = (s.roomId ? hspParPiece.get(s.roomId) : undefined) ?? niveau.heightDefault
      sc.faces.push({
        prof,
        prims: [
          {
            prim: 'ligne',
            a: P(x, y, 0),
            b: P(x, y, hsp),
            stroke: couleur,
            strokeWidth: 1,
            dash: '4 4',
            opacite: 0.35,
          },
        ],
        glyphe: {
          type: s.type,
          couleur,
          at: P(x, y, hsp),
          pose: 'sol',
          rotationDeg: rotationMondeDeg + (s.rotation || 0),
        },
      })
      continue
    }
    // Symboles de sol (WC, évier, tableau, portail...) : glyphe à plat au sol.
    sc.faces.push({
      prof,
      prims: [],
      glyphe: {
        type: s.type,
        couleur,
        at: P(x, y, 0),
        pose: 'sol',
        rotationDeg: rotationMondeDeg + (s.rotation || 0),
      },
    })
  }

  // ── Painter's algorithm : sols d'abord, puis faces, par profondeur ────────
  for (const calque of ['existant', 'projet'] as const) {
    solsTri[calque].sort((u, v) => u.prof - v.prof)
    calques[calque].sols = solsTri[calque].map((s) => s.prim)
    calques[calque].faces.sort((u, v) => u.prof - v.prof)
  }

  return { existant: calques.existant, projet: calques.projet, bornes }
}
