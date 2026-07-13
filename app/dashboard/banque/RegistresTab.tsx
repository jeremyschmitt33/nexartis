'use client'

// ============================================================================
// RegistresTab — onglet « Registres » du module Dépenses & Banque.
// ----------------------------------------------------------------------------
// Génère les deux registres légaux du micro-entrepreneur en PDF, calculés
// depuis les pointages (décision SPEC §7) :
//   - Livre des recettes  (depuis paiements + factures) — obligatoire.
//   - Registre des achats (depuis achats, sur date_reglement) — utile.
// Le moteur PDF vit dans lib/export/pdf-registres.ts (généré côté navigateur).
// Données chargées en requêtes séparées (pas d'embed PostgREST) pour la
// robustesse. RLS : chaque table est filtrée par l'utilisateur courant.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { FileText, Download, Loader2, ShoppingBag } from 'lucide-react'
import { euros } from './commun'
import {
  downloadLivreRecettesPdf,
  downloadRegistreAchatsPdf,
  type EntrepriseIdentite,
  type RecetteRow,
  type AchatRegistreRow,
} from '@/lib/export/pdf-registres'

const ANNEE_COURANTE = new Date().getFullYear()

export default function RegistresTab() {
  const supabase = useMemo(() => createClient(), [])
  const [annee, setAnnee] = useState(ANNEE_COURANTE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [entreprise, setEntreprise] = useState<EntrepriseIdentite>({})
  const [recettes, setRecettes] = useState<RecetteRow[]>([])
  const [achats, setAchats] = useState<AchatRegistreRow[]>([])

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const debut = `${annee}-01-01`
      const fin = `${annee}-12-31`

      // Identité entreprise (RLS → la sienne).
      const { data: ent } = await supabase
        .from('entreprises')
        .select('nom, siret, adresse, code_postal, ville, forme_juridique, regime_fiscal')
        .limit(1)
        .maybeSingle()
      setEntreprise((ent ?? {}) as EntrepriseIdentite)

      // ── Recettes = encaissements (paiements) de l'année ──
      const { data: paies, error: ePaies } = await supabase
        .from('paiements')
        .select('montant, date_paiement, methode, facture_id')
        .is('deleted_at', null)
        .gte('date_paiement', debut)
        .lte('date_paiement', fin)
        .order('date_paiement', { ascending: true })
      if (ePaies) throw ePaies
      const paiements = (paies ?? []) as Array<{
        montant: number
        date_paiement: string
        methode: string | null
        facture_id: string | null
      }>

      // Factures liées : référence + client + objet (nature).
      const factIds = Array.from(
        new Set(paiements.map((p) => p.facture_id).filter(Boolean)),
      ) as string[]
      const factMap = new Map<
        string,
        { numero: string | null; client_nom: string | null; objet: string | null }
      >()
      if (factIds.length > 0) {
        const { data: facts, error: eFacts } = await supabase
          .from('factures')
          .select('id, numero, client_nom, objet')
          .in('id', factIds)
        if (eFacts) throw eFacts
        for (const f of (facts ?? []) as Array<{
          id: string
          numero: string | null
          client_nom: string | null
          objet: string | null
        }>) {
          factMap.set(f.id, { numero: f.numero, client_nom: f.client_nom, objet: f.objet })
        }
      }
      setRecettes(
        paiements.map((p) => {
          const f = p.facture_id ? factMap.get(p.facture_id) : undefined
          return {
            date_paiement: p.date_paiement,
            methode: p.methode,
            montant: p.montant,
            facture_numero: f?.numero ?? null,
            client_nom: f?.client_nom ?? null,
            objet: f?.objet ?? null,
          }
        }),
      )

      // ── Achats de l'année (sur date_reglement = décaissement) ──
      const { data: achRaw, error: eAch } = await supabase
        .from('achats')
        .select(
          'date_reglement, montant_ttc, moyen_paiement, justificatif_url, description, fournisseur_id, fournisseur_libre',
        )
        .is('deleted_at', null)
        .gte('date_reglement', debut)
        .lte('date_reglement', fin)
        .order('date_reglement', { ascending: true })
      if (eAch) throw eAch
      const ach = (achRaw ?? []) as Array<{
        date_reglement: string | null
        montant_ttc: number | null
        moyen_paiement: string | null
        justificatif_url: string | null
        description: string | null
        fournisseur_id: string | null
        fournisseur_libre: string | null
      }>

      const fourIds = Array.from(
        new Set(ach.map((a) => a.fournisseur_id).filter(Boolean)),
      ) as string[]
      const fourMap = new Map<string, string>()
      if (fourIds.length > 0) {
        const { data: fours, error: eFours } = await supabase
          .from('fournisseurs')
          .select('id, nom')
          .in('id', fourIds)
        if (eFours) throw eFours
        for (const f of (fours ?? []) as Array<{ id: string; nom: string | null }>) {
          fourMap.set(f.id, f.nom ?? '')
        }
      }
      setAchats(
        ach.map((a) => ({
          date_reglement: a.date_reglement,
          fournisseur: a.fournisseur_id
            ? fourMap.get(a.fournisseur_id) ?? a.fournisseur_libre ?? ''
            : a.fournisseur_libre ?? '',
          reference: a.justificatif_url ? 'Justificatif joint' : a.description ?? '',
          moyen_paiement: a.moyen_paiement,
          montant_ttc: a.montant_ttc,
        })),
      )
    } catch (e) {
      console.error('Registres : chargement impossible', e)
      setErreur('Impossible de charger les données des registres. Rechargez la page.')
    } finally {
      setChargement(false)
    }
  }, [supabase, annee])

  useEffect(() => {
    void charger()
  }, [charger])

  const totalRecettes = useMemo(
    () => recettes.reduce((s, r) => s + Number(r.montant ?? 0), 0),
    [recettes],
  )
  const totalAchats = useMemo(
    () => achats.reduce((s, a) => s + Number(a.montant_ttc ?? 0), 0),
    [achats],
  )

  const annees = useMemo(() => {
    const arr: number[] = []
    for (let y = ANNEE_COURANTE; y >= ANNEE_COURANTE - 4; y--) arr.push(y)
    return arr
  }, [])

  const telechargerRecettes = () => {
    try {
      downloadLivreRecettesPdf({ entreprise, annee, recettes, nbSansDate: 0 })
    } catch (e) {
      console.error('PDF livre des recettes', e)
      toast.error('La génération du PDF a échoué. Réessayez.')
    }
  }
  const telechargerAchats = () => {
    try {
      downloadRegistreAchatsPdf({ entreprise, annee, achats })
    } catch (e) {
      console.error('PDF registre des achats', e)
      toast.error('La génération du PDF a échoué. Réessayez.')
    }
  }

  return (
    <div className="font-hanken">
      {/* En-tête + sélecteur d'année */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[17px] font-bold text-navy">Registres légaux</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Générés automatiquement depuis vos encaissements et vos achats pointés.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-navy">
          Année
          <select
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 font-spline-mono text-[13px] text-navy focus:outline-none focus:ring-2 focus:ring-orange/40"
            aria-label="Année du registre"
          >
            {annees.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erreur && (
        <div
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-[13px] text-red-800"
          role="alert"
        >
          {erreur}
        </div>
      )}

      {chargement ? (
        <div
          className="flex items-center justify-center py-20 text-gray-400"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm font-semibold">Préparation de vos registres…</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Livre des recettes */}
          <section className="rounded-2xl border border-navy/10 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-orange" aria-hidden="true" />
              <h3 className="text-[15px] font-bold text-navy">Livre des recettes</h3>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-4">
              Obligatoire. Vos encaissements {annee}, avec distinction des espèces.
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-spline-mono text-[22px] font-bold text-navy">
                {euros(totalRecettes)}
              </span>
              <span className="text-[12px] text-gray-500">
                · {recettes.length} encaissement{recettes.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={telechargerRecettes}
              disabled={recettes.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} aria-hidden="true" />
              Télécharger le PDF
            </button>
            {recettes.length === 0 && (
              <p className="mt-2 text-[12px] text-gray-400">Aucun encaissement sur {annee}.</p>
            )}
          </section>

          {/* Registre des achats */}
          <section className="rounded-2xl border border-navy/10 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag size={18} className="text-orange" aria-hidden="true" />
              <h3 className="text-[15px] font-bold text-navy">Registre des achats</h3>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-4">
              Vos achats {annee} par date de règlement. Obligatoire pour la vente de marchandises.
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-spline-mono text-[22px] font-bold text-navy">
                {euros(totalAchats)}
              </span>
              <span className="text-[12px] text-gray-500">
                · {achats.length} achat{achats.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={telechargerAchats}
              disabled={achats.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} aria-hidden="true" />
              Télécharger le PDF
            </button>
            {achats.length === 0 && (
              <p className="mt-2 text-[12px] text-gray-400">Aucun achat sur {annee}.</p>
            )}
          </section>
        </div>
      )}

      <p className="mt-5 text-[11.5px] text-gray-400 leading-relaxed">
        Ces documents sont établis à partir de vos données saisies. Nexartis calcule et prépare, mais
        ne se substitue pas à un expert-comptable. À conserver 10 ans.
      </p>
    </div>
  )
}
