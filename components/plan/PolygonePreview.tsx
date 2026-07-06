/**
 * PolygonePreview — Aperçu du polygone en cours de dessin (Push 3a, 03/07/2026).
 *
 * Extrait de PlanCanvas (limite de 450 lignes par fichier). Rendu PUR :
 * polyligne élastique + cotes live + points cliqués + cible de fermeture.
 * Coordonnées monde (mm), le parent applique la transformation viewport.
 */

import type { CalqueId, PointMm } from '@/lib/plan/types'
import { fmtNombreFr, mmVersM } from '@/lib/plan/geometry'
import { COULEURS_PLAN } from '@/lib/plan/defaults'

const C = COULEURS_PLAN

export interface PolygonePreviewProps {
  points: PointMm[]
  souris: PointMm | null
  calque: CalqueId
  /** true pour une CLÔTURE (polyligne ouverte) : pas de fond ni de cible de fermeture. */
  ouvert?: boolean
}

export default function PolygonePreview({ points, souris, calque, ouvert = false }: PolygonePreviewProps) {
  if (points.length === 0) return null
  const c = calque === 'projet' ? C.orange : C.navyMid
  const pts = souris ? [...points, souris] : points
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const L = Math.hypot(x2 - x1, y2 - y1)
    if (L < 200) continue
    segs.push(
      <text
        key={i}
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 - 140}
        fontFamily="'Spline Sans Mono', monospace"
        fontSize="230"
        fill={c}
        textAnchor="middle"
        paintOrder="stroke"
        stroke={C.fond}
        strokeWidth="65"
      >
        {fmtNombreFr(mmVersM(L))} m
      </text>
    )
  }
  return (
    <g pointerEvents="none">
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill={ouvert ? 'none' : 'rgba(90,180,224,0.08)'}
        stroke={c}
        strokeWidth="2.4"
        strokeDasharray={ouvert ? '14 7' : '8 6'}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {segs}
      {points.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="90" fill={C.blanc} stroke={c} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      ))}
      {!ouvert && (
        <circle
          cx={points[0][0]}
          cy={points[0][1]}
          r="150"
          fill="none"
          stroke={C.orange}
          strokeWidth="2"
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}
