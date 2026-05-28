'use client'

/**
 * Combobox — Autocomplete réutilisable
 * ------------------------------------------------------------------
 * Composant générique d'autocomplete avec :
 *   - filtrage live insensible casse + accents sur `searchText`
 *   - empty state custom
 *   - création inline (option "+ Créer 'typed'" en dernière ligne)
 *   - navigation clavier (↑/↓/Enter/Esc)
 *   - sélection avec affichage label + croix pour désélectionner
 *   - dropdown plein écran sur mobile (90vw)
 *
 * Pattern réutilisable pour : sélection devis, client, chantier, intervenant.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, X as XIcon, Plus, Search } from 'lucide-react'

export type ComboboxItem = {
  id: string
  label: string
  sublabel?: string
  searchText: string
  meta?: React.ReactNode
}

export type ComboboxProps = {
  items: ComboboxItem[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  emptyState?: React.ReactNode
  onCreate?: (typedText: string) => void
  createLabel?: (typed: string) => string
  className?: string
  disabled?: boolean
  label?: string
  /** Optionnel : icône à afficher dans l'input (à gauche). */
  icon?: React.ReactNode
  /** Optionnel : id html pour le label (a11y). */
  id?: string
  /** Optionnel : marquer le champ comme requis (affichage *). */
  required?: boolean
}

// Normalise une chaîne pour comparaison : minuscule + suppression accents.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export default function Combobox({
  items,
  value,
  onChange,
  placeholder,
  emptyState,
  onCreate,
  createLabel,
  className = '',
  disabled = false,
  label,
  icon,
  id,
  required = false,
}: ComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedItem = useMemo(
    () => items.find(it => it.id === value) ?? null,
    [items, value]
  )

  // Filtrage live
  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return items.slice(0, 50)
    return items.filter(it => normalize(it.searchText).includes(q))
  }, [items, query])

  // Match exact (pour décider si on propose la création)
  const hasExactMatch = useMemo(() => {
    const q = normalize(query)
    if (!q) return true
    return items.some(it => normalize(it.label) === q || normalize(it.searchText) === q)
  }, [items, query])

  const showCreateOption = Boolean(onCreate) && query.trim().length > 0 && !hasExactMatch

  // Liste affichée : max 8 visibles, le reste scrollable
  const displayedItems = filtered

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Reset highlight quand la liste change
  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  // Navigation clavier
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const totalRows = displayedItems.length + (showCreateOption ? 1 : 0)
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!open) setOpen(true)
        setHighlight(h => (totalRows === 0 ? 0 : (h + 1) % totalRows))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (!open) setOpen(true)
        setHighlight(h => (totalRows === 0 ? 0 : (h - 1 + totalRows) % totalRows))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        // Index dans displayedItems
        if (highlight < displayedItems.length) {
          const it = displayedItems[highlight]
          if (it) {
            onChange(it.id)
            setQuery('')
            setOpen(false)
          }
        } else if (showCreateOption && onCreate) {
          onCreate(query.trim())
          setQuery('')
          setOpen(false)
        }
      }
    },
    [displayedItems, highlight, open, onChange, onCreate, query, showCreateOption]
  )

  const handleSelect = (item: ComboboxItem) => {
    onChange(item.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  const handleCreate = () => {
    if (!onCreate || !query.trim()) return
    onCreate(query.trim())
    setQuery('')
    setOpen(false)
  }

  // Si une valeur est sélectionnée, on affiche son label dans un "chip" cliquable au lieu de l'input texte
  if (selectedItem) {
    return (
      <div ref={wrapperRef} className={`relative ${className}`}>
        {label && (
          <label htmlFor={id} className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
            {label}{required && <span className="text-[#e87a2a] ml-0.5">*</span>}
          </label>
        )}
        <div className="w-full px-3.5 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white flex items-center justify-between gap-2 group">
          <div className="flex-1 min-w-0">
            <div className="text-[#0f1a3a] font-semibold truncate">{selectedItem.label}</div>
            {selectedItem.sublabel && (
              <div className="text-[11px] text-[#64748b] truncate">{selectedItem.sublabel}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Désélectionner"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[#f6f8fb] text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-all"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
          {label}{required && <span className="text-[#e87a2a] ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full ${icon ? 'pl-9' : 'pl-3.5'} pr-9 py-2.5 border border-[#e6ecf2] rounded-xl text-sm bg-white focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3] disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <button
          type="button"
          onClick={() => { setOpen(o => !o); inputRef.current?.focus() }}
          aria-label={open ? 'Fermer' : 'Ouvrir'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#64748b] hover:text-[#0f1a3a]"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#e6ecf2] rounded-xl shadow-lg z-50 max-h-[320px] overflow-y-auto"
          style={{ maxWidth: 'min(90vw, 100%)' }}
        >
          {displayedItems.length === 0 && !showCreateOption && (
            <div className="px-3.5 py-4 text-sm text-[#64748b]">
              {emptyState ?? <div className="flex items-center gap-2"><Search className="w-3.5 h-3.5" /> Aucun résultat</div>}
            </div>
          )}
          {displayedItems.length > 0 && (
            <ul role="listbox" className="py-1">
              {displayedItems.map((it, idx) => {
                const isHighlighted = idx === highlight
                return (
                  <li
                    key={it.id}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlight(idx)}
                    onMouseDown={e => { e.preventDefault(); handleSelect(it) }}
                    className={`px-3.5 py-2 cursor-pointer flex items-start justify-between gap-3 transition-colors ${isHighlighted ? 'bg-[#5ab4e0]/[.08]' : 'hover:bg-[#f6f8fb]'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#0f1a3a] truncate">{it.label}</div>
                      {it.sublabel && (
                        <div className="text-[11px] text-[#64748b] truncate mt-0.5">{it.sublabel}</div>
                      )}
                    </div>
                    {it.meta && (
                      <div className="shrink-0 text-[11px] text-[#64748b]">{it.meta}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {showCreateOption && onCreate && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleCreate() }}
              onMouseEnter={() => setHighlight(displayedItems.length)}
              className={`w-full text-left px-3.5 py-2.5 border-t border-[#e6ecf2] text-sm font-semibold text-[#1a6fb5] hover:bg-[#5ab4e0]/[.08] transition-colors flex items-center gap-2 ${highlight === displayedItems.length ? 'bg-[#5ab4e0]/[.08]' : ''}`}
            >
              <Plus className="w-3.5 h-3.5" />
              {createLabel ? createLabel(query.trim()) : `Créer "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
