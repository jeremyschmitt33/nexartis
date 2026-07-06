'use client'

/**
 * MetresPanel — Métrés de la pièce sélectionnée, FILTRÉS PAR VUE MÉTIER
 * (Push 3a → 3b). Monté sous RoomSheet dans le panneau droit. Les blocs par
 * lot vivent dans MetresBlocs.tsx (limite 450 lignes).
 *
 * Push 3b : boutons « → Devis » ACTIFS (ouvrent le tiroir avec le métré
 * pré-coché), mode de déduction peinture + coefficient de chutes REMONTÉS
 * dans PlanEditor (le tiroir applique exactement les mêmes règles que le
 * panneau), carte « Extérieur » (totaux du niveau, toutes les vues).
 */

import { useState } from 'react'
import type { ModeDeduction, Niveau, Piece, Symbole } from '@/lib/plan/types'
import { PROFILS, type MetierId } from '@/lib/plan/profils'
import {
  Accordeon,
  BlocCarreleur,
  BlocElectricien,
  BlocExterieur,
  BlocPeintre,
  BlocPlaquiste,
  BlocPlombier,
  type Envoyer,
} from './MetresBlocs'

export interface MetresPanelProps {
  piece: Piece
  /** Symboles du niveau rattachés à cette pièce. */
  symboles: Symbole[]
  metier: MetierId
  /** Niveau courant complet (carte Extérieur : totaux du niveau). */
  niveau: Niveau
  /** Mode de déduction peinture — contrôlé par PlanEditor (partagé avec le tiroir). */
  modePeinture: ModeDeduction
  onModePeinture: (m: ModeDeduction) => void
  /** Saisie du coefficient de chutes — contrôlée par PlanEditor (partagée avec le tiroir). */
  chutes: string
  onChutes: (v: string) => void
  /** Ouvre le tiroir devis avec ce métré pré-coché. */
  onEnvoyer: Envoyer
}

export default function MetresPanel({
  piece,
  symboles,
  metier,
  niveau,
  modePeinture,
  onModePeinture,
  chutes,
  onChutes,
  onEnvoyer,
}: MetresPanelProps) {
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
      onMode={onModePeinture}
      reglesOuvertes={ouverts.has(cleRegles)}
      onToggleRegles={() => basculer(cleRegles)}
      envoyer={onEnvoyer}
    />
  )

  let contenu: React.ReactNode
  if (piece.cat === 'ext') {
    contenu = (
      <p className="rounded-xl bg-sky/10 px-3 py-2 font-hanken text-[11.5px] leading-snug text-navy">
        Zone extérieure — hors surface habitable. Ses métrés sont regroupés dans la carte Extérieur ci-dessous.
      </p>
    )
  } else if (metier === 'peintre') contenu = blocPeintre('regles-vue')
  else if (metier === 'carreleur_solier')
    contenu = <BlocCarreleur piece={piece} chutes={chutes} onChutes={onChutes} envoyer={onEnvoyer} />
  else if (metier === 'plaquiste') contenu = <BlocPlaquiste piece={piece} envoyer={onEnvoyer} />
  else if (metier === 'electricien') contenu = <BlocElectricien piece={piece} symboles={symboles} envoyer={onEnvoyer} />
  else if (metier === 'plombier') contenu = <BlocPlombier roomId={piece.id} symboles={symboles} envoyer={onEnvoyer} />
  else {
    const lots: { titre: string; corps: React.ReactNode }[] = [
      { titre: 'Peinture', corps: blocPeintre('regles-tce') },
      { titre: 'Carrelage / sols', corps: <BlocCarreleur piece={piece} chutes={chutes} onChutes={onChutes} envoyer={onEnvoyer} /> },
      { titre: 'Plâtrerie', corps: <BlocPlaquiste piece={piece} envoyer={onEnvoyer} /> },
      { titre: 'Électricité', corps: <BlocElectricien piece={piece} symboles={symboles} envoyer={onEnvoyer} /> },
      { titre: 'Plomberie', corps: <BlocPlombier roomId={piece.id} symboles={symboles} envoyer={onEnvoyer} /> },
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
      <BlocExterieur niveau={niveau} envoyer={onEnvoyer} />
      <p className="mt-2 font-hanken text-[10.5px] leading-snug text-gray-400">
        Métrés indicatifs calculés sur les cotes saisies — à vérifier avant chiffrage.
      </p>
    </div>
  )
}
