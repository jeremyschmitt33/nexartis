'use client'

/**
 * Scene3dView — VRAIE vue 3D interactive orbitable (Étape 1, 21/07/2026).
 *
 * SEUL fichier du module qui importe three.js / @react-three. Il est chargé
 * UNIQUEMENT via `dynamic(() => import('./Scene3dView'), { ssr: false })` dans
 * PlanEditor : WebGL n'existe pas côté serveur, un rendu SSR planterait.
 *
 * Rôle : consommer la géométrie 3D PURE de `lib/plan/scene3d.ts` (sommets déjà
 * en mètres, repère Y-haut centré) et la peindre avec une vraie caméra
 * perspective + OrbitControls. L'artisan tourne à la souris (glisser), incline
 * de la vue du dessus (≈ 2D) jusqu'à la 3D complète, et zoome à la molette —
 * exactement ce que la vue iso figée ne permettait pas.
 *
 * AUCUNE mutation du plan ici : lecture seule, comme Iso3dView. Les cotes se
 * modifient toujours en 2D (Étape 1 ; la sélection au clic viendra plus tard).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, Html, Line, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { Niveau } from '@/lib/plan/types'
import { COULEURS_PLAN } from '@/lib/plan/defaults'
import { defSymbole } from '@/lib/plan/symboles'
import {
  construireScene3dReelle,
  type Calque3d,
  type Cloture3d,
  type Etiquette3d,
  type Quad3,
  type Sol3d,
  type Symbole3d,
} from '@/lib/plan/scene3d'
import { Forme } from './SymboleSvg'

const C = COULEURS_PLAN
const FONT_TXT = "'Hanken Grotesk', sans-serif"
const FONT_NUM = "'Spline Sans Mono', ui-monospace, monospace"

/* ── Fabrication des géométries three.js ──────────────────────────────────── */

/** Fusionne des quads (2 triangles chacun) en une BufferGeometry non indexée :
 * les sommets ne sont PAS partagés entre quads → `computeVertexNormals` donne
 * des normales PLATES par facette (chaque mur reçoit sa propre lumière). */
function geometrieQuads(quads: Quad3[]): THREE.BufferGeometry | null {
  if (quads.length === 0) return null
  const positions = new Float32Array(quads.length * 6 * 3)
  let o = 0
  for (const q of quads) {
    const ordre = [q[0], q[1], q[2], q[0], q[2], q[3]]
    for (const v of ordre) {
      positions[o++] = v.x
      positions[o++] = v.y
      positions[o++] = v.z
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

/** Sol d'une pièce : THREE.Shape triangulé (gère les pièces en L / concaves). */
function geometrieSol(contour: [number, number][]): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  contour.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)))
  return new THREE.ShapeGeometry(shape)
}

interface SolPrep {
  geo: THREE.ShapeGeometry
  sol: Sol3d
}
interface CalquePrep {
  sols: SolPrep[]
  murs: THREE.BufferGeometry | null
  mursCouleur: string
  mursOpacite: number
  vitres: THREE.BufferGeometry | null
  clotures: Cloture3d[]
  symboles: Symbole3d[]
  etiquettes: Etiquette3d[]
}

function prepararCalque(calque: Calque3d, projet: boolean): CalquePrep {
  const sols = calque.sols.map((sol) => ({ geo: geometrieSol(sol.contour), sol }))
  const tousQuads = calque.murs.flatMap((lot) => lot.quads)
  const murs = geometrieQuads(tousQuads)
  const vitres = geometrieQuads(calque.vitres.map((v) => v.quad))
  return {
    sols,
    murs,
    mursCouleur: projet ? C.orange : '#cdd6e8',
    mursOpacite: projet ? 0.5 : 1,
    vitres,
    clotures: calque.clotures,
    symboles: calque.symboles,
    etiquettes: calque.etiquettes,
  }
}

function disposerCalque(prep: CalquePrep) {
  for (const s of prep.sols) s.geo.dispose()
  prep.murs?.dispose()
  prep.vitres?.dispose()
}

/* ── Sous-composants de rendu ─────────────────────────────────────────────── */

