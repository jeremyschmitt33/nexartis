'use client'

// ============================================================================
// BandeauUrssaf — provision URSSAF (V1.5). Discret, repliable, non anxiogène.
// ----------------------------------------------------------------------------
// Affiche « ce qu'il faut mettre de côté » pour ses cotisations, à partir du CA
// ENCAISSÉ de l'année (vraie base des cotisations en micro). Replié par défaut
// (une seule ligne), dépliable ; l'état est mémorisé. Taux/seuils DATÉS lus
// depuis parametres_fiscaux (2026).
//
// Cadrage expert-comptable + confrontateur (revue 13/07/2026) :
//   - Base = encaissements (paiements), jamais le CA facturé.
//   - Ventilation par défaut = PRESTATION 21,2 % : artisan du bâtiment =
//     fourniture + pose = prestation de services (matériaux inclus). Utiliser le
//     taux le plus élevé = estimation PRUDENTE.
//   - Cadrage « à mettre de côté » (épargne), pas « à payer » (dette). Arrondi à
//     la dizaine (pas de fausse précision au centime).
//   - Estimation = cotisations sociales URSSAF SEULES (hors CFP, CFE, versement
//     libératoire). Annuel, mais payé par mois/trimestre. Nexartis ne télédéclare
//     pas.
//   - Alerte TVA seulement si l'entreprise est ENCORE en franchise ; formulée au
//     conditionnel ; distingue seuil de base (37 500 €) et majoré (41 250 €).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { euros } from './commun'
import { Info, ChevronDown, PiggyBank } from 'lucide-react'

interface Params {
  tauxPrestation: number // %
  plafondPrestation: number // €
  seuilTvaBase: number // €
  seuilTvaMajore: number // €
}

const CLE_REPLI = 'nexartis.bandeauUrssaf.ouvert'

