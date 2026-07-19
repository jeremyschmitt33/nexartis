'use client'

/**
 * PlanCanvas — Canvas SVG interactif de l'éditeur (Push 2, 03/07/2026).
 *
 * Gère : zoom (molette + boutons), pan (fond / molette / espace), sélection,
 * drag avec snap grille 100 mm + aimantation bords < 150 mm (guides sky),
 * cotes cliquables (input inline), pose d'ouvertures, dessin de polygone
 * avec aperçu élastique et cotes live. Le rendu du plan lui-même est délégué
 * à PlanRender (pur, partagé avec l'export Push 4).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalqueId, NatureZone, Niveau, PointMm, TypeOuverture } from '@/lib/plan/types'
import { estDansPolygone, snapMm } from '@/lib/plan/geometry'
import {
  cadrerSur,
  bornesNiveau,
  transformSvg,
  versMonde,
  viewportDefaut,
  zoomAutour,
  type Viewport,
} from '@/lib/plan/viewport'
import { COULEURS_PLAN, FERMETURE_POLY_MM, GRILLE_MM } from '@/lib/plan/defaults'
import {
  aimanterDeplacement,
  bornesPiece,
  type BornesPiece,
  type GuideAimant,
} from '@/lib/plan/edition'
import PlanRender, { PlanDefs, type VueCalque } from './PlanRender'
import PolygonePreview from './PolygonePreview'
import CoteInput from './CoteInput'
import ZoomControls from './ZoomControls'
import { useCanvasNav } from './useCanvasNav'

/** Outil actif : sélection, ouverture, ou pose de symbole (`sym:<type>`). */
export type Outil = 'select' | TypeOuverture | `sym:${string}`

/** Pas d'aimantation des symboles (plus fin que la grille des pièces). */
const GRILLE_SYM_MM = 50

export interface PolygoneEnCours {
  nom: string
  calque: CalqueId
  /** 'cloture' = polyligne OUVERTE : pas de fermeture, 2 points suffisent. */
  mode?: 'piece' | 'cloture'
  /** Nature de la zone à créer (mode 'piece'). Absente pour une clôture. */
  nature?: NatureZone
}

export interface PlanCanvasProps {
  niveau: Niveau
  vue: VueCalque
  outil: Outil
  selectedRoomId: string | null
  selectedSymbolId: string | null
  selectedFenceId: string | null
  polygone: PolygoneEnCours | null
  onSelectRoom: (id: string | null) => void
  onSelectSymbol: (id: string | null) => void
  onSelectFence: (id: string | null) => void
  onDebutGeste: () => void
  onDeplacerPiece: (roomId: string, dx: number, dy: number) => void
  onCote: (roomId: string, dim: 'w' | 'h', mm: number) => void
  onPoserOuverture: (roomId: string, point: PointMm, type: TypeOuverture) => void
  onPoserSymbole: (type: string, point: PointMm, roomId: string | null) => void
  onDeplacerSymbole: (symboleId: string, dx: number, dy: number) => void
  onFinDeplacerSymbole: (symboleId: string) => void
  onPolygoneTermine: (points: PointMm[]) => void
  onPolygoneAnnule: () => void
}

/** Cote résolue au pointerdown (position d'écran figée pour l'input inline). */
interface CibleCote {
  roomId: string
  dim: 'w' | 'h'
  /** Centre de l'étiquette en coordonnées client, mesuré au pointerdown. */
  cx: number
  cy: number
}

interface Presse {
  pointerId: number
  sx: number
  sy: number
  bouge: boolean
  mode: 'pan' | 'drag' | 'dragSym'
  roomId: string | null
  symId: string | null
  bornes: BornesPiece | null
  applique: { dx: number; dy: number }
  gesteCommence: boolean
  vueDepart: Viewport
  /**
   * CIBLES RÉSOLUES AU POINTERDOWN (bug corrigé le 14/07/2026).
   *
   * Interdit de les re-dériver de `e.target` au pointerup : `setPointerCapture`
   * (indispensable au pinch et au drag hors du canvas) fait que le navigateur
   * RETARGETE le pointerup vers le <svg> lui-même. `closest('[data-room-id]')`
   * remonte alors l'arbre depuis le <svg> — la pièce est en DESSOUS, donc
   * jamais trouvée. Effet observé en prod : le 1er clic après chargement
   * sélectionne, tous les suivants ne font plus rien (ni pièce, ni symbole,
   * ni cote), jusqu'au rechargement de la page.
   * Au pointerdown, `e.target` est TOUJOURS l'élément réel : on résout là.
   */
  cible: {
    roomId: string | null
    symId: string | null
    fenceId: string | null
    cote: CibleCote | null
  }
}

