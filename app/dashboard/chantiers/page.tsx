'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  HardHat,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Calendar,
  CheckCircle,
  Archive,
} from 'lucide-react'
import { useChantiers, useClients, useFactures, useDevis, deleteRow, updateRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { PremiumButton } from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

// -------------------------------------------------------------------
// Types & Helpers — logique métier INTACTE (refonte visuelle uniquement)
// -------------------------------------------------------------------

type ChantierFilter = 'Tous' | 'En cours' | 'Terminés' | 'Archivés'

const FILTER_OPTIONS: string[] = ['Tous', 'En cours', 'Terminés', 'Archivés']

function statutToFilter(statut: string): ChantierFilter {
  switch (statut) {
    case 'en_cours': return 'En cours'
    case 'livre':
    case 'cloture': return 'Terminés'
    case 'archive': return 'Archivés'
    default: return 'En cours'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(amount: number | null): string {
  if (amount == null) return '0 €'
  return amount.toLocaleString('fr-FR') + ' €'
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// -------------------------------------------------------------------
// Page principale — Liste des chantiers V4 light premium
// -------------------------------------------------------------------

export default async function ChantiersListPage() {
  const askConfirm = useConfirm()
  const router = useRouter()
  const { data: chantiers, loading, error, refetch } = useChantiers()
  const { data: clients } = useClients()
  const { data: factures } = useFactures()
  const { data: devisData } = useDevis()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tous')
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Fermer le menu au scroll ou clic extérieur
  const closeMenu = useCallback(() => { setOpenActions(null); setMenuPos(null) }, [])
  useEffect(() => {
    if (!openActions) return
    const handleClickOutside = () => closeMenu()
    const handleScroll = () => closeMenu()
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openActions, closeMenu])

  async function openMenu(e: React.MouseEvent<HTMLButtonElement>, chantierId: string) {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (openActions === chantierId) { closeMenu(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuHeight = 200
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    const left = rect.right - 192
    setMenuPos({ top, left: Math.max(8, left) })
    setOpenActions(chantierId)
  }

  const clientMap = new Map(clients.map((c) => [c.id as string, c]))

  // Calcul dynamique : facturé TTC et encaissé par chantier (depuis les factures)
  const factureParChantier = new Map<string, { facture: number; encaisse: number }>()
  for (const f of factures) {
    const rec = f as Record<string, unknown>
    const cId = rec.chantier_id as string
    if (!cId) continue
    const montant = Number(rec.montant_ttc || 0)
    const entry = factureParChantier.get(cId) || { facture: 0, encaisse: 0 }
    entry.facture += montant
    if (rec.statut === 'payee') entry.encaisse += montant
    factureParChantier.set(cId, entry)
  }

  // Devis montant TTC par chantier (fallback si montant_devis_total est 0)
  const devisParChantier = new Map<string, number>()
  // Comptage des devis par chantier (total + ceux pas encore facturés = "en cours")
  // "en cours" = statuts qui ne sont pas 'facture' ni 'refuse' ni 'expire'
  const devisCountParChantier = new Map<string, { total: number; enCours: number }>()
  for (const d of devisData) {
    const rec = d as Record<string, unknown>
    const cId = rec.chantier_id as string
    if (!cId) continue
    devisParChantier.set(cId, (devisParChantier.get(cId) || 0) + Number(rec.montant_ttc || 0))
    const current = devisCountParChantier.get(cId) || { total: 0, enCours: 0 }
    current.total += 1
    const statut = rec.statut as string
    if (statut !== 'facture' && statut !== 'refuse' && statut !== 'expire') {
      current.enCours += 1
    }
    devisCountParChantier.set(cId, current)
  }

  const filtered = chantiers.filter((c: Record<string, unknown>) => {
    const displayFilter = statutToFilter(c.statut as string)
    if (filter !== 'Tous' && displayFilter !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      const client = clientMap.get(c.client_id as string)
      const clientName = client ? `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() : ''
      return (
        clientName.toLowerCase().includes(q) ||
        (c.titre as string || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // Couleur de la barre d'avancement (gardée — sémantique métier)
  async function getProgressColor(percent: number) {
    if (percent >= 75) return 'bg-emerald-500'
    if (percent >= 25) return 'bg-[#5ab4e0]'
    return 'bg-[#ff7a1a]'
  }

  function computeAvancement(c: Record<string, unknown>): number {
    const chId = c.id as string
    const devis = (c.montant_devis_total as number) || devisParChantier.get(chId) || 0
    const factureData = factureParChantier.get(chId)
    const facture = factureData?.facture || 0
    if (devis === 0) return 0
    return Math.min(100, Math.round((facture / devis) * 100))
  }

  function getChantierDevisTTC(c: Record<string, unknown>): number {
    return (c.montant_devis_total as number) || devisParChantier.get(c.id as string) || 0
  }

  function getChantierFactureTTC(c: Record<string, unknown>): number {
    return factureParChantier.get(c.id as string)?.facture || 0
  }

  function getChantierEncaisse(c: Record<string, unknown>): number {
    return factureParChantier.get(c.id as string)?.encaisse || 0
  }

  async function handleDelete(id: string) {
    if (!(await askConfirm({ title: 'Supprimer ce chantier ?', variant: 'danger', confirmLabel: 'Supprimer' }))) return
    setDeleting(id)
    try {
      await deleteRow('chantiers', id)
      refetch()
    } catch (err) {
      toast.error('Erreur lors de la suppression : ' + (err as Error).message)
    } finally {
      setDeleting(null)
      setOpenActions(null)
    }
  }

  if (loading) return <div className="space-y-6"><LoadingSkeleton rows={6} /></div>
  if (error) return <div className="space-y-6"><ErrorBanner message={error} onRetry={refetch} /></div>

  // Petit helper visuel pour le badge de statut (mêmes 3 statuts métier)
  const statutBadgeCls = (s: ChantierFilter) =>
    s === 'En cours'
      ? 'bg-blue-50 text-blue-700 border border-blue-100'
      : s === 'Terminés'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
        : 'bg-gray-100 text-gray-600 border border-gray-200'

  return (
    <div className="space-y-6">
      {/* ── Action bar : titre + recherche + filtre + bouton "Nouveau chantier" ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em]">
            Chantiers
          </h1>
          <span className="font-spline-mono font-medium text-sm text-gray-500">
            ({chantiers.length})
          </span>
        </div>

        <div className="flex-1" />

        {/* Recherche — input V4 (small avec icône à gauche) */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                       placeholder:text-gray-400
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
        </div>

        {/* Filtre statut — select V4 inline */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                     font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                     cursor-pointer
                     focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                     focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                     transition-all duration-200"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* CTA "Nouveau chantier" — PremiumButton primaire */}
        <Link href="/dashboard/chantiers/nouveau">
          <PremiumButton variant="primary" icon={<Plus size={16} />}>
            Nouveau chantier
          </PremiumButton>
        </Link>
      </div>

      {/* ── Mobile : cards empilées (sm:hidden) — pattern dual layout ── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white inline-flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(255,122,26,0.35)]">
              <HardHat size={28} />
            </div>
            <p className="font-hanken font-semibold text-[#0f1a3a] text-base">Aucun chantier trouvé</p>
            <p className="font-hanken text-sm text-gray-500 mt-1">Essayez d&apos;ajuster vos filtres ou créez-en un nouveau.</p>
          </div>
        ) : (
          filtered.map((chantier: Record<string, unknown>) => {
            const client = clientMap.get(chantier.client_id as string)
            const clientName = client ? `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() : '—'
            const avancement = computeAvancement(chantier)
            const statut = statutToFilter(chantier.statut as string)
            const montantDevis = formatMoney(getChantierDevisTTC(chantier))

            return (
              <div
                key={String(chantier.id)}
                onClick={() => router.push(`/dashboard/chantiers/${chantier.id}`)}
                className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3.5 cursor-pointer hover:border-[#ff7a1a]/30 active:bg-gray-50 transition-all shadow-[0_2px_6px_rgba(15,26,58,0.04)]"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-hanken font-bold text-[14.5px] text-[#0f1a3a] truncate">{clientName}</p>
                    <p className="font-hanken text-xs text-gray-500 truncate mt-0.5">{String(chantier.titre || '')}</p>
                  </div>
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-full font-hanken text-[11px] font-bold whitespace-nowrap ${statutBadgeCls(statut)}`}>
                    {statut}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${getProgressColor(avancement)}`} style={{ width: `${avancement}%` }} />
                  </div>
                  <p className="font-spline-mono font-semibold text-xs text-[#0f1a3a] whitespace-nowrap">{montantDevis}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Desktop : table dans PremiumCard (rounded-2xl, sans accent line) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_2px_6px_rgba(15,26,58,0.04)] overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
              {['Client / Chantier', 'Avancement', 'Date début', 'Statut', 'Devisé TTC', 'Facturé TTC', 'Encaissé', 'Équipe', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((chantier: Record<string, unknown>, idx: number) => {
              const client = clientMap.get(chantier.client_id as string)
              const clientName = client ? `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() : '—'
              const avancement = computeAvancement(chantier)
              const initials = clientName !== '—' ? getInitials(clientName) : '?'
              const statut = statutToFilter(chantier.statut as string)

              return (
                <tr
                  key={String(chantier.id)}
                  onClick={() => router.push(`/dashboard/chantiers/${chantier.id}`)}
                  className={`border-b border-gray-100 hover:bg-[#fafbfc] cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-[#fcfcfd]' : ''} ${avancement === 100 ? 'bg-emerald-50/30' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-hanken font-semibold text-[14px] text-[#0f1a3a]">{clientName}</div>
                    <div className="font-hanken text-xs text-gray-500 mt-0.5">{String(chantier.titre || '')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="min-w-[100px]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${getProgressColor(avancement)}`} style={{ width: `${avancement}%` }} />
                        </div>
                        <span className="font-spline-mono font-medium text-xs text-gray-500 whitespace-nowrap">{avancement}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-spline-mono font-medium text-sm text-gray-600">
                    {formatDate(chantier.date_debut as string)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full font-hanken text-[11px] font-bold ${statutBadgeCls(statut)}`}>
                      {statut}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-spline-mono font-semibold text-sm text-[#0f1a3a]">
                      {formatMoney(getChantierDevisTTC(chantier))}
                    </div>
                    {(() => {
                      const counts = devisCountParChantier.get(chantier.id as string)
                      if (!counts || counts.total === 0) return null
                      return (
                        <div className="font-hanken text-[11px] text-gray-400 font-normal mt-0.5">
                          {counts.enCours}/{counts.total} devis {counts.enCours === counts.total ? 'en cours' : counts.enCours > 0 ? 'en cours' : 'facturé' + (counts.total > 1 ? 's' : '')}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 font-spline-mono font-semibold text-sm text-[#0f1a3a]">
                    {formatMoney(getChantierFactureTTC(chantier))}
                  </td>
                  <td className="px-4 py-3 font-spline-mono font-semibold text-sm text-[#0f1a3a]">
                    {formatMoney(getChantierEncaisse(chantier))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-hanken text-xs font-bold border-2 border-white shadow-sm"
                        style={{ backgroundColor: (chantier.couleur as string) || '#5ab4e0' }}
                        title={initials}
                      >
                        {initials}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => openMenu(e, chantier.id as string)}
                      aria-label="Actions"
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white inline-flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(255,122,26,0.35)]">
              <HardHat size={28} />
            </div>
            <p className="font-hanken font-semibold text-[#0f1a3a] text-base">Aucun chantier trouvé</p>
            <p className="font-hanken text-sm text-gray-500 mt-1">Essayez d&apos;ajuster vos filtres ou créez-en un nouveau.</p>
          </div>
        )}
      </div>

      {/* ── Menu flottant fixed — actions Voir/Modifier/Archiver/Supprimer ── */}
      {openActions && menuPos && (() => {
        const activeChantier = filtered.find(c => (c.id as string) === openActions)
        if (!activeChantier) return null
        const statut = activeChantier.statut as string
        return (
          <div
            className="fixed z-[9999] w-52 bg-white rounded-xl shadow-[0_20px_50px_rgba(15,26,58,0.15)] border border-[#0f1a3a]/[0.06] py-1.5"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { closeMenu(); router.push(`/dashboard/chantiers/${activeChantier.id}`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"><Eye size={14} /> Voir</button>
            <button onClick={() => { closeMenu(); router.push(`/dashboard/chantiers/${activeChantier.id}`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"><Pencil size={14} /> Modifier</button>
            {statut === 'en_cours' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'livre' }); refetch() }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"><CheckCircle size={14} /> Marquer terminé</button>
            )}
            {(statut === 'livre' || statut === 'cloture') && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'en_cours' }); refetch() }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"><Calendar size={14} /> Remettre en cours</button>
            )}
            {statut !== 'archive' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'archive' }); refetch() }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-gray-500 hover:bg-[#fafbfc] transition-colors"><Archive size={14} /> Archiver</button>
            )}
            {statut === 'archive' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'en_cours' }); refetch() }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-[#0f1a3a] hover:bg-[#fafbfc] transition-colors"><Calendar size={14} /> Désarchiver</button>
            )}
            <button onClick={() => { closeMenu(); handleDelete(activeChantier.id as string) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-hanken font-medium text-sm text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /> Supprimer</button>
          </div>
        )
      })()}
    </div>
  )
}
