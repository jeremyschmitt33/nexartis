'use client'

/**
 * MetresPanel — Métrés de la pièce sélectionnée, FILTRÉS PAR VUE MÉTIER
 * (Push 3a, 03/07/2026). Monté sous RoomSheet dans le panneau droit.
 *
 * - Le moteur (lib/plan/metrics) calcule tout : ici on ne fait qu'afficher.
 * - Peintre : murs (3 modes de déduction repliés derrière « Règles de
 *   calcul »), plafond, plinthes. Carreleur : sol + coefficient de chutes
 *   VISIBLE et éditable (+10 % défaut) + plinthes. Plaquiste : murs > 2,5 m²
 *   + plafond. Électricien : compteurs + NF C 15-100 (suggestion indicative,
 *   JAMAIS « conforme »). Plombier : points d'eau. TCE : tout, par lot.
 * - Boutons « → Devis » : placeholders DÉSACTIVÉS (injection = Push 3b).
 */

import { useState } from 'react'
import type { ModeDeduction, Piece, Symbole } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { appliquerChutes, plinthesMl, surfaceMursM2, surfacePlafondM2, surfaceSolM2 } from '@/lib/plan/metrics'
import {
  CHUTES_DEFAUT_PCT,
  PROFILS,
  compteursElec,
  compteursPlomberie,
  suggestionNfc,
  type MetierId,
} from '@/lib/plan/profils'
import { labelSymbole } from '@/lib/plan/symboles'

