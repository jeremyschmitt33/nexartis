'use client'

/**
 * DevisDrawer — Tiroir « Envoyer au devis » (Push 3b, 06/07/2026).
 *
 * LE différenciateur (spec V2 §3). Contenu : sélecteur du devis cible
 * (devis MODIFIABLES du chantier uniquement), métrés proposés groupés par
 * LOT selon la vue métier (tout coché par défaut), bandeau orange calque
 * Projet, bandeau anti-doublon (jamais de remplacement automatique), pied
 * « Créer N lignes dans le devis », écran de succès avec lien réel.
 *
 * Toute la logique d'écriture est dans useInjection.ts (append-only strict) ;
 * la proposition est construite par lib/plan/injection.ts (pur).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ModeDeduction, Niveau, PlanData } from '@/lib/plan/types'
import { fmtNombreFr } from '@/lib/plan/geometry'
import { cleDoublon, construireProposition, type LigneProposee } from '@/lib/plan/injection'
import { pieceAChevauchement } from '@/lib/plan/metrics'
import type { MetierId } from '@/lib/plan/profils'
import { toast } from '@/lib/toast'
import {
  LIBELLE_STATUT,
  injecterLignes,
  stockerImagePlanNiveau,
  useDevisModifiables,
  useDoublons,
} from './useInjection'

/** Métré à pré-cocher à l'ouverture (boutons « → Devis » du panneau). */
export interface PreSelection {
  metric: string
  /** Si absent : toutes les lignes de ce metric sont pré-cochées. */
  roomId?: string | null
}

export interface DevisDrawerProps {
  open: boolean
  onClose: () => void
  planId: string
  chantierId: string | null
  niveau: Niveau
  /** Document complet : snapshot plan_revisions 'devis_envoye'. */
  data: PlanData
  metier: MetierId
  modePeinture: ModeDeduction
  chutesPct: number
  preSelection: PreSelection | null
}

type ModeTiroir = 'liste' | 'envoi' | 'succes'

function fmtQte(l: LigneProposee): string {
  return l.unite === 'u' ? String(Math.round(l.quantite)) : fmtNombreFr(l.quantite)
}

function correspond(l: LigneProposee, sel: PreSelection): boolean {
  if (l.metric !== sel.metric) return false
  if (sel.roomId === undefined) return true
  return (l.roomId ?? null) === (sel.roomId ?? null)
}

