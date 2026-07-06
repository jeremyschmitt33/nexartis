/**
 * ClotureSvg — Rendu SVG PUR d'une clôture / grillage (Push 3b, 06/07/2026).
 *
 * Même règle que PlanRender : aucun state, attributs SVG explicites via
 * COULEURS_PLAN (exportable tel quel au Push 4). Polyligne OUVERTE en
 * pointillé long + croisillons de grillage tous les 1,6 m + cote ml au
 * centre de la polyligne. En mode interactif : polyligne « fantôme » large
 * (data-fence-id) pour la sélection au clic.
 */

import type { Cloture, PointMm } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { clotureMl } from '@/lib/plan/metrics'
import { COULEURS_PLAN } from '@/lib/plan/defaults'

const C = COULEURS_PLAN
const FONT_NUM = "'Spline Sans Mono', ui-monospace, monospace"

/** Espacement des croisillons (mm) et demi-taille du × (mm). */
const PAS_CROISILLON_MM = 1600
const TAILLE_CROISILLON_MM = 110

/** Point situé à `dist` mm du départ le long de la polyligne. */
function pointA(points: PointMm[], dist: number): PointMm {
  let reste = dist
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const L = Math.hypot(x2 - x1, y2 - y1)
    if (reste <= L || i === points.length - 2) {
      const t = L > 0 ? Math.max(0, Math.min(1, reste / L)) : 0
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
    }
    reste -= L
  }
  return points[0]
}

function Croisillons({ points, couleur }: { points: PointMm[]; couleur: string }) {
  const traits: React.ReactNode[] = []
  const S = TAILLE_CROISILLON_MM
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const L = Math.hypot(x2 - x1, y2 - y1)
    for (let k = 0; (k + 0.5) * PAS_CROISILLON_MM < L; k++) {
      const t = ((k + 0.5) * PAS_CROISILLON_MM) / L
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      traits.push(
        <path
          key={`${i}-${k}`}
          d={`M ${x - S} ${y - S} L ${x + S} ${y + S} M ${x - S} ${y + S} L ${x + S} ${y - S}`}
          stroke={couleur}
          strokeWidth="1"
          strokeOpacity="0.5"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )
    }
  }
  return <g>{traits}</g>
}

export interface ClotureSvgProps {
  cloture: Cloture
  /** true dans l'éditeur : polyligne fantôme cliquable data-fence-id. */
  interactif?: boolean
  selectionnee?: boolean
}

export default function ClotureSvg({ cloture, interactif = false, selectionnee = false }: ClotureSvgProps) {
  if (cloture.points.length < 2) return null
  const base = cloture.layer === 'projet' ? C.orange : C.navy
  const couleur = selectionnee ? C.orange : base
  const pts = cloture.points.map((p) => p.join(',')).join(' ')
  const ml = clotureMl(cloture)
  const milieu = pointA(cloture.points, (ml * 1000) / 2)
  return (
    <g>
      {interactif && (
        <polyline
          points={pts}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          data-fence-id={cloture.id}
          style={{ cursor: 'pointer' }}
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={couleur}
        strokeWidth={selectionnee ? 2.6 : 1.8}
        strokeDasharray="16 8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <Croisillons points={cloture.points} couleur={couleur} />
      <text
        x={milieu[0]}
        y={milieu[1] - 220}
        fontFamily={FONT_NUM}
        fontSize="240"
        fill={couleur}
        textAnchor="middle"
        paintOrder="stroke"
        stroke={C.fond}
        strokeWidth="65"
        pointerEvents="none"
      >
        {fmtNombreFr(ml)} ml
      </text>
    </g>
  )
}
