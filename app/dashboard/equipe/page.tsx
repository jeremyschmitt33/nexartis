'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Users,
  Plus,
  X,
  Trash2,
  Pencil,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  useIntervenants,
  insertRow,
  updateRow,
  softDeleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Intervenant {
  id: string
  user_id: string
  prenom: string
  nom: string
  telephone: string
  email: string
  metier: string
  type_contrat: 'cdi' | 'cdd' | 'apprenti' | 'interimaire' | 'sous-traitant'
  taux_horaire: number
  niveau_acces: 'proprietaire' | 'compagnon'
  // Rôle métier — Session 13 V1 (29/05/2026) : liste fermée à 5 rôles
  // hiérarchiques : Apprenti, Ouvrier, Compagnon, Chef d'équipe, Dirigeant.
  // (Avant : 6 rôles avec "Conducteur de travaux" et "Assistant" supprimés
  // car redondants/obsolètes pour les TPE.)
  // Les anciennes valeurs en BDD restent rétrocompatibles : affichées en
  // lecture seule dans la table, mais non proposées dans les selects.
  // Distinct du `niveau_acces` (droits) et du `type_contrat` (CDI/CDD/...).
  role?: string | null
  couleur: string
  actif: boolean
  // Session 9 (28/05/2026) : marqueur de l'intervenant "self" (le dirigeant
  // lui-même). Session 13 V1 : on AFFICHE désormais le membre is_self dans
  // la page Mon équipe (avec un badge "Vous"), pour permettre de l'éditer
  // facilement (changer de membre "C'est moi", débrancher, etc.).
  is_self?: boolean
  created_at?: string
}

type IntervenantType = 'cdi' | 'cdd' | 'apprenti' | 'interimaire' | 'sous-traitant'
type FilterType = 'tous' | 'employe' | 'interimaire' | 'sous-traitant'

const CONTRAT_LABELS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  apprenti: 'Apprenti',
  interimaire: 'Interimaire',
  'sous-traitant': 'Sous-traitant',
}

const TYPE_LABELS: Record<string, string> = {
  employe: 'Employe',
  interimaire: 'Interimaire',
  'sous-traitant': 'Sous-traitant',
}

const TYPE_COLORS: Record<string, { badge: string; bg: string }> = {
  employe: { badge: '#5ab4e0', bg: 'bg-blue-100' },
  interimaire: { badge: '#f59e0b', bg: 'bg-amber-100' },
  'sous-traitant': { badge: '#10b981', bg: 'bg-emerald-100' },
}

const AVATAR_COLORS = [
  'bg-[#5ab4e0]',
  'bg-emerald-500',
  'bg-[#e87a2a]',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-indigo-500',
]

