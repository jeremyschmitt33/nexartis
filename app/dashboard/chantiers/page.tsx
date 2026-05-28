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
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types & Helpers
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
// Page
// -------------------------------------------------------------------

export default function ChantiersListPage() {
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

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, chantierId: string) {
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

  function getProgressColor(percent: number) {
    if (percent >= 75) return 'bg-green-500'
    if (percent >= 25) return 'bg-[#5ab4e0]'
    return 'bg-[#e87a2a]'
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
    if (!confirm('Supprimer ce chantier ?')) return
    setDeleting(id)
    try {
      await deleteRow('chantiers', id)
      refetch()
    } catch (err) {
      alert('Erreur lors de la suppression : ' + (err as Error).message)
    } finally {
      setDeleting(null)
      setOpenActions(null)
    }
  }

  if (loading) return <div className="space-y-6"><LoadingSkeleton rows={6} /></div>
  if (error) return <div className="space-y-6"><ErrorBanner message={error} onRetry={refetch} /></div>

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-syne font-bold text-[#0f1a3a]">Chantiers</h1>
          <span className="text-sm font-manrope text-gray-500">({chantiers.length})</span>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter */}
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          containerClassName="sm:w-auto"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>

        {/* New button */}
        <Link
          href="/dashboard/chantiers/nouveau"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouveau chantier
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <HardHat size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun chantier trouvé</p>
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
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e] truncate">{clientName}</p>
                    <p className="text-xs font-manrope text-gray-500 truncate">{String(chantier.titre || '')}</p>
                  </div>
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium whitespace-nowrap ${
                    statut === 'En cours' ? 'bg-blue-50 text-blue-700' :
                    statut === 'Terminés' ? 'bg-green-50 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {statut}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                    <div className={`h-full rounded-full ${getProgressColor(avancement)}`} style={{ width: `${avancement}%` }} />
                  </div>
                  <p className="text-xs font-manrope font-semibold text-[#1a1a2e] whitespace-nowrap">{montantDevis}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50">
              {['Client / Chantier', 'Avancement', 'Date début', 'Statut', 'Devisé TTC', 'Facturé TTC', 'Encaissé', 'Équipe', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500"
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

              return (
                <tr
                  key={String(chantier.id)}
                  onClick={() => router.push(`/dashboard/chantiers/${chantier.id}`)}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''
                  } ${avancement === 100 ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-manrope font-medium text-[#1a1a2e]">{clientName}</div>
                    <div className="text-xs font-manrope text-gray-500">{String(chantier.titre || '')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="min-w-[100px]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${getProgressColor(avancement)}`} style={{ width: `${avancement}%` }} />
                        </div>
                        <span className="text-xs font-manrope text-gray-500 whitespace-nowrap">{avancement}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(chantier.date_debut as string)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${
                      statutToFilter(chantier.statut as string) === 'En cours' ? 'bg-blue-50 text-blue-700' :
                      statutToFilter(chantier.statut as string) === 'Terminés' ? 'bg-green-50 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {statutToFilter(chantier.statut as string)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope font-medium text-[#1a1a2e]">
                    <div>{formatMoney(getChantierDevisTTC(chantier))}</div>
                    {(() => {
                      const counts = devisCountParChantier.get(chantier.id as string)
                      if (!counts || counts.total === 0) return null
                      return (
                        <div className="text-[11px] text-[#7b8ba3] font-normal mt-0.5">
                          {counts.enCours}/{counts.total} devis {counts.enCours === counts.total ? 'en cours' : counts.enCours > 0 ? 'en cours' : 'facturé' + (counts.total > 1 ? 's' : '')}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope font-medium text-[#1a1a2e]">{formatMoney(getChantierFactureTTC(chantier))}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-medium text-[#1a1a2e]">{formatMoney(getChantierEncaisse(chantier))}</td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-manrope font-bold border-2 border-white"
                        style={{ backgroundColor: (chantier.couleur as string) || '#5ab4e0' }}
                        title={initials}
                      >
                        {initials}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => openMenu(e, chantier.id as string)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <HardHat size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun chantier trouvé</p>
          </div>
        )}
      </div>

      {/* Menu flottant en position fixed — sort du conteneur */}
      {openActions && menuPos && (() => {
        const activeChantier = filtered.find(c => (c.id as string) === openActions)
        if (!activeChantier) return null
        const statut = activeChantier.statut as string
        return (
          <div
            className="fixed z-[9999] w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { closeMenu(); router.push(`/dashboard/chantiers/${activeChantier.id}`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Eye size={14} /> Voir</button>
            <button onClick={() => { closeMenu(); router.push(`/dashboard/chantiers/${activeChantier.id}`) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Pencil size={14} /> Modifier</button>
            {statut === 'en_cours' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'livre' }); refetch() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><CheckCircle size={14} /> Marquer terminé</button>
            )}
            {(statut === 'livre' || statut === 'cloture') && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'en_cours' }); refetch() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Calendar size={14} /> Remettre en cours</button>
            )}
            {statut !== 'archive' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'archive' }); refetch() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-gray-500"><Archive size={14} /> Archiver</button>
            )}
            {statut === 'archive' && (
              <button onClick={async () => { closeMenu(); await updateRow('chantiers', activeChantier.id as string, { statut: 'en_cours' }); refetch() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-[#1a1a2e]"><Calendar size={14} /> Désarchiver</button>
            )}
            <button onClick={() => { closeMenu(); handleDelete(activeChantier.id as string) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-manrope hover:bg-gray-50 transition-colors text-red-600"><Trash2 size={14} /> Supprimer</button>
          </div>
        )
      })()}
    </div>
  )
}
