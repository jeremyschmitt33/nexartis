'use client'

/**
 * PlanOverlays — Surcouches du canvas (Push 3b, 06/07/2026).
 * JSX extrait TEL QUEL de PlanEditor (limite 450 lignes) : barre d'outils
 * mobile, barre du tracé en cours (polygone ou clôture), état vide du
 * niveau, FAB « Ajouter une pièce », barre « Annuler » 8 s. Aucune logique.
 */

import type { MetierId } from '@/lib/plan/profils'
import type { Outil, PolygoneEnCours } from './PlanCanvas'
import { outilsMobiles } from './PlanPalette'

export interface PlanOverlaysProps {
  metier: MetierId
  outil: Outil
  onOutil: (outil: Outil) => void
  onCloture: () => void
  polygone: PolygoneEnCours | null
  onAnnulerPolygone: () => void
  niveauVide: boolean
  onAjouterPiece: () => void
  annulation: { nom: string } | null
  onAnnulerSuppression: () => void
}

export default function PlanOverlays({
  metier,
  outil,
  onOutil,
  onCloture,
  polygone,
  onAnnulerPolygone,
  niveauVide,
  onAjouterPiece,
  annulation,
  onAnnulerSuppression,
}: PlanOverlaysProps) {
  return (
    <>
      {/* Outils (mobile) : même liste que la palette + clôture */}
      <div
        className="absolute left-2 right-2 top-2 flex gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-sm backdrop-blur sm:hidden"
        aria-label="Outils du plan"
      >
        {outilsMobiles(metier).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onOutil(o.key)}
            aria-pressed={outil === o.key}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-colors ${
              outil === o.key ? 'bg-orange/10 text-orange' : 'text-navy'
            }`}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onCloture}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 font-hanken text-xs font-bold text-navy"
        >
          Clôture
        </button>
      </div>

      {/* Barre polygone / clôture en cours */}
      {polygone && (
        <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-lg sm:top-3">
          <span className="font-hanken text-[13px] font-semibold text-navy">
            {polygone.mode === 'cloture'
              ? `${polygone.nom} — cliquez les points le long de la parcelle, double-clic pour terminer`
              : `${polygone.nom} — cliquez chaque angle, double-clic pour fermer`}
          </span>
          <button
            type="button"
            onClick={onAnnulerPolygone}
            className="rounded-lg border-[1.5px] border-gray-200 px-2.5 py-1 font-hanken text-xs font-bold text-navy transition-colors hover:border-red-300 hover:text-red-600"
          >
            Annuler
          </button>
        </div>
      )}

      {/* État vide */}
      {niveauVide && !polygone && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto rounded-2xl border border-gray-200 bg-white px-6 py-6 text-center shadow-lg">
            <p className="font-hanken text-[15px] font-extrabold text-navy">Ce niveau est vide</p>
            <p className="mt-1 font-hanken text-[13px] text-gray-500">Ajoutez votre première pièce pour commencer le plan.</p>
            <button
              type="button"
              onClick={onAjouterPiece}
              className="mt-4 rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
            >
              Ajouter une pièce
            </button>
          </div>
        </div>
      )}

      {/* FAB ajout (au-dessus du tiroir mobile) */}
      {!polygone && !niveauVide && (
        <button
          type="button"
          onClick={onAjouterPiece}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-3 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.4)] transition-all hover:brightness-105"
        >
          + Ajouter une pièce
        </button>
      )}

      {/* Suppression : « Annuler » 8 s */}
      {annulation && (
        <div className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-navy px-4 py-2.5 shadow-xl">
          <span className="font-hanken text-[13px] font-semibold text-white">{annulation.nom} supprimée</span>
          <button
            type="button"
            onClick={onAnnulerSuppression}
            className="rounded-lg bg-white/10 px-3 py-1 font-hanken text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            Annuler
          </button>
        </div>
      )}
    </>
  )
}
