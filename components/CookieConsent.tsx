'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/**
 * Bandeau de consentement cookies — conforme CNIL (recommandation 2020-091)
 *
 * Points clés de conformité :
 *  ✅ Choix granulaire (3 catégories : essentiel, analytique, marketing)
 *  ✅ Boutons "Tout accepter" et "Tout refuser" strictement équivalents
 *     (même taille, même couleur, même position) — pas de dark pattern
 *  ✅ Refus aussi facile qu'acceptation (1 clic dans les deux cas)
 *  ✅ Cases analytique/marketing DÉCOCHÉES par défaut (consentement actif)
 *  ✅ Lien vers la politique cookies
 *  ✅ Conservation du choix limitée à 6 mois (puis redemandée)
 *  ✅ Possibilité de modifier ses choix à tout moment via le Footer
 *  ✅ Tant que l'utilisateur n'a pas répondu, AUCUN cookie non essentiel n'est posé
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type CookieCategory = 'necessary' | 'analytics' | 'marketing'

export interface CookieConsentState {
  necessary: true // toujours true (non négociable)
  analytics: boolean
  marketing: boolean
  /** Timestamp Unix ms du choix (pour expiration 6 mois) */
  timestamp: number
  /** Version du schéma pour pouvoir évoluer dans le futur */
  version: 1
}

const STORAGE_KEY = 'nexartis_cookie_consent_v1'
const CONSENT_DURATION_MS = 6 * 30 * 24 * 60 * 60 * 1000 // ~6 mois
const CONSENT_CHANGE_EVENT = 'nexartis-cookie-consent-change'
const OPEN_SETTINGS_EVENT = 'nexartis-cookie-open-settings'

// ─── Helpers exposés ──────────────────────────────────────────────────────────

/**
 * Lit le consentement actuel depuis localStorage.
 * Retourne null si pas de choix exprimé OU si le choix a expiré (> 6 mois).
 * Utilisable depuis n'importe quel autre composant (ex: GoogleAnalytics).
 */
export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentState
    if (parsed.version !== 1) return null
    if (Date.now() - parsed.timestamp > CONSENT_DURATION_MS) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Ouvre la modal de personnalisation depuis l'extérieur (ex: bouton
 * "Gérer les cookies" dans le Footer).
 */
