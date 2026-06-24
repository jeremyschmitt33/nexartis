'use client'

// ---------------------------------------------------------------------------
// Onglet CALCULATRICES du dashboard.
// - Grille de calculatrices metier (formules cote client, zero base de donnees).
// - L'artisan choisit lesquelles afficher ("Mes calculatrices").
// - Choix pre-rempli selon son metier, memorise sur l'appareil (localStorage).
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { SlidersHorizontal, Check, Calculator } from 'lucide-react'
import { useEntreprise } from '@/lib/hooks'
import { CALCULATRICES, defaultSelection } from '@/components/calculatrice/registry'
import { CalcCard, cx } from '@/components/calculatrice/ui'

const STORAGE_KEY = 'nexartis-calculatrices'

export default function CalculatricePage() {
  const { entreprise, loading } = useEntreprise()
  const [selected, setSelected] = useState<string[] | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [editing, setEditing] = useState(false)

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-hanken text-2xl font-bold text-navy flex items-center gap-2">
            <Calculator className="text-orange" size={24} />
            Calculatrices
          </h1>
          <p className="text-sm text-navy/60 mt-1 max-w-xl">
            Des calculs prets pour le terrain. Choisis celles utiles a ton metier, elles sont
            memorisees sur cet appareil.
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={cx(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition',
            editing
              ? 'bg-orange text-white border-orange'
              : 'bg-white text-navy border-navy/15 hover:border-orange/40',
          )}
        >
          <SlidersHorizontal size={16} />
          Mes calculatrices
        </button>
      </div>

      {/* Selecteur "Mes calculatrices" */}
      {editing && (
        <div className="rounded-2xl bg-white border border-navy/10 p-4">
          <p className="text-sm font-medium text-navy/80 mb-3">
            Coche les calculatrices a afficher :
          </p>
          <div className="flex flex-wrap gap-2">
            {CALCULATRICES.map((c) => {
              const on = sel.includes(c.id)
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={cx(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition',
                    on
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-navy/70 border-navy/15 hover:border-navy/30',
                  )}
                >
                  <Icon size={15} className={on ? 'text-orange' : 'text-navy/50'} />
                  {c.label}
                  {on && <Check size={14} className="text-orange" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Etat de chargement initial */}
      {selected === null ? (
        <div className="text-sm text-navy/50 py-10 text-center">Chargement...</div>
      ) : active.length === 0 ? (
        <div className="rounded-2xl bg-cream/50 border border-navy/10 p-8 text-center">
          <p className="text-navy/70">Aucune calculatrice selectionnee.</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange text-white text-sm font-medium"
          >
            <SlidersHorizontal size={16} />
            Choisir mes calculatrices
          </button>
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