interface CoteEdition {
  roomId: string
  dim: 'w' | 'h'
  x: number
  y: number
  valeurMm: number
}

const C = COULEURS_PLAN

export default function PlanCanvas({
  niveau,
  vue,
  outil,
  selectedRoomId,
  selectedSymbolId,
  selectedFenceId,
  polygone,
  onSelectRoom,
  onSelectSymbol,
  onSelectFence,
  onDebutGeste,
  onDeplacerPiece,
  onCote,
  onPoserOuverture,
  onPoserSymbole,
  onDeplacerSymbole,
  onFinDeplacerSymbole,
  onPolygoneTermine,
  onPolygoneAnnule,
}: PlanCanvasProps) {
  /** Type de symbole si l'outil actif est une pose de symbole, sinon null. */
  const outilSym = outil.startsWith('sym:') ? outil.slice(4) : null
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [vp, setVp] = useState<Viewport>(viewportDefaut)
  const [guides, setGuides] = useState<GuideAimant[]>([])
  const [coteEdit, setCoteEdit] = useState<CoteEdition | null>(null)
  const [polyPts, setPolyPts] = useState<PointMm[]>([])
  const [souris, setSouris] = useState<PointMm | null>(null)
  const presse = useRef<Presse | null>(null)
  /**
   * PINCH À 2 DOIGTS (14/07/2026) — correctif d'un vrai bug tactile.
   *
   * Le canvas porte `touch-none` et il DOIT le porter : sans lui, le navigateur
   * scrolle/zoome la page au lieu de nous laisser gérer le pan. Mais rien ne
   * remplaçait le pinch natif ainsi supprimé, et l'événement `wheel` n'existe
   * pas sur tactile : sur téléphone, le SEUL zoom possible était le bouton
   * « + », à ×1,25 par appui (6 à 8 appuis pour aller de la vue d'ensemble à
   * une chambre). Injouable pour un artisan qui relève debout dans la pièce —
   * or c'est LE cas d'usage du module.
   */
  const pointeurs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef<{ dist: number; cx: number; cy: number; vueDepart: Viewport } | null>(null)
  const espace = useRef(false)
  const vueTouchee = useRef(false)
  const guideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const niveauRef = useRef(niveau)
  niveauRef.current = niveau

  // ── Cadrage automatique au chargement et au changement de niveau ─────────
  const ajusterVue = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const bornes = bornesNiveau(niveauRef.current)
    if (!bornes) {
      setVp(viewportDefaut())
      return
    }
    setVp(cadrerSur(bornes, wrap.clientWidth, wrap.clientHeight))
  }, [])

  useEffect(() => {
    vueTouchee.current = false
    ajusterVue()
    setPolyPts([])
    setCoteEdit(null)
    // Table des doigts repartie à zéro au changement de niveau (sinon un
    // pointeur resté coincé contaminerait le niveau suivant).
    pointeurs.current.clear()
    pinch.current = null
  }, [niveau.id, ajusterVue])

  /**
   * FILET ANTI-FUITE des pointeurs. Un pointerup peut ne JAMAIS atteindre le
   * <svg> si la cible du geste est démontée en cours de route (les guides
   * d'aimantation disparaissent au bout de 400 ms, l'aperçu de polygone change
   * à chaque mouvement, le plan se re-rend à chaque zoom). L'entrée resterait
   * alors dans la table : le tap suivant ferait croire à un 2e doigt → pinch
   * avec un doigt fantôme → zoom aberrant, plus aucun clic. Canvas mort
   * jusqu'au rechargement de la page.
   * Un pointerup capturé remonte toujours jusqu'à window : ce filet ne peut pas
   * le manquer, et il s'exécute après le handler React (logique intacte).
   */
  useEffect(() => {
    const purge = (e: PointerEvent) => {
      pointeurs.current.delete(e.pointerId)
      if (pointeurs.current.size < 2) pinch.current = null
    }
    window.addEventListener('pointerup', purge)
    window.addEventListener('pointercancel', purge)
    return () => {
      window.removeEventListener('pointerup', purge)
      window.removeEventListener('pointercancel', purge)
    }
  }, [])

  // Recadre quand une pièce apparaît si l'utilisateur n'a pas touché la vue.
  const nbPieces = niveau.rooms.length
  useEffect(() => {
    if (!vueTouchee.current) ajusterVue()
  }, [nbPieces, ajusterVue])

  // ── Zoom molette + Espace (pan) + Échap : hook extrait (useCanvasNav) ────
  const onEchap = useCallback(() => {
    if (polygone) {
      setPolyPts([])
      onPolygoneAnnule()
    }
    setCoteEdit(null)
  }, [polygone, onPolygoneAnnule])
  useCanvasNav(svgRef, setVp, vueTouchee, espace, onEchap)

  const pointMonde = useCallback(
    (clientX: number, clientY: number): PointMm => {
      const svg = svgRef.current
      if (!svg) return [0, 0]
      const rect = svg.getBoundingClientRect()
      const [x, y] = versMonde(vp, clientX - rect.left, clientY - rect.top)
      return [Math.round(x), Math.round(y)]
    },
    [vp]
  )

  const afficherGuides = useCallback((gs: GuideAimant[]) => {
    setGuides(gs)
    if (guideTimer.current) clearTimeout(guideTimer.current)
    guideTimer.current = setTimeout(() => setGuides([]), 400)
  }, [])

  /** Pièce (la plus haute) contenant un point monde, ou null. */
  const pieceAuPoint = useCallback((pt: PointMm): string | null => {
    const rooms = niveauRef.current.rooms
    for (let i = rooms.length - 1; i >= 0; i--) {
      if (estDansPolygone(pt, rooms[i].vertices)) return rooms[i].id
    }
    return null
  }, [])

  /**
   * Écart et milieu des 2 doigts actifs (null si moins de 2). PUR.
   * `Array.from` et non `[...map.values()]` : le tsconfig cible ES5, où le
   * spread d'itérateur casse le build Vercel (TS2802).
   */
  const deuxDoigts = useCallback((): { dist: number; cx: number; cy: number } | null => {
    const pts = Array.from(pointeurs.current.values())
    if (pts.length < 2) return null
    const a = pts[0]
    const b = pts[1]
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    }
  }, [])

  // ── Pointer down / move / up ──────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Capture AVANT tout garde de taille : un pointeur enregistré doit TOUJOURS
    // recevoir son pointerup, sinon il fuit dans la table et le canvas finit
    // par se croire en pinch en permanence (insensible au tap).
    svgRef.current?.setPointerCapture(e.pointerId)
    // 2e doigt : on ABANDONNE le geste en cours (pan/drag démarré au 1er doigt)
    // et on bascule en pinch. Un déplacement de PIÈCE interrompu reste cohérent
    // (undo déjà poussé par onDebutGeste, déplacements incrémentaux). Un drag de
    // SYMBOLE, lui, doit être finalisé ici : c'est onFinDeplacerSymbole qui
    // réaffecte le symbole à la pièce qui le contient. Sans cet appel, le
    // symbole resterait rattaché à son ancienne pièce — incohérence silencieuse
    // qui fausserait métrés, 3D et PDF.
    if (pointeurs.current.size === 2) {
      const p0 = presse.current
      if (p0?.bouge && p0.mode === 'dragSym' && p0.symId) onFinDeplacerSymbole(p0.symId)
      presse.current = null
      setGuides([])
      const d = deuxDoigts()
      if (d) {
        vueTouchee.current = true
        pinch.current = { dist: d.dist, cx: d.cx, cy: d.cy, vueDepart: vp }
      }
      return
    }
    // 3 doigts ou plus : on ignore, le pinch en cours continue sur les 2 premiers.
    if (pointeurs.current.size > 2) return
    // ⚠️ NE PAS fermer la cote en cours ici (`setCoteEdit(null)` retiré le
    // 14/07/2026). Ça démontait l'input ENCORE FOCALISÉ avant que le navigateur
    // ait déplacé le focus : Chrome ne déclenche pas `blur` sur un nœud retiré
    // du DOM, donc `onBlur={valider}` ne s'exécutait jamais et la valeur tapée
    // était PERDUE EN SILENCE (taper « 4,27 » puis cliquer sur le plan =
    // saisie évaporée). Le blur naturel ferme et valide déjà la cote tout seul.
    // Cf. la règle « la cote saisie est sacrée ».
    // Résolution des cibles ICI, au pointerdown : `e.target` est l'élément réel
    // (au pointerup il sera retargeté vers le <svg> par la capture — cf. Presse.cible).
    const t = e.target as Element
    const cible = t.closest('[data-room-id]')
    const cibleSym = t.closest('[data-symbol-id]')
    const elCote = t.closest('[data-cote-room]')
    let coteCible: CibleCote | null = null
    if (elCote) {
      // Position figée maintenant : au pointerup, un re-rendu React peut avoir
      // remplacé le nœud, et getBoundingClientRect() d'un nœud détaché rend 0.
      const b = elCote.getBoundingClientRect()
      coteCible = {
        roomId: elCote.getAttribute('data-cote-room') ?? '',
        dim: elCote.getAttribute('data-cote-dim') === 'h' ? 'h' : 'w',
        cx: b.left + b.width / 2,
        cy: b.top + b.height / 2,
      }
    }
    const p: Presse = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      bouge: false,
      mode: 'pan',
      roomId: null,
      symId: null,
      bornes: null,
      applique: { dx: 0, dy: 0 },
      gesteCommence: false,
      vueDepart: vp,
      cible: {
        roomId: cible ? cible.getAttribute('data-room-id') : null,
        symId: cibleSym ? cibleSym.getAttribute('data-symbol-id') : null,
        fenceId: (() => {
          const f = t.closest('[data-fence-id]')
          return f ? f.getAttribute('data-fence-id') : null
        })(),
        cote: coteCible,
      },
    }
    const panForce = e.button === 1 || espace.current
    if (!panForce && !polygone && outil === 'select' && cibleSym) {
      p.mode = 'dragSym'
      p.symId = cibleSym.getAttribute('data-symbol-id')
    } else if (!panForce && !polygone && outil === 'select' && cible) {
      const id = cible.getAttribute('data-room-id')
      const piece = niveau.rooms.find((r) => r.id === id)
      if (piece) {
        p.mode = 'drag'
        p.roomId = piece.id
        p.bornes = bornesPiece(piece)
      }
    }
    presse.current = p
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointeurs.current.has(e.pointerId)) {
      pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    // Pinch actif : zoom autour du milieu INITIAL des 2 doigts (le point pincé
    // reste sous les doigts) + pan du déplacement de ce milieu (on peut donc
    // zoomer et déplacer d'un seul geste, comme sur une carte).
    const pz = pinch.current
    if (pz) {
      const d = deuxDoigts()
      const svg = svgRef.current
      if (!d || !svg || d.dist <= 0 || pz.dist <= 0) return
      const rect = svg.getBoundingClientRect()
      const base = zoomAutour(pz.vueDepart, pz.cx - rect.left, pz.cy - rect.top, d.dist / pz.dist)
      setVp({ k: base.k, tx: base.tx + (d.cx - pz.cx), ty: base.ty + (d.cy - pz.cy) })
      return
    }
    if (polygone && !presse.current) {
      const [x, y] = pointMonde(e.clientX, e.clientY)
      setSouris([snapMm(x, GRILLE_MM), snapMm(y, GRILLE_MM)])
    }
    const p = presse.current
    if (!p || e.pointerId !== p.pointerId) return
    const dxPx = e.clientX - p.sx
    const dyPx = e.clientY - p.sy
    if (!p.bouge && Math.hypot(dxPx, dyPx) > 4) p.bouge = true
    if (!p.bouge) return

    if (p.mode === 'pan') {
      vueTouchee.current = true
      setVp({ k: p.vueDepart.k, tx: p.vueDepart.tx + dxPx, ty: p.vueDepart.ty + dyPx })
      return
    }
    if (p.mode === 'dragSym' && p.symId) {
      if (!p.gesteCommence) {
        p.gesteCommence = true
        onDebutGeste()
      }
      const dx = snapMm(dxPx / p.vueDepart.k, GRILLE_SYM_MM)
      const dy = snapMm(dyPx / p.vueDepart.k, GRILLE_SYM_MM)
      if (dx !== p.applique.dx || dy !== p.applique.dy) {
        onDeplacerSymbole(p.symId, dx - p.applique.dx, dy - p.applique.dy)
        p.applique = { dx, dy }
      }
      return
    }
    if (p.mode === 'drag' && p.roomId && p.bornes) {
      if (!p.gesteCommence) {
        p.gesteCommence = true
        onDebutGeste()
      }
      const voulu = aimanterDeplacement(
        p.bornes,
        dxPx / p.vueDepart.k,
        dyPx / p.vueDepart.k,
        niveauRef.current.rooms,
        p.roomId
      )
      const incX = voulu.dx - p.applique.dx
      const incY = voulu.dy - p.applique.dy
      if (incX !== 0 || incY !== 0) {
        p.applique = { dx: voulu.dx, dy: voulu.dy }
        onDeplacerPiece(p.roomId, incX, incY)
        afficherGuides(voulu.guides)
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointeurs.current.delete(e.pointerId)
    // Fin de pinch : dès qu'il ne reste qu'un doigt on sort du mode, et on ne
    // traite SURTOUT pas ce lever comme un clic (sinon un pinch sélectionne ou
    // désélectionne une pièce au passage).
    if (pinch.current) {
      if (pointeurs.current.size < 2) {
        pinch.current = null
      } else {
        // Un 3e doigt était posé et l'un des deux premiers vient de se lever :
        // on RE-BASE le pinch sur les doigts restants. Sans ça, on comparerait
        // l'écart d'un NOUVEAU couple de doigts à la distance de référence de
        // l'ancien → bond de zoom brutal (main qui s'appuie, pouce qui glisse).
        const d = deuxDoigts()
        if (d) pinch.current = { dist: d.dist, cx: d.cx, cy: d.cy, vueDepart: vp }
      }
      return
    }
    const p = presse.current
    if (!p || e.pointerId !== p.pointerId) return
    presse.current = null
    if (p.bouge) {
      setGuides([])
      // Fin de drag d'un symbole : réaffectation de la pièce d'appartenance.
      if (p.mode === 'dragSym' && p.symId) onFinDeplacerSymbole(p.symId)
      return
    }

    // ── Clic simple ──
    // 1) Mode polygone : un point par clic, clic près du 1er = fermeture (clôture : jamais).
    if (polygone) {
      const [x, y] = pointMonde(e.clientX, e.clientY)
      const px = snapMm(x, GRILLE_MM)
      const py = snapMm(y, GRILLE_MM)
      if (polygone.mode !== 'cloture' && polyPts.length >= 3) {
        const [x0, y0] = polyPts[0]
        if (Math.hypot(px - x0, py - y0) < FERMETURE_POLY_MM) {
          const pts = polyPts
          setPolyPts([])
          setSouris(null)
          onPolygoneTermine(pts)
          return
        }
      }
      setPolyPts((pts) => [...pts, [px, py]])
      return
    }

    // ⚠️ Toutes les cibles viennent de `p.cible`, figé au POINTERDOWN — jamais
    // de `e.target` ici : la capture du pointeur l'a retargeté vers le <svg>
    // (cf. le commentaire de Presse.cible).

    // 2) Cote cliquée : input inline positionné sur l'étiquette.
    const cote = p.cible.cote
    if (cote && wrapRef.current) {
      const piece = niveau.rooms.find((r) => r.id === cote.roomId)
      if (!piece) return
      const b = bornesPiece(piece)
      const wrap = wrapRef.current.getBoundingClientRect()
      setCoteEdit({
        roomId: cote.roomId,
        dim: cote.dim,
        x: cote.cx - wrap.left,
        y: cote.cy - wrap.top,
        valeurMm: cote.dim === 'w' ? b.x2 - b.x1 : b.y2 - b.y1,
      })
      return
    }

    const cibleRoomId = p.cible.roomId
    const cibleSymId = p.cible.symId

    // 3) Outil symbole : pose en série (l'outil reste actif, Échap pour sortir).
    if (outilSym) {
      const [x, y] = pointMonde(e.clientX, e.clientY)
      const pt: PointMm = [snapMm(x, GRILLE_SYM_MM), snapMm(y, GRILLE_SYM_MM)]
      onPoserSymbole(outilSym, pt, pieceAuPoint(pt))
      return
    }

    // 4) Outil ouverture : clic dans une pièce, près du mur receveur.
    if (outil !== 'select') {
      const pt = pointMonde(e.clientX, e.clientY)
      const dans = pieceAuPoint(pt) ?? cibleRoomId
      if (dans) onPoserOuverture(dans, pt, outil as TypeOuverture)
      return
    }

    // 5) Sélection : symbole prioritaire, puis clôture, puis pièce.
    if (cibleSymId) {
      onSelectSymbol(cibleSymId)
      return
    }
    if (p.cible.fenceId) {
      onSelectFence(p.cible.fenceId)
      return
    }
    onSelectRoom(cibleRoomId)
  }

  /**
   * Annulation système d'un pointeur (appel entrant, geste de bord iOS, rejet
   * de paume, doigt sorti de l'écran).
   *
   * Handler DÉDIÉ, surtout PAS `onPointerUp` : un geste annulé qui n'a pas
   * bougé traverserait toute la logique de clic et **poserait un symbole ou
   * désélectionnerait la pièce**. Une annulation ne doit RIEN valider.
   * ⚠️ Ne jamais ajouter ici de garde `e.button` : un pointercancel porte
   * button === −1 et sortirait avant le delete → fuite de la table.
   */
  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    pointeurs.current.delete(e.pointerId)
    if (pointeurs.current.size < 2) pinch.current = null
    const p = presse.current
    presse.current = null
    setGuides([])
    if (p?.bouge && p.mode === 'dragSym' && p.symId) onFinDeplacerSymbole(p.symId)
  }

  const onDoubleClick = () => {
    const min = polygone?.mode === 'cloture' ? 2 : 3
    if (polygone && polyPts.length >= min) {
      const pts = polyPts
      setPolyPts([])
      setSouris(null)
      onPolygoneTermine(pts)
    }
  }

  const curseur = polygone ? 'cursor-crosshair' : outil !== 'select' ? 'cursor-copy' : 'cursor-default'

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden ${curseur}`}
      style={{ backgroundColor: C.fond }}
    >
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Plan du niveau ${niveau.name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <PlanDefs idPrefix="editeur" />
        </defs>
        <g transform={transformSvg(vp)}>
          <PlanRender
            niveau={niveau}
            vue={vue}
            selectedRoomId={selectedRoomId}
            selectedSymbolId={selectedSymbolId}
            selectedFenceId={selectedFenceId}
            interactif
            idPrefix="editeur"
            grille
          />
          {guides.map((g, i) =>
            g.vertical ? (
              <line key={i} x1={g.at} y1={-50000} x2={g.at} y2={50000} stroke={C.sky} strokeWidth="1.6" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : (
              <line key={i} x1={-50000} y1={g.at} x2={50000} y2={g.at} stroke={C.sky} strokeWidth="1.6" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )
          )}
          {polygone && <PolygonePreview points={polyPts} souris={souris} calque={polygone.calque} ouvert={polygone.mode === 'cloture'} />}
        </g>
      </svg>

      {/* Boutons de zoom */}
      <ZoomControls
        onZoom={(facteur) => {
          const wrap = wrapRef.current
          if (!wrap) return
          vueTouchee.current = true
          setVp((v) => zoomAutour(v, wrap.clientWidth / 2, wrap.clientHeight / 2, facteur))
        }}
        onAjuster={() => {
          vueTouchee.current = false
          ajusterVue()
        }}
      />

      {/* Input inline de cote */}
      {coteEdit && (
        <CoteInput
          x={coteEdit.x}
          y={coteEdit.y}
          valeurMm={coteEdit.valeurMm}
          onCommit={(mm) => {
            onCote(coteEdit.roomId, coteEdit.dim, mm)
            setCoteEdit(null)
          }}
          onCancel={() => setCoteEdit(null)}
        />
      )}
    </div>
  )
}
