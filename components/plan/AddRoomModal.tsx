'use client'

/**
 * AddRoomModal — Modale d'ajout de pièce (Push 2, 03/07/2026).
 * Chips de types (8 fréquentes + « Voir tout » + Autre…), forme
 * Rectangle / En L / Polygone libre, dimensions en mètres (virgule
 * française), calque Existant / Projet. Reprend la maquette V2.1.
 */

import { useEffect, useRef, useState } from 'react'
import type { CalqueId, NatureZone, TypeExterieur } from '@/lib/plan/types'
import { CHIPS_BASE, CHIPS_PLUS, lireMetresEnMm, COTE_MIN_MM, COTE_MAX_MM } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export type FormePiece = 'rect' | 'L' | 'poly'

/** Libellés par défaut des sous-types de surface extérieure. */
const SURFACE_LABELS: Record<TypeExterieur, string> = {
  terrasse: 'Terrasse',
  piscine: 'Piscine',
  pelouse: 'Pelouse',
  allee: 'Allée',
  autre_ext: 'Zone extérieure',
}
const SURFACE_ORDRE: TypeExterieur[] = ['terrasse', 'piscine', 'pelouse', 'allee', 'autre_ext']

export interface DemandePiece {
  nom: string
  /** Nature décidée par l'outil (le bouton), jamais par le nom. */
  nature: NatureZone
  forme: FormePiece
  calque: CalqueId
  /** Dimensions en mm (absentes pour un polygone, dessiné au clic). */
  largeurMm?: number
  hauteurMm?: number
  /**
   * « Ajouter et continuer » : la modale RESTE ouverte pour enchaîner la pièce
   * suivante. Le parent ne doit pas la fermer.
   */
  continuer?: boolean
}

export interface AddRoomModalProps {
  open: boolean
  calqueParDefaut: CalqueId
  /** Nature à l'ouverture : pièce (défaut) ou surface extérieure (palette). */
  natureInitiale?: NatureZone
  onValider: (demande: DemandePiece) => void
  onFermer: () => void
}

const FORMES: { key: FormePiece; label: string }[] = [
  { key: 'rect', label: 'Rectangle' },
  { key: 'L', label: 'En L' },
  { key: 'poly', label: 'Polygone libre' },
]

