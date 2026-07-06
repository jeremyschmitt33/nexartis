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
import type { CalqueId, Niveau, PointMm, TypeOuverture } from '@/lib/plan/types'
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
  }, [niveau.id, ajusterVue])

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

  // ── Pointer down / move / up ──────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    setCoteEdit(null)
    const cible = (e.target as Element).closest('[data-room-id]')
    const cibleSym = (e.target as Element).closest('[data-symbol-id]')
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
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
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

    // 2) Cote cliquée : input inline positionné sur l'étiquette.
    const cote = (e.target as Element).closest('[data-cote-room]')
    if (cote && wrapRef.current) {
      const roomId = cote.getAttribute('data-cote-room') ?? ''
      const dim = (cote.getAttribute('data-cote-dim') === 'h' ? 'h' : 'w') as 'w' | 'h'
      const piece = niveau.rooms.find((r) => r.id === roomId)
      if (!piece) return
      const b = bornesPiece(piece)
      const box = (cote as Element).getBoundingClientRect()
      const wrap = wrapRef.current.getBoundingClientRect()
      setCoteEdit({
        roomId,
        dim,
        x: box.left + box.width / 2 - wrap.left,
        y: box.top + box.height / 2 - wrap.top,
        valeurMm: dim === 'w' ? b.x2 - b.x1 : b.y2 - b.y1,
      })
      return
    }

    const cible = (e.target as Element).closest('[data-room-id]')
    const cibleSym = (e.target as Element).closest('[data-symbol-id]')

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
      let dans = pieceAuPoint(pt)
      if (!dans && cible) dans = cible.getAttribute('data-room-id')
      if (dans) onPoserOuverture(dans, pt, outil as TypeOuverture)
      return
    }

    // 5) Sélection : symbole prioritaire, puis clôture, puis pièce.
    if (cibleSym) {
      onSelectSymbol(cibleSym.getAttribute('data-symbol-id'))
      return
    }
    const cibleCloture = (e.target as Element).closest('[data-fence-id]')
    if (cibleCloture) {
      onSelectFence(cibleCloture.getAttribute('data-fence-id'))
      return
    }
    onSelectRoom(cible ? cible.getAttribute('data-room-id') : null)
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