function SolsCalque({
  prep,
  selectedId,
  onSelect,
}: {
  prep: CalquePrep
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}) {
  return (
    <>
      {prep.sols.map(({ geo, sol }, i) => {
        // Un sol n'est cliquable que s'il porte un pieceId (sols de base des
        // pièces). Les surfaces superposées (teinte d'avancement) ont
        // `raycast` désactivé : elles ne doivent NI intercepter le clic (sinon
        // le rayon toucherait la teinte au lieu du sol, en dessous), NI être
        // sélectionnées.
        const selectable = !!sol.pieceId
        const selectionne = selectable && sol.pieceId === selectedId
        return (
          <group key={i}>
            <mesh
              geometry={geo}
              rotation-x={Math.PI / 2}
              position-y={sol.yOffset}
              raycast={selectable ? undefined : () => null}
              onClick={
                selectable
                  ? (e) => {
                      e.stopPropagation()
                      onSelect?.(sol.pieceId ?? null)
                    }
                  : undefined
              }
              onPointerOver={selectable ? () => (document.body.style.cursor = 'pointer') : undefined}
              onPointerOut={selectable ? () => (document.body.style.cursor = 'auto') : undefined}
            >
              <meshStandardMaterial
                color={sol.couleur}
                transparent={sol.opacite < 1}
                opacity={sol.opacite}
                side={THREE.DoubleSide}
                roughness={0.95}
                metalness={0}
                emissive={selectionne ? C.orange : '#000000'}
                emissiveIntensity={selectionne ? 0.22 : 0}
              />
            </mesh>
            {sol.bord && (
              <Line
                points={[...sol.contour, sol.contour[0]].map(
                  ([x, z]): [number, number, number] => [x, sol.yOffset + 0.012, z],
                )}
                color={selectionne ? C.orange : sol.bord}
                lineWidth={selectionne ? 3 : 1.6}
              />
            )}
          </group>
        )
      })}
    </>
  )
}

function ClotureMesh({ cl }: { cl: Cloture3d }) {
  return (
    <group>
      <Line points={cl.rail.map((p): [number, number, number] => [p.x, p.y, p.z])} color={cl.couleur} lineWidth={1.6} dashed dashSize={0.12} gapSize={0.08} />
      {cl.poteaux.map((seg, i) => (
        <Line key={i} points={[[seg[0].x, seg[0].y, seg[0].z], [seg[1].x, seg[1].y, seg[1].z]]} color={cl.couleur} lineWidth={1.4} />
      ))}
    </group>
  )
}

function GlypheHtml({ s }: { s: Symbole3d }) {
  const def = defSymbole(s.type)
  if (!def) return null
  const R = def.rayon
  return (
    <Html position={[s.at.x, s.at.y, s.at.z]} center distanceFactor={9} pointerEvents="none" zIndexRange={[20, 0]}>
      <svg
        width={2 * R}
        height={2 * R}
        viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {s.pose === 'billboard' && <circle cx={0} cy={0} r={R} fill={C.blanc} fillOpacity={0.9} />}
        <g transform={`rotate(${s.rotationDeg})`}>
          {def.formes.map((f, i) => (
            <Forme key={i} f={f} c={s.couleur} />
          ))}
        </g>
      </svg>
    </Html>
  )
}

function SymbolesCalque({ prep }: { prep: CalquePrep }) {
  return (
    <>
      {prep.symboles.map((s, i) => (
        <group key={i}>
          {s.tige && (
            <Line
              points={[[s.tige.a.x, s.tige.a.y, s.tige.a.z], [s.tige.b.x, s.tige.b.y, s.tige.b.z]]}
              color={s.couleur}
              lineWidth={1}
              transparent
              opacity={s.tige.opacite}
              dashed={s.tige.dash}
              dashSize={0.06}
              gapSize={0.08}
            />
          )}
          <GlypheHtml s={s} />
        </group>
      ))}
    </>
  )
}

