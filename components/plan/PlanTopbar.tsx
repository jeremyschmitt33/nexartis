'use client'

/**
 * PlanTopbar — Barre supérieure de l'éditeur de plan (Push 2, 03/07/2026).
 * Retour chantier, nom éditable, indicateur de sauvegarde, onglets niveaux,
 * undo/redo, segmented Existant / Projet / Tout.
 */

import Link from 'next/link'
import { useState } from 'react'
import type { Niveau } from '@/lib/plan/types'
import type { StatutSauvegarde } from './useAutosave'
import type { VueCalque } from './PlanRender'
import LevelTabs from './LevelTabs'

export interface PlanTopbarProps {
  nom: string
  onRenommer: (nom: string) => void
  statut: StatutSauvegarde
  retourHref: string
  /** Appelé au clic sur « retour » : flush de l'autosave avant navigation. */
  onRetour?: () => void
  niveaux: Niveau[]
  niveauId: string
  onNiveau: (id: string) => void
  onAjouterNiveau: () => void
  onRenommerNiveau: (id: string, name: string) => void
  vue: VueCalque
  onVue: (vue: VueCalque) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

const VUES: { key: VueCalque; label: string }[] = [
  { key: 'existant', label: 'Existant' },
  { key: 'projet', label: 'Projet' },
  { key: 'tout', label: 'Tout' },
]

function IndicateurSauvegarde({ statut }: { statut: StatutSauvegarde }) {
  if (statut === 'encours') {
    return (
      <span className="inline-flex items-center gap-1.5 font-hanken text-xs font-semibold text-gray-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-r-transparent" aria-hidden="true" />
        Enregistrement…
      </span>
    )
  }
  if (statut === 'erreur') {
    return (
      <span className="inline-flex items-center gap-1.5 font-hanken text-xs font-semibold text-red-600">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path strokeLinecap="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Non enregistré
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-hanken text-xs font-semibold text-emerald-600">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Enregistré
    </span>
  )
}

export default function PlanTopbar(props: PlanTopbarProps) {
  const [nomLocal, setNomLocal] = useState(props.nom)

  const commitNom = () => {
    const propre = nomLocal.trim()
    if (propre && propre !== props.nom) props.onRenommer(propre)
    else setNomLocal(props.nom)
  }

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
      <Link
        href={props.retourHref}
        onClick={props.onRetour}
        aria-label="Retour au chantier"
        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-[1.5px] border-gray-200 text-navy transition-colors hover:border-orange"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l7 7m-7-7l7-7" />
        </svg>
      </Link>

      <div className="flex min-w-0 items-center gap-3">
        <input
          value={nomLocal}
          onChange={(e) => setNomLocal(e.target.value)}
          onBlur={commitNom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          aria-label="Nom du plan"
          className="w-36 truncate rounded-lg border-[1.5px] border-transparent bg-transparent px-2 py-1 font-hanken text-[15px] font-extrabold tracking-tight text-navy transition-colors hover:border-gray-200 focus:border-orange focus:bg-white focus:outline-none sm:w-52"
        />
        <IndicateurSauvegarde statut={props.statut} />
      </div>

      <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex flex-wrap items-center justify-start gap-2 sm:justify-center">
        <LevelTabs
          niveaux={props.niveaux}
          actifId={props.niveauId}
          onChange={props.onNiveau}
          onAjouter={props.onAjouterNiveau}
          onRenommer={props.onRenommerNiveau}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            aria-label="Annuler (Ctrl+Z)"
            title="Annuler (Ctrl+Z)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-gray-200 text-navy transition-colors hover:border-orange disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
              <path strokeLinecap="round" d="M4 9h10.5a5.5 5.5 0 010 11H11" />
            </svg>
          </button>
          <button
            type="button"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            aria-label="Rétablir (Ctrl+Y)"
            title="Rétablir (Ctrl+Y)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-gray-200 text-navy transition-colors hover:border-orange disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5-5-5" />
              <path strokeLinecap="round" d="M20 9H9.5a5.5 5.5 0 000 11H13" />
            </svg>
          </button>
        </div>

        <div className="flex rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Calques affichés">
          {VUES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => props.onVue(v.key)}
              aria-pressed={props.vue === v.key}
              className={`rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-all ${
                props.vue === v.key ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
