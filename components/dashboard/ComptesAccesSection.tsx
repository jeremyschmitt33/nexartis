'use client'

// ============================================================================
// components/dashboard/ComptesAccesSection.tsx
// ----------------------------------------------------------------------------
// Section « Comptes & accès » de la page /dashboard/equipe (feature
// multi-utilisateur, Push 1). Isolée dans son propre fichier compact pour :
//   - ne pas alourdir app/dashboard/equipe/page.tsx (déjà ~1000 lignes,
//     à risque de troncature cross-OS) ;
//   - garder un périmètre net (le back code les routes API en parallèle).
//
// Logique d'affichage selon le rôle / plan :
//   - dirigeant + plan complete (ou trial)  → liste + Inviter + Révoquer.
//   - dirigeant + plan NON complete (hors trial) → encart upsell, pas de bouton.
//   - commercial / ouvrier                   → liste en lecture seule.
//
// Push 1 : un employé activé ne voit pas encore les données métier
// (déverrouillage = Push 2). On n'essaie PAS de gérer ça ici.
//
// Composants partagés réutilisés : PremiumCard, PremiumButton, PremiumInput,
// PremiumSelect, InfoBanner (V4), toast (lib/toast), useConfirm (ConfirmDialog).
// ============================================================================

import { useState } from 'react'
import { ShieldCheck, UserPlus, X } from 'lucide-react'
import Link from 'next/link'
import {
  PremiumCard,
  PremiumButton,
  PremiumInput,
  PremiumSelect,
  InfoBanner,
} from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import {
  useCurrentRole,
  useEntrepriseMembres,
  type EntrepriseMembre,
  type MembreStatut,
} from '@/lib/hooks-equipe'
import { useEntreprise, useIntervenants } from '@/lib/hooks'
import { getEffectivePlan } from '@/lib/plans'
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  INVITABLE_ROLES,
  isUserRole,
  type UserRole,
} from '@/lib/roles'

// --- Helpers d'affichage ----------------------------------------------------