function EtiquetteHtml({ e }: { e: Etiquette3d }) {
  return (
    <Html position={[e.at.x, e.at.y, e.at.z]} center distanceFactor={11} pointerEvents="none" zIndexRange={[30, 0]}>
      <div style={{ textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none' }}>
        <div style={{ fontFamily: FONT_TXT, fontWeight: 800, fontSize: 15, color: e.couleur, textShadow: '0 1px 3px rgba(246,248,251,0.95), 0 0 3px rgba(246,248,251,0.95)' }}>
          {e.nom}
        </div>
        <div style={{ fontFamily: FONT_NUM, fontSize: 13, color: e.couleur, textShadow: '0 1px 3px rgba(246,248,251,0.95)' }}>
          {e.aire} · {e.hauteur}
        </div>
      </div>
    </Html>
  )
}

function CalqueRender({
  prep,
  selectedId,
  onSelect,
}: {
  prep: CalquePrep
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}) {
  return (
    <group>
      <SolsCalque prep={prep} selectedId={selectedId} onSelect={onSelect} />
      {prep.murs && (
        <mesh geometry={prep.murs}>
          <meshStandardMaterial
            color={prep.mursCouleur}
            transparent={prep.mursOpacite < 1}
            opacity={prep.mursOpacite}
            side={THREE.DoubleSide}
            roughness={0.85}
            metalness={0}
          />
        </mesh>
      )}
      {prep.vitres && (
        <mesh geometry={prep.vitres}>
          <meshStandardMaterial color={C.sky} transparent opacity={0.42} side={THREE.DoubleSide} roughness={0.2} metalness={0} />
        </mesh>
      )}
      {prep.clotures.map((cl, i) => (
        <ClotureMesh key={i} cl={cl} />
      ))}
      <SymbolesCalque prep={prep} />
      {prep.etiquettes.map((e, i) => (
        <EtiquetteHtml key={i} e={e} />
      ))}
    </group>
  )
}

/* ── Composant principal ──────────────────────────────────────────────────── */

export interface Scene3dViewProps {
  niveau: Niveau
  /** Nom du plan (réservé aux évolutions : capture, titre). */
  nomPlan: string
  /** Id de la pièce sélectionnée (surbrillance) — piloté par PlanEditor. */
  selectedId?: string | null
  /** Clic sur une pièce (ou le vide → null) : demande de sélection. */
  onSelect?: (id: string | null) => void
}

export default function Scene3dView({ niveau, selectedId, onSelect }: Scene3dViewProps) {
  const [mode, setMode] = useState<'avant' | 'apres'>('apres')
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const data = useMemo(() => construireScene3dReelle(niveau, { avancementVisible: true }), [niveau])

  const existant = useMemo(() => prepararCalque(data.existant, false), [data])
  const projet = useMemo(() => prepararCalque(data.projet, true), [data])

  // Libération mémoire GPU quand la géométrie change ou au démontage.
  useEffect(() => () => disposerCalque(existant), [existant])
  useEffect(() => () => disposerCalque(projet), [projet])

  // Filet de sécurité : si la vue 3D est démontée alors que le curseur survole
  // une pièce (ex. Échap pour revenir en 2D pendant le survol), onPointerOut
  // peut ne pas se déclencher — on remet le curseur par défaut au démontage.
  useEffect(() => () => {
    document.body.style.cursor = 'auto'
  }, [])

  const cadre = useMemo(() => {
    const r = data.rayon
    const h = data.hauteurMax
    return {
      position: [r * 1.1, Math.max(h * 2.2, r * 0.9), r * 1.5] as [number, number, number],
      target: [0, h * 0.35, 0] as [number, number, number],
      far: Math.max(200, r * 30),
    }
  }, [data])

  const vide = data.emprise === null
  const grille = Math.max(20, Math.ceil(data.rayon * 2.4))

  return (
    <div className="absolute inset-0 z-20" style={{ backgroundColor: C.fond }}>
      {vide ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 text-center shadow-lg">
            <p className="font-hanken text-[15px] font-extrabold text-navy">Ce niveau est vide</p>
            <p className="mt-1 font-hanken text-[13px] text-gray-500">
              Repassez en 2D pour ajouter une première pièce, la vue 3D se construira toute seule.
            </p>
          </div>
        </div>
      ) : (
        <Canvas
          shadows={false}
          dpr={[1, 2]}
          camera={{ position: cadre.position, fov: 45, near: 0.05, far: cadre.far }}
          style={{ width: '100%', height: '100%' }}
          onPointerMissed={() => onSelect?.(null)}
        >
          <color attach="background" args={[C.fond]} />
          <hemisphereLight args={[0xffffff, 0xb9c2d0, 0.75]} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[data.rayon * 1.2, data.hauteurMax * 3 + 4, data.rayon * 0.6]} intensity={0.85} />
          <directionalLight position={[-data.rayon, data.hauteurMax * 2, -data.rayon]} intensity={0.25} />

          <Grid
            args={[grille, grille]}
            cellSize={1}
            cellThickness={0.6}
            cellColor="#dbe2ee"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#c3cddf"
            fadeDistance={grille * 1.4}
            fadeStrength={1.2}
            infiniteGrid={false}
            position={[0, -0.002, 0]}
            raycast={() => null}
          />

          <CalqueRender prep={existant} selectedId={selectedId} onSelect={onSelect} />
          {mode === 'apres' && <CalqueRender prep={projet} selectedId={selectedId} onSelect={onSelect} />}

          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={cadre.target}
            enableDamping
            dampingFactor={0.08}
            minDistance={data.rayon * 0.3}
            maxDistance={data.rayon * 8}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
        </Canvas>
      )}

      {/* Bandeau discret */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-max max-w-[92%] -translate-x-1/2 rounded-full border border-gray-200 bg-white/95 px-4 py-1.5 text-center font-hanken text-xs font-semibold text-gray-500 shadow-sm">
        Vue 3D interactive — glissez pour tourner, molette pour zoomer. Les modifications se font en 2D.
      </div>

      {/* Barre flottante : Avant/Après + recadrer */}
      {!vide && (
        <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-2.5 py-2 shadow-xl">
          <div className="flex rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Avant ou après travaux">
            {(['avant', 'apres'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-all ${
                  mode === m ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
                }`}
              >
                {m === 'avant' ? 'Avant' : 'Après'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => controlsRef.current?.reset()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border-[1.5px] border-gray-200 px-3.5 font-hanken text-[12.5px] font-bold text-navy transition-colors hover:border-orange"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Recadrer
          </button>
        </div>
      )}
    </div>
  )
}
