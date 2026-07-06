'use client'

/**
 * MetresBlocs — Blocs de métrés par lot du panneau droit (Push 3b).
 * Extrait de MetresPanel (limite 450 lignes). Le moteur (lib/plan/metrics)
 * calcule tout : ces blocs ne font qu'afficher + proposer « → Devis »
 * (pré-cochage du métré dans le tiroir DevisDrawer).
 */

import type { ModeDeduction, Niveau, Piece, Symbole } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import {
  appliquerChutes,
  plinthesMl,
  surfaceMursM2,
  surfacePlafondM2,
  surfaceSolM2,
  totauxExterieur,
} from '@/lib/plan/metrics'
import { CHUTES_DEFAUT_PCT, compteursElec, compteursPlomberie, suggestionNfc } from '@/lib/plan/profils'
import { labelSymbole } from '@/lib/plan/symboles'
import type { PreSelection } from './DevisDrawer'

export const DESC_MODE: Record<ModeDeduction, string> = {
  brute: 'aucune ouverture déduite',
  totale: 'toutes les ouvertures déduites',
  sup05: 'ouvertures > 0,5 m² déduites',
  sup25: 'ouvertures > 2,5 m² déduites',
}

const MODES_PEINTRE: { v: ModeDeduction; titre: string; desc: string }[] = [
  { v: 'brute', titre: 'Brute', desc: 'Aucune déduction : murs « plein pot ».' },
  { v: 'totale', titre: 'Totale', desc: 'Toutes les portes et fenêtres sont déduites des murs.' },
  {
    v: 'sup05',
    titre: 'Seulement > 0,5 m²',
    desc: 'Règle usuelle du peintre : le temps de découpe compense la surface non peinte.',
  },
]

export type Envoyer = (sel: PreSelection) => void

/** Ligne métré : libellé, valeur mono, bouton « → Devis » (actif depuis 3b). */
export function Ligne({
  label,
  sous,
  valeur,
  unite,
  onEnvoyer,
}: {
  label: string
  sous?: string
  valeur: string
  unite: string
  onEnvoyer?: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2">
      <span className="min-w-0 flex-1 font-hanken text-[12.5px] font-semibold leading-tight text-navy">
        {label}
        {sous && <span className="mt-0.5 block text-[10.5px] font-medium text-gray-500">{sous}</span>}
      </span>
      <span className="whitespace-nowrap font-spline-mono text-[14px] font-semibold text-navy">
        {valeur} <span className="text-[11px] font-medium text-gray-500">{unite}</span>
      </span>
      {onEnvoyer && (
        <button
          type="button"
          onClick={onEnvoyer}
          aria-label={`Envoyer ${label} au devis`}
          className="flex-shrink-0 rounded-lg border-[1.5px] border-gray-200 px-2 py-1 font-hanken text-[11px] font-bold text-navy transition-colors hover:border-orange hover:text-orange"
        >
          → Devis
        </button>
      )}
    </div>
  )
}