function getAvatarColor(couleur: string | null, id: string): string {
  if (couleur) return couleur
  const index = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function getTypeFromContrat(typeContrat: IntervenantType): FilterType {
  if (['cdi', 'cdd', 'apprenti'].includes(typeContrat)) return 'employe'
  if (typeContrat === 'interimaire') return 'interimaire'
  if (typeContrat === 'sous-traitant') return 'sous-traitant'
  return 'employe'
}

function formatEuro(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// -------------------------------------------------------------------
// Modal Historique
// -------------------------------------------------------------------

interface HistoriqueData {
  chantiers: Array<{ id: string; titre: string; statut: string; date_debut: string | null }>
  paiements: Array<{ id: string; montant_paye: number; statut: string; chantier_id: string }>
  totalPaye: number
}

function ModalHistorique({
  intervenant,
  onClose,
}: {
  intervenant: Intervenant
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<HistoriqueData>({ chantiers: [], paiements: [], totalPaye: 0 })

  const fetchHistorique = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('chantier_intervenants')
        .select('chantier_id')
        .eq('intervenant_id', intervenant.id)

      const chantierIds = (rows ?? []).map((r: Record<string, unknown>) => r.chantier_id as string)

      let chantiers: Array<{ id: string; titre: string; statut: string; date_debut: string | null }> = []
      if (chantierIds.length > 0) {
        const { data: chantiersData } = await supabase
          .from('chantiers')
          .select('id, titre, statut, date_debut')
          .in('id', chantierIds)
          .order('date_debut', { ascending: false })
        chantiers = (chantiersData ?? []) as typeof chantiers
      }

      let paiements: Array<{ id: string; montant_paye: number; statut: string; chantier_id: string }> = []
      let totalPaye = 0
      if (intervenant.type_contrat === 'sous-traitant') {
        const { data: paiData } = await supabase
          .from('sous_traitant_paiements')
          .select('id, montant_paye, statut, chantier_id')
          .eq('intervenant_id', intervenant.id)
        paiements = (paiData ?? []) as typeof paiements
        totalPaye = paiements
          .filter((p) => p.statut === 'paye')
          .reduce((sum, p) => sum + (Number(p.montant_paye) || 0), 0)
      }

      setData({ chantiers, paiements, totalPaye })
    } catch (err) {
      // D6 (2026-06-08) : on log l'erreur pour le debug + on affichera
      // un état vide dans le modal (les listes restent vides côté UI).
      console.error('[Équipe] fetchHistorique failed:', err)
    } finally {
      setLoading(false)
    }
  }, [intervenant.id, intervenant.type_contrat])

  useEffect(() => {
    fetchHistorique()
  }, [fetchHistorique])

  const isST = intervenant.type_contrat === 'sous-traitant'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">
            Historique &mdash; {intervenant.prenom} {intervenant.nom}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm font-manrope text-gray-500 text-center py-8">Chargement...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-syne font-bold text-[#0f1a3a] mb-2">
                Chantiers ({data.chantiers.length})
              </h3>
              {data.chantiers.length === 0 ? (
                <p className="text-xs font-manrope text-gray-400">Aucun chantier associe.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.chantiers.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm font-manrope">
                      <a
                        href={'/dashboard/chantiers/' + c.id}
                        className="text-[#5ab4e0] hover:underline truncate flex-1"
                      >
                        {c.titre || 'Chantier sans titre'}
                      </a>
                      <span className="ml-2 text-xs text-gray-400 flex-shrink-0">
                        {c.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : '--'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isST && (
              <div>
                <h3 className="text-sm font-syne font-bold text-[#0f1a3a] mb-2">
                  Paiements sous-traitant
                </h3>
                {data.paiements.length === 0 ? (
                  <p className="text-xs font-manrope text-gray-400">Aucun paiement enregistre.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.paiements.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm font-manrope">
                        <span className={p.statut === 'paye' ? 'text-emerald-600 font-semibold' : 'text-gray-500'}>
                          {formatEuro(Number(p.montant_paye) || 0)}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{p.statut}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.totalPaye > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-syne font-bold text-[#0f1a3a]">Total paye</span>
                    <span className="text-sm font-syne font-bold text-emerald-600">
                      {formatEuro(data.totalPaye)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function EquipePage() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('tous')
  const [filterMetier, setFilterMetier] = useState<string>('tous')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingIntervenant, setEditingIntervenant] = useState<Intervenant | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [historiqueIntervenant, setHistoriqueIntervenant] = useState<Intervenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: intervenants, loading, error, refetch } = useIntervenants()
  // Session 9 → Session 13 V1 (29/05/2026) :
  // Avant : on masquait l'intervenant "self" (créé auto par Planning).
  // Maintenant : on l'AFFICHE pour permettre à l'utilisateur de gérer la
  // case "C'est moi (utilisateur connecté)" — utile pour transférer le self
  // sur un membre réel de l'équipe ou le débrancher en mode "gérant pur".
  // Le self est juste signalé par un badge "Vous" dans la table/cartes mais
  // reste éditable et supprimable comme n'importe quel autre membre.
  // Anti-régression : il est toujours exclu des stats "employés/etc." pour
  // ne pas gonfler artificiellement les compteurs en mode Solo.
  const allIntervenants = intervenants as unknown as Intervenant[]
  const visibleIntervenants = allIntervenants.filter((e) => e.is_self !== true)

  const uniqueMetiers = Array.from(
    new Set(allIntervenants.map((e) => e.metier).filter(Boolean))
  ).sort()

  // Stats : on exclut le self pour ne pas gonfler les compteurs
  // (le dirigeant n'est pas un "employé" au sens RH).
  const employes = visibleIntervenants.filter((e) => ['cdi', 'cdd', 'apprenti'].includes(e.type_contrat))
  const interimaires = visibleIntervenants.filter((e) => e.type_contrat === 'interimaire')
  const sousTraitants = visibleIntervenants.filter((e) => e.type_contrat === 'sous-traitant')

  // Liste affichée : on inclut désormais le self pour permettre l'édition
  // de la case "C'est moi" (cf. Session 13 V1).
  const filtered = allIntervenants.filter((e) => {
    const eType = getTypeFromContrat(e.type_contrat)
    if (filterType !== 'tous' && eType !== filterType) return false
    if (filterMetier !== 'tous' && e.metier !== filterMetier) return false
    if (search) {
      const q = search.toLowerCase()
      const fullName = (e.prenom + ' ' + e.nom).toLowerCase()
      return (
        fullName.includes(q) ||
        e.metier.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      )
    }
    return true
  })

  // --- Form creer ---
  // Session 13 V2 : suppression du flag `isSelf` côté formulaire. Le badge
  // "Vous" reste affiché sur les fiches dont `is_self === true` (rétrocompat
  // des comptes legacy) mais l'utilisateur ne peut plus toggle. En mode
  // Société, tous les intervenants doivent être créés ici manuellement —
  // pas de "Vous" magique. Cf. décision validée 29/05/2026 (recherche
  // concurrence : aucun SaaS BTP français ne fait du Vous magique).
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    metier: '',
    type_contrat: 'cdi' as IntervenantType,
    niveau_acces: 'compagnon' as Intervenant['niveau_acces'],
    role: '',
  })

  const resetForm = () =>
    setForm({ prenom: '', nom: '', email: '', telephone: '', metier: '', type_contrat: 'cdi', niveau_acces: 'compagnon', role: '' })

  const handleCreate = async () => {
    setSaving(true)
    try {
      await insertRow('intervenants', {
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        telephone: form.telephone,
        metier: form.metier,
        type_contrat: form.type_contrat,
        niveau_acces: form.niveau_acces,
        role: form.role || null,
        taux_horaire: null,
        couleur: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        actif: true,
      })
      refetch()
      setShowModal(false)
      resetForm()
    } catch (err) {
      // D6 (2026-06-08) : feedback utilisateur sur erreur de création.
      const msg = err instanceof Error ? err.message : "Échec de l'ajout du membre"
      // eslint-disable-next-line no-alert
      alert(`Erreur : ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // --- Form modifier ---
  const [editForm, setEditForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    metier: '',
    type_contrat: 'cdi' as IntervenantType,
    niveau_acces: 'compagnon' as Intervenant['niveau_acces'],
    role: '',
  })

  // V1 Fix #1 (28/05/2026) : auto-lock du rôle à "Apprenti" quand
  // type_contrat === 'apprenti'. Si l'utilisateur change le type vers
  // autre chose, on NE reset PAS le rôle (il garde sa valeur précédente).
  // S'applique aux deux formulaires (création et édition).
  useEffect(() => {
    if (form.type_contrat === 'apprenti' && form.role !== 'Apprenti') {
      setForm((f) => ({ ...f, role: 'Apprenti' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type_contrat])

  useEffect(() => {
    if (editForm.type_contrat === 'apprenti' && editForm.role !== 'Apprenti') {
      setEditForm((f) => ({ ...f, role: 'Apprenti' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.type_contrat])

  const openEdit = (intervenant: Intervenant) => {
    setEditForm({
      prenom: intervenant.prenom || '',
      nom: intervenant.nom || '',
      email: intervenant.email || '',
      telephone: intervenant.telephone || '',
      metier: intervenant.metier || '',
      type_contrat: intervenant.type_contrat,
      niveau_acces: intervenant.niveau_acces,
      role: intervenant.role || '',
    })
    setEditingIntervenant(intervenant)
  }

  const handleUpdate = async () => {
    if (!editingIntervenant) return
    setEditSaving(true)
    try {
      // Session 13 V2 : on ne touche plus à is_self depuis ce formulaire
      // (la case "C'est moi" a été retirée). Le badge "Vous" reste affiché
      // en lecture seule sur les fiches legacy dont is_self === true.
      await updateRow('intervenants', editingIntervenant.id, {
        prenom: editForm.prenom,
        nom: editForm.nom,
        email: editForm.email,
        telephone: editForm.telephone,
        metier: editForm.metier,
        type_contrat: editForm.type_contrat,
        niveau_acces: editForm.niveau_acces,
        role: editForm.role || null,
      })
      refetch()
      setEditingIntervenant(null)
    } catch (err) {
      // D6 (2026-06-08) : feedback utilisateur sur erreur de modification.
      const msg = err instanceof Error ? err.message : 'Échec de la modification'
      // eslint-disable-next-line no-alert
      alert(`Erreur : ${msg}`)
    } finally {
      setEditSaving(false)
    }
  }

  // --- Supprimer ---
  // Session 13 V2.1 : le lock anti-auto-suppression a été retiré (Jerem
  // 29/05/2026 soir). L'utilisateur doit pouvoir tout effacer, y compris
  // sa propre fiche. S'il efface sa fiche en mode Solo, il pourra simplement
  // la recréer dans Mon équipe.
  // D3 (2026-06-08) : soft delete au lieu de hard delete.
  // Conserve la trace historique pour l'audit BTP (chantiers passés liés
  // à d'anciens employés) tout en faisant disparaître l'intervenant de
  // la liste équipe. Nécessite la migration SQL :
  // lib/supabase/migration-2026-06-08-D3-soft-delete-intervenants.sql
  // D6 (2026-06-08) : remplacement du catch silencieux par toast.
  const handleDelete = async (id: string) => {
    try {
      await softDeleteRow('intervenants', id)
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de la suppression'
      // eslint-disable-next-line no-alert
      alert(`Erreur : ${msg}`)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-syne font-bold text-[#0f1a3a]">Mon equipe</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#f08c1c] text-white text-sm font-syne font-bold transition-colors"
        >
          <Plus size={16} />
          Ajouter un membre
        </button>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 rounded-full bg-blue-100 text-sm font-manrope text-[#0f1a3a]">
          <span className="font-semibold">{employes.length}</span> employe{employes.length !== 1 ? 's' : ''}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-amber-100 text-sm font-manrope text-[#0f1a3a]">
          <span className="font-semibold">{interimaires.length}</span> interimaire{interimaires.length !== 1 ? 's' : ''}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-emerald-100 text-sm font-manrope text-[#0f1a3a]">
          <span className="font-semibold">{sousTraitants.length}</span> sous-traitant{sousTraitants.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="Rechercher un membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          containerClassName="sm:w-auto"
        >
          <option value="tous">Tous les types</option>
          <option value="employe">Employes</option>
          <option value="interimaire">Interimaires</option>
          <option value="sous-traitant">Sous-traitants</option>
        </Select>

        <Select
          value={filterMetier}
          onChange={(e) => setFilterMetier(e.target.value)}
          containerClassName="sm:w-auto"
        >
          <option value="tous">Tous les metiers</option>
          {uniqueMetiers.map((metier) => (
            <option key={metier} value={metier}>
              {metier}
            </option>
          ))}
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Contrat</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Metier</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Telephone</th>
              <th className="px-4 py-3 text-left text-xs font-manrope font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((intervenant, idx) => {
              const type = getTypeFromContrat(intervenant.type_contrat)
              const typeColor = TYPE_COLORS[type]
              return (
                <tr
                  key={intervenant.id}
                  className={'border-b border-gray-100 hover:bg-gray-50 transition-colors ' + (idx % 2 === 1 ? 'bg-[#f8f9fa]' : '')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-sm font-manrope font-semibold text-[#1a1a2e]">{intervenant.nom}</p>
                        <p className="text-xs font-manrope text-gray-500">{intervenant.prenom}</p>
                      </div>
                      {intervenant.is_self === true && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky/10 text-sky text-[10px] font-syne font-bold border border-sky/30"
                          title="C'est vous (utilisateur connecté)"
                        >
                          Vous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-syne font-bold text-white"
                      style={{ backgroundColor: typeColor.badge }}
                    >
                      {TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">
                    {intervenant.role || ''}
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">
                    {CONTRAT_LABELS[intervenant.type_contrat] || intervenant.type_contrat}
                  </td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{intervenant.metier}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{intervenant.email}</td>
                  <td className="px-4 py-3 text-sm font-manrope text-gray-600">{intervenant.telephone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(intervenant)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#5ab4e0] hover:bg-blue-50 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setHistoriqueIntervenant(intervenant)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                        title="Voir historique"
                      >
                        <Clock size={14} />
                      </button>
                      {deleteConfirm === intervenant.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(intervenant.id)}
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
                          onClick={() => setDeleteConfirm(intervenant.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
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
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun membre trouve</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map((intervenant) => {
          const type = getTypeFromContrat(intervenant.type_contrat)
          const typeColor = TYPE_COLORS[type]
          return (
            <div
              key={intervenant.id}
              className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-manrope font-semibold text-[#1a1a2e]">
                    {intervenant.nom} {intervenant.prenom}
                  </p>
                  {intervenant.is_self === true && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky/10 text-sky text-[10px] font-syne font-bold border border-sky/30"
                      title="C'est vous (utilisateur connecté)"
                    >
                      Vous
                    </span>
                  )}
                </div>
                <span
                  className="px-2 py-1 rounded-full text-xs font-syne font-bold text-white whitespace-nowrap"
                  style={{ backgroundColor: typeColor.badge }}
                >
                  {TYPE_LABELS[type]}
                </span>
              </div>
              <div className="text-xs font-manrope text-gray-500">
                {intervenant.metier} &middot; {CONTRAT_LABELS[intervenant.type_contrat] || intervenant.type_contrat}
              </div>
              <div className="text-xs font-manrope text-gray-600">{intervenant.email}</div>
              <div className="text-xs font-manrope text-gray-600">{intervenant.telephone}</div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => openEdit(intervenant)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#5ab4e0] text-[#5ab4e0] hover:bg-[#5ab4e0] hover:text-white text-xs font-syne font-bold transition-colors"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={() => setHistoriqueIntervenant(intervenant)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-400 text-violet-500 hover:bg-violet-500 hover:text-white text-xs font-syne font-bold transition-colors"
                >
                  <Clock size={13} />
                  Historique
                </button>
                {deleteConfirm === intervenant.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => handleDelete(intervenant.id)}
                      className="flex-1 px-2 py-1 rounded bg-red-500 text-white text-xs font-syne font-bold hover:bg-red-600 transition-colors"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-2 py-1 rounded bg-gray-200 text-gray-600 text-xs font-syne font-bold hover:bg-gray-300 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(intervenant.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-manrope text-gray-500">Aucun membre trouve</p>
          </div>
        )}
      </div>

      {/* Modal: Ajouter un membre */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">Ajouter un membre</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <Select
              label="Type *"
              value={form.type_contrat}
              onChange={(e) => setForm({ ...form, type_contrat: e.target.value as IntervenantType })}
            >
              <option value="cdi">Employe (CDI)</option>
              <option value="cdd">Employe (CDD)</option>
              <option value="apprenti">Apprenti</option>
              <option value="interimaire">Interimaire</option>
              <option value="sous-traitant">Sous-traitant</option>
            </Select>
            {/* Session 13 V1 (29/05/2026) : liste fermée à 5 rôles hiérarchiques.
                "Conducteur de travaux" et "Assistant" retirés (redondants/obsolètes
                pour les TPE). Les anciennes valeurs en BDD restent affichées en
                lecture seule dans la table (rétrocompat).
                Auto-lock Apprenti maintenu si Type=Apprentissage. */}
            <Select
              label="Rôle"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={form.type_contrat === 'apprenti'}
              hint={form.type_contrat === 'apprenti' ? 'Verrouillé : un contrat d’apprentissage impose le rôle Apprenti.' : undefined}
            >
              <option value="">— Non défini</option>
              <option value="Apprenti">Apprenti</option>
              <option value="Ouvrier">Ouvrier</option>
              <option value="Compagnon">Compagnon</option>
              <option value="Chef d'équipe">Chef d&apos;équipe</option>
              <option value="Dirigeant">Dirigeant</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Prenom"
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
            <Input
              label="Metier"
              type="text"
              value={form.metier}
              onChange={(e) => setForm({ ...form, metier: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Telephone"
                type="text"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="h-10 px-5 rounded-lg border border-gray-200 text-sm font-syne font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.prenom || !form.nom}
                className="h-10 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#f08c1c] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modifier un membre */}
      {editingIntervenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-syne font-bold text-[#0f1a3a]">Modifier le membre</h2>
              <button onClick={() => setEditingIntervenant(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <Select
              label="Type *"
              value={editForm.type_contrat}
              onChange={(e) => setEditForm({ ...editForm, type_contrat: e.target.value as IntervenantType })}
            >
              <option value="cdi">Employe (CDI)</option>
              <option value="cdd">Employe (CDD)</option>
              <option value="apprenti">Apprenti</option>
              <option value="interimaire">Interimaire</option>
              <option value="sous-traitant">Sous-traitant</option>
            </Select>
            {/* Session 13 V1 : liste fermée à 5 rôles + auto-lock Apprenti.
                Rétrocompat : si la valeur enregistrée est "Conducteur de travaux"
                ou "Assistant" (ancienne liste), on l'expose comme option
                additionnelle pour ne pas perdre la donnée. L'utilisateur peut
                la conserver ou basculer sur la nouvelle liste. */}
            <Select
              label="Rôle"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              disabled={editForm.type_contrat === 'apprenti'}
              hint={editForm.type_contrat === 'apprenti' ? 'Verrouillé : un contrat d’apprentissage impose le rôle Apprenti.' : undefined}
            >
              <option value="">— Non défini</option>
              <option value="Apprenti">Apprenti</option>
              <option value="Ouvrier">Ouvrier</option>
              <option value="Compagnon">Compagnon</option>
              <option value="Chef d'équipe">Chef d&apos;équipe</option>
              <option value="Dirigeant">Dirigeant</option>
              {(editForm.role === 'Conducteur de travaux' || editForm.role === 'Assistant') && (
                <option value={editForm.role}>{editForm.role} (ancien rôle)</option>
              )}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Prenom"
                type="text"
                value={editForm.prenom}
                onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
              />
              <Input
                label="Nom"
                type="text"
                value={editForm.nom}
                onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
              />
            </div>
            <Input
              label="Metier"
              type="text"
              value={editForm.metier}
              onChange={(e) => setEditForm({ ...editForm, metier: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <Input
                label="Telephone"
                type="text"
                value={editForm.telephone}
                onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingIntervenant(null)}
                className="h-10 px-5 rounded-lg border border-gray-200 text-sm font-syne font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                disabled={editSaving || !editForm.prenom || !editForm.nom}
                className="h-10 px-5 rounded-lg bg-[#5ab4e0] hover:bg-[#4a9fc9] disabled:opacity-50 text-white text-sm font-syne font-bold transition-colors"
              >
                {editSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Historique */}
      {historiqueIntervenant && (
        <ModalHistorique
          intervenant={historiqueIntervenant}
          onClose={() => setHistoriqueIntervenant(null)}
        />
      )}
    </div>
  )
}