const DESC_MODE: Record<ModeDeduction, string> = {
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

/** Ligne métré : libellé, valeur mono, bouton « → Devis » désactivé (Push 3b). */
function Ligne({ label, sous, valeur, unite }: { label: string; sous?: string; valeur: string; unite: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-[#fafbfc] px-3 py-2">
      <span className="min-w-0 flex-1 font-hanken text-[12.5px] font-semibold leading-tight text-navy">
        {label}
        {sous && <span className="mt-0.5 block text-[10.5px] font-medium text-gray-500">{sous}</span>}
      </span>
      <span className="whitespace-nowrap font-spline-mono text-[14px] font-semibold text-navy">
        {valeur} <span className="text-[11px] font-medium text-gray-500">{unite}</span>
      </span>
      <button
        type="button"
        disabled
        title="Bientôt — Push 3b"
        aria-label={`Envoyer ${label} au devis — bientôt`}
        className="flex-shrink-0 cursor-not-allowed rounded-lg border-[1.5px] border-gray-200 px-2 py-1 font-hanken text-[11px] font-bold text-gray-400"
      >
        → Devis
      </button>
    </div>
  )
}

function Accordeon({
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

function BlocPeintre({
  piece,
  mode,
  onMode,
  reglesOuvertes,
  onToggleRegles,
}: {
  piece: Piece
  mode: ModeDeduction
  onMode: (m: ModeDeduction) => void
  reglesOuvertes: boolean
  onToggleRegles: () => void
}) {
  return (
    <>
      <Ligne label="Murs" sous={DESC_MODE[mode]} valeur={fmtNombreFr(surfaceMursM2(piece, mode))} unite="m²" />
      <Ligne label="Plafond" valeur={fmtNombreFr(surfacePlafondM2(piece))} unite="m²" />
      <Ligne label="Plinthes" sous="périmètre − ouvertures au sol" valeur={fmtNombreFr(plinthesMl(piece))} unite="ml" />
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

function BlocCarreleur({
  piece,
  chutes,
  onChutes,
}: {
  piece: Piece
  chutes: string
  onChutes: (v: string) => void
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
      <Ligne label="Sol + chutes" sous={`coefficient +${fmtNombreFr(taux, 0)} % appliqué`} valeur={fmtNombreFr(appliquerChutes(sol, taux))} unite="m²" />
      <Ligne label="Plinthes assorties" valeur={fmtNombreFr(plinthesMl(piece))} unite="ml" />
    </>
  )
}

function BlocPlaquiste({ piece }: { piece: Piece }) {
  return (
    <>
      <Ligne label="Murs (doublage)" sous={DESC_MODE.sup25} valeur={fmtNombreFr(surfaceMursM2(piece, 'sup25'))} unite="m²" />
      <Ligne label="Plafond (plaque)" valeur={fmtNombreFr(surfacePlafondM2(piece))} unite="m²" />
    </>
  )
}

function BlocElectricien({ piece, symboles }: { piece: Piece; symboles: Symbole[] }) {
  const c = compteursElec(symboles)
  // NF C 15-100 : la comparaison se fait en SOCLES (une prise double = 2 socles).
  const nfc = suggestionNfc(piece.name, surfaceSolM2(piece), c.socles)
  return (
    <>
      <Ligne label="Prises (courant fort)" sous="16 A, doubles, 32 A" valeur={String(c.prises)} unite="u" />
      <Ligne label="Commandes d'éclairage" sous="interrupteurs + va-et-vient" valeur={String(c.commandes)} unite="u" />
      <Ligne label="Points lumineux" sous="DCL + appliques" valeur={String(c.lumieres)} unite="u" />
      {c.courantFaible > 0 && (
        <Ligne label="Prises courant faible" sous="RJ45 + TV" valeur={String(c.courantFaible)} unite="u" />
      )}
      {c.tableaux > 0 && <Ligne label="Tableau électrique" valeur={String(c.tableaux)} unite="u" />}
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

function BlocPlombier({ symboles }: { symboles: Symbole[] }) {
  const c = compteursPlomberie(symboles)
  return (
    <>
      <Ligne label="Points d'eau" sous="WC, lavabo, douche, baignoire…" valeur={String(c.pointsEau)} unite="u" />
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

/* ── Panneau ───────────────────────────────────────────────────────────────── */

export interface MetresPanelProps {
  piece: Piece
  /** Symboles du niveau rattachés à cette pièce. */
  symboles: Symbole[]
  metier: MetierId
}

export default function MetresPanel({ piece, symboles, metier }: MetresPanelProps) {
  // Réglages d'affichage (le moteur calcule tous les modes en permanence).
  const [modePeinture, setModePeinture] = useState<ModeDeduction>(PROFILS.peintre.deductionDefaut)
  const [chutes, setChutes] = useState<string>(String(CHUTES_DEFAUT_PCT))
  const [ouverts, setOuverts] = useState<Set<string>>(new Set(['regles-tce', 'Électricité']))

  const basculer = (cle: string) => {
    setOuverts((prev) => {
      const s = new Set(prev)
      if (s.has(cle)) s.delete(cle)
      else s.add(cle)
      return s
    })
  }

  const blocPeintre = (cleRegles: string) => (
    <BlocPeintre
      piece={piece}
      mode={modePeinture}
      onMode={setModePeinture}
      reglesOuvertes={ouverts.has(cleRegles)}
      onToggleRegles={() => basculer(cleRegles)}
    />
  )

  let contenu: React.ReactNode
  if (metier === 'peintre') contenu = blocPeintre('regles-vue')
  else if (metier === 'carreleur_solier') contenu = <BlocCarreleur piece={piece} chutes={chutes} onChutes={setChutes} />
  else if (metier === 'plaquiste') contenu = <BlocPlaquiste piece={piece} />
  else if (metier === 'electricien') contenu = <BlocElectricien piece={piece} symboles={symboles} />
  else if (metier === 'plombier') contenu = <BlocPlombier symboles={symboles} />
  else {
    const lots: { titre: string; corps: React.ReactNode }[] = [
      { titre: 'Peinture', corps: blocPeintre('regles-tce') },
      { titre: 'Carrelage / sols', corps: <BlocCarreleur piece={piece} chutes={chutes} onChutes={setChutes} /> },
      { titre: 'Plâtrerie', corps: <BlocPlaquiste piece={piece} /> },
      { titre: 'Électricité', corps: <BlocElectricien piece={piece} symboles={symboles} /> },
      { titre: 'Plomberie', corps: <BlocPlombier symboles={symboles} /> },
    ]
    contenu = lots.map((lot) => (
      <Accordeon key={lot.titre} titre={lot.titre} ouvert={ouverts.has(lot.titre)} onToggle={() => basculer(lot.titre)}>
        {lot.corps}
      </Accordeon>
    ))
  }

  const titre = metier === 'tce' ? 'Métrés par lot' : `Métrés ${PROFILS[metier].label}`

  return (
    <div className="border-t border-gray-100 px-4 py-4">
      <h3 className="mb-2 font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">{titre}</h3>
      <div className="space-y-1.5">{contenu}</div>
      <p className="mt-2 font-hanken text-[10.5px] leading-snug text-gray-400">
        Métrés indicatifs calculés sur les cotes saisies — à vérifier avant chiffrage. Envoi au devis : bientôt.
      </p>
    </div>
  )
}
