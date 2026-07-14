'use client'

/**
 * Iso3dView — Vue 3D isométrique de présentation (Push 6, 06/07/2026).
 *
 * Surcouche plein cadre au-dessus du canvas 2D (le canvas reste monté :
 * son viewport est intact au retour en 2D). AUCUNE mutation du plan ici :
 * vue en lecture seule, portée par le moteur pur lib/plan/iso.ts.
 *
 * - SVG auto-fit (viewBox englobant calculé par le moteur) ;
 * - barre flottante : rotation par quarts de tour, segmented
 *   « Avant | Après » (Avant = calque projet fondu ~300 ms, défaut Après),
 *   bouton « Capturer » = téléchargement PNG local via svgVersPng
 *   (mêmes contraintes que l'export : couleurs hex, polices à repli
 *   système) nommé « plan-3d-[nom].png » ;
 * - bandeau discret « les modifications se font en 2D » ;
 * - glyphes des symboles : formes réutilisées de SymboleSvg (Forme),
 *   billboard (muraux) ou aplaties sur le plan du sol via la matrice de
 *   la projection isométrique.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { EtatAvancement, Niveau } from '@/lib/plan/types'
import { AVANCEMENT_META, AVANCEMENT_ORDRE, COULEURS_PLAN, avancementDe } from '@/lib/plan/defaults'
import {
  construireScene3d,
  ISO_COS,
  ISO_SIN,
  type IsoCalque,
  type IsoGlyphe,
  type IsoPrim,
} from '@/lib/plan/iso'
import { defSymbole } from '@/lib/plan/symboles'
import { svgVersPng } from '@/lib/plan/export'
import { toast } from '@/lib/toast'
import { Forme } from './SymboleSvg'

const C = COULEURS_PLAN
const FONT_TXT = "'Hanken Grotesk', sans-serif"
const FONT_NUM = "'Spline Sans Mono', ui-monospace, monospace"
/**
 * Échelle des glyphes muraux (billboard). Remontée de 0,8 à 1,05 (Push polish
 * 3D) : les prises/interrupteurs étaient minuscules et illisibles en 3D.
 */
const ECHELLE_BILLBOARD = 1.05
/** Largeur du PNG capturé (px). La hauteur suit le ratio du viewBox. */
const LARGEUR_CAPTURE = 1600

/**
 * Nom de fichier sûr : « Plan cuisine Été » -> « plan-cuisine-ete ».
 * Les accents sont décomposés (NFD) puis les diacritiques (U+0300–U+036F)
 * retirés par code point — pas de classe Unicode en regex (build Vercel ES5).
 */
function slugDe(nom: string): string {
  const sansAccents = Array.from(nom.toLowerCase().normalize('NFD'))
    .filter((ch) => {
      const c = ch.charCodeAt(0)
      return c < 0x0300 || c > 0x036f
    })
    .join('')
  const brut = sansAccents.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return brut || 'plan'
}

const r = (v: number) => Math.round(v)

