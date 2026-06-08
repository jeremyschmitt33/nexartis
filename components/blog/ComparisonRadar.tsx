'use client'

/**
 * ComparisonRadar — Radar chart comparant plusieurs solutions sur 4-8 axes.
 *
 * SVG pur (zéro dépendance), animation au scroll into view.
 *
 * Usage :
 *   <ComparisonRadar
 *     axes={['Devis', 'Facturation', 'Planning', 'Mobile', 'Prix', 'Support']}
 *     series={[
 *       { name: 'Tolteck',  color: '#3f7bff', values: [8.5, 8, 5, 7.5, 6, 7] },
 *       { name: 'Nexartis', color: '#ff7a1a', values: [8,   8, 9, 7.5, 9, 8] },
 *       { name: 'Obat',     color: '#8b6dff', values: [7,   7, 6, 6,   5, 7] },
 *     ]}
 *   />
 */

import { useEffect, useRef, useState } from 'react'

export type RadarSeries = {
  name: string
  color: string
  values: number[] // doit avoir la même longueur que `axes`
}

const SIZE = 360
const CENTER = SIZE / 2
const RADIUS = 130
const RINGS = 5

export default function ComparisonRadar({
  axes,
  series,
  scale = 10,
  title,
}: {
  axes: string[]
  series: RadarSeries[]
  scale?: number
  title?: string
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const N = axes.length

  const angleFor = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2 // commence en haut

  const pointFor = (i: number, value: number) => {
    const ratio = Math.max(0, Math.min(1, value / scale))
    const r = RADIUS * ratio * (visible ? 1 : 0)
    const a = angleFor(i)
    return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r] as const
  }

  const axisEnd = (i: number) => {
    const a = angleFor(i)
    return [CENTER + Math.cos(a) * RADIUS, CENTER + Math.sin(a) * RADIUS] as const
  }

  const labelPos = (i: number) => {
    const a = angleFor(i)
    const r = RADIUS + 24
    return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r] as const
  }

  return (
    <figure
      ref={ref}
      className="my-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      {title && (
        <figcaption className="mb-6 font-hanken text-lg font-bold text-[#0f1a3a] md:text-xl">
          {title}
        </figcaption>
      )}

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-between">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full max-w-[360px]"
          role="img"
          aria-label={`Radar de comparaison sur ${axes.join(', ')}`}
        >
          {/* Rings */}
          {Array.from({ length: RINGS }).map((_, i) => {
            const r = (RADIUS * (i + 1)) / RINGS
            const d =
              axes
                .map((_, j) => {
                  const a = angleFor(j)
                  const x = CENTER + Math.cos(a) * r
                  const y = CENTER + Math.sin(a) * r
                  return `${j === 0 ? 'M' : 'L'} ${x} ${y}`
                })
                .join(' ') + ' Z'
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            )
          })}

          {/* Axes */}
          {axes.map((_, i) => {
            const [x, y] = axisEnd(i)
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            )
          })}

          {/* Series polygons */}
          {series.map((s) => {
            const points = s.values
              .map((v, i) => {
                const [x, y] = pointFor(i, v)
                return `${x},${y}`
              })
              .join(' ')
            return (
              <g key={s.name} style={{ transition: 'all 0.9s ease-out' }}>
                <polygon
                  points={points}
                  fill={s.color}
                  fillOpacity={0.18}
                  stroke={s.color}
                  strokeWidth={2}
                  style={{ transition: 'all 0.9s ease-out' }}
                />
                {s.values.map((v, i) => {
                  const [x, y] = pointFor(i, v)
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={3.5}
                      fill="#fff"
                      stroke={s.color}
                      strokeWidth={2}
                      style={{ transition: 'all 0.9s ease-out' }}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Labels */}
          {axes.map((label, i) => {
            const [x, y] = labelPos(i)
            const a = angleFor(i)
            // alignement texte selon position
            let anchor: 'start' | 'middle' | 'end' = 'middle'
            const cos = Math.cos(a)
            if (cos > 0.3) anchor = 'start'
            else if (cos < -0.3) anchor = 'end'
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontFamily="var(--font-hanken), sans-serif"
                fontSize={11}
                fontWeight={700}
                fill="#0f1a3a"
              >
                {label}
              </text>
            )
          })}
        </svg>

        {/* Légende */}
        <div className="flex w-full flex-col gap-3 lg:max-w-[200px]">
          {series.map((s) => {
            const avg =
              s.values.reduce((sum, v) => sum + v, 0) / Math.max(s.values.length, 1)
            return (
              <div
                key={s.name}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  <span className="font-hanken text-sm font-semibold text-[#0f1a3a]">
                    {s.name}
                  </span>
                </div>
                <span className="font-spline-mono text-sm font-semibold tabular-nums text-gray-600">
                  {avg.toFixed(1)}
                  <span className="text-gray-400">/{scale}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
