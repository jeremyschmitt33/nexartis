/**
 * Module Plan 2D — Opérations d'édition pures (Push 2, 03/07/2026)
 *
 * Déplacement + aimantation (grille 100 mm, bords voisins < 150 mm),
 * redimensionnement par cote cliquée, pose d'ouvertures sur les arêtes.
 * Fonctions PURES : elles retournent de NOUVEAUX objets, ne mutent jamais.
 */

import type { Cloture, Niveau, Ouverture, Piece, PointMm, TypeOuverture } from './types'
import { longueurAreteMm, snapMm } from './geometry'
import { AIMANT_MM, COTE_MAX_MM, COTE_MIN_MM, GRILLE_MM, OUVERTURE_DEFAUTS, creerOuverture } from './defaults'

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
 * mise à l'échelle le long de l'axe demandé, ancrée sur le bord min.
 * Retourne null si la nouvelle dimension est hors bornes.
 *
 * ⚠️⚠️ LA COTE SAISIE EST SACRÉE — JAMAIS D'AIMANTATION ICI. NE PAS RÉINTRODUIRE
 * `snapMm` DANS CETTE FONCTION (bug corrigé le 14/07/2026).
 *
 * Avant, la valeur tapée passait par `snapMm(nouveauMm, GRILLE_MM)` et chaque
 * sommet était ré-aimanté à la grille de 100 mm : l'artisan saisissait 4,27 m
 * et le logiciel enregistrait 4,30 m, SANS RIEN DIRE. Un mur de 4,27 m arrondi
 * à 4,30 sous 2,50 m de HSP, c'est ~0,075 m² de peinture fantôme — qui se
 * propage ensuite dans le métré, le devis, la commande de matière et le
 * placement des ouvertures. Le bug était invisible parce que tous nos tests
 * utilisaient des cotes rondes (3,50 / 4,50 / 3,80), toutes multiples de 10 cm.
 *
 * L'aimantation à la grille reste légitime pour DÉPLACER une pièce
 * (aimanterDeplacement) : une translation ne change aucune dimension. Elle est
 * illégitime dès qu'elle touche une mesure saisie par un humain.
 *
 * `Math.round` conserve l'invariant du modèle (millimètres ENTIERS) sans jamais
 * dégrader la précision : au millimètre près, comme saisi.
 */
export function redimensionnerParCote(
  piece: Piece,
  dim: 'w' | 'h',
  nouveauMm: number
): Piece | null {
  if (!Number.isFinite(nouveauMm)) return null
  const cible = Math.round(nouveauMm)
  if (cible < COTE_MIN_MM || cible > COTE_MAX_MM) return null
  const b = bornesPiece(piece)
  const actuel = dim === 'w' ? b.x2 - b.x1 : b.y2 - b.y1
  if (actuel <= 0) return null
  const ratio = cible / actuel
  const vertices = piece.vertices.map(([x, y]): PointMm => {
    if (dim === 'w') return [Math.round(b.x1 + (x - b.x1) * ratio), y]
    return [x, Math.round(b.y1 + (y - b.y1) * ratio)]
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

/**
 * Recale les ouvertures d'une pièce après un changement de dimension.
 *
 * ⚠️ REMPLACE `purgerOuverturesInvalides` sur le chemin d'ÉDITION DE COTE.
 * Bug corrigé le 14/07/2026 : la purge FILTRAIT les ouvertures devenues
 * invalides — raccourcir un mur SUPPRIMAIT la porte qu'il portait, en silence,
 * sans le moindre message. L'artisan perdait son travail sans jamais savoir
 * pourquoi. C'est exactement la leçon du Push 10 (« filtrage, pas effacement »)
 * qui n'avait pas été appliquée ici.
 *
 * Règle : on RECALE (l'ouverture glisse pour rester sur son mur). Si le mur
 * devient plus court que l'ouverture elle-même, on REFUSE la modification en
 * NOMMANT le coupable. On n'efface JAMAIS.
 *
 * Les ouvertures orphelines (edgeIndex hors bornes, donnée héritée) sont
 * CONSERVÉES telles quelles : le rendu les ignore déjà (RenduOuverture), donc
 * les garder est sans risque — et les effacer serait une perte de données.
 */
export function recalerOuvertures(
  piece: Piece
): { piece: Piece; recalees: number } | { erreur: string } {
  const n = piece.vertices.length
  const openings: Ouverture[] = []
  let recalees = 0
  for (const o of piece.openings) {
    if (o.edgeIndex < 0 || o.edgeIndex >= n) {
      openings.push(o)
      continue
    }
    const longueur = longueurAreteMm(piece.vertices, o.edgeIndex)
    if (o.width > longueur) {
      const label = OUVERTURE_DEFAUTS[o.type].label.toLowerCase()
      return {
        erreur:
          `Ce mur porte une ${label} de ${Math.round(o.width / 10)} cm : ` +
          `il ne peut pas être plus court. Supprimez-la d'abord si besoin.`,
      }
    }
    // `Math.floor` et surtout PAS `Math.round` : `longueur` vient de Math.hypot
    // et peut être fractionnaire (mur en biais d'un polygone). Un arrondi au
    // supérieur donnerait offset + width > longueur, et RenduOuverture masque
    // alors l'ouverture — on réintroduirait la disparition silencieuse par la
    // petite porte. `floor` garantit qu'elle reste toujours sur son mur.
    // Le `Math.round(o.offset)` tient l'invariant du modèle : mm ENTIERS.
    const offset = Math.max(0, Math.min(Math.round(o.offset), Math.floor(longueur - o.width)))
    if (offset === o.offset) {
      openings.push(o)
    } else {
      openings.push({ ...o, offset })
      recalees += 1
    }
  }
  return { piece: { ...piece, openings }, recalees }
}

/**
 * Retire les ouvertures devenues invalides (mur raccourci sous leur largeur).
 * ⚠️ DESTRUCTIF : ne PAS utiliser sur un chemin déclenché par l'artisan —
 * préférer `recalerOuvertures`, qui recale ou refuse mais n'efface jamais.
 */
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
