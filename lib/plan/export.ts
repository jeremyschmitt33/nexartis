'use client'

/**
 * Module Plan 2D — Export image d'un niveau (Push 5, 06/07/2026)
 *
 * Chaîne : PlanRender (le MÊME rendu SVG pur que l'éditeur — parité de dessin
 * par construction) -> SVG statique autonome (titre + légende + fond blanc,
 * AUCUNE ressource externe, couleurs hex COULEURS_PLAN uniquement, polices
 * avec repli système sans-serif/monospace) -> image data URL via canvas.
 *
 * Push 6 — POIDS PDF : les images de plan injectées sont désormais produites
 * en JPEG qualité 0,85 (fond blanc rempli d'abord : JPEG n'a pas d'alpha),
 * mesuré en prod : PDF 3,6 Mo -> 15,7 Mo avec un plan PNG, ~10× moins en
 * JPEG. Les PNG déjà stockés en base restent affichés tels quels
 * (lib/pdf/plan.ts détecte le format via le préfixe du data URL).
 * svgVersPng reste disponible en PNG pour la capture de la vue 3D.
 *
 * CLIENT UNIQUEMENT (document/canvas/Image) : appelé depuis le tiroir
 * d'injection (DevisDrawer -> useInjection.stockerImagePlanNiveau).
 * Bornes : côté canvas <= 2048 px (limite iOS documentée dans la spec),
 * data URL <= ~1,4 Mo sinon retente à échelle 1 puis abandonne (best-effort :
 * un échec ne doit JAMAIS faire échouer l'injection).
 *
 * Fichier .ts sans JSX : le SVG est assemblé via createElement puis rendu
 * dans un conteneur détaché (createRoot + flushSync) et sérialisé.
 */