const STATUT_BADGE: Record<MembreStatut, { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  invite: { label: 'Invité', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  revoque: { label: 'Révoqué', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

/** Date longue FR (jour mois année), pour l'expiration d'invitation. */
function formatDateLongue(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** True si la date d'expiration fournie est déjà passée. */
function estExpiree(value: string | null | undefined): boolean {
  if (!value) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

function membreLabel(m: EntrepriseMembre): string {
  return m.email_invite || 'Membre'
}

function roleLabelOf(role: string): string {
  return isUserRole(role) ? ROLE_LABELS[role] : role
}

// --- Modale d'invitation -----------------------------------------------------

function InviterModal({
  onClose,
  onInvited,
  linkedIntervenantIds,
}: {
  onClose: () => void
  onInvited: () => void
  /** intervenant_id déjà rattachés à un compte (à exclure du sélecteur). */
  linkedIntervenantIds: Set<string>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>(INVITABLE_ROLES[0])
  const [intervenantId, setIntervenantId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fiches équipe de l'entreprise (table `intervenants`, vue dirigeant).
  const { data: intervenantsData, loading: intervenantsLoading } = useIntervenants()

  // Intervenants encore disponibles = ceux non déjà liés à un compte.
  const intervenantsDisponibles = (intervenantsData ?? []).filter(
    (it) => !linkedIntervenantIds.has(String((it as Record<string, unknown>).id)),
  )

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Renseignez une adresse email valide.')
      return
    }
    setSubmitting(true)
    try {
      // Push 2 — `intervenantId` est OPTIONNEL : on ne l'envoie que s'il est
      // choisi (le back le rattache à entreprise_membres.intervenant_id).
      const payload: { email: string; role: UserRole; intervenantId?: string } = {
        email: trimmed,
        role,
      }
      if (intervenantId) payload.intervenantId = intervenantId

      const res = await fetch('/api/equipe/inviter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : "L'invitation n'a pas pu être envoyée."
        setError(msg)
        setSubmitting(false)
        return
      }
      toast.success('Invitation envoyée', {
        description: `Un email d'activation a été envoyé à ${trimmed}.`,
      })
      onInvited()
      onClose()
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-hanken">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
        />
        <div className="sticky top-0 z-10 bg-white border-b border-[#0f1a3a]/[0.06] px-6 py-4 flex items-center justify-between">
          <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em]">
            Inviter un membre
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#0f1a3a] hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleInvite}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm font-hanken text-gray-500 leading-relaxed">
              L&apos;invité recevra un email pour créer son mot de passe et activer son accès.
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-hanken rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <PremiumInput
              label="Adresse email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employe@exemple.fr"
              autoComplete="off"
              mono
            />

            <div>
              <PremiumSelect
                label="Rôle *"
                value={role}
                onChange={(e) => {
                  const v = e.target.value
                  if (isUserRole(v)) setRole(v)
                }}
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </PremiumSelect>
              <p
                aria-live="polite"
                className="mt-2 rounded-lg bg-[#ff7a1a]/[0.06] border border-[#ff7a1a]/15 px-3 py-2.5 font-hanken text-[13px] text-[#0f1a3a]/80 leading-relaxed"
              >
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>

            {/* Push 2 — Association OPTIONNELLE à une fiche intervenant.
                Indispensable pour un Ouvrier : c'est ce lien qui lui ouvre
                l'accès à SES chantiers affectés (sinon il ne verra rien). */}
            <div>
              <PremiumSelect
                label="Associer à un intervenant (fiche équipe)"
                value={intervenantId}
                onChange={(e) => setIntervenantId(e.target.value)}
                disabled={intervenantsLoading}
              >
                <option value="">
                  {intervenantsLoading
                    ? 'Chargement…'
                    : '— Aucun (à associer plus tard) —'}
                </option>
                {intervenantsDisponibles.map((it) => {
                  const row = it as Record<string, unknown>
                  const id = String(row.id)
                  const prenom = (row.prenom as string) || ''
                  const nom = (row.nom as string) || ''
                  const metier = (row.metier as string) || ''
                  const label =
                    `${prenom} ${nom}`.trim() + (metier ? ` — ${metier}` : '')
                  return (
                    <option key={id} value={id}>
                      {label || 'Intervenant'}
                    </option>
                  )
                })}
              </PremiumSelect>
              <p className="mt-2 font-hanken text-[12.5px] text-gray-500 leading-relaxed">
                {role === 'ouvrier'
                  ? "Recommandé pour un ouvrier : c'est ce lien qui lui donne accès aux chantiers où il est affecté."
                  : 'Facultatif. Relie ce compte à une fiche de votre équipe.'}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-[#0f1a3a]/[0.06] px-6 py-4 flex justify-end gap-3">
            <PremiumButton variant="secondary" type="button" onClick={onClose}>
              Annuler
            </PremiumButton>
            <PremiumButton
              variant="primary"
              type="submit"
              loading={submitting}
              disabled={submitting}
              icon={<UserPlus size={16} />}
            >
              Envoyer l&apos;invitation
            </PremiumButton>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Section principale ------------------------------------------------------

export default function ComptesAccesSection() {
  const { role, loading: roleLoading } = useCurrentRole()
  const { entreprise, loading: entLoading } = useEntreprise()
  const { membres, loading: membresLoading, refetch } = useEntrepriseMembres()
  const confirm = useConfirm()

  const [showInviter, setShowInviter] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loading = roleLoading || entLoading

  // Plan effectif : trial est traité comme "complete" (cf. lib/plans.ts).
  const planInfo = getEffectivePlan(entreprise)
  const planComplet = planInfo.hasFullAccess // trial OU complete OU lifetime

  // Comptes legacy mono-utilisateur : pas de ligne membre → on considère le
  // propriétaire historique comme dirigeant (il possède l'entreprise).
  const effectiveRole: UserRole = role ?? 'dirigeant'
  const estDirigeant = effectiveRole === 'dirigeant'

  // user_id du membre courant (pour ne pas proposer de se révoquer soi-même) :
  // on s'appuie sur le statut/role courant. Le membre dirigeant ne propose
  // jamais la révocation sur lui-même ni sur un autre dirigeant.

  const handleRevoke = async (m: EntrepriseMembre) => {
    const enAttente = m.statut === 'invite'
    const ok = await confirm({
      title: enAttente ? "Annuler l'invitation ?" : "Révoquer l'accès ?",
      message: enAttente
        ? 'Cette invitation sera annulée. Vous pourrez réinviter cette personne plus tard.'
        : `${membreLabel(m)} (${roleLabelOf(m.role)}) ne pourra plus se connecter. C'est réversible : vous pourrez le réinviter.`,
      confirmLabel: enAttente ? "Annuler l'invitation" : 'Révoquer',
      cancelLabel: enAttente ? 'Revenir' : 'Annuler',
      variant: 'danger',
    })
    if (!ok) return

    setRevoking(m.id)
    try {
      const res = await fetch('/api/equipe/revoquer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membreId: m.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        const msg =
          typeof data?.error === 'string' ? data.error : "La révocation a échoué."
        toast.error(msg)
        return
      }
      toast.success('Accès révoqué')
      refetch()
    } catch {
      toast.error('Erreur réseau. Réessayez.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <PremiumCard>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.02em] leading-tight">
              Comptes &amp; accès
            </h2>
            <p className="font-hanken text-sm text-gray-500 mt-0.5 leading-relaxed">
              Les personnes qui peuvent se connecter à votre espace Nexartis.
            </p>
          </div>
        </div>

        {estDirigeant && planComplet && (
          <PremiumButton
            variant="primary"
            icon={<UserPlus size={16} />}
            onClick={() => setShowInviter(true)}
          >
            Inviter un membre
          </PremiumButton>
        )}
      </div>

      {/* Encart upsell : dirigeant mais plan non complete (hors trial). */}
      {estDirigeant && !planComplet && (
        <div className="mb-5">
          <InfoBanner variant="warn">
            <span className="font-bold">Réservé à l&apos;offre Complet.</span>{' '}
            La gestion de comptes employés est incluse dans l&apos;offre Complet.{' '}
            <Link
              href="/dashboard/abonnement?upgrade=gestion_equipe"
              className="font-bold text-[#ff7a1a] hover:underline"
            >
              Passer à l&apos;offre Complet
            </Link>
          </InfoBanner>
        </div>
      )}

      {/* Liste des membres */}
      {loading || membresLoading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 border-[3px] border-gray-200 border-t-[#ff7a1a] rounded-full animate-spin mx-auto mb-3" />
          <p className="font-hanken text-sm text-gray-500">Chargement des comptes...</p>
        </div>
      ) : membres.length === 0 ? (
        estDirigeant && planComplet ? (
          <div className="py-9 px-6 text-center border border-dashed border-[#ff7a1a]/30 rounded-2xl bg-[#ff7a1a]/[0.03]">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff7a1a]/10 text-[#ff7a1a] mb-4">
              <UserPlus size={22} aria-hidden="true" />
            </span>
            <p className="font-hanken text-sm text-[#0f1a3a]/80 leading-relaxed max-w-sm mx-auto mb-5">
              Donnez à vos chefs de chantier l&apos;accès aux devis et au planning,
              sans jamais leur ouvrir vos finances.
            </p>
            <PremiumButton
              variant="primary"
              icon={<UserPlus size={16} />}
              onClick={() => setShowInviter(true)}
            >
              Inviter un membre
            </PremiumButton>
          </div>
        ) : (
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl">
            <p className="font-hanken text-sm text-gray-500">
              Aucun compte pour le moment.
            </p>
          </div>
        )
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden">
          {membres.map((m) => {
            const badge = STATUT_BADGE[m.statut]
            const peutRevoquer =
              estDirigeant && m.role !== 'dirigeant' && m.statut !== 'revoque'
            const enAttente = m.statut === 'invite'
            const inviteExpiree = enAttente && estExpiree(m.invite_expires_at)
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-hanken font-semibold text-[14.5px] text-[#0f1a3a] truncate">
                      {membreLabel(m)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0f1a3a]/[0.05] text-[#0f1a3a] text-[11px] font-hanken font-semibold">
                      {roleLabelOf(m.role)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-hanken font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {enAttente ? (
                    inviteExpiree ? (
                      <p className="font-hanken text-xs text-red-500 mt-1">
                        Invitation expirée
                      </p>
                    ) : (
                      <p className="font-hanken text-xs text-gray-400 mt-1">
                        Invitation expire le {formatDateLongue(m.invite_expires_at)}
                      </p>
                    )
                  ) : (
                    <p className="font-hanken text-xs text-gray-400 mt-1">
                      Ajouté le {formatDate(m.created_at)}
                    </p>
                  )}
                </div>

                {peutRevoquer && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(m)}
                    disabled={revoking === m.id}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-red-200 text-red-600 text-xs font-hanken font-bold hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                  >
                    {revoking === m.id
                      ? enAttente
                        ? 'Annulation...'
                        : 'Révocation...'
                      : enAttente
                        ? "Annuler l'invitation"
                        : "Révoquer l'accès"}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {showInviter && (
        <InviterModal
          onClose={() => setShowInviter(false)}
          onInvited={refetch}
          linkedIntervenantIds={
            new Set(
              membres
                .map((m) => m.intervenant_id)
                .filter((v): v is string => typeof v === 'string' && v.length > 0),
            )
          }
        />
      )}
    </PremiumCard>
  )
}
