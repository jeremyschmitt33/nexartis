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

import type { Niveau, Ouverture, Piece, PointMm, Symbole } from '@/lib/plan/types'
import { aireMm2, centreMm, estDansPolygone, fmtNombreFr, mm2VersM2, mmVersM } from '@/lib/plan/geometry'
import { perimetreMl, surfaceCreeeProjetM2, surfaceSolM2 } from '@/lib/plan/metrics'
import { AVANCEMENT_META, COULEURS_PLAN } from '@/lib/plan/defaults'
import { bornesPiece, estRectiligne } from '@/lib/plan/edition'
import SymboleSvg from './SymboleSvg'
import ClotureSvg from './ClotureSvg'

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
      {/* Lattes discrètes des terrasses (Push 3b) : traits navy très légers. */}
      <pattern id={`${idPrefix}-lattes`} width="300" height="300" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <rect width="300" height="300" fill={C.blanc} fillOpacity="0.6" />
        <line x1="0" y1="0" x2="0" y2="300" stroke={C.navy} strokeWidth="24" strokeOpacity="0.1" />
      </pattern>
    </>
  )
}

// ── Pièces ──────────────────────────────────────────────────────────────────

function RenduPiece({ piece, idPrefix, interactif, avancementVisible }: { piece: Piece; idPrefix: string; interactif: boolean; avancementVisible: boolean }) {
  const pts = piece.vertices.map((p) => p.join(',')).join(' ')
  const projet = piece.layer === 'projet'
  const ext = piece.cat === 'ext'
  // Zones extérieures (Push 3b) : contour FIN (pas de murs épais), fonds doux
  // par sous-type — terrasse lattes, piscine sky 18 %, pelouse #7dba8a 12 %
  // (entorse palette documentée dans COULEURS_PLAN).
  let fill = projet ? `url(#${idPrefix}-hach-projet)` : ext ? C.blanc : C.cream
  let stroke = couleurCalque(piece.layer)
  let fillOpacity = projet ? 1 : 0.5
  if (ext && !projet) {
    fillOpacity = 1
    if (piece.extType === 'terrasse') fill = `url(#${idPrefix}-lattes)`
    else if (piece.extType === 'piscine') {
      fill = C.piscineFond
      stroke = C.sky
    } else if (piece.extType === 'pelouse') {
      fill = C.pelouseFond
      stroke = C.pelouse
    } else fill = C.blanc
  }
  // Mode Avancement (Push 7) : teinte de remplissage superposée selon l'état
  // de la pièce. 'a_faire' (ou champ absent) → aucune teinte. La surcouche est
  // NON interactive (pointer-events none) pour ne pas voler le clic au polygone
  // de base qui porte data-room-id. Rendue par PlanRender → visible à l'écran
  // ET dans l'export PNG/PDF (parité par construction).
  // Une pièce « projet » (travaux futurs) ne montre jamais d'avancement, même
  // si une donnée héritée en porte un : le rendu est robuste au calque, pas
  // seulement à la saisie.
  // `fillPlan` (teinte DOUCE) et non `fill` (réservée à la vue 3D) : l'aplat
  // soutenu repeignait la pièce et tuait la lecture du bâti sur un plan entier.
  const teinteAvancement =
    avancementVisible && !projet && piece.avancement && piece.avancement !== 'a_faire'
      ? AVANCEMENT_META[piece.avancement].fillPlan
      : null
  return (
    <>
      <polygon
        data-room-id={interactif ? piece.id : undefined}
        points={pts}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={ext ? (projet ? 2.4 : 2) : projet ? 4 : 6}
        strokeDasharray={projet ? '10 6' : undefined}
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
        style={interactif ? { cursor: 'move' } : undefined}
      />
      {teinteAvancement && (
        <polygon points={pts} fill={teinteAvancement} stroke="none" pointerEvents="none" />
      )}
    </>
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
  // Hiérarchie typographique (14/07/2026) : la cotation RECULE d'un rang.
  // Avant, les cotes étaient en navy plein, du même poids que les murs : elles
  // criaient aussi fort que le bâti et le plan n'avait aucun point d'entrée.
  // En gris bleuté, le regard tombe d'abord sur les murs, puis sur les cotes.
  // Les pièces « projet » gardent l'orange : c'est une INFORMATION (ce qui
  // n'existe pas encore), pas de la décoration.
  const c = piece.layer === 'projet' ? C.orange : C.cote

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

function RenduEtiquette({
  piece,
  symboles,
  avancementVisible,
}: {
  piece: Piece
  symboles: Symbole[]
  avancementVisible: boolean
}) {
  const [cx, cyCentre] = centreMm(piece.vertices)
  const b = bornesPiece(piece)
  const petite = Math.min(b.x2 - b.x1, b.y2 - b.y1) < 1500
  const c = couleurCalque(piece.layer)
  const aire = surfaceSolM2(piece)
  // ÉVITEMENT DE COLLISION (14/07/2026) — l'étiquette était ancrée au centre
  // géométrique exact, c'est-à-dire précisément là où l'artisan pose ses
  // symboles (le clic tombe au milieu de la pièce). Nom, surface et état s'y
  // empilaient sur ~600 mm : sur une chambre, la moitié de la pièce devenait
  // une zone morte illisible.
  // Règle PURE et déterministe : si un symbole occupe la bande centrale, on
  // remonte le bloc d'étiquette vers le quart haut de la pièce (borné pour ne
  // jamais sortir du polygone). Sinon, on garde le centre (cas majoritaire).
  const bandeOccupee = symboles.some(
    (s) =>
      estDansPolygone(s.position, piece.vertices) &&
      Math.abs(s.position[0] - cx) < 900 &&
      s.position[1] > cyCentre - 500 &&
      s.position[1] < cyCentre + 800
  )
  const hauteur = b.y2 - b.y1
  const cy = bandeOccupee ? Math.max(b.y1 + 420, cyCentre - hauteur / 4) : cyCentre
  // Libellé d'état en TOUTES LETTRES sur la pièce (accessibilité daltonisme :
  // ne pas se reposer sur la seule couleur du sol). Masqué sur les rendus
  // « document » (avancementVisible false) et pour 'a_faire'/absent.
  const etat =
    avancementVisible && piece.layer !== 'projet' && piece.avancement && piece.avancement !== 'a_faire'
      ? AVANCEMENT_META[piece.avancement]
      : null
  return (
    <g pointerEvents="none">
      <text x={cx} y={cy - 60} fontFamily={FONT_TXT} fontSize={petite ? 230 : 300} fontWeight="700" fill={c} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="60">
        {piece.name}
      </text>
      <text x={cx} y={cy + 260} fontFamily={FONT_NUM} fontSize={petite ? 190 : 250} fill={piece.layer === 'projet' ? C.orange : C.navyMid} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="60">
        {fmtNombreFr(aire, 1)} m²
      </text>
      {etat && (
        <text x={cx} y={cy + 540} fontFamily={FONT_TXT} fontSize={petite ? 170 : 215} fontWeight="700" fill={etat.texte} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="70">
          {etat.court}
        </text>
      )}
      {piece.extType === 'piscine' && (
        <text x={cx} y={cy + (etat ? 800 : 540)} fontFamily={FONT_NUM} fontSize={petite ? 170 : 220} fill={C.navyMid} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="55">
          {fmtNombreFr(perimetreMl(piece))} ml de périmètre
        </text>
      )}
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
  selectedSymbolId?: string | null
  selectedFenceId?: string | null
  /** true dans l'éditeur (attributs data-* + curseurs), false pour l'export. */
  interactif?: boolean
  /** Préfixe des ids de <pattern> pour éviter les collisions. */
  idPrefix?: string
  /** Affiche la grille 1 m sous le plan (éditeur). */
  grille?: boolean
  /**
   * Affiche la teinte d'avancement des pièces (mode Avancement, Push 7).
   * true dans l'éditeur et l'export « plan de suivi de chantier ». FALSE pour
   * toute image destinée à un DEVIS (document pré-travaux, contractuel) : un
   * devis ne doit JAMAIS montrer une pièce « Terminé » ou « Réceptionné ».
   */
  avancementVisible?: boolean
}

/** Ordre des passes : grille → pièces → sélection → clôtures → ouvertures → cotes → étiquettes → symboles → badges. */
export default function PlanRender({
  niveau,
  vue,
  selectedRoomId = null,
  selectedSymbolId = null,
  selectedFenceId = null,
  interactif = false,
  idPrefix = 'plan',
  grille = false,
  avancementVisible = true,
}: PlanRenderProps) {
  const visibles = niveau.rooms.filter((r) => vue === 'tout' || (vue === 'projet' ? true : r.layer === 'existant'))
  const tri = [...visibles].sort((a, b) => Number(a.layer === 'projet') - Number(b.layer === 'projet'))
  const selection = selectedRoomId ? tri.find((r) => r.id === selectedRoomId) : undefined
  const creee = surfaceCreeeProjetM2(niveau.rooms)
  const opacite = (p: Piece) => (vue === 'projet' && p.layer === 'existant' ? 0.35 : 1)
  const symbolesVisibles = niveau.symbols.filter(
    (s) => vue === 'tout' || (vue === 'projet' ? true : s.layer === 'existant')
  )
  const cloturesVisibles = niveau.clotures.filter(
    (c) => vue === 'tout' || (vue === 'projet' ? true : c.layer === 'existant')
  )

  return (
    <g>
      {grille && <rect x={-50000} y={-50000} width={100000} height={100000} fill={`url(#${idPrefix}-grille)`} pointerEvents="none" />}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          <RenduPiece piece={r} idPrefix={idPrefix} interactif={interactif} avancementVisible={avancementVisible} />
        </g>
      ))}
      {selection && <RenduSelection piece={selection} />}
      {cloturesVisibles.map((c) => (
        <g key={c.id} opacity={vue === 'projet' && c.layer === 'existant' ? 0.35 : 1}>
          <ClotureSvg cloture={c} interactif={interactif} selectionnee={c.id === selectedFenceId} />
        </g>
      ))}
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
      {/* Symboles AVANT les étiquettes (14/07/2026) : l'ordre inverse faisait
          passer les symboles par-dessus le texte, et le halo du texte rongeait
          le symbole — les deux se mélangeaient. L'étiquette, qui s'écarte
          désormais du centre quand un symbole l'occupe, passe au-dessus. */}
      {symbolesVisibles.map((s) => (
        <g key={s.id} opacity={vue === 'projet' && s.layer === 'existant' ? 0.35 : 1}>
          <SymboleSvg symbole={s} interactif={interactif} selectionne={s.id === selectedSymbolId} />
        </g>
      ))}
      {tri.map((r) => (
        <g key={r.id} opacity={opacite(r)}>
          <RenduEtiquette piece={r} symboles={symbolesVisibles} avancementVisible={avancementVisible} />
        </g>
      ))}
      {vue !== 'existant' && creee > 0 &&
        tri.filter((r) => r.layer === 'projet' && r.cat === 'int').map((r) => <RenduBadgeProjet key={r.id} piece={r} />)}
    </g>
  )
}
