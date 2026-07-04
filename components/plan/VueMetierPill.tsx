'use client'

/**
 * VueMetierPill — Badge « Vue métier » de la topbar + popover de sélection
 * (Push 3a, 03/07/2026). « Tous les métrés » toujours en 1re position,
 * puis les profils actifs (lib/plan/profils). Le changement refiltre la
 * palette et le panneau métrés, et est mémorisé PAR PLAN (metier_defaut).
 */

import { useEffect, useRef, useState } from 'react'
import { ORDRE_VUES, PROFILS, type MetierId } from '@/lib/plan/profils'

export interface VueMetierPillProps {
  metier: MetierId
  onMetier: (metier: MetierId) => void
}

export default function VueMetierPill({ metier, onMetier }: VueMetierPillProps) {
  const [ouvert, setOuvert] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const onClic = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOuvert(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', onClic)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClic)
      window.removeEventListener('keydown', onKey)
    }
  }, [ouvert])

  const vues = ORDRE_VUES.filter((v) => PROFILS[v].actif)

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-label={`Vue métier : ${PROFILS[metier].label} — changer`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-gray-200 bg-white px-3 font-hanken text-xs font-bold text-navy transition-colors hover:border-orange"
      >
        <svg className="h-3.5 w-3.5 text-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
        <span className="hidden max-w-[130px] truncate sm:inline">{PROFILS[metier].label}</span>
        <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <div
          role="menu"
          aria-label="Vue métier"
          className="absolute left-0 top-11 z-40 w-60 rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
        >
          <p className="px-3 pb-1 pt-1.5 font-hanken text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
            Vue métier
          </p>
          {vues.map((v) => {
            const actif = v === metier
            return (
              <button
                key={v}
                type="button"
                role="menuitemradio"
                aria-checked={actif}
                onClick={() => {
                  setOuvert(false)
                  if (!actif) onMetier(v)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left font-hanken text-[13px] font-semibold transition-colors ${
                  actif ? 'bg-orange/5 text-orange' : 'text-navy hover:bg-gray-50'
                }`}
              >
                {PROFILS[v].label}
                {actif && (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
          <p className="px-3 pb-1 pt-1.5 font-hanken text-[10.5px] leading-snug text-gray-400">
            Le moteur calcule tous les métrés en permanence — la vue ne fait que filtrer l&apos;affichage.
          </p>
        </div>
      )}
    </div>
  )
}
