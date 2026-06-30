'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Eye, ChevronUp, ChevronDown, CalendarDays,
  Users, Briefcase, Clock, Search
} from 'lucide-react'
import {
  usePlanning, useIntervenants, useClients, useChantiers, useDevis,
  useUser, LoadingSkeleton
} from '@/lib/hooks'

// ── Types ──────────────────────────────────────────────────────────────

type R = Record<string, unknown>
type SortKey = 'date_debut' | 'date_fin' | 'duree' | 'intervenant' | 'client'
type SortDir = 'asc' | 'desc'

interface EnrichedRow {
  [key: string]: unknown
  _dateDebut: string
  _dateFin: string
  _duree: number
  _intervenantNom: string
  _intervenantMetier: string
  _clientNom: string
  _chantierNom: string
  _devisNum: string
}

// ── Helpers ─────────────────────────────────────────────────────────────

function parseLocalDate(str: string): Date {
  // Parse YYYY-MM-DD as local time to avoid timezone shift
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function computeDuree(dateDebut: string, dateFin: string): number {
  const d1 = parseLocalDate(dateDebut)
  const d2 = parseLocalDate(dateFin || dateDebut)
  const diffMs = d2.getTime() - d1.getTime()
  const durationDays = Math.round(diffMs / 86400000) + 1
  return durationDays > 0 ? durationDays : 1
}

function fmtDateFR(str: string): string {
  if (!str) return '-'
  const d = parseLocalDate(str)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getWeekBounds(): { from: string; to: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: fmtISO(mon), to: fmtISO(sun) }
}

function getMonthBounds(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: fmtISO(first), to: fmtISO(last) }
}

function getYearBounds(): { from: string; to: string } {
  const now = new Date()
  return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
}

function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STATUTS = [
  { value: 'planifie', label: 'Planifie', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'en_cours', label: 'En cours', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'termine', label: 'Termine', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'annule', label: 'Annule', color: 'bg-red-100 text-red-700 border-red-200' },
]

function statutInfo(val: string) {
  return STATUTS.find(s => s.value === val) ?? { label: val ?? '-', color: 'bg-gray-100 text-gray-600 border-gray-200' }
}

