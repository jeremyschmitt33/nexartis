/**
 * Module Plan 2D — Opérations d'édition pures (Push 2, 03/07/2026)
 *
 * Déplacement + aimantation (grille 100 mm, bords voisins < 150 mm),
 * redimensionnement par cote cliquée, pose d'ouvertures sur les arêtes.
 * Fonctions PURES : elles retournent de NOUVEAUX objets, ne mutent jamais.
 */

import type { Cloture, Niveau, Ouverture, Piece, PointMm, TypeOuverture } from './types'
import { longueurAreteMm, snapMm } from './geometry'
import { AIMANT_MM, COTE_MAX_MM, COTE_MIN_MM, GRILLE_MM, creerOuverture } from './defaults'

/** Rectangle englobant d'une pièce, en mm. */
export interface BornesPiece {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function bornesPiece(piece: Piece): BornesPiece {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of piece.vertices) {
    if (x < x1) x1 = x
    if (y < y1) y1 = y
    if (x > x2) x2 = x
    if (y > y2) y2 = y
  }
  return { x1, y1, x2, y2 }
}

/** Nouvelle pièce translatée de (dx, dy) mm. */
export function translaterPiece(piece: Piece, dx: number, dy: number): Piece {
  if (dx === 0 && dy === 0) return piece
  return {
    ...piece,
    vertices: piece.vertices.map(([x, y]) => [x + dx, y + dy] as PointMm),
  }
}

/** Guide d'aimantation à afficher (ligne sky pleine largeur/hauteur). */
export interface GuideAimant {
  vertical: boolean
  at: number
}

/**
 * Aimante un déplacement : grille 100 mm puis bords des pièces voisines
 * (< 150 mm). Entrée : bornes d'origine + déplacement souhaité en mm.
 * Sortie : déplacement corrigé + guides visuels.
 */
export function aimanterDeplacement(
  bornes: BornesPiece,
  dx: number,
  dy: number,
  voisines: Piece[],
  idExclu: string
): { dx: number; dy: number; guides: GuideAimant[] } {
  // 1) Grille : on aimante la position du coin haut-gauche.
  let nx = snapMm(bornes.x1 + dx, GRILLE_MM)
  let ny = snapMm(bornes.y1 + dy, GRILLE_MM)
  const w = bornes.x2 - bornes.x1
  const h = bornes.y2 - bornes.y1

  // 2) Bords voisins : chaque bord X/Y de chaque voisine attire nos deux bords.
  let bestX: number | null = null
  let bestY: number | null = null
  let gx: number | null = null
  let gy: number | null = null
  let dxMin = AIMANT_MM + 1
  let dyMin = AIMANT_MM + 1
  for (const v of voisines) {
    if (v.id === idExclu) continue
    const b = bornesPiece(v)
    for (const bord of [b.x1, b.x2]) {
      for (const mien of [nx, nx + w]) {
        const d = bord - mien
        if (Math.abs(d) < dxMin) {
          dxMin = Math.abs(d)
          bestX = nx + d
          gx = bord
        }
      }
    }
    for (const bord of [b.y1, b.y2]) {
      for (const mien of [ny, ny + h]) {
        const d = bord - mien
        if (Math.abs(d) < dyMin) {
          dyMin = Math.abs(d)
          bestY = ny + d
          gy = bord
        }
      }
    }
  }
  if (bestX !== null) nx = bestX
  if (bestY !== null) ny = bestY

  const guides: GuideAimant[] = []
  if (gx !== null && bestX !== null) guides.push({ vertical: true, at: gx })
  if (gy !== null && bestY !== null) guides.push({ vertical: false, at: gy })
  return { dx: nx - bornes.x1, dy: ny - bornes.y1, guides }
}

/** Toutes les arêtes sont-elles horizontales ou verticales ? */
export function estRectiligne(vertices: PointMm[]): boolean {
  const n = vertices.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i]
    const [x2, y2] = vertices[(i + 1) % n]
    if (x1 !== x2 && y1 !== y2) return false
  }
  return true
}

/** Rectangle axis-aligné à 4 sommets ? */
export function estRectangle(vertices: PointMm[]): boolean {
  return vertices.length === 4 && estRectiligne(vertices)
}

/**
 * Redimensionne la pièce via ses cotes d'encombrement (clic sur une cote) :
 * mise à l'échelle le long de l'axe demandé, ancrée sur le bord min, puis
 * ré-aimantation de chaque sommet à la grille. Exact pour un rectangle.
 * Retourne null si la nouvelle dimension est hors bornes.
 */
export function redimensionnerParCote(
  piece: Piece,
  dim: 'w' | 'h',
  nouveauMm: number
): Piece | null {
  if (!Number.isFinite(nouveauMm)) return null
  const cible = snapMm(nouveauMm, GRILLE_MM)
  if (cible < COTE_MIN_MM || cible > COTE_MAX_MM) return null
  const b = bornesPiece(piece)
  const actuel = dim === 'w' ? b.x2 - b.x1 : b.y2 - b.y1
  if (actuel <= 0) return null
  const ratio = cible / actuel
  const vertices = piece.vertices.map(([x, y]): PointMm => {
    if (dim === 'w') return [snapMm(b.x1 + (x - b.x1) * ratio, GRILLE_MM), y]
    return [x, snapMm(b.y1 + (y - b.y1) * ratio, GRILLE_MM)]
  })
  return { ...piece, vertices }
}

