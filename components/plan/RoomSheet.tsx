'use client'

/**
 * RoomSheet — Panneau de la pièce sélectionnée (Push 2, 03/07/2026).
 * Nom, calque, HSP, surface sol + périmètre (lib/plan/metrics), ouvertures,
 * dupliquer / supprimer. Panneau latéral desktop, tiroir bas mobile.
 * Le panneau métrés complet par métier arrive au Push 3.
 */

import { useEffect, useState } from 'react'
import type { Piece } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { perimetreMl, surfaceSolM2 } from '@/lib/plan/metrics'
import { OUVERTURE_DEFAUTS, lireMetresEnMm, mmVersSaisieM } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export interface RoomSheetProps {
  piece: Piece
  onMaj: (patch: Partial<Piece>) => void
  onDupliquer: () => void
  onSupprimer: () => void
  onSupprimerOuverture: (ouvertureId: string) => void
  onFermer: () => void
  /** Contenu additionnel rendu sous les champs (panneau métrés, Push 3a). */
  children?: React.ReactNode
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">{children}</span>
}

export default function RoomSheet({ piece, onMaj, onDupliquer, onSupprimer, onSupprimerOuverture, onFermer, children }: RoomSheetProps) {
  const [nom, setNom] = useState(piece.name)
  const [hsp, setHsp] = useState(mmVersSaisieM(piece.height))

  // Resynchronise les brouillons quand la sélection change.
  useEffect(() => {
    setNom(piece.name)
    setHsp(mmVersSaisieM(piece.height))
  }, [piece.id, piece.name, piece.height])

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

  const surface = surfaceSolM2(piece)
  const perimetre = perimetreMl(piece)

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

        {piece.openings.length > 0 && (
          <div>
            <Etiquette>Ouvertures</Etiquette>
            <ul className="space-y-1.5">
              {piece.openings.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2">
                  <span className="font-hanken text-[13px] text-navy">
                    {OUVERTURE_DEFAUTS[o.type].label}{' '}
                    <span className="font-spline-mono text-[12px] text-gray-500">
                      {fmtNombreFr(o.width / 1000, 2)} × {fmtNombreFr(o.height / 1000, 2)} m
                    </span>
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
              ))}
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