/** Arrondi à la dizaine d'euros, sans décimales (évite la fausse précision). */
function eurosArrondi(valeur: number): string {
  const arrondi = Math.round(valeur / 10) * 10
  return `${arrondi.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
}

export default function BandeauUrssaf() {
  const supabase = useMemo(() => createClient(), [])
  const [chargement, setChargement] = useState(true)
  const [caEncaisse, setCaEncaisse] = useState(0)
  const [params, setParams] = useState<Params | null>(null)
  const [enFranchiseTva, setEnFranchiseTva] = useState(true)
  const [ouvert, setOuvert] = useState(false)
  const annee = new Date().getFullYear()

  // État replié/déplié mémorisé (localStorage, sans casser le SSR).
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') setOuvert(window.localStorage.getItem(CLE_REPLI) === '1')
    } catch {
      /* localStorage indisponible : on reste replié */
    }
  }, [])

  const basculer = useCallback(() => {
    setOuvert((prec) => {
      const suivant = !prec
      try {
        if (typeof window !== 'undefined')
          window.localStorage.setItem(CLE_REPLI, suivant ? '1' : '0')
      } catch {
        /* ignore */
      }
      return suivant
    })
  }, [])

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const debut = `${annee}-01-01`
      const finExclue = `${annee + 1}-01-01` // borne haute EXCLUE (paiements datés/timestamp)
      const aujourdhui = new Date().toISOString().slice(0, 10)

      // CA encaissé de l'année (somme des paiements non annulés).
      const { data: paies, error: ePaies } = await supabase
        .from('paiements')
        .select('montant')
        .is('deleted_at', null)
        .gte('date_paiement', debut)
        .lt('date_paiement', finExclue)
      if (ePaies) throw ePaies
      const total = (paies ?? []).reduce(
        (s, p) => s + Number((p as { montant: number }).montant ?? 0),
        0,
      )
      setCaEncaisse(total)

      // L'entreprise est-elle encore en franchise de TVA ? (pour l'alerte TVA)
      const { data: ent } = await supabase
        .from('entreprises')
        .select('franchise_tva')
        .limit(1)
        .maybeSingle()
      // Par défaut on considère « en franchise » (cas micro le plus courant) sauf
      // si explicitement false.
      setEnFranchiseTva((ent as { franchise_tva: boolean | null } | null)?.franchise_tva !== false)

      // Taux & seuils DATÉS valides aujourd'hui.
      const { data: prm, error: ePrm } = await supabase
        .from('parametres_fiscaux')
        .select('code, valeur, date_debut, date_fin')
        .lte('date_debut', aujourdhui)
      if (ePrm) throw ePrm
      const valides = (prm ?? []).filter(
        (r) =>
          !(r as { date_fin: string | null }).date_fin ||
          (r as { date_fin: string }).date_fin >= aujourdhui,
      )
      const val = (code: string): number => {
        const row = valides.find((r) => (r as { code: string }).code === code)
        return row ? Number((row as { valeur: number }).valeur) : 0
      }
      setParams({
        tauxPrestation: val('urssaf_bic_prestation'),
        plafondPrestation: val('micro_plafond_ca_prestation'),
        seuilTvaBase: val('tva_franchise_seuil_base_prestation'),
        seuilTvaMajore: val('tva_franchise_seuil_majore_prestation'),
      })
    } catch (e) {
      console.error('BandeauUrssaf : chargement impossible', e)
      setParams(null)
    } finally {
      setChargement(false)
    }
  }, [supabase, annee])

  useEffect(() => {
    void charger()
  }, [charger])

  if (chargement || !params || caEncaisse <= 0 || params.tauxPrestation <= 0) return null

  const cotisations = caEncaisse * (params.tauxPrestation / 100)
  const pctPlafond =
    params.plafondPrestation > 0 ? Math.min(100, (caEncaisse / params.plafondPrestation) * 100) : 0
  const prochePlafond = pctPlafond >= 80

  // Alerte TVA seulement si ENCORE en franchise. Deux paliers.
  const alerteTvaMajore =
    enFranchiseTva && params.seuilTvaMajore > 0 && caEncaisse > params.seuilTvaMajore
  const alerteTvaBase =
    enFranchiseTva &&
    !alerteTvaMajore &&
    params.seuilTvaBase > 0 &&
    caEncaisse > params.seuilTvaBase

  return (
    <div className="rounded-2xl border border-gold/50 bg-cream mb-5 overflow-hidden">
      {/* Barre repliée — discrète, ton « épargne » */}
      <button
        onClick={basculer}
        aria-expanded={ouvert}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gold/10 transition-colors"
      >
        <span
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <PiggyBank size={16} className="text-orange" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-navy">
            À mettre de côté pour vos cotisations ({annee})
          </span>
          <span className="block text-[11.5px] text-navy/50">Estimation URSSAF · appuyez pour le détail</span>
        </span>
        <span className="font-spline-mono text-[17px] font-bold text-navy whitespace-nowrap">
          ≈ {eurosArrondi(cotisations)}
        </span>
        <ChevronDown
          size={18}
          className={`text-navy/40 flex-shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {ouvert && (
        <div className="px-4 pb-4 pt-1 border-t border-gold/30">
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-navy/50 font-semibold">
                Encaissé en {annee}
              </div>
              <div className="font-spline-mono text-[18px] font-bold text-navy">
                {euros(caEncaisse)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-navy/50 font-semibold">
                Cotisations URSSAF estimées
              </div>
              <div className="font-spline-mono text-[18px] font-bold text-navy">
                ≈ {eurosArrondi(cotisations)}
                <span className="text-[11px] font-normal text-navy/50 ml-1">
                  ({params.tauxPrestation.toLocaleString('fr-FR')} %)
                </span>
              </div>
            </div>
          </div>

          {/* Jauge plafond micro */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11.5px] text-navy/60 mb-1.5">
              <span>Plafond micro-entreprise</span>
              <span className="font-spline-mono">
                {euros(caEncaisse)} / {euros(params.plafondPrestation)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-navy/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${prochePlafond ? 'bg-orange' : 'bg-gold'}`}
                style={{ width: `${pctPlafond}%` }}
                role="progressbar"
                aria-valuenow={Math.round(pctPlafond)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression vers le plafond micro-entreprise"
              />
            </div>
          </div>

          {(prochePlafond || alerteTvaBase || alerteTvaMajore) && (
            <div className="mt-3 space-y-1.5">
              {prochePlafond && (
                <p className="text-[12px] text-orange-700 font-semibold">
                  ⚠️ Vous approchez du plafond micro ({Math.round(pctPlafond)} %) — au-delà, votre régime peut changer.
                </p>
              )}
              {alerteTvaMajore && (
                <p className="text-[12px] text-orange-700 font-semibold">
                  ⚠️ Vous avez dépassé le seuil majoré de franchise de TVA ({euros(params.seuilTvaMajore)}). Vous pourriez devenir redevable de la TVA — contactez votre comptable rapidement.
                </p>
              )}
              {alerteTvaBase && (
                <p className="text-[12px] text-navy/70 font-semibold">
                  ℹ️ Vous avez dépassé le seuil de base de franchise de TVA ({euros(params.seuilTvaBase)}). Tant que vous restez sous {euros(params.seuilTvaMajore)}, votre franchise est en principe maintenue cette année — à surveiller avec votre comptable.
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-1.5 mt-3 text-[11px] text-navy/50 leading-relaxed">
            <Info size={13} className="flex-shrink-0 mt-px" aria-hidden="true" />
            <span>
              Estimation de vos cotisations sociales URSSAF sur l’année (taux prestations de services). Vous les déclarez et payez par mois ou par trimestre. Hors CFP, CFE et versement libératoire de l’impôt. Nexartis prépare vos chiffres mais ne télédéclare pas — ajustez si vous vendez aussi des marchandises sans pose.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
