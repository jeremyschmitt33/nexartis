'use client'

/**
 * SituationParLigne — Écran de facturation de situation ligne par ligne (Push 7B).
 *
 * Composant AUTONOME et additif : AUCUN accès réseau (le parent passe les
 * données), ne modifie rien tant que l'artisan ne clique pas « Appliquer ».
 * Il pré-remplit le % d'avancement de chaque ligne du devis depuis le plan
 * colorié (pièce Terminé → 100 %, En cours → 50 %), calcule le montant par la
 * VALEUR via le moteur pur lib/situation, et rend au parent les lignes de
 * facture à insérer + le détail à mémoriser (situation_lignes).
 *
 * Ne facture jamais en négatif : une ligne en trop-perçu est signalée et bloque
 * l'application (l'artisan ajuste le % ou passe par un avoir).
 *
 * Corrections d'audit (confrontateur) intégrées :
 *  - init UNE SEULE FOIS par ligne (ref) → ne réécrase jamais une saisie manuelle ;
 *  - bouton « Appliquer l'avancement du plan » pour re-suggérer volontairement ;
 *  - buffer texte par ligne (saisie « 12,5 » sans friction) ;
 *  - lignes de titre / montant 0 exclues ; nom de pièce visible ; message d'aide
 *    sous le bouton désactivé ; désignation de facture propre (pas de suffixe %).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculerSituation,
  pctSuggereDepuisEtat,
  type LigneMarcheSituation,
  type SituationLigneEnregistree,
} from '@/lib/situation'

export interface LigneDevisMarche {
  id: string
  designation: string
  montantMarcheHt: number
  tauxTva: number
  /** Pièce du plan liée à cette ligne (source_plan.roomId), ou null. */
  roomId: string | null
}

export interface SituationParLigneResultat {
  /** Lignes de facture à injecter (une par poste avec avancement > 0). */
  lignesFacture: Array<{ devisLigneId: string; designation: string; prix_unitaire_ht: number; tva: number }>
  /** Détail à mémoriser sur la facture (colonne situation_lignes). */
  situationLignes: SituationLigneEnregistree[]
  situationHt: number
  /** % global pondéré (cumul facturé / marché), pour le champ pourcentage_situation. */
  pourcentageGlobal: number
}

export interface SituationParLigneProps {
  lignes: LigneDevisMarche[]
  /** HT déjà facturé par ligne (situations précédentes). */
  dejaFactureParLigne: Record<string, number>
  /** État d'avancement du plan par pièce (roomId → 'termine' | 'en_cours' | ...). */
  etatsPieces: Record<string, string>
  /** Nom des pièces (roomId → nom), pour l'étiquette. */
  nomsPieces?: Record<string, string>
  /** Retenue de garantie en % (0 pour l'instant — géré par le moteur, câblé plus tard). */
  retenueGarantiePct?: number
  onAppliquer: (r: SituationParLigneResultat) => void
}

function eur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function pctDejaFacture(marche: number, deja: number): number {
  if (!(marche > 0)) return 0
  return Math.round((deja / marche) * 100)
}

const BADGE: Record<string, { texte: string; bg: string; fg: string }> = {
  termine: { texte: 'Terminé', bg: '#EAF3DE', fg: '#27500A' },
  receptionne: { texte: 'Réceptionné', bg: '#E6F1FB', fg: '#0C447C' },
  en_cours: { texte: 'En cours', bg: '#EEEDFE', fg: '#3C3489' },
}

