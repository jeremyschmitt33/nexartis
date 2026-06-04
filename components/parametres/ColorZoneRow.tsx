'use client'

// ---------------------------------------------------------------------------
// ColorZoneRow
//
// Une "ligne" du panneau de droite du DocumentThemePicker : représente
// une des 6 zones du thème document. Affiche :
//   - une pastille de couleur (qui ouvre le color picker natif au clic)
//   - le nom de la zone + description courte
//   - le code hex éditable (validation #RRGGBB)
//   - un bouton "↺" pour réinitialiser au défaut Nexartis
//
// Le picker est un input type="color" caché, déclenché par .click() depuis
// la pastille — ça évite d'avoir à gérer un Popover custom et reste 100% natif.
// ---------------------------------------------------------------------------

import { useId, useRef, useState, useEffect } from 'react'
import { isValidHex } from '@/lib/document-theme'
import type { ThemeZone } from './DocumentMockup'

export interface ZoneMeta {
  id: ThemeZone
  label: string
  description: string
  defaultColor: string
}

interface Props {
  zone: ZoneMeta
  value: string
  isActive: boolean
  onChange: (hex: string) => void
  onActivate: () => void
  onReset: () => void
}

export default function ColorZoneRow({
  zone,
  value,
  isActive,
  onChange,
  onActivate,
  onReset,
}: Props) {
  const colorInputId = useId()
  const colorInputRef = useRef<HTMLInputElement | null>(null)
  // Local state pour le champ texte hex : permet de saisir un hex partiel
  // sans déclencher onChange immédiatement, et d'afficher une erreur.
  const [textInput, setTextInput] = useState(value)
  const [textError, setTextError] = useState(false)

  // Sync local state quand la valeur externe change (reset, fetch, etc.)
  useEffect(() => {
    setTextInput(value)
    setTextError(false)
  }, [value])

  // Ouvre le color picker natif. Sur certains navigateurs il faut un user
  // gesture immédiat, donc on déclenche depuis le onClick du bouton.
  const openPicker = () => {
    onActivate()
    colorInputRef.current?.click()
  }

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.toLowerCase()
    if (isValidHex(next)) {
      onChange(next)
    }
  }

  // Validation du champ texte au blur (et autocorrection : ajoute # si absent)
  const handleTextBlur = () => {
    let candidate = textInput.trim().toLowerCase()
    if (candidate && !candidate.startsWith('#')) candidate = '#' + candidate
    if (isValidHex(candidate)) {
      setTextError(false)
      setTextInput(candidate)
      if (candidate !== value) onChange(candidate)
    } else {
      setTextError(true)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value)
    if (textError) setTextError(false)
  }

  const isDefault = value.toLowerCase() === zone.defaultColor.toLowerCase()

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        isActive ? 'border-orange bg-orange/5' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {/* Pastille couleur — cliquable pour ouvrir le picker */}
      <button
        type="button"
        onClick={openPicker}
        aria-label={`Choisir la couleur de ${zone.label}`}
        className="relative h-10 w-10 flex-shrink-0 rounded-lg border border-slate-300 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-1"
        style={{ background: value }}
      >
        {/* Petite icône pinceau au survol — purement décorative */}
        <span className="sr-only">Ouvrir le sélecteur de couleur</span>
      </button>

      {/* Input color caché qui pilote le picker natif */}
      <input
        ref={colorInputRef}
        id={colorInputId}
        type="color"
        value={value}
        onChange={handlePickerChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Bloc texte : label + description + champ hex */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-syne text-sm font-bold text-navy">{zone.label}</h4>
          {!isDefault && (
            <button
              type="button"
              onClick={onReset}
              title="Réinitialiser au défaut Nexartis"
              aria-label={`Réinitialiser la couleur de ${zone.label} au défaut Nexartis`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-orange focus:outline-none focus:ring-2 focus:ring-orange"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
                />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 font-manrope leading-snug">
          {zone.description}
        </p>

        {/* Champ hex éditable + bouton "Modifier" */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            maxLength={7}
            spellCheck={false}
            aria-label={`Code hexadécimal de ${zone.label}`}
            aria-invalid={textError}
            className={`w-24 rounded-md border px-2 py-1 text-xs font-mono uppercase tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-orange ${
              textError
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-slate-300 bg-white text-navy'
            }`}
            placeholder="#RRGGBB"
          />
          <button
            type="button"
            onClick={openPicker}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-orange hover:text-orange focus:outline-none focus:ring-2 focus:ring-orange"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Modifier
          </button>
        </div>
        {textError && (
          <p className="mt-1 text-[10px] font-medium text-red-600 font-manrope">
            Format invalide — utilise #RRGGBB (ex : #0f1a3a)
          </p>
        )}
      </div>
    </div>
  )
}
