'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  CreditCard,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Calendar,
  Shield,
  Award,
  Lock,
} from 'lucide-react'
import { useEntreprise, useUser, LoadingSkeleton } from '@/lib/hooks'
import { UPGRADE_MESSAGES, type FeatureKey } from '@/lib/plans'

// -------------------------------------------------------------------
// Constantes
// -------------------------------------------------------------------

const TRIAL_DAYS = 14
const PRICE_HT = 25
const PRICE_TTC = Math.round(PRICE_HT * 1.2 * 100) / 100 // 30 €

const FEATURES_INCLUDED = [
  'Devis illimités',
  'Factures illimitées',
  'Signature électronique',
  'Planning chantiers',
  'Alertes conflits équipe',
  'Tableau de bord CA',
  'Suivi des impayés simplifié',
  'Optimisé pour smartphone et tablette',
  'Facturation électronique intégrée',
  'Bibliothèque de vos prestations',
  'TVA 5.5%, 10%, 20% automatique',
  'Acomptes et factures de situation (#1, #2, #3 avec cumul d’avancement)',
  'Avoirs et rectifications',
  'Export PDF de chaque devis et facture',
  'Export CSV comptable (Sage / EBP / FEC) — à venir',
  'Données hébergées en Europe · RGPD strict',
  'Support par email Lun-Ven 9h-18h',
  'Mises à jour incluses à vie',
  'Aucune limite de clients ni de chantiers',
]

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

type AbonnementStatus = {
  type: 'trial' | 'actif' | 'suspendu' | 'lifetime'
  joursRestants: number | null
  expireAt: Date | null
  badge: { label: string; color: 'green' | 'orange' | 'red' | 'purple' | 'blue' }
  hasStripeSubscription: boolean
}