export default function SituationParLigne({
  lignes,
  dejaFactureParLigne,
  etatsPieces,
  nomsPieces = {},
  retenueGarantiePct = 0,
  onAppliquer,
}: SituationParLigneProps) {
  const [pctParLigne, setPctParLigne] = useState<Record<string, number>>({})
  const [saisie, setSaisie] = useState<Record<string, string>>({})
  const initedRef = useRef<Set<string>>(new Set())

  const lignesFacturables = useMemo(() => lignes.filter((l) => l.montantMarcheHt > 0), [lignes])
  const parId = useMemo(
    () => new Map(lignesFacturables.map((l): [string, LigneDevisMarche] => [l.id, l])),
    [lignesFacturables]
  )

  const suggestionPour = (l: LigneDevisMarche): number => {
    const dejaPct = pctDejaFacture(l.montantMarcheHt, dejaFactureParLigne[l.id] ?? 0)
    const etat = l.roomId ? etatsPieces[l.roomId] : undefined
    const suggere = etat ? pctSuggereDepuisEtat(etat) : null
    return suggere != null ? Math.max(dejaPct, suggere) : dejaPct
  }

  // Init UNE SEULE FOIS par ligne : ne réécrase jamais une saisie de l'artisan.
  useEffect(() => {
    let changed = false
    const nextPct: Record<string, number> = {}
    const nextSaisie: Record<string, string> = {}
    for (const l of lignesFacturables) {
      if (initedRef.current.has(l.id)) continue
      const v = suggestionPour(l)
      nextPct[l.id] = v
      nextSaisie[l.id] = String(v)
      initedRef.current.add(l.id)
      changed = true
    }
    if (changed) {
      setPctParLigne((prev) => ({ ...prev, ...nextPct }))
      setSaisie((prev) => ({ ...prev, ...nextSaisie }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesFacturables, dejaFactureParLigne, etatsPieces])

  const majPct = (id: string, raw: string) => {
    setSaisie((prev) => ({ ...prev, [id]: raw }))
    const n = Number(raw.replace(',', '.'))
    setPctParLigne((prev) => ({ ...prev, [id]: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 }))
  }

  const appliquerPlan = () => {
    const nextPct: Record<string, number> = {}
    const nextSaisie: Record<string, string> = {}
    for (const l of lignesFacturables) {
      const v = suggestionPour(l)
      nextPct[l.id] = v
      nextSaisie[l.id] = String(v)
    }
    setPctParLigne((prev) => ({ ...prev, ...nextPct }))
    setSaisie((prev) => ({ ...prev, ...nextSaisie }))
  }

  const resultat = useMemo(() => {
    const lignesMoteur: LigneMarcheSituation[] = lignesFacturables.map((l) => ({
      id: l.id,
      designation: l.designation,
      montantMarcheHt: l.montantMarcheHt,
      tauxTva: l.tauxTva,
      avancementActuelPct: pctParLigne[l.id] ?? 0,
      montantDejaFactureHt: dejaFactureParLigne[l.id] ?? 0,
    }))
    return calculerSituation(lignesMoteur, { retenueGarantiePct })
  }, [lignesFacturables, pctParLigne, dejaFactureParLigne, retenueGarantiePct])

  const progression = resultat.marcheHt > 0 ? Math.round((resultat.cumulFactureHt / resultat.marcheHt) * 100) : 0
  const auMoinsUnLien = lignesFacturables.some((l) => l.roomId && etatsPieces[l.roomId])

  const appliquer = () => {
    if (resultat.aTropPercu || resultat.situationHt <= 0) return
    const lignesFacture = resultat.lignes
      .filter((l) => l.montantSituationHt > 0)
      .map((l) => ({ devisLigneId: l.id, designation: l.designation, prix_unitaire_ht: l.montantSituationHt, tva: l.tauxTva }))
    const situationLignes: SituationLigneEnregistree[] = resultat.lignes.map((l) => ({
      devis_ligne_id: l.id,
      montant_ht: l.montantSituationHt,
    }))
    onAppliquer({ lignesFacture, situationLignes, situationHt: resultat.situationHt, pourcentageGlobal: progression })
  }

  if (lignesFacturables.length === 0) {
    return (
      <p className="font-hanken text-[13px] text-gray-500">
        Ce devis n&apos;a pas de lignes chiffrées exploitables. Utilisez la saisie manuelle ci-dessous.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {auMoinsUnLien && (
        <div className="flex items-center justify-between gap-2">
          <p className="font-hanken text-[12px] text-gray-500">Les % marqués « plan » viennent de vos pièces coloriées — ajustez librement.</p>
          <button
            type="button"
            onClick={appliquerPlan}
            className="flex-shrink-0 rounded-lg border-[1.5px] border-gray-200 bg-white px-2.5 py-1.5 font-hanken text-[12px] font-bold text-[#0f1a3a] transition-colors hover:border-[#ff7a1a]"
          >
            Appliquer l&apos;avancement du plan
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-left font-hanken text-[11px] uppercase tracking-wider text-gray-500">
              <th className="py-2 pr-2 font-semibold">Poste</th>
              <th className="py-2 px-2 text-right font-semibold">Marché HT</th>
              <th className="py-2 px-2 text-right font-semibold">Déjà facturé</th>
              <th className="py-2 px-2 font-semibold">Avancement</th>
              <th className="py-2 pl-2 text-right font-semibold">Cette situation</th>
            </tr>
          </thead>
          <tbody className="font-spline-mono">
            {resultat.lignes.map((l) => {
              const src = parId.get(l.id)
              const etat = src?.roomId ? etatsPieces[src.roomId] : undefined
              const badge = etat ? BADGE[etat] : undefined
              const nomPiece = src?.roomId ? nomsPieces[src.roomId] : undefined
              const deja = dejaFactureParLigne[l.id] ?? 0
              return (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="py-2.5 pr-2 font-hanken text-[#0f1a3a]">{l.designation}</td>
                  <td className="py-2.5 px-2 text-right">{eur(l.montantMarcheHt)}</td>
                  <td className="py-2.5 px-2 text-right text-gray-500">
                    {deja > 0 ? `${pctDejaFacture(l.montantMarcheHt, deja)} % · ${eur(deja)}` : '—'}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <input
                        value={saisie[l.id] ?? String(pctParLigne[l.id] ?? 0)}
                        onChange={(e) => majPct(l.id, e.target.value)}
                        inputMode="decimal"
                        aria-label={`Avancement de ${l.designation} en pourcentage`}
                        className={`w-14 rounded-lg border-[1.5px] px-2 py-1 text-right text-[13px] focus:outline-none ${
                          l.tropPercu ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-[#fafbfc] text-[#0f1a3a] focus:border-[#ff7a1a]'
                        }`}
                      />
                      <span className="font-hanken text-gray-500">%</span>
                      {badge && (
                        <span className="font-hanken text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.fg }}>
                          {badge.texte}{nomPiece ? ` · ${nomPiece}` : ''}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`py-2.5 pl-2 text-right font-semibold ${l.tropPercu ? 'text-red-600' : 'text-[#0f1a3a]'}`}>
                    {l.tropPercu ? `trop-perçu ${eur(l.montantSituationHt)}` : eur(l.montantSituationHt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {resultat.aTropPercu && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-hanken text-[12px] text-red-700">
          Une ligne est en trop-perçu (le % saisi est inférieur à ce qui a déjà été facturé). Ajustez le pourcentage, ou établissez un avoir séparé — une situation ne se facture jamais en négatif.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 font-hanken text-[11px] uppercase tracking-wider text-gray-500">Progression du chantier</div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#639922]" style={{ width: `${Math.min(100, progression)}%` }} />
          </div>
          <div className="mt-1.5 font-hanken text-[12px] text-gray-600">
            Cumul facturé {eur(resultat.cumulFactureHt)} / {eur(resultat.marcheHt)} · reste {eur(resultat.resteAFacturerHt)}
          </div>
        </div>
        <div className="font-spline-mono text-[13px]">
          <div className="flex justify-between py-0.5">
            <span className="font-hanken text-gray-600">Situation HT</span>
            <span>{eur(resultat.situationHt)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="font-hanken text-gray-600">TVA</span>
            <span>{eur(resultat.situationTva)}</span>
          </div>
          {retenueGarantiePct > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="font-hanken text-gray-600">Retenue de garantie {retenueGarantiePct} %</span>
              <span className="text-red-600">− {eur(resultat.retenueGarantieHt)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1.5 font-semibold">
            <span className="font-hanken text-[#0f1a3a]">Net à payer</span>
            <span>{eur(resultat.netAPayerTtc)}</span>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={appliquer}
          disabled={resultat.aTropPercu || resultat.situationHt <= 0}
          className="w-full rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-4 py-2.5 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Appliquer à la facture — {eur(resultat.situationHt)} HT
        </button>
        {resultat.situationHt <= 0 && !resultat.aTropPercu && (
          <p className="mt-1.5 text-center font-hanken text-[12px] text-gray-500">
            Aucun avancement à facturer pour l&apos;instant — augmentez un pourcentage.
          </p>
        )}
      </div>
    </div>
  )
}
