'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  X,
  Upload,
  Paperclip,
  ShoppingCart,
  Euro,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  useAchats,
  useFournisseurs,
  useChantiers,
  insertRow,
  updateRow,
  deleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type FilterPeriod = 'Tous' | 'Ce mois' | 'Ce trimestre'

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

// Wrapper en Suspense (requis par Next.js 14 pour useSearchParams() en client component)
export default function AchatsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Chargement...</div>}>
      <AchatsPageInner />
    </Suspense>
  )
}

function AchatsPageInner() {
  const { data: achats, loading: achatsLoading, error: achatsError, refetch: refetchAchats } = useAchats()
  const { data: fournisseurs, loading: fournisseursLoading } = useFournisseurs()
  const { data: chantiers, loading: chantiersLoading } = useChantiers()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterPeriod>('Tous')
  const [showModal, setShowModal] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Modal state
  const [modalFournisseur, setModalFournisseur] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalMontant, setModalMontant] = useState('')
  const [modalTva, setModalTva] = useState('20')
  const [modalDescription, setModalDescription] = useState('')
  const [modalChantier, setModalChantier] = useState('')

  const resetModal = () => {
    setModalFournisseur('')
    setModalDate('')
    setModalMontant('')
    setModalTva('20')
    setModalDescription('')
    setModalChantier('')
    setEditingId(null)
  }

  // Auto-ouverture de la modal si on arrive depuis ?new=1 (bouton "Ajouter un achat"
  // depuis la page chantier détail). Pré-remplit le chantier si ?chantier_id=X est fourni.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const chId = searchParams.get('chantier_id') || ''
      setModalChantier(chId)
      setModalDate(new Date().toISOString().split('T')[0])
      setShowModal(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Name resolution maps
  const fournisseurMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of fournisseurs) {
      const rec = f as Record<string, unknown>
      map[rec.id as string] = (rec.nom ?? rec.name ?? '') as string
    }
    return map
  }, [fournisseurs])

  const chantierMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of chantiers) {
      const rec = c as Record<string, unknown>
      map[rec.id as string] = (rec.nom ?? rec.name ?? '') as string
    }
    return map
  }, [chantiers])

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let depensesMois = 0
    let totalAnnee = 0
    const fournisseursActifs = new Set<string>()

    for (const a of achats) {
      const rec = a as Record<string, unknown>
      const dateStr = rec.date_achat as string | undefined
      const montant = Number(rec.montant_ht ?? 0)
      if (dateStr) {
        const d = new Date(dateStr)
        if (d.getFullYear() === currentYear) {
          totalAnnee += montant
          if (d.getMonth() === currentMonth) {
            depensesMois += montant
          }
        }
      }
      if (rec.fournisseur_id) fournisseursActifs.add(rec.fournisseur_id as string)
    }

    return {
      depensesMois,
      totalAnnee,
      nbFournisseurs: fournisseursActifs.size,
    }
  }, [achats])

  // Filtering
  const filtered = useMemo(() => {
    return achats.filter((a) => {
      const rec = a as Record<string, unknown>
      const dateStr = rec.date_achat as string | undefined

      // Period filter
      if (filter !== 'Tous' && dateStr) {
        const d = new Date(dateStr)
        const now = new Date()
        if (filter === 'Ce mois') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
        }
        if (filter === 'Ce trimestre') {
          const currentQ = Math.floor(now.getMonth() / 3)
          const itemQ = Math.floor(d.getMonth() / 3)
          if (itemQ !== currentQ || d.getFullYear() !== now.getFullYear()) return false
        }
      }

      // Search
      if (search) {
        const q = search.toLowerCase()
        const fournisseurNom = fournisseurMap[rec.fournisseur_id as string] ?? ''
        const chantierNom = chantierMap[rec.chantier_id as string] ?? ''
        const description = ((rec.description ?? '') as string).toLowerCase()
        return (
          fournisseurNom.toLowerCase().includes(q) ||
          description.includes(q) ||
          chantierNom.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [achats, search, filter, fournisseurMap, chantierMap])

  const handleSave = async () => {
    if (!modalMontant || !modalDate) return
    setSaving(true)
    try {
      const values: Record<string, unknown> = {
        fournisseur_id: modalFournisseur || null,
        date_achat: modalDate,
        montant_ht: parseFloat(modalMontant),
        taux_tva: parseFloat(modalTva),
        description: modalDescription,
        chantier_id: modalChantier || null,
      }
      if (editingId) {
        await updateRow('achats', editingId, values)
      } else {
        await insertRow('achats', values)
      }
      refetchAchats()
      setShowModal(false)
      resetModal()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (achat: Record<string, unknown>) => {
    setEditingId(achat.id as string)
    setModalFournisseur((achat.fournisseur_id ?? '') as string)
    setModalDate((achat.date_achat ?? '') as string)
    setModalMontant(String(achat.montant_ht ?? ''))
    setModalTva(String(achat.taux_tva ?? '20'))
    setModalDescription((achat.description ?? '') as string)
    setModalChantier((achat.chantier_id ?? '') as string)
    setOpenActionId(null)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet achat ?')) return
    try {
      await deleteRow('achats', id)
      refetchAchats()
    } catch (err) {
      alert((err as Error).message)
    }
    setOpenActionId(null)
  }

  const loading = achatsLoading || fournisseursLoading || chantiersLoading

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (achatsError) {
    return <ErrorBanner message={achatsError} onRetry={refetchAchats} />
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
              <ShoppingCart size={20} className="text-[#5ab4e0]" />
            </div>
            <div>
              <p className="text-xs font-manrope text-[#6b7280] uppercase tracking-wider">D&eacute;penses ce mois</p>
              <p className="text-xl font-syne font-bold text-[#0f1a3a]">{stats.depensesMois.toLocaleString('fr-FR')}&nbsp;&euro; HT</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Euro size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-manrope text-[#6b7280] uppercase tracking-wider">Total ann&eacute;e</p>
              <p className="text-xl font-syne font-bold text-[#0f1a3a]">{stats.totalAnnee.toLocaleString('fr-FR')}&nbsp;&euro; HT</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Building2 size={20} className="text-[#e87a2a]" />
            </div>
            <div>
              <p className="text-xs font-manrope text-[#6b7280] uppercase tracking-wider">Fournisseurs actifs</p>
              <p className="text-xl font-syne font-bold text-[#0f1a3a]">{stats.nbFournisseurs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Rechercher un achat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter */}
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterPeriod)}
          containerClassName="sm:w-auto"
        >
          <option value="Tous">Tous</option>
          <option value="Ce mois">Ce mois</option>
          <option value="Ce trimestre">Ce trimestre</option>
        </Select>

        {/* New achat button */}
        <button
          onClick={() => { resetModal(); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouvel achat
        </button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun achat trouvé</p>
          </div>
        ) : (
          filtered.map((a) => {
            const achat = a as Record<string, unknown>
            const id = achat.id as string
            const montantHT = Number(achat.montant_ht ?? 0)
            const tauxTva = Number(achat.taux_tva ?? 20)
            const montantTTC = Number(achat.montant_ttc ?? montantHT * (1 + tauxTva / 100))
            const dateStr = achat.date_achat as string | undefined
            const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : ''
            const fournisseurNom = fournisseurMap[achat.fournisseur_id as string] ?? '—'

            return (
              <div
                key={id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-manrope font-bold text-[#1a1a2e] truncate">{fournisseurNom}</p>
                    <p className="text-xs font-manrope text-gray-500 truncate">{dateFormatted}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-manrope font-bold text-[#0f1a3a]">{montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;&euro;</p>
                    <p className="text-xs font-manrope text-gray-500">{montantHT.toLocaleString('fr-FR')}&nbsp;&euro; HT</p>
                  </div>
                </div>
                {String(achat.description ?? '') && (
                  <p className="text-xs font-manrope text-gray-600 mb-2 truncate">{String(achat.description ?? '')}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-manrope text-gray-500">
                    {!!achat.justificatif_url && (
                      <span className="inline-flex items-center gap-1 text-[#5ab4e0]">
                        <Paperclip size={12} />
                        Justificatif
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenActionId(openActionId === id ? null : id)
                      }}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openActionId === id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-10 py-1 w-36">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(achat)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-gray-600 hover:bg-gray-50"
                        >
                          <Pencil size={14} />
                          Modifier
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(id)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
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
              {['Date', 'Fournisseur', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Chantier', 'Justificatif', 'Actions'].map((col) => (
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
            {filtered.map((a, idx) => {
              const achat = a as Record<string, unknown>
              const id = achat.id as string
              const montantHT = Number(achat.montant_ht ?? 0)
              const tauxTva = Number(achat.taux_tva ?? 20)
              const montantTTC = Number(achat.montant_ttc ?? montantHT * (1 + tauxTva / 100))
              const dateStr = achat.date_achat as string | undefined
              const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : ''
              const fournisseurNom = fournisseurMap[achat.fournisseur_id as string] ?? '\u2014'
              const chantierNom = chantierMap[achat.chantier_id as string] ?? '\u2014'

              return (
                <tr
                  key={id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{dateFormatted}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">{fournisseurNom}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{String(achat.description ?? '')}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">{montantHT.toLocaleString('fr-FR')}&nbsp;&euro;</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{tauxTva}%</td>
                  <td className="px-4 py-3 text-sm font-manrope font-bold text-[#0f1a3a]">{montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;&euro;</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium bg-gray-100 text-gray-600">
                      {chantierNom}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {achat.justificatif_url ? (
                      <span className="inline-flex items-center gap-1 text-[#5ab4e0]">
                        <Paperclip size={14} />
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenActionId(openActionId === id ? null : id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openActionId === id && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-10 py-1 w-36">
                          <button
                            onClick={() => handleEdit(achat)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-gray-600 hover:bg-gray-50"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun achat trouv&eacute;</p>
          </div>
        )}
      </div>

      {/* Add/Edit achat modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">{editingId ? 'Modifier l\u0027achat' : 'Nouvel achat'}</h2>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Fournisseur */}
            <Select
              label="Fournisseur"
              value={modalFournisseur}
              onChange={(e) => setModalFournisseur(e.target.value)}
            >
              <option value="">S&eacute;lectionner un fournisseur...</option>
              {fournisseurs.map((f) => {
                const rec = f as Record<string, unknown>
                return (
                  <option key={String(rec.id)} value={String(rec.id)}>
                    {String(rec.nom ?? rec.name ?? '')}
                  </option>
                )
              })}
            </Select>

            {/* Date + Montant HT */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
              />
              <Input
                label="Montant HT"
                type="number"
                value={modalMontant}
                onChange={(e) => setModalMontant(e.target.value)}
                placeholder="0,00 €"
              />
            </div>

            {/* TVA */}
            <Select
              label="TVA"
              value={modalTva}
              onChange={(e) => setModalTva(e.target.value)}
            >
              <option value="5.5">5,5%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
            </Select>

            {/* Description */}
            <Input
              label="Description"
              type="text"
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="Ex: Tubes cuivre + raccords"
            />

            {/* Chantier */}
            <Select
              label="Associer au chantier"
              value={modalChantier}
              onChange={(e) => setModalChantier(e.target.value)}
            >
              <option value="">S&eacute;lectionner un chantier...</option>
              {chantiers.map((c) => {
                const rec = c as Record<string, unknown>
                return (
                  <option key={String(rec.id)} value={String(rec.id)}>
                    {String(rec.nom ?? rec.name ?? '')}
                  </option>
                )
              })}
            </Select>

            {/* Upload justificatif */}
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Justificatif</label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-[#5ab4e0] transition-colors cursor-pointer">
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-manrope text-[#6b7280]">Glisser un fichier ou <span className="text-[#5ab4e0] font-medium">parcourir</span></p>
                <p className="text-xs font-manrope text-gray-400 mt-1">PDF, JPG, PNG (max 5 Mo)</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="px-5 h-10 rounded-lg border border-gray-200 text-sm font-syne font-bold text-[#6b7280] hover:text-[#1a1a2e] hover:border-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 h-10 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