export default function AddRoomModal({ open, calqueParDefaut, natureInitiale = { kind: 'piece' }, onValider, onFermer }: AddRoomModalProps) {
  const surface = natureInitiale.kind === 'surface'
  const [type, setType] = useState<string>('Chambre')
  const [nomLibre, setNomLibre] = useState('')
  const [extType, setExtType] = useState<TypeExterieur>('terrasse')
  const [nomSurface, setNomSurface] = useState('')
  const [voirTout, setVoirTout] = useState(false)
  const [forme, setForme] = useState<FormePiece>('rect')
  const [calque, setCalque] = useState<CalqueId>(calqueParDefaut)
  const [longueur, setLongueur] = useState('3,5')
  const [largeur, setLargeur] = useState('3')
  const nomLibreRef = useRef<HTMLInputElement>(null)
  const longueurRef = useRef<HTMLInputElement>(null)
  const largeurRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setCalque(calqueParDefaut)
    // Cotes remises à leur défaut à chaque ouverture : la modale reste montée,
    // donc après une session « Ajouter et continuer » (qui vide les champs)
    // elle rouvrirait vide. Avec la sélection au focus, ce défaut ne coûte
    // rien — il est remplacé dès la 1re frappe — et il montre le format attendu.
    setLongueur('3,5')
    setLargeur('3')
  }, [open, calqueParDefaut])

  /**
   * SAISIE AU RYTHME DU TÉLÉMÈTRE (14/07/2026).
   * Le geste naturel d'un relevé, c'est : bip → 4,27 → Entrée → bip → 3,10 →
   * Entrée → pièce suivante. Or la modale ne focalisait rien, ne sélectionnait
   * pas la valeur par défaut (il fallait effacer « 3,5 » à la main, et sur
   * mobile ça veut dire appui long + tout sélectionner + supprimer) et Entrée
   * ne validait pas — le clavier affichait « Terminé » qui ne faisait rien.
   * Le parti pris « on tape les cotes, on ne dessine pas » était le bon, mais
   * l'interface ne l'honorait pas.
   */
  useEffect(() => {
    if (!open || forme === 'poly') return
    const t = setTimeout(() => {
      longueurRef.current?.focus()
      longueurRef.current?.select()
    }, 50)
    return () => clearTimeout(t)
  }, [open, forme])

  // Surface (palette Extérieur) : sous-type pré-sélectionné + nom par défaut
  // remis au libellé du sous-type à l'ouverture (nom TOUJOURS éditable ensuite).
  useEffect(() => {
    if (!open || natureInitiale.kind !== 'surface') return
    setExtType(natureInitiale.extType)
    setNomSurface(SURFACE_LABELS[natureInitiale.extType])
  }, [open, natureInitiale])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onFermer])

  if (!open) return null

  const valider = (continuer = false) => {
    const nature: NatureZone = surface ? { kind: 'surface', extType } : { kind: 'piece' }
    const nom = surface
      ? nomSurface.trim() || SURFACE_LABELS[extType]
      : type === '__libre'
        ? nomLibre.trim() || 'Pièce'
        : type
    if (forme === 'poly') {
      onValider({ nom, nature, forme, calque })
      return
    }
    const w = lireMetresEnMm(longueur)
    const h = lireMetresEnMm(largeur)
    if (w === null || h === null || w < COTE_MIN_MM || w > COTE_MAX_MM || h < COTE_MIN_MM || h > COTE_MAX_MM) {
      toast.warning('Dimensions invalides', { description: 'Saisissez entre 0,5 et 30 m (ex. 4,5).' })
      return
    }
    onValider({ nom, nature, forme, calque, largeurMm: w, hauteurMm: h, continuer })
    if (continuer) {
      // On vide les cotes et on rend la main au champ Longueur : l'artisan
      // enchaîne la pièce suivante sans lever les yeux ni viser un champ.
      // Le type reste sélectionné — « Chambre » devient « Chambre 2 » côté
      // parent (nomAvecSuffixe), ce qui est exactement le bon comportement.
      setLongueur('')
      setLargeur('')
      // Focus SYNCHRONE, surtout pas dans un setTimeout : sur iOS Safari, le
      // clavier ne se rouvre que si focus() est appelé dans le geste même de
      // l'utilisateur. Différé, le clavier restait fermé et l'artisan devait
      // re-taper le champ à chaque pièce — le gain de la feature annulé, sur
      // précisément la cible visée (iPhone + télémètre). L'input reste monté,
      // le focus est donc sûr ; les setState sont batchés après.
      longueurRef.current?.focus()
      longueurRef.current?.select()
    }
  }

  const chip = (nom: string, cle?: string) => {
    const valeur = cle ?? nom
    const sel = type === valeur
    return (
      <button
        key={valeur}
        type="button"
        onClick={() => {
          setType(valeur)
          if (valeur === '__libre') setTimeout(() => nomLibreRef.current?.focus(), 30)
        }}
        aria-pressed={sel}
        className={`rounded-xl border-[1.5px] px-2 py-2 font-hanken text-[12.5px] font-semibold transition-colors ${
          sel ? 'border-orange bg-orange/5 text-orange' : 'border-gray-200 bg-white text-navy hover:border-gray-300'
        }`}
      >
        {nom}
      </button>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ajout-piece-titre" className="fixed inset-0 z-[95] flex items-end justify-center px-0 font-hanken sm:items-center sm:px-4">
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <h2 id="ajout-piece-titre" className="mb-4 text-[17px] font-extrabold tracking-tight text-navy">
          {surface ? 'Ajouter une zone extérieure' : 'Ajouter une pièce'}
        </h2>

        {surface ? (
          <>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Type de surface</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SURFACE_ORDRE.map((t) => {
                const sel = extType === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExtType(t)}
                    aria-pressed={sel}
                    className={`rounded-xl border-[1.5px] px-2 py-2 font-hanken text-[12.5px] font-semibold transition-colors ${
                      sel ? 'border-orange bg-orange/5 text-orange' : 'border-gray-200 bg-white text-navy hover:border-gray-300'
                    }`}
                  >
                    {SURFACE_LABELS[t]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 rounded-lg bg-sky/10 px-3 py-2 font-hanken text-[11.5px] leading-snug text-navy">
              Surface au sol uniquement — pas de murs, pas de plafond. N&apos;entre jamais dans la surface habitable ni dans les métrés intérieurs.
            </p>
            <input
              value={nomSurface}
              onChange={(e) => setNomSurface(e.target.value)}
              placeholder="Nom (ex. Terrasse Sud)"
              aria-label="Nom de la zone extérieure"
              className="mt-2 w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 text-[14px] text-navy focus:border-orange focus:bg-white focus:outline-none"
            />
          </>
        ) : (
          <>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Type de pièce</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHIPS_BASE.map((n) => chip(n))}
              {chip('Autre…', '__libre')}
            </div>
            {voirTout && <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{CHIPS_PLUS.map((n) => chip(n))}</div>}
            <button
              type="button"
              onClick={() => setVoirTout((v) => !v)}
              className="mt-2 w-full rounded-xl border border-dashed border-gray-300 py-1.5 text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-navy"
            >
              {voirTout ? 'Réduire' : 'Voir tout'}
            </button>
            {type === '__libre' && (
              <input
                ref={nomLibreRef}
                value={nomLibre}
                onChange={(e) => setNomLibre(e.target.value)}
                placeholder="Nom de la pièce (ex. Atelier)"
                aria-label="Nom libre de la pièce"
                className="mt-2 w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 text-[14px] text-navy focus:border-orange focus:bg-white focus:outline-none"
              />
            )}
          </>
        )}

        <span className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Forme</span>
        <div className="flex rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Forme de la pièce">
          {FORMES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setForme(f.key)}
              aria-pressed={forme === f.key}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${
                forme === f.key ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {forme === 'poly' ? (
          <p className="mt-3 rounded-xl bg-sky/10 px-3 py-2.5 text-[12.5px] leading-snug text-navy">
            Vous allez dessiner la forme directement sur le plan : cliquez chaque angle de la pièce,
            les longueurs s&apos;affichent en direct. Double-clic (ou clic sur le premier point) pour fermer.
          </p>
        ) : (
          <div className="mt-3 flex items-end gap-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Longueur</span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={longueurRef}
                  value={longueur}
                  onChange={(e) => setLongueur(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    // Entrée = champ suivant (jamais une soumission de page).
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      largeurRef.current?.focus()
                      largeurRef.current?.select()
                    }
                  }}
                  inputMode="decimal"
                  aria-label="Longueur en mètres"
                  className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                />
                <span className="text-[13px] text-gray-500">m</span>
              </div>
            </div>
            <span className="pb-2 text-gray-400" aria-hidden="true">×</span>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Largeur</span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={largeurRef}
                  value={largeur}
                  onChange={(e) => setLargeur(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    // Entrée sur la 2e cote = on valide. C'est ce que le clavier
                    // mobile promet avec sa touche « Terminé » — elle ne faisait
                    // rien jusqu'ici.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      valider()
                    }
                  }}
                  inputMode="decimal"
                  aria-label="Largeur en mètres"
                  className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                />
                <span className="text-[13px] text-gray-500">m</span>
              </div>
            </div>
          </div>
        )}

        <span className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Calque</span>
        <div className="flex gap-2">
          {(
            [
              { key: 'existant', label: 'Existant', aide: "l'état actuel" },
              { key: 'projet', label: 'Projet', aide: 'travaux à créer' },
            ] as const
          ).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCalque(c.key)}
              aria-pressed={calque === c.key}
              className={`flex-1 rounded-xl border-[1.5px] px-3 py-2 text-left transition-colors ${
                calque === c.key
                  ? c.key === 'projet'
                    ? 'border-orange bg-orange/5'
                    : 'border-navy bg-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`block text-[13px] font-bold ${c.key === 'projet' ? 'text-orange' : 'text-navy'}`}>{c.label}</span>
              <span className="block text-[11.5px] text-gray-500">{c.aide}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFermer}
            className="h-11 rounded-[12px] border-[1.5px] border-gray-200 bg-white px-5 text-[14px] font-bold text-navy transition-colors hover:border-gray-300"
          >
            Annuler
          </button>
          {/* « Ajouter et continuer » : sans lui, la modale se referme à chaque
              pièce et il faut refaire tout le chemin (bouton → modale → type →
              2 cotes → valider) pour la suivante. C'est LE multiplicateur de
              friction sur un relevé complet. Absent en mode polygone, qui se
              dessine sur le plan. */}
          {forme !== 'poly' && (
            <button
              type="button"
              onClick={() => valider(true)}
              className="h-11 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 text-[14px] font-bold text-navy transition-colors hover:border-navy/40"
            >
              Ajouter et continuer
            </button>
          )}
          <button
            type="button"
            onClick={() => valider()}
            className="h-11 rounded-[12px] bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
          >
            {forme === 'poly' ? 'Dessiner sur le plan' : surface ? 'Ajouter la zone' : 'Ajouter la pièce'}
          </button>
        </div>
      </div>
    </div>
  )
}