export function Accordeon({
  titre,
  ouvert,
  onToggle,
  children,
}: {
  titre: string
  ouvert: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between bg-[#fafbfc] px-3 py-2 font-hanken text-[12.5px] font-bold text-navy transition-colors hover:bg-gray-50"
      >
        {titre}
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {ouvert && <div className="space-y-1.5 bg-white p-2">{children}</div>}
    </div>
  )
}

/* ── Blocs par lot ─────────────────────────────────────────────────────────── */

export function BlocPeintre({
  piece,
  mode,
  onMode,
  reglesOuvertes,
  onToggleRegles,
  envoyer,
}: {
  piece: Piece
  mode: ModeDeduction
  onMode: (m: ModeDeduction) => void
  reglesOuvertes: boolean
  onToggleRegles: () => void
  envoyer: Envoyer
}) {
  return (
    <>
      <Ligne
        label="Murs"
        sous={DESC_MODE[mode]}
        valeur={fmtNombreFr(surfaceMursM2(piece, mode))}
        unite="m²"
        onEnvoyer={() => envoyer({ metric: 'murs', roomId: piece.id })}
      />
      <Ligne
        label="Plafond"
        valeur={fmtNombreFr(surfacePlafondM2(piece))}
        unite="m²"
        onEnvoyer={() => envoyer({ metric: 'plafond', roomId: piece.id })}
      />
      <Ligne
        label="Plinthes"
        sous="périmètre − ouvertures au sol"
        valeur={fmtNombreFr(plinthesMl(piece))}
        unite="ml"
        onEnvoyer={() => envoyer({ metric: 'plinthes', roomId: piece.id })}
      />
      <Accordeon titre="Règles de calcul" ouvert={reglesOuvertes} onToggle={onToggleRegles}>
        {MODES_PEINTRE.map((o) => (
          <label key={o.v} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
            <input
              type="radio"
              name="deduction-peinture"
              checked={mode === o.v}
              onChange={() => onMode(o.v)}
              className="mt-0.5 accent-orange"
            />
            <span className="font-hanken text-[12px] leading-snug text-navy">
              <span className="font-bold">{o.titre}</span>
              <span className="block text-[11px] text-gray-500">{o.desc}</span>
            </span>
          </label>
        ))}
      </Accordeon>
    </>
  )
}

export function BlocCarreleur({
  piece,
  chutes,
  onChutes,
  envoyer,
}: {
  piece: Piece
  chutes: string
  onChutes: (v: string) => void
  envoyer: Envoyer
}) {
  const sol = surfaceSolM2(piece)
  const brut = Number(chutes.replace(',', '.').trim())
  const taux = Number.isFinite(brut) && brut >= 0 && brut <= 100 ? brut : CHUTES_DEFAUT_PCT
  return (
    <>
      <Ligne
        label="Sol"
        sous={piece.deductionSolM2 ? 'déduction de surface incluse' : undefined}
        valeur={fmtNombreFr(sol)}
        unite="m²"
      />
      <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2">
        <span className="font-hanken text-[12.5px] font-semibold text-navy">
          Coefficient de chutes
          <span className="mt-0.5 block text-[10.5px] font-medium text-gray-500">pose droite ≈ 10 %, diagonale ≈ 15 %</span>
        </span>
        <span className="flex items-center gap-1">
          <input
            value={chutes}
            onChange={(e) => onChutes(e.target.value)}
            inputMode="decimal"
            aria-label="Coefficient de chutes en pourcentage"
            className="w-14 rounded-lg border-[1.5px] border-gray-200 bg-white px-2 py-1 text-center font-spline-mono text-[13px] font-medium text-navy focus:border-orange focus:outline-none"
          />
          <span className="font-hanken text-[12px] text-gray-500">%</span>
        </span>
      </div>
      <Ligne
        label="Sol + chutes"
        sous={`coefficient +${fmtNombreFr(taux, 0)} % appliqué`}
        valeur={fmtNombreFr(appliquerChutes(sol, taux))}
        unite="m²"
        onEnvoyer={() => envoyer({ metric: 'sol_chutes', roomId: piece.id })}
      />
      <Ligne
        label="Plinthes assorties"
        valeur={fmtNombreFr(plinthesMl(piece))}
        unite="ml"
        onEnvoyer={() => envoyer({ metric: 'plinthes_carrelage', roomId: piece.id })}
      />
    </>
  )
}

export function BlocPlaquiste({ piece, envoyer }: { piece: Piece; envoyer: Envoyer }) {
  return (
    <>
      <Ligne
        label="Murs (doublage)"
        sous={DESC_MODE.sup25}
        valeur={fmtNombreFr(surfaceMursM2(piece, 'sup25'))}
        unite="m²"
        onEnvoyer={() => envoyer({ metric: 'murs_sup25', roomId: piece.id })}
      />
      <Ligne
        label="Plafond (plaque)"
        valeur={fmtNombreFr(surfacePlafondM2(piece))}
        unite="m²"
        onEnvoyer={() => envoyer({ metric: 'plafond_plaque', roomId: piece.id })}
      />
    </>
  )
}

export function BlocElectricien({ piece, symboles, envoyer }: { piece: Piece; symboles: Symbole[]; envoyer: Envoyer }) {
  const c = compteursElec(symboles)
  // NF C 15-100 : la comparaison se fait en SOCLES (une prise double = 2 socles).
  const nfc = suggestionNfc(piece.name, surfaceSolM2(piece), c.socles)
  return (
    <>
      <Ligne
        label="Prises (courant fort)"
        sous="16 A, doubles, 32 A"
        valeur={String(c.prises)}
        unite="u"
        onEnvoyer={() => envoyer({ metric: 'elec_prises', roomId: piece.id })}
      />
      <Ligne
        label="Commandes d'éclairage"
        sous="interrupteurs + va-et-vient"
        valeur={String(c.commandes)}
        unite="u"
        onEnvoyer={() => envoyer({ metric: 'elec_commandes', roomId: piece.id })}
      />
      <Ligne
        label="Points lumineux"
        sous="DCL + appliques"
        valeur={String(c.lumieres)}
        unite="u"
        onEnvoyer={() => envoyer({ metric: 'elec_lumieres', roomId: piece.id })}
      />
      {c.courantFaible > 0 && (
        <Ligne
          label="Prises courant faible"
          sous="RJ45 + TV"
          valeur={String(c.courantFaible)}
          unite="u"
          onEnvoyer={() => envoyer({ metric: 'elec_cf', roomId: piece.id })}
        />
      )}
      {c.autres > 0 && (
        <Ligne
          label="Autres équipements"
          sous="VMC + sorties de câble"
          valeur={String(c.autres)}
          unite="u"
          onEnvoyer={() => envoyer({ metric: 'elec_autres', roomId: piece.id })}
        />
      )}
      {c.tableaux > 0 && (
        <Ligne
          label="Tableau électrique"
          valeur={String(c.tableaux)}
          unite="u"
          onEnvoyer={() => envoyer({ metric: 'elec_tableau', roomId: piece.id })}
        />
      )}
      {nfc && (
        <div className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2.5">
          <p className="font-hanken text-[10.5px] font-bold uppercase tracking-wider text-navy">
            NF C 15-100 (suggestion indicative)
          </p>
          <p className="mt-1 font-hanken text-[12px] leading-snug text-navy">{nfc.texte}</p>
        </div>
      )}
    </>
  )
}

export function BlocPlombier({ roomId, symboles, envoyer }: { roomId: string; symboles: Symbole[]; envoyer: Envoyer }) {
  const c = compteursPlomberie(symboles)
  return (
    <>
      <Ligne
        label="Points d'eau"
        sous="WC, lavabo, douche, baignoire…"
        valeur={String(c.pointsEau)}
        unite="u"
        onEnvoyer={() => envoyer({ metric: 'eau_points', roomId })}
      />
      {c.parType.map((t) => (
        <Ligne key={t.type} label={labelSymbole(t.type)} valeur={String(t.nombre)} unite="u" />
      ))}
      {c.pointsEau === 0 && c.parType.length === 0 && (
        <p className="rounded-xl bg-sky/10 px-3 py-2 font-hanken text-[11.5px] leading-snug text-navy">
          Posez des symboles plomberie (palette de gauche) pour compter les points d&apos;eau de la pièce.
        </p>
      )}
    </>
  )
}

/** Carte Extérieur (Push 3b) : totaux du NIVEAU, visibles dans toutes les vues. */
export function BlocExterieur({ niveau, envoyer }: { niveau: Niveau; envoyer: Envoyer }) {
  const t = totauxExterieur(niveau)
  const vide =
    t.terrasseM2 === 0 && t.piscineM2 === 0 && t.pelouseM2 === 0 && t.autreExtM2 === 0 && t.clotureMl === 0 && t.portails === 0
  if (vide) return null
  return (
    <div className="mt-3">
      <h4 className="mb-1.5 font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Extérieur — total du niveau
      </h4>
      <div className="space-y-1.5">
        {t.terrasseM2 > 0 && (
          <Ligne label="Terrasse" valeur={fmtNombreFr(t.terrasseM2)} unite="m²" onEnvoyer={() => envoyer({ metric: 'ext_terrasse' })} />
        )}
        {t.piscineM2 > 0 && (
          <Ligne
            label="Piscine"
            sous={`périmètre ${fmtNombreFr(t.piscinePerimetreMl)} ml (margelles)`}
            valeur={fmtNombreFr(t.piscineM2)}
            unite="m²"
            onEnvoyer={() => envoyer({ metric: 'ext_piscine' })}
          />
        )}
        {t.pelouseM2 > 0 && (
          <Ligne label="Pelouse" valeur={fmtNombreFr(t.pelouseM2)} unite="m²" onEnvoyer={() => envoyer({ metric: 'ext_pelouse' })} />
        )}
        {t.autreExtM2 > 0 && (
          <Ligne label="Autres zones ext." valeur={fmtNombreFr(t.autreExtM2)} unite="m²" onEnvoyer={() => envoyer({ metric: 'ext_autre' })} />
        )}
        {t.clotureMl > 0 && (
          <Ligne
            label="Clôture / grillage"
            sous="longueur des polylignes tracées"
            valeur={fmtNombreFr(t.clotureMl)}
            unite="ml"
            onEnvoyer={() => envoyer({ metric: 'cloture_ml' })}
          />
        )}
        {t.portails > 0 && (
          <Ligne label="Portail" valeur={String(t.portails)} unite="u" onEnvoyer={() => envoyer({ metric: 'portail_u' })} />
        )}
      </div>
    </div>
  )
}
