'use client'

/**
 * OnboardingTour — Tutoriel guidé pour les nouveaux utilisateurs.
 *
 * Trois scénarios gérés :
 *
 * 1. Sur /dashboard (1er login) : grosse infobulle (style spotlight)
 *    pointant vers le lien "Paramètres" de la sidebar, pour inciter
 *    à compléter le profil entreprise. Au clic du bouton final
 *    "Compris, j'y vais" : navigation vers /dashboard/parametres.
 *    Si l'utilisateur ferme la bulle par la croix : on skippe TOUT
 *    le flux dashboard+parametres (il a explicitement refusé).
 *
 * 2. Sur /dashboard/parametres (suite de l'étape 1) : une bulle
 *    qui entoure la zone principale de la page pour confirmer
 *    "C'est bien ici que tu remplis ton profil entreprise."
 *    Ne s'affiche que si la bulle 1 a été terminée par "Compris,
 *    j'y vais" (pas par la croix).
 *
 * 3. Sur /dashboard/devis/nouveau (1er devis) : deux infobulles
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
import { usePathname, useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/hooks'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// Délai laissé au DOM avant de lancer le tour (les éléments cibles
// peuvent être montés après un useEffect, surtout sur le dashboard
// où il y a des animations de stagger).
const TOUR_DELAY_MS = 600

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
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

        // Drapeau pour distinguer "fermeture par le bouton" vs
        // "fermeture par la croix / Échap / clic extérieur".
        let userClickedNext = false

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
          onNextClick: () => {
            // L'utilisateur a cliqué "Compris, j'y vais" : on
            // marque seulement la bulle 1 comme vue (pas la 2)
            // puis on l'emmène sur la page Paramètres où la
            // bulle 2 se déclenchera automatiquement.
            userClickedNext = true
            markStepSeen('dashboard')
            d.destroy()
            router.push('/dashboard/parametres')
          },
          onCloseClick: () => {
            // Croix : l'utilisateur refuse explicitement le tour.
            // On skippe les deux bulles (dashboard + parametres)
            // pour ne pas le saouler s'il va sur Paramètres
            // de lui-même plus tard.
            markStepSeen('skipAll')
            d.destroy()
          },
          onDestroyed: () => {
            // Fallback : si fermé par Échap ou clic extérieur
            // sans passer par onNextClick/onCloseClick.
            if (!userClickedNext) {
              markStepSeen('skipAll')
            }
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
    // SCÉNARIO 2 — Page Paramètres (suite étape 1)
    // ============================================
    // Affichée seulement quand l'utilisateur a déjà vu la bulle 1
    // (donc cliqué "Compris j'y vais") mais pas encore la bulle 2.
    if (
      pathname === '/dashboard/parametres' &&
      state.tour_dashboard_seen &&
      !state.tour_parametres_seen
    ) {
      const timer = setTimeout(() => {
        const target = document.querySelector('[data-tour="parametres-content"]') as HTMLElement | null
        if (!target) {
          markStepSeen('parametres')
          return
        }

        const d = driver({
          showProgress: false,
          showButtons: ['next', 'close'],
          nextBtnText: 'C\'est parti',
          doneBtnText: 'C\'est parti',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.65,
          onDestroyed: () => {
            // Quelle que soit la façon dont l'utilisateur ferme,
            // on marque la bulle 2 comme vue (pas de skipAll ici
            // car le tour est déjà bien engagé).
            markStepSeen('parametres')
          },
          steps: [
            {
              element: '[data-tour="parametres-content"]',
              popover: {
                title: 'Tu y es !',
                description: `
                  <p style="margin: 0 0 10px 0;">C'est ici que tu remplis ton profil entreprise. <strong>Coche toutes les sections</strong> (Entreprise, Documents, Facturation, Signature…).</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">Chaque case remplie est réutilisée automatiquement dans tes devis et factures. Une fois fait, tu es prêt à créer ton premier devis pro.</p>
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

    // ============================================
    // SCÉNARIO 3 — Page création devis (1er devis)
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
  }, [pathname, state, loading, markStepSeen, router])

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
