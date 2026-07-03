/**
 * PlanRender — Rendu SVG PUR d'un niveau de plan (Push 2, 03/07/2026).
 *
 * AUCUN state, AUCUN hook : fonction pure des props, partagée entre
 * l'éditeur (PlanCanvas) et l'export PNG/PDF (Push 4). Retourne un <g>
 * en COORDONNÉES MONDE (mm) — le parent applique la transformation viewport.
 *
 * Couleurs : attributs SVG explicites via COULEURS_PLAN (lib/plan/defaults),
 * miroir unique de tailwind.config.ts, pour que le SVG soit exportable tel
 * quel sans feuille de style (parité des rendus par construction).
 */

import type { Niveau, Ouverture, Piece, PointMm } from '@/lib/plan/types'
import { aireMm2, centreMm, estDansPolygone, fmtNombreFr, mm2VersM2, mmVersM } from '@/lib/plan/geometry'
import { surfaceCreeeProjetM2, surfaceSolM2 } from '@/lib/plan/metrics'
import { COULEURS_PLAN } from '@/lib/plan/defaults'
import { bornesPiece, estRectiligne } from '@/lib/plan/edition'

export type VueCalque = 'existant' | 'projet' | 'tout'

const C = COULEURS_PLAN
const FONT_NUM = "'Spline Sans Mono', ui-monospace, monospace"
const FONT_TXT = "'Hanken Grotesk', sans-serif"

function couleurCalque(layer: 'existant' | 'projet'): string {
  return layer === 'projet' ? C.orange : C.navy
}

function fmtM(mm: number): string {
  return fmtNombreFr(mmVersM(mm)) + ' m'
}

/** Motifs réutilisés (hachures projet, grille 1 m). À monter dans <defs>. */
export function PlanDefs({ idPrefix = 'plan' }: { idPrefix?: string }) {
  return (
    <>
      <pattern
        id={`${idPrefix}-hach-projet`}
        width="260"
        height="260"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="260" height="260" fill={C.blanc} fillOpacity="0.5" />
        <line x1="0" y1="0" x2="0" y2="260" stroke={C.orange} strokeWidth="40" strokeOpacity="0.28" />
      </pattern>
      <pattern id={`${idPrefix}-grille`} width="1000" height="1000" patternUnits="userSpaceOnUse">
        <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke={C.grille} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </pattern>
    </>
  )
}

// ── Pièces ──────────────────────────────────────────────────────────────────

function RenduPiece({ piece, idPrefix, interactif }: { piece: Piece; idPrefix: string; interactif: boolean }) {
  const pts = piece.vertices.map((p) => p.join(',')).join(' ')
  const projet = piece.layer === 'projet'
  const ext = piece.cat === 'ext'
  const fill = projet ? `url(#${idPrefix}-hach-projet)` : ext ? C.blanc : C.cream
  return (
    <polygon
      data-room-id={interactif ? piece.id : undefined}
      points={pts}
      fill={fill}
      fillOpacity={projet ? 1 : 0.5}
      stroke={couleurCalque(piece.layer)}
      strokeWidth={projet ? 4 : 6}
      strokeDasharray={projet ? '10 6' : undefined}
      strokeLinejoin="miter"
      vectorEffect="non-scaling-stroke"
      style={interactif ? { cursor: 'move' } : undefined}
    />
  )
}

function RenduSelection({ piece }: { piece: Piece }) {
  const b = bornesPiece(piece)
  const pad = 140
  return (
    <rect
      x={b.x1 - pad}
      y={b.y1 - pad}
      width={b.x2 - b.x1 + pad * 2}
      height={b.y2 - b.y1 + pad * 2}
      rx={120}
      fill={C.sky}
      fillOpacity="0.06"
      stroke={C.sky}
      strokeWidth="2"
      strokeDasharray="6 5"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )
}

// ── Ouvertures (sur une arête : sommet i -> sommet i+1) ─────────────────────