function computeStatus(entreprise: Record<string, unknown> | null): AbonnementStatus | null {
  if (!entreprise) return null

  const abonnementType = ((entreprise.abonnement_type as string) ?? 'trial') as AbonnementStatus['type']
  const stripeSubscriptionId = entreprise.stripe_subscription_id as string | null
  const hasStripeSubscription = !!stripeSubscriptionId

  if (abonnementType === 'lifetime') {
    return {
      type: 'lifetime',
      joursRestants: null,
      expireAt: null,
      badge: { label: 'Accès à vie', color: 'purple' },
      hasStripeSubscription: false,
    }
  }

  if (abonnementType === 'actif') {
    return {
      type: 'actif',
      joursRestants: null,
      expireAt: null,
      badge: { label: 'Actif', color: 'green' },
      hasStripeSubscription,
    }
  }

  if (abonnementType === 'suspendu') {
    const expireAt = entreprise.abonnement_expire_at
      ? new Date(entreprise.abonnement_expire_at as string)
      : null
    const joursRestants = expireAt
      ? Math.ceil((expireAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : -1
    return {
      type: 'suspendu',
      joursRestants,
      expireAt,
      badge: {
        label: joursRestants > 0 ? `Suspendu — ${joursRestants}j restants` : 'Suspendu',
        color: 'orange',
      },
      hasStripeSubscription: false,
    }
  }

  // Trial par défaut
  const trialStarted = entreprise.trial_started_at
    ? new Date(entreprise.trial_started_at as string)
    : new Date(entreprise.created_at as string)
  const expireAt = new Date(trialStarted.getTime() + TRIAL_DAYS * 86_400_000)
  const joursRestants = Math.ceil((expireAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isExpired = joursRestants < 0

  return {
    type: 'trial',
    joursRestants,
    expireAt,
    badge: {
      label: isExpired
        ? 'Essai expiré'
        : joursRestants === 0
          ? "Essai expire aujourd'hui"
          : joursRestants === 1
            ? 'Essai expire demain'
            : `Essai — ${joursRestants}j restants`,
      color: isExpired ? 'red' : joursRestants <= 3 ? 'orange' : 'blue',
    },
    hasStripeSubscription: false,
  }
}

// -------------------------------------------------------------------
// Toast (notification haut de page)
// -------------------------------------------------------------------

function Toast({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error'
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])

  const Icon = type === 'success' ? CheckCircle2 : XCircle
  // V4 : tons sémantiques translucides + bordure assortie, font Hanken.
  const colors =
    type === 'success'
      ? 'bg-emerald-50/80 border-emerald-200/70 text-emerald-900'
      : 'bg-red-50/80 border-red-200/70 text-red-900'
  const iconColor = type === 'success' ? 'text-emerald-600' : 'text-red-600'

  return (
    <div className={`mb-6 rounded-2xl border ${colors} px-5 py-4 flex items-start gap-3`}>
      <Icon size={22} className={`${iconColor} flex-shrink-0 mt-0.5`} />
      <p className="font-hanken text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-[#0f1a3a] transition-colors flex-shrink-0"
        aria-label="Fermer"
      >
        <XCircle size={18} />
      </button>
    </div>
  )
}

// -------------------------------------------------------------------
// Composant principal
// -------------------------------------------------------------------

function AbonnementPageContent() {
  const { entreprise, loading: loadingEntreprise } = useEntreprise()
  const { user, loading: loadingUser } = useUser()
  const searchParams = useSearchParams()

  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [cgvAccepted, setCgvAccepted] = useState(false)

  const isExpiredFlow = searchParams.get('expired') === '1'
  // ?upgrade=planning_chantier (ou autre feature) : on arrive ici depuis une
  // page bloquée pour les utilisateurs Essentiel. Affichage d'un bandeau
  // explicatif avec le message custom de UPGRADE_MESSAGES (cf. lib/plans.ts).
  const upgradeFeatureParam = searchParams.get('upgrade') as FeatureKey | null
  const upgradeInfo = upgradeFeatureParam ? UPGRADE_MESSAGES[upgradeFeatureParam] : null

  // Toast initial selon query params
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    if (success === '1') {
      setToast({
        type: 'success',
        message:
          "Abonnement activé ! Bienvenue dans la version complète de Nexartis. Votre première facture vous a été envoyée par email.",
      })
    } else if (canceled === '1') {
      setToast({
        type: 'error',
        message:
          "Paiement annulé. Aucune somme n'a été débitée. Vous pouvez recommencer quand vous voulez.",
      })
    }
  }, [searchParams])

  if (loadingEntreprise || loadingUser) {
    return <LoadingSkeleton rows={8} />
  }

  if (!entreprise || !user) {
    return (
      <div className="bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-8 text-center
                      shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
        <p className="font-hanken text-gray-500">
          Impossible de charger votre profil. Veuillez recharger la page.
        </p>
      </div>
    )
  }

  // L'admin ne paye jamais
  const ADMIN_EMAIL = 'admin@nexartis.fr'
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL

  const status = computeStatus(entreprise as unknown as Record<string, unknown>)
  if (!status) return null

  // Profil incomplet : on bloque le checkout pour éviter une facture sans SIRET
  const profilIncomplet =
    !entreprise.nom || !entreprise.siret || !entreprise.adresse || !entreprise.code_postal

  async function handleSubscribe() {
    if (!cgvAccepted) return
    setErrorMsg(null)
    setLoadingCheckout(true)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la création de la session de paiement')
      }
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL de paiement manquante')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inattendue')
      setLoadingCheckout(false)
    }
  }

  async function handlePortal() {
    setErrorMsg(null)
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Erreur lors de l'ouverture du portail")
      }
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL portail manquante')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inattendue')
      setLoadingPortal(false)
    }
  }

  // ─── Couleurs badge (V4 light premium — fonds translucides, contours assortis) ───
  const badgeColorMap: Record<AbonnementStatus['badge']['color'], string> = {
    green: 'bg-gradient-to-br from-emerald-100/80 to-emerald-50 text-emerald-700 border-emerald-200/60',
    orange: 'bg-gradient-to-br from-orange-100/80 to-orange-50 text-orange-700 border-orange-200/60',
    red: 'bg-gradient-to-br from-red-100/80 to-red-50 text-red-700 border-red-200/60',
    purple: 'bg-gradient-to-br from-purple-100/80 to-purple-50 text-purple-700 border-purple-200/60',
    blue: 'bg-gradient-to-br from-blue-100/80 to-blue-50 text-blue-700 border-blue-200/60',
  }

  // ─── Cas spécial : ADMIN ───
  if (isAdmin) {
    return (
      <div className="max-w-4xl">
        <div
          className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-10 text-center overflow-hidden
                     shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
        >
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500 opacity-90"
          />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mx-auto mb-4
                          shadow-[0_8px_20px_rgba(168,85,247,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Shield size={28} />
          </div>
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] mb-2">
            Accès Administrateur
          </h2>
          <p className="font-hanken text-gray-600 max-w-xl mx-auto">
            Le compte administrateur n&apos;a pas d&apos;abonnement. Aucune limite, aucun blocage,
            aucune facturation.
          </p>
        </div>
      </div>
    )
  }

  // ─── Cas spécial : LIFETIME ───
  if (status.type === 'lifetime') {
    return (
      <div className="max-w-4xl">
        <div
          className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-10 text-center overflow-hidden
                     shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
        >
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500 opacity-90"
          />
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white mx-auto mb-4
                          shadow-[0_8px_20px_rgba(168,85,247,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Award size={32} />
          </div>
          <h2 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] mb-3">
            Accès à vie
          </h2>
          <p className="font-hanken text-gray-700 text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
            Vous bénéficiez d&apos;un accès illimité et gratuit à Nexartis, pour toujours.
            Aucune facturation ne sera jamais émise sur votre compte.
          </p>
          <p className="font-hanken text-sm text-gray-500 italic">
            Merci pour votre soutien — c&apos;est grâce à vous que Nexartis grandit.
          </p>
        </div>
      </div>
    )
  }

  // L'utilisateur est expiré si :
  // - trial avec joursRestants < 0
  // - suspendu sans date ou avec date dépassée
  const isUserBlocked =
    (status.type === 'trial' && status.joursRestants !== null && status.joursRestants < 0) ||
    (status.type === 'suspendu' &&
      (status.expireAt === null || (status.joursRestants !== null && status.joursRestants <= 0)))

  return (
    <div className="max-w-5xl">
      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Bannière d'upgrade : utilisateur Essentiel qui a tenté d'accéder
          à une fonctionnalité réservée à l'offre Complet. Le message exact
          dépend de ?upgrade=<feature> dans l'URL. */}
      {upgradeInfo && (
        <div className="mb-6 rounded-2xl border border-[#ff7a1a]/30 bg-gradient-to-br from-[#fff3e5] to-[#fff8ef] p-5 sm:p-6
                        shadow-[0_4px_16px_rgba(255,122,26,0.08)]">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] flex items-center justify-center
                            shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-hanken font-extrabold text-lg sm:text-xl text-[#0f1a3a] tracking-[-0.025em] mb-1.5">
                {upgradeInfo.title}
              </h2>
              <p className="font-hanken text-sm text-gray-700 leading-relaxed">
                {upgradeInfo.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bannière de blocage : UTILISATEUR EXPIRÉ */}
      {(isUserBlocked || isExpiredFlow) && (
        <div className="mb-6 rounded-2xl border border-red-300/60 bg-gradient-to-br from-red-50 to-orange-50/60 p-5 sm:p-6
                        shadow-[0_4px_16px_rgba(220,38,38,0.08)]">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center
                            shadow-[0_8px_20px_rgba(220,38,38,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Lock size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-hanken font-extrabold text-lg sm:text-xl text-red-900 tracking-[-0.025em] mb-1.5">
                Accès suspendu — Souscrivez pour continuer
              </h2>
              <p className="font-hanken text-sm text-red-800 leading-relaxed mb-2">
                Toutes les pages de votre dashboard sont temporairement bloquées.
                Vos données (devis, factures, chantiers, clients) sont en sécurité et resteront
                accessibles dès la souscription.
              </p>
              <p className="font-hanken text-xs text-red-700 italic">
                Cliquez sur «&nbsp;Souscrire maintenant&nbsp;» ci-dessous pour réactiver votre compte
                en moins d&apos;une minute.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {errorMsg && (
        <div className="mb-6 rounded-2xl bg-red-50/80 border border-red-200/70 px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="font-hanken text-sm text-red-900 flex-1">{errorMsg}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE STATUT — V4 Light Premium avec accent line orange   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 mb-6 overflow-hidden
                   shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
      >
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
        />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="font-hanken font-semibold text-[11.5px] uppercase tracking-wider text-gray-500 mb-2">
              Votre statut actuel
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-hanken font-extrabold text-2xl sm:text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
                {status.type === 'trial' && status.joursRestants !== null && status.joursRestants >= 0
                  ? 'Période d’essai en cours'
                  : status.type === 'trial'
                    ? 'Période d’essai expirée'
                    : status.type === 'actif'
                      ? 'Abonnement actif'
                      : 'Abonnement suspendu'}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full border font-hanken text-[11.5px] font-bold tracking-wider uppercase ${badgeColorMap[status.badge.color]}`}
              >
                {status.badge.label}
              </span>
            </div>
          </div>
          {status.type === 'actif' && (
            <button
              onClick={handlePortal}
              disabled={loadingPortal}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white
                         font-hanken font-semibold text-sm text-[#0f1a3a]
                         hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPortal ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Ouverture…
                </>
              ) : (
                <>
                  <ExternalLink size={16} />
                  Gérer mon abonnement
                </>
              )}
            </button>
          )}
        </div>

        {/* Infos contextuelles selon le statut (banners V4) */}
        {status.type === 'trial' && status.expireAt && status.joursRestants !== null && status.joursRestants >= 0 && (
          <div className="rounded-xl bg-blue-50/80 border border-blue-200/70 p-4 flex items-start gap-3">
            <Calendar size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-hanken text-sm text-blue-900 font-medium">
                Votre essai gratuit se termine le{' '}
                <span className="font-spline-mono font-medium">{formatDateFr(status.expireAt)}</span>.
              </p>
              <p className="font-hanken text-xs text-blue-700 mt-1">
                Souscrivez avant cette date pour ne perdre aucune donnée.
                Aucune carte bancaire requise pour l&apos;essai.
              </p>
            </div>
          </div>
        )}

        {status.type === 'trial' && status.joursRestants !== null && status.joursRestants < 0 && (
          <div className="rounded-xl bg-red-50/80 border border-red-200/70 p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-hanken text-sm text-red-900 font-medium">
                Votre période d&apos;essai est terminée.
              </p>
              <p className="font-hanken text-xs text-red-700 mt-1">
                Vos données sont conservées en sécurité. Souscrivez maintenant pour retrouver l&apos;accès
                immédiat à votre dashboard.
              </p>
            </div>
          </div>
        )}

        {status.type === 'actif' && (
          <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/70 p-4 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-hanken text-sm text-emerald-900 font-medium">
                Merci pour votre confiance ! Votre abonnement Nexartis est actif.
              </p>
              <p className="font-hanken text-xs text-emerald-700 mt-1">
                Pour modifier votre carte, télécharger vos factures ou résilier, cliquez sur «&nbsp;Gérer
                mon abonnement&nbsp;». Vous serez redirigé vers le portail sécurisé Stripe.
              </p>
            </div>
          </div>
        )}

        {status.type === 'suspendu' && status.expireAt && status.joursRestants !== null && status.joursRestants > 0 && (
          <div className="rounded-xl bg-amber-50/80 border border-amber-200/70 p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-hanken text-sm text-amber-900 font-medium">
                Abonnement résilié — accès jusqu&apos;au{' '}
                <span className="font-spline-mono font-medium">{formatDateFr(status.expireAt)}</span>.
              </p>
              <p className="font-hanken text-xs text-amber-700 mt-1">
                Réactivez votre abonnement avant cette date pour ne perdre aucune donnée.
              </p>
            </div>
          </div>
        )}

        {status.type === 'suspendu' && status.joursRestants !== null && status.joursRestants <= 0 && (
          <div className="rounded-xl bg-red-50/80 border border-red-200/70 p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-hanken text-sm text-red-900 font-medium">
                Votre abonnement est suspendu.
              </p>
              <p className="font-hanken text-xs text-red-700 mt-1">
                Réactivez-le pour retrouver l&apos;accès à toutes vos données.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE PLAN + CTA — V4 Light Premium (carte blanche)        */}
      {/* UNIQUEMENT si pas encore actif                             */}
      {/* ──────────────────────────────────────────────────────────── */}
      {status.type !== 'actif' && (
        <div
          className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-10 overflow-hidden
                     shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
        >
          {/* Accent line orange */}
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
          />

          {/* Décoration subtile orange en haut à droite */}
          <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.08)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative">
            <div className="flex flex-col items-center text-center mb-8">
              <span
                className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full
                           bg-gradient-to-br from-[#fff3e5] to-[#fff8ef] border border-[#ff7a1a]/30
                           text-[#ff7a1a] font-hanken font-bold text-[11.5px] uppercase tracking-[0.12em]"
              >
                <Sparkles size={12} />
                Plan Nexartis
              </span>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-spline-mono font-medium text-[#0f1a3a] text-5xl sm:text-6xl tracking-[-0.02em] leading-none">
                  {PRICE_HT}€
                </span>
                <span className="font-hanken text-gray-500 text-lg font-semibold">
                  / mois HT
                </span>
              </div>
              <p className="font-hanken text-gray-500 text-sm">
                soit <span className="font-spline-mono font-medium">{PRICE_TTC.toFixed(2).replace('.', ',')}</span>&nbsp;€&nbsp;TTC&nbsp;·&nbsp;Sans engagement&nbsp;·&nbsp;Résiliable à tout moment
              </p>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-8" />

            {/* Liste features — V4 Light : checks orange, texte navy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 mb-8">
              {FEATURES_INCLUDED.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-2.5 text-[14px] text-[#0f1a3a] font-hanken"
                >
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="text-[#ff7a1a] flex-shrink-0 mt-0.5"
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Profil incomplet : alerte V4 ambre */}
            {profilIncomplet && (
              <div className="rounded-xl bg-amber-50/80 border border-amber-200/70 p-4 mb-6 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-hanken text-sm text-amber-900 font-semibold mb-1">
                    Complétez votre profil avant de souscrire
                  </p>
                  <p className="font-hanken text-xs text-amber-800 leading-relaxed">
                    Nexartis a besoin de votre nom d&apos;entreprise, SIRET et adresse pour générer
                    une facture conforme. Rendez-vous dans{' '}
                    <a
                      href="/dashboard/parametres"
                      className="underline hover:text-amber-950 transition-colors font-semibold"
                    >
                      Paramètres → Entreprise
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Acceptation des CGV avant paiement */}
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={cgvAccepted}
                onChange={e => setCgvAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 text-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/30 cursor-pointer accent-[#ff7a1a] shrink-0"
              />
              <span className="font-hanken text-[12px] text-gray-600 leading-relaxed">
                J&apos;ai lu et j&apos;accepte les{' '}
                <a href="/cgv" target="_blank" rel="noopener noreferrer" className="underline text-[#ff7a1a]">conditions générales de vente</a>{' '}
                et la{' '}
                <a href="/rgpd" target="_blank" rel="noopener noreferrer" className="underline text-[#ff7a1a]">politique de confidentialité</a>.
              </span>
            </label>

            {/* CTA principal V4 — gradient orange, lift au hover */}
            <button
              onClick={handleSubscribe}
              disabled={loadingCheckout || profilIncomplet || !cgvAccepted}
              className="
                w-full h-14 sm:h-16 rounded-2xl
                bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
                text-white font-hanken font-bold text-base sm:text-lg tracking-[-0.01em]
                shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
                hover:-translate-y-0.5 hover:brightness-105
                active:translate-y-0
                transition-all duration-[250ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                flex items-center justify-center gap-2
              "
            >
              {loadingCheckout ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Préparation de votre paiement…
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  {status.type === 'suspendu' ? 'Réactiver mon abonnement' : 'Souscrire maintenant'}
                </>
              )}
            </button>

            <p className="text-center text-[12px] text-gray-500 mt-4 font-hanken">
              Paiement sécurisé via Stripe&nbsp;·&nbsp;CB ou prélèvement&nbsp;·&nbsp;TVA collectée automatiquement
            </p>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE FAQ + LIENS UTILES — 3 mini-cards V4                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5
                        shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]
                        transition-all duration-200 hover:-translate-y-0.5">
          <h3 className="font-hanken font-bold text-sm text-[#0f1a3a] mb-2">
            Sans engagement
          </h3>
          <p className="font-hanken text-xs text-gray-500 leading-relaxed">
            Résiliez en un clic depuis le portail. Vos données restent accessibles
            pendant 90 jours après la résiliation.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5
                        shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]
                        transition-all duration-200 hover:-translate-y-0.5">
          <h3 className="font-hanken font-bold text-sm text-[#0f1a3a] mb-2">
            Paiement sécurisé
          </h3>
          <p className="font-hanken text-xs text-gray-500 leading-relaxed">
            Stripe est certifié PCI-DSS niveau 1. Vos informations bancaires
            ne sont jamais stockées sur nos serveurs.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5
                        shadow-[0_4px_16px_rgba(15,26,58,0.04),_0_1px_3px_rgba(15,26,58,0.04)]
                        transition-all duration-200 hover:-translate-y-0.5">
          <h3 className="font-hanken font-bold text-sm text-[#0f1a3a] mb-2">
            Une question ?
          </h3>
          <p className="font-hanken text-xs text-gray-500 leading-relaxed">
            Écrivez-nous à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-[#ff7a1a] underline hover:text-[#ff9d4d] transition-colors font-semibold"
            >
              contact.nexartis@gmail.com
            </a>
            . Réponse sous 24h.
          </p>
        </div>
      </div>
    </div>
  )
}

// useSearchParams nécessite un Suspense boundary
export default function AbonnementPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <AbonnementPageContent />
    </Suspense>
  )
}
