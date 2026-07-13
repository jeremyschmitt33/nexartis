'use client'

// ============================================================================
// TriGroupeTab — onglet « Trier » : tri groupé PAR MARCHAND (chantier 4).
// ----------------------------------------------------------------------------
// Objectif produit (validé UX + fondateur) : ne pas trier 60 lignes une par une.
// On regroupe les débits « à trier » par marchand (via extraireMotif, la même
// heuristique que l'apprentissage Lot 2c) ; l'artisan classe UN marchand → tout
// le groupe est réglé d'un coup, et le choix est MÉMORISÉ (règle apprise) pour
// les prochains imports.
//
// Garde-fous : ne concerne QUE les débits (montant < 0) ; les crédits/recettes
// ne sont jamais ici (jamais auto-classés en recette — enjeu URSSAF). La
// catégorie « privé » pose est_prive = true (sort des totaux pro). Écrit via le
// client navigateur (RLS : l'utilisateur ne voit/écrit que ses opérations).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { montantSigne, MOUVEMENT_COLONNES, type Categorie, type Mouvement } from './commun'
import { extraireMotif } from '@/lib/banque/regles'

interface Groupe {
  cle: string // clé de regroupement affichée
  motifRegle: string | null // motif « propre » pour l'apprentissage (null = non mémorisable)
  libelleAffiche: string
  mouvements: Mouvement[]
  total: number
}

