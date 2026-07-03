'use client'

/**
 * CoteInput — Input inline positionné sur une cote cliquée (Push 2).
 * Saisie en mètres à la française (« 3,5 »), Entrée = valider, Échap = annuler.
 */

import { useEffect, useRef, useState } from 'react'
import { lireMetresEnMm, mmVersSaisieM } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export interface CoteInputProps {
  /** Position du centre de l'étiquette, en px relatifs au wrapper du canvas. */
  x: number
  y: number
  valeurMm: number
  onCommit: (mm: number) => void
  onCancel: () => void
}

export default function CoteInput({ x, y, valeurMm, onCommit, onCancel }: CoteInputProps) {
  const [valeur, setValeur] = useState(() => mmVersSaisieM(valeurMm))
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.focus()
      ref.current?.select()
    }, 30)
    return () => clearTimeout(t)
  }, [])

  const valider = () => {
    const mm = lireMetresEnMm(valeur)
    if (mm === null) {
      toast.warning('Saisie invalide', { description: 'Exemple : 3,5 (en mètres).' })
      onCancel()
      return
    }
    onCommit(mm)
  }

  return (
    <div className="absolute z-20" style={{ left: x - 46, top: y - 18 }}>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        aria-label="Nouvelle dimension en mètres"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            valider()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        className="w-[92px] rounded-lg border-[1.5px] border-orange bg-white px-2 py-1 text-center font-spline-mono text-[13px] font-medium text-navy shadow-lg focus:outline-none"
      />
    </div>
  )
}
