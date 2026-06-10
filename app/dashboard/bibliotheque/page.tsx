'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  ChevronDown,
  X,
  AlertTriangle,
  BookOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react'
import { usePrestations, insertRow, updateRow, deleteRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

// -------------------------------------------------------------------
// Types & Constants
// -------------------------------------------------------------------

type Categorie = 'Toutes' | 'Fournitures' | "Main d'œuvre" | 'Ouvrages' | 'Déplacements'
type CategorieValue = 'Fournitures' | "Main d'œuvre" | 'Ouvrages' | 'Déplacements'

const CATEGORY_FILTERS: Categorie[] = ['Toutes', 'Fournitures', "Main d'œuvre", 'Ouvrages', 'Déplacements']

const CATEGORY_STYLES: Record<string, string> = {
  'Fournitures': 'bg-blue-50 text-blue-700',
  "Main d'œuvre": 'bg-green-50 text-green-700',
  'Ouvrages': 'bg-violet-50 text-violet-700',
  'Déplacements': 'bg-orange-50 text-orange-700',
}

function isOlderThan6Months(dateStr: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  return date < sixMonthsAgo
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function BibliothequePage() {
  const askConfirm = useConfirm()
  const { data: prestations, loading, error, refetch } = usePrestations()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Categorie>('Toutes')
  const [showModal, setShowModal] = useState(false)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  // Modal state
  const [modalDesignation, setModalDesignation] = useState('')
  const [modalUnite, setModalUnite] = useState('U')
  const [modalPrix, setModalPrix] = useState('')
  const [modalTva, setModalTva] = useState('10')
  const [modalCategorie, setModalCategorie] = useState<CategorieValue>('Fournitures')
  const [modalTags, setModalTags] = useState('')

  const resetModal = () => {
    setEditingId(null)
    setModalDesignation('')
    setModalUnite('U')
    setModalPrix('')
    setModalTva('10')
    setModalCategorie('Fournitures')
    setModalTags('')
  }

  const openEditModal = (prestation: Record<string, unknown>) => {
    setEditingId(prestation.id as string)
    setModalDesignation((prestation.designation as string) || '')
    setModalUnite((prestation.unite as string) || 'U')
    setModalPrix(String((prestation.prix_unitaire_ht as number) ?? ''))
    setModalTva(String((prestation.taux_tva as number) ?? '10'))
    const cat = (prestation.categorie as CategorieValue) || 'Fournitures'
    setModalCategorie(cat)
    setModalTags((prestation.tags as string) || '')
    setOpenActionId(null)
    setShowModal(true)
  }

  const handleDuplicate = async (prestation: Record<string, unknown>) => {
    const id = prestation.id as string
    setOpenActionId(null)
    if (duplicatingId) return
    setDuplicatingId(id)
    try {
      const baseName = (prestation.designation as string) || ''
      await insertRow('prestations', {
        designation: `${baseName} (copie)`.trim(),
        unite: (prestation.unite as string) || 'U',
        prix_unitaire_ht: (prestation.prix_unitaire_ht as number) ?? 0,
        taux_tva: (prestation.taux_tva as number) ?? 10,
        categorie: (prestation.categorie as string) || 'Fournitures',
      })
      refetch()
    } catch (err) {
      toast.error('Erreur lors de la duplication : ' + (err as Error).message)
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleSave = async () => {
    if (!modalDesignation.trim() || !modalPrix) return
    setSaving(true)
    try {
      const values: Record<string, unknown> = {
        designation: modalDesignation.trim(),
        unite: modalUnite,
        prix_unitaire_ht: parseFloat(modalPrix),
        taux_tva: parseFloat(modalTva),
        categorie: modalCategorie,
      }
      if (editingId) {
        await updateRow('prestations', editingId, values)
      } else {
        await insertRow('prestations', values)
      }
      setShowModal(false)
      resetModal()
      refetch()
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ title: 'Supprimer cette prestation ?', variant: 'danger', confirmLabel: 'Supprimer' }))) return
    setDeletingId(id)
    try {
      await deleteRow('prestations', id)
      refetch()
    } catch (err) {
      toast.error('Erreur : ' + (err as Error).message)
    } finally {
      setDeletingId(null)
      setOpenActionId(null)
    }
  }

  const items = prestations.map((p) => p as Record<string, unknown>)

  const filtered = items.filter((p) => {
    const cat = (p.categorie as string) ?? ''
    if (filter !== 'Toutes' && cat !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ((p.designation as string) ?? '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
    }
    return true
  })

  const needsUpdate = items.filter((p) => isOlderThan6Months(p.updated_at as string | null)).length

  if (error) {
    return <ErrorBanner message={error} onRetry={refetch} />
  }

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une prestation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 pl-9 pr-4 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none transition-colors"
          />
        </div>

        {/* Filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Categorie)}
            className="h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none appearance-none bg-white cursor-pointer"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* New prestation button */}
        <button
          onClick={() => { resetModal(); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouvelle prestation
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <BookOpen size={16} className="text-[#5ab4e0]" />
          <span className="text-sm font-manrope font-semibold text-[#0f1a3a]">{items.length} prestation{items.length > 1 ? 's' : ''}</span>
        </div>
        {needsUpdate > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-sm font-manrope font-medium text-amber-700">{needsUpdate} à mettre à jour</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50">
              {['Désignation', 'Unité', 'Prix HT', 'TVA', 'Catégorie', 'Dernière MAJ', 'Actions'].map((col) => (
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
            {filtered.map((prestation, idx) => {
              const id = prestation.id as string
              const updatedAt = (prestation.updated_at as string | null)
              const outdated = isOlderThan6Months(updatedAt)
              const prixHT = (prestation.prix_unitaire_ht as number) ?? 0
              const tva = (prestation.taux_tva as number) ?? 0
              const cat = (prestation.categorie as string) ?? ''
              return (
                <tr
                  key={id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e] max-w-[300px]">
                    {(prestation.designation as string) ?? ''}
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{(prestation.unite as string) ?? ''}</td>
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">{prixHT.toLocaleString('fr-FR')}&nbsp;€</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{tva}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${CATEGORY_STYLES[cat] ?? 'bg-gray-50 text-gray-700'}`}>
                      {cat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-manrope text-gray-600">{formatDate(updatedAt)}</span>
                      {outdated && (
                        <span className="flex items-center gap-1 text-amber-500" title="Prix à vérifier">
                          <AlertTriangle size={14} />
                        </span>
                      )}
                    </div>
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
                            onClick={() => openEditModal(prestation)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-gray-600 hover:bg-gray-50"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDuplicate(prestation)}
                            disabled={duplicatingId === id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Copy size={14} />
                            {duplicatingId === id ? 'Copie...' : 'Dupliquer'}
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            disabled={deletingId === id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-manrope text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            {deletingId === id ? 'Suppression...' : 'Supprimer'}
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
            <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucune prestation trouvée</p>
          </div>
        )}
      </div>

      {/* Add prestation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">{editingId ? 'Modifier la prestation' : 'Nouvelle prestation'}</h2>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Désignation */}
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Désignation</label>
              <input
                type="text"
                value={modalDesignation}
                onChange={(e) => setModalDesignation(e.target.value)}
                placeholder="Ex: Fourniture et pose chauffe-eau"
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
              />
            </div>

            {/* Unité + Prix HT */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Unité</label>
                <select
                  value={modalUnite}
                  onChange={(e) => setModalUnite(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
                >
                  <option value="U">U (Unité)</option>
                  <option value="Fft">Fft (Forfait)</option>
                  <option value="m²">m²</option>
                  <option value="ml">ml (Mètre linéaire)</option>
                  <option value="h">h (Heure)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Prix HT</label>
                <input
                  type="number"
                  value={modalPrix}
                  onChange={(e) => setModalPrix(e.target.value)}
                  placeholder="0,00 €"
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
                />
              </div>
            </div>

            {/* TVA + Catégorie */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">TVA</label>
                <select
                  value={modalTva}
                  onChange={(e) => setModalTva(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
                >
                  <option value="5.5">5,5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Catégorie</label>
                <select
                  value={modalCategorie}
                  onChange={(e) => setModalCategorie(e.target.value as CategorieValue)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
                >
                  <option value="Fournitures">Fournitures</option>
                  <option value="Main d'œuvre">Main d&apos;œuvre</option>
                  <option value="Ouvrages">Ouvrages</option>
                  <option value="Déplacements">Déplacements</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Tags</label>
              <input
                type="text"
                value={modalTags}
                onChange={(e) => setModalTags(e.target.value)}
                placeholder="Ex: plomberie, chauffage"
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none"
              />
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
                disabled={saving || !modalDesignation.trim() || !modalPrix}
                className="px-5 h-10 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
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
