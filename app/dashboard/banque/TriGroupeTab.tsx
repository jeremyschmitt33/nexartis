'use client'

// ============================================================================
// TriGroupeTab — onglet « À classer » : tri auto V2, 3 sous-onglets.
// ----------------------------------------------------------------------------
// Objectif produit (maquette tri-auto-v2 validée) : l'artisan ne trie JAMAIS
// 60 lignes une par une. On cadre par le travail FAIT, on regroupe par marchand,
// on rend l'auto-classement transparent et réversible.
//
//   • À confirmer  : débits RECONNUS par une règle 1b (a_pointer + categorisation_auto).
//        - avec catégorie suggérée  → « ✦ Suggéré » + choix pré-rempli + Valider les N
//        - sans catégorie (supermarché ambigu) → « ? À vous de dire » : Plutôt pro / perso
//   • À trier      : débits NON reconnus (a_pointer, categorisation_auto=false), groupés.
//   • Déjà classées: débits classés d'office (pointe + categorisation_auto) —
//        tag « Classé auto », POURQUOI (« reconnu → … »), bouton « Changer ».
//
// Garde-fous (gravés) : QUE des débits (montant < 0) — jamais un crédit (enjeu
// URSSAF). JAMAIS auto-pointer « privé ». L'apprentissage d'un marchand ambigu
// crée une SUGGESTION (auto_point=false : « proposé », jamais « classé d'office ») ;
// l'apprentissage d'un marchand distinctif (onglet À trier) classe d'office
// (auto_point=true). Écrit via le client navigateur (RLS : ses opérations seul).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { Loader2, Check, Sparkles, ShieldCheck } from 'lucide-react'
import { montantSigne, MOUVEMENT_COLONNES, type Categorie, type Mouvement } from './commun'
import { extraireMotif } from '@/lib/banque/regles'

type SousOnglet = 'confirmer' | 'trier' | 'classees'

/** Seuil « gros montant » : au-delà, jamais de validation en masse (œil humain). */
const SEUIL_GROS_MONTANT = 300

interface Groupe {
  cle: string
  motifRegle: string | null // motif « propre » pour l'apprentissage (null = non mémorisable)
  libelleAffiche: string
  mouvements: Mouvement[]
  total: number
  /** Catégorie suggérée par la règle 1b (null = marchand binaire pro/perso). */
  categorieSuggeree: string | null
}

