'use client'

/**
 * RappelsSection — Widget "Mes rappels" du dashboard.
 *
 * Affiche les rappels libres (post-it) de l'artisan, type "Rappeler comptable
 * demain", "Aller chercher placo vendredi", "Renouveler décennale".
 *
 * Comportement défensif : si la table `rappels` n'a pas encore été créée
 * (migration SQL pas exécutée), le composant renvoie `null` au lieu de
 * planter. Le dashboard reste fonctionnel.
 *
 * Conforme V4 Light Premium : carte arrondie 20px, fond blanc, Hanken Grotesk,
 * accent orange #ff7a1a, navy #0f1a3a. Actions touch 44px min, mobile-first.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RappelQuickAddModal from './RappelQuickAddModal'

interface Rappel {
  id: string
  titre: string
  description: string | null
  due_date: string | null
  priorite: 'basse' | 'normale' | 'haute' | 'urgente'
  statut: 'actif' | 'fait' | 'reporte'
  lien_chantier_id: string | null
  lien_devis_id: string | null
  lien_facture_id: string | null
  lien_client_id: string | null
  source: string
  created_at: string
}

type FilterKey = 'tous' | 'aujourdhui' | 'semaine' | 'retard'

const PRIO_STYLE: Record<Rappel['priorite'], { label: string; bg: string; color: string; dot: string }> = {
  basse: { label: 'Basse', bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  normale: { label: 'Normale', bg: '#eff6ff', color: '#1d4ed8', dot: '#5ab4e0' },
  haute: { label: 'Haute', bg: '#fff7ed', color: '#c2410c', dot: '#e87a2a' },
  urgente: { label: 'Urgente', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
}

function formatDate(iso: string | null): { label: string; tone: 'past' | 'today' | 'tomorrow' | 'future' | 'none' } {
  if (!iso) return { label: 'Sans date', tone: 'none' }
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dDay = new Date(d)
  dDay.setHours(0, 0, 0, 0)

  if (dDay.getTime() === today.getTime()) return { label: "Aujourd'hui", tone: 'today' }
  if (dDay.getTime() === tomorrow.getTime()) return { label: 'Demain', tone: 'tomorrow' }
  if (dDay.getTime() < today.getTime()) {
    const days = Math.round((today.getTime() - dDay.getTime()) / 86400000)
    return { label: `En retard de ${days}j`, tone: 'past' }
  }
  return {
    label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    tone: 'future',
  }
}

export default function RappelsSection() {
  const [rappels, setRappels] = useState<Rappel[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState<boolean>(false)
  const [filter, setFilter] = useState<FilterKey>('tous')
  const [showModal, setShowModal] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const loadRappels = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRappels([])
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('rappels')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('statut', 'actif')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20)

      if (err) {
        // Table non migrée → on masque tout silencieusement
        const code = (err as { code?: string }).code
        if (code === '42P01' || code === '42703' || err.message?.includes('does not exist')) {
          console.warn('[Rappels] Table non migrée, composant masqué')
          setTableError(true)
          setRappels([])
          return
        }
        throw err
      }
      setRappels((data || []) as Rappel[])
    } catch (e) {
      console.error('[Rappels] Erreur chargement:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRappels()
  }, [loadRappels])

  // === Optimistic actions ===

  async function markDone(id: string) {
    const previous = rappels
    setRappels(rs => rs.filter(r => r.id !== id))
    setBusyIds(s => new Set(s).add(id))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('rappels')
        .update({ statut: 'fait' })
        .eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error('[Rappels] markDone failed, rollback', e)
      setRappels(previous)
    } finally {
      setBusyIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function postponeOneDay(r: Rappel) {
    const base = r.due_date ? new Date(r.due_date) : new Date()
    // Si pas de date, on part d'aujourd'hui midi local pour éviter timezone weirdness
    if (!r.due_date) {
      const today = new Date()
      base.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
      base.setHours(12, 0, 0, 0)
    }
    base.setDate(base.getDate() + 1)
    const newIso = base.toISOString()

    const previous = rappels
    setRappels(rs => rs.map(x => x.id === r.id ? { ...x, due_date: newIso } : x))
    setBusyIds(s => new Set(s).add(r.id))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('rappels')
        .update({ due_date: newIso })
        .eq('id', r.id)
      if (error) throw error
    } catch (e) {
      console.error('[Rappels] postponeOneDay failed, rollback', e)
      setRappels(previous)
    } finally {
      setBusyIds(s => { const n = new Set(s); n.delete(r.id); return n })
    }
  }

  async function softDelete(id: string) {
    const previous = rappels
    setRappels(rs => rs.filter(r => r.id !== id))
    setBusyIds(s => new Set(s).add(id))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('rappels')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error('[Rappels] softDelete failed, rollback', e)
      setRappels(previous)
    } finally {
      setBusyIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  // Si table non migrée → composant invisible
  if (tableError) return null

  // === Filtrage ===
  const now = new Date()
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const finSemaine = new Date(aujourdhui)
  finSemaine.setDate(aujourdhui.getDate() + 7)

  const filtered = rappels.filter(r => {
    if (filter === 'tous') return true
    if (!r.due_date) return false
    const d = new Date(r.due_date)
    if (filter === 'aujourdhui') {
      return d >= aujourdhui && d < new Date(aujourdhui.getTime() + 86400000)
    }
    if (filter === 'semaine') return d >= aujourdhui && d <= finSemaine
    if (filter === 'retard') return d < aujourdhui
    return true
  })

  // Compteurs pour chips (sur le set complet)
  const counts = {
    tous: rappels.length,
    aujourdhui: rappels.filter(r => r.due_date && new Date(r.due_date) >= aujourdhui && new Date(r.due_date) < new Date(aujourdhui.getTime() + 86400000)).length,
    semaine: rappels.filter(r => r.due_date && new Date(r.due_date) >= aujourdhui && new Date(r.due_date) <= finSemaine).length,
    retard: rappels.filter(r => r.due_date && new Date(r.due_date) < aujourdhui).length,
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'tous', label: 'Tous' },
    { key: 'aujourdhui', label: "Aujourd'hui" },
    { key: 'semaine', label: 'Cette semaine' },
    { key: 'retard', label: 'En retard' },
  ]

  return (
    <>
      <div
        className="rounded-[20px] border border-[#0f1a3a]/[0.06] bg-white shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] hover:shadow-[0_12px_32px_rgba(15,26,58,0.08),_0_2px_6px_rgba(15,26,58,0.06)] transition-shadow duration-300"
      >
        <div className="p-4 sm:p-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5 flex-wrap">
            <div>
              <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.025em] flex items-center gap-2">
                <span aria-hidden="true">📌</span>
                Mes rappels
              </h2>
              <p className="font-hanken text-[13px] font-medium mt-0.5" style={{ color: '#7b8ba3' }}>
                Notez vos pense-bêtes — rien ne sera oublié
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              aria-label="Créer un rappel"
              className="inline-flex items-center gap-1.5 font-hanken text-[13px] font-bold px-3.5 rounded-[10px] transition-all duration-200 text-white bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] shadow-[0_4px_12px_rgba(255,122,26,0.3)] hover:-translate-y-0.5 hover:brightness-105"
              style={{ minHeight: '44px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouveau rappel
            </button>
          </div>

          {/* Filtres */}
          {rappels.length > 0 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filtrer les rappels">
              {filters.map(f => {
                const active = filter === f.key
                const n = counts[f.key]
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.key)}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] font-hanken text-[12.5px] font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0',
                      active
                        ? 'bg-[#0f1a3a] text-white shadow-[0_2px_8px_rgba(15,26,58,0.2)]'
                        : 'bg-[#f1f5f9] text-[#445068] hover:bg-[#e2e8f0]',
                    ].join(' ')}
                  >
                    {f.label}
                    <span className={[
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-extrabold',
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#445068]',
                    ].join(' ')}>{n}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Liste */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-14 rounded-[14px] bg-[#f1f5f9] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={() => setShowModal(true)} isFiltered={filter !== 'tous' && rappels.length > 0} />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map(r => {
                const prio = PRIO_STYLE[r.priorite]
                const date = formatDate(r.due_date)
                const isBusy = busyIds.has(r.id)
                const lien = r.lien_chantier_id
                  ? `/dashboard/chantiers/${r.lien_chantier_id}`
                  : r.lien_devis_id
                    ? `/dashboard/devis/${r.lien_devis_id}`
                    : r.lien_facture_id
                      ? `/dashboard/factures/${r.lien_facture_id}`
                      : null

                return (
                  <li
                    key={r.id}
                    className={[
                      'group rounded-[14px] border bg-white transition-all duration-200',
                      isBusy ? 'opacity-60' : 'hover:border-[#ff7a1a]/30 hover:shadow-[0_4px_12px_rgba(15,26,58,0.06)]',
                    ].join(' ')}
                    style={{ borderColor: '#e6ecf2' }}
                  >
                    <div className="p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center">
                      {/* Texte */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[7px] font-hanken text-[10.5px] font-bold uppercase tracking-wider"
                            style={{ background: prio.bg, color: prio.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: prio.dot }} />
                            {prio.label}
                          </span>
                          {r.due_date && (
                            <span
                              className="inline-flex items-center gap-1 font-hanken text-[11.5px] font-bold"
                              style={{
                                color:
                                  date.tone === 'past' ? '#ef4444'
                                    : date.tone === 'today' ? '#7c3aed'
                                      : date.tone === 'tomorrow' ? '#e87a2a'
                                        : '#445068',
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              {date.label}
                            </span>
                          )}
                          {r.source && r.source !== 'manuel' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] font-hanken text-[10px] font-bold bg-purple-50 text-purple-700">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="font-hanken text-[14.5px] font-bold text-[#0f1a3a] leading-snug break-words">
                          {lien ? (
                            <Link href={lien} className="hover:text-[#ff7a1a] transition-colors">
                              {r.titre}
                            </Link>
                          ) : r.titre}
                        </p>
                        {r.description && (
                          <p className="font-hanken text-[12.5px] mt-0.5 text-[#7b8ba3] leading-snug truncate">{r.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => markDone(r.id)}
                          disabled={isBusy}
                          aria-label={`Marquer "${r.titre}" comme fait`}
                          title="Fait"
                          className="w-11 h-11 flex items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#22c55e] hover:bg-[#dcfce7] hover:text-[#15803d] transition-colors disabled:opacity-50"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => postponeOneDay(r)}
                          disabled={isBusy}
                          aria-label={`Reporter "${r.titre}" d'un jour`}
                          title="Reporter d'un jour"
                          className="w-11 h-11 flex items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#e87a2a] hover:bg-[#fff7ed] transition-colors disabled:opacity-50"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => softDelete(r.id)}
                          disabled={isBusy}
                          aria-label={`Supprimer "${r.titre}"`}
                          title="Supprimer"
                          className="w-11 h-11 flex items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#94a3b8] hover:bg-[#fef2f2] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <RappelQuickAddModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={loadRappels}
      />
    </>
  )
}

/* ───────────────────────────── EmptyState ───────────────────────────── */

function EmptyState({ onCreate, isFiltered }: { onCreate: () => void; isFiltered: boolean }) {
  if (isFiltered) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-[14px]" style={{ borderColor: '#e8ecf1' }}>
        <p className="font-hanken text-[13px] font-medium" style={{ color: '#7b8ba3' }}>
          Aucun rappel dans ce filtre
        </p>
      </div>
    )
  }
  return (
    <div className="text-center py-8 border-2 border-dashed rounded-[14px]" style={{ borderColor: '#e8ecf1' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#fff7ed' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff7a1a" strokeWidth="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <p className="font-hanken text-sm font-bold mb-1" style={{ color: '#0f1a3a' }}>
        Aucun rappel actif
      </p>
      <p className="font-hanken text-[13px] font-medium mb-4" style={{ color: '#7b8ba3' }}>
        Notez vos pense-bêtes pour ne rien oublier
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 font-hanken text-[13px] font-bold px-4 py-2.5 rounded-[10px] text-[#ff7a1a] bg-[#fff7ed] hover:bg-[#ffe4cc] transition-colors"
        style={{ minHeight: '44px' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Créer un rappel
      </button>
    </div>
  )
}
