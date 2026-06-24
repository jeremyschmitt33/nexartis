'use client'

// ─────────────────────────────────────────────────────────────────────────────
// DesignationAutocomplete — champ désignation + suggestions de prestations
// ─────────────────────────────────────────────────────────────────────────────
// Composant PARTAGÉ par les 4 points de saisie (devis/facture nouveau+modifier)
// et le LineSheet mobile. Affiche les anciennes prestations de l'artisan avec le
// PRIX bien visible. La sélection ne fait QUE remonter la suggestion via onPick :
// c'est le PARENT qui décide quoi pré-remplir (désignation + unité + prix + TVA).
//
// Anti-bug clavier : aucun item surligné par défaut (highlight = -1). Entrée ne
// sélectionne QUE si l'utilisateur a navigué au clavier (sinon = retour ligne
// normal dans le textarea). Sélection souris/tactile via onMouseDown +
// preventDefault pour ne pas fermer le menu via le blur avant le clic.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { filterSuggestions, type PrestationSuggestion } from '@/lib/prestations-memo'

interface DesignationAutocompleteProps {
  value: string
  onChange: (v: string) => void
  onPick: (s: PrestationSuggestion) => void
  suggestions: PrestationSuggestion[]
  placeholder?: string
  rows?: number
  className?: string
  autoResize?: boolean
  minChars?: number
  disabled?: boolean
  autoFocus?: boolean
}

function formatPriceFR(n: number): string {
  return Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'
}

export default function DesignationAutocomplete({
  value,
  onChange,
  onPick,
  suggestions,
  placeholder,
  rows = 3,
  className,
  autoResize = true,
  minChars = 2,
  disabled = false,
  autoFocus = false,
}: DesignationAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Résultats filtrés (recalculés à chaque frappe / changement de la liste source)
  const results = useMemo(
    () => filterSuggestions(suggestions, value, 8, minChars),
    [suggestions, value, minChars],
  )

  // Auto-resize du textarea au contenu
  useEffect(() => {
    if (!autoResize) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, autoResize])

  // Si la liste de résultats change, on réinitialise le surlignage (anti-clic accidentel)
  useEffect(() => {
    setHighlight(-1)
  }, [results.length, value])

  // Garde l'item surligné visible dans la liste scrollable
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return
    const item = listRef.current.children[highlight] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const handleChange = (v: string) => {
    onChange(v)
    const next = filterSuggestions(suggestions, v, 8, minChars)
    setOpen(next.length > 0)
  }

  const pick = (s: PrestationSuggestion) => {
    onPick(s)
    setOpen(false)
    setHighlight(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || results.length === 0) {
      // Réouvre le menu si on redescend dans un champ qui a des résultats
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault()
        setOpen(true)
        setHighlight(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h <= 0 ? results.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      // Sélectionne UNIQUEMENT si un item est surligné, sinon = retour ligne normal
      if (highlight >= 0 && highlight < results.length) {
        e.preventDefault()
        pick(results[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="designation-suggestions"
        aria-label="Désignation de la prestation"
      />

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="designation-suggestions"
          role="listbox"
          aria-label="Anciennes prestations"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[320px] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
          style={{ top: 'calc(100% + 4px)' }}
        >
          {results.map((s, i) => (
            <li
              key={s.id || `${s.designation}-${s.prix_unitaire_ht}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={e => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setHighlight(i)}
              className={[
                'flex items-stretch gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0',
                i === highlight ? 'bg-[#ff7a1a]/10' : 'bg-white',
              ].join(' ')}
            >
              {/* Désignation + sous-ligne */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="block truncate text-[15px] font-semibold text-[#0f1a3a]">
                    {s.designation}
                  </span>
                  {s.usage_count >= 3 && (
                    <span className="shrink-0 text-[11px] font-bold text-[#ff7a1a]">
                      ★ {s.usage_count}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-gray-500">
                  {s.unite || 'U'} · TVA {Number(s.taux_tva || 0)}%
                </div>
              </div>

              {/* Prix bien visible, séparé à droite. Catalogue (prix 0) = "à définir". */}
              <div className="shrink-0 self-center text-right">
                {s.prix_unitaire_ht > 0 ? (
                  <>
                    <div className="text-[17px] font-extrabold leading-tight text-[#0f1a3a]">
                      {formatPriceFR(s.prix_unitaire_ht)}
                    </div>
                    <div className="text-[11px] text-gray-400">/ {s.unite || 'U'}</div>
                  </>
                ) : (
                  <div className="text-[12px] font-semibold leading-tight text-[#ff7a1a]">
                    à définir
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
