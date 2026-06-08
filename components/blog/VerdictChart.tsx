'use client'

/**
 * VerdictChart — Graphique horizontal de notes /10 par critère.
 *
 * SVG pur (zéro dépendance), animation au scroll into view via
 * IntersectionObserver. Couleur de la barre dépend de la note :
 *   < 4   → rouge (#ef4444)
 *   4-6.5 → ambre (#f5c842)
 *   ≥ 6.5 → mint  (#2fd6a0)
 *
 * Usage :
 *   <VerdictChart
 *     title="Tolteck — Notes détaillées"
 *     scores={[
 *       { label: 'Devis & factures', score: 8.5 },
 *       { label: 'Mobile', score: 7.5 },
 *       { label: 'Planning', score: 5 },
 *     ]}
 *   />
 */

import { useEffect, useRef, useState } from 'react'

export type ScoreItem = {
  label: string
  score: number // 0-10
  comment?: string
}

export default function VerdictChart({
  title,
  scores,
  scale = 10,
}: {
  title?: string
  scores: ScoreItem[]
  /** échelle max (défaut 10) */
  scale?: number
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

  const avg =
    scores.reduce((sum, s) => sum + s.score, 0) / Math.max(scores.length, 1)

  return (
    <figure
      ref={ref}
      className="my-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      {title && (
        <figcaption className="mb-6 flex items-baseline justify-between gap-4">
          <h3 className="font-hanken text-lg font-bold text-[#0f1a3a] md:text-xl">
            {title}
          </h3>
          <div className="font-spline-mono text-2xl font-semibold text-[#0f1a3a] md:text-3xl">
            {avg.toFixed(1)}
            <span className="ml-1 text-sm text-gray-400">/{scale}</span>
          </div>
        </figcaption>
      )}

      <div className="space-y-4">
        {scores.map((item, i) => {
          const pct = Math.max(0, Math.min(100, (item.score / scale) * 100))
          const color = colorFor(item.score, scale)
          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-hanken text-sm font-semibold text-[#0f1a3a]">
                  {item.label}
                </span>
                <span className="font-spline-mono text-sm font-semibold tabular-nums text-[#0f1a3a]">
                  {item.score.toFixed(1)}
                  <span className="text-gray-400">/{scale}</span>
                </span>
              </div>
              <div
                className="relative h-2.5 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={item.score}
                aria-valuemin={0}
                aria-valuemax={scale}
                aria-label={`${item.label} : ${item.score}/${scale}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                  style={{
                    width: visible ? `${pct}%` : '0%',
                    background: color,
                    transitionDelay: `${i * 110}ms`,
                  }}
                />
              </div>
              {item.comment && (
                <p className="mt-1 font-hanken text-xs leading-snug text-gray-500">
                  {item.comment}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </figure>
  )
}

function colorFor(score: number, scale: number): string {
  const pct = score / scale
  if (pct < 0.4)
    return 'linear-gradient(90deg, #ef4444, #f87171)' // rouge
  if (pct < 0.65)
    return 'linear-gradient(90deg, #f5c842, #fbbf24)' // ambre
  return 'linear-gradient(90deg, #2fd6a0, #3f7bff)' // mint→electric (succès)
}
