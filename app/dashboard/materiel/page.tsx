'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  ChevronDown,
  Wrench,
} from 'lucide-react'
import {
  useMateriel,
  insertRow,
  updateRow,
  deleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Materiel {
  id: string
  user_id: string
  designation: string
  categorie: string
  numero_serie?: string
  valeur_achat?: number
  date_achat?: string
  etat: string
  localisation?: string
  mode_acquisition?: string
  credit_montant_total?: number
  credit_mensualite?: number
  credit_duree_mois?: number
  credit_date_fin?: string
  credit_banque?: string
  assurance_mensualite?: number
  assurance_compagnie?: string
  assurance_numero_police?: string
  assurance_echeance?: string
  prochaine_revision?: string
  entretien_budget_annuel?: number
  duree_amortissement_annees?: number
  notes?: string
  created_at?: string
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const CATEGORIES = [
  { value: 'electroportatif', label: 'Électroportatif' },
  { value: 'echafaudage', label: 'Échafaudage' },
  { value: 'vehicule', label: 'Véhicule' },
  { value: 'epi', label: 'EPI' },
  { value: 'gros_outillage', label: 'Gros outillage' },
  { value: 'autre', label: 'Autre' },
]

const ETATS = [
  { value: 'neuf', label: 'Neuf', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'bon', label: 'Bon', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'use', label: 'Usé', color: 'bg-amber-100 text-amber-700' },
  { value: 'hs', label: 'HS', color: 'bg-red-100 text-red-700' },
]

const MODES_ACQUISITION = [
  { value: 'comptant', label: 'Comptant' },
  { value: 'credit', label: 'Crédit' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'lld', label: 'LLD' },
]

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatCurrency(value?: number): string {
  if (!value) return '0 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(date?: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR')
}

function getDaysDiff(dateString?: string): number {
  if (!dateString) return Infinity
  const target = new Date(dateString)
  const today = new Date()
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getEtatColor(etat: string): string {
  const e = ETATS.find((x) => x.value === etat)
  return e?.color || 'bg-gray-100 text-gray-700'
}

function getRevisionStatus(prochaine_revision?: string): { status: 'alerte' | 'attention' | 'ok'; label: string } {
  const days = getDaysDiff(prochaine_revision)
  if (days < 0) return { status: 'alerte', label: 'Révision dépassée' }
  if (days <= 30) return { status: 'alerte', label: `Dans ${days}j` }
  if (days <= 60) return { status: 'attention', label: `Dans ${days}j` }
  return { status: 'ok', label: formatDate(prochaine_revision) }
}

function getCoutMensuel(item: Materiel): number {
  const credit = item.credit_mensualite || 0
  const assurance = item.assurance_mensualite || 0
  const entretien = (item.entretien_budget_annuel || 0) / 12
  return credit + assurance + entretien
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function MaterialPage() {
  const [search, setSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('tous')
  const [filterEtat, setFilterEtat] = useState('tous')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: materielData, loading, error, refetch } = useMateriel()
  const allMateriel = (materielData as unknown as Materiel[])

  // Calculate stats
  const totalEquipements = allMateriel.length
  const totalValeur = allMateriel.reduce((sum, m) => sum + (m.valeur_achat || 0), 0)
  const coutMensuelRecurrent = allMateriel.reduce((sum, m) => sum + getCoutMensuel(m), 0)
  const alertes = allMateriel.filter((m) => {
    const revisionDays = getDaysDiff(m.prochaine_revision)
    const assuranceDays = getDaysDiff(m.assurance_echeance)
    return revisionDays < 30 || assuranceDays < 30
  }).length

  // Apply filters
  const filtered = allMateriel.filter((m) => {
    if (filterCategorie !== 'tous' && m.categorie !== filterCategorie) return false
    if (filterEtat !== 'tous' && m.etat !== filterEtat) return false
    if (search) {
      const q = search.toLowerCase()
      return m.designation.toLowerCase().includes(q) || (m.numero_serie?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  // Form state
  const [form, setForm] = useState({
    designation: '',
    categorie: 'electroportatif',
    numero_serie: '',
    valeur_achat: '',
    date_achat: '',
    etat: 'bon',
    localisation: '',
    mode_acquisition: 'comptant',
    credit_montant_total: '',
    credit_mensualite: '',
    credit_duree_mois: '',
    credit_date_fin: '',
    credit_banque: '',
    assurance_mensualite: '',
    assurance_compagnie: '',
    assurance_numero_police: '',
    assurance_echeance: '',
    prochaine_revision: '',
    entretien_budget_annuel: '',
    duree_amortissement_annees: '',
    notes: '',
  })

  const [expandedSections, setExpandedSections] = useState({
    identification: true,
    financement: false,
    assurance: false,
    notes: false,
  })

  const resetForm = () => {
    setForm({
      designation: '',
      categorie: 'electroportatif',
      numero_serie: '',
      valeur_achat: '',
      date_achat: '',
      etat: 'bon',
      localisation: '',
      mode_acquisition: 'comptant',
      credit_montant_total: '',
      credit_mensualite: '',
      credit_duree_mois: '',
      credit_date_fin: '',
      credit_banque: '',
      assurance_mensualite: '',
      assurance_compagnie: '',
      assurance_numero_police: '',
      assurance_echeance: '',
      prochaine_revision: '',
      entretien_budget_annuel: '',
      duree_amortissement_annees: '',
      notes: '',
    })
    setExpandedSections({ identification: true, financement: false, assurance: false, notes: false })
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleOpenModal = (materiel?: Materiel) => {
    if (materiel) {
      setEditingId(materiel.id)
      setForm({
        designation: materiel.designation || '',
        categorie: materiel.categorie || 'electroportatif',
        numero_serie: materiel.numero_serie || '',
        valeur_achat: materiel.valeur_achat?.toString() || '',
        date_achat: materiel.date_achat || '',
        etat: materiel.etat || 'bon',
        localisation: materiel.localisation || '',
        mode_acquisition: materiel.mode_acquisition || 'comptant',
        credit_montant_total: materiel.credit_montant_total?.toString() || '',
        credit_mensualite: materiel.credit_mensualite?.toString() || '',
        credit_duree_mois: materiel.credit_duree_mois?.toString() || '',
        credit_date_fin: materiel.credit_date_fin || '',
        credit_banque: materiel.credit_banque || '',
        assurance_mensualite: materiel.assurance_mensualite?.toString() || '',
        assurance_compagnie: materiel.assurance_compagnie || '',
        assurance_numero_police: materiel.assurance_numero_police || '',
        assurance_echeance: materiel.assurance_echeance || '',
        prochaine_revision: materiel.prochaine_revision || '',
        entretien_budget_annuel: materiel.entretien_budget_annuel?.toString() || '',
        duree_amortissement_annees: materiel.duree_amortissement_annees?.toString() || '',
        notes: materiel.notes || '',
      })
    } else {
      resetForm()
      setEditingId(null)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!form.designation.trim()) {
      alert('La désignation est requise')
      return
    }

    setSaving(true)
    try {
      const values: Record<string, unknown> = {
        designation: form.designation,
        categorie: form.categorie,
        numero_serie: form.numero_serie || null,
        valeur_achat: form.valeur_achat ? parseFloat(form.valeur_achat) : null,
        date_achat: form.date_achat || null,
        etat: form.etat,
        localisation: form.localisation || null,
        mode_acquisition: form.mode_acquisition,
        credit_montant_total: form.credit_montant_total ? parseFloat(form.credit_montant_total) : null,
        credit_mensualite: form.credit_mensualite ? parseFloat(form.credit_mensualite) : null,
        credit_duree_mois: form.credit_duree_mois ? parseInt(form.credit_duree_mois) : null,
        credit_date_fin: form.credit_date_fin || null,
        credit_banque: form.credit_banque || null,
        assurance_mensualite: form.assurance_mensualite ? parseFloat(form.assurance_mensualite) : null,
        assurance_compagnie: form.assurance_compagnie || null,
        assurance_numero_police: form.assurance_numero_police || null,
        assurance_echeance: form.assurance_echeance || null,
        prochaine_revision: form.prochaine_revision || null,
        entretien_budget_annuel: form.entretien_budget_annuel ? parseFloat(form.entretien_budget_annuel) : null,
        duree_amortissement_annees: form.duree_amortissement_annees ? parseInt(form.duree_amortissement_annees) : null,
        notes: form.notes || null,
      }

      if (editingId) {
        await updateRow('materiel', editingId, values)
      } else {
        await insertRow('materiel', values)
      }

      await refetch()
      handleCloseModal()
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : 'Impossible de sauvegarder'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow('materiel', id)
      await refetch()
      setDeleteConfirm(null)
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : 'Impossible de supprimer'}`)
    }
  }

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorBanner message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wrench size={24} className="text-[#0f1a3a]" />
          <h1 className="text-2xl font-syne font-bold text-[#1a1a2e]">Matériel</h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 h-11 rounded-lg bg-[#f59e0b] hover:bg-[#f09050] text-white font-syne font-bold transition-colors duration-100"
        >
          <Plus size={20} />
          <span>Ajouter un équipement</span>
        </button>
      </div>

      {/* ---- Bandeau stats ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-4">
          <p className="text-xs text-[#6b7280] font-manrope mb-1">Total équipements</p>
          <p className="text-2xl font-syne font-bold text-[#1a1a2e]">{totalEquipements}</p>
        </div>
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-4">
          <p className="text-xs text-[#6b7280] font-manrope mb-1">Valeur du parc</p>
          <p className="text-lg font-syne font-bold text-[#1a1a2e] truncate">{formatCurrency(totalValeur)}</p>
        </div>
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-4">
          <p className="text-xs text-[#6b7280] font-manrope mb-1">Coût mensuel</p>
          <p className="text-lg font-syne font-bold text-[#1a1a2e] truncate">{formatCurrency(coutMensuelRecurrent)}</p>
        </div>
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-4">
          <p className="text-xs text-[#6b7280] font-manrope mb-1">Alertes</p>
          <div className="flex items-center gap-1">
            {alertes > 0 && <AlertTriangle size={16} className="text-red-500" />}
            <p className={`text-2xl font-syne font-bold ${alertes > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {alertes}
            </p>
          </div>
        </div>
      </div>

      {/* ---- Filtres ---- */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-xl border border-[#e5e7eb] p-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] z-10" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          containerClassName="sm:w-auto"
        >
          <option value="tous">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select
          value={filterEtat}
          onChange={(e) => setFilterEtat(e.target.value)}
          containerClassName="sm:w-auto"
        >
          <option value="tous">Tous états</option>
          {ETATS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </Select>
      </div>

      {/* ---- Tableau desktop (hidden sm:block) ---- */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Désignation</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Catégorie</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">État</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Localisation</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Prochaine révision</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Coût mensuel</th>
                <th className="text-left px-4 py-3 text-xs font-syne font-bold text-[#1a1a2e]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#6b7280]">
                    Aucun équipement trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const revStatus = getRevisionStatus(m.prochaine_revision)
                  return (
                    <tr key={m.id} className="border-b border-[#e5e7eb] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-syne font-bold text-[#1a1a2e]">{m.designation}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-manrope">
                          {CATEGORIES.find((c) => c.value === m.categorie)?.label || m.categorie}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-manrope ${getEtatColor(m.etat)}`}>
                          {ETATS.find((e) => e.value === m.etat)?.label || m.etat}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6b7280]">{m.localisation || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {revStatus.status === 'alerte' && <AlertTriangle size={14} className="text-red-500" />}
                          {revStatus.status === 'attention' && <AlertTriangle size={14} className="text-amber-500" />}
                          <span
                            className={`text-sm font-manrope ${
                              revStatus.status === 'alerte'
                                ? 'text-red-600 font-semibold'
                                : revStatus.status === 'attention'
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-[#6b7280]'
                            }`}
                          >
                            {revStatus.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-manrope text-[#1a1a2e]">{formatCurrency(getCoutMensuel(m))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(m)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#5ab4e0] transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Cards mobile (sm:hidden) ---- */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#6b7280]">Aucun équipement trouvé</div>
        ) : (
          filtered.map((m) => {
            const revStatus = getRevisionStatus(m.prochaine_revision)
            return (
              <div key={m.id} className="bg-white rounded-xl border border-[#e5e7eb] p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-syne font-bold text-[#1a1a2e]">{m.designation}</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-manrope ${getEtatColor(m.etat)}`}>
                      {ETATS.find((e) => e.value === m.etat)?.label || m.etat}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenModal(m)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-[#5ab4e0] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(m.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#6b7280] font-manrope">
                  {CATEGORIES.find((c) => c.value === m.categorie)?.label || m.categorie} ·{' '}
                  {m.localisation || '-'}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[#e5e7eb]">
                  <div>
                    <p className="text-xs text-[#6b7280] font-manrope mb-1">Coût mensuel</p>
                    <p className="font-syne font-bold text-[#1a1a2e]">{formatCurrency(getCoutMensuel(m))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6b7280] font-manrope mb-1">Révision</p>
                    <div className="flex items-center gap-1 justify-end">
                      {revStatus.status === 'alerte' && <AlertTriangle size={14} className="text-red-500" />}
                      {revStatus.status === 'attention' && <AlertTriangle size={14} className="text-amber-500" />}
                      <span
                        className={`text-xs font-manrope font-semibold ${
                          revStatus.status === 'alerte'
                            ? 'text-red-600'
                            : revStatus.status === 'attention'
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }`}
                      >
                        {revStatus.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ---- Modal Ajouter/Éditer ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="sticky top-0 bg-white border-b border-[#e5e7eb] px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-syne font-bold text-[#1a1a2e]">
                {editingId ? 'Modifier l\'équipement' : 'Ajouter un équipement'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6b7280] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal content */}
            <div className="px-6 py-6 space-y-4">
              {/* Bloc 1 — Identification (ouvert par défaut) */}
              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('identification')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-syne font-bold text-[#1a1a2e]">Identification</span>
                  <ChevronDown
                    size={20}
                    className={`text-[#6b7280] transition-transform ${expandedSections.identification ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.identification && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <Input
                      label="Désignation *"
                      type="text"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      placeholder="Ex: Perceuse-visseuse Makita"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label="Catégorie *"
                        value={form.categorie}
                        onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="N° série / Immatriculation"
                        type="text"
                        value={form.numero_serie}
                        onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                        placeholder="Ex: 123456789"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label="État"
                        value={form.etat}
                        onChange={(e) => setForm({ ...form, etat: e.target.value })}
                      >
                        {ETATS.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Localisation"
                        type="text"
                        value={form.localisation}
                        onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                        placeholder="Ex: Dépôt principal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Date d'achat"
                        type="date"
                        value={form.date_achat}
                        onChange={(e) => setForm({ ...form, date_achat: e.target.value })}
                      />
                      <Input
                        label="Valeur d'achat (€)"
                        type="number"
                        step="0.01"
                        value={form.valeur_achat}
                        onChange={(e) => setForm({ ...form, valeur_achat: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bloc 2 — Financement */}
              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('financement')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-syne font-bold text-[#1a1a2e]">Financement</span>
                  <ChevronDown
                    size={20}
                    className={`text-[#6b7280] transition-transform ${expandedSections.financement ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.financement && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <div>
                      <label className="block text-sm font-manrope text-[#1a1a2e] mb-2">Mode d'acquisition</label>
                      <div className="space-y-2">
                        {MODES_ACQUISITION.map((m) => (
                          <label key={m.value} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="mode_acquisition"
                              value={m.value}
                              checked={form.mode_acquisition === m.value}
                              onChange={(e) => setForm({ ...form, mode_acquisition: e.target.value })}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-[#1a1a2e] font-manrope">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {['credit', 'leasing', 'lld'].includes(form.mode_acquisition) && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="Montant total (€)"
                            type="number"
                            step="0.01"
                            value={form.credit_montant_total}
                            onChange={(e) => setForm({ ...form, credit_montant_total: e.target.value })}
                            placeholder="0.00"
                          />
                          <Input
                            label="Mensualité (€)"
                            type="number"
                            step="0.01"
                            value={form.credit_mensualite}
                            onChange={(e) => setForm({ ...form, credit_mensualite: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="Durée (mois)"
                            type="number"
                            value={form.credit_duree_mois}
                            onChange={(e) => setForm({ ...form, credit_duree_mois: e.target.value })}
                            placeholder="0"
                          />
                          <Input
                            label="Date de fin"
                            type="date"
                            value={form.credit_date_fin}
                            onChange={(e) => setForm({ ...form, credit_date_fin: e.target.value })}
                          />
                        </div>
                        <Input
                          label="Banque / Organisme"
                          type="text"
                          value={form.credit_banque}
                          onChange={(e) => setForm({ ...form, credit_banque: e.target.value })}
                          placeholder="Ex: Société Générale"
                        />
                      </>
                    )}

                    <div className="pt-2 border-t border-[#e5e7eb]">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 font-manrope">
                        Durée d'amortissement (ans)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={form.duree_amortissement_annees}
                          onChange={(e) => setForm({ ...form, duree_amortissement_annees: e.target.value })}
                          placeholder="0"
                          containerClassName="w-24"
                        />
                        <span className="text-xs text-[#6b7280] font-manrope">
                          Recommandé: 5 ans (outillage), 4-5 ans (véhicule)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bloc 3 — Assurance & entretien */}
              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('assurance')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-syne font-bold text-[#1a1a2e]">Assurance & entretien</span>
                  <ChevronDown
                    size={20}
                    className={`text-[#6b7280] transition-transform ${expandedSections.assurance ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.assurance && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Mensualité assurance (€)"
                        type="number"
                        step="0.01"
                        value={form.assurance_mensualite}
                        onChange={(e) => setForm({ ...form, assurance_mensualite: e.target.value })}
                        placeholder="0.00"
                      />
                      <Input
                        label="Compagnie"
                        type="text"
                        value={form.assurance_compagnie}
                        onChange={(e) => setForm({ ...form, assurance_compagnie: e.target.value })}
                        placeholder="Ex: AXA"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="N° de police"
                        type="text"
                        value={form.assurance_numero_police}
                        onChange={(e) => setForm({ ...form, assurance_numero_police: e.target.value })}
                        placeholder="Numéro de police"
                      />
                      <Input
                        label="Échéance assurance"
                        type="date"
                        value={form.assurance_echeance}
                        onChange={(e) => setForm({ ...form, assurance_echeance: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#e5e7eb]">
                      <Input
                        label="Prochaine révision"
                        type="date"
                        value={form.prochaine_revision}
                        onChange={(e) => setForm({ ...form, prochaine_revision: e.target.value })}
                      />
                      <Input
                        label="Budget entretien annuel (€)"
                        type="number"
                        step="0.01"
                        value={form.entretien_budget_annuel}
                        onChange={(e) => setForm({ ...form, entretien_budget_annuel: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bloc 4 — Notes */}
              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('notes')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-syne font-bold text-[#1a1a2e]">Notes</span>
                  <ChevronDown
                    size={20}
                    className={`text-[#6b7280] transition-transform ${expandedSections.notes ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.notes && (
                  <div className="px-4 py-4 bg-white">
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Remarques, conditions particulières, etc."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-white px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="h-11 rounded-lg border border-[#e5e7eb] px-6 font-manrope font-medium text-[#1a1a2e] hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-11 rounded-lg bg-[#f59e0b] hover:bg-[#f09050] disabled:opacity-50 px-6 font-manrope font-medium text-white transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Confirmation suppression ---- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <p className="font-syne font-bold text-[#1a1a2e]">Supprimer cet équipement ?</p>
            <p className="text-sm text-[#6b7280] font-manrope">Cette action ne peut pas être annulée.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="h-10 rounded-lg border border-[#e5e7eb] px-4 font-manrope font-medium text-[#1a1a2e] hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="h-10 rounded-lg bg-red-500 hover:bg-red-600 px-4 font-manrope font-medium text-white transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
