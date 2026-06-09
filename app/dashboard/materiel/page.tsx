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
// V4 Light Premium — composants centralisés (cf. DESIGN_SYSTEM_V4.md).
import {
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumButton,
} from '@/components/ui/v4'

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
      {/* ============ Header de page — V4 ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Icône gradient orange V4 */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white inline-flex items-center justify-center shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0">
            <Wrench size={20} />
          </div>
          <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">Matériel</h1>
        </div>
        <PremiumButton
          variant="primary"
          icon={<Plus size={18} />}
          onClick={() => handleOpenModal()}
        >
          Ajouter un équipement
        </PremiumButton>
      </div>

      {/* ============ Bandeau stats — V4 ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-[#0f1a3a]/[0.06] p-4 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
          <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Total équipements</p>
          <p className="font-spline-mono font-semibold text-2xl text-[#0f1a3a]">{totalEquipements}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#0f1a3a]/[0.06] p-4 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
          <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Valeur du parc</p>
          <p className="font-spline-mono font-semibold text-lg text-[#0f1a3a] truncate">{formatCurrency(totalValeur)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#0f1a3a]/[0.06] p-4 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
          <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Coût mensuel</p>
          <p className="font-spline-mono font-semibold text-lg text-[#0f1a3a] truncate">{formatCurrency(coutMensuelRecurrent)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#0f1a3a]/[0.06] p-4 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
          <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Alertes</p>
          <div className="flex items-center gap-1.5">
            {alertes > 0 && <AlertTriangle size={16} className="text-red-500" />}
            <p className={`font-spline-mono font-semibold text-2xl ${alertes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {alertes}
            </p>
          </div>
        </div>
      </div>

      {/* ============ Filtres — V4 ============ */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-4 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
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
        <PremiumSelect
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="sm:w-auto"
        >
          <option value="tous">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </PremiumSelect>
        <PremiumSelect
          value={filterEtat}
          onChange={(e) => setFilterEtat(e.target.value)}
          className="sm:w-auto"
        >
          <option value="tous">Tous états</option>
          {ETATS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </PremiumSelect>
      </div>

      {/* ============ Table desktop (≥ sm) — V4 ============ */}
      <div className="hidden sm:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#0f1a3a]/[0.06] bg-[#fafbfc]">
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Désignation</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Catégorie</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">État</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Localisation</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Prochaine révision</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Coût mensuel</th>
                <th className="text-left px-4 py-3 text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-hanken text-gray-500">
                    Aucun équipement trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const revStatus = getRevisionStatus(m.prochaine_revision)
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors">
                      <td className="px-4 py-3 text-sm font-hanken font-bold text-[#0f1a3a]">{m.designation}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-hanken font-bold uppercase tracking-wider border border-gray-200/60">
                          {CATEGORIES.find((c) => c.value === m.categorie)?.label || m.categorie}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/* getEtatColor garde les tons sémantiques (neuf/bon emerald, usé amber, HS red) */}
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${getEtatColor(m.etat)}`}>
                          {ETATS.find((e) => e.value === m.etat)?.label || m.etat}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-hanken text-gray-600">{m.localisation || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {revStatus.status === 'alerte' && <AlertTriangle size={14} className="text-red-500" />}
                          {revStatus.status === 'attention' && <AlertTriangle size={14} className="text-amber-500" />}
                          <span
                            className={`text-[13px] font-spline-mono font-medium tracking-[0.3px] ${
                              revStatus.status === 'alerte'
                                ? 'text-red-600 font-semibold'
                                : revStatus.status === 'attention'
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-gray-600'
                            }`}
                          >
                            {revStatus.label}
                          </span>
                        </div>
                      </td>
                      {/* Coût mensuel en mono (montants €) */}
                      <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-[#0f1a3a] tracking-[0.3px]">{formatCurrency(getCoutMensuel(m))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenModal(m)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#ff7a1a] hover:bg-[#ff7a1a]/10 transition-colors"
                            title="Modifier"
                            aria-label="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(m.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                            aria-label="Supprimer"
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

      {/* ============ Cartes mobile (< sm) — V4 ============ */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 font-hanken text-gray-500">Aucun équipement trouvé</div>
        ) : (
          filtered.map((m) => {
            const revStatus = getRevisionStatus(m.prochaine_revision)
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-4 space-y-3 shadow-[0_4px_12px_rgba(15,26,58,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-hanken font-bold text-[#0f1a3a] truncate">{m.designation}</p>
                    <span className={`inline-flex items-center mt-1 px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${getEtatColor(m.etat)}`}>
                      {ETATS.find((e) => e.value === m.etat)?.label || m.etat}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenModal(m)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#ff7a1a] hover:bg-[#ff7a1a]/10 transition-colors"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(m.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-xs font-hanken text-gray-500">
                  {CATEGORIES.find((c) => c.value === m.categorie)?.label || m.categorie} ·{' '}
                  {m.localisation || '-'}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[#0f1a3a]/[0.06]">
                  <div>
                    <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Coût mensuel</p>
                    <p className="font-spline-mono font-semibold text-[#0f1a3a] tracking-[0.3px]">{formatCurrency(getCoutMensuel(m))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Révision</p>
                    <div className="flex items-center gap-1 justify-end">
                      {revStatus.status === 'alerte' && <AlertTriangle size={14} className="text-red-500" />}
                      {revStatus.status === 'attention' && <AlertTriangle size={14} className="text-amber-500" />}
                      <span
                        className={`text-xs font-spline-mono font-semibold tracking-[0.3px] ${
                          revStatus.status === 'alerte'
                            ? 'text-red-600'
                            : revStatus.status === 'attention'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
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

      {/* ============ Modale ajouter/éditer un équipement — V4 ============ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-hidden">
            {/* Accent line orange V4 */}
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

            {/* Header sticky */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">
                {editingId ? "Modifier l'équipement" : 'Ajouter un équipement'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps modal */}
            <div className="px-6 py-6 space-y-4">
              {/* === Bloc 1 — Identification (ouvert par défaut) === */}
              <div className="border border-[#0f1a3a]/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleSection('identification')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f3f4f6] transition-colors"
                >
                  <span className="font-hanken font-bold text-[#0f1a3a]">Identification</span>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transition-transform ${expandedSections.identification ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.identification && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <PremiumInput
                      label="Désignation *"
                      type="text"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      placeholder="Ex : Perceuse-visseuse Makita"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumSelect
                        label="Catégorie *"
                        value={form.categorie}
                        onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </PremiumSelect>
                      {/* N° série — mono (identifiant data) */}
                      <PremiumInput
                        label="N° série / Immatriculation"
                        type="text"
                        value={form.numero_serie}
                        onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                        placeholder="Ex : 123456789"
                        mono
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumSelect
                        label="État"
                        value={form.etat}
                        onChange={(e) => setForm({ ...form, etat: e.target.value })}
                      >
                        {ETATS.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </PremiumSelect>
                      <PremiumInput
                        label="Localisation"
                        type="text"
                        value={form.localisation}
                        onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                        placeholder="Ex : Dépôt principal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput
                        label="Date d'achat"
                        type="date"
                        value={form.date_achat}
                        onChange={(e) => setForm({ ...form, date_achat: e.target.value })}
                        mono
                      />
                      <PremiumInput
                        label="Valeur d'achat (€)"
                        type="number"
                        step="0.01"
                        value={form.valeur_achat}
                        onChange={(e) => setForm({ ...form, valeur_achat: e.target.value })}
                        placeholder="0.00"
                        mono
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* === Bloc 2 — Financement === */}
              <div className="border border-[#0f1a3a]/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleSection('financement')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f3f4f6] transition-colors"
                >
                  <span className="font-hanken font-bold text-[#0f1a3a]">Financement</span>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transition-transform ${expandedSections.financement ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.financement && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <div>
                      <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">Mode d'acquisition</label>
                      <div className="space-y-2">
                        {MODES_ACQUISITION.map((m) => (
                          <label key={m.value} className="flex items-center gap-3 cursor-pointer">
                            {/* Radios stylés orange V4 (accent-color) */}
                            <input
                              type="radio"
                              name="mode_acquisition"
                              value={m.value}
                              checked={form.mode_acquisition === m.value}
                              onChange={(e) => setForm({ ...form, mode_acquisition: e.target.value })}
                              className="w-4 h-4 accent-[#ff7a1a]"
                            />
                            <span className="text-sm text-[#0f1a3a] font-hanken">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {['credit', 'leasing', 'lld'].includes(form.mode_acquisition) && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <PremiumInput
                            label="Montant total (€)"
                            type="number"
                            step="0.01"
                            value={form.credit_montant_total}
                            onChange={(e) => setForm({ ...form, credit_montant_total: e.target.value })}
                            placeholder="0.00"
                            mono
                          />
                          <PremiumInput
                            label="Mensualité (€)"
                            type="number"
                            step="0.01"
                            value={form.credit_mensualite}
                            onChange={(e) => setForm({ ...form, credit_mensualite: e.target.value })}
                            placeholder="0.00"
                            mono
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <PremiumInput
                            label="Durée (mois)"
                            type="number"
                            value={form.credit_duree_mois}
                            onChange={(e) => setForm({ ...form, credit_duree_mois: e.target.value })}
                            placeholder="0"
                            mono
                          />
                          <PremiumInput
                            label="Date de fin"
                            type="date"
                            value={form.credit_date_fin}
                            onChange={(e) => setForm({ ...form, credit_date_fin: e.target.value })}
                            mono
                          />
                        </div>
                        <PremiumInput
                          label="Banque / Organisme"
                          type="text"
                          value={form.credit_banque}
                          onChange={(e) => setForm({ ...form, credit_banque: e.target.value })}
                          placeholder="Ex : Société Générale"
                        />
                      </>
                    )}

                    <div className="pt-3 border-t border-[#0f1a3a]/[0.06]">
                      <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
                        Durée d'amortissement (ans)
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <PremiumInput
                            type="number"
                            value={form.duree_amortissement_annees}
                            onChange={(e) => setForm({ ...form, duree_amortissement_annees: e.target.value })}
                            placeholder="0"
                            mono
                          />
                        </div>
                        <span className="text-xs font-hanken text-gray-500">
                          Recommandé : 5 ans (outillage), 4-5 ans (véhicule)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* === Bloc 3 — Assurance & entretien === */}
              <div className="border border-[#0f1a3a]/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleSection('assurance')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f3f4f6] transition-colors"
                >
                  <span className="font-hanken font-bold text-[#0f1a3a]">Assurance & entretien</span>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transition-transform ${expandedSections.assurance ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.assurance && (
                  <div className="px-4 py-4 space-y-4 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput
                        label="Mensualité assurance (€)"
                        type="number"
                        step="0.01"
                        value={form.assurance_mensualite}
                        onChange={(e) => setForm({ ...form, assurance_mensualite: e.target.value })}
                        placeholder="0.00"
                        mono
                      />
                      <PremiumInput
                        label="Compagnie"
                        type="text"
                        value={form.assurance_compagnie}
                        onChange={(e) => setForm({ ...form, assurance_compagnie: e.target.value })}
                        placeholder="Ex : AXA"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput
                        label="N° de police"
                        type="text"
                        value={form.assurance_numero_police}
                        onChange={(e) => setForm({ ...form, assurance_numero_police: e.target.value })}
                        placeholder="Numéro de police"
                        mono
                      />
                      <PremiumInput
                        label="Échéance assurance"
                        type="date"
                        value={form.assurance_echeance}
                        onChange={(e) => setForm({ ...form, assurance_echeance: e.target.value })}
                        mono
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#0f1a3a]/[0.06]">
                      <PremiumInput
                        label="Prochaine révision"
                        type="date"
                        value={form.prochaine_revision}
                        onChange={(e) => setForm({ ...form, prochaine_revision: e.target.value })}
                        mono
                      />
                      <PremiumInput
                        label="Budget entretien annuel (€)"
                        type="number"
                        step="0.01"
                        value={form.entretien_budget_annuel}
                        onChange={(e) => setForm({ ...form, entretien_budget_annuel: e.target.value })}
                        placeholder="0.00"
                        mono
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* === Bloc 4 — Notes === */}
              <div className="border border-[#0f1a3a]/[0.06] rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleSection('notes')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f3f4f6] transition-colors"
                >
                  <span className="font-hanken font-bold text-[#0f1a3a]">Notes</span>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transition-transform ${expandedSections.notes ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.notes && (
                  <div className="px-4 py-4 bg-white">
                    <PremiumTextarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Remarques, conditions particulières, etc."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer sticky */}
            <div className="sticky bottom-0 z-10 border-t border-[#0f1a3a]/[0.06] bg-white px-6 py-4 flex items-center justify-end gap-3">
              <PremiumButton
                variant="secondary"
                onClick={handleCloseModal}
              >
                Annuler
              </PremiumButton>
              <PremiumButton
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                loading={saving}
              >
                Enregistrer
              </PremiumButton>
            </div>
          </div>
        </div>
      )}

      {/* ============ Confirmation suppression — V4 ============ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4 overflow-hidden">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-400 via-red-500 to-red-400 opacity-90" />
            <p className="font-hanken font-extrabold text-lg text-[#0f1a3a] tracking-[-0.02em]">Supprimer cet équipement ?</p>
            <p className="text-sm font-hanken text-gray-500">Cette action ne peut pas être annulée.</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <PremiumButton
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Annuler
              </PremiumButton>
              {/* Bouton danger inline — pas dans le composant V4 partagé pour l'instant */}
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="inline-flex items-center justify-center gap-2 h-[52px] px-9 rounded-[14px] bg-red-600 hover:bg-red-700 text-white font-hanken font-bold text-[15px] shadow-[0_4px_12px_rgba(220,38,38,0.25)] transition-all duration-200"
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
