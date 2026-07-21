'use client'

/**
 * RoomSheet — Panneau de la pièce sélectionnée (Push 2, 03/07/2026).
 * Nom, calque, HSP, surface sol + périmètre (lib/plan/metrics), ouvertures,
 * dupliquer / supprimer. Panneau latéral desktop, tiroir bas mobile.
 * Le panneau métrés complet par métier arrive au Push 3.
 */

import { useEffect, useState } from 'react'
import type { CategorieZone, EtatAvancement, NatureZone, Piece, TypeExterieur } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { bornesPiece } from '@/lib/plan/edition'
import type { ResultatCote } from './usePlanState'
import { chevauchementOuverture, ouvertureValide, perimetreMl, surfaceSolM2, volumeExtM3 } from '@/lib/plan/metrics'
import { AVANCEMENT_META, AVANCEMENT_ORDRE, OUVERTURE_DEFAUTS, avancementDe, lireMetresEnMm, mmVersSaisieM, nomEvoqueExterieur } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export interface RoomSheetProps {
  piece: Piece
  onMaj: (patch: Partial<Piece>) => void
  /** Reclasse la zone (pièce ⇄ surface extérieure). */
  onNature: (nature: NatureZone) => void
  /** Redimensionne l'emprise (même chemin que le clic-sur-cote : refus si mur trop court). */
  onRedimensionner: (dim: 'w' | 'h', mm: number) => ResultatCote
  /** Change l'état d'avancement (le parent y ajoute la date + l'auteur, Push 7B). */
  onAvancement: (etat: EtatAvancement) => void
  onDupliquer: () => void
  onSupprimer: () => void
  onSupprimerOuverture: (ouvertureId: string) => void
  onFermer: () => void
  /** Contenu additionnel rendu sous les champs (panneau métrés, Push 3a). */
  children?: React.ReactNode
}

const NATURE_OPTIONS: { key: string; label: string; cat: CategorieZone; extType?: TypeExterieur; nature: NatureZone }[] = [
  { key: 'int', label: 'Intérieur', cat: 'int', nature: { kind: 'piece' } },
  { key: 'terrasse', label: 'Terrasse', cat: 'ext', extType: 'terrasse', nature: { kind: 'surface', extType: 'terrasse' } },
  { key: 'piscine', label: 'Piscine', cat: 'ext', extType: 'piscine', nature: { kind: 'surface', extType: 'piscine' } },
  { key: 'pelouse', label: 'Pelouse', cat: 'ext', extType: 'pelouse', nature: { kind: 'surface', extType: 'pelouse' } },
  { key: 'autre_ext', label: 'Autre ext.', cat: 'ext', extType: 'autre_ext', nature: { kind: 'surface', extType: 'autre_ext' } },
]

