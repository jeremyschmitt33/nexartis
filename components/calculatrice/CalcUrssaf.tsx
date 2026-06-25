'use client'

// ---------------------------------------------------------------------------
// Calculatrice "Aide a la declaration URSSAF" (integree a la page Calculatrices).
// Reprend la logique de l'ancienne page /dashboard/urssaf : CA ENCAISSE sur la
// periode (lecture seule des factures payees/partiellement payees), pret a
// copier, + estimation de cotisations optionnelle.
// Police des chiffres = font-hanken (coherence site), virgule normale.
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react'
import { Copy, Check, Info, ExternalLink } from 'lucide-react'
import { useFactures, useEntreprise } from '@/lib/hooks'
import { Disclaimer } from './ui'

type FactureRow = Record<string, unknown>
type PeriodId = 'mois_dernier' | 'mois_courant' | 'trimestre_courant' | 'annee_courante' | 'mois_precis'

const MONTH_NAMES = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getPeriodRange(period: PeriodId, customMonth: number, customYear: number): { start: Date; end: Date; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'mois_courant': {
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1), label: `${MONTH_NAMES[m]} ${y}` }
    }
    case 'trimestre_courant': {
      const qStart = Math.floor(m / 3) * 3
      return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 1), label: `${qStart / 3 + 1}e trimestre ${y}` }
    }
    case 'annee_courante': {
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: `annee ${y}` }
    }
    case 'mois_precis': {
      return { start: new Date(customYear, customMonth, 1), end: new Date(customYear, customMonth + 1, 1), label: `${MONTH_NAMES[customMonth]} ${customYear}` }
    }
    case 'mois_dernier':
    default: {
      const start = new Date(y, m - 1, 1)
      return { start, end: new Date(y, m, 1), label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}` }
    }
  }
}

const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: 'mois_dernier', label: 'Mois dernier' },
  { id: 'mois_courant', label: 'Mois en cours' },
  { id: 'trimestre_courant', label: 'Trimestre' },
  { id: 'annee_courante', label: 'Annee' },
  { id: 'mois_precis', label: 'Mois precis' },
]

export function CalcUrssaf() {
  const { data: factures } = useFactures()
  const { entreprise } = useEntreprise()

  const now = new Date()
  const [period, setPeriod] = useState<PeriodId>('mois_dernier')
  const [customMonth, setCustomMonth] = useState(now.getMonth())
  const [customYear, setCustomYear] = useState(now.getFullYear())
  const [taux, setTaux] = useState('')
  const [copied, setCopied] = useState(false)

  const isFranchise = (entreprise as { franchise_tva?: boolean } | null)?.franchise_tva === true

  const { start, end, label } = useMemo(
    () => getPeriodRange(period, customMonth, customYear),
    [period, customMonth, customYear],
  )

  const result = useMemo(() => {
    const facs = (factures ?? []) as FactureRow[]
    let total = 0
    let count = 0
    for (const f of facs) {
      if (f.deleted_at) continue
      const statut = (f.statut as string) ?? ''
      if (statut !== 'payee' && statut !== 'partiellement_payee') continue
      const dpRaw = f.date_paiement as string | null | undefined
      if (!dpRaw) continue
      const dp = new Date(dpRaw)
      if (Number.isNaN(dp.getTime())) continue
      if (dp < start || dp >= end) continue
      const montant = statut === 'partiellement_payee'
        ? ((f.montant_paye as number) ?? 0)
        : ((f.montant_ttc as number) ?? 0)
      if (montant > 0) { total += montant; count += 1 }
    }
    return { total, count }
  }, [factures, start, end])

  const tauxNum = parseFloat(taux.replace(',', '.'))
  const tauxValide = !Number.isNaN(tauxNum) && tauxNum > 0
  const cotisations = tauxValide ? (result.total * tauxNum) / 100 : null

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.total.toFixed(2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indispo */ }
  }

  return (
    <div className="space-y-3.5">
      {/* Selecteur de periode */}
      <div>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-navy/55 mb-2">
          Periode a declarer
        </span>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opt) => {
            const on = period === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                aria-pressed={on}
                className={`px-3 py-2 rounded-lg font-hanken font-semibold text-[13px] border-2 transition ${
                  on ? 'bg-navy text-white border-navy' : 'bg-cream/70 text-navy/70 border-transparent hover:border-navy/20'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {period === 'mois_precis' && (
          <div className="flex flex-wrap gap-3 mt-3">
            <label className="flex-1 min-w-[130px]">
              <span className="block text-xs font-medium text-navy/60 mb-1">Mois</span>
              <select
                value={customMonth}
                onChange={(e) => setCustomMonth(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border-2 border-navy/15 bg-white text-navy text-sm outline-none focus:border-orange"
              >
                {MONTH_NAMES.map((mName, i) => (
                  <option key={i} value={i}>{mName.charAt(0).toUpperCase() + mName.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-[110px]">
              <span className="block text-xs font-medium text-navy/60 mb-1">Annee</span>
              <select
                value={customYear}
                onChange={(e) => setCustomYear(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border-2 border-navy/15 bg-white text-navy text-sm outline-none focus:border-orange"
              >
                {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Montant a declarer (resultat hero) */}
      <div className="relative rounded-2xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-navy to-navy-mid">
        <button
          onClick={handleCopy}
          disabled={result.total <= 0}
          aria-label="Copier le montant"
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition disabled:opacity-40"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copie' : 'Copier'}
        </button>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1 pr-20">
          Montant a declarer &mdash; {label}
        </div>
        <span className="flex items-baseline gap-1 flex-wrap">
          <span className="font-hanken font-extrabold text-4xl leading-none text-orange tabular-nums tracking-[-0.01em]">{fmtEur(result.total)}</span>
          <span className="font-hanken text-lg font-semibold text-white/90">&euro;</span>
        </span>
        <p className="text-[13px] text-white/75 mt-1">
          {result.count === 0
            ? 'Aucun encaissement sur cette periode.'
            : `${result.count} facture${result.count > 1 ? 's' : ''} encaissee${result.count > 1 ? 's' : ''}.`}
        </p>
      </div>

      {/* Estimation cotisations (facultatif) */}
      <div>
        <span className="block text-[13px] font-semibold text-navy/70 mb-1.5">
          Estimer mes cotisations (facultatif)
        </span>
        <div className="flex items-stretch rounded-xl border-2 border-navy/15 bg-white focus-within:border-orange focus-within:ring-4 focus-within:ring-orange/15 transition overflow-hidden max-w-[220px]">
          <input
            type="text"
            inputMode="decimal"
            value={taux}
            placeholder="ex : 21,2"
            aria-label="Taux de cotisation en pourcentage"
            onChange={(e) => setTaux(e.target.value)}
            className="w-full h-12 px-3.5 text-navy text-lg bg-transparent outline-none font-hanken tabular-nums"
          />
          <span className="flex items-center px-3.5 text-sm font-semibold text-navy/60 bg-cream border-l-2 border-navy/10">%</span>
        </div>
        {cotisations !== null && (
          <p className="mt-2.5 text-sm text-navy">
            Estimation des cotisations :{' '}
            <strong className="font-hanken font-bold text-navy tabular-nums">{fmtEur(cotisations)} &euro;</strong>
          </p>
        )}
      </div>

      {isFranchise && (
        <p className="text-xs text-navy/55">
          Franchise de TVA : le montant TTC est egal au montant HT (pas de TVA a deduire).
        </p>
      )}

      <Disclaimer>
        Estimation indicative. Le taux depend de votre activite et peut evoluer. Verifiez votre taux exact et
        declarez sur{' '}
        <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange underline inline-flex items-center gap-0.5">
          autoentrepreneur.urssaf.fr <ExternalLink size={12} />
        </a>
        . Ce calcul ne constitue pas un conseil fiscal.
      </Disclaimer>
    </div>
  )
}
