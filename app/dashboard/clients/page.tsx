'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Users,
  Plus,
  X,
} from 'lucide-react'
import { useClients, insertRow, updateRow, deleteRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface ClientRow {
  id: string
  type: 'particulier' | 'professionnel'
  prenom: string
  nom: string
  raison_sociale: string | null
  email: string
  telephone: string
  adresse: string
  code_postal: string
  ville: string
  siret: string | null
  notes_internes: string | null
  actif: boolean
  created_at: string
}

const FILTER_OPTIONS = ['Tous', 'Particuliers', 'Professionnels', 'Archivés']

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function ClientsPage() {
  const router = useRouter()
  const { data, loading, error, refetch } = useClients()
  const clients = data as unknown as ClientRow[]

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tous')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // New client form state
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [form, setForm] = useState({
    type: 'particulier' as 'particulier' | 'professionnel',
    prenom: '',
    nom: '',
    raison_sociale: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    siret: '',
    notes_internes: '',
  })

  const resetForm = () => {
    setForm({
      type: 'particulier',
      prenom: '',
      nom: '',
      raison_sociale: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      siret: '',
      notes_internes: '',
    })
    setFormError(null)
  }

  const handleCreate = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const values: Record<string, unknown> = {
        type: form.type,
        prenom: form.prenom,
        nom: form.nom,
        email: form.email || null,
        telephone: form.telephone || null,
        adresse: form.adresse || null,
        code_postal: form.code_postal || null,
        ville: form.ville || null,
        siret: form.siret || null,
        notes_internes: form.notes_internes || null,
        actif: true,
      }
      if (form.type === 'professionnel') {
        values.raison_sociale = form.raison_sociale || null
      }
      await insertRow('clients', values)
      setShowModal(false)
      resetForm()
      refetch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (client: ClientRow) => {
    setEditingClient(client)
    setForm({
      type: client.type,
      prenom: client.prenom,
      nom: client.nom,
      raison_sociale: client.raison_sociale || '',
      email: client.email,
      telephone: client.telephone,
      adresse: client.adresse,
      code_postal: client.code_postal,
      ville: client.ville,
      siret: client.siret || '',
      notes_internes: client.notes_internes || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const values: Record<string, unknown> = {
        type: form.type,
        prenom: form.prenom,
        nom: form.nom,
        email: form.email || null,
        telephone: form.telephone || null,
        adresse: form.adresse || null,
        code_postal: form.code_postal || null,
        ville: form.ville || null,
        siret: form.siret || null,
        notes_internes: form.notes_internes || null,
      }
      if (form.type === 'professionnel') {
        values.raison_sociale = form.raison_sociale || null
      }
      if (editingClient) {
        await updateRow('clients', editingClient.id, values)
      } else {
        values.actif = true
        await insertRow('clients', values)
      }
      setShowModal(false)
      setEditingClient(null)
      resetForm()
      refetch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, displayName: string) => {
    if (!confirm(`Supprimer le client "${displayName}" ? Cette action est irréversible.`)) return
    try {
      await deleteRow('clients', id)
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const displayName = (c: ClientRow) =>
    c.type === 'professionnel' && c.raison_sociale
      ? c.raison_sociale
      : `${c.prenom ? c.prenom + ' ' : ''}${c.nom}`.trim()

  const filtered = clients.filter((c) => {
    if (filter === 'Particuliers' && c.type !== 'particulier') return false
    if (filter === 'Professionnels' && c.type !== 'professionnel') return false
    if (filter === 'Archivés') return !c.actif
    if (!c.actif) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        displayName(c).toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.telephone ?? '').includes(q)
      )
    }
    return true
  })

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href="/dashboard/clients"
          className="px-4 py-2.5 text-sm font-syne font-bold text-[#0f1a3a] border-b-2 border-[#5ab4e0] -mb-px"
        >
          Clients
        </Link>
        <Link
          href="/dashboard/fournisseurs"
          className="px-4 py-2.5 text-sm font-syne font-bold text-[#6b7280] hover:text-[#1a1a2e] border-b-2 border-transparent -mb-px transition-colors"
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
            placeholder="Rechercher un client..."
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

        {/* New client button */}
        <button
          onClick={() => { resetForm(); setEditingClient(null); setShowModal(true) }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <LoadingSkeleton rows={5} />}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Mobile cards (visible < md) */}
      {!loading && !error && (
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-manrope text-gray-500">Aucun client trouvé</p>
            </div>
          ) : (
            filtered.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {/* Avatar initiales */}
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-syne font-bold"
                  style={{background: client.type === 'professionnel' ? '#5ab4e0' : '#e87a2a'}}>
                  {displayName(client).charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-manrope font-semibold text-[#1a1a2e] truncate">{displayName(client)}</p>
                  <p className="text-xs font-manrope text-gray-500 truncate">{client.email || client.telephone || client.ville || '—'}</p>
                </div>
                {/* Badge type + actions */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-manrope font-medium ${
                    client.type === 'professionnel' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {client.type === 'professionnel' ? 'Pro' : 'Part.'}
                  </span>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditModal(client)} className="text-[#5ab4e0] text-xs font-medium">Modifier</button>
                    <button onClick={() => handleDelete(client.id, displayName(client))} className="text-red-500 text-xs font-medium">Sup.</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop table (visible ≥ md) */}
      {!loading && !error && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                {['Nom', 'Type', 'Email', 'Téléphone', 'Ville', 'Création', 'Actions'].map((col) => (
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
              {filtered.map((client, idx) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    idx % 2 === 1 ? 'bg-[#f8f9fa]' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-manrope font-semibold text-[#1a1a2e]">
                    {displayName(client)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${
                      client.type === 'professionnel'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {client.type === 'professionnel' ? 'Professionnel' : 'Particulier'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{client.email}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{client.telephone}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{client.ville}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{formatDate(client.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-manrope">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(client) }}
                        className="text-[#5ab4e0] hover:text-[#0f1a3a] text-xs font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(client.id, displayName(client)) }}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-manrope text-gray-500">Aucun client trouvé</p>
            </div>
          )}
        </div>
      )}

      {/* New client modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">{editingClient ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => { setShowModal(false); setEditingClient(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && <ErrorBanner message={formError} />}

              {/* Type */}
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'particulier' | 'professionnel' })}
              >
                <option value="particulier">Particulier</option>
                <option value="professionnel">Professionnel</option>
              </Select>

              {/* Raison sociale (pro only) */}
              {form.type === 'professionnel' && (
                <Input
                  label="Raison sociale"
                  type="text"
                  value={form.raison_sociale}
                  onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                />
              )}

              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Prénom"
                  type="text"
                  value={form.prenom}
                  onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                />
                <Input
                  label="Nom"
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                />
              </div>

              {/* Email / Téléphone */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  label="Téléphone"
                  type="text"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                />
              </div>

              {/* Adresse */}
              <Input
                label="Adresse"
                type="text"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />

              {/* Code postal / Ville */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* SIRET (pro) */}
              {form.type === 'professionnel' && (
                <Input
                  label="SIRET"
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                />
              )}

              {/* Notes */}
              <Textarea
                label="Notes internes"
                value={form.notes_internes}
                onChange={(e) => setForm({ ...form, notes_internes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => { setShowModal(false); setEditingClient(null) }}
                className="h-10 px-5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-syne font-bold text-[#1a1a2e] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nom}
                className="h-10 px-5 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {saving ? 'Enregistrement...' : editingClient ? 'Enregistrer' : 'Créer le client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
