'use client'

// ---------------------------------------------------------------------------
// MesPrestations — CRUD complet du catalogue perso (table `prestations`).
// Code extrait FIDELEMENT de app/dashboard/bibliotheque/page.tsx (logique
// metier inchangee : insertRow / updateRow / deleteRow, modal creation/edition,
// recherche, filtre categorie, alerte > 6 mois).
//
// Ajout : ref imperative `openCreateModal(prefill?)` pour permettre au mode
// « Catalogue » d'ouvrir CE MEME modal de creation, pre-rempli depuis un item
// du catalogue (designation / unite / tva ; prix laisse vide pour que
// l'artisan saisisse SON prix). L'enregistrement passe par le flux existant.
// ---------------------------------------------------------------------------

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
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
import { findDuplicateGroups } from '@/lib/prestations-dedup'

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
// Prefill (utilise par le mode « Catalogue »)
// -------------------------------------------------------------------

export interface MesPrestationsHandle {
  /** Ouvre le modal de creation pre-rempli (prix laisse vide a 0 volontairement). */
  openCreateModal: (prefill?: {
    designation?: string
    unite?: string
    taux_tva?: number | string
    categorie?: CategorieValue
  }) => void
}

// -------------------------------------------------------------------
// Composant
// -------------------------------------------------------------------