// ── Mini stat card ────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-[#e6ecf2] rounded-xl px-4 py-3 flex items-center gap-3 min-w-[120px]">
      <div className={`${color} shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-[#7b8ba3] font-medium leading-none mb-0.5">{label}</p>
        <p className="text-lg font-extrabold text-[#0f1a3a] font-jakarta leading-none">{value}</p>
      </div>
    </div>
  )
}

// ── Sort header button ────────────────────────────────────────────────

function SortTh({ label, col, current, dir, onClick }: { label: string; col: SortKey; current: SortKey; dir: SortDir; onClick: (c: SortKey) => void }) {
  const active = current === col
  return (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] cursor-pointer hover:text-[#5ab4e0] transition-colors select-none whitespace-nowrap"
      onClick={() => onClick(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#5ab4e0]" /> : <ChevronDown className="w-3 h-3 text-[#5ab4e0]" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

function HistoriquePageInner() {
  const router = useRouter()
  const { user, loading: loadingUser } = useUser()

  const { data: planningData, loading: lp } = usePlanning()
  const { data: intervenants, loading: li } = useIntervenants()
  const { data: clients, loading: lc } = useClients()
  const { data: chantiers } = useChantiers()
  const { data: devisData } = useDevis()

  // ── Filters ──
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterIntervenant, setFilterIntervenant] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // ── Sort ──
  const [sortKey, setSortKey] = useState<SortKey>('date_debut')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  // ── Maps (avant tout return : regles des Hooks React) ──
  const clientMap = new Map<string, R>()
  clients.forEach(c => { const r = c as R; clientMap.set(r.id as string, r) })

  const intervenantMap = new Map<string, R>()
  intervenants.forEach(iv => { const r = iv as R; intervenantMap.set(r.id as string, r) })

  const chantierMap = new Map<string, R>()
  chantiers.forEach(ch => { const r = ch as R; chantierMap.set(r.id as string, r) })

  const devisMap = new Map<string, R>()
  devisData.forEach(d => { const r = d as R; devisMap.set(r.id as string, r) })

  // ── Quick period helpers ──
  function applyPeriod(period: 'week' | 'month' | 'year' | 'all') {
    if (period === 'all') { setFilterFrom(''); setFilterTo(''); return }
    if (period === 'week') { const b = getWeekBounds(); setFilterFrom(b.from); setFilterTo(b.to); return }
    if (period === 'month') { const b = getMonthBounds(); setFilterFrom(b.from); setFilterTo(b.to); return }
    if (period === 'year') { const b = getYearBounds(); setFilterFrom(b.from); setFilterTo(b.to); return }
  }

  // ── Enrich + filter ──
  const enrichedAndFiltered = useMemo((): EnrichedRow[] => {
    const rows = (planningData as R[]).map((item): EnrichedRow => {
      const dateDebut = (item.date_debut as string) || ''
      const dateFin = (item.date_fin as string) || dateDebut
      const duree = dateDebut ? computeDuree(dateDebut, dateFin) : 1

      const iv = item.intervenant_id ? intervenantMap.get(item.intervenant_id as string) : null
      const intervenantNom = iv
        ? `${(iv.prenom as string) || ''} ${(iv.nom as string) || ''}`.trim()
        : (item.notes_intervenant as string) || ''
      const intervenantMetier = iv ? (iv.metier as string) || '' : ''

      const cl = item.client_id ? clientMap.get(item.client_id as string) : null
      const clientNom = cl
        ? `${(cl.prenom as string) || ''} ${(cl.nom as string) || ''}`.trim() || (cl.societe as string) || ''
        : (item.notes_client as string) || ''

      const ch = item.chantier_id ? chantierMap.get(item.chantier_id as string) : null
      const chantierNom = ch ? ((ch.titre as string) || (ch.adresse as string) || '') : ''

      const dv = item.devis_id ? devisMap.get(item.devis_id as string) : null
      const devisNum = dv ? (dv.numero as string) || '' : ''

      return {
        ...item,
        _dateDebut: dateDebut,
        _dateFin: dateFin,
        _duree: duree,
        _intervenantNom: intervenantNom,
        _intervenantMetier: intervenantMetier,
        _clientNom: clientNom,
        _chantierNom: chantierNom,
        _devisNum: devisNum,
      }
    })

    return rows.filter(item => {
      // Periode
      if (filterFrom && item._dateDebut && item._dateDebut < filterFrom) return false
      if (filterTo && item._dateDebut && item._dateDebut > filterTo) return false
      // Intervenant
      if (filterIntervenant && (item.intervenant_id as string) !== filterIntervenant) return false
      // Client
      if (filterClient && (item.client_id as string) !== filterClient) return false
      // Statut
      if (filterStatut && (item.statut as string) !== filterStatut) return false
      // Recherche texte
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const haystack = [
          item.titre as string,
          item.description_travaux as string,
          item._intervenantNom,
          item._clientNom,
          item._chantierNom,
          item._devisNum,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [
    planningData, filterFrom, filterTo, filterIntervenant,
    filterClient, filterStatut, filterSearch,
    intervenantMap, clientMap, chantierMap, devisMap
  ])

  // ── Sort ──
  const sorted = useMemo(() => {
    const copy = [...enrichedAndFiltered]
    copy.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'date_debut') { va = a._dateDebut; vb = b._dateDebut }
      else if (sortKey === 'date_fin') { va = a._dateFin; vb = b._dateFin }
      else if (sortKey === 'duree') { va = a._duree; vb = b._duree }
      else if (sortKey === 'intervenant') { va = a._intervenantNom; vb = b._intervenantNom }
      else if (sortKey === 'client') { va = a._clientNom; vb = b._clientNom }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [enrichedAndFiltered, sortKey, sortDir])

  // ── Redirect / chargement (place APRES les hooks : regles des Hooks) ──
  if (!loadingUser && !user) {
    router.push('/login')
    return null
  }
  const loading = lp || li || lc || loadingUser
  if (loading) return <div className="p-8"><LoadingSkeleton rows={8} /></div>

  // ── Stats ──
  const totalDuree = sorted.reduce((acc, item) => acc + item._duree, 0)
  const distinctClients = new Set(sorted.map(item => item.client_id as string).filter(Boolean)).size
  const distinctChantiers = new Set(sorted.map(item => item.chantier_id as string).filter(Boolean)).size

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      {/* Header */}
      <header className="bg-white border-b border-[#e6ecf2] px-3 sm:px-6 py-3 sm:py-3.5 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard/planning')}
              className="flex items-center gap-1.5 text-[#7b8ba3] hover:text-[#0f1a3a] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Planning</span>
            </button>
            <span className="text-[#e6ecf2] hidden sm:inline">/</span>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#0f1a3a] tracking-tight font-jakarta shrink-0">
              Historique des interventions
            </h1>
          </div>
          <span className="text-xs text-[#7b8ba3] font-medium bg-[#f6f8fb] px-3 py-1.5 rounded-full border border-[#e6ecf2]">
            {sorted.length} intervention{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="px-3 sm:px-6 py-4 space-y-4">

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <StatCard icon={<CalendarDays className="w-4 h-4" />} label="Interventions" value={sorted.length} color="text-[#5ab4e0]" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Jours total" value={totalDuree} color="text-[#e87a2a]" />
          <StatCard icon={<Users className="w-4 h-4" />} label="Clients" value={distinctClients} color="text-[#7c3aed]" />
          <StatCard icon={<Briefcase className="w-4 h-4" />} label="Chantiers" value={distinctChantiers} color="text-[#22c55e]" />
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e6ecf2] rounded-2xl p-4 space-y-3">
          {/* Periode */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Du</label>
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="border border-[#e6ecf2] rounded-xl px-3 py-2 text-sm text-[#1e293b] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none bg-[#f6f8fb]"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Au</label>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="border border-[#e6ecf2] rounded-xl px-3 py-2 text-sm text-[#1e293b] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none bg-[#f6f8fb]"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: 'Cette semaine', period: 'week' as const },
                { label: 'Ce mois', period: 'month' as const },
                { label: 'Cette annee', period: 'year' as const },
                { label: 'Tout', period: 'all' as const },
              ].map(b => (
                <button
                  key={b.period}
                  onClick={() => applyPeriod(b.period)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#e6ecf2] text-[#64748b] bg-[#f6f8fb] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Second row: dropdowns + search */}
          <div className="flex flex-wrap gap-3">
            {/* Intervenant */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Intervenant</label>
              <select
                value={filterIntervenant}
                onChange={e => setFilterIntervenant(e.target.value)}
                className="border border-[#e6ecf2] rounded-xl px-3 py-2 text-sm text-[#1e293b] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none bg-[#f6f8fb]"
              >
                <option value="">Tous</option>
                {(intervenants as R[]).map(iv => (
                  <option key={iv.id as string} value={iv.id as string}>
                    {`${(iv.prenom as string) || ''} ${(iv.nom as string) || ''}`.trim() || (iv.id as string)}
                  </option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Client</label>
              <select
                value={filterClient}
                onChange={e => setFilterClient(e.target.value)}
                className="border border-[#e6ecf2] rounded-xl px-3 py-2 text-sm text-[#1e293b] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none bg-[#f6f8fb]"
              >
                <option value="">Tous</option>
                {(clients as R[]).map(cl => (
                  <option key={cl.id as string} value={cl.id as string}>
                    {`${(cl.prenom as string) || ''} ${(cl.nom as string) || ''}`.trim() || (cl.societe as string) || (cl.id as string)}
                  </option>
                ))}
              </select>
            </div>

            {/* Statut */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Statut</label>
              <select
                value={filterStatut}
                onChange={e => setFilterStatut(e.target.value)}
                className="border border-[#e6ecf2] rounded-xl px-3 py-2 text-sm text-[#1e293b] focus:border-[#5ab4e0] focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none bg-[#f6f8fb]"
              >
                <option value="">Tous</option>
                {STATUTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Recherche texte */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-[#7b8ba3]">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7b8ba3] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Titre, client, chantier, devis..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#e6ecf2] rounded-xl text-sm text-[#1e293b] bg-[#f6f8fb] focus:border-[#5ab4e0] focus:bg-white focus:ring-2 focus:ring-[#5ab4e0]/10 outline-none transition-all placeholder:text-[#7b8ba3]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tableau desktop */}
        <div className="hidden sm:block bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden">
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarDays className="w-10 h-10 text-[#d0dae4] mx-auto mb-3" />
              <p className="text-[#7b8ba3] font-medium">Aucune intervention trouvee avec ces filtres</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f8fb] border-b border-[#e6ecf2]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">#</th>
                    <SortTh label="Date debut" col="date_debut" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="Date fin" col="date_fin" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="Duree" col="duree" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="Intervenant" col="intervenant" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="Client" col="client" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">Chantier</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">Devis</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">Travaux</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">Statut</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#7b8ba3] whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ecf2]">
                  {sorted.map((item, idx) => {
                    const st = statutInfo(item.statut as string)
                    const titre = (item.titre as string) || (item.description_travaux as string) || '-'
                    return (
                      <tr key={item.id as string} className="hover:bg-[#f6f8fb] transition-colors">
                        <td className="px-3 py-2.5 text-xs text-[#7b8ba3] font-mono">{String(idx + 1).padStart(3, '0')}</td>
                        <td className="px-3 py-2.5 font-medium text-[#1e293b] whitespace-nowrap">{fmtDateFR(item._dateDebut)}</td>
                        <td className="px-3 py-2.5 text-[#64748b] whitespace-nowrap">{item._dateFin !== item._dateDebut ? fmtDateFR(item._dateFin) : '-'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-semibold text-[#0f1a3a]">{item._duree}</span>
                          <span className="text-[#7b8ba3] text-xs ml-1">j</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {item._intervenantNom ? (
                            <div>
                              <div className="font-medium text-[#1e293b] whitespace-nowrap">{item._intervenantNom}</div>
                              {item._intervenantMetier && <div className="text-xs text-[#7b8ba3]">{item._intervenantMetier}</div>}
                            </div>
                          ) : <span className="text-[#d0dae4]">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#1e293b] whitespace-nowrap max-w-[140px] truncate">
                          {item._clientNom || <span className="text-[#d0dae4]">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#64748b] max-w-[130px] truncate whitespace-nowrap">
                          {item._chantierNom || <span className="text-[#d0dae4]">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#5ab4e0] font-medium text-xs whitespace-nowrap">
                          {item._devisNum || <span className="text-[#d0dae4]">-</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <div className="font-medium text-[#1e293b] text-xs truncate">{titre}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <a
                            href={`/dashboard/planning?intervention_id=${item.id as string}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f6f8fb] border border-[#e6ecf2] text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all text-xs font-medium"
                            title="Voir dans le planning"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Voir</span>
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cards mobile */}
        <div className="sm:hidden space-y-3">
          {sorted.length === 0 ? (
            <div className="bg-white border border-[#e6ecf2] rounded-2xl py-12 text-center">
              <CalendarDays className="w-10 h-10 text-[#d0dae4] mx-auto mb-3" />
              <p className="text-[#7b8ba3] font-medium text-sm">Aucune intervention trouvee</p>
            </div>
          ) : sorted.map((item, idx) => {
            const st = statutInfo(item.statut as string)
            const titre = (item.titre as string) || (item.description_travaux as string) || 'Sans titre'
            return (
              <div key={item.id as string} className="bg-white border border-[#e6ecf2] rounded-2xl p-4 space-y-3">
                {/* Header card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#7b8ba3] font-mono mb-0.5">#{String(idx + 1).padStart(3, '0')}</p>
                    <p className="font-bold text-[#0f1a3a] text-sm leading-tight">{titre}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-xs text-[#7b8ba3]">Debut : </span>
                    <span className="font-semibold text-[#1e293b]">{fmtDateFR(item._dateDebut)}</span>
                  </div>
                  {item._dateFin !== item._dateDebut && (
                    <div>
                      <span className="text-xs text-[#7b8ba3]">Fin : </span>
                      <span className="font-medium text-[#64748b]">{fmtDateFR(item._dateFin)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-[#7b8ba3]">Duree : </span>
                    <span className="font-bold text-[#0f1a3a]">{item._duree}j</span>
                  </div>
                </div>

                {/* Intervenant / Client / Chantier */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {item._intervenantNom && (
                    <div>
                      <span className="text-[#7b8ba3]">Intervenant</span>
                      <p className="font-medium text-[#1e293b] mt-0.5">{item._intervenantNom}</p>
                      {item._intervenantMetier && <p className="text-[#7b8ba3]">{item._intervenantMetier}</p>}
                    </div>
                  )}
                  {item._clientNom && (
                    <div>
                      <span className="text-[#7b8ba3]">Client</span>
                      <p className="font-medium text-[#1e293b] mt-0.5">{item._clientNom}</p>
                    </div>
                  )}
                  {item._chantierNom && (
                    <div>
                      <span className="text-[#7b8ba3]">Chantier</span>
                      <p className="font-medium text-[#1e293b] mt-0.5">{item._chantierNom}</p>
                    </div>
                  )}
                  {item._devisNum && (
                    <div>
                      <span className="text-[#7b8ba3]">Devis</span>
                      <p className="font-medium text-[#5ab4e0] mt-0.5">{item._devisNum}</p>
                    </div>
                  )}
                </div>

                {/* Action */}
                <a
                  href={`/dashboard/planning?intervention_id=${item.id as string}`}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#f6f8fb] border border-[#e6ecf2] text-[#64748b] hover:border-[#5ab4e0] hover:text-[#5ab4e0] transition-all text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Voir dans le planning
                </a>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ── Wrapper with Suspense (needed for useSearchParams / useRouter in Next 14) ──

export default function HistoriquePage() {
  return (
    <Suspense fallback={<div className="p-8"><LoadingSkeleton rows={8} /></div>}>
      <HistoriquePageInner />
    </Suspense>
  )
}
