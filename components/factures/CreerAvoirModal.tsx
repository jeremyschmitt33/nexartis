'use client'

// ---------------------------------------------------------------------------
// Modale "Creer un avoir" — saisie %/EUR + apercu live + appel creerAvoir().
// Affichee depuis la liste factures (menu "...") et la page detail facture.
// Decisions verrouillees : montant en POSITIF, 100% par defaut, bascule %/EUR.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { creerAvoir, ventilerAvoir, baseParTauxDepuisLignes, type AvoirUnite } from '@/lib/avoir'
import { toast } from '@/lib/toast'

interface Props {
  open: boolean
  onClose: () => void
  factureId: string
  numero: string
  clientNom: string
  /** Montant TTC de la facture d'origine (positif). */
  montantTtc: number
  /** true si la facture d'origine est payee (=> message remboursement). */
  originePayee: boolean
  /** Appele apres creation reussie avec l'id du nouvel avoir. */
  onCreated: (avoirId: string, avoirNumero: string | null) => void
}

function fmtEur(n: number): string {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export default function CreerAvoirModal({
  open,
  onClose,
  factureId,
  numero,
  clientNom,
  montantTtc,
  originePayee,
  onCreated,
}: Props) {
  const [unite, setUnite] = useState<AvoirUnite>('pct')
  // Valeur saisie. Defaut : 100 (%) = avoir total.
  const [valeur, setValeur] = useState<string>('100')
  const [submitting, setSubmitting] = useState(false)
  // Ventilation de l'origine (bases HT par taux + entete HT/TVA), chargee a
  // l'ouverture. Permet d'afficher le montant TTC FINAL identique a celui qui
  // sera reellement emis (meme calcul que lib/avoir.ts -> ventilerAvoir).
  const [baseParTaux, setBaseParTaux] = useState<Map<number, number> | null>(null)
  const [entete, setEntete] = useState<{ ht: number; tva: number }>({ ht: 0, tva: 0 })
  // V-AVOIR (reste a crediter) : somme des avoirs deja emis sur cette facture.
  const [dejaCredite, setDejaCredite] = useState(0)
  const [resteLoaded, setResteLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const [{ data: lignesRaw }, { data: fac }, { data: avoirsExistants }] = await Promise.all([
          supabase
            .from('facture_lignes')
            .select('quantite, prix_unitaire_ht, montant_ht, taux_tva, type, designation')
            .eq('facture_id', factureId),
          supabase
            .from('factures')
            .select('montant_ht, montant_tva')
            .eq('id', factureId)
            .maybeSingle(),
          // Avoirs deja emis sur CETTE facture (factureId = facture d'origine).
          supabase
            .from('factures')
            .select('montant_ttc')
            .eq('facture_origine_id', factureId)
            .eq('type', 'avoir')
            .is('deleted_at', null),
        ])
        if (cancelled) return
        setBaseParTaux(baseParTauxDepuisLignes((lignesRaw ?? []) as never[]))
        setEntete({ ht: Number(fac?.montant_ht ?? 0), tva: Number(fac?.montant_tva ?? 0) })
        const sommeAvoirs = round2(
          (avoirsExistants ?? []).reduce((acc: number, a: { montant_ttc: number | null }) => acc + Number(a.montant_ttc ?? 0), 0),
        )
        setDejaCredite(sommeAvoirs)
        // Defaut intelligent : si rien n'a ete credite -> 100%. Sinon, on pre-remplit
        // le champ EUR avec le RESTE a crediter et on bascule sur l'unite EUR.
        const reste = round2(montantTtc - sommeAvoirs)
        if (sommeAvoirs > 0.01) {
          setUnite('eur')
          setValeur(reste > 0 ? String(reste) : '0')
        }
        setResteLoaded(true)
      } catch {
        if (!cancelled) { setBaseParTaux(new Map()); setResteLoaded(true) }
      }
    })()
    return () => { cancelled = true }
  }, [open, factureId, montantTtc])

  // Apercu live du montant de l'avoir (TTC, positif) = montant TTC FINAL emis.
  const montantAvoir = useMemo(() => {
    const v = parseFloat(valeur.replace(',', '.'))
    if (isNaN(v) || v <= 0) return 0
    // Montant TTC demande (saisie %/EUR) ramene au TTC origine.
    let demande: number
    if (unite === 'pct') {
      const pct = Math.max(0, Math.min(100, v))
      demande = Math.round(((montantTtc * pct) / 100) * 100) / 100
    } else {
      demande = Math.round(Math.min(v, montantTtc) * 100) / 100
    }
    // Tant que la ventilation n'est pas chargee, on affiche la saisie (proche).
    if (!baseParTaux) return demande
    const { totaux } = ventilerAvoir(baseParTaux, demande, montantTtc, entete)
    return totaux.ttc
  }, [valeur, unite, montantTtc, baseParTaux, entete])

  // V-AVOIR : reste reellement creditable = TTC origine - avoirs deja emis.
  const resteACrediter = useMemo(() => Math.max(0, round2(montantTtc - dejaCredite)), [montantTtc, dejaCredite])
  // Depassement : l'avoir calcule depasse-t-il le reste (tolerance 1 centime) ?
  const depasse = montantAvoir > resteACrediter + 0.01

  if (!open) return null

  // Quand on bascule l'unite, on convertit la valeur pour rester coherent.
  function switchUnite(next: AvoirUnite) {
    if (next === unite) return
    const v = parseFloat(valeur.replace(',', '.'))
    if (!isNaN(v) && v > 0 && montantTtc > 0) {
      if (next === 'eur') {
        // % -> EUR
        const pct = Math.max(0, Math.min(100, v))
        setValeur((Math.round(((montantTtc * pct) / 100) * 100) / 100).toString())
      } else {
        // EUR -> %
        const pct = Math.round((Math.min(v, montantTtc) / montantTtc) * 100)
        setValeur(String(pct))
      }
    }
    setUnite(next)
  }

  async function handleSubmit() {
    if (submitting) return
    const v = parseFloat(valeur.replace(',', '.'))
    if (isNaN(v) || v <= 0) {
      toast.error('Saisissez un montant superieur a 0.')
      return
    }
    // V-AVOIR : ne JAMAIS depasser le reste a crediter (evite l'erreur plafond DB).
    if (montantAvoir > resteACrediter + 0.01) {
      toast.error(`Maximum ${fmtEur(resteACrediter)} à créditer sur cette facture.`)
      return
    }
    setSubmitting(true)
    try {
      const supabase = createClient()
      const res = await creerAvoir(supabase, factureId, v, unite)
      toast.success(`Avoir ${res.numero || ''} cree.`.replace('  ', ' '))
      onCreated(res.id, res.numero)
    } catch (err) {
      toast.error((err as Error).message || "Erreur lors de la creation de l'avoir.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Creer un avoir"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#0f1a3a]/[0.08] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tete */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="font-hanken font-extrabold text-[16px] text-[#0f1a3a] leading-tight">Creer un avoir</h2>
              <p className="font-hanken text-[12px] text-gray-500 mt-0.5">
                Avoir pour la facture {numero}
                {clientNom ? ` · ${clientNom}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl bg-[#fafbfc] border border-gray-100 divide-y divide-gray-100">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-hanken text-[13px] text-gray-600">Montant de la facture</span>
              <span className="font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{fmtEur(montantTtc)} TTC</span>
            </div>
            {dejaCredite > 0.01 && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="font-hanken text-[13px] text-gray-600">Déjà crédité</span>
                  <span className="font-spline-mono font-medium text-[14px] text-gray-500">− {fmtEur(dejaCredite)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-orange-50/60 rounded-b-xl">
                  <span className="font-hanken text-[13px] font-bold text-[#0f1a3a]">Reste à créditer</span>
                  <span className="font-spline-mono font-bold text-[15px] text-[#ff7a1a]">{fmtEur(resteACrediter)}</span>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block font-hanken text-[12px] font-semibold text-gray-700 mb-1.5" htmlFor="avoir-montant">
              Montant a crediter
            </label>
            <div className="flex items-stretch gap-2">
              <input
                id="avoir-montant"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                className="flex-1 h-11 px-3 rounded-xl border-[1.5px] border-gray-200 font-spline-mono text-[15px] text-[#0f1a3a] focus:border-[#ff7a1a] focus:outline-none focus:ring-2 focus:ring-[#ff7a1a]/20"
              />
              <div className="flex rounded-xl border-[1.5px] border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchUnite('pct')}
                  className={`px-3.5 font-hanken text-[14px] font-bold transition-colors ${
                    unite === 'pct' ? 'bg-[#0f1a3a] text-white' : 'bg-white text-[#0f1a3a] hover:bg-gray-50'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => switchUnite('eur')}
                  className={`px-3.5 font-hanken text-[14px] font-bold transition-colors border-l-[1.5px] border-gray-200 ${
                    unite === 'eur' ? 'bg-[#0f1a3a] text-white' : 'bg-white text-[#0f1a3a] hover:bg-gray-50'
                  }`}
                >
                  €
                </button>
              </div>
            </div>
            {depasse ? (
              <p className="font-hanken text-[12px] font-semibold text-red-600 mt-1.5">
                Maximum {fmtEur(resteACrediter)} à créditer.
              </p>
            ) : (
              <p className="font-hanken text-[11.5px] text-gray-400 mt-1.5">
                {dejaCredite > 0.01
                  ? `Maximum ${fmtEur(resteACrediter)} (reste à créditer).`
                  : '100 % = avoir total. Une valeur inferieure = avoir partiel.'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-red-50/60 border border-red-100">
            <span className="font-hanken text-[13px] font-semibold text-red-700">Montant de l&apos;avoir</span>
            <span className="font-spline-mono font-bold text-[16px] text-red-700">{fmtEur(montantAvoir)} TTC</span>
          </div>

          <p className="font-hanken text-[12px] text-gray-500 leading-snug">
            {originePayee
              ? 'Cette facture est payee : pensez a rembourser le client apres emission.'
              : 'Cet avoir reduira ce que le client vous doit.'}
          </p>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white hover:bg-gray-50 font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || montantAvoir <= 0 || depasse || !resteLoaded}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30)] hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            {submitting ? 'Creation...' : "Creer l'avoir"}
          </button>
        </div>
      </div>
    </div>
  )
}