const MesPrestations = forwardRef<MesPrestationsHandle>(function MesPrestations(_props, ref) {
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
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Modal state
  const [modalDesignation, setModalDesignation] = useState('')
  const [modalUnite, setModalUnite] = useState('U')
  const [modalPrix, setModalPrix] = useState('')
  const [modalTva, setModalTva] = useState('10')
  const [modalCategorie, setModalCategorie] = useState<CategorieValue>('Fournitures')

  const resetModal = () => {
    setEditingId(null)
    setModalDesignation('')
    setModalUnite('U')
    setModalPrix('')
    setModalTva('10')
    setModalCategorie('Fournitures')
  }

  // Ouverture pre-remplie depuis le catalogue : on reutilise le MEME modal de
  // creation (editingId = null => insertRow), donc le flux d'enregistrement est
  // strictement identique a « Nouvelle prestation ».
  useImperativeHandle(ref, () => ({
    openCreateModal: (prefill) => {
      setEditingId(null)
      setModalDesignation(prefill?.designation ?? '')
      // L'unite du catalogue (ex: 'm²') correspond aux memes valeurs que le select.
      setModalUnite(prefill?.unite ?? 'U')
      setModalPrix('') // prix volontairement vide : l'artisan saisit SON prix
      setModalTva(prefill?.taux_tva != null ? String(prefill.taux_tva) : '10')
      setModalCategorie(prefill?.categorie ?? 'Fournitures')
      setOpenActionId(null)
      setShowModal(true)
    },
  }))

  const openEditModal = (prestation: Record<string, unknown>) => {
    setEditingId(prestation.id as string)
    setModalDesignation((prestation.designation as string) || '')
    setModalUnite((prestation.unite as string) || 'U')
    setModalPrix(String((prestation.prix_unitaire_ht as number) ?? ''))
    setModalTva(String((prestation.taux_tva as number) ?? '10'))
    const cat = (prestation.categorie as CategorieValue) || 'Fournitures'
    setModalCategorie(cat)
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

  // Groupes de prestations qui se ressemblent (fautes de frappe, pluriel...).
  // On SIGNALE seulement : l'artisan garde la bonne et supprime les doublons
  // via handleDelete. Aucune fusion automatique. Memoise sur la liste chargee.
  const duplicateGroups = useMemo(
    () =>
      findDuplicateGroups(
        prestations.map((p) => {
          const row = p as Record<string, unknown>
          return {
            id: row.id as string,
            designation: (row.designation as string) ?? '',
            prix_unitaire_ht: (row.prix_unitaire_ht as number) ?? 0,
            unite: (row.unite as string) ?? '',
            taux_tva: (row.taux_tva as number) ?? 0,
          }
        }),
      ),
    [prestations],
  )
  const duplicatesCount = duplicateGroups.reduce((n, g) => n + g.length, 0)

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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
          <input
            type="text"
            placeholder="Rechercher une prestation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg border border-navy/15 pl-9 pr-4 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none transition-colors"
          />
        </div>

        {/* Filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Categorie)}
            className="h-10 rounded-lg border border-navy/15 px-3 pr-8 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none appearance-none bg-white cursor-pointer"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy/40 pointer-events-none" />
        </div>

        {/* New prestation button */}
        <button
          onClick={() => { resetModal(); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-orange hover:bg-orange/90 text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouvelle prestation
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <BookOpen size={16} className="text-sky" />
          <span className="text-sm font-hanken font-semibold text-navy">{items.length} prestation{items.length > 1 ? 's' : ''}</span>
        </div>
        {needsUpdate > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-sm font-hanken font-medium text-amber-700">{needsUpdate} à mettre à jour</span>
          </div>
        )}
      </div>

      {/* Encart "doublons" — prestations qui se ressemblent (a verifier).
          Cliquable : se deplie pour montrer chaque groupe. L'artisan garde la
          bonne prestation et supprime les autres (handleDelete). Pas de fusion. */}
      {duplicateGroups.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDuplicates((v) => !v)}
            aria-expanded={showDuplicates}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-amber-100/60 transition-colors"
          >
            <AlertTriangle size={18} className="text-amber-500 shrink-0" />
            <span className="flex-1 text-sm font-hanken font-semibold text-amber-900">
              <span className="font-spline-mono">{duplicatesCount}</span> prestation{duplicatesCount > 1 ? 's' : ''} se ressemblent — à vérifier
            </span>
            <ChevronDown
              size={16}
              className={`text-amber-600 shrink-0 transition-transform ${showDuplicates ? 'rotate-180' : ''}`}
            />
          </button>

          {showDuplicates && (
            <div className="px-4 pb-4 pt-1 space-y-4">
              <p className="text-xs font-hanken text-amber-700/90">
                Ces prestations ont une désignation proche. Gardez celle que vous voulez et supprimez les doublons. Aucune fusion automatique.
              </p>
              {duplicateGroups.map((group, gIdx) => (
                <div key={gIdx} className="rounded-lg border border-amber-200 bg-white divide-y divide-amber-100">
                  {group.map((g) => {
                    const prix = (g.prix_unitaire_ht as number) ?? 0
                    const unite = (g.unite as string) ?? ''
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-hanken font-semibold text-navy truncate">{g.designation}</p>
                          <p className="text-xs font-spline-mono text-navy/50 mt-0.5">
                            {prix.toLocaleString('fr-FR')}&nbsp;€{unite ? ` · ${unite}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const full = items.find((p) => (p.id as string) === g.id)
                              if (full) openEditModal(full)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-hanken font-medium text-navy/70 hover:bg-navy/5 transition-colors"
                          >
                            <Pencil size={13} />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(g.id)}
                            disabled={deletingId === g.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-hanken font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 size={13} />
                            {deletingId === g.id ? 'Suppression...' : 'Supprimer'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table (desktop) */}
      <div className="hidden sm:block bg-white rounded-xl border border-navy/15">
        <table className="w-full">
          <thead>
            <tr className="bg-cream">
              {['Désignation', 'Unité', 'Prix HT', 'TVA', 'Catégorie', 'Dernière MAJ', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-hanken font-semibold uppercase tracking-wider text-navy/60"
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
                  className={`border-b border-navy/8 hover:bg-cream transition-colors ${
                    idx % 2 === 1 ? 'bg-cream/40' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-hanken font-semibold text-navy max-w-[300px]">
                    {(prestation.designation as string) ?? ''}
                  </td>
                  <td className="px-4 py-3 text-sm font-hanken text-navy/60">{(prestation.unite as string) ?? ''}</td>
                  <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-navy">{prixHT.toLocaleString('fr-FR')}&nbsp;€</td>
                  <td className="px-4 py-3 text-sm font-spline-mono text-navy/60">{tva}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-hanken font-medium ${CATEGORY_STYLES[cat] ?? 'bg-navy/5 text-navy/70'}`}>
                      {cat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-hanken text-navy/60">{formatDate(updatedAt)}</span>
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
                        className="p-1.5 rounded-lg hover:bg-navy/5 text-navy/40 hover:text-navy/70 transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openActionId === id && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-navy/15 shadow-lg z-10 py-1 w-36">
                          <button
                            onClick={() => openEditModal(prestation)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-navy/70 hover:bg-cream"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDuplicate(prestation)}
                            disabled={duplicatingId === id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-navy/70 hover:bg-cream disabled:opacity-50"
                          >
                            <Copy size={14} />
                            {duplicatingId === id ? 'Copie...' : 'Dupliquer'}
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            disabled={deletingId === id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-red-600 hover:bg-red-50"
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
            <BookOpen size={40} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-hanken text-navy/50">Aucune prestation trouvée</p>
          </div>
        )}
      </div>

      {/* Cards (mobile) */}
      <div className="sm:hidden space-y-3">
        {filtered.map((prestation) => {
          const id = prestation.id as string
          const updatedAt = (prestation.updated_at as string | null)
          const outdated = isOlderThan6Months(updatedAt)
          const prixHT = (prestation.prix_unitaire_ht as number) ?? 0
          const tva = (prestation.taux_tva as number) ?? 0
          const cat = (prestation.categorie as string) ?? ''
          return (
            <div
              key={id}
              className="bg-white rounded-xl border border-navy/15 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-sm font-hanken font-semibold text-navy">
                  {(prestation.designation as string) ?? ''}
                </p>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenActionId(openActionId === id ? null : id)}
                    className="p-1.5 rounded-lg hover:bg-navy/5 text-navy/40 hover:text-navy/70 transition-colors"
                    aria-label="Actions"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {openActionId === id && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-navy/15 shadow-lg z-10 py-1 w-36">
                      <button
                        onClick={() => openEditModal(prestation)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-navy/70 hover:bg-cream"
                      >
                        <Pencil size={14} />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDuplicate(prestation)}
                        disabled={duplicatingId === id}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-navy/70 hover:bg-cream disabled:opacity-50"
                      >
                        <Copy size={14} />
                        {duplicatingId === id ? 'Copie...' : 'Dupliquer'}
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        disabled={deletingId === id}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-hanken text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        {deletingId === id ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-spline-mono font-semibold text-navy">{prixHT.toLocaleString('fr-FR')}&nbsp;€</span>
                <span className="text-xs text-navy/40">·</span>
                <span className="text-sm font-spline-mono text-navy/60">{(prestation.unite as string) ?? ''}</span>
                <span className="text-xs text-navy/40">·</span>
                <span className="text-sm font-spline-mono text-navy/60">TVA {tva}%</span>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                {cat && (
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-hanken font-medium ${CATEGORY_STYLES[cat] ?? 'bg-navy/5 text-navy/70'}`}>
                    {cat}
                  </span>
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs font-hanken text-navy/50">{formatDate(updatedAt)}</span>
                  {outdated && (
                    <span className="flex items-center gap-1 text-amber-500" title="Prix à vérifier">
                      <AlertTriangle size={13} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-navy/15 py-12 text-center">
            <BookOpen size={40} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-hanken text-navy/50">Aucune prestation trouvée</p>
          </div>
        )}
      </div>

      {/* Add prestation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-navy">{editingId ? 'Modifier la prestation' : 'Nouvelle prestation'}</h2>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-navy/40 hover:text-navy/70 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Désignation */}
            <div>
              <label className="block text-sm font-hanken font-medium text-navy mb-1">Désignation</label>
              <input
                type="text"
                value={modalDesignation}
                onChange={(e) => setModalDesignation(e.target.value)}
                placeholder="Ex: Fourniture et pose chauffe-eau"
                className="w-full h-10 rounded-lg border border-navy/15 px-3 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none"
              />
            </div>

            {/* Unité + Prix HT */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-hanken font-medium text-navy mb-1">Unité</label>
                <select
                  value={modalUnite}
                  onChange={(e) => setModalUnite(e.target.value)}
                  className="w-full h-10 rounded-lg border border-navy/15 px-3 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none"
                >
                  <option value="U">U (Unité)</option>
                  <option value="Fft">Fft (Forfait)</option>
                  <option value="m²">m²</option>
                  <option value="ml">ml (Mètre linéaire)</option>
                  <option value="h">h (Heure)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-hanken font-medium text-navy mb-1">Prix HT</label>
                <input
                  type="number"
                  value={modalPrix}
                  onChange={(e) => setModalPrix(e.target.value)}
                  placeholder="0,00 €"
                  className="w-full h-10 rounded-lg border border-navy/15 px-3 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none"
                />
              </div>
            </div>

            {/* TVA + Catégorie */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-hanken font-medium text-navy mb-1">TVA</label>
                <select
                  value={modalTva}
                  onChange={(e) => setModalTva(e.target.value)}
                  className="w-full h-10 rounded-lg border border-navy/15 px-3 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none"
                >
                  <option value="5.5">5,5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-hanken font-medium text-navy mb-1">Catégorie</label>
                <select
                  value={modalCategorie}
                  onChange={(e) => setModalCategorie(e.target.value as CategorieValue)}
                  className="w-full h-10 rounded-lg border border-navy/15 px-3 text-sm font-hanken focus:border-sky focus:ring-1 focus:ring-sky outline-none"
                >
                  <option value="Fournitures">Fournitures</option>
                  <option value="Main d'œuvre">Main d&apos;œuvre</option>
                  <option value="Ouvrages">Ouvrages</option>
                  <option value="Déplacements">Déplacements</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="px-5 h-10 rounded-lg border border-navy/15 text-sm font-syne font-bold text-navy/60 hover:text-navy hover:border-navy/25 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !modalDesignation.trim() || !modalPrix}
                className="px-5 h-10 rounded-lg bg-orange hover:bg-orange/90 disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default MesPrestations
