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
  deleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

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
    } catch {
      // error handled silently
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow('fournisseurs', id)
      refetch()
    } catch {
      // error handled silently
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
      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href="/dashboard/clients"
          className="px-4 py-2.5 text-sm font-syne font-bold text-[#6b7280] hover:text-[#1a1a2e] border-b-2 border-transparent -mb-px transition-colors"
        >
          Clients
        </Link>
        <Link
          href="/dashboard/fournisseurs"
          className="px-4 py-2.5 text-sm font-syne font-bold text-[#0f1a3a] border-b-2 border-[#5ab4e0] -mb-px"
        >
          Fournisseurs
        </Link>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Rechercher un fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* New supplier button */}
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouveau fournisseur
        </button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          filtered.map((fournisseur) => (
            <div
              key={fournisseur.id}
              className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-manrope font-bold text-[#1a1a2e] truncate">{fournisseur.nom}</p>
                  <p className="text-xs font-manrope text-gray-500 truncate">{fournisseur.contact}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(fournisseur)
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#5ab4e0] hover:bg-blue-50 transition-colors"
                    title="Modifier"
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
                        className="px-2 py-1 rounded bg-red-500 text-white text-xs font-syne font-bold hover:bg-red-600 transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(null)
                        }}
                        className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-xs font-syne font-bold hover:bg-gray-300 transition-colors"
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
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs font-manrope text-gray-500 space-y-0.5">
                {fournisseur.email && <p>{fournisseur.email}</p>}
                {fournisseur.telephone && <p>{fournisseur.telephone}</p>}
                {fournisseur.ville && <p>{fournisseur.ville}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gray-50">
              {['Nom', 'Contact', 'Email', 'Téléphone', 'Ville', 'SIRET', ''].map((col, i) => (
                <th
                  key={`${col}-${i}`}
                  className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((fournisseur, idx) => (
              <tr
                key={fournisseur.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">
                  {fournisseur.nom}
                </td>
                <td className="px-4 py-3 text-sm font-manrope text-gray-600">{fournisseur.contact}</td>
                <td className="px-4 py-3 text-sm font-manrope text-gray-600">{fournisseur.email}</td>
                <td className="px-4 py-3 text-sm font-manrope text-gray-600">{fournisseur.telephone}</td>
                <td className="px-4 py-3 text-sm font-manrope text-gray-600">{fournisseur.ville}</td>
                <td className="px-4 py-3 text-sm font-manrope text-gray-600">{fournisseur.siret}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(fournisseur)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#5ab4e0] hover:bg-blue-50 transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    {deleteConfirm === fournisseur.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(fournisseur.id)}
                          className="px-2 py-1 rounded bg-red-500 text-white text-xs font-syne font-bold hover:bg-red-600 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-xs font-syne font-bold hover:bg-gray-300 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(fournisseur.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Supprimer"
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
            <p className="text-sm font-manrope text-gray-500">Aucun fournisseur trouvé</p>
          </div>
        )}
      </div>

      {/* Modal: Nouveau / Modifier fournisseur */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">
                {editId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <Input
              label="Nom"
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contact"
                type="text"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Téléphone"
                type="text"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
              <Input
                label="SIRET"
                type="text"
                value={form.siret}
                onChange={(e) => setForm({ ...form, siret: e.target.value })}
              />
            </div>

            <Input
              label="Adresse"
              type="text"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Code postal"
                type="text"
                value={form.code_postal}
                onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
              />
              <Input
                label="Ville"
                type="text"
                value={form.ville}
                onChange={(e) => setForm({ ...form, ville: e.target.value })}
              />
            </div>

            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="h-10 px-5 rounded-lg border border-gray-200 text-sm font-syne font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nom}
                className="h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