export function openCookieSettings(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

// ─── Composant ────────────────────────────────────────────────────────────────

type View = 'hidden' | 'banner' | 'settings'

export default function CookieConsent() {
  const [view, setView] = useState<View>('hidden')
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  // Au montage : on regarde si un consentement valide existe déjà
  useEffect(() => {
    const existing = readCookieConsent()
    if (!existing) {
      setView('banner')
    } else {
      setAnalytics(existing.analytics)
      setMarketing(existing.marketing)
    }
  }, [])

  // Écoute du signal "ouvrir les paramètres" envoyé par le Footer
  useEffect(() => {
    const handler = () => {
      const existing = readCookieConsent()
      if (existing) {
        setAnalytics(existing.analytics)
        setMarketing(existing.marketing)
      }
      setView('settings')
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, handler)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler)
  }, [])

  // Sauvegarde un état de consentement et notifie les autres composants
  const saveConsent = useCallback(
    (next: { analytics: boolean; marketing: boolean }) => {
      const state: CookieConsentState = {
        necessary: true,
        analytics: next.analytics,
        marketing: next.marketing,
        timestamp: Date.now(),
        version: 1,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        window.dispatchEvent(
          new CustomEvent(CONSENT_CHANGE_EVENT, { detail: state }),
        )
      } catch {
        // localStorage indisponible (navigation privée stricte, etc.)
      }
      setView('hidden')
    },
    [],
  )

  const handleAcceptAll = () => saveConsent({ analytics: true, marketing: true })
  const handleRejectAll = () => saveConsent({ analytics: false, marketing: false })
  const handleSavePersonalized = () =>
    saveConsent({ analytics, marketing })

  if (view === 'hidden') return null

  // ─── Bandeau initial ─────────────────────────────────────────────────────
  if (view === 'banner') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-desc"
        className="fixed inset-x-0 bottom-0 z-[9999] border-t border-cream/10 bg-navy/95 px-4 py-5 text-cream shadow-2xl backdrop-blur-md sm:px-6"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p id="cookie-banner-title" className="font-syne text-base font-bold">
              Cookies &amp; vie privée
            </p>
            <p id="cookie-banner-desc" className="mt-1 text-sm leading-relaxed text-cream/80">
              Nexartis utilise des cookies pour le fonctionnement du site et,
              avec votre accord, pour la mesure d&apos;audience. Vous pouvez
              accepter, refuser ou personnaliser. Refuser n&apos;a aucun impact
              sur votre utilisation du service.{' '}
              <Link
                href="/cookies"
                className="underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-orange/60"
              >
                En savoir plus
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Boutons Accepter et Refuser STRICTEMENT identiques visuellement */}
            <button
              type="button"
              onClick={handleRejectAll}
              className="inline-flex items-center justify-center rounded-lg border border-cream/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/40"
            >
              Tout refuser
            </button>
            <button
              type="button"
              onClick={() => setView('settings')}
              className="inline-flex items-center justify-center rounded-lg border border-cream/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/40"
            >
              Personnaliser
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="inline-flex items-center justify-center rounded-lg border border-cream/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/40"
            >
              Tout accepter
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Modal de personnalisation ───────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-settings-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* En-tête */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="cookie-settings-title"
              className="font-syne text-xl font-bold text-navy sm:text-2xl"
            >
              Préférences de cookies
            </h2>
            <button
              type="button"
              onClick={() => setView('hidden')}
              aria-label="Fermer sans enregistrer"
              className="rounded-lg p-1.5 text-navy/60 transition hover:bg-gray-100 hover:text-navy focus:outline-none focus:ring-2 focus:ring-orange/40"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm text-navy/70">
            Choisissez les catégories de cookies que vous acceptez. Vous pourrez
            modifier ces choix à tout moment via le lien « Gérer les cookies »
            en bas de page. Plus d&apos;info dans notre{' '}
            <Link href="/cookies" className="text-sky underline-offset-2 hover:underline">
              politique cookies
            </Link>
            .
          </p>
        </div>

        {/* Liste des catégories */}
        <div className="divide-y divide-gray-200">
          {/* Essentiel — toujours actif */}
          <CategoryRow
            id="cat-necessary"
            title="Cookies strictement nécessaires"
            description="Indispensables au fonctionnement du site (authentification, session, mémorisation de vos préférences cookies). Ne peuvent pas être désactivés."
            checked={true}
            disabled={true}
            onChange={() => {}}
            badge="Toujours actif"
          />

          {/* Mesure d'audience */}
          <CategoryRow
            id="cat-analytics"
            title="Mesure d'audience"
            description="Nous aide à comprendre comment vous utilisez Nexartis pour améliorer le service. Mesure réalisée via Google Analytics 4 (adresse IP tronquée, pas de publicité ciblée, pas de signaux Google)."
            checked={analytics}
            disabled={false}
            onChange={setAnalytics}
          />

          {/* Marketing */}
          <CategoryRow
            id="cat-marketing"
            title="Marketing &amp; personnalisation"
            description="Aucun cookie marketing n'est utilisé actuellement par Nexartis. Cette option est présente pour transparence et pourrait être utilisée à l'avenir avec votre consentement explicite."
            checked={marketing}
            disabled={false}
            onChange={setMarketing}
          />
        </div>

        {/* Pied : boutons */}
        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleRejectAll}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            Tout refuser
          </button>
          <button
            type="button"
            onClick={handleSavePersonalized}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            Enregistrer mes choix
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sous-composant : ligne de catégorie ──────────────────────────────────────

function CategoryRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
  badge,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
  badge?: string
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="font-syne text-sm font-bold text-navy sm:text-base">
            {title}
          </label>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-sky/15 px-2.5 py-0.5 text-xs font-medium text-sky">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-navy/70">{description}</p>
      </div>

      {/* Toggle accessible */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Activer ${title}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          checked
            ? disabled
              ? 'bg-sky/60 focus:ring-sky/40'
              : 'bg-orange focus:ring-orange/40'
            : 'bg-gray-300 focus:ring-gray-400'
        } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
