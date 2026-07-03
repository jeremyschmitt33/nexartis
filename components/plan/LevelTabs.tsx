'use client'

/**
 * LevelTabs — Onglets de niveaux (RDC / Étage 1 / +) avec renommage inline
 * (double-clic ou bouton crayon sur l'onglet actif). Push 2, 03/07/2026.
 */

import { useEffect, useRef, useState } from 'react'
import type { Niveau } from '@/lib/plan/types'

export interface LevelTabsProps {
  niveaux: Niveau[]
  actifId: string
  onChange: (id: string) => void
  onAjouter: () => void
  onRenommer: (id: string, name: string) => void
}

export default function LevelTabs({ niveaux, actifId, onChange, onAjouter, onRenommer }: LevelTabsProps) {
  const [editionId, setEditionId] = useState<string | null>(null)
  const [brouillon, setBrouillon] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editionId) {
      const t = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 30)
      return () => clearTimeout(t)
    }
  }, [editionId])

  const demarrerEdition = (niv: Niveau) => {
    setEditionId(niv.id)
    setBrouillon(niv.name)
  }

  const valider = () => {
    if (editionId && brouillon.trim()) onRenommer(editionId, brouillon)
    setEditionId(null)
  }

  const tries = [...niveaux].sort((a, b) => a.order - b.order)

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="tablist" aria-label="Niveaux du plan">
      {tries.map((niv) => {
        const actif = niv.id === actifId
        if (editionId === niv.id) {
          return (
            <input
              key={niv.id}
              ref={inputRef}
              value={brouillon}
              onChange={(e) => setBrouillon(e.target.value)}
              onBlur={valider}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  valider()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditionId(null)
                }
              }}
              aria-label="Nom du niveau"
              className="w-24 rounded-lg border-[1.5px] border-orange bg-white px-2 py-1 font-hanken text-xs font-bold text-navy focus:outline-none"
            />
          )
        }
        return (
          <button
            key={niv.id}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => (actif ? demarrerEdition(niv) : onChange(niv.id))}
            onDoubleClick={() => demarrerEdition(niv)}
            title={actif ? 'Cliquer pour renommer ce niveau' : `Afficher ${niv.name}`}
            className={`rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-all ${
              actif ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {niv.name}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onAjouter}
        aria-label="Ajouter un niveau"
        title="Ajouter un niveau"
        className="rounded-lg px-2.5 py-1.5 font-hanken text-xs font-bold text-gray-500 hover:text-orange transition-colors"
      >
        +
      </button>
    </div>
  )
}