function RenduOuverture({ piece, o }: { piece: Piece; o: Ouverture }) {
  const n = piece.vertices.length
  if (o.edgeIndex >= n) return null
  const a = piece.vertices[o.edgeIndex]
  const b = piece.vertices[(o.edgeIndex + 1) % n]
  const L = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (L <= 0 || o.offset + o.width > L) return null
  const d = { x: (b[0] - a[0]) / L, y: (b[1] - a[1]) / L }
  // Normale orientée vers l'intérieur de la pièce (test point-dans-polygone).
  let nx = -d.y
  let ny = d.x
  const milieu: PointMm = [
    Math.round(a[0] + d.x * (o.offset + o.width / 2) + nx * 200),
    Math.round(a[1] + d.y * (o.offset + o.width / 2) + ny * 200),
  ]
  if (!estDansPolygone(milieu, piece.vertices)) {
    nx = -nx
    ny = -ny
  }
  const x1 = a[0] + d.x * o.offset
  const y1 = a[1] + d.y * o.offset
  const x2 = x1 + d.x * o.width
  const y2 = y1 + d.y * o.width
  const c = couleurCalque(piece.layer)

  // 1) « Gommage » du mur : trait couleur fond un peu plus large que le mur.
  const gommage = (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.fond} strokeWidth="9" vectorEffect="non-scaling-stroke" />
  )

  if (o.type === 'porte') {
    // Battant : vantail depuis la charnière (x1,y1) + arc en pointillés.
    const bx = x1 + nx * o.width
    const by = y1 + ny * o.width
    const sweep = d.x * ny - d.y * nx > 0 ? 1 : 0
    return (
      <g pointerEvents="none">
        {gommage}
        <line x1={x1} y1={y1} x2={bx} y2={by} stroke={c} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        <path
          d={`M ${x2} ${y2} A ${o.width} ${o.width} 0 0 ${sweep} ${bx} ${by}`}
          fill="none"
          stroke={c}
          strokeWidth="1.3"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    )
  }

  // Fenêtre / porte-fenêtre / baie : double trait + axe pointillé.
  const col = o.type === 'fenetre' ? C.sky : c
  const e = 60
  return (
    <g pointerEvents="none">
      {gommage}
      {[-1, 1].map((k) => (
        <line
          key={k}
          x1={x1 + nx * e * k}
          y1={y1 + ny * e * k}
          x2={x2 + nx * e * k}
          y2={y2 + ny * e * k}
          stroke={col}
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth="1.4" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

// ── Cotes ───────────────────────────────────────────────────────────────────

function chevauchements(bande: { x1: number; x2: number; y1: number; y2: number }, pieces: Piece[], idExclu: string): number {
  let compte = 0
  for (const p of pieces) {
    if (p.id === idExclu) continue
    const b = bornesPiece(p)
    if (bande.x1 < b.x2 && bande.x2 > b.x1 && bande.y1 < b.y2 && bande.y2 > b.y1) compte++
  }
  return compte
}

function TraitCote({
  x1, y1, x2, y2, label, c, roomId, dim, vertical, interactif,
}: {
  x1: number; y1: number; x2: number; y2: number; label: string; c: string
  roomId: string; dim: 'w' | 'h'; vertical: boolean; interactif: boolean
}) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const T = 110
  const tx = vertical ? mx - 110 : mx
  const ty = vertical ? my : my - 110
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="1.2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {[[x1, y1], [x2, y2]].map(([px, py], i) => (
        <line key={i} x1={px - T} y1={py + T} x2={px + T} y2={py - T} stroke={c} strokeWidth="1.6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ))}
      <text
        data-cote-room={interactif ? roomId : undefined}
        data-cote-dim={interactif ? dim : undefined}
        x={tx}
        y={ty}
        transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined}
        fontFamily={FONT_NUM}
        fontSize="250"
        fontWeight="500"
        fill={c}
        textAnchor="middle"
        paintOrder="stroke"
        stroke={C.fond}
        strokeWidth="70"
        style={interactif ? { cursor: 'pointer' } : undefined}
      >
        {label}
      </text>
    </g>
  )
}

function Rappel({ x1, y1, x2, y2, c }: { x1: number; y1: number; x2: number; y2: number; c: string }) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="0.8" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" pointerEvents="none" />
  )
}

function RenduCotes({ piece, pieces, interactif }: { piece: Piece; pieces: Piece[]; interactif: boolean }) {
  const c = couleurCalque(piece.layer)

  // Forme libre : longueur affichée au milieu de chaque segment (lecture seule).
  if (!estRectiligne(piece.vertices)) {
    const n = piece.vertices.length
    const labels = []
    for (let i = 0; i < n; i++) {
      const [x1, y1] = piece.vertices[i]
      const [x2, y2] = piece.vertices[(i + 1) % n]
      const L = Math.hypot(x2 - x1, y2 - y1)
      if (L < 500) continue
      labels.push(
        <text key={i} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 130} fontFamily={FONT_NUM} fontSize="210" fill={c} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="60">
          {fmtM(L)}
        </text>
      )
    }
    return <g pointerEvents="none">{labels}</g>
  }

  // Rectiligne (rectangle, L) : cotes d'encombrement cliquables N/S + W/E.
  const b = bornesPiece(piece)
  const OFF = 380
  const bandeN = { x1: b.x1, x2: b.x2, y1: b.y1 - 620, y2: b.y1 - 60 }
  const bandeS = { x1: b.x1, x2: b.x2, y1: b.y2 + 60, y2: b.y2 + 620 }
  const surN = chevauchements(bandeN, pieces, piece.id) <= chevauchements(bandeS, pieces, piece.id)
  const cy = surN ? b.y1 - OFF : b.y2 + OFF
  const bandeW = { x1: b.x1 - 620, x2: b.x1 - 60, y1: b.y1, y2: b.y2 }
  const bandeE = { x1: b.x2 + 60, x2: b.x2 + 620, y1: b.y1, y2: b.y2 }
  const surW = chevauchements(bandeW, pieces, piece.id) <= chevauchements(bandeE, pieces, piece.id)
  const cx = surW ? b.x1 - OFF : b.x2 + OFF
  return (
    <g>
      <TraitCote x1={b.x1} y1={cy} x2={b.x2} y2={cy} label={fmtM(b.x2 - b.x1)} c={c} roomId={piece.id} dim="w" vertical={false} interactif={interactif} />
      <Rappel x1={b.x1} y1={surN ? b.y1 : b.y2} x2={b.x1} y2={cy} c={c} />
      <Rappel x1={b.x2} y1={surN ? b.y1 : b.y2} x2={b.x2} y2={cy} c={c} />
      <TraitCote x1={cx} y1={b.y1} x2={cx} y2={b.y2} label={fmtM(b.y2 - b.y1)} c={c} roomId={piece.id} dim="h" vertical interactif={interactif} />
      <Rappel x1={surW ? b.x1 : b.x2} y1={b.y1} x2={cx} y2={b.y1} c={c} />
      <Rappel x1={surW ? b.x1 : b.x2} y1={b.y2} x2={cx} y2={b.y2} c={c} />
    </g>
  )
}

