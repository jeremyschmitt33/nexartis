'use client'

/**
 * ClotureSheet — Panneau du linéaire sélectionné : clôture / bordure / tranchée.
 * ml (moteur lib/plan/metrics), calque, largeur+profondeur+volume pour la
 * tranchée (mm entiers, cote sacrée), envoi au devis, suppression (undo Ctrl+Z).
 */

import { useEffect, useState } from 'react'
import type { Cloture } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { clotureMl, kindDe, volumeTrancheeM3 } from '@/lib/plan/metrics'
import { lireMetresEnMm, mmVersSaisieM } from '@/lib/plan/defaults'
import { toast } from '@/lib/toast'

export interface ClotureSheetProps {
  cloture: Cloture
  onMaj: (patch: Partial<Cloture>) => void
  onEnvoyerDevis: () => void
  onSupprimer: () => void
  onFermer: () => void
}

const LABELS: Record<'cloture' | 'bordure' | 'tranchee', { titre: string; unite: string; supp: string }> = {
  cloture: { titre: 'Clôture / grillage', unite: 'ml de clôture / grillage', supp: 'la clôture' },
  bordure: { titre: 'Bordure', unite: 'ml de bordure', supp: 'la bordure' },
  tranchee: { titre: 'Tranchée', unite: 'ml de tranchée', supp: 'la tranchée' },
}

export default function ClotureSheet({ cloture, onMaj, onEnvoyerDevis, onSupprimer, onFermer }: ClotureSheetProps) {
  const kind = kindDe(cloture)
  const ml = clotureMl(cloture)
  const volume = volumeTrancheeM3(cloture)
  const meta = LABELS[kind]

  const [largeur, setLargeur] = useState(cloture.largeurMm ? mmVersSaisieM(cloture.largeurMm) : '')
  const [profondeur, setProfondeur] = useState(cloture.profondeurMm ? mmVersSaisieM(cloture.profondeurMm) : '')

  useEffect(() => {
    setLargeur(cloture.largeurMm ? mmVersSaisieM(cloture.largeurMm) : '')
    setProfondeur(cloture.profondeurMm ? mmVersSaisieM(cloture.profondeurMm) : '')
  }, [cloture.id, cloture.largeurMm, cloture.profondeurMm])

  const commitLargeur = () => {
    const t = largeur.trim()
    if (t === '') {
      if (cloture.largeurMm !== undefined) onMaj({ largeurMm: undefined })
      return
    }
    const mm = lireMetresEnMm(t)
    if (mm === null || mm < 10 || mm > 10000) {
      toast.warning('Largeur invalide', { description: 'Saisissez entre 0,01 et 10 m (ex. 0,60).' })
      setLargeur(cloture.largeurMm ? mmVersSaisieM(cloture.largeurMm) : '')
      return
    }
    if (mm !== cloture.largeurMm) onMaj({ largeurMm: mm })
  }

  const commitProfondeur = () => {
    const t = profondeur.trim()
    if (t === '') {
      if (cloture.profondeurMm !== undefined) onMaj({ profondeurMm: undefined })
      return
    }
    const mm = lireMetresEnMm(t)
    if (mm === null || mm < 10 || mm > 10000) {
      toast.warning('Profondeur invalide', { description: 'Saisissez entre 0,01 et 10 m (ex. 0,80).' })
      setProfondeur(cloture.profondeurMm ? mmVersSaisieM(cloture.profondeurMm) : '')
      return
    }
    if (mm !== cloture.profondeurMm) onMaj({ profondeurMm: mm })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-hanken text-[13px] font-extrabold uppercase tracking-wider text-navy">{meta.titre}</h2>
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
        <div className="rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2.5 text-center">
          <div className="font-spline-mono text-[17px] font-semibold text-navy">{fmtNombreFr(ml)}</div>
          <div className="mt-0.5 font-hanken text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">{meta.unite}</div>
        </div>

        {kind === 'tranchee' && (
          <div>
            <span className="mb-1.5 block font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">Section (pour le volume)</span>
            <div className="flex items-end gap-3">
              <div>
                <span className="mb-1 block font-hanken text-[10.5px] text-gray-500">Largeur</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={largeur}
                    onChange={(e) => setLargeur(e.target.value)}
                    onBlur={commitLargeur}
                    inputMode="decimal"
                    aria-label="Largeur de la tranchée en mètres"
                    placeholder="0,60"
                    className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                  />
                  <span className="text-[13px] text-gray-500">m</span>
                </div>
              </div>
              <span className="pb-2 text-gray-400" aria-hidden="true">×</span>
              <div>
                <span className="mb-1 block font-hanken text-[10.5px] text-gray-500">Profondeur</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={profondeur}
                    onChange={(e) => setProfondeur(e.target.value)}
                    onBlur={commitProfondeur}
                    inputMode="decimal"
                    aria-label="Profondeur de la tranchée en mètres"
                    placeholder="0,80"
                    className="w-20 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-2 py-2 text-center font-spline-mono text-[14px] font-medium text-navy focus:border-orange focus:bg-white focus:outline-none"
                  />
                  <span className="text-[13px] text-gray-500">m</span>
                </div>
              </div>
            </div>
            {volume > 0 ? (
              <p className="mt-2 rounded-lg bg-sky/10 px-3 py-2 font-hanken text-[12px] leading-snug text-navy">
                Volume : <span className="font-bold">{fmtNombreFr(volume)} m³</span> — à qualifier (déblai / béton) sur le devis.
              </p>
            ) : (
              <p className="mt-2 font-hanken text-[11.5px] leading-snug text-gray-500">
                Renseignez largeur ET profondeur pour calculer le volume.
              </p>
            )}
          </div>
        )}

        <p className="font-hanken text-[11.5px] leading-snug text-gray-500">
          Calque : <span className={`font-bold ${cloture.layer === 'projet' ? 'text-orange' : 'text-navy'}`}>{cloture.layer === 'projet' ? 'Projet' : 'Existant'}</span>
          {' · '}longueur réelle de la polyligne tracée, métré indicatif à vérifier avant chiffrage.
        </p>

        <button
          type="button"
          onClick={onEnvoyerDevis}
          className="w-full rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-4 py-2.5 font-hanken text-[13.5px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
        >
          Envoyer au devis ({fmtNombreFr(ml)} ml{volume > 0 ? ` + ${fmtNombreFr(volume)} m³` : ''})
        </button>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onSupprimer}
            className="w-full rounded-xl border-[1.5px] border-red-200 bg-white px-3 py-2 font-hanken text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            Supprimer {meta.supp}
          </button>
        </div>
      </div>
    </div>
  )
}
