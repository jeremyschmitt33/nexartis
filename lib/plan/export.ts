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
import { Forme } from '@/components/plan/SymboleSvg'
import type { PlanData } from './types'
import { COULEURS_PLAN } from './defaults'
import { defSymbole } from './symboles'
import { bornesNiveau, cadrerSur, transformSvg } from './viewport'

const C = COULEURS_PLAN
/** Préfixe des <pattern> de l'export (pas de collision avec l'éditeur). */
const PREFIXE = 'planexport'
/** Largeur logique du SVG d'export, en px. */
const LARGEUR_SVG = 1024
/** Bande haute (titre) et basse (CARTOUCHE), en px. */
const BANDE_TITRE = 56
/**
 * Bande basse en MODE CLIENT (devis/facture) : réglette + calques, rien de plus.
 * En mode ÉCHANGE la bande est CALCULÉE (cf. genererSvgExport) pour que la
 * légende des symboles soit toujours complète.
 */
const BANDE_CLIENT = 58
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

/**
 * Informations du cartouche. FOURNIR CET OBJET = mode ÉCHANGE (plan destiné à
 * un autre artisan). L'omettre = mode CLIENT (devis/facture), bande minimale.
 */
export interface InfosCartouche {
  /** Nom du plan (plans.name) — le niveau reste affiché à côté. */
  nomPlan?: string
  /** Auteur : raison sociale de l'entreprise qui émet le plan. */
  entreprise?: string
  /** Chantier de rattachement. */
  chantier?: string
  /** Date de génération (défaut : maintenant). Parle à l'humain, ne tranche pas. */
  genereLe?: Date
  /**
   * L'INDICE DE RÉVISION : l'id d'une ligne `plan_revisions` (UUID serveur).
   * C'est lui qui dit quel plan fait foi — pas la date, qui vient d'une horloge
   * locale falsifiable et ne descend pas sous la minute.
   */
  revisionId?: string
}

/** Paliers de la réglette, en mm : 0,5 m -> 20 m. */
const PALIERS_ECHELLE_MM = [500, 1000, 2000, 5000, 10_000, 20_000]

/**
 * Choisit la plus grande distance ronde dont la réglette tient dans `maxPx`.
 * PUR. `kPxParMm` = échelle du plan rendu (px par mm).
 *
 * ⚠️ POURQUOI UNE RÉGLETTE ET PAS « 1:50 » : l'export est une image rasterisée,
 * insérée ensuite dans un PDF puis imprimée à une taille quelconque. Un ratio
 * numérique serait FAUX dès le premier redimensionnement — donc un mensonge sur
 * un document qui circule. Une réglette graphique se déforme AVEC le dessin :
 * elle reste vraie à toute taille, même photocopiée.
 */
export function choisirEchelle(
  kPxParMm: number,
  maxPx: number
): { mm: number; px: number; label: string } {
  let choix = PALIERS_ECHELLE_MM[0]
  for (const p of PALIERS_ECHELLE_MM) {
    if (p * kPxParMm <= maxPx) choix = p
  }
  return {
    mm: choix,
    px: choix * kPxParMm,
    label: String(choix / 1000).replace('.', ',') + ' m',
  }
}