/** Une primitive projetée -> élément SVG (traits en px écran). */
function PrimSvg({ p }: { p: IsoPrim }) {
  if (p.prim === 'poly') {
    return (
      <polygon
        points={p.pts.map((q) => `${r(q[0])},${r(q[1])}`).join(' ')}
        fill={p.fill}
        fillOpacity={p.fillOpacity}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        strokeDasharray={p.dash}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  if (p.prim === 'polyligne') {
    return (
      <polyline
        points={p.pts.map((q) => `${r(q[0])},${r(q[1])}`).join(' ')}
        fill="none"
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        strokeDasharray={p.dash}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  return (
    <line
      x1={r(p.a[0])}
      y1={r(p.a[1])}
      x2={r(p.b[0])}
      y2={r(p.b[1])}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      strokeDasharray={p.dash}
      strokeOpacity={p.opacite}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  )
}

/**
 * Glyphe d'un symbole : formes SymboleSvg, plaquées face caméra
 * (billboard) ou aplaties sur le plan du sol (matrice de la projection :
 * (u, v) -> ((u − v)·0,866, (u + v)·0,5), même formule que projeterIso).
 */
function GlypheSvg({ g }: { g: IsoGlyphe }) {
  const def = defSymbole(g.type)
  if (!def) return null
  const t =
    g.pose === 'billboard'
      ? `translate(${r(g.at[0])} ${r(g.at[1])}) scale(${ECHELLE_BILLBOARD})`
      : `translate(${r(g.at[0])} ${r(g.at[1])}) matrix(${ISO_COS} ${ISO_SIN} ${-ISO_COS} ${ISO_SIN} 0 0) rotate(${g.rotationDeg})`
  return (
    <g transform={t} pointerEvents="none">
      {/* Pastille blanche derrière les glyphes muraux (billboard) : les rend
          lisibles quand ils se superposent aux murs. Formes par-dessus. */}
      {g.pose === 'billboard' && (
        <circle cx={0} cy={0} r={def.rayon} fill={C.blanc} fillOpacity={0.9} />
      )}
      {def.formes.map((f, i) => (
        <Forme key={i} f={f} c={g.couleur} />
      ))}
    </g>
  )
}

/** Un calque trié : sols, puis faces (painter's), puis étiquettes. */
function CalqueSvg({ calque }: { calque: IsoCalque }) {
  return (
    <>
      {calque.ombres.map((p, i) => (
        <PrimSvg key={`o${i}`} p={p} />
      ))}
      {calque.sols.map((p, i) => (
        <PrimSvg key={`s${i}`} p={p} />
      ))}
      {calque.faces.map((f, i) => (
        <g key={`f${i}`}>
          {f.prims.map((p, j) => (
            <PrimSvg key={j} p={p} />
          ))}
        </g>
      ))}
      {/* Couche d'annotation : les glyphes passent APRÈS les murs pour ne plus
          être écrasés par les murs avant translucides (cf. IsoCalque.glyphes). */}
      {calque.glyphes.map((g, i) => (
        <GlypheSvg key={`g${i}`} g={g} />
      ))}
      {calque.etiquettes.map((e, i) => (
        <g key={`e${i}`} pointerEvents="none">
          <text
            x={r(e.at[0])}
            y={r(e.at[1]) - 60}
            fontFamily={FONT_TXT}
            fontSize="280"
            fontWeight="700"
            fill={e.couleur}
            textAnchor="middle"
            paintOrder="stroke"
            stroke={C.fond}
            strokeWidth="60"
          >
            {e.nom}
          </text>
          <text
            x={r(e.at[0])}
            y={r(e.at[1]) + 220}
            fontFamily={FONT_NUM}
            fontSize="230"
            fill={e.couleur}
            textAnchor="middle"
            paintOrder="stroke"
            stroke={C.fond}
            strokeWidth="55"
          >
            {e.aire}
          </text>
          {e.etat && (
            <text
              x={r(e.at[0])}
              y={r(e.at[1]) + 480}
              fontFamily={FONT_TXT}
              fontSize="215"
              fontWeight="700"
              fill={e.etat.couleur}
              textAnchor="middle"
              paintOrder="stroke"
              stroke={C.fond}
              strokeWidth="70"
            >
              {e.etat.court}
            </text>
          )}
        </g>
      ))}
    </>
  )
}

const BTN_ICONE =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-gray-200 text-navy transition-colors hover:border-orange'

export interface Iso3dViewProps {
  niveau: Niveau
  /** Nom du plan (nom du fichier PNG capturé). */
  nomPlan: string
}

export default function Iso3dView({ niveau, nomPlan }: Iso3dViewProps) {
  const [rot, setRot] = useState(0)
  const [mode, setMode] = useState<'avant' | 'apres'>('apres')
  const [entree, setEntree] = useState(false)
  const [captureEnCours, setCaptureEnCours] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Transition d'entrée (~300 ms) : la vue apparaît en fondu.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntree(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const scene = useMemo(
    () => construireScene3d(niveau, rot, { avancementVisible: true }),
    [niveau, rot],
  )

  // États d'avancement RÉELLEMENT présents (hors 'a_faire', qui n'est pas
  // teinté) → alimente la légende couleurs et l'aria-label de la vue 3D.
  const etatsPresents = useMemo<EtatAvancement[]>(() => {
    const vus = new Set<EtatAvancement>()
    for (const r of niveau.rooms) {
      const e = avancementDe(r)
      if (e !== 'a_faire') vus.add(e)
    }
    return AVANCEMENT_ORDRE.filter((e) => vus.has(e))
  }, [niveau])

  const vb = useMemo(() => {
    if (!scene.bornes) return null
    const { x1, y1, x2, y2 } = scene.bornes
    const marge = Math.max(x2 - x1, y2 - y1) * 0.08 + 500
    return { x: x1 - marge, y: y1 - marge, w: x2 - x1 + 2 * marge, h: y2 - y1 + 2 * marge }
  }, [scene])

  const capturer = async () => {
    const el = svgRef.current
    if (!el || !vb || captureEnCours) return
    setCaptureEnCours(true)
    try {
      const w = LARGEUR_CAPTURE
      const h = Math.max(1, Math.round((w * vb.h) / vb.w))
      // Clone avec width/height explicites : un SVG « viewBox seul » chargé
      // dans une Image peut retomber sur 300×150 selon le navigateur.
      const clone = el.cloneNode(true) as SVGSVGElement
      clone.setAttribute('width', String(w))
      clone.setAttribute('height', String(h))
      const markup = new XMLSerializer().serializeToString(clone)
      const dataUrl = await svgVersPng(markup, w, h, 1, 'png')
      if (!dataUrl) {
        toast.error('Capture impossible', { description: 'Réessayez, ou faites une capture d’écran.' })
        return
      }
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `plan-3d-${slugDe(nomPlan)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('Vue 3D téléchargée en PNG')
    } finally {
      setCaptureEnCours(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-20 transition-opacity duration-300"
      style={{ backgroundColor: C.fond, opacity: entree ? 1 : 0 }}
    >
      {vb ? (
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`${r(vb.x)} ${r(vb.y)} ${r(vb.w)} ${r(vb.h)}`}
          className="h-full w-full"
          role="img"
          aria-label={
            etatsPresents.length > 0
              ? `Vue 3D du niveau ${niveau.name}. Sols coloriés selon l'avancement : ${etatsPresents
                  .map((e) => AVANCEMENT_META[e].label.toLowerCase())
                  .join(', ')}.`
              : `Vue 3D du niveau ${niveau.name}`
          }
        >
          <g>
            <CalqueSvg calque={scene.existant} />
          </g>
          <g style={{ opacity: mode === 'avant' ? 0 : 1, transition: 'opacity 300ms ease' }}>
            <CalqueSvg calque={scene.projet} />
          </g>
        </svg>
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 text-center shadow-lg">
            <p className="font-hanken text-[15px] font-extrabold text-navy">Ce niveau est vide</p>
            <p className="mt-1 font-hanken text-[13px] text-gray-500">
              Repassez en 2D pour ajouter une première pièce, la vue 3D se construira toute seule.
            </p>
          </div>
        </div>
      )}

      {/* Bandeau discret */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-max max-w-[92%] -translate-x-1/2 rounded-full border border-gray-200 bg-white/95 px-4 py-1.5 text-center font-hanken text-xs font-semibold text-gray-500 shadow-sm">
        Vue 3D de présentation — les modifications se font en 2D
      </div>

      {/* Légende d'avancement (états présents seulement) : évite des sols
          colorés « muets » et aide au repérage (daltonisme : texte + pastille). */}
      {etatsPresents.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-sm">
          {etatsPresents.map((e) => (
            <span key={e} className="flex items-center gap-1.5 font-hanken text-[11.5px] font-semibold text-gray-600">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: AVANCEMENT_META[e].fill ?? '#e3e9f2' }}
                aria-hidden="true"
              />
              {AVANCEMENT_META[e].court}
            </span>
          ))}
        </div>
      )}

      {/* Barre flottante : rotation, Avant/Après, capture */}
      <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-2.5 py-2 shadow-xl">
        <button
          type="button"
          onClick={() => setRot((v) => (v + 3) % 4)}
          aria-label="Tourner d'un quart de tour à gauche"
          title="Rotation −90°"
          className={BTN_ICONE}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setRot((v) => (v + 1) % 4)}
          aria-label="Tourner d'un quart de tour à droite"
          title="Rotation +90°"
          className={BTN_ICONE}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        </button>

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
          onClick={capturer}
          disabled={captureEnCours || !vb}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border-[1.5px] border-gray-200 px-3.5 font-hanken text-[12.5px] font-bold text-navy transition-colors hover:border-orange disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4" />
            <path strokeLinecap="round" d="M5 19h14" />
          </svg>
          {captureEnCours ? 'Capture…' : 'Capturer'}
        </button>
      </div>
    </div>
  )
}
