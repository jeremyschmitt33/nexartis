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
import { estDansPolygone, fmtNombreFr, mmVersM, snapMm } from '@/lib/plan/geometry'
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
import CoteInput from './CoteInput'
import ZoomControls from './ZoomControls'

export type Outil = 'select' | TypeOuverture

export interface PolygoneEnCours {
  nom: string
  calque: CalqueId
}

export interface PlanCanvasProps {
  niveau: Niveau
  vue: VueCalque
  outil: Outil
  selectedRoomId: string | null
  polygone: PolygoneEnCours | null
  onSelectRoom: (id: string | null) => void
  onDebutGeste: () => void
  onDeplacerPiece: (roomId: string, dx: number, dy: number) => void
  onCote: (roomId: string, dim: 'w' | 'h', mm: number) => void
  onPoserOuverture: (roomId: string, point: PointMm, type: TypeOuverture) => void
  onPolygoneTermine: (points: PointMm[]) => void
  onPolygoneAnnule: () => void
}

interface Presse {
  pointerId: number
  sx: number
  sy: number
  bouge: boolean
  mode: 'pan' | 'drag'
  roomId: string | null
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
  polygone,
  onSelectRoom,
  onDebutGeste,
  onDeplacerPiece,
  onCote,
  onPoserOuverture,
  onPolygoneTermine,
  onPolygoneAnnule,
}: PlanCanvasProps) {
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

  // ── Zoom molette (listener natif : preventDefault interdit en passif) ────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const facteur = e.deltaY < 0 ? 1.12 : 1 / 1.12
      vueTouchee.current = true
      setVp((v) => zoomAutour(v, e.clientX - rect.left, e.clientY - rect.top, facteur))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // ── Espace = pan temporaire, Échap = annulation ───────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') espace.current = true
      if (e.key === 'Escape') {
        if (polygone) {
          setPolyPts([])
          onPolygoneAnnule()
        }
        setCoteEdit(null)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') espace.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [polygone, onPolygoneAnnule])

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

  // ── Pointer down / move / up ──────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    setCoteEdit(null)
    const cible = (e.target as Element).closest('[data-room-id]')
    const p: Presse = {
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      bouge: false,
      mode: 'pan',
      roomId: null,
      bornes: null,
      applique: { dx: 0, dy: 0 },
      gesteCommence: false,
      vueDepart: vp,
    }
    const panForce = e.button === 1 || espace.current
    if (!panForce && !polygone && outil === 'select' && cible) {
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
      return
    }

    // ── Clic simple ──
    // 1) Mode polygone : chaque clic pose un point, clic près du 1er = fermeture.
    if (polygone) {
      const [x, y] = pointMonde(e.clientX, e.clientY)
      const px = snapMm(x, GRILLE_MM)
      const py = snapMm(y, GRILLE_MM)
      if (polyPts.length >= 3) {
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

    // 3) Outil ouverture : clic dans une pièce, près du mur receveur.
    if (outil !== 'select') {
      const pt = pointMonde(e.clientX, e.clientY)
      const rooms = niveau.rooms
      let dans: string | null = null
      for (let i = rooms.length - 1; i >= 0; i--) {
        if (estDansPolygone(pt, rooms[i].vertices)) {
          dans = rooms[i].id
          break
        }
      }
      if (!dans && cible) dans = cible.getAttribute('data-room-id')
      if (dans) onPoserOuverture(dans, pt, outil)
      return
    }

    // 4) Sélection.
    onSelectRoom(cible ? cible.getAttribute('data-room-id') : null)
  }

  const onDoubleClick = () => {
    if (polygone && polyPts.length >= 3) {
      const pts = polyPts
      setPolyPts([])
      setSouris(null)
      onPolygoneTermine(pts)
    }
  }

  // ── Aperçu du polygone en cours (éditeur uniquement) ─────────────────────
  const apercuPoly = () => {
    if (!polygone || polyPts.length === 0) return null
    const c = polygone.calque === 'projet' ? C.orange : C.navyMid
    const pts = souris ? [...polyPts, souris] : polyPts
    const segs = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      const L = Math.hypot(x2 - x1, y2 - y1)
      if (L < 200) continue
      segs.push(
        <text key={i} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 140} fontFamily="'Spline Sans Mono', monospace" fontSize="230" fill={c} textAnchor="middle" paintOrder="stroke" stroke={C.fond} strokeWidth="65">
          {fmtNombreFr(mmVersM(L))} m
        </text>
      )
    }
    return (
      <g pointerEvents="none">
        <polyline
          points={pts.map((p) => p.join(',')).join(' ')}
          fill="rgba(90,180,224,0.08)"
          stroke={c}
          strokeWidth="2.4"
          strokeDasharray="8 6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {segs}
        {polyPts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="90" fill={C.blanc} stroke={c} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
        ))}
        <circle cx={polyPts[0][0]} cy={polyPts[0][1]} r="150" fill="none" stroke={C.orange} strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      </g>
    )
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
          <PlanRender niveau={niveau} vue={vue} selectedRoomId={selectedRoomId} interactif idPrefix="editeur" grille />
          {guides.map((g, i) =>
            g.vertical ? (
              <line key={i} x1={g.at} y1={-50000} x2={g.at} y2={50000} stroke={C.sky} strokeWidth="1.6" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : (
              <line key={i} x1={-50000} y1={g.at} x2={50000} y2={g.at} stroke={C.sky} strokeWidth="1.6" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )
          )}
          {apercuPoly()}
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