import { createElement, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import PlanRender, { PlanDefs } from '@/components/plan/PlanRender'
import type { PlanData } from './types'
import { COULEURS_PLAN } from './defaults'
import { bornesNiveau, cadrerSur, transformSvg } from './viewport'

const C = COULEURS_PLAN
/** Préfixe des <pattern> de l'export (pas de collision avec l'éditeur). */
const PREFIXE = 'planexport'
/** Largeur logique du SVG d'export, en px. */
const LARGEUR_SVG = 1024
/** Bande haute (titre) et basse (légende), en px. */
const BANDE_TITRE = 56
const BANDE_LEGENDE = 46
/** Marge intérieure horizontale de la zone de plan, en px. */
const MARGE_X = 24
/** Côté maximal du canvas de rasterisation (limite iOS). */
const COTE_CANVAS_MAX = 2048
/** Taille maximale acceptée pour le data URL PNG (~1,05 Mo binaire). */
const TAILLE_MAX_DATAURL = 1_400_000

const POLICE_TXT = "'Hanken Grotesk', sans-serif"

export interface SvgExport {
  svg: string
  largeur: number
  hauteur: number
}

/** Élément <text> de l'habillage (titre, légende) — police à repli système. */
function texte(
  x: number,
  y: number,
  contenu: string,
  taille: number,
  couleur: string,
  gras: boolean,
  ancre: 'start' | 'end' = 'start'
): ReactElement {
  return createElement(
    'text',
    {
      key: `t-${x}-${y}-${contenu}`,
      x,
      y,
      fontFamily: POLICE_TXT,
      fontSize: taille,
      fontWeight: gras ? 700 : 500,
      fill: couleur,
      textAnchor: ancre,
    },
    contenu
  )
}

/**
 * Construit le SVG statique autonome d'un niveau : fond blanc, titre du
 * niveau, plan auto-cadré (échelle auto-fit via cadrerSur), légende
 * Existant / Projet. Retourne null si le niveau est introuvable ou vide,
 * ou hors navigateur (garde SSR).
 */
export function genererSvgExport(
  data: PlanData,
  niveauId: string,
  options: { avancementVisible?: boolean } = {}
): SvgExport | null {
  if (typeof document === 'undefined') return null
  const niveau = data.levels.find((n) => n.id === niveauId)
  if (!niveau) return null
  const bornes = bornesNiveau(niveau)
  if (!bornes) return null

  // Hauteur de la zone plan proportionnelle au plan (bornée pour rester A4-compatible).
  const zoneW = LARGEUR_SVG - 2 * MARGE_X
  const ratio = (bornes.y2 - bornes.y1 + 3000) / Math.max(1, bornes.x2 - bornes.x1 + 3000)
  const zoneH = Math.round(Math.min(1100, Math.max(360, zoneW * ratio)))
  const H = BANDE_TITRE + zoneH + BANDE_LEGENDE
  const vp = cadrerSur(bornes, zoneW, zoneH, 1500)

  const aProjet =
    niveau.rooms.some((r) => r.layer === 'projet') ||
    niveau.clotures.some((c) => c.layer === 'projet') ||
    niveau.symbols.some((s) => s.layer === 'projet')

  // Légende : trait Existant (navy plein) + trait Projet (orange pointillé).
  const yLeg = H - BANDE_LEGENDE / 2 + 4
  const legende: ReactElement[] = [
    createElement('line', {
      key: 'leg-exist',
      x1: MARGE_X,
      y1: yLeg - 4,
      x2: MARGE_X + 30,
      y2: yLeg - 4,
      stroke: C.navy,
      strokeWidth: 4,
    }),
    texte(MARGE_X + 38, yLeg, 'Existant', 14, C.navy, false),
  ]
  if (aProjet) {
    legende.push(
      createElement('line', {
        key: 'leg-projet',
        x1: MARGE_X + 128,
        y1: yLeg - 4,
        x2: MARGE_X + 158,
        y2: yLeg - 4,
        stroke: C.orange,
        strokeWidth: 4,
        strokeDasharray: '8 5',
      }),
      texte(MARGE_X + 166, yLeg, 'Projet (travaux prévus)', 14, C.orange, false)
    )
  }

  const contenu = createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${LARGEUR_SVG} ${H}`,
      width: LARGEUR_SVG,
      height: H,
    },
    createElement('defs', { key: 'defs' }, createElement(PlanDefs, { idPrefix: PREFIXE })),
    createElement('rect', { key: 'fond', x: 0, y: 0, width: LARGEUR_SVG, height: H, fill: C.blanc }),
    texte(MARGE_X, 36, niveau.name, 22, C.navy, true),
    createElement(
      'g',
      { key: 'zone', transform: `translate(${MARGE_X} ${BANDE_TITRE})` },
      createElement(
        'g',
        { key: 'monde', transform: transformSvg(vp) },
        createElement(PlanRender, {
          niveau,
          vue: 'tout',
          interactif: false,
          idPrefix: PREFIXE,
          grille: false,
          // Push 7C : teinte d'avancement masquée par défaut (image de DEVIS,
          // pré-travaux), activée explicitement pour le snapshot d'une facture de
          // situation (options.avancementVisible = true).
          avancementVisible: options.avancementVisible ?? false,
        })
      )
    ),
    ...legende
  )

  // Rendu dans un conteneur détaché + sérialisation (jamais attaché au DOM).
  const conteneur = document.createElement('div')
  const racine = createRoot(conteneur)
  let markup: string | null = null
  try {
    flushSync(() => {
      racine.render(contenu)
    })
    const el = conteneur.querySelector('svg')
    if (el) markup = new XMLSerializer().serializeToString(el)
  } catch {
    markup = null
  } finally {
    try {
      racine.unmount()
    } catch {
      /* conteneur détaché : rien à nettoyer */
    }
  }
  if (!markup) return null
  return { svg: markup, largeur: LARGEUR_SVG, hauteur: H }
}

/**
 * Rasterise un SVG autonome en image data URL via canvas (fond blanc rempli
 * d'abord — indispensable en JPEG, qui n'a pas de canal alpha).
 * `echelle` 2 = @2x. Côtés bornés à 2048 px (canvas iOS). `format` 'jpeg' =
 * qualité 0,85 (Push 6, poids PDF) ; 'png' par défaut (capture vue 3D).
 * Résout null en cas d'échec (jamais de rejet).
 */
export function svgVersPng(
  svg: string,
  largeur: number,
  hauteur: number,
  echelle: number,
  format: 'png' | 'jpeg' = 'png',
  qualite = 0.85
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(null)
        return
      }
      const k = Math.min(echelle, COTE_CANVAS_MAX / largeur, COTE_CANVAS_MAX / hauteur)
      const w = Math.max(1, Math.round(largeur * k))
      const h = Math.max(1, Math.round(hauteur * k))
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.fillStyle = C.blanc
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          resolve(
            format === 'jpeg' ? canvas.toDataURL('image/jpeg', qualite) : canvas.toDataURL('image/png')
          )
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Image complète d'un niveau : SVG -> JPEG qualité 0,85 @2x (Push 6, poids
 * PDF : ~10× plus léger que le PNG), avec repli à l'échelle 1 si le data URL
 * dépasse la taille maximale, puis abandon (null).
 */
export async function genererImagePlanNiveau(
  data: PlanData,
  niveauId: string,
  options: { avancementVisible?: boolean } = {}
): Promise<string | null> {
  const exporte = genererSvgExport(data, niveauId, options)
  if (!exporte) return null
  const grand = await svgVersPng(exporte.svg, exporte.largeur, exporte.hauteur, 2, 'jpeg')
  if (grand && grand.length <= TAILLE_MAX_DATAURL) return grand
  const petit = await svgVersPng(exporte.svg, exporte.largeur, exporte.hauteur, 1, 'jpeg')
  if (petit && petit.length <= TAILLE_MAX_DATAURL) return petit
  // Dernier repli AVANT d'abandonner : échelle 1 en qualité dégradée. Un plan
  // moche dans le devis vaut infiniment mieux qu'un devis SANS plan — l'artisan
  // a explicitement demandé à joindre son plan. Rend le renoncement pour cause
  // de poids pratiquement impossible (un plan majoritairement blanc en q0,55
  // @1x pèse quelques dizaines de Ko).
  const degrade = await svgVersPng(exporte.svg, exporte.largeur, exporte.hauteur, 1, 'jpeg', 0.55)
  if (degrade && degrade.length <= TAILLE_MAX_DATAURL) return degrade
  return null
}
