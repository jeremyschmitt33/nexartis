'use client'

// ---------------------------------------------------------------------------
// Briques UI partagees des calculatrices (V2).
// Palette Nexartis (navy / orange / cream), police hanken + spline-mono.
// V2 : contour de carte plus epais, champs plus hauts, resultat "heros"
// (degrade navy + gros chiffre orange + bouton copier), couleurs chaudes.
// ---------------------------------------------------------------------------

import React, { useState, useRef, useEffect } from 'react'
import { Copy, Check, Info } from 'lucide-react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Formate un nombre en francais (espace milliers, n decimales). */
export function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Champ numerique. Etat texte interne -> on peut vider le champ (pas de "0
 * fantome" colle devant la saisie) et taper la virgule. La valeur 0 s'affiche
 * comme un champ vide ; le calcul recoit toujours un nombre.
 */
export function NumberInput({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  step?: number
  min?: number
  hint?: string
}) {
  void step
  void min
  const [text, setText] = useState<string>(() => (value === 0 ? '' : String(value)))

  // Resynchronise si la valeur change a l'exterieur (ex. bascule de mode).
  useEffect(() => {
    const parsed = text.trim() === '' ? 0 : Number(text.replace(',', '.'))
    if (parsed !== value) setText(value === 0 ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handle(raw: string) {
    setText(raw)
    const n = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'))
    if (Number.isFinite(n)) onChange(n)
  }

  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">{label}</span>
      <div className="flex items-stretch rounded-xl border-2 border-navy/15 bg-white focus-within:border-orange focus-within:ring-4 focus-within:ring-orange/15 transition overflow-hidden">
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          value={text}
          placeholder="0"
          onChange={(e) => handle(e.target.value)}
          className="w-full h-12 px-3.5 text-navy text-lg bg-transparent outline-none font-spline-mono"
        />
        {unit ? (
          <span className="flex items-center px-3.5 text-sm font-semibold text-navy/60 bg-cream border-l-2 border-navy/10 whitespace-nowrap">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? <span className="block text-xs text-navy/55 mt-1">{hint}</span> : null}
    </label>
  )
}

/** Selecteur etiquete. */
export function ChoiceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3.5 rounded-xl border-2 border-navy/15 bg-white text-navy outline-none focus:border-orange focus:ring-4 focus:ring-orange/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Ligne de resultat secondaire. */
export function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-navy/10 last:border-0">
      <span className="text-[13px] text-navy/70">{label}</span>
      <span className="font-spline-mono font-semibold text-navy text-[15px] text-right">{value}</span>
    </div>
  )
}

/** Resultat principal "heros" : degrade navy, gros chiffre orange, bouton copier. */
export function Highlight({
  label,
  value,
  unit,
}: {
  label: string
  value: React.ReactNode
  unit?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [copied, setCopied] = useState(false)

  function copy() {
    const t = (ref.current?.textContent || '').trim()
    try {
      navigator.clipboard?.writeText(t)
    } catch {
      /* clipboard indisponible */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="relative rounded-2xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-navy to-navy-mid">
      <button
        onClick={copy}
        aria-label="Copier le resultat"
        className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copie' : 'Copier'}
      </button>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1 pr-20">
        {label}
      </div>
      <span ref={ref} className="flex items-baseline gap-1 flex-wrap">
        <span className="font-spline-mono font-bold text-4xl leading-none text-orange">{value}</span>
        {unit ? <span className="font-spline-mono text-lg font-semibold text-white/90">{unit}</span> : null}
      </span>
    </div>
  )
}

/** Bloc des resultats secondaires (fond cream). */
export function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-cream/60 px-3.5 py-1.5">{children}</div>
}

/** Avertissement (estimation indicative). */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-xs text-navy/60 bg-gold/12 border border-gold/30 rounded-xl px-3 py-2 mt-1">
      <Info size={14} className="text-navy/45 shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  )
}

/** Carte conteneur d'une calculatrice (contour epais + filet orange). */
export function CalcCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white border-2 border-navy/15 shadow-sm overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3.5 bg-cream/60 border-b-2 border-navy/10 border-l-4 border-l-orange">
        {Icon ? (
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-orange/15 text-orange shrink-0">
            <Icon size={22} />
          </span>
        ) : null}
        <h2 className="font-hanken font-bold text-navy text-[17px] leading-tight">{title}</h2>
      </header>
      <div className="p-4 space-y-3.5">{children}</div>
    </section>
  )
}