/** « 14/07/2026 à 10:33 » — sans dépendance ni locale (rendu identique partout). */
export function dateCartouche(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  return (
    `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `à ${p2(d.getHours())}:${p2(d.getMinutes())}`
  )
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
  options: { avancementVisible?: boolean; cartouche?: InfosCartouche } = {}
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

  /**
   * DEUX RENDUS, PAS UN (14/07/2026) — décision structurante.
   *
   * `cartouche` absent = MODE CLIENT : l'image part dans un DEVIS ou une
   * FACTURE lus par un particulier. Il n'a que faire de « cotes dans-œuvre »,
   * d'une légende de symboles électriques ou d'un indice de révision : c'est du
   * jargon adressé à quelqu'un qui n'est pas le destinataire, et ça mangerait
   * ~15 % de la surface du plan sur le document qui doit VENDRE. Bande minimale.
   *
   * `cartouche` fourni = MODE ÉCHANGE : le plan circule entre artisans, il doit
   * être opposable → cartouche complet.
   *
   * Le cartouche complet ne s'affiche donc QUE quand on lui donne de quoi le
   * remplir. Un cartouche anonyme n'identifie personne et n'a aucune valeur.
   */
  const info = options.cartouche
  const modeEchange = info !== undefined

  // Types de symboles réellement posés (légende du mode échange). La légende
  // doit être COMPLÈTE : la tronquer reviendrait à la retirer précisément à
  // celui qui en a besoin — le non-spécialiste qui reçoit un plan à 12 glyphes.
  const typesPresents: string[] = []
  if (modeEchange) {
    for (const s of niveau.symbols) {
      if (typesPresents.indexOf(s.type) === -1 && defSymbole(s.type)) typesPresents.push(s.type)
    }
  }
  const COLS_LEG = 4
  const lignesSym = Math.ceil(typesPresents.length / COLS_LEG)
  // Bande CALCULÉE : 30 px par ligne de légende plutôt que sacrifier
  // l'exhaustivité d'un document technique pour quelques pixels.
  // Plancher 130 (et non 112) : la colonne DROITE descend jusqu'au label de la
  // réglette (yC0+122, descendante ~124,4). À 112, la virgule de « 0,5 m »
  // était rasée par le bord bas de l'image. 130 → ~20 px de garde, aligné sur
  // le mode client.
  const bandeCartouche = modeEchange
    ? Math.max(130, 56 + lignesSym * 30) + 12
    : BANDE_CLIENT

  const H = BANDE_TITRE + zoneH + bandeCartouche
  const vp = cadrerSur(bornes, zoneW, zoneH, 1500)

  const aProjet =
    niveau.rooms.some((r) => r.layer === 'projet') ||
    niveau.clotures.some((c) => c.layer === 'projet') ||
    niveau.symbols.some((s) => s.layer === 'projet')

  // ── CARTOUCHE ────────────────────────────────────────────────────────────
  const yC0 = BANDE_TITRE + zoneH
  const legende: ReactElement[] = [
    // Filet de séparation : le cartouche est un bloc distinct du dessin.
    createElement('line', {
      key: 'cart-filet',
      x1: MARGE_X,
      y1: yC0,
      x2: LARGEUR_SVG - MARGE_X,
      y2: yC0,
      stroke: C.grille,
      strokeWidth: 1.5,
    }),
  ]

  // Colonne GAUCHE — calques + symboles présents.
  const yLeg = yC0 + 24
  legende.push(
    createElement('line', {
      key: 'leg-exist',
      x1: MARGE_X,
      y1: yLeg - 4,
      x2: MARGE_X + 30,
      y2: yLeg - 4,
      stroke: C.navy,
      strokeWidth: 4,
    }),
    texte(MARGE_X + 38, yLeg, 'Existant', 13, C.navy, false)
  )
  if (aProjet) {
    legende.push(
      createElement('line', {
        key: 'leg-projet',
        x1: MARGE_X + 118,
        y1: yLeg - 4,
        x2: MARGE_X + 148,
        y2: yLeg - 4,
        stroke: C.orange,
        strokeWidth: 4,
        strokeDasharray: '8 5',
      }),
      texte(MARGE_X + 156, yLeg, 'Projet (travaux prévus)', 13, C.orange, false)
    )
  }

  const xD = LARGEUR_SVG - MARGE_X

  if (info) {
    // ── MODE ÉCHANGE (plan destiné à un autre artisan) ──────────────────────
    // Légende COMPLÈTE des symboles présents (trou de marché : Cedreo n'en a
    // pas). Le plombier ne connaît pas les glyphes de l'électricien.
    typesPresents.forEach((type, i) => {
      const def = defSymbole(type)
      if (!def) return
      const col = i % COLS_LEG
      const ligne = Math.floor(i / COLS_LEG)
      const x = MARGE_X + col * 180
      const y = yC0 + 56 + ligne * 30
      const r = def.rayon + 80
      legende.push(
        // <svg> imbriqué : le viewBox remet le glyphe (coords mm) à l'échelle
        // de la vignette sans calcul manuel.
        createElement(
          'svg',
          {
            key: `sym-${type}`,
            x,
            y: y - 11,
            width: 18,
            height: 18,
            viewBox: `${-r} ${-r} ${2 * r} ${2 * r}`,
          },
          ...def.formes.map((f, j) => createElement(Forme, { key: j, f, c: C.navy }))
        ),
        texte(x + 24, y + 4, def.label, 12, C.navyMid, false)
      )
    })

    // Auteur — tronqué : sans borne, « SARL Établissements Dupont & Fils —
    // Rénovation, 12 avenue des Grands Hommes, Bordeaux » chevaucherait la
    // légende de gauche.
    const brut = [info.entreprise, info.chantier].filter(Boolean).join(' — ')
    const ligneAuteur = brut.length > 78 ? brut.slice(0, 77) + '…' : brut
    if (ligneAuteur) legende.push(texte(xD, yC0 + 24, ligneAuteur, 13, C.navy, true, 'end'))

    // Identité du document. `revisionId` = l'UUID serveur de plan_revisions —
    // c'est LUI l'indice de révision, pas la date : deux exports du même plan
    // à 10:33 et 10:35 ont deux dates et zéro différence, et une horloge locale
    // déréglée ferait « gagner » le mauvais plan. La date reste, parce qu'elle
    // parle à l'humain — mais elle ne tranche pas.
    const ligneRef = info.revisionId
      ? `Réf. ${info.revisionId.slice(0, 8).toUpperCase()} — ${dateCartouche(info.genereLe ?? new Date())}`
      : `Généré le ${dateCartouche(info.genereLe ?? new Date())}`
    legende.push(
      texte(xD, yC0 + 44, ligneRef, 12, C.cote, false, 'end'),
      // Conventions de lecture. On ne déclare QUE ce qui est vrai du modèle :
      // les cotes SONT dans-œuvre (types.ts), et l'épaisseur des murs n'est PAS
      // représentée — le dire évite au lecteur d'additionner les pièces pour
      // retrouver un hors-tout qui n'existe pas.
      // ⚠️ NE PAS ajouter « Hauteurs depuis le sol fini » tant que
      // `Symbole.hauteurMm` n'existe pas : ce serait déclarer une convention sur
      // des données absentes, donc créer une attente que le plan ne remplit pas.
      // Une convention DÉCRIT une donnée présente, elle ne la crée pas.
      texte(xD, yC0 + 62, 'Cotes dans-œuvre, en mètres.', 11.5, C.cote, false, 'end'),
      texte(xD, yC0 + 78, 'Épaisseur des murs non représentée.', 11.5, C.cote, false, 'end')
    )
  }

  // Réglette d'échelle — dans les DEUX modes (elle est utile au client aussi,
  // et c'est la seule mention d'échelle honnête sur une image redimensionnable).
  const ech = choisirEchelle(vp.k, 190)
  const yR = modeEchange ? yC0 + 104 : yC0 + 22
  const xR = xD - ech.px
  legende.push(
    createElement('line', { key: 'ech-l', x1: xR, y1: yR, x2: xD, y2: yR, stroke: C.navy, strokeWidth: 2 }),
    createElement('line', { key: 'ech-t0', x1: xR, y1: yR - 5, x2: xR, y2: yR + 5, stroke: C.navy, strokeWidth: 2 }),
    createElement('line', { key: 'ech-t1', x1: xD, y1: yR - 5, x2: xD, y2: yR + 5, stroke: C.navy, strokeWidth: 2 }),
    // Demi-palier : donne un repère intermédiaire pour lire à vue.
    createElement('line', {
      key: 'ech-tm',
      x1: (xR + xD) / 2,
      y1: yR - 3,
      x2: (xR + xD) / 2,
      y2: yR + 3,
      stroke: C.navy,
      strokeWidth: 1.2,
    }),
    texte(xR, yR + 18, '0', 11, C.cote, false),
    texte(xD, yR + 18, ech.label, 11, C.cote, false, 'end')
  )

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
    // Titre : « Nom du plan — Niveau » si le nom est fourni, sinon le niveau
    // seul (comportement d'avant, préservé pour les appelants non branchés).
    texte(MARGE_X, 36, info?.nomPlan ? `${info.nomPlan} — ${niveau.name}` : niveau.name, 22, C.navy, true),
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
  options: { avancementVisible?: boolean; cartouche?: InfosCartouche } = {}
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
