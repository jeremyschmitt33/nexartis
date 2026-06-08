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
  'Prêt pour la facturation électronique 2026',
  'Bibliothèque de vos prestations',
  'TVA 5.5%, 10%, 20% automatique',
  'Acomptes et situations de travaux',
  'Avoirs et rectifications',
  'Export comptable (CSV/PDF)',
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
  const colors =
    type === 'success'
      ? 'bg-green-50 border-green-200 text-green-900'
      : 'bg-red-50 border-red-200 text-red-900'
  const iconColor = type === 'success' ? 'text-green-600' : 'text-red-600'

  return (
    <div className={`mb-6 rounded-xl border-2 ${colors} px-5 py-4 flex items-start gap-3`}>
      <Icon size={22} className={`${iconColor} flex-shrink-0 mt-0.5`} />
      <p className="font-manrope text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
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

  const isExpiredFlow = searchParams.get('expired') === '1'

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
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="font-manrope text-gray-500">
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

  // ─── Couleurs badge ───
  const badgeColorMap: Record<AbonnementStatus['badge']['color'], string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  // ─── Cas spécial : ADMIN ───
  if (isAdmin) {
    return (
      <div className="max-w-4xl">
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 text-center">
          <Shield size={48} className="text-purple-600 mx-auto mb-4" />
          <h2 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
            Accès Administrateur
          </h2>
          <p className="font-manrope text-gray-600 max-w-xl mx-auto">
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
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-10 text-center">
          <Award size={56} className="text-purple-600 mx-auto mb-4" />
          <h2 className="font-syne font-bold text-3xl text-[#1a1a2e] mb-3">
            Accès à vie
          </h2>
          <p className="font-manrope text-gray-700 text-lg max-w-2xl mx-auto mb-6">
            Vous bénéficiez d&apos;un accès illimité et gratuit à Nexartis, pour toujours.
            Aucune facturation ne sera jamais émise sur votre compte.
          </p>
          <p className="font-manrope text-sm text-gray-500 italic">
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

      {/* Bannière de blocage : UTILISATEUR EXPIRÉ */}
      {(isUserBlocked || isExpiredFlow) && (
        <div className="mb-6 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shadow-lg">
              <Lock size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-syne font-bold text-lg sm:text-xl text-red-900 mb-1.5">
                Accès suspendu — Souscrivez pour continuer
              </h2>
              <p className="font-manrope text-sm text-red-800 leading-relaxed mb-2">
                Toutes les pages de votre dashboard sont temporairement bloquées.
                Vos données (devis, factures, chantiers, clients) sont en sécurité et resteront
                accessibles dès la souscription.
              </p>
              <p className="font-manrope text-xs text-red-700 italic">
                Cliquez sur «&nbsp;Souscrire maintenant&nbsp;» ci-dessous pour réactiver votre compte
                en moins d&apos;une minute.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {errorMsg && (
        <div className="mb-6 rounded-xl bg-red-50 border-2 border-red-200 px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="font-manrope text-sm text-red-900 flex-1">{errorMsg}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE STATUT — toujours visible en haut                    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="font-manrope text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
              Votre statut actuel
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-syne font-bold text-2xl sm:text-3xl text-[#1a1a2e]">
                {status.type === 'trial' && status.joursRestants !== null && status.joursRestants >= 0
                  ? 'Période d’essai en cours'
                  : status.type === 'trial'
                    ? 'Période d’essai expirée'
                    : status.type === 'actif'
                      ? 'Abonnement actif'
                      : 'Abonnement suspendu'}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full border font-manrope text-xs font-semibold ${badgeColorMap[status.badge.color]}`}
              >
                {status.badge.label}
              </span>
            </div>
          </div>
          {status.type === 'actif' && (
            <button
              onClick={handlePortal}
              disabled={loadingPortal}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-2 border-[#1a1a2e] bg-white hover:bg-gray-50 text-[#1a1a2e] font-syne font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loadingPortal ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Ouverture...
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

        {/* Infos contextuelles selon le statut */}
        {status.type === 'trial' && status.expireAt && status.joursRestants !== null && status.joursRestants >= 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Calendar size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-manrope text-sm text-blue-900 font-medium">
                Votre essai gratuit se termine le{' '}
                <span className="font-bold">{formatDateFr(status.expireAt)}</span>.
              </p>
              <p className="font-manrope text-xs text-blue-700 mt-1">
                Souscrivez avant cette date pour ne perdre aucune donnée.
                Aucune carte bancaire requise pour l&apos;essai.
              </p>
            </div>
          </div>
        )}

        {status.type === 'trial' && status.joursRestants !== null && status.joursRestants < 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-manrope text-sm text-red-900 font-medium">
                Votre période d&apos;essai est terminée.
              </p>
              <p className="font-manrope text-xs text-red-700 mt-1">
                Vos données sont conservées en sécurité. Souscrivez maintenant pour retrouver l&apos;accès
                immédiat à votre dashboard.
              </p>
            </div>
          </div>
        )}

        {status.type === 'actif' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-manrope text-sm text-green-900 font-medium">
                Merci pour votre confiance ! Votre abonnement Nexartis est actif.
              </p>
              <p className="font-manrope text-xs text-green-700 mt-1">
                Pour modifier votre carte, télécharger vos factures ou résilier, cliquez sur «&nbsp;Gérer
                mon abonnement&nbsp;». Vous serez redirigé vers le portail sécurisé Stripe.
              </p>
            </div>
          </div>
        )}

        {status.type === 'suspendu' && status.expireAt && status.joursRestants !== null && status.joursRestants > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-manrope text-sm text-orange-900 font-medium">
                Abonnement résilié — accès jusqu&apos;au{' '}
                <span className="font-bold">{formatDateFr(status.expireAt)}</span>.
              </p>
              <p className="font-manrope text-xs text-orange-700 mt-1">
                Réactivez votre abonnement avant cette date pour ne perdre aucune donnée.
              </p>
            </div>
          </div>
        )}

        {status.type === 'suspendu' && status.joursRestants !== null && status.joursRestants <= 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-manrope text-sm text-red-900 font-medium">
                Votre abonnement est suspendu.
              </p>
              <p className="font-manrope text-xs text-red-700 mt-1">
                Réactivez-le pour retrouver l&apos;accès à toutes vos données.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE PLAN + CTA — UNIQUEMENT si pas encore actif          */}
      {/* ──────────────────────────────────────────────────────────── */}
      {status.type !== 'actif' && (
        <div className="bg-gradient-to-br from-[#0f1a3a] via-[#0f1a3a] to-[#1a2554] rounded-2xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(15,26,58,0.25)] relative overflow-hidden">
          {/* Décoration de fond */}
          <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(90,180,224,0.15)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-[250px] h-[250px] rounded-full bg-[radial-gradient(circle,rgba(232,122,42,0.08)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative">
            <div className="flex flex-col items-center text-center mb-8">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1 rounded-full mb-4 bg-[rgba(232,122,42,0.15)] text-[#e87a2a]">
                <Sparkles size={12} />
                Plan Nexartis
              </span>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-syne font-extrabold text-white text-5xl sm:text-6xl tabular-nums leading-none">
                  {PRICE_HT}€
                </span>
                <span className="font-manrope text-white/60 text-lg font-semibold">
                  / mois HT
                </span>
              </div>
              <p className="font-manrope text-white/50 text-sm">
                soit {PRICE_TTC.toFixed(2).replace('.', ',')}&nbsp;€&nbsp;TTC&nbsp;·&nbsp;Sans engagement&nbsp;·&nbsp;Résiliable à tout moment
              </p>
            </div>

            <div className="h-px w-full bg-white/10 mb-8" />

            {/* Liste features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 mb-8">
              {FEATURES_INCLUDED.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-2.5 text-[14px] text-white/80 font-manrope"
                >
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="text-[#5ab4e0] flex-shrink-0 mt-0.5"
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Profil incomplet : alerte */}
            {profilIncomplet && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-manrope text-sm text-white font-medium mb-1">
                    Complétez votre profil avant de souscrire
                  </p>
                  <p className="font-manrope text-xs text-white/60">
                    Nexartis a besoin de votre nom d&apos;entreprise, SIRET et adresse pour générer
                    une facture conforme. Rendez-vous dans{' '}
                    <a
                      href="/dashboard/parametres"
                      className="underline hover:text-white transition-colors"
                    >
                      Paramètres → Entreprise
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* CTA principal */}
            <button
              onClick={handleSubscribe}
              disabled={loadingCheckout || profilIncomplet}
              className="w-full h-14 sm:h-16 rounded-xl bg-[#e87a2a] hover:bg-[#f09050] disabled:bg-[#e87a2a]/50 disabled:cursor-not-allowed text-white font-syne font-bold text-base sm:text-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              {loadingCheckout ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Préparation de votre paiement...
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  {status.type === 'suspendu' ? 'Réactiver mon abonnement' : 'Souscrire maintenant'}
                </>
              )}
            </button>

            <p className="text-center text-[12px] text-white/40 mt-4 font-manrope">
              Paiement sécurisé via Stripe&nbsp;·&nbsp;CB ou prélèvement&nbsp;·&nbsp;TVA collectée automatiquement
            </p>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CARTE FAQ + LIENS UTILES                                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-syne font-bold text-sm text-[#1a1a2e] mb-2">
            Sans engagement
          </h3>
          <p className="font-manrope text-xs text-gray-500 leading-relaxed">
            Résiliez en un clic depuis le portail. Vos données restent accessibles
            pendant 30 jours après la résiliation.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-syne font-bold text-sm text-[#1a1a2e] mb-2">
            Paiement sécurisé
          </h3>
          <p className="font-manrope text-xs text-gray-500 leading-relaxed">
            Stripe est certifié PCI-DSS niveau 1. Vos informations bancaires
            ne sont jamais stockées sur nos serveurs.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-syne font-bold text-sm text-[#1a1a2e] mb-2">
            Une question ?
          </h3>
          <p className="font-manrope text-xs text-gray-500 leading-relaxed">
            Écrivez-nous à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-[#5ab4e0] underline hover:text-[#3a94c0] transition-colors"
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
