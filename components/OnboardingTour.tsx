'use client'

/**
 * OnboardingTour — Tutoriel guidé pour les nouveaux utilisateurs.
 *
 * V3 (09/06/2026) : extension de 3 à 8 bulles.
 *
 * Scénarios :
 *
 * 1. Sur /dashboard (1er login) : enchaînement de plusieurs bulles
 *    en un seul driver.drive() :
 *      - Bulle "Installe Nexartis sur ton téléphone" (cible le
 *        bandeau PWA — skippée si pas montée dans le DOM).
 *      - Bulle "Dicte tes devis et factures" (cible le bouton
 *        vocal — skippée si plan Essentiel hors trial).
 *      - Bulle "Ton inventaire pro" (cible le lien Matériel de la
 *        sidebar — ride-along sur tour_dashboard_seen, pas de flag
 *        dédié, skippée si sidebar pas montée).
 *      - Spotlight original sur le lien "Paramètres" de la sidebar,
 *        avec navigation vers /dashboard/parametres au clic final.
 *    Si l'utilisateur ferme la chaîne par la croix : on skippe
 *    UNIQUEMENT les bulles dashboard (install + voice + dashboard).
 *    Les autres scénarios (parametres, equipe, chantier, devis)
 *    restent actifs.
 *
 * 2. Sur /dashboard/parametres : 4 bulles séquentielles :
 *      - "Tu y es" sur la zone profil (confirmation).
 *      - "Habille tes documents à tes couleurs" sur l'onglet
 *        Documents (personnalisation thème).
 *      - "Pense à créer ton équipe" (mode Société uniquement).
 *      - "Besoin d'aide à tout moment ?" sur l'onglet Aide.
 *
 * 3. Sur /dashboard/equipe (1ère visite) : bulle "Mode Solo ou
 *    Société" sur le header de page.
 *
 * 4. Sur /dashboard/chantiers/[id] (1er chantier consulté) : bulle
 *    "Tiens un journal de chantier" sur le bloc Notes & rappels.
 *
 * 5. Sur /dashboard/devis/nouveau (1er devis) : 2 bulles
 *    séquentielles sur la zone Client + Prestations (inchangé).
 *
 * État stocké en base via le hook useOnboarding (table
 * `user_onboarding`). Migration v3 :
 * `lib/supabase/migration-onboarding-step3.sql` (ajoute 5 colonnes).
 *
 * IMPORTANT : pour ne pas saouler les anciens utilisateurs, la
 * migration v3 positionne les 5 nouvelles colonnes à TRUE pour
 * ceux ayant déjà tour_completed_at IS NOT NULL. Aucun bandeau
 * "Nouveautés" n'est affiché.
 *
 * Le composant se monte dans `app/dashboard/layout.tsx` pour être
 * actif sur toutes les pages du dashboard.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOnboarding, useEntreprise } from '@/lib/hooks'
import { isAutoEntrepreneur } from '@/lib/helpers'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// Délai laissé au DOM avant de lancer le tour (les éléments cibles
// peuvent être montés après un useEffect, surtout sur le dashboard
// où il y a des animations de stagger).
const TOUR_DELAY_MS = 600

// Helper : construit un step driver.js si l'élément cible existe
// dans le DOM. Retourne null sinon (le scénario fera Array.filter
// pour ne garder que les steps utilisables).
function buildStep(
  selector: string,
  title: string,
  description: string,
  side: 'top' | 'right' | 'bottom' | 'left',
  align: 'start' | 'center' | 'end' = 'center'
): DriveStep | null {
  const el = document.querySelector(selector)
  if (!el) return null
  return {
    element: selector,
    popover: {
      title,
      description,
      side,
      align,
    },
  }
}

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, loading, markStepSeen } = useOnboarding()
  // V1 Fix #7 (28/05/2026) : on lit la forme juridique pour ajouter
  // une bulle "Mon équipe" supplémentaire en mode Société uniquement.
  const { entreprise } = useEntreprise()
  const isSociete = !isAutoEntrepreneur(entreprise)
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
    // V3 (09/06/2026) : on enchaine install + voice + dashboard
    // dans un SEUL driver.drive() pour fluidifier l'UX. Chaque
    // step est conditionnel a la presence de son DOM et a son
    // flag "seen" en base.
    const isOnDashboardWithPendingTour =
      pathname === '/dashboard' &&
      (!state.tour_install_seen || !state.tour_voice_seen || !state.tour_dashboard_seen)

    if (isOnDashboardWithPendingTour) {
      const timer = setTimeout(() => {
        // Construit les steps a la volee : on ne garde que ceux
        // dont (a) l'utilisateur n'a pas deja vu la bulle et
        // (b) l'element cible existe bien dans le DOM.
        const steps: DriveStep[] = []
        const stepNames: Array<'install' | 'voice' | 'dashboard'> = []

        if (!state.tour_install_seen) {
          const s = buildStep(
            '[data-tour="install-banner"]',
            'Installe Nexartis sur ton téléphone',
            `
              <p style="margin: 0 0 10px 0;">Une vraie app, <strong>sans passer par les stores</strong>. Une icône sur ton écran d'accueil, ouverture instantanée.</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Tu peux installer Nexartis depuis ce bandeau, ou plus tard depuis ton navigateur (option "Ajouter à l'écran d'accueil").</p>
            `,
            'bottom',
            'center'
          )
          if (s) {
            steps.push(s)
            stepNames.push('install')
          } else {
            // Bandeau pas dans le DOM (deja installe ou dismiss) → skip silencieux
            markStepSeen('install')
          }
        }

        if (!state.tour_voice_seen) {
          const s = buildStep(
            '[data-tour="voice-btn"]',
            'Dicte tes devis et factures',
            `
              <p style="margin: 0 0 10px 0;">Parle, Nexartis <strong>transcrit et structure</strong>. Idéal entre deux chantiers, sur le trajet ou en pause.</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Clique sur ce bouton micro depuis n'importe quelle page pour créer un devis, une facture ou planifier une intervention à la voix.</p>
            `,
            'bottom',
            'end'
          )
          if (s) {
            steps.push(s)
            stepNames.push('voice')
          } else {
            // Plan Essentiel hors trial → bouton absent → skip silencieux
            markStepSeen('voice')
          }
        }

        // V3 (09/06/2026) : bulle "Ton inventaire pro" sur le lien Matériel
        // de la sidebar. Ride-along sur tour_dashboard_seen — quand la chaine
        // dashboard est marquée vue, ce step l'est aussi (pas de flag dédié,
        // donc pas de migration SQL nécessaire). On l'insère AVANT le step
        // "parametres" pour respecter l'ordre visuel de la sidebar (Matériel
        // est plus haut que Paramètres) et garder la dernière étape sur
        // Paramètres qui déclenche la redirection vers /dashboard/parametres.
        if (!state.tour_dashboard_seen) {
          const sMateriel = buildStep(
            '[data-tour="materiel"]',
            'Ton inventaire pro',
            `
              <p style="margin: 0 0 10px 0;">Outillage, échafaudage, véhicule, EPI : centralise tout ton <strong>matériel pro</strong> ici.</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Suivi crédit, assurance, amortissement — pour ne plus rien oublier au moment des déclarations ou d'un contrôle.</p>
            `,
            'right',
            'start'
          )
          if (sMateriel) {
            steps.push(sMateriel)
            // Pas de stepNames.push : ride-along sur 'dashboard',
            // pas de flag dédié à marquer.
          }
          // Si le lien Matériel n'est pas dans le DOM (sidebar collapsed
          // ou autre), on skippe silencieusement — pas de flag à toucher.
        }

        if (!state.tour_dashboard_seen) {
          const s = buildStep(
            '[data-tour="parametres"]',
            'Bienvenue sur Nexartis !',
            `
              <p style="margin: 0 0 10px 0;">Avant de créer ton premier devis, prends <strong>2 minutes</strong> pour compléter ton profil entreprise dans les <strong>Paramètres</strong>.</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Ton SIRET, ton logo, tes mentions légales et ton IBAN seront <strong>automatiquement insérés</strong> dans tous tes devis et factures. Plus jamais à les retaper.</p>
            `,
            'right',
            'center'
          )
          if (s) {
            steps.push(s)
            stepNames.push('dashboard')
          } else {
            // Sidebar pas montee → on marque comme vu pour ne pas boucler
            markStepSeen('dashboard')
          }
        }

        if (steps.length === 0) return

        // Drapeau pour distinguer "fermeture par le bouton final"
        // vs "fermeture par la croix / Échap / clic extérieur".
        let userFinishedNormally = false
        const isLastDashboard =
          stepNames[stepNames.length - 1] === 'dashboard'

        const d = driver({
          showProgress: steps.length > 1,
          progressText: 'Étape {{current}} / {{total}}',
          showButtons: steps.length > 1 ? ['next', 'previous', 'close'] : ['next', 'close'],
          nextBtnText: 'Suivant',
          prevBtnText: 'Précédent',
          doneBtnText: isLastDashboard ? 'Compris, j\'y vais' : 'C\'est compris',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.7,
          onNextClick: (_el, _step, opts) => {
            // Avance dans le tour ; quand on est sur le dernier step
            // ET que c'est le step "dashboard", on redirige vers Paramètres.
            const idx = opts.state.activeIndex ?? 0
            const lastIdx = steps.length - 1
            if (idx >= lastIdx) {
              // Dernier step : on marque seen et on quitte.
              userFinishedNormally = true
              stepNames.forEach((name) => markStepSeen(name))
              d.destroy()
              if (isLastDashboard) {
                router.push('/dashboard/parametres')
              }
              return
            }
            d.moveNext()
          },
          onCloseClick: () => {
            // Croix : l'utilisateur refuse explicitement le tour
            // courant. On marque seen TOUS les steps en cours pour
            // ne pas le saouler quand il reviendra sur le dashboard.
            // V3 : on marque aussi tour_parametres_seen (cohérence
            // avec V1 — la bulle parametres n'a pas de sens sans la
            // bulle dashboard qui l'amenait).
            stepNames.forEach((name) => markStepSeen(name))
            if (stepNames.includes('dashboard')) {
              markStepSeen('parametres')
            }
            userFinishedNormally = true
            d.destroy()
          },
          onDestroyed: () => {
            // Fallback : si fermé par Échap ou clic extérieur sans
            // passer par onNextClick/onCloseClick → comme la croix.
            if (!userFinishedNormally) {
              stepNames.forEach((name) => markStepSeen(name))
              if (stepNames.includes('dashboard')) {
                markStepSeen('parametres')
              }
            }
          },
          steps,
        })

        driverRef.current = d
        d.drive()
      }, TOUR_DELAY_MS)

      return () => clearTimeout(timer)
    }

    // ============================================
    // SCÉNARIO 2 — Page Paramètres
    // ============================================
    // V3 : on declenche la chaine quand au moins une des bulles
    // parametres OU theme est non-vue ET que la bulle dashboard
    // a deja ete vue (pour ne pas declencher avant l'introduction).
    const isOnParametresWithPendingTour =
      pathname === '/dashboard/parametres' &&
      state.tour_dashboard_seen &&
      (!state.tour_parametres_seen || !state.tour_theme_seen)

    if (isOnParametresWithPendingTour) {
      const timer = setTimeout(() => {
        const steps: DriveStep[] = []
        const stepNames: Array<'parametres' | 'theme'> = []

        // Bulle "Tu y es" sur la zone profil
        if (!state.tour_parametres_seen) {
          const s = buildStep(
            '[data-tour="parametres-content"]',
            'Tu y es !',
            `
              <p style="margin: 0 0 10px 0;">C'est ici que tu remplis ton profil entreprise. <strong>Coche toutes les sections</strong> (Entreprise, Documents, Facturation, Signature…).</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Chaque case remplie est réutilisée automatiquement dans tes devis et factures. Une fois fait, tu es prêt à créer ton premier devis pro.</p>
            `,
            'top',
            'center'
          )
          if (s) {
            steps.push(s)
            stepNames.push('parametres')
          } else {
            markStepSeen('parametres')
          }
        }

        // V3 : Bulle "Habille tes documents à tes couleurs"
        if (!state.tour_theme_seen) {
          const s = buildStep(
            '[data-tour="param-documents"]',
            'Habille tes documents à tes couleurs',
            `
              <p style="margin: 0 0 10px 0;">Dans l'onglet <strong>Documents</strong>, tu peux personnaliser <strong>6 zones</strong> de tes devis et factures (en-tête, totaux, accents…).</p>
              <p style="margin: 0; color: #445068; font-size: 13px;">Reprends les couleurs de ton logo ou de ta camionnette pour des documents <strong>à ton image</strong>, instantanément reconnaissables par tes clients.</p>
            `,
            'right',
            'center'
          )
          if (s) {
            steps.push(s)
            stepNames.push('theme')
          } else {
            markStepSeen('theme')
          }
        }

        // Bulle "Mon équipe" — V1 Fix #7, mode Société uniquement.
        // Reste hors gestion seen (purement contextuelle).
        if (
          isSociete &&
          document.querySelector('[data-tour="equipe"]') &&
          !state.tour_parametres_seen
        ) {
          steps.push({
            element: '[data-tour="equipe"]',
            popover: {
              title: 'Pense à créer ton équipe',
              description: `
                <p style="margin: 0 0 10px 0;">Comme tu es en <strong>société</strong>, tu peux ajouter tous tes collaborateurs dans <strong>Mon équipe</strong>.</p>
                <p style="margin: 0; color: #445068; font-size: 13px;">Chaque membre devient ensuite sélectionnable comme intervenant dans le planning : tu pourras leur assigner des interventions, suivre leur charge et les afficher dans la grille hebdomadaire.</p>
              `,
              side: 'right',
              align: 'center',
            },
          })
        }

        // Bulle "Besoin d'aide à tout moment ?" — uniquement si on
        // affiche la bulle parametres (cohérence avec V1).
        if (!state.tour_parametres_seen && document.querySelector('[data-tour="aide"]')) {
          steps.push({
            element: '[data-tour="aide"]',
            popover: {
              title: 'Besoin d\'aide à tout moment ?',
              description: `
                <p style="margin: 0 0 10px 0;">Cet onglet <strong>Aide &amp; Tutoriels</strong> en bas de la barre latérale regroupe une explication détaillée de <strong>chaque onglet de Nexartis</strong>.</p>
                <p style="margin: 0; color: #445068; font-size: 13px;">Tu y trouveras aussi un bouton <em>Rejouer la visite guidée</em> si tu veux revoir le tutoriel ou le montrer à un confrère.</p>
              `,
              side: 'right',
              align: 'center',
            },
          })
        }

        if (steps.length === 0) return

        const d = driver({
          showProgress: steps.length > 1,
          progressText: 'Étape {{current}} / {{total}}',
          showButtons: steps.length > 1 ? ['next', 'previous', 'close'] : ['next', 'close'],
          nextBtnText: 'Suivant',
          prevBtnText: 'Précédent',
          doneBtnText: 'C\'est parti',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.65,
          onDestroyed: () => {
            // Quelle que soit la façon dont l'utilisateur ferme
            // (croix, Échap, bouton final), on marque toutes les
            // bulles concernees comme vues (le tour est déjà bien
            // engagé).
            stepNames.forEach((name) => markStepSeen(name))
          },
          steps,
        })

        driverRef.current = d
        d.drive()
      }, TOUR_DELAY_MS)

      return () => clearTimeout(timer)
    }

    // ============================================
    // SCÉNARIO 3 — Page Équipe (1ère visite)
    // ============================================
    // V3 : bulle "Mode Solo ou Société" sur le header.
    if (pathname === '/dashboard/equipe' && !state.tour_equipe_mode_seen) {
      const timer = setTimeout(() => {
        const target = document.querySelector('[data-tour="equipe-mode"]') as HTMLElement | null
        if (!target) {
          // Header pas monte → on marque seen pour ne pas boucler
          markStepSeen('equipeMode')
          return
        }

        const d = driver({
          showProgress: false,
          showButtons: ['next', 'close'],
          nextBtnText: 'Compris',
          doneBtnText: 'Compris',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.6,
          onDestroyed: () => {
            markStepSeen('equipeMode')
          },
          steps: [
            {
              element: '[data-tour="equipe-mode"]',
              popover: {
                title: 'Mode Solo ou Société, à toi de choisir',
                description: `
                  <p style="margin: 0 0 10px 0;">Tu travailles seul ? Active le <strong>mode Solo</strong> dans tes Paramètres : Nexartis t'enregistre comme seul intervenant et te simplifie la vie.</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">En équipe ? Ajoute tes intervenants ici (employés, intérimaires, sous-traitants) et tu pourras les <strong>affecter au planning</strong> en quelques clics.</p>
                `,
                side: 'bottom',
                align: 'start',
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
    // SCÉNARIO 4 — Page Chantier détail (1er chantier)
    // ============================================
    // V3 : bulle "Tiens un journal de chantier" sur le bloc Notes.
    // Pathname dynamique : /dashboard/chantiers/[id]. On match avec
    // un test regex pour éviter de capturer /dashboard/chantiers
    // (liste) ou /dashboard/chantiers/nouveau.
    const isOnChantierDetail =
      /^\/dashboard\/chantiers\/[^/]+$/.test(pathname) &&
      pathname !== '/dashboard/chantiers/nouveau'

    if (isOnChantierDetail && !state.tour_chantier_journal_seen) {
      const timer = setTimeout(() => {
        const target = document.querySelector('[data-tour="chantier-journal"]') as HTMLElement | null
        if (!target) {
          // Bloc Notes pas monte (peut etre sur un onglet different
          // que "Résumé") → on attend la prochaine visite, ne marque
          // PAS comme seen pour redonner sa chance au tour quand
          // l'utilisateur reviendra sur l'onglet Résumé.
          return
        }

        const d = driver({
          showProgress: false,
          showButtons: ['next', 'close'],
          nextBtnText: 'Compris',
          doneBtnText: 'Compris',
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: 'nexartis-driver',
          allowClose: true,
          overlayOpacity: 0.6,
          onDestroyed: () => {
            markStepSeen('chantierJournal')
          },
          steps: [
            {
              element: '[data-tour="chantier-journal"]',
              popover: {
                title: 'Tiens un journal de chantier',
                description: `
                  <p style="margin: 0 0 10px 0;">Note tout ce qui se passe sur le chantier : visites, échanges, imprévus. Chaque note est <strong>datée automatiquement</strong>.</p>
                  <p style="margin: 0; color: #445068; font-size: 13px;">Tu peux choisir qu'une note soit <strong>visible par le client</strong> ou rester privée. C'est ta meilleure protection en cas de litige.</p>
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
    // SCÉNARIO 5 — Page création devis (1er devis)
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
    // `isSociete` ajouté car la branche /parametres en dépend pour ajouter
    // ou non la bulle "Mon équipe" (V1 Fix #7).
  }, [pathname, state, loading, markStepSeen, router, isSociete])

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