export default function TriGroupeTab({
  categories,
  onModifie,
}: {
  categories: Categorie[]
  /** Appelé après un classement pour rafraîchir les compteurs du module. */
  onModifie: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aTrier, setATrier] = useState<Mouvement[]>([])
  const [choix, setChoix] = useState<Record<string, string>>({}) // clé groupe -> categorie_id
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setATrier([])
        return
      }
      const { data, error } = await supabase
        .from('banque_mouvements')
        .select(MOUVEMENT_COLONNES)
        .eq('user_id', user.id) // jamais les mouvements d'un autre membre de l'entreprise
        .is('deleted_at', null)
        .eq('statut_pointage', 'a_pointer')
        .neq('nature', 'virement_interne') // un virement interne n'est pas une dépense à classer
        .lt('montant', 0)
        .order('date_operation', { ascending: false })
        .limit(2000)
      if (error) throw error
      setATrier((data ?? []) as Mouvement[])
    } catch (e) {
      console.error('TriGroupe : chargement impossible', e)
      setErreur('Impossible de charger les opérations à trier. Rechargez la page.')
    } finally {
      setChargement(false)
    }
  }, [supabase])

  useEffect(() => {
    void charger()
  }, [charger])

  // Catégories sélectionnables : dépenses pro + « Privé ». On exclut les recettes
  // (jamais ici) et les autres neutres (apport/virement interne → flux détaillé).
  const categoriesChoix = useMemo(
    () => categories.filter((c) => c.groupe === 'depense' || c.code === 'prive'),
    [categories],
  )

  const groupes = useMemo<Groupe[]>(() => {
    const map = new Map<string, { motifRegle: string | null; mvts: Mouvement[] }>()
    for (const m of aTrier) {
      const motif = extraireMotif(m.libelle_banque)
      const cle = motif ?? m.libelle_banque.toUpperCase().slice(0, 40)
      const g = map.get(cle)
      if (g) g.mvts.push(m)
      else map.set(cle, { motifRegle: motif, mvts: [m] })
    }
    const list: Groupe[] = []
    for (const [cle, { motifRegle, mvts }] of map) {
      list.push({
        cle,
        motifRegle,
        libelleAffiche: mvts[0].libelle_perso || mvts[0].libelle_banque,
        mouvements: mvts,
        total: mvts.reduce((s, x) => s + x.montant, 0),
      })
    }
    // Trier par volume décroissant : on débloque le plus gros d'abord.
    return list.sort(
      (a, b) => b.mouvements.length - a.mouvements.length || a.total - b.total,
    )
  }, [aTrier])

  /** Mémorise le classement d'un marchand pour les prochains imports (best effort). */
  const memoriserRegle = useCallback(
    async (motifRegle: string | null, categorieId: string) => {
      if (!motifRegle || motifRegle.length < 2) return // pas de motif propre → on n'apprend pas
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const { data: existante } = await supabase
          .from('categorisation_regles')
          .select('id')
          .eq('user_id', user.id)
          .eq('pattern', motifRegle)
          .eq('source', 'apprise')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
        if (existante) {
          await supabase
            .from('categorisation_regles')
            .update({ categorie_id: categorieId, sens: 'debit', priorite: 100, actif: true })
            .eq('id', existante.id)
        } else {
          await supabase.from('categorisation_regles').insert({
            user_id: user.id,
            pattern: motifRegle,
            type_match: 'contient',
            categorie_id: categorieId,
            sens: 'debit',
            priorite: 100,
            source: 'apprise',
          })
        }
      } catch (e) {
        console.error('TriGroupe : mémorisation de la règle échouée (sans gravité)', e)
      }
    },
    [supabase],
  )

  const validerGroupe = useCallback(
    async (g: Groupe) => {
      const categorieId = choix[g.cle]
      if (!categorieId) {
        toast.info('Choisissez d’abord une catégorie pour ce marchand.')
        return
      }
      const cat = categories.find((c) => c.id === categorieId)
      const estPrive = cat?.code === 'prive'
      const ids = g.mouvements.map((m) => m.id)
      setEnCours(g.cle)
      try {
        const { error } = await supabase
          .from('banque_mouvements')
          .update({ categorie_id: categorieId, statut_pointage: 'pointe', est_prive: estPrive })
          .in('id', ids)
        if (error) throw error

        // Mémoriser pour les prochains imports (ta vision : classer une fois → retenu).
        await memoriserRegle(g.motifRegle, categorieId)

        setATrier((prec) => prec.filter((m) => !ids.includes(m.id)))
        toast.success(
          `${ids.length} opération${ids.length > 1 ? 's' : ''} classée${ids.length > 1 ? 's' : ''} en « ${cat?.label ?? ''} »` +
            (g.motifRegle ? ' · mémorisé ✓' : ''),
        )
        onModifie()
      } catch (e) {
        console.error('TriGroupe : classement impossible', e)
        toast.error("Le classement n'a pas pu être enregistré. Réessayez.")
      } finally {
        setEnCours(null)
      }
    },
    [choix, categories, supabase, memoriserRegle, onModifie],
  )

  // ── Rendu ──
  if (chargement) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400" role="status" aria-live="polite">
        <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
        <span className="text-sm font-semibold">Regroupement de vos opérations…</span>
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-800" role="alert">
        {erreur}
      </div>
    )
  }

  if (aTrier.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3" aria-hidden="true">🎉</div>
        <p className="text-[16px] font-bold text-navy">Tout est trié !</p>
        <p className="text-[13px] text-gray-500 mt-1">Aucune dépense en attente. Vos comptes sont à jour.</p>
      </div>
    )
  }

  return (
    <div className="font-hanken">
      <div className="mb-5">
        <h2 className="text-[17px] font-bold text-navy">
          {aTrier.length} dépense{aTrier.length > 1 ? 's' : ''} à trier, regroupée{aTrier.length > 1 ? 's' : ''} en {groupes.length} marchand{groupes.length > 1 ? 's' : ''}
        </h2>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Classez un marchand → tout le groupe est réglé d’un coup, et retenu pour la prochaine fois.
        </p>
      </div>

      <div className="space-y-3">
        {groupes.map((g) => {
          const nb = g.mouvements.length
          const enTrain = enCours === g.cle
          return (
            <section key={g.cle} className="rounded-2xl border border-navy/10 bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-extrabold text-[15.5px] text-navy truncate">{g.libelleAffiche}</div>
                  <div className="text-[12.5px] text-gray-500 mt-0.5">
                    {nb} opération{nb > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="font-spline-mono font-semibold text-[15px] text-navy whitespace-nowrap">
                  {montantSigne(g.total)}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <select
                  value={choix[g.cle] ?? ''}
                  onChange={(e) => setChoix((prec) => ({ ...prec, [g.cle]: e.target.value }))}
                  className="flex-1 min-w-[170px] rounded-lg border border-navy/15 bg-white px-3 py-2.5 font-hanken text-[13.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange/40"
                  aria-label={`Catégorie pour ${g.libelleAffiche}`}
                >
                  <option value="" disabled>
                    Choisir une catégorie…
                  </option>
                  {categoriesChoix.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => validerGroupe(g)}
                  disabled={enTrain || !choix[g.cle]}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enTrain ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check size={15} aria-hidden="true" />
                  )}
                  Valider {nb > 1 ? `les ${nb}` : ''}
                </button>
              </div>

              {g.motifRegle && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-gray-400 mt-2.5">
                  <Sparkles size={12} className="text-orange" aria-hidden="true" />
                  Sera retenu pour les prochains « {g.motifRegle} ».
                </div>
              )}
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-[11.5px] text-gray-400 leading-relaxed">
        Astuce : un supermarché ou Amazon peuvent être pro (consommables) ou perso — à vous de trancher.
        Pour lier une dépense à un chantier précis, utilisez le tri détaillé « une par une » depuis l’onglet Opérations.
        Les virements reçus (recettes) ne sont jamais ici : ils se rapprochent d’une facture, car ils touchent votre déclaration URSSAF.
      </p>
    </div>
  )
}