export default function TriGroupeTab({
  categories,
  onModifie,
  ongletInitial = 'confirmer',
}: {
  categories: Categorie[]
  /** Appelé après un classement pour rafraîchir les compteurs du module. */
  onModifie: () => void
  /** Sous-onglet ouvert au montage (l'import bascule sur « confirmer »). */
  ongletInitial?: SousOnglet
}) {
  const supabase = useMemo(() => createClient(), [])
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>(ongletInitial)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aConfirmer, setAConfirmer] = useState<Mouvement[]>([])
  const [aTrier, setATrier] = useState<Mouvement[]>([])
  const [classees, setClassees] = useState<Mouvement[]>([])
  const [choix, setChoix] = useState<Record<string, string>>({}) // clé groupe -> categorie_id
  const [enCours, setEnCours] = useState<string | null>(null)

  const categorieParId = useMemo(() => {
    const m = new Map<string, Categorie>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])
  const catPrive = useMemo(() => categories.find((c) => c.code === 'prive') ?? null, [categories])
  const catAutrePro = useMemo(
    () => categories.find((c) => c.code === 'autre_depense') ?? null,
    [categories],
  )

  const charger = useCallback(async () => {
    setErreur(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setAConfirmer([])
        setATrier([])
        setClassees([])
        return
      }
      // Débits en attente (à confirmer + à trier) — jamais de crédit ici.
      const enAttente = supabase
        .from('banque_mouvements')
        .select(MOUVEMENT_COLONNES)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('statut_pointage', 'a_pointer')
        .neq('nature', 'virement_interne')
        .lt('montant', 0)
        .order('date_operation', { ascending: false })
        .limit(2000)
      // Déjà classées d'office (transparence) : pointe + provenance machine.
      const dejaClassees = supabase
        .from('banque_mouvements')
        .select(MOUVEMENT_COLONNES)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('statut_pointage', 'pointe')
        .eq('categorisation_auto', true)
        .lt('montant', 0)
        .order('date_operation', { ascending: false })
        .limit(300)

      const [resAttente, resClassees] = await Promise.all([enAttente, dejaClassees])
      if (resAttente.error) throw resAttente.error
      if (resClassees.error) throw resClassees.error

      const attente = (resAttente.data ?? []) as Mouvement[]
      setAConfirmer(attente.filter((m) => m.categorisation_auto))
      setATrier(attente.filter((m) => !m.categorisation_auto))
      setClassees((resClassees.data ?? []) as Mouvement[])
    } catch (e) {
      console.error('TriGroupe : chargement impossible', e)
      setErreur('Impossible de charger vos opérations. Rechargez la page.')
    } finally {
      setChargement(false)
    }
  }, [supabase])

  useEffect(() => {
    void charger()
  }, [charger])

  // Catégories sélectionnables : dépenses pro + « Privé » (jamais les recettes).
  const categoriesChoix = useMemo(
    () => categories.filter((c) => c.groupe === 'depense' || c.code === 'prive'),
    [categories],
  )

  /** Regroupe une liste de débits par marchand (extraireMotif). */
  const grouper = useCallback((liste: Mouvement[]): Groupe[] => {
    const map = new Map<string, { motifRegle: string | null; mvts: Mouvement[] }>()
    for (const m of liste) {
      const motif = extraireMotif(m.libelle_banque)
      const cle = motif ?? m.libelle_banque.toUpperCase().slice(0, 40)
      const g = map.get(cle)
      if (g) g.mvts.push(m)
      else map.set(cle, { motifRegle: motif, mvts: [m] })
    }
    const list: Groupe[] = []
    // Array.from(...).forEach plutôt que `for...of` sur une Map : le tsconfig du
    // projet (target ES ancien, sans downlevelIteration) l'interdit.
    Array.from(map.entries()).forEach(([cle, { motifRegle, mvts }]) => {
      list.push({
        cle,
        motifRegle,
        libelleAffiche: mvts[0].libelle_perso || mvts[0].libelle_banque,
        mouvements: mvts,
        total: mvts.reduce((s, x) => s + x.montant, 0),
        categorieSuggeree: mvts[0].categorie_id,
      })
    })
    return list.sort((a, b) => b.mouvements.length - a.mouvements.length || a.total - b.total)
  }, [])

  const groupesConfirmer = useMemo(() => grouper(aConfirmer), [aConfirmer, grouper])
  const groupesTrier = useMemo(() => grouper(aTrier), [aTrier, grouper])

  /** Mémorise le classement d'un marchand (best effort). autoPoint = 1a vs 1b. */
  const memoriserRegle = useCallback(
    async (motifRegle: string | null, categorieId: string, autoPoint: boolean) => {
      if (!motifRegle || motifRegle.length < 2) return
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
            .update({
              categorie_id: categorieId,
              sens: 'debit',
              priorite: 100,
              actif: true,
              auto_point: autoPoint,
            })
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
            auto_point: autoPoint,
          })
        }
      } catch (e) {
        console.error('TriGroupe : mémorisation de la règle échouée (sans gravité)', e)
      }
    },
    [supabase],
  )

  /** Écrit le classement en base pour une liste d'ids. */
  const ecrireClassement = useCallback(
    async (ids: string[], categorieId: string, estPrive: boolean, categorisationAuto: boolean) => {
      const { error } = await supabase
        .from('banque_mouvements')
        .update({
          categorie_id: categorieId,
          statut_pointage: 'pointe',
          est_prive: estPrive,
          categorisation_auto: categorisationAuto,
        })
        .in('id', ids)
      if (error) throw error
    },
    [supabase],
  )

  // ── Onglet « À trier » : classer un marchand distinctif (apprend en 1a) ──
  const validerGroupeTrier = useCallback(
    async (g: Groupe) => {
      const categorieId = choix[g.cle]
      if (!categorieId) {
        toast.info('Choisissez d’abord une catégorie pour ce marchand.')
        return
      }
      const cat = categorieParId.get(categorieId)
      const estPrive = cat?.code === 'prive'
      const ids = g.mouvements.map((m) => m.id)
      setEnCours(g.cle)
      try {
        await ecrireClassement(ids, categorieId, estPrive, false)
        // Marchand distinctif classé une fois → retenu et classé d'office ensuite,
        // SAUF si c'est du privé (jamais auto-pointé → règle en suggestion).
        await memoriserRegle(g.motifRegle, categorieId, !estPrive)
        setATrier((p) => p.filter((m) => !ids.includes(m.id)))
        toast.success(
          `${ids.length} opération${ids.length > 1 ? 's' : ''} classée${ids.length > 1 ? 's' : ''} en « ${cat?.label ?? ''} »` +
            (g.motifRegle ? ' · retenu ✓' : ''),
        )
        onModifie()
      } catch (e) {
        console.error('TriGroupe : classement impossible', e)
        toast.error("Le classement n'a pas pu être enregistré. Réessayez.")
      } finally {
        setEnCours(null)
      }
    },
    [choix, categorieParId, ecrireClassement, memoriserRegle, onModifie],
  )

  // ── Onglet « À confirmer » : confirmer une suggestion (avec catégorie) ──
  const confirmerSuggestion = useCallback(
    async (g: Groupe) => {
      const suggere = g.categorieSuggeree
      const categorieId = choix[g.cle] ?? suggere ?? ''
      if (!categorieId) {
        toast.info('Choisissez une catégorie.')
        return
      }
      const inchange = categorieId === suggere
      const cat = categorieParId.get(categorieId)
      const estPrive = cat?.code === 'prive'
      const ids = g.mouvements.map((m) => m.id)
      setEnCours(g.cle)
      try {
        // Confirmé tel quel → on garde la provenance « auto » (tag « Classé auto »).
        // Changé → l'utilisateur s'approprie (categorisation_auto=false) + on apprend.
        await ecrireClassement(ids, categorieId, estPrive, inchange)
        if (!inchange) await memoriserRegle(g.motifRegle, categorieId, !estPrive)
        setAConfirmer((p) => p.filter((m) => !ids.includes(m.id)))
        toast.success(
          `${ids.length} opération${ids.length > 1 ? 's' : ''} classée${ids.length > 1 ? 's' : ''} en « ${cat?.label ?? ''} »`,
        )
        onModifie()
      } catch (e) {
        console.error('TriGroupe : confirmation impossible', e)
        toast.error("La confirmation n'a pas pu être enregistrée. Réessayez.")
      } finally {
        setEnCours(null)
      }
    },
    [choix, categorieParId, ecrireClassement, memoriserRegle, onModifie],
  )

  // ── Onglet « À confirmer » : marchand binaire (supermarché) → pro / perso ──
  const trancherBinaire = useCallback(
    async (g: Groupe, sens: 'pro' | 'perso') => {
      const cat = sens === 'perso' ? catPrive : catAutrePro
      if (!cat) {
        toast.error('Catégorie introuvable. Rechargez la page.')
        return
      }
      const ids = g.mouvements.map((m) => m.id)
      setEnCours(g.cle)
      try {
        await ecrireClassement(ids, cat.id, sens === 'perso', false)
        // On PROPOSE la prochaine fois (jamais « classé d'office » sur un ambigu).
        await memoriserRegle(g.motifRegle, cat.id, false)
        setAConfirmer((p) => p.filter((m) => !ids.includes(m.id)))
        if (g.motifRegle) {
          toast.success(
            `Compris — les prochains « ${g.motifRegle} » vous seront proposés en ${sens === 'perso' ? 'Perso' : 'pro'}.`,
          )
        } else {
          toast.success(`${ids.length} opération${ids.length > 1 ? 's' : ''} classée${ids.length > 1 ? 's' : ''}.`)
        }
        onModifie()
      } catch (e) {
        console.error('TriGroupe : décision binaire impossible', e)
        toast.error("Le classement n'a pas pu être enregistré. Réessayez.")
      } finally {
        setEnCours(null)
      }
    },
    [catPrive, catAutrePro, ecrireClassement, memoriserRegle, onModifie],
  )

  // ── « Valider les suggestions sûres » : lot sécurisé (annulable via Changer) ──
  const suggestionsSures = useMemo(
    () =>
      aConfirmer.filter((m) => {
        if (m.categorie_id === null) return false // binaire (supermarché) → jamais en masse
        if (Math.abs(m.montant) >= SEUIL_GROS_MONTANT) return false // gros montant → œil humain
        const cat = categorieParId.get(m.categorie_id)
        if (!cat) return false
        if (cat.code === 'prive') return false // jamais « privé »
        if (cat.code === 'assurances_pro') return false // pro/perso indiscernable
        return true
      }),
    [aConfirmer, categorieParId],
  )

  const validerSures = useCallback(async () => {
    const ids = suggestionsSures.map((m) => m.id)
    if (ids.length === 0) return
    setEnCours('__sures__')
    try {
      const { error } = await supabase
        .from('banque_mouvements')
        .update({ statut_pointage: 'pointe' }) // categorisation_auto reste true (origine auto)
        .in('id', ids)
      if (error) throw error
      const set = new Set(ids)
      setAConfirmer((p) => p.filter((m) => !set.has(m.id)))
      toast.success(
        `${ids.length} suggestion${ids.length > 1 ? 's' : ''} validée${ids.length > 1 ? 's' : ''} · corrigez d’un clic dans « Déjà classées »`,
      )
      onModifie()
    } catch (e) {
      console.error('TriGroupe : validation en masse impossible', e)
      toast.error("La validation n'a pas pu être enregistrée. Réessayez.")
    } finally {
      setEnCours(null)
    }
  }, [suggestionsSures, supabase, onModifie])

  // ── « Changer » une opération déjà classée (transparence, réversible) ──
  const changerClassee = useCallback(
    async (m: Mouvement, categorieId: string) => {
      const cat = categorieParId.get(categorieId)
      if (!cat) return
      const estPrive = cat.code === 'prive'
      setEnCours(m.id)
      try {
        await ecrireClassement([m.id], categorieId, estPrive, false) // devient un choix humain
        await memoriserRegle(extraireMotif(m.libelle_banque), categorieId, !estPrive)
        setClassees((p) =>
          p.map((x) =>
            x.id === m.id
              ? { ...x, categorie_id: categorieId, est_prive: estPrive, categorisation_auto: false }
              : x,
          ),
        )
        toast.success(`Reclassé en « ${cat.label} » ✓`)
        onModifie()
      } catch (e) {
        console.error('TriGroupe : changement impossible', e)
        toast.error("Le changement n'a pas pu être enregistré. Réessayez.")
      } finally {
        setEnCours(null)
      }
    },
    [categorieParId, ecrireClassement, memoriserRegle, onModifie],
  )

  // ── Rendu ──
  const rienCharge = aConfirmer.length + aTrier.length + classees.length === 0
  if (chargement && rienCharge) {
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

  const onglets: { id: SousOnglet; label: string; n: number }[] = [
    { id: 'confirmer', label: 'À confirmer', n: aConfirmer.length },
    { id: 'trier', label: 'À trier', n: aTrier.length },
    { id: 'classees', label: 'Déjà classées', n: classees.length },
  ]

  return (
    <div className="font-hanken">
      {/* Sous-navigation (segmented control) */}
      <div className="flex items-center gap-1 border-b border-navy/[0.08] mb-5" role="tablist" aria-label="Tri des opérations">
        {onglets.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={sousOnglet === o.id}
            aria-label={`${o.label}, ${o.n} opération${o.n > 1 ? 's' : ''}`}
            onClick={() => setSousOnglet(o.id)}
            className={`relative px-3.5 py-2.5 text-[14px] font-bold transition-colors ${
              sousOnglet === o.id ? 'text-navy' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {o.label}
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] px-1.5 py-px rounded-full bg-navy/[0.08] text-[12px] font-semibold text-navy">
              {o.n}
            </span>
            {sousOnglet === o.id && (
              <span aria-hidden="true" className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-orange" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════ À CONFIRMER ══════════ */}
      {sousOnglet === 'confirmer' &&
        (groupesConfirmer.length === 0 ? (
          <VideOnglet emoji="✓" titre="Rien à confirmer" sous="On ne vous propose rien pour l’instant — tout est net." />
        ) : (
          <div>
            <p className="text-[13px] text-gray-500 mb-4">
              On a reconnu ces marchands mais on ne suppose rien&nbsp;: vous tranchez d’un geste, on retient pour la suite.
            </p>
            <div className="space-y-3">
              {groupesConfirmer.map((g) => {
                const nb = g.mouvements.length
                const enTrain = enCours === g.cle
                const binaire = g.categorieSuggeree === null
                const catSuggeree = g.categorieSuggeree ? categorieParId.get(g.categorieSuggeree) : null
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

                    {binaire ? (
                      <>
                        <div className="flex items-center gap-1.5 mt-3 text-[12.5px] font-bold text-gray-500">
                          ? À vous de dire
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <button
                            onClick={() => trancherBinaire(g, 'pro')}
                            disabled={enTrain}
                            className="min-h-[44px] flex-1 rounded-lg bg-navy px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-navy-mid disabled:opacity-40"
                          >
                            {enTrain ? <Loader2 size={15} className="animate-spin mx-auto" aria-hidden="true" /> : 'Plutôt pro'}
                          </button>
                          <button
                            onClick={() => trancherBinaire(g, 'perso')}
                            disabled={enTrain}
                            className="min-h-[44px] flex-1 rounded-lg border-[1.5px] border-navy/15 bg-cream px-4 text-[13.5px] font-bold text-navy transition hover:border-orange disabled:opacity-40"
                          >
                            Plutôt perso
                          </button>
                        </div>
                        <p className="text-[11.5px] text-gray-400 mt-2.5 leading-relaxed">
                          Un supermarché, c’est ambigu (consommables de chantier ou perso&nbsp;?). On ne suppose rien —
                          vous tranchez. Si vous mettez toujours «&nbsp;perso&nbsp;», on le retiendra.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mt-3 text-[12.5px] font-bold text-navy">
                          <Sparkles size={13} className="text-orange" aria-hidden="true" /> Suggéré
                          {catSuggeree ? <span className="text-gray-500 font-semibold">· {catSuggeree.label}</span> : null}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <select
                            value={choix[g.cle] ?? g.categorieSuggeree ?? ''}
                            onChange={(e) => setChoix((p) => ({ ...p, [g.cle]: e.target.value }))}
                            className="min-h-[44px] flex-1 min-w-[170px] rounded-lg border border-navy/15 bg-white px-3 text-[13.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange/40"
                            aria-label={`Catégorie pour ${g.libelleAffiche}`}
                          >
                            {categoriesChoix.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => confirmerSuggestion(g)}
                            disabled={enTrain}
                            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-navy-mid disabled:opacity-40"
                          >
                            {enTrain ? (
                              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Check size={15} aria-hidden="true" />
                            )}
                            Valider {nb > 1 ? `les ${nb}` : ''}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )
              })}
            </div>

            {suggestionsSures.length > 0 && (
              <div className="text-center mt-5">
                <button
                  onClick={validerSures}
                  disabled={enCours === '__sures__'}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy/[0.08] px-5 py-2.5 text-[13.5px] font-bold text-navy hover:bg-navy/[0.14] transition disabled:opacity-50"
                >
                  {enCours === '__sures__' ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={15} aria-hidden="true" />
                  )}
                  Valider les {suggestionsSures.length} suggestion{suggestionsSures.length > 1 ? 's' : ''} sûre
                  {suggestionsSures.length > 1 ? 's' : ''} (annulable)
                </button>
                <p className="text-[11.5px] text-gray-400 mt-2 max-w-md mx-auto">
                  Ne touche jamais le «&nbsp;perso&nbsp;», les assurances, les gros montants (≥&nbsp;{SEUIL_GROS_MONTANT}&nbsp;€)
                  ni les supermarchés — ceux-là se confirment toujours à la main. Tout reste corrigeable dans «&nbsp;Déjà classées&nbsp;».
                </p>
              </div>
            )}
          </div>
        ))}

      {/* ══════════ À TRIER ══════════ */}
      {sousOnglet === 'trier' &&
        (groupesTrier.length === 0 ? (
          <VideOnglet emoji="🎉" titre="Tout est trié !" sous="Aucune dépense inconnue en attente." />
        ) : (
          <div>
            <p className="text-[13px] text-gray-500 mb-4">
              {aTrier.length} dépense{aTrier.length > 1 ? 's' : ''} qu’on ne connaît pas encore, regroupée
              {aTrier.length > 1 ? 's' : ''} par marchand. Classez-en un → tout le groupe est réglé, et retenu.
            </p>
            <div className="space-y-3">
              {groupesTrier.map((g) => {
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
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <select
                        value={choix[g.cle] ?? ''}
                        onChange={(e) => setChoix((p) => ({ ...p, [g.cle]: e.target.value }))}
                        className="min-h-[44px] flex-1 min-w-[170px] rounded-lg border border-navy/15 bg-white px-3 text-[13.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange/40"
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
                        onClick={() => validerGroupeTrier(g)}
                        disabled={enTrain || !choix[g.cle]}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-navy-mid disabled:opacity-40 disabled:cursor-not-allowed"
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
                        Sera retenu pour les prochains «&nbsp;{g.motifRegle}&nbsp;».
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
            <p className="mt-6 text-[11.5px] text-gray-400 leading-relaxed">
              Les virements reçus (recettes) ne sont jamais ici&nbsp;: ils se rapprochent d’une facture depuis l’onglet
              Opérations, car ils touchent votre déclaration URSSAF.
            </p>
          </div>
        ))}

      {/* ══════════ DÉJÀ CLASSÉES (transparence) ══════════ */}
      {sousOnglet === 'classees' &&
        (classees.length === 0 ? (
          <VideOnglet emoji="🗂️" titre="Rien de classé automatiquement" sous="Dès votre prochain import, les marchands reconnus apparaîtront ici." />
        ) : (
          <div>
            <p className="text-[13px] text-gray-500 mb-4">
              Rien à faire ici&nbsp;: on montre juste ce qu’on a reconnu tout seul. Tout est corrigeable en un geste.
            </p>
            <div className="space-y-2">
              {classees.map((m) => {
                const cat = m.categorie_id ? categorieParId.get(m.categorie_id) : null
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy/[0.08] bg-white px-4 py-3 flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[14px] text-navy truncate">
                        {m.libelle_perso || m.libelle_banque}
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        {m.categorisation_auto ? 'reconnu' : 'modifié'} → {cat?.label ?? 'Sans catégorie'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {m.categorisation_auto && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          Classé auto
                        </span>
                      )}
                      <span className="font-spline-mono text-[14px] text-navy whitespace-nowrap">
                        {montantSigne(m.montant)}
                      </span>
                      <select
                        value={m.categorie_id ?? ''}
                        onChange={(e) => changerClassee(m, e.target.value)}
                        disabled={enCours === m.id}
                        className="min-h-[40px] rounded-lg border border-navy/15 bg-white px-2 text-[12.5px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-orange/40 disabled:opacity-50"
                        aria-label={`Changer la catégorie de ${m.libelle_perso || m.libelle_banque}`}
                      >
                        {categoriesChoix.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}

function VideOnglet({ emoji, titre, sous }: { emoji: string; titre: string; sous: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3" aria-hidden="true">
        {emoji}
      </div>
      <p className="text-[16px] font-bold text-navy">{titre}</p>
      <p className="text-[13px] text-gray-500 mt-1">{sous}</p>
    </div>
  )
}