// ── Étiquettes + badge projet ───────────────────────────────────────────────

function RenduEtiquette({ piece }: { piece: Piece }) {
  const [cx, cy] = centreMm(piece.vertices)
  const b = bornesPiece(piece)
  const petite = Math.min(b.x2 - b.x1, b.y2 - b.y1) < 1500
  const c = couleurCalque(piece.layer)
  const aire = surfaceSolM2(piece)
  return (
    <g pointerEvents="none">
      <text x={cx} y={cy - 60} fontFamily={FONT_TXT} fontSize={petite ? 230 : 300} fontWeight="700" fill={c} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="60">
        {piece.name}
      </text>
      <text x={cx} y={cy + 260} fontFamily={FONT_NUM} fontSize={petite ? 190 : 250} fill={piece.layer === 'projet' ? C.orange : C.navyMid} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="60">
        {fmtNombreFr(aire, 1)} m²
      </text>
    </g>
  )
}

function RenduBadgeProjet({ piece }: { piece: Piece }) {
  const aire = mm2VersM2(aireMm2(piece.vertices))
  const label = '+' + fmtNombreFr(aire, 1) + ' m² créés'
  const wB = label.length * 150 + 340
  const hB = 430
  const b = bornesPiece(piece)
  const bx = b.x2 + 240
  const by = b.y1 + 240
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={wB} height={hB} rx={hB / 2} fill={C.orange} />
      <text x={bx + wB / 2} y={by + hB / 2 + 90} fontFamily={FONT_TXT} fontSize="250" fontWeight="700" fill={C.blanc} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

// ── Rendu complet d'un niveau ───────────────────────────────────────────────

export interface PlanRenderProps {
  niveau: Niveau
  vue: VueCalque
  selectedRoomId?: string | null
  /** true dans l'éditeur (attributs data-* + curseurs), false pour l'export. */
  interactif?: boolean
  /** Préfixe des ids de <pattern> pour éviter les collisions. */
  idPrefix?: string
  /** Affiche la grille 1 m sous le plan (éditeur). */
  grille?: boolean
}

/** Ordre des passes : grille → pièces → sélection → ouvertures → cotes → étiquettes → badges. */
export default function PlanRender({
  niveau,
  vue,
  selectedRoomId = null,
  interactif = false,
  idPrefix = 'plan',
  grille = false,
}: PlanRenderProps) {
  const visibles = niveau.rooms.filter((r) => vue === 'tout' || (vue === 'projet' ? true : r.layer === 'existant'))
  const tri = [...visibles].sort((a, b) => Number(a.layer === 'projet') - Number(b.layer === 'projet'))
  const selection = selectedRoomId ? tri.find((r) => r.id === selectedRoomId) : undefined
  const creee = surfaceCreeeProjetM2(niveau.rooms)
  const opacite = (p: Piece) => (vue === 'projet' && p.layer === 'existant' ? 0.35 : 1)

  return (
    <g>
      {grille && <rect x={-50000} y={-50000} width={100000} height={100000} fill={`url(#${idPrefix}-grille)`} pointerEvents="none" />}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          <RenduPiece piece={r} idPrefix={idPrefix} interactif={interactif} />
        </g>
      ))}
      {selection && <RenduSelection piece={selection} />}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          {r.openings.map((o) => (
            <RenduOuverture key={o.id} piece={r} o={o} />
          ))}
        </g>
      ))}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          <RenduCotes piece={r} pieces={visibles} interactif={interactif} />
        </g>
      ))}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          <RenduEtiquette piece={r} />
        </g>
      ))}
      {vue !== 'existant' && creee > 0 &&
        tri.filter((r) => r.layer === 'projet' && r.cat === 'int').map((r) => <RenduBadgeProjet key={r.id} piece={r} />)}
    </g>
  )
}
