/**
 * SymboleSvg — Rendu SVG PUR d'un symbole métier (Push 3a, 03/07/2026).
 *
 * AUCUN state : convertit les formes déclarées dans lib/plan/symboles.ts
 * (coordonnées locales mm) en éléments SVG. Couleur navy/orange selon le
 * calque (attributs explicites, exportable tel quel — même règle que
 * PlanRender). `IconeSymbole` réutilise les mêmes formes pour la palette.
 */

import type { Symbole } from '@/lib/plan/types'
import { COULEURS_PLAN } from '@/lib/plan/defaults'
import { defSymbole, type FormeSymbole } from '@/lib/plan/symboles'

const C = COULEURS_PLAN
const FONT_NUM = "'Spline Sans Mono', ui-monospace, monospace"

/**
 * Une forme élémentaire (trait 2 px écran via non-scaling-stroke).
 * Exportée depuis le Push 6 : la vue 3D (Iso3dView) réutilise les MÊMES
 * glyphes pour dessiner les symboles en 3D (parité visuelle 2D/3D).
 */
export function Forme({ f, c }: { f: FormeSymbole; c: string }) {
  const trait = {
    stroke: c,
    strokeWidth: 2,
    fill: 'none',
    vectorEffect: 'non-scaling-stroke',
    strokeLinecap: 'round' as const,
  }
  if (f.forme === 'cercle') {
    return (
      <circle
        cx={f.cx}
        cy={f.cy}
        r={f.r}
        {...trait}
        fill={f.plein ? c : f.fond ? C.blanc : 'none'}
        stroke={f.plein ? 'none' : c}
      />
    )
  }
  if (f.forme === 'ellipse') return <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...trait} />
  if (f.forme === 'ligne') {
    return (
      <line
        x1={f.x1}
        y1={f.y1}
        x2={f.x2}
        y2={f.y2}
        {...trait}
        strokeDasharray={f.pointille ? '6 5' : undefined}
      />
    )
  }
  if (f.forme === 'rect') {
    return (
      <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx} {...trait} fill={f.fond ? C.blanc : 'none'} />
    )
  }
  if (f.forme === 'chemin') return <path d={f.d} {...trait} />
  return (
    <text
      x={f.x}
      y={f.y}
      fontFamily={FONT_NUM}
      fontSize={f.taille}
      fontWeight="600"
      fill={c}
      textAnchor="middle"
    >
      {f.t}
    </text>
  )
}

export interface SymboleSvgProps {
  symbole: Symbole
  /** true dans l'éditeur : zone cliquable data-symbol-id + curseur. */
  interactif?: boolean
  selectionne?: boolean
}

/** Symbole posé sur le plan (groupe en coordonnées monde, mm). */
export default function SymboleSvg({ symbole, interactif = false, selectionne = false }: SymboleSvgProps) {
  const def = defSymbole(symbole.type)
  if (!def) return null
  const c = symbole.layer === 'projet' ? C.orange : C.navy
  const rot = symbole.rotation ? ` rotate(${symbole.rotation})` : ''
  return (
    <g transform={`translate(${symbole.position[0]} ${symbole.position[1]})${rot}`}>
      {selectionne && (
        <circle
          r={def.rayon + 90}
          fill={C.sky}
          fillOpacity="0.08"
          stroke={C.sky}
          strokeWidth="2"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      <g pointerEvents="none">
        {def.formes.map((f, i) => (
          <Forme key={i} f={f} c={c} />
        ))}
      </g>
      <circle
        r={def.rayon}
        fill="transparent"
        stroke="none"
        data-symbol-id={interactif ? symbole.id : undefined}
        pointerEvents={interactif ? 'all' : 'none'}
        style={interactif ? { cursor: 'move' } : undefined}
      >
        <title>{def.label}</title>
      </circle>
    </g>
  )
}

/** Icône de palette : mêmes formes, en `currentColor`, dans un petit svg. */
export function IconeSymbole({ type, className }: { type: string; className?: string }) {
  const def = defSymbole(type)
  if (!def) return null
  const r = def.rayon + 80
  return (
    <svg viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} className={className} aria-hidden="true">
      {def.formes.map((f, i) => (
        <Forme key={i} f={f} c="currentColor" />
      ))}
    </svg>
  )
}
