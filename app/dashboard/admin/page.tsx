'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, RefreshCw, Crown, Clock, Ban, CheckCircle, Users, Search,
  Trash2, X, ChevronRight, Mail, Building2, Wrench, Calendar, LogIn,
  AlertTriangle, UserCheck, Gift,
} from 'lucide-react'
import { useUser } from '@/lib/hooks'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'

const ADMIN_EMAIL = 'admin@nexartis.fr'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface UserRecord {
  id: string
  user_id: string
  nom: string
  prenom: string
  auth_email: string
  email: string
  telephone: string
  metier: string
  ville: string
  siret: string
  adresse: string
  code_postal: string
  forme_juridique: string
  abonnement_type: 'trial' | 'lifetime' | 'actif' | 'suspendu'
  trial_started_at: string
  abonnement_expire_at: string | null
  notes_admin: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  auth_prenom: string
  auth_nom: string
  auth_entreprise: string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateHour(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function trialDaysLeft(trialStarted: string): number {
  const start = new Date(trialStarted)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, 14 - diffDays)
}

function getUserDisplayName(u: UserRecord): string {
  // Nom/prénom de la PERSONNE = auth metadata (prenom + nom)
  // ATTENTION : entreprises.nom = nom de l'ENTREPRISE, pas de la personne !
  const p = u.auth_prenom || u.prenom || ''
  const n = u.auth_nom || ''
  if (p && n) return `${p} ${n}`
  if (p) return p
  if (n) return n
  return u.auth_email?.split('@')[0] || '—'
}

function getEntrepriseName(u: UserRecord): string {
  // Nom de l'ENTREPRISE = entreprises.nom ou auth_metadata.entreprise
  return u.nom || u.auth_entreprise || '—'
}

const ABONNEMENT_CONFIG = {
  trial: {
    label: 'Essai',
    color: 'bg-amber-100 text-amber-800',
    icon: Clock,
  },
  lifetime: {
    label: 'À vie',
    color: 'bg-purple-100 text-purple-800',
    icon: Crown,
  },
  actif: {
    label: 'Actif',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle,
  },
  suspendu: {
    label: 'Suspendu',
    color: 'bg-red-100 text-red-700',
    icon: Ban,
  },
}

// -------------------------------------------------------------------
// Badge statut
// -------------------------------------------------------------------

function AbonnementBadge({ type, trialStarted }: { type: string; trialStarted: string }) {
  const config = ABONNEMENT_CONFIG[type as keyof typeof ABONNEMENT_CONFIG] ?? ABONNEMENT_CONFIG.trial
  const Icon = config.icon
  const daysLeft = type === 'trial' ? trialDaysLeft(trialStarted) : null

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={11} />
      {config.label}
      {daysLeft !== null && (
        <span className="ml-0.5 opacity-80">({daysLeft}j)</span>
      )}
    </span>
  )
}

// -------------------------------------------------------------------
// Modal vue détaillée utilisateur
// -------------------------------------------------------------------

