'use client'

// ---------------------------------------------------------------------------
// Briques UI partagees des calculatrices du dashboard.
// Style aligne sur la palette Nexartis (navy / orange / cream) + police hanken.
// Aucune dependance externe : pur Tailwind.
// ---------------------------------------------------------------------------

import React from 'react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Champ numerique etiquete avec unite optionnelle. */
export function NumberInput({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
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
  return (
    <label className="block">
      <span className="block text-sm font-medium text-navy/80 mb-1">{label}</span>
      <div className="flex items-stretch rounded-xl border border-navy/15 bg-white focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/20 overflow-hidden">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full px-3 py-2.5 text-navy bg-transparent outline-none font-spline-mono"
        />
        {unit ? (
          <span className="flex items-center px-3 text-sm text-navy/50 bg-navy/5 border-l border-navy/10 whitespace-nowrap">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? <span className="block text-xs text-navy/45 mt-1">{hint}</span> : null}
    </label>
  )
}

/** Selecteur etiquete (choix simple). */
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
      <span className="block text-sm font-medium text-navy/80 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-navy/15 bg-white text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
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

/** Ligne de resultat secondaire (libelle + valeur). */
export function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-navy/8 last:border-0">
      <span className="text-sm text-navy/65">{label}</span>
      <span className="font-spline-mono font-semibold text-navy text-right">{value}</span>
    </div>
  )
}

/** Resultat principal mis en avant (gros chiffre). */
export function Highlight({
  label,
  value,
  unit,
}: {
  label: string
  value: React.ReactNode
  unit?: string
}) {
  return (
    <div className="rounded-xl bg-navy text-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="font-spline-mono text-2xl font-bold leading-tight">
        {value}
        {unit ? <span className="text-base font-medium text-orange ml-1">{unit}</span> : null}
      </div>
    </div>
  )
}

/** Bloc de resultats (encadre creme). */
export function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-cream/60 border border-navy/10 p-3 space-y-2">{children}</div>
}

/** Avertissement (estimation indicative). */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-navy/55 bg-gold/10 border border-gold/30 rounded-lg px-3 py-2 mt-1">
      {children}
    </p>
  )
}

/** Carte conteneur d'une calculatrice. */
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
    <section className="rounded-2xl bg-white border border-navy/10 shadow-sm overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-navy/8 bg-cream/40">
        {Icon ? (
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange/10 text-orange shrink-0">
            <Icon size={18} />
          </span>
        ) : null}
        <h2 className="font-hanken font-semibold text-navy">{title}</h2>
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  )
}

/** Formate un nombre en francais (espace milliers, n decimales). */
export function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
