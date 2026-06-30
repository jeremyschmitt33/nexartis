'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { readCookieConsent } from './CookieConsent'

/**
 * Composant Google Analytics 4
 *
 * Ne se charge QUE si l'utilisateur a explicitement consenti à la mesure
 * d'audience via la bannière cookies (catégorie "analytics").
 *
 * Écoute l'événement `nexartis-cookie-consent-change` pour activer GA
 * sans recharger la page quand l'utilisateur passe de "refusé" à "accepté".
 *
 * NB : passer de "accepté" à "refusé" ne désactive pas instantanément GA si
 * le script gtag.js est déjà chargé. C'est une limitation connue de GA. La
 * solution la plus propre serait de pousser `gtag('consent', 'update', ...)`
 * ce qui désactive le tracking sans décharger le script. À implémenter quand
 * on aura du temps (P14 du backlog d'audit). Pour l'instant l'utilisateur
 * peut effacer manuellement les cookies _ga* depuis son navigateur.
 */
export default function GoogleAnalytics() {
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(false)

  useEffect(() => {
    // 1) Lecture initiale
    const initial = readCookieConsent()
    if (initial?.analytics === true) {
      setHasAnalyticsConsent(true)
    }

    // 2) Écoute des changements de consentement
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail as { analytics?: boolean } | undefined
      if (detail) {
        setHasAnalyticsConsent(detail.analytics === true)
      } else {
        // Si pas de détail, on relit depuis le storage par sécurité
        const fresh = readCookieConsent()
        setHasAnalyticsConsent(fresh?.analytics === true)
      }
    }

    window.addEventListener('nexartis-cookie-consent-change', handler)
    return () =>
      window.removeEventListener('nexartis-cookie-consent-change', handler)
  }, [])

  // .trim() : neutralise un espace ou retour a la ligne parasite dans la
  // variable NEXT_PUBLIC_GA_ID (sinon le script gtag casse -> SyntaxError
  // sur toutes les pages et analytics non configure).
  const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim()

  // Ne rien charger si pas de consentement OU si pas d'ID de mesure configuré
  if (!hasAnalyticsConsent || !measurementId) return null

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              allow_google_signals: false,
              allow_ad_personalization: false,
            });
          `,
        }}
      />
    </>
  )
}
