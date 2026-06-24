'use client'

// ---------------------------------------------------------------------------
// Onglet CALCULATRICES du dashboard (V2).
// - Selecteur "Mes calculatrices" TOUJOURS visible (pastilles), plus de bouton
//   cache. Pre-rempli selon le metier, memorise sur l'appareil (localStorage).
// - Grille de calculatrices metier. Calculs cote client, zero base de donnees.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { Calculator } from 'lucide-react'
import { useEntreprise } from '@/lib/hooks'
import { CALCULATRICES, defaultSelection } from '@/components/calculatrice/registry'
import { CalcCard, cx } from '@/components/calculatrice/ui'

const STORAGE_KEY = 'nexartis-calculatrices'

export default function CalculatricePage() {
  const { entreprise, loading } = useEntreprise()
  const [selected, setSelected] = useState<string[] | null>(null)
  const [initialized, setInitialized] = useState(false)

  // 1) Au montage : lire le choix memorise sur l'appareil.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ids = JSON.parse(raw)
        if (Array.isArray(ids)) {
          setSelected(ids.filter((id) => typeof id === 'string'))
          setInitialized(true)
        }
      }
    } catch {
      /* localStorage indisponible : on retombera sur le defaut metier */
    }
  }, [])

  // 2) Pas de choix memorise -> pre-remplir selon le metier une fois charge.
  useEffect(() => {
    if (initialized || loading) return
    setSelected(defaultSelection((entreprise as { metier?: string } | null | undefined)?.metier))
    setInitialized(true)
  }, [initialized, loading, entreprise])

  function save(ids: string[]) {
    setSelected(ids)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  }

  function toggle(id: string) {
    const cur = selected ?? []
    save(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }

  const sel = selected ?? []
  const active = CALCULATRICES.filter((c) => sel.includes(c.id))

  return (
    <div className="space-y-5">
      {/* En-tete */}
      <div>
        <h1 className="font-hanken text-2xl font-bold text-navy flex items-center gap-2">
          <Calculator className="text-orange" size={24} />
          Calculatrices
        </h1>
        <p className="text-sm text-navy/65 mt-1 max-w-xl">
          Des calculs prets pour le terrain. Coche celles utiles a ton metier, elles sont
          memorisees sur cet appareil.
        </p>
      </div>

      {/* Selecteur "Mes calculatrices" — toujours visible */}
      <div className="rounded-2xl bg-white border-2 border-navy/15 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-navy/55">
            Mes calculatrices
          </span>
          <span className="font-spline-mono text-xs font-bold text-orange">
            {sel.length}/{CALCULATRICES.length}
          </span>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-wrap"
          style={{ scrollbarWidth: 'none' }}
        >
          {CALCULATRICES.map((c) => {
            const on = sel.includes(c.id)
            const Icon = c.icon
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className={cx(
                  'inline-flex items-center gap-2 shrink-0 h-11 px-4 rounded-full text-sm font-semibold border-2 transition active:scale-95',
                  on
                    ? 'bg-navy text-white border-navy shadow-sm'
                    : 'bg-cream/70 text-navy/70 border-transparent hover:border-navy/20',
                )}
              >
                <Icon size={16} className={on ? 'text-orange' : 'text-navy/40'} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu */}
      {selected === null ? (
        <div className="text-sm text-navy/50 py-10 text-center">Chargement...</div>
      ) : active.length === 0 ? (
        <div className="rounded-2xl bg-cream/60 border-2 border-navy/15 p-8 text-center">
          <p className="text-navy/70">Coche une calculatrice ci-dessus pour l&apos;afficher.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {active.map((c) => {
            const Component = c.Component
            return (
              <CalcCard key={c.id} title={c.label} icon={c.icon}>
                <Component />
              </CalcCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
