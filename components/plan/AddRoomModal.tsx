'use client'

/**
 * AddRoomModal — Modale d'ajout de pièce (Push 2, 03/07/2026).
 * Chips de types (8 fréquentes + « Voir tout » + Autre…), forme
 * Rectangle / En L / Polygone libre, dimensions en mètres (virgule
 * française), calque Existant / Projet. Reprend la maquette V2.1.
 */

import { useEffect, useRef, useState } from 'react'
import type { CalqueId } from '@/lib/plan/types'
import { CHIPS_BASE, CHIPS_PLUS, lireMetresEnMm, COTE_MIN_MM, COTE_MAX_MM } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export type FormePiece = 'rect' | 'L' | 'poly'

export interface DemandePiece {
  nom: string
  forme: FormePiece
  calque: CalqueId
  /** Dimensions en mm (absentes pour un polygone, dessiné au clic). */
  largeurMm?: number
  hauteurMm?: number
}

export interface AddRoomModalProps {
  open: boolean
  calqueParDefaut: CalqueId
  onValider: (demande: DemandePiece) => void
  onFermer: () => void
}

const FORMES: { key: FormePiece; label: string }[] = [
  { key: 'rect', label: 'Rectangle' },
  { key: 'L', label: 'En L' },
  { key: 'poly', label: 'Polygone libre' },
]

export default function AddRoomModal({ open, calqueParDefaut, onValider, onFermer }: AddRoomModalProps) {
  const [type, setType] = useState<string>('Chambre')
  const [nomLibre, setNomLibre] = useState('')
  const [voirTout, setVoirTout] = useState(false)
  const [forme, setForme] = useState<FormePiece>('rect')
  const [calque, setCalque] = useState<CalqueId>(calqueParDefaut)
  const [longueur, setLongueur] = useState('3,5')
  const [largeur, setLargeur] = useState('3')
  const nomLibreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setCalque(calqueParDefaut)
  }, [open, calqueParDefaut])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onFermer])

  if (!open) return null

  const valider = () => {
    const nom = type === '__libre' ? nomLibre.trim() || 'Pièce' : type
    if (forme === 'poly') {
      onValider({ nom, forme, calque })
      return
    }
    const w = lireMetresEnMm(longueur)
    const h = lireMetresEnMm(largeur)
    if (w === null || h === null || w < COTE_MIN_MM || w > COTE_MAX_MM || h < COTE_MIN_MM || h > COTE_MAX_MM) {
      toast.warning('Dimensions invalides', { description: 'Saisissez entre 0,5 et 30 m (ex. 4,5).' })
      return
    }
    onValider({ nom, forme, calque, largeurMm: w, hauteurMm: h })
  }

  const chip = (nom: string, cle?: string) => {
    const valeur = cle ?? nom
    const sel = type === valeur
    return (
      <button
        key={valeur}
        type="button"
        onClick={() => {
          setType(valeur)
          if (valeur === '__libre') setTimeout(() => nomLibreRef.current?.focus(), 30)
        }}
        aria-pressed={sel}
        className={`rounded-xl border-[1.5px] px-2 py-2 font-hanken text-[12.5px] font-semibold transition-colors ${
          sel ? 'border-orange bg-orange/5 text-orange' : 'border-gray-200 bg-white text-navy hover:border-gray-300'
        }`}
      >
        {nom}
      </button>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ajout-piece-titre" className="fixed inset-0 z-[95] flex items-end justify-center px-0 font-hanken sm:items-center sm:px-4">
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <h2 id="ajout-piece-titre" className="mb-4 text-[17px] font-extrabold tracking-tight text-navy">
          Ajouter une pièce
        </h2>

        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Type de pièce</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHIPS_BASE.map((n) => chip(n))}
          {chip('Autre…', '__libre')}
        </div>
        {voirTout && <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{CHIPS_PLUS.map((n) => chip(n))}</div>}
        <button
          type="button"
          onClick={() => setVoirTout((v) => !v)}
          className="mt-2 w-full rounded-xl border border-dashed border-gray-300 py-1.5 text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-navy"
        >
          {voirTout ? 'Réduire' : 'Voir tout'}
        </button>
        {type === '__libre' && (
          <input
            ref={nomLibreRef}
            value={nomLibre}
            onChange={(e) => setNomLibre(e.target.value)}
            placeholder="Nom de la pièce (ex. Atelier)"
            aria-label="Nom libre de la pièce"
            className="mt-2 w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 text-[14px] text-navy focus:border-orange focus:bg-white focus:outline-none"
          />
        )}

        <span className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Forme</span>
        <div className="flex rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Forme de la pièce">
          {FORMES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setForme(f.key)}
              aria-pressed={forme === f.key}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${
                forme === f.key ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {forme === 'poly' ? (
          <p className="mt-3 rounded-xl bg-sky/10 px-3 py-2.5 text-[12.5px] leading-snug text-navy">
            Vous allez dessiner la forme directement sur le plan : cliquez chaque angle de la pièce,
            les longueurs s&apos;affichent en direct. Double-clic (ou clic sur le premier point) pour fermer.
          </p>
        ) : (
          <div className="mt-3 flex items-end gap-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Longueur</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={longueur}
                  onChange={(e) => setLongueur(e.target.value)}
                  inputMode="decimal"
                  aria-label="Longueur en mètres"
                  className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                />
                <span className="text-[13px] text-gray-500">m</span>
              </div>
            </div>
            <span className="pb-2 text-gray-400" aria-hidden="true">×</span>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Largeur</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={largeur}
                  onChange={(e) => setLargeur(e.target.value)}
                  inputMode="decimal"
                  aria-label="Largeur en mètres"
                  className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                />
                <span className="text-[13px] text-gray-500">m</span>
              </div>
            </div>
          </div>
        )}

        <span className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Calque</span>
        <div className="flex gap-2">
          {(
            [
              { key: 'existant', label: 'Existant', aide: "l'état actuel" },
              { key: 'projet', label: 'Projet', aide: 'travaux à créer' },
            ] as const
          ).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCalque(c.key)}
              aria-pressed={calque === c.key}
              className={`flex-1 rounded-xl border-[1.5px] px-3 py-2 text-left transition-colors ${
                calque === c.key
                  ? c.key === 'projet'
                    ? 'border-orange bg-orange/5'
                    : 'border-navy bg-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`block text-[13px] font-bold ${c.key === 'projet' ? 'text-orange' : 'text-navy'}`}>{c.label}</span>
              <span className="block text-[11.5px] text-gray-500">{c.aide}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFermer}
            className="h-11 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 text-[14px] font-bold text-navy transition-colors hover:border-gray-300"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={valider}
            className="h-11 rounded-[12px] bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
          >
            {forme === 'poly' ? 'Dessiner sur le plan' : 'Ajouter la pièce'}
          </button>
        </div>
      </div>
    </div>
  )
}