function Etiquette({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">{children}</span>
}

export default function RoomSheet({ piece, onMaj, onNature, onRedimensionner, onAvancement, onDupliquer, onSupprimer, onSupprimerOuverture, onFermer, children }: RoomSheetProps) {
  const [nom, setNom] = useState(piece.name)
  const [hsp, setHsp] = useState(mmVersSaisieM(piece.height))
  const [prof, setProf] = useState(piece.profondeurMm ? mmVersSaisieM(piece.profondeurMm) : '')
  const [lng, setLng] = useState('')
  const [lrg, setLrg] = useState('')
  const [errDim, setErrDim] = useState<string | null>(null)

  // Resynchronise les brouillons quand la sélection change.
  const b = bornesPiece(piece)
  const wMm = b.x2 - b.x1
  const hMm = b.y2 - b.y1

  useEffect(() => {
    setNom(piece.name)
    setHsp(mmVersSaisieM(piece.height))
    setProf(piece.profondeurMm ? mmVersSaisieM(piece.profondeurMm) : '')
    setLng(mmVersSaisieM(wMm))
    setLrg(mmVersSaisieM(hMm))
    setErrDim(null)
  }, [piece.id, piece.name, piece.height, piece.profondeurMm, wMm, hMm])

  const commitNom = () => {
    const propre = nom.trim()
    if (propre && propre !== piece.name) onMaj({ name: propre })
    else setNom(piece.name)
  }

  const commitHsp = () => {
    const mm = lireMetresEnMm(hsp)
    if (mm === null || mm < 1000 || mm > 6000) {
      toast.warning('Hauteur sous plafond invalide', { description: 'Saisissez entre 1 et 6 m (ex. 2,5).' })
      setHsp(mmVersSaisieM(piece.height))
      return
    }
    if (mm !== piece.height) onMaj({ height: mm })
  }

  const commitProf = () => {
    const t = prof.trim()
    if (t === '') {
      if (piece.profondeurMm !== undefined) onMaj({ profondeurMm: undefined })
      return
    }
    const mm = lireMetresEnMm(t)
    if (mm === null || mm < 10 || mm > 20000) {
      toast.warning('Profondeur invalide', { description: 'Saisissez entre 0,01 et 20 m (ex. 0,80).' })
      setProf(piece.profondeurMm ? mmVersSaisieM(piece.profondeurMm) : '')
      return
    }
    if (mm !== piece.profondeurMm) onMaj({ profondeurMm: mm })
  }

  // Redimensionnement par le panneau : MÊME chemin que le clic-sur-cote
  // (onRedimensionner -> etat.redimensionner -> recalerOuvertures). Commit au
  // BLUR/Entrée seulement (pas à chaque frappe : évite la tempête de refus), et
  // un refus « mur trop court » s'affiche EN ERREUR INLINE, jamais en toast, et
  // ne mute jamais le modèle. La cote saisie reste sacrée.
  const commitDim = (dim: 'w' | 'h', val: string, setSelf: (v: string) => void) => {
    const cur = dim === 'w' ? wMm : hMm
    const mm = lireMetresEnMm(val)
    if (mm === null) {
      setErrDim('Valeur invalide (ex. 4,5).')
      setSelf(mmVersSaisieM(cur))
      return
    }
    // Rien n'a changé (ou simple focus/blur) : on normalise l'affichage et on
    // NE rejoue PAS de redimensionnement (pas de mutation ni d'autosave inutile).
    if (mm === cur) {
      setErrDim(null)
      setSelf(mmVersSaisieM(cur))
      return
    }
    const r = onRedimensionner(dim, mm)
    if (!r.ok) {
      setErrDim(r.description ?? r.message)
      setSelf(mmVersSaisieM(cur))
      return
    }
    // Succès : le champ reflète EXACTEMENT la valeur appliquée — jamais un
    // affichage qui mentirait sur la cote réelle de la pièce.
    setErrDim(null)
    setSelf(mmVersSaisieM(mm))
    if (r.info) toast.info(r.info)
  }

  const surface = surfaceSolM2(piece)
  const perimetre = perimetreMl(piece)
  const volume = volumeExtM3(piece)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-hanken text-[13px] font-extrabold uppercase tracking-wider text-navy">Pièce sélectionnée</h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le panneau"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-navy"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <Etiquette>Nom</Etiquette>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={commitNom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            aria-label="Nom de la pièce"
            className="w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 font-hanken text-[14px] text-navy transition-colors focus:border-orange focus:bg-white focus:outline-none"
          />
        </div>

        {/* Avertissement DOUX (non bloquant) : le nom évoque l'extérieur alors
            que la zone est classée Intérieur. `nomEvoqueExterieur` NE DÉCIDE
            RIEN — c'est l'artisan qui tranche, d'un clic. Ferme le bug « Grande
            terrasse » côté données déjà en base : une zone mal classée devient
            enfin corrigeable, ici, sans SQL. */}
        {piece.cat !== 'ext' && nomEvoqueExterieur(piece.name) && (
          <div className="rounded-xl border border-orange/40 bg-orange/5 px-3 py-2.5">
            <p className="font-hanken text-[11.5px] font-semibold leading-snug text-navy">
              Cette zone s’appelle «&nbsp;{piece.name}&nbsp;» mais elle est classée
              Intérieur — donc ses murs, son plafond et ses plinthes sont facturés.
              Si c’est une zone extérieure, reclassez-la.
            </p>
            <button
              type="button"
              onClick={() => {
                const t = nomEvoqueExterieur(piece.name)
                if (t) onNature({ kind: 'surface', extType: t })
              }}
              className="mt-2 rounded-lg border-[1.5px] border-orange bg-white px-3 py-1.5 font-hanken text-[12px] font-bold text-orange transition-colors hover:bg-orange/10"
            >
              Reclasser en extérieur
            </button>
          </div>
        )}

        <div>
          <Etiquette>Nature</Etiquette>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {NATURE_OPTIONS.map((opt) => {
              const actif = opt.cat === 'int' ? piece.cat === 'int' : piece.cat === 'ext' && piece.extType === opt.extType
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onNature(opt.nature)}
                  aria-pressed={actif}
                  className={`rounded-xl border-[1.5px] px-2.5 py-2 font-hanken text-[12.5px] font-semibold transition-colors ${
                    actif ? 'border-orange bg-orange/5 text-orange' : 'border-gray-200 bg-white text-navy hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-gray-500">
            {piece.cat === 'ext'
              ? 'Surface extérieure — comptée seulement en m² au sol, jamais de murs ni de plafond.'
              : 'Pièce intérieure — génère murs, plafond, sol et plinthes dans le devis.'}
          </p>
        </div>

        <div>
          <Etiquette>Calque</Etiquette>
          <div className="flex rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Calque de la pièce">
            {(
              [
                { key: 'existant', label: 'Existant' },
                { key: 'projet', label: 'Projet' },
              ] as const
            ).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onMaj({ layer: c.key })}
                aria-pressed={piece.layer === c.key}
                className={`flex-1 rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-all ${
                  piece.layer === c.key
                    ? c.key === 'projet'
                      ? 'bg-white text-orange shadow-[0_2px_6px_rgba(15,26,58,0.08)]'
                      : 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]'
                    : 'text-gray-500 hover:text-navy'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {piece.layer === 'projet' && (
            <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-orange">
              Travaux futurs — affichés en orange pointillé sur le plan.
            </p>
          )}
        </div>

        {piece.layer === 'projet' ? (
          <div>
            <Etiquette>Avancement du chantier</Etiquette>
            <p className="font-hanken text-[11.5px] leading-snug text-gray-500">
              Disponible une fois la pièce construite. Repassez-la en calque «&nbsp;Existant&nbsp;» pour suivre son avancement.
            </p>
          </div>
        ) : (
        <div>
          <Etiquette>Avancement du chantier</Etiquette>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-200/60 bg-[#fafbfc] p-1" role="group" aria-label="Avancement de la pièce">
            {AVANCEMENT_ORDRE.map((key) => {
              const meta = AVANCEMENT_META[key]
              const actif = avancementDe(piece) === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onAvancement(key)}
                  aria-pressed={actif}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-hanken text-xs font-bold transition-all ${
                    actif ? 'bg-white text-navy shadow-[0_2px_6px_rgba(15,26,58,0.08)]' : 'text-gray-500 hover:text-navy'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: meta.fill ?? '#e3e9f2' }}
                    aria-hidden="true"
                  />
                  {meta.court}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-gray-500">
            Colorie la pièce sur le plan. Servira à pré-remplir vos factures de situation.
          </p>
          {piece.avancement && piece.avancement !== 'a_faire' && piece.avancementLe && (
            <p className="mt-1 font-hanken text-[11px] leading-snug text-gray-400">
              Marqué le {new Date(piece.avancementLe).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              {piece.avancementPar ? ` par ${piece.avancementPar}` : ''}
            </p>
          )}
        </div>
        )}

        {piece.cat !== 'ext' ? (
          <div>
            <Etiquette>Hauteur sous plafond</Etiquette>
            <div className="flex items-center gap-2">
              <input
                value={hsp}
                onChange={(e) => setHsp(e.target.value)}
                onBlur={commitHsp}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                inputMode="decimal"
                aria-label="Hauteur sous plafond en mètres"
                className="w-24 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 text-center font-spline-mono text-[14px] font-medium text-navy transition-colors focus:border-orange focus:bg-white focus:outline-none"
              />
              <span className="font-hanken text-[13px] text-gray-500">m</span>
            </div>
          </div>
        ) : (
          <div>
            <Etiquette>Profondeur / épaisseur (optionnelle)</Etiquette>
            <div className="flex items-center gap-2">
              <input
                value={prof}
                onChange={(e) => setProf(e.target.value)}
                onBlur={commitProf}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                inputMode="decimal"
                aria-label="Profondeur en mètres"
                placeholder="ex. 0,80"
                className="w-24 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 text-center font-spline-mono text-[14px] font-medium text-navy transition-colors focus:border-orange focus:bg-white focus:outline-none"
              />
              <span className="font-hanken text-[13px] text-gray-500">m</span>
            </div>
            <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-gray-500">
              {volume > 0
                ? `Volume : ${fmtNombreFr(volume)} m³ — à qualifier (déblai / béton) sur le devis.`
                : 'Une profondeur transforme la surface en volume (trou à creuser, dalle à couler).'}
            </p>
          </div>
        )}

        <div>
          <Etiquette>Dimensions (hors-tout)</Etiquette>
          <div className="flex items-end gap-2">
            <div>
              <span className="mb-1 block font-hanken text-[10.5px] text-gray-500">Longueur</span>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                onBlur={() => commitDim('w', lng, setLng)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                inputMode="decimal"
                aria-label="Longueur en mètres"
                className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy transition-colors focus:border-orange focus:bg-white focus:outline-none"
              />
            </div>
            <span className="pb-2 text-gray-400" aria-hidden="true">×</span>
            <div>
              <span className="mb-1 block font-hanken text-[10.5px] text-gray-500">Largeur</span>
              <input
                value={lrg}
                onChange={(e) => setLrg(e.target.value)}
                onBlur={() => commitDim('h', lrg, setLrg)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                inputMode="decimal"
                aria-label="Largeur en mètres"
                className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy transition-colors focus:border-orange focus:bg-white focus:outline-none"
              />
            </div>
            <span className="pb-2 font-hanken text-[13px] text-gray-500">m</span>
          </div>
          {errDim ? (
            <p className="mt-1.5 font-hanken text-[11.5px] font-semibold leading-snug text-red-600">{errDim}</p>
          ) : (
            <p className="mt-1.5 font-hanken text-[11.5px] leading-snug text-gray-500">
              Modifie l&apos;emprise de la pièce — même effet que cliquer une cote sur le plan.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2.5 text-center">
            <div className="font-spline-mono text-[17px] font-semibold text-navy">{fmtNombreFr(surface)}</div>
            <div className="mt-0.5 font-hanken text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">m² au sol</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2.5 text-center">
            <div className="font-spline-mono text-[17px] font-semibold text-navy">{fmtNombreFr(perimetre)}</div>
            <div className="mt-0.5 font-hanken text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">ml de périmètre</div>
          </div>
        </div>

        {piece.cat !== 'ext' && piece.openings.length > 0 && (
          <div>
            <Etiquette>Ouvertures</Etiquette>
            <ul className="space-y-1.5">
              {piece.openings.map((o) => {
                // Contrepartie OBLIGATOIRE du « filtrer sans effacer » (15/07/2026) :
                // une ouverture qui ne tient plus sur son mur n'est plus dessinée
                // (2D et 3D) ni comptée au devis, mais elle EXISTE toujours en base
                // — on n'efface jamais le travail de l'artisan. Sans ce badge, elle
                // serait un fantôme : visible ici, introuvable ailleurs. On aurait
                // remplacé une disparition silencieuse par une présence silencieuse.
                const horsMur = !ouvertureValide(piece, o)
                // Chevauchement DÉJÀ EN BASE : le garde-fou de `preparerOuverture`
                // empêche d'en créer de nouveaux, il ne répare pas les anciens. Et
                // on ne les filtre PAS du métré : les deux ouvertures sont
                // dessinées (superposées), en exclure une serait arbitraire — et ça
                // changerait un métré sans que l'artisan l'ait demandé. Donc on le
                // DIT, et il tranche.
                const conflit = horsMur ? null : chevauchementOuverture(piece, o)
                const alerte = horsMur || conflit !== null
                return (
                <li key={o.id} className={`flex justify-between rounded-xl border px-3 py-2 ${alerte ? 'items-start border-orange/40 bg-orange/5' : 'items-center border-gray-100 bg-[#fafbfc]'}`}>
                  <span className="font-hanken text-[13px] text-navy">
                    {OUVERTURE_DEFAUTS[o.type].label}{' '}
                    <span className="font-spline-mono text-[12px] text-gray-500">
                      {fmtNombreFr(o.width / 1000, 2)} × {fmtNombreFr(o.height / 1000, 2)} m
                      {o.sillHeight > 0 ? ` · allège ${fmtNombreFr(o.sillHeight / 1000, 2)} m` : ''}
                    </span>
                    {/* text-navy (~16:1) et PAS text-orange (2,75:1 sur ce fond,
                        sous WCAG AA) : ce texte porte l'info « pas comptée dans
                        les métrés ». Le signal d'alerte est déjà porté par la
                        bordure et le fond — le texte, lui, doit se LIRE. */}
                    {horsMur && (
                      <span className="mt-0.5 block font-hanken text-[11.5px] font-semibold leading-snug text-navy">
                        Hors du mur — pas dessinée, pas comptée dans les métrés.
                        Rallongez le mur ou supprimez-la.
                      </span>
                    )}
                    {conflit && (
                      <span className="mt-0.5 block font-hanken text-[11.5px] font-semibold leading-snug text-navy">
                        Superposée à une {OUVERTURE_DEFAUTS[conflit.type].label.toLowerCase()} sur
                        le même mur — le plan n’en dessine qu’une, et le métré compte les deux.
                        Supprimez-en une.
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSupprimerOuverture(o.id)}
                    aria-label={`Supprimer cette ${OUVERTURE_DEFAUTS[o.type].label.toLowerCase()}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onDupliquer}
            className="flex-1 rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2 font-hanken text-[13px] font-bold text-navy transition-colors hover:border-orange"
          >
            Dupliquer
          </button>
          <button
            type="button"
            onClick={onSupprimer}
            className="flex-1 rounded-xl border-[1.5px] border-red-200 bg-white px-3 py-2 font-hanken text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            Supprimer
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