function UserDetailModal({
  user,
  onClose,
  onSave,
  onDelete,
  onConfirm,
}: {
  user: UserRecord
  onClose: () => void
  onSave: (id: string, type: string, notes: string, expireAt?: string | null, gesteCommercialMois?: number) => Promise<void>
  onDelete: (userId: string) => Promise<void>
  onConfirm: (userId: string) => Promise<void>
}) {
  const [type, setType] = useState(user.abonnement_type)
  const [notes, setNotes] = useState(user.notes_admin ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [offering, setOffering] = useState<number | null>(null)
  const displayName = getUserDisplayName(user)
  const isConfirmed = !!user.email_confirmed_at

  async function handleSave() {
    setSaving(true)
    await onSave(user.id, type, notes)
    setSaving(false)
    onClose()
  }

  async function handleOfferMonths(months: number) {
    setOffering(months)
    // Calculer la nouvelle date d'expiration
    // Si l'abonnement est déjà actif et expire dans le futur, on ajoute les mois à cette date.
    // Sinon, on part de maintenant.
    const now = new Date()
    const currentExpire = user.abonnement_expire_at ? new Date(user.abonnement_expire_at) : null
    const baseDate = currentExpire && currentExpire > now ? currentExpire : now
    const newExpire = new Date(baseDate)
    newExpire.setDate(newExpire.getDate() + months * 30)

    // Ajouter une note d'historique automatique
    const stamp = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const noteLine = `[${stamp}] +${months} mois offert${months > 1 ? 's' : ''} (expire le ${newExpire.toLocaleDateString('fr-FR')})`
    const newNotes = notes.trim() ? `${notes}\n${noteLine}` : noteLine

    // V3.0c.20 : on signale le geste commercial pour declencher le mail dedie
    await onSave(user.id, 'actif', newNotes, newExpire.toISOString(), months)
    setOffering(null)
    onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(user.user_id)
    setDeleting(false)
    onClose()
  }

  async function handleConfirm() {
    setConfirming(true)
    await onConfirm(user.user_id)
    setConfirming(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-syne font-bold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-syne font-bold text-[#1a1a2e] text-base">{displayName}</div>
              <div className="text-xs text-gray-400 font-manrope flex items-center gap-1">
                <Mail size={10} /> {user.auth_email}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Alerte si pas confirmé */}
        {!isConfirmed && (
          <div className="mx-5 mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-3">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-manrope text-amber-700 font-medium">Email non confirmé — cet utilisateur ne peut pas se connecter</p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-manrope font-semibold rounded-lg hover:bg-amber-700 transition disabled:opacity-60 flex items-center gap-1"
            >
              <UserCheck size={12} />
              {confirming ? 'Confirmation...' : 'Confirmer'}
            </button>
          </div>
        )}

        {/* Infos détaillées */}
        <div className="p-5 space-y-4">
          {/* Carte d'identité */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-syne font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
              <Users size={14} /> Identité
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-manrope">
              <div>
                <span className="text-gray-400">Prénom</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.auth_prenom || user.prenom || '—'}</div>
              </div>
              <div>
                <span className="text-gray-400">Nom</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.auth_nom || '—'}</div>
              </div>
              <div>
                <span className="text-gray-400">Email</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5 break-all">{user.auth_email}</div>
              </div>
              <div>
                <span className="text-gray-400">Téléphone</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.telephone || '—'}</div>
              </div>
            </div>
          </div>

          {/* Entreprise */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-syne font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
              <Building2 size={14} /> Entreprise
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-manrope">
              <div>
                <span className="text-gray-400">Nom entreprise</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{getEntrepriseName(user)}</div>
              </div>
              <div>
                <span className="text-gray-400">SIRET</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.siret || '—'}</div>
              </div>
              <div>
                <span className="text-gray-400">Métier</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.metier || '—'}</div>
              </div>
              <div>
                <span className="text-gray-400">Forme juridique</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{user.forme_juridique || '—'}</div>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Adresse</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">
                  {user.adresse ? `${user.adresse}, ${user.code_postal || ''} ${user.ville || ''}`.trim() : (user.ville || '—')}
                </div>
              </div>
            </div>
          </div>

          {/* Dates & activité */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-syne font-bold text-sm text-[#1a1a2e] flex items-center gap-2">
              <Calendar size={14} /> Activité
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-manrope">
              <div>
                <span className="text-gray-400">Inscrit le</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{formatDate(user.created_at)}</div>
              </div>
              <div>
                <span className="text-gray-400">Dernière connexion</span>
                <div className="text-[#1a1a2e] font-medium mt-0.5">{formatDateHour(user.last_sign_in_at)}</div>
              </div>
              <div>
                <span className="text-gray-400">Email confirmé</span>
                <div className={`font-medium mt-0.5 ${isConfirmed ? 'text-green-600' : 'text-red-500'}`}>
                  {isConfirmed ? 'Oui' : 'Non'}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Abonnement</span>
                <div className="mt-0.5">
                  <AbonnementBadge type={user.abonnement_type} trialStarted={user.trial_started_at} />
                </div>
              </div>
            </div>
          </div>

          {/* Sélecteur abonnement */}
          <div>
            <label className="block text-sm font-manrope font-semibold text-[#1a1a2e] mb-2">
              Changer l&apos;abonnement
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ABONNEMENT_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    onClick={() => setType(key as UserRecord['abonnement_type'])}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-manrope transition-all ${
                      type === key
                        ? 'border-[#2563eb] bg-blue-50 text-[#2563eb] font-semibold'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={14} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Geste commercial — offrir un mois gratuit */}
          <div className="bg-gradient-to-br from-[#5ab4e0]/10 to-[#5ab4e0]/5 rounded-xl p-4 border border-[#5ab4e0]/30">
            <h3 className="font-syne font-bold text-sm text-[#1a1a2e] flex items-center gap-2 mb-1">
              <Gift size={14} className="text-[#5ab4e0]" /> Geste commercial
            </h3>
            <p className="text-xs text-gray-500 font-manrope mb-3">
              Offrir des mois gratuits. Le compte passera en <strong>Actif</strong> et la date d&apos;expiration sera mise à jour automatiquement.
            </p>
            {user.abonnement_expire_at && (
              <div className="text-xs font-manrope text-[#1a1a2e] bg-white rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                <Calendar size={12} className="text-gray-400" />
                Actif jusqu&apos;au <strong>{formatDate(user.abonnement_expire_at)}</strong>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOfferMonths(1)}
                disabled={offering !== null || saving}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#5ab4e0] text-white text-sm font-manrope font-semibold hover:bg-[#4aa3d0] transition disabled:opacity-60"
              >
                <Gift size={14} />
                {offering === 1 ? 'En cours...' : '+1 mois offert'}
              </button>
              <button
                onClick={() => handleOfferMonths(3)}
                disabled={offering !== null || saving}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border-2 border-[#5ab4e0] text-[#5ab4e0] text-sm font-manrope font-semibold hover:bg-[#5ab4e0]/10 transition disabled:opacity-60"
              >
                <Gift size={14} />
                {offering === 3 ? 'En cours...' : '+3 mois offerts'}
              </button>
            </div>
          </div>

          {/* Notes admin */}
          <div>
            <label className="block text-sm font-manrope font-semibold text-[#1a1a2e] mb-1.5">
              Notes admin (privées)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: ami testeur, ne pas facturer..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-manrope text-[#1a1a2e] resize-none focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-3">
          {/* Sauvegarder */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-manrope text-gray-500 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-manrope font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>

          {/* Zone danger : supprimer */}
          <div className="border-t border-gray-100 pt-3">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-manrope font-semibold hover:bg-red-50 transition"
              >
                <Trash2 size={14} />
                Supprimer ce compte
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-sm font-manrope text-red-700 font-medium mb-1">
                  Supprimer définitivement ce compte ?
                </p>
                <p className="text-xs font-manrope text-red-500 mb-3">
                  Toutes les données (devis, factures, clients, chantiers, planning) seront supprimées. Cette action est irréversible.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-manrope text-gray-500 hover:bg-white transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-manrope font-semibold hover:bg-red-700 transition disabled:opacity-60"
                  >
                    {deleting ? 'Suppression...' : 'Confirmer la suppression'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Page principale
// -------------------------------------------------------------------

export default async function AdminPage() {
  const confirm = useConfirm()
  const { user, loading: loadingUser } = useUser()
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Sécurité : seul l'admin peut accéder
  useEffect(() => {
    if (!loadingUser && user?.email !== ADMIN_EMAIL) {
      router.replace('/dashboard')
    }
  }, [user, loadingUser, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setUsers(json.users ?? [])
    } catch {
      setToast('Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchUsers()
  }, [user, fetchUsers])

  async function showToastMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(entrepriseId: string, abonnementType: string, notes: string, expireAt?: string | null, gesteCommercialMois?: number) {
    const body: Record<string, unknown> = {
      entreprise_id: entrepriseId,
      abonnement_type: abonnementType,
      notes_admin: notes,
    }
    if (expireAt !== undefined) body.abonnement_expire_at = expireAt
    // V3.0c.20 : flag pour declencher le mail geste commercial cote serveur
    if (gesteCommercialMois) body.geste_commercial_mois = gesteCommercialMois

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showToastMsg(expireAt ? 'Mois offert appliqué ✓' : 'Abonnement mis à jour ✓')
      fetchUsers()
    } else {
      showToastMsg('Erreur lors de la mise à jour')
    }
  }

  async function handleDelete(userId: string) {
    const res = await fetch(`/api/admin/users?user_id=${userId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      showToastMsg('Compte supprimé ✓')
      fetchUsers()
    } else {
      const json = await res.json()
      showToastMsg(`Erreur: ${json.error || 'Suppression échouée'}`)
    }
  }

  async function handleConfirm(userId: string) {
    const res = await fetch('/api/admin/confirm-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      showToastMsg('Email confirmé ✓ — l\'utilisateur peut maintenant se connecter')
      fetchUsers()
    } else {
      showToastMsg('Erreur lors de la confirmation')
    }
  }

  if (loadingUser || user?.email !== ADMIN_EMAIL) return null

  // Filtrage par recherche
  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      getUserDisplayName(u).toLowerCase().includes(q) ||
      u.auth_email?.toLowerCase().includes(q) ||
      u.metier?.toLowerCase().includes(q) ||
      u.ville?.toLowerCase().includes(q) ||
      getEntrepriseName(u).toLowerCase().includes(q) ||
      (u.prenom || u.auth_prenom || '').toLowerCase().includes(q)
    )
  })

  // Stats
  const stats = {
    total: users.length,
    trial: users.filter(u => u.abonnement_type === 'trial').length,
    lifetime: users.filter(u => u.abonnement_type === 'lifetime').length,
    actif: users.filter(u => u.abonnement_type === 'actif').length,
    suspendu: users.filter(u => u.abonnement_type === 'suspendu').length,
    nonConfirme: users.filter(u => !u.email_confirmed_at).length,
  }

  return async (
    <div className="min-h-screen">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Shield size={18} className="text-[#2563eb]" />
          </div>
          <div>
            <h1 className="font-syne font-bold text-xl text-[#1a1a2e]">Panneau Admin</h1>
            <p className="text-xs text-gray-400 font-manrope">Gestion des {stats.total} compte{stats.total > 1 ? 's' : ''} Nexartis</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!(await confirm({ title: 'Recalculer la numerotation hierarchique ?', message: 'Cette operation recalcule TOUS les devis et factures existants et peut prendre quelques secondes.', confirmLabel: 'Recalculer' }))) return
              showToastMsg('Migration en cours...')
              try {
                const res = await fetch('/api/admin/migrate-numerotation', { method: 'POST' })
                const json = await res.json()
                if (res.ok) showToastMsg(json.message || 'Migration terminee')
                else showToastMsg('Erreur : ' + (json.error || 'inconnue'))
              } catch {
                showToastMsg('Erreur reseau')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-manrope bg-[#5ab4e0]/10 border border-[#5ab4e0]/30 rounded-lg hover:bg-[#5ab4e0]/20 transition text-[#1a6fb5]"
            title="Recalcule les numeros 1, 1.1, 1.1.1 sur tous les devis et factures existants"
          >
            <RefreshCw size={13} />
            Renumeroter
          </button>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-[#1a1a2e]"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-[#1a1a2e]', bg: 'bg-white', icon: Users },
          { label: 'En essai', value: stats.trial, color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
          { label: 'À vie', value: stats.lifetime, color: 'text-purple-700', bg: 'bg-purple-50', icon: Crown },
          { label: 'Actif', value: stats.actif, color: 'text-green-700', bg: 'bg-green-50', icon: CheckCircle },
          { label: 'Suspendu', value: stats.suspendu, color: 'text-red-600', bg: 'bg-red-50', icon: Ban },
          { label: 'Non confirmé', value: stats.nonConfirme, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`${stat.bg} rounded-xl border border-gray-100 p-4 flex items-center gap-3`}>
              <Icon size={18} className={stat.color} />
              <div>
                <div className={`font-syne font-bold text-lg ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-gray-400 font-manrope">{stat.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, prénom, email, entreprise, métier, ville..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-manrope text-[#1a1a2e] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30 bg-white"
        />
      </div>

      {/* Liste des utilisateurs — dual layout mobile/desktop */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400 font-manrope">
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400 font-manrope">
            Aucun utilisateur trouvé
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full p-4 text-left hover:bg-blue-50/30 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-syne font-bold text-sm flex-shrink-0">
                    {getUserDisplayName(u).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-manrope font-semibold text-sm text-[#1a1a2e] truncate">{getUserDisplayName(u)}</span>
                      {!u.email_confirmed_at && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-400 font-manrope truncate">{u.auth_email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <AbonnementBadge type={u.abonnement_type} trialStarted={u.trial_started_at} />
                      {u.metier && <span className="text-[10px] text-gray-400 font-manrope">{u.metier}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider">Nom / Prénom</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Entreprise</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Métier</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider">Abonnement</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Inscrit</th>
                    <th className="px-4 py-3 text-left text-xs font-manrope font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Dernière co.</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => setSelectedUser(u)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-manrope font-semibold text-sm text-[#1a1a2e]">{getUserDisplayName(u)}</div>
                          {!u.email_confirmed_at && (
                            <span title="Email non confirmé" className="flex-shrink-0">
                              <AlertTriangle size={12} className="text-amber-500" />
                            </span>
                          )}
                        </div>
                        {u.notes_admin && (
                          <div className="text-xs text-purple-500 mt-0.5 italic truncate max-w-[160px]">{u.notes_admin}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-manrope text-gray-600 truncate max-w-[200px]">{u.auth_email}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm font-manrope text-gray-500 truncate max-w-[140px]">{getEntrepriseName(u)}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-sm font-manrope text-gray-500">{u.metier || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <AbonnementBadge type={u.abonnement_type} trialStarted={u.trial_started_at} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-sm font-manrope text-gray-400">{formatDate(u.created_at)}</div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <div className="text-sm font-manrope text-gray-400 flex items-center gap-1">
                          <LogIn size={11} /> {formatDate(u.last_sign_in_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedUser(u) }}
                          className="px-3 py-1.5 text-xs font-manrope font-medium bg-[#2563eb]/10 text-[#2563eb] rounded-lg hover:bg-[#2563eb]/20 transition"
                        >
                          Gérer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal gestion utilisateur */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onConfirm={handleConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1a1a2e] text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-manrope z-50 max-w-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