/** Projection d'un point sur un segment : distance + abscisse le long du segment. */
function projeterSurSegment(
  p: PointMm,
  a: PointMm,
  b: PointMm
): { dist: number; t: number; longueur: number } {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const longueur = Math.hypot(dx, dy)
  if (longueur === 0) return { dist: Math.hypot(p[0] - a[0], p[1] - a[1]), t: 0, longueur: 0 }
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (longueur * longueur)))
  const px = a[0] + t * dx
  const py = a[1] + t * dy
  return { dist: Math.hypot(p[0] - px, p[1] - py), t, longueur }
}

/** Arête d'une pièce la plus proche d'un point (index + projection en mm). */
export function areteLaPlusProche(
  piece: Piece,
  point: PointMm
): { edgeIndex: number; alongMm: number; longueurMm: number; dist: number } | null {
  const n = piece.vertices.length
  if (n < 2) return null
  let best: { edgeIndex: number; alongMm: number; longueurMm: number; dist: number } | null = null
  for (let i = 0; i < n; i++) {
    const a = piece.vertices[i]
    const b = piece.vertices[(i + 1) % n]
    const proj = projeterSurSegment(point, a, b)
    if (best === null || proj.dist < best.dist) {
      best = {
        edgeIndex: i,
        alongMm: proj.t * proj.longueur,
        longueurMm: proj.longueur,
        dist: proj.dist,
      }
    }
  }
  return best
}

/**
 * Prépare la pose d'une ouverture près d'un point cliqué dans la pièce.
 * Retourne l'ouverture prête à insérer, ou un message d'erreur explicite.
 */
export function preparerOuverture(
  piece: Piece,
  point: PointMm,
  type: TypeOuverture
): { ouverture: Ouverture } | { erreur: string } {
  const arete = areteLaPlusProche(piece, point)
  if (!arete) return { erreur: 'Impossible de trouver un mur sur cette pièce.' }
  const largeur = creerOuverture(type, 0, 0).width
  const marge = 80
  if (arete.longueurMm < largeur + 2 * marge) {
    return { erreur: 'Ce mur est trop court pour cette ouverture.' }
  }
  const offset = Math.round(
    Math.max(marge, Math.min(arete.alongMm - largeur / 2, arete.longueurMm - largeur - marge))
  )
  return { ouverture: creerOuverture(type, arete.edgeIndex, offset) }
}

/** Distance max (mm) entre le clic et la clôture pour poser un portail. */
export const PORTAIL_DIST_MAX_MM = 1500

/**
 * Projette un point sur le segment de clôture le plus proche (pose du
 * portail, Push 3b). Retourne la position projetée + l'angle du segment
 * (rotation du symbole en degrés) + le calque de la clôture porteuse,
 * ou null si aucune clôture n'est à moins de PORTAIL_DIST_MAX_MM.
 */
export function projeterSurClotures(
  clotures: Cloture[],
  point: PointMm
): { clotureId: string; layer: Cloture['layer']; position: PointMm; rotation: number } | null {
  let best: { clotureId: string; layer: Cloture['layer']; position: PointMm; rotation: number; dist: number } | null = null
  for (const cl of clotures) {
    for (let i = 0; i < cl.points.length - 1; i++) {
      const a = cl.points[i]
      const b = cl.points[i + 1]
      const proj = projeterSurSegment(point, a, b)
      if (proj.longueur === 0) continue
      if (best === null || proj.dist < best.dist) {
        const t = proj.t
        best = {
          clotureId: cl.id,
          layer: cl.layer,
          position: [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
          ],
          rotation: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI),
          dist: proj.dist,
        }
      }
    }
  }
  if (!best || best.dist > PORTAIL_DIST_MAX_MM) return null
  return { clotureId: best.clotureId, layer: best.layer, position: best.position, rotation: best.rotation }
}

/** Une ouverture reste-t-elle valide sur son arête (après redimensionnement) ? */
export function ouvertureValide(piece: Piece, o: Ouverture): boolean {
  const longueur = longueurAreteMm(piece.vertices, o.edgeIndex)
  return o.edgeIndex < piece.vertices.length && o.offset >= 0 && o.offset + o.width <= longueur
}

/** Retire les ouvertures devenues invalides (mur raccourci sous leur largeur). */
export function purgerOuverturesInvalides(piece: Piece): Piece {
  const valides = piece.openings.filter((o) => ouvertureValide(piece, o))
  if (valides.length === piece.openings.length) return piece
  return { ...piece, openings: valides }
}

/** Position (x, y) pour poser une nouvelle pièce : à droite de l'existant. */
export function positionNouvellePiece(niveau: Niveau): PointMm {
  if (niveau.rooms.length === 0) return [0, 0]
  let xMax = -Infinity
  let yMin = Infinity
  for (const r of niveau.rooms) {
    const b = bornesPiece(r)
    if (b.x2 > xMax) xMax = b.x2
    if (b.y1 < yMin) yMin = b.y1
  }
  return [snapMm(xMax + 600, GRILLE_MM), snapMm(yMin, GRILLE_MM)]
}
