'use client'

/**
 * OnboardingTour — Tutoriel guidé pour les nouveaux utilisateurs.
 *
 * Deux scénarios gérés :
 *
 * 1. Sur /dashboard (1er login) : grosse infobulle (style spotlight)
 *    pointant vers le lien "Paramètres" de la sidebar, pour inciter
 *    à compléter le profil entreprise (qui pré-remplit tous les
 *    devis et factures).
 *
 * 2. Sur /dashboard/devis/nouveau (1er devis) : deux infobulles
 *    séquentielles — l'une sur la zone Client (sauvegarde auto +
 *    autocomplete dans les prochains devis), l'autre sur la zone
 *    Prestations (bibliothèque réutilisable).
 *
 * État stocké en base via le hook useOnboarding (table
 * `user_onboarding`). Un utilisateur ayant vu ou skippé l'étape
 * ne la revoit plus, sauf s'il clique sur "Revoir la visite guidée"
 * dans Paramètres > Compte (resetOnboarding).
 *
 * Le composant se monte dans `app/dashboard/layout.tsx` pour être
 * actif sur toutes les pages du dashboard.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '@/lib/hooks'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// Délai laissé au DOM avant de lancer le tour (les éléments cibles
// peuvent être montés après un useEffect, surtout sur le dashboard
// où il y a des animations de stagger).
const TOUR_DELAY_MS = 600

export default function OnboardingTour() {
  const pathname = usePathname()
  const { state, loading, markStepSeen } = useOnboarding()
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    // On attend le chargement de l'état utilisateur
    if (loading || !state) return

    // Nettoyer toute instance précédente avant d'en relancer une
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }

    // ============================================
    // SCÉNARIO 1 — Dashboard d'accueil (1er login)
    // ============================================
    if (pathname === '/dashboard' && !state.tour_dashboard_seen) {
      const timer = setTimeout(() => {
        const target = document.querySelector('[data-tour="parametres"]') as HTMLElement | null
        if (!target) {
          // Élément non trouvé (sidebar pas encore montée) → on marque
          // comme vu pour ne pas boucler indéfiniment
          markStepSeen('dashboard')
          return
        }

        const d = driver({
          showProgress: false,
          showButtons: ['next', 'close'],
          nextBtnText: 'Compris, j\'y vais',
          doneBtnText: 'Compris, j\'y vais',
          stagePadding: 6,
          stageRadius: 10,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.7,
          onDestroyed: () => {
            // Appelé quand l'utilisateur ferme (croix, Échap, clic
            // dehors) OU termine le tour (bouton final).
            markStepSeen('dashboard')
          },
          steps: [
            {
              element: '[data-tour="parametres"]',
              popover: {
                title: 'Bienvenue sur Nexartis !',
                description: `
                  <p style="margin: 0 0 10px 0;">Avant de créer ton premier devis, prends <strong>2 minutes</strong> pour compléter ton profil entreprise dans les <strong>Paramètres</strong>.</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">Ton SIRET, ton logo, tes mentions légales et ton IBAN seront <strong>automatiquement insérés</strong> dans tous tes devis et factures. Plus jamais à les retaper.</p>
                `,
                side: 'right',
                align: 'center',
              },
            },
          ],
        })

        driverRef.current = d
        d.drive()
      }, TOUR_DELAY_MS)

      return () => clearTimeout(timer)
    }

    // ============================================
    // SCÉNARIO 2 — Page création devis (1er devis)
    // ============================================
    if (pathname === '/dashboard/devis/nouveau' && !state.tour_devis_seen) {
      const timer = setTimeout(() => {
        const targetClient = document.querySelector('[data-tour="devis-client"]') as HTMLElement | null
        const targetPrestations = document.querySelector('[data-tour="devis-prestations"]') as HTMLElement | null

        if (!targetClient || !targetPrestations) {
          // Une des cibles n'est pas montée → on attend, ou on skippe
          // proprement après plusieurs tentatives. Ici on marque
          // comme vu pour éviter de bloquer l'utilisateur.
          markStepSeen('devis')
          return
        }

        const d = driver({
          showProgress: true,
          progressText: 'Étape {{current}} / {{total}}',
          showButtons: ['next', 'previous', 'close'],
          nextBtnText: 'Suivant',
          prevBtnText: 'Précédent',
          doneBtnText: 'Compris, je crée mon devis',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.65,
          onDestroyed: () => {
            markStepSeen('devis')
          },
          steps: [
            {
              element: '[data-tour="devis-client"]',
              popover: {
                title: 'Le client est sauvegardé automatiquement',
                description: `
                  <p style="margin: 0 0 10px 0;">Saisis les coordonnées de ton client une seule fois.</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">À ton prochain devis, il suffira de <strong>commencer à taper son nom</strong> : l'autocomplete te le proposera et remplira tous les champs (adresse, téléphone, email...) automatiquement.</p>
                `,
                side: 'left',
                align: 'start',
              },
            },
            {
              element: '[data-tour="devis-prestations"]',
              popover: {
                title: 'Tes prestations rejoignent ta bibliothèque',
                description: `
                  <p style="margin: 0 0 10px 0;">Chaque ligne de prestation que tu ajoutes ici (désignation, prix, unité) est <strong>enregistrée dans ta bibliothèque</strong>.</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">La prochaine fois, tu pourras la <strong>réutiliser en un clic</strong> au lieu de tout retaper. Tu retrouves toute ta bibliothèque dans <em>Prestations</em> via la barre latérale.</p>
                `,
                side: 'top',
                align: 'center',
              },
            },
          ],
        })

        driverRef.current = d
        d.drive()
      }, TOUR_DELAY_MS)

      return () => clearTimeout(timer)
    }
  }, [pathname, state, loading, markStepSeen])

  // Nettoyage final au démontage du composant
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [])

  // Le composant ne rend rien lui-même : driver.js injecte son
  // propre DOM (overlay + popover) directement dans <body>.
  return null
}
