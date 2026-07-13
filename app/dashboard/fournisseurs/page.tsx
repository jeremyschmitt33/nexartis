'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Truck,
  Plus,
  X,
  Trash2,
  Pencil,
} from 'lucide-react'
import {
  useFournisseurs,
  insertRow,
  updateRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { toast } from '@/lib/toast'
// V4 Light Premium — composants centralisés (cf. DESIGN_SYSTEM_V4.md).
import {
  PremiumInput,
  PremiumTextarea,
  PremiumButton,
} from '@/components/ui/v4'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Fournisseur {
  id: string
  user_id: string
  nom: string
  contact: string
  email: string
  telephone: string
  adresse: string
  code_postal: string
  ville: string
  siret: string
  notes: string
  actif: boolean
  created_at?: string
}

const EMPTY_FORM = {
  nom: '',
  contact: '',
  email: '',
  telephone: '',
  adresse: '',
  code_postal: '',
  ville: '',
  siret: '',
  notes: '',
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function FournisseursPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const { data: fournisseurs, loading, error, refetch } = useFournisseurs()

  const filtered = (fournisseurs as unknown as Fournisseur[]).filter((f) => {
    if (f.actif === false) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        f.nom.toLowerCase().includes(q) ||
        (f.contact || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
  }

  const openEdit = (f: Fournisseur) => {
    setForm({
      nom: f.nom || '',
      contact: f.contact || '',
      email: f.email || '',
      telephone: f.telephone || '',
      adresse: f.adresse || '',
      code_postal: f.code_postal || '',
      ville: f.ville || '',
      siret: f.siret || '',
      notes: f.notes || '',
    })
    setEditId(f.id)
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editId) {
        await updateRow('fournisseurs', editId, { ...form })
      } else {
        await insertRow('fournisseurs', { ...form, actif: true })
      }
      refetch()
      setShowModal(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await updateRow('fournisseurs', id, { actif: false })
      toast.success('Fournisseur archivé')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible')
    } finally {
      setDeleteConfirm(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ============ Sous-navigation Clients / Fournisseurs (V4) ============ */}
      <div className="flex gap-1 border-b border-[#0f1a3a]/[0.08]">
        <Link
          href="/dashboard/clients"
          className="px-4 py-2.5 text-sm font-hanken font-bold text-gray-500 hover:text-[#0f1a3a] border-b-2 border-transparent -mb-px transition-colors"
        >
          Clients
        </Link>
        <Link
          href="/dashboard/fournisseurs"
          className="px-4 py-2.5 text-sm font-hanken font-bold text-[#0f1a3a] border-b-2 border-[#ff7a1a] -mb-px"
        >
          Fournisseurs
        </Link>
      </div>

      {/* ============ Barre d'action — V4 ============ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur..."
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

        {/* CTA Nouveau fournisseur — bouton primaire V4 */}
        <PremiumButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => { resetForm(); setShowModal(true) }}
        >
          Nouveau fournisseur
        </PremiumButton>
      </div>

      {/* ============ Cartes mobile (< md) — V4 ============ */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-hanken text-gray-500">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          filtered.map((fournisseur) => (
            <div
              key={fournisseur.id}
              className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3
                         shadow-[0_4px_12px_rgba(15,26,58,0.04)]
                         hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,26,58,0.08)]
                         active:translate-y-0 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-hanken font-bold text-[#0f1a3a] truncate">{fournisseur.nom}</p>
                  <p className="text-xs font-hanken text-gray-500 truncate">{fournisseur.contact}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(fournisseur)
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#ff7a1a] hover:bg-[#ff7a1a]/10 transition-colors"
                    title="Modifier"
                    aria-label="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  {deleteConfirm === fournisseur.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(fournisseur.id)
                        }}
                        className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-hanken font-bold hover:bg-red-700 transition-colors"
                        title="Archiver ce fournisseur ? Il sera masqué de la liste."
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(null)
                        }}
                        className="px-2 py-1 rounded-lg bg-gray-200 text-gray-700 text-xs font-hanken font-bold hover:bg-gray-300 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(fournisseur.id)
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Archiver"
                      aria-label="Archiver"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {/* "Data" : email/tél/ville en mono pour lisibilité */}
              <div className="text-xs font-spline-mono font-medium text-gray-500 space-y-0.5 tracking-[0.3px]">
                {fournisseur.email && <p>{fournisseur.email}</p>}
                {fournisseur.telephone && <p>{fournisseur.telephone}</p>}
                {fournisseur.ville && <p className="font-hanken tracking-normal">{fournisseur.ville}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ============ Table desktop (≥ md) — V4 ============ */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-x-auto
                      shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
              {['Nom', 'Contact', 'Email', 'Téléphone', 'Ville', 'SIRET', ''].map((col, i) => (
                <th
                  key={`${col}-${i}`}
                  className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((fournisseur) => (
              <tr
                key={fournisseur.id}
                className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors"
              >
                <td className="px-4 py-3 text-sm font-hanken font-bold text-[#0f1a3a]">
                  {fournisseur.nom}
                </td>
                <td className="px-4 py-3 text-sm font-hanken text-gray-600">{fournisseur.contact}</td>
                <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{fournisseur.email}</td>
                <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{fournisseur.telephone}</td>
                <td className="px-4 py-3 text-sm font-hanken text-gray-600">{fournisseur.ville}</td>
                {/* SIRET en mono — c'est un identifiant légal "data" */}
                <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.5px]">{fournisseur.siret}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(fournisseur)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#ff7a1a] hover:bg-[#ff7a1a]/10 transition-colors"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    {deleteConfirm === fournisseur.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(fournisseur.id)}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-hanken font-bold hover:bg-red-700 transition-colors"
                          title="Archiver ce fournisseur ? Il sera masqué de la liste."
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 rounded-lg bg-gray-200 text-gray-700 text-xs font-hanken font-bold hover:bg-gray-300 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(fournisseur.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-hanken text-gray-500">Aucun fournisseur trouvé</p>
          </div>
        )}
      </div>

      {/* ============ Modale : nouveau / modifier fournisseur — V4 ============ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
            {/* Accent line orange V4 */}
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

            {/* Header sticky */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">
                {editId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps */}
            <div className="px-6 py-5 space-y-4">
              <PremiumInput
                label="Nom"
                type="text"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Contact"
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
                <PremiumInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  mono
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Téléphone"
                  type="text"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  mono
                />
                {/* SIRET — mono : identifiant légal "data" */}
                <PremiumInput
                  label="SIRET"
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                  mono
                  hint="14 chiffres"
                />
              </div>

              <PremiumInput
                label="Adresse"
                type="text"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Code postal"
                  type="text"
                  value={form.code_postal}
                  onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
                  mono
                />
                <PremiumInput
                  label="Ville"
                  type="text"
                  value={form.ville}
                  onChange={(e) => setForm({ ...form, ville: e.target.value })}
                />
              </div>

              <PremiumTextarea
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Footer sticky */}
            <div className="sticky bottom-0 bg-white border-t border-[#0f1a3a]/[0.06] px-6 py-4 flex justify-end gap-3">
              <PremiumButton
                variant="secondary"
                onClick={() => { setShowModal(false); resetForm() }}
              >
                Annuler
              </PremiumButton>
              <PremiumButton
                variant="primary"
                onClick={handleSave}
                disabled={saving || !form.nom}
                loading={saving}
              >
                {editId ? 'Mettre à jour' : 'Créer'}
              </PremiumButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