export default function DevisDrawer({
  open,
  onClose,
  planId,
  chantierId,
  niveau,
  data,
  metier,
  modePeinture,
  chutesPct,
  preSelection,
}: DevisDrawerProps) {
  const [mode, setMode] = useState<ModeTiroir>('liste')
  const [devisId, setDevisId] = useState<string | null>(null)
  const [decochees, setDecochees] = useState<Set<string>>(new Set())
  const [doublonIgnore, setDoublonIgnore] = useState(false)
  const [versionDoublons, setVersionDoublons] = useState(0)
  const [succes, setSucces] = useState<{ n: number; numero: string; devisId: string } | null>(null)

  const { devis, chargement } = useDevisModifiables(chantierId, open)
  const doublons = useDoublons(devisId, planId, open, versionDoublons)

  const lignes = useMemo(
    () => construireProposition(niveau, metier, { modePeinture, chutesPct }),
    [niveau, metier, modePeinture, chutesPct]
  )

  // Réinitialisation à chaque ouverture (+ pré-cochage depuis « → Devis »).
  useEffect(() => {
    if (!open) return
    setMode('liste')
    setSucces(null)
    setDoublonIgnore(false)
    if (preSelection) {
      const hors = new Set<string>()
      for (const l of lignes) {
        if (!correspond(l, preSelection)) hors.add(l.cle)
      }
      setDecochees(hors)
    } else {
      setDecochees(new Set())
    }
    // `lignes` volontairement hors dépendances : on ne réinitialise les cases
    // qu'à l'OUVERTURE, pas à chaque recalcul de la proposition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preSelection])

  // Devis cible par défaut : le plus récent de la liste.
  useEffect(() => {
    if (!open) return
    if (devis.length === 0) {
      setDevisId(null)
      return
    }
    setDevisId((actuel) => (actuel && devis.some((d) => d.id === actuel) ? actuel : devis[0].id))
  }, [open, devis])

  // Échap : fermer (sauf pendant l'envoi).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'envoi') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mode, onClose])

  if (!open) return null

  const cochees = lignes.filter((l) => !decochees.has(l.cle))
  const doublonsPresents = lignes.filter((l) => doublons.has(cleDoublon(l.roomId, l.metric)))
  const lotsProjet = lignes.filter((l) => l.projet && !decochees.has(l.cle)).length
  // Pièces INTÉRIEURES à ouvertures superposées : leur métré murs/plinthes est
  // surévalué en déduction. On PRÉVIENT ici (moment de l'argent), sans toucher
  // au calcul : l'artisan supprime l'ouverture en trop -> vraie valeur.
  const piecesChevauchees = niveau.rooms.filter((r) => r.cat === 'int' && pieceAChevauchement(r)).map((r) => r.name)

  const basculer = (cle: string) => {
    setDecochees((prev) => {
      const s = new Set(prev)
      if (s.has(cle)) s.delete(cle)
      else s.add(cle)
      return s
    })
  }

  const decocherDoublons = () => {
    setDecochees((prev) => {
      const s = new Set(prev)
      for (const l of doublonsPresents) s.add(l.cle)
      return s
    })
    setDoublonIgnore(true)
  }

  const envoyer = async () => {
    if (!devisId || cochees.length === 0) return
    setMode('envoi')
    try {
      const resultat = await injecterLignes(planId, devisId, cochees, data, niveau.id)
      // Push 5 — image « Plan du chantier » du niveau injecté, régénérée à
      // CHAQUE injection réussie. Best-effort : ne lève jamais, l'injection
      // reste un succès même si la génération d'image échoue.
      // Mais on ne l'avale plus en SILENCE (14/07/2026) : sans avertissement,
      // l'artisan voyait l'écran de succès et envoyait au client un devis sans
      // le plan, en croyant l'inverse. Les lignes, elles, sont bien créées :
      // c'est un avertissement, pas une erreur.
      const img = await stockerImagePlanNiveau(planId, data, niveau.id)
      if (img === 'echec') {
        toast.warning('Lignes créées, mais le plan n’a pas pu être joint', {
          description:
            'Les métrés sont bien dans le devis. L’image du plan, elle, n’a pas pu être ajoutée — renvoyez au devis pour réessayer.',
        })
      }
      setSucces({ n: resultat.inseres, numero: resultat.numero, devisId })
      setMode('succes')
    } catch (e) {
      toast.error("Envoi au devis impossible", {
        description: e instanceof Error ? e.message : 'Erreur inattendue — réessayez.',
      })
      setMode('liste')
    } finally {
      setVersionDoublons((v) => v + 1)
    }
  }

  // Groupes par lot, dans l'ordre d'apparition.
  const lots: { titre: string; lignes: LigneProposee[] }[] = []
  for (const l of lignes) {
    const lot = lots.find((g) => g.titre === l.lot)
    if (lot) lot.lignes.push(l)
    else lots.push({ titre: l.lot, lignes: [l] })
  }

  const s = (n: number) => (n > 1 ? 's' : '')

  let corps: React.ReactNode
  if (mode === 'envoi') {
    corps = (
      <div className="flex flex-col items-center gap-3 py-16" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-orange" aria-hidden="true" />
        <p className="font-hanken text-[13px] font-semibold text-gray-500">Création des lignes…</p>
      </div>
    )
  } else if (mode === 'succes' && succes) {
    corps = (
      <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h3 className="font-hanken text-[15px] font-extrabold leading-snug text-navy">
          {succes.n} ligne{s(succes.n)} ajoutée{s(succes.n)} au devis{' '}
          <span className="font-spline-mono font-semibold">{succes.numero}</span>
        </h3>
        <p className="font-hanken text-[12.5px] leading-relaxed text-gray-500">
          Les lignes partent à 0 € : chiffrez-les dans le devis.
          <br />
          Les quantités restent modifiables.
        </p>
        <Link
          href={`/dashboard/devis/${succes.devisId}`}
          className="w-full rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
        >
          Ouvrir le devis
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border-[1.5px] border-gray-200 bg-white px-5 py-2.5 font-hanken text-[14px] font-bold text-navy transition-colors hover:border-gray-300"
        >
          Rester sur le plan
        </button>
      </div>
    )
  } else if (!chantierId) {
    corps = (
      <p className="px-4 py-10 text-center font-hanken text-[13px] leading-relaxed text-gray-500">
        Ce plan n&apos;est rattaché à aucun chantier.
        <br />
        Ouvrez le plan depuis l&apos;onglet Plan 2D d&apos;un chantier pour envoyer les métrés vers un devis.
      </p>
    )
  } else if (!chargement && devis.length === 0) {
    corps = (
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <p className="font-hanken text-[13px] leading-relaxed text-gray-500">
          Aucun devis modifiable sur ce chantier.
          <br />
          Créez d&apos;abord un devis pour ce chantier, puis revenez sur le plan.
        </p>
        <Link
          href="/dashboard/devis/nouveau"
          className="rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-[13.5px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
        >
          Créer un devis
        </Link>
      </div>
    )
  } else {
    corps = (
      <div className="space-y-3 px-4 py-4">
        <div>
          <label htmlFor="devis-cible" className="mb-1.5 block font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Devis cible
          </label>
          <select
            id="devis-cible"
            value={devisId ?? ''}
            onChange={(e) => {
              setDevisId(e.target.value)
              setDoublonIgnore(false)
            }}
            disabled={chargement}
            className="w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] px-3 py-2 font-hanken text-[13.5px] font-semibold text-navy focus:border-orange focus:bg-white focus:outline-none"
          >
            {devis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.numero} — {LIBELLE_STATUT[d.statut] ?? d.statut}
              </option>
            ))}
          </select>
        </div>

        {doublonsPresents.length > 0 && !doublonIgnore && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="font-hanken text-[12.5px] font-semibold leading-snug text-amber-800">
              {doublonsPresents.length} ligne{s(doublonsPresents.length)} de ce plan déjà dans le devis.
            </p>
            <p className="mt-0.5 font-hanken text-[11.5px] leading-snug text-amber-700">
              Rien n&apos;est remplacé automatiquement : les lignes existantes restent intactes.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={decocherDoublons}
                className="rounded-lg border-[1.5px] border-amber-300 bg-white px-2.5 py-1 font-hanken text-[12px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
              >
                Décocher les doublons
              </button>
              <button
                type="button"
                onClick={() => setDoublonIgnore(true)}
                className="rounded-lg px-2.5 py-1 font-hanken text-[12px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
              >
                Ajouter quand même
              </button>
            </div>
          </div>
        )}

        {lotsProjet > 0 && (
          <div className="rounded-xl border border-orange/40 bg-orange/5 px-3 py-2.5">
            <p className="font-hanken text-[12px] leading-snug text-navy">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-orange align-middle" aria-hidden="true" />
              <span className="font-bold text-orange">Calque Projet :</span> {lotsProjet} métré{s(lotsProjet)} coché{s(lotsProjet)} provien{lotsProjet > 1 ? 'nent' : 't'} de travaux à créer.
            </p>
          </div>
        )}

        {piecesChevauchees.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="font-hanken text-[12.5px] font-semibold leading-snug text-red-800">
              Ouvertures superposées dans {piecesChevauchees.length > 1 ? 'les pièces' : 'la pièce'} : {piecesChevauchees.join(', ')}.
            </p>
            <p className="mt-0.5 font-hanken text-[11.5px] leading-snug text-red-700">
              Deux ouvertures au même endroit sont déduites deux fois : le métré des
              murs et des plinthes de {piecesChevauchees.length > 1 ? 'ces pièces' : 'cette pièce'} est
              surévalué en déduction (mur sous-facturé). Ouvrez la pièce et supprimez
              l&apos;ouverture en trop avant d&apos;envoyer.
            </p>
          </div>
        )}

        {lignes.length === 0 && (
          <p className="py-8 text-center font-hanken text-[13px] leading-relaxed text-gray-500">
            Aucun métré à envoyer pour cette vue.
            <br />
            Dessinez des pièces ou changez de vue métier.
          </p>
        )}

        {lots.map((lot) => (
          <div key={lot.titre} className="overflow-hidden rounded-xl border border-gray-100">
            <div className="flex items-center justify-between bg-[#fafbfc] px-3 py-2">
              <span className="font-hanken text-[12px] font-bold uppercase tracking-wider text-navy">{lot.titre}</span>
              <span className="font-spline-mono text-[11.5px] text-gray-500">
                {lot.lignes.filter((l) => !decochees.has(l.cle)).length}/{lot.lignes.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50 bg-white">
              {lot.lignes.map((l) => {
                const estDoublon = doublons.has(cleDoublon(l.roomId, l.metric))
                return (
                  <label key={l.cle} className="flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={!decochees.has(l.cle)}
                      onChange={() => basculer(l.cle)}
                      aria-label={`Inclure ${l.designation}`}
                      className="mt-0.5 accent-orange"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-hanken text-[12.5px] font-semibold leading-snug text-navy">
                        {l.projet && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-orange" aria-hidden="true" />}
                        {l.designation}
                        {estDoublon && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 font-hanken text-[9.5px] font-bold uppercase tracking-wide text-amber-800">
                            déjà envoyé
                          </span>
                        )}
                      </span>
                      {l.regle && <span className="mt-0.5 block font-hanken text-[10.5px] font-medium text-gray-500">{l.regle}</span>}
                    </span>
                    <span className="whitespace-nowrap font-spline-mono text-[13px] font-semibold text-navy">
                      {fmtQte(l)} <span className="text-[10.5px] font-medium text-gray-500">{l.unite}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <p className="font-hanken text-[10.5px] leading-snug text-gray-400">
          Métrés indicatifs calculés sur les cotes saisies — à vérifier avant chiffrage. Les lignes sont
          ajoutées à la suite du devis, à 0 €, sans toucher aux lignes existantes.
        </p>
      </div>
    )
  }

  const piedVisible = mode === 'liste' && chantierId && devis.length > 0

  return (
    <div className="fixed inset-0 z-[90] font-hanken">
      <button type="button" aria-label="Fermer le tiroir" onClick={mode === 'envoi' ? undefined : onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Envoyer les métrés au devis"
        className="absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        <div className="h-[3px] flex-none bg-orange" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-[15px] font-extrabold tracking-tight text-navy">Envoyer au devis</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mode === 'envoi'}
            aria-label="Fermer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-navy disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{corps}</div>
        {piedVisible && (
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={envoyer}
              disabled={cochees.length === 0 || !devisId}
              className="w-full rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              Créer {cochees.length} ligne{s(cochees.length)} dans le devis
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
