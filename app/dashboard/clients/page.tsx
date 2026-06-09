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
// V4 Light Premium — refonte visuelle (logique métier inchangée).
// Composants partagés depuis /components/ui/v4 (cf. DESIGN_SYSTEM_V4.md).
import {
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumButton,
} from '@/components/ui/v4'

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
      {/* ============ Sous-navigation Clients / Fournisseurs (V4) ============ */}
      {/* Onglet actif : ligne orange (couleur signature V4) au lieu du bleu sky legacy. */}
      <div className="flex gap-1 border-b border-[#0f1a3a]/[0.08]">
        <Link
          href="/dashboard/clients"
          className="px-4 py-2.5 text-sm font-hanken font-bold text-[#0f1a3a] border-b-2 border-[#ff7a1a] -mb-px"
        >
          Clients
        </Link>
        <Link
          href="/dashboard/fournisseurs"
          className="px-4 py-2.5 text-sm font-hanken font-bold text-gray-500 hover:text-[#0f1a3a] border-b-2 border-transparent -mb-px transition-colors"
        >
          Fournisseurs
        </Link>
      </div>

      {/* ============ Barre d'action : recherche + filtre + CTA (V4) ============ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Recherche — input V4 avec icône inline */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <input
            type="text"
            placeholder="Rechercher un client..."
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

        {/* Filtre — select V4 */}
        <PremiumSelect
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="sm:w-auto"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </PremiumSelect>

        {/* CTA Nouveau client — bouton primaire V4 (gradient orange) */}
        <PremiumButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => { resetForm(); setEditingClient(null); setShowModal(true) }}
        >
          Nouveau client
        </PremiumButton>
      </div>

      {/* Loading / Error */}
      {loading && <LoadingSkeleton rows={5} />}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* ============ Cartes mobile (< md) — V4 light ============ */}
      {!loading && !error && (
        <div className="md:hidden space-y-2.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-hanken text-gray-500">Aucun client trouvé</p>
            </div>
          ) : (
            filtered.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3 flex items-center gap-3 cursor-pointer
                           shadow-[0_4px_12px_rgba(15,26,58,0.04)]
                           hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,26,58,0.08)] active:translate-y-0
                           transition-all duration-200"
              >
                {/* Avatar initiales — gradient orange (pro) / gris navy (particulier) */}
                <div
                  className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-hanken font-extrabold
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${
                                client.type === 'professionnel'
                                  ? 'bg-gradient-to-br from-[#0f1a3a] to-[#1d2e5e] shadow-[0_4px_12px_rgba(15,26,58,0.25)]'
                                  : 'bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] shadow-[0_4px_12px_rgba(255,122,26,0.25)]'
                              }`}
                >
                  {displayName(client).charAt(0).toUpperCase()}
                </div>
                {/* Info — coordonnées en mono pour côté "data" */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-hanken font-bold text-[#0f1a3a] truncate">{displayName(client)}</p>
                  <p className="text-xs font-spline-mono font-medium text-gray-500 truncate tracking-[0.3px]">
                    {client.email || client.telephone || client.ville || '—'}
                  </p>
                </div>
                {/* Badge type + actions */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${
                    client.type === 'professionnel'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                      : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                  }`}>
                    {client.type === 'professionnel' ? 'Pro' : 'Part.'}
                  </span>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditModal(client)} className="text-[#ff7a1a] text-xs font-hanken font-semibold hover:underline">Modifier</button>
                    <button onClick={() => handleDelete(client.id, displayName(client))} className="text-red-500 text-xs font-hanken font-semibold hover:underline">Sup.</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============ Table desktop (≥ md) — V4 light ============ */}
      {!loading && !error && (
        <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-x-auto
                        shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
                {['Nom', 'Type', 'Email', 'Téléphone', 'Ville', 'Création', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  className="border-b border-gray-100 hover:bg-[#fafbfc] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-hanken font-bold text-[#0f1a3a]">
                    {displayName(client)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${
                      client.type === 'professionnel'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                    }`}>
                      {client.type === 'professionnel' ? 'Professionnel' : 'Particulier'}
                    </span>
                  </td>
                  {/* Email + tél en font-spline-mono : "data" lisible */}
                  <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{client.email}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{client.telephone}</td>
                  <td className="px-4 py-3 text-sm font-hanken text-gray-600">{client.ville}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{formatDate(client.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-hanken">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(client) }}
                        className="text-[#ff7a1a] hover:underline text-xs font-hanken font-semibold"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(client.id, displayName(client)) }}
                        className="text-red-600 hover:underline text-xs font-hanken font-semibold"
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
              <p className="text-sm font-hanken text-gray-500">Aucun client trouvé</p>
            </div>
          )}
        </div>
      )}

      {/* ============ Modale création / édition client — V4 light ============ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
            {/* Accent line orange — signature V4 */}
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

            {/* Header sticky */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingClient(null) }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps du formulaire */}
            <div className="px-6 py-5 space-y-4">
              {formError && <ErrorBanner message={formError} />}

              {/* Type — select V4 */}
              <PremiumSelect
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'particulier' | 'professionnel' })}
              >
                <option value="particulier">Particulier</option>
                <option value="professionnel">Professionnel</option>
              </PremiumSelect>

              {/* Raison sociale (pro uniquement) */}
              {form.type === 'professionnel' && (
                <PremiumInput
                  label="Raison sociale"
                  type="text"
                  value={form.raison_sociale}
                  onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                />
              )}

              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Prénom"
                  type="text"
                  value={form.prenom}
                  onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                />
                <PremiumInput
                  label="Nom"
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                />
              </div>

              {/* Email / Téléphone — "data" en mono */}
              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  mono
                />
                <PremiumInput
                  label="Téléphone"
                  type="text"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  mono
                />
              </div>

              {/* Adresse */}
              <PremiumInput
                label="Adresse"
                type="text"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />

              {/* Code postal / Ville */}
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

              {/* SIRET (pro uniquement) — mono */}
              {form.type === 'professionnel' && (
                <PremiumInput
                  label="SIRET"
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                  mono
                  hint="14 chiffres (espaces tolérés)"
                />
              )}

              {/* Notes internes */}
              <PremiumTextarea
                label="Notes internes"
                value={form.notes_internes}
                onChange={(e) => setForm({ ...form, notes_internes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Footer sticky : actions */}
            <div className="sticky bottom-0 bg-white border-t border-[#0f1a3a]/[0.06] px-6 py-4 flex justify-end gap-3">
              <PremiumButton
                variant="secondary"
                onClick={() => { setShowModal(false); setEditingClient(null) }}
              >
                Annuler
              </PremiumButton>
              <PremiumButton
                variant="primary"
                onClick={handleSave}
                disabled={saving || !form.nom}
                loading={saving}
              >
                {editingClient ? 'Enregistrer' : 'Créer le client'}
              </PremiumButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
