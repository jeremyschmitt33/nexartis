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
// V4 Light Premium — refonte visuelle (logique métier inchangée).
// Composants V4 partagés (cf. DESIGN_SYSTEM_V4.md). On garde Input/Select
// legacy hors imports (plus utilisés ici), au profit des composants V4.
import {
  PremiumInput,
  PremiumSelect,
  PremiumButton,
} from '@/components/ui/v4'
import { toast } from '@/lib/toast'

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

// V4 : palette sémantique conservée (employé/intérim/sous-traitant) mais
// alignée sur les tons V4 light. L'employé bleu legacy (#5ab4e0) est remplacé
// par un bleu V4 plus profond (#3b82f6 = blue-500) pour une meilleure lisibilité
// sur fond clair. Intérim ambre / Sous-traitant emerald restent identiques car
// ce sont des couleurs sémantiques (jaune attention / vert validé).
const TYPE_COLORS: Record<string, { badge: string; bg: string }> = {
  employe: { badge: '#3b82f6', bg: 'bg-blue-100' },
  interimaire: { badge: '#f59e0b', bg: 'bg-amber-100' },
  'sous-traitant': { badge: '#10b981', bg: 'bg-emerald-100' },
}

// V4 : couleurs avatar harmonisées — l'orange Nexartis #ff7a1a remplace
// l'ancien orange #e87a2a, et on retire le bleu sky legacy au profit
// d'un bleu V4 cohérent.
const AVATAR_COLORS = [
  'bg-[#3b82f6]',
  'bg-emerald-500',
  'bg-[#ff7a1a]',
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

  // V4 : modal d'historique re-stylée — accent line orange, header sticky,
  // typo Hanken, données en font-spline-mono (montants + dates).
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

        <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
          <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em] truncate pr-3">
            Historique — {intervenant.prenom} {intervenant.nom}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <p className="text-sm font-hanken text-gray-500 text-center py-8">Chargement...</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-[#ff7a1a] mb-2">
                  Chantiers ({data.chantiers.length})
                </h3>
                {data.chantiers.length === 0 ? (
                  <p className="text-xs font-hanken text-gray-400">Aucun chantier associé.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.chantiers.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-sm">
                        <a
                          href={'/dashboard/chantiers/' + c.id}
                          className="font-hanken font-semibold text-[#ff7a1a] hover:underline truncate flex-1"
                        >
                          {c.titre || 'Chantier sans titre'}
                        </a>
                        <span className="ml-2 text-xs font-spline-mono font-medium text-gray-400 flex-shrink-0">
                          {c.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : '--'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isST && (
                <div>
                  <h3 className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-[#ff7a1a] mb-2">
                    Paiements sous-traitant
                  </h3>
                  {data.paiements.length === 0 ? (
                    <p className="text-xs font-hanken text-gray-400">Aucun paiement enregistré.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.paiements.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-sm">
                          <span className={`font-spline-mono font-semibold tracking-[0.3px] ${p.statut === 'paye' ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {formatEuro(Number(p.montant_paye) || 0)}
                          </span>
                          <span className="text-xs font-hanken text-gray-400 capitalize">{p.statut}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.totalPaye > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#0f1a3a]/[0.06] flex items-center justify-between">
                      <span className="text-sm font-hanken font-bold text-[#0f1a3a]">Total payé</span>
                      <span className="font-spline-mono font-semibold text-emerald-600 tracking-[0.3px]">
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
      toast.error(`Erreur : ${msg}`)
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
      toast.error(`Erreur : ${msg}`)
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
      toast.error(`Erreur : ${msg}`)
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
      {/* ============ Header de page — V4 ============ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
          Mon équipe
        </h1>
        {/* CTA primaire — gradient orange V4 (≠ ambre legacy) */}
        <PremiumButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setShowModal(true)}
        >
          Ajouter un membre
        </PremiumButton>
      </div>

      {/* ============ Chips stats — V4 sémantique ============ */}
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-sm font-hanken text-blue-800">
          <span className="font-spline-mono font-semibold">{employes.length}</span> employé{employes.length !== 1 ? 's' : ''}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/60 text-sm font-hanken text-amber-800">
          <span className="font-spline-mono font-semibold">{interimaires.length}</span> intérimaire{interimaires.length !== 1 ? 's' : ''}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-sm font-hanken text-emerald-800">
          <span className="font-spline-mono font-semibold">{sousTraitants.length}</span> sous-traitant{sousTraitants.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ============ Filtres — V4 ============ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <input
            type="text"
            placeholder="Rechercher un membre..."
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
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="sm:w-auto"
        >
          <option value="tous">Tous les types</option>
          <option value="employe">Employés</option>
          <option value="interimaire">Intérimaires</option>
          <option value="sous-traitant">Sous-traitants</option>
        </PremiumSelect>

        <PremiumSelect
          value={filterMetier}
          onChange={(e) => setFilterMetier(e.target.value)}
          className="sm:w-auto"
        >
          <option value="tous">Tous les métiers</option>
          {uniqueMetiers.map((metier) => (
            <option key={metier} value={metier}>
              {metier}
            </option>
          ))}
        </PremiumSelect>
      </div>

      {/* ============ Table desktop (≥ sm) — V4 ============ */}
      <div className="hidden sm:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden
                      shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Nom</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Type</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Rôle</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Contrat</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Métier</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Email</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Téléphone</th>
              <th className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((intervenant) => {
              const type = getTypeFromContrat(intervenant.type_contrat)
              const typeColor = TYPE_COLORS[type]
              return (
                <tr
                  key={intervenant.id}
                  className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-sm font-hanken font-bold text-[#0f1a3a]">{intervenant.nom}</p>
                        <p className="text-xs font-hanken text-gray-500">{intervenant.prenom}</p>
                      </div>
                      {intervenant.is_self === true && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ff7a1a]/10 text-[#ff7a1a] text-[10px] font-hanken font-bold uppercase tracking-wider border border-[#ff7a1a]/30"
                          title="C'est vous (utilisateur connecté)"
                        >
                          Vous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* Badge type sémantique (employé/intérim/sous-traitant) */}
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: typeColor.badge }}
                    >
                      {TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-hanken text-gray-600">
                    {intervenant.role || ''}
                  </td>
                  <td className="px-4 py-3 text-sm font-hanken text-gray-600">
                    {CONTRAT_LABELS[intervenant.type_contrat] || intervenant.type_contrat}
                  </td>
                  <td className="px-4 py-3 text-sm font-hanken text-gray-600">{intervenant.metier}</td>
                  {/* Email + tél en mono : "data" */}
                  <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{intervenant.email}</td>
                  <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{intervenant.telephone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(intervenant)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#ff7a1a] hover:bg-[#ff7a1a]/10 transition-colors"
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setHistoriqueIntervenant(intervenant)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Voir historique"
                        aria-label="Voir historique"
                      >
                        <Clock size={14} />
                      </button>
                      {deleteConfirm === intervenant.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(intervenant.id)}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-hanken font-bold hover:bg-red-700 transition-colors"
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
                          onClick={() => setDeleteConfirm(intervenant.id)}
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
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-hanken text-gray-500">Aucun membre trouvé</p>
          </div>
        )}
      </div>

      {/* ============ Cartes mobile (< sm) — V4 ============ */}
      <div className="sm:hidden space-y-3">
        {filtered.map((intervenant) => {
          const type = getTypeFromContrat(intervenant.type_contrat)
          const typeColor = TYPE_COLORS[type]
          return (
            <div
              key={intervenant.id}
              className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-4 space-y-3
                         shadow-[0_4px_12px_rgba(15,26,58,0.04)]"
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-hanken font-bold text-[#0f1a3a]">
                    {intervenant.nom} {intervenant.prenom}
                  </p>
                  {intervenant.is_self === true && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ff7a1a]/10 text-[#ff7a1a] text-[10px] font-hanken font-bold uppercase tracking-wider border border-[#ff7a1a]/30"
                      title="C'est vous (utilisateur connecté)"
                    >
                      Vous
                    </span>
                  )}
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider text-white whitespace-nowrap"
                  style={{ backgroundColor: typeColor.badge }}
                >
                  {TYPE_LABELS[type]}
                </span>
              </div>
              <div className="text-xs font-hanken text-gray-500">
                {intervenant.metier} · {CONTRAT_LABELS[intervenant.type_contrat] || intervenant.type_contrat}
              </div>
              {/* Email + tél en mono */}
              <div className="text-xs font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{intervenant.email}</div>
              <div className="text-xs font-spline-mono font-medium text-gray-600 tracking-[0.3px]">{intervenant.telephone}</div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => openEdit(intervenant)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#ff7a1a] text-[#ff7a1a] hover:bg-[#ff7a1a] hover:text-white text-xs font-hanken font-bold transition-colors"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={() => setHistoriqueIntervenant(intervenant)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-violet-400 text-violet-600 hover:bg-violet-600 hover:text-white text-xs font-hanken font-bold transition-colors"
                >
                  <Clock size={13} />
                  Historique
                </button>
                {deleteConfirm === intervenant.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => handleDelete(intervenant.id)}
                      className="flex-1 px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-hanken font-bold hover:bg-red-700 transition-colors"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-2 py-1 rounded-lg bg-gray-200 text-gray-700 text-xs font-hanken font-bold hover:bg-gray-300 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(intervenant.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Supprimer"
                    aria-label="Supprimer"
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
            <p className="text-sm font-hanken text-gray-500">Aucun membre trouvé</p>
          </div>
        )}
      </div>

      {/* ============ Modale : ajouter un membre — V4 ============ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

            <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">Ajouter un membre</h2>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <PremiumSelect
                label="Type *"
                value={form.type_contrat}
                onChange={(e) => setForm({ ...form, type_contrat: e.target.value as IntervenantType })}
              >
                <option value="cdi">Employé (CDI)</option>
                <option value="cdd">Employé (CDD)</option>
                <option value="apprenti">Apprenti</option>
                <option value="interimaire">Intérimaire</option>
                <option value="sous-traitant">Sous-traitant</option>
              </PremiumSelect>

              {/* Session 13 V1 : liste fermée à 5 rôles + auto-lock Apprenti.
                  Hint affiché quand verrouillage actif. */}
              <PremiumSelect
                label="Rôle"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={form.type_contrat === 'apprenti'}
                hint={form.type_contrat === 'apprenti' ? "Verrouillé : un contrat d'apprentissage impose le rôle Apprenti." : undefined}
              >
                <option value="">— Non défini</option>
                <option value="Apprenti">Apprenti</option>
                <option value="Ouvrier">Ouvrier</option>
                <option value="Compagnon">Compagnon</option>
                <option value="Chef d'équipe">Chef d&apos;équipe</option>
                <option value="Dirigeant">Dirigeant</option>
              </PremiumSelect>

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
              <PremiumInput
                label="Métier"
                type="text"
                value={form.metier}
                onChange={(e) => setForm({ ...form, metier: e.target.value })}
              />
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
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#0f1a3a]/[0.06] px-6 py-4 flex justify-end gap-3">
              <PremiumButton
                variant="secondary"
                onClick={() => { setShowModal(false); resetForm() }}
              >
                Annuler
              </PremiumButton>
              <PremiumButton
                variant="primary"
                onClick={handleCreate}
                disabled={saving || !form.prenom || !form.nom}
                loading={saving}
              >
                Créer
              </PremiumButton>
            </div>
          </div>
        </div>
      )}

      {/* ============ Modale : modifier un membre — V4 ============ */}
      {editingIntervenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-hidden">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

            <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
              <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">Modifier le membre</h2>
              <button
                onClick={() => setEditingIntervenant(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <PremiumSelect
                label="Type *"
                value={editForm.type_contrat}
                onChange={(e) => setEditForm({ ...editForm, type_contrat: e.target.value as IntervenantType })}
              >
                <option value="cdi">Employé (CDI)</option>
                <option value="cdd">Employé (CDD)</option>
                <option value="apprenti">Apprenti</option>
                <option value="interimaire">Intérimaire</option>
                <option value="sous-traitant">Sous-traitant</option>
              </PremiumSelect>

              {/* Session 13 V1 : liste fermée + auto-lock Apprenti.
                  Rétrocompat : on conserve les anciennes valeurs en option. */}
              <PremiumSelect
                label="Rôle"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                disabled={editForm.type_contrat === 'apprenti'}
                hint={editForm.type_contrat === 'apprenti' ? "Verrouillé : un contrat d'apprentissage impose le rôle Apprenti." : undefined}
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
              </PremiumSelect>

              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Prénom"
                  type="text"
                  value={editForm.prenom}
                  onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                />
                <PremiumInput
                  label="Nom"
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                />
              </div>
              <PremiumInput
                label="Métier"
                type="text"
                value={editForm.metier}
                onChange={(e) => setEditForm({ ...editForm, metier: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <PremiumInput
                  label="Email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  mono
                />
                <PremiumInput
                  label="Téléphone"
                  type="text"
                  value={editForm.telephone}
                  onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                  mono
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#0f1a3a]/[0.06] px-6 py-4 flex justify-end gap-3">
              <PremiumButton
                variant="secondary"
                onClick={() => setEditingIntervenant(null)}
              >
                Annuler
              </PremiumButton>
              <PremiumButton
                variant="primary"
                onClick={handleUpdate}
                disabled={editSaving || !editForm.prenom || !editForm.nom}
                loading={editSaving}
              >
                Enregistrer
              </PremiumButton>
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
