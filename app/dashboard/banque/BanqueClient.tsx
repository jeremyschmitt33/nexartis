'use client'

// ============================================================================
// BanqueClient — contenu de l'onglet « Dépenses & Banque » (Lot 2a + 2b)
// ----------------------------------------------------------------------------
// Périmètre V1 validé par jeremy (SPEC §6) :
//   - Opérations = l'argent qui bouge (banque + caisse) UNIQUEMENT,
//   - AUCUN solde bancaire affiché (décision C5) — le solde de CAISSE, lui,
//     est affiché dans l'onglet Caisse (seule exception autorisée),
//   - pas de chantier sur les mouvements (décision n°3) : le rattachement
//     passe par l'achat créé au pointage (mouvement → achat → chantier),
//   - les dépenses saisies à la main → onglet Achats.
// Lot 2b : pointage complet (PanneauPointage, file enchaînée), justificatifs,
// transformation débit → achat, rapprochement crédit → facture (RPC),
// onglet Caisse (CaisseTab) et onglet Par chantier (ParChantierTab).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import CompteModal from './CompteModal'
import ImportReleveModal from './ImportReleveModal'
import AideReleveModal from './AideReleveModal'
import PanneauPointage from './PanneauPointage'
import CaisseTab from './CaisseTab'
import ParChantierTab from './ParChantierTab'
import {
  euros,
  grouperParMois,
  libelleMois,
  LigneOperation,
  MOUVEMENT_COLONNES,
  type Categorie,
  type CompteTresorerie,
  type Mouvement,
} from './commun'
import {
  ArrowDownToLine,
  Camera,
  Check,
  PencilLine,
  Search,
  Plus,
  Loader2,
} from 'lucide-react'

export type { CompteTresorerie } from './commun'
export { euros } from './commun'

type Periode = 'mois' | 'dernier' | '3mois' | 'annee'
type Onglet = 'operations' | 'caisse' | 'chantiers'

function bornesPeriode(periode: Periode): { debut: string; fin: string | null } {
  const maintenant = new Date()
  const a = maintenant.getFullYear()
  const m = maintenant.getMonth()
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  switch (periode) {
    case 'mois':
      return { debut: iso(new Date(a, m, 1)), fin: null }
    case 'dernier':
      return { debut: iso(new Date(a, m - 1, 1)), fin: iso(new Date(a, m, 0)) }
    case '3mois':
      return { debut: iso(new Date(a, m - 2, 1)), fin: null }
    case 'annee':
      return { debut: iso(new Date(a, 0, 1)), fin: null }
  }
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function BanqueClient() {
  const supabase = useMemo(() => createClient(), [])

  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)
  const [comptes, setComptes] = useState<CompteTresorerie[]>([])
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [categories, setCategories] = useState<Map<string, Categorie>>(new Map())
  const [franchiseTva, setFranchiseTva] = useState(false)

  const [onglet, setOnglet] = useState<Onglet>('operations')
  const [periode, setPeriode] = useState<Periode>('3mois')
  const [recherche, setRecherche] = useState('')
  const [compteFiltre, setCompteFiltre] = useState<string>('tous')

  const [importOuvert, setImportOuvert] = useState(false)
  const [compteModal, setCompteModal] = useState<{ type: 'bancaire' | 'caisse' } | null>(null)
  const [aideOuverte, setAideOuverte] = useState(false)

  // ── File de tri (pointage enchaîné) ──
  // file = snapshots des mouvements à trier, dans l'ordre ; [0] = le courant.
  const [panneau, setPanneau] = useState<{ file: Mouvement[]; modeFile: boolean } | null>(null)
  const [finTri, setFinTri] = useState(false)
  // Incrémenté après chaque pointage : CaisseTab recharge sa liste.
  const [rafraichirCaisse, setRafraichirCaisse] = useState(0)

  // ── Chargement des données ──
  const chargerDonnees = useCallback(async () => {
    setChargement(true)
    setErreurChargement(null)
    try {
      const bornes = bornesPeriode(periode)

      const [resComptes, resCategories, resEntreprise] = await Promise.all([
        supabase
          .from('comptes_tresorerie')
          .select('id, nom, type, banque_nom, iban_masque, solde_initial, solde_initial_date')
          .is('deleted_at', null)
          .eq('actif', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('depense_categories')
          .select('id, code, label, groupe')
          .is('deleted_at', null)
          .eq('actif', true)
          .order('ordre', { ascending: true }),
        supabase.from('entreprises').select('franchise_tva').limit(1).maybeSingle(),
      ])
      if (resComptes.error) throw resComptes.error
      if (resCategories.error) throw resCategories.error

      let requete = supabase
        .from('banque_mouvements')
        .select(MOUVEMENT_COLONNES)
        .is('deleted_at', null)
        .gte('date_operation', bornes.debut)
        .order('date_operation', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000)
      if (bornes.fin) requete = requete.lte('date_operation', bornes.fin)
      const resMouvements = await requete
      if (resMouvements.error) throw resMouvements.error

      setComptes(
        ((resComptes.data ?? []) as (CompteTresorerie & { solde_initial: unknown })[]).map((c) => ({
          ...c,
          solde_initial: Number(c.solde_initial ?? 0),
        })),
      )
      setMouvements((resMouvements.data ?? []) as Mouvement[])
      const mapCategories = new Map<string, Categorie>()
      for (const c of (resCategories.data ?? []) as Categorie[]) mapCategories.set(c.id, c)
      setCategories(mapCategories)
      setFranchiseTva(Boolean((resEntreprise.data as { franchise_tva?: boolean } | null)?.franchise_tva))
    } catch (e) {
      console.error('Chargement Dépenses & Banque impossible', e)
      setErreurChargement('Impossible de charger vos opérations. Rechargez la page.')
    } finally {
      setChargement(false)
    }
  }, [supabase, periode])

  useEffect(() => {
    void chargerDonnees()
  }, [chargerDonnees])

  // ── Données dérivées ──
  const comptesCaisse = useMemo(
    () => new Set(comptes.filter((c) => c.type === 'caisse').map((c) => c.id)),
    [comptes],
  )
  const compteCaisse = useMemo(() => comptes.find((c) => c.type === 'caisse') ?? null, [comptes])
  const categoriesListe = useMemo(() => Array.from(categories.values()), [categories])

  const mouvementsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return mouvements.filter((m) => {
      if (compteFiltre !== 'tous' && m.compte_id !== compteFiltre) return false
      if (!terme) return true
      const categorie = m.categorie_id ? categories.get(m.categorie_id) : undefined
      const texte = `${m.libelle_perso ?? ''} ${m.libelle_banque} ${categorie?.label ?? ''}`.toLowerCase()
      return texte.includes(terme)
    })
  }, [mouvements, compteFiltre, recherche, categories])

  const parMois = useMemo(() => grouperParMois(mouvementsFiltres), [mouvementsFiltres])

  // Entrées / Sorties de la période : les virements internes et le perso
  // sont EXCLUS (maquette : « Mouvement interne — exclu des Entrées/Sorties »).
  const totaux = useMemo(() => {
    let entrees = 0
    let sorties = 0
    let aTrier = 0
    for (const m of mouvementsFiltres) {
      if (m.statut_pointage === 'a_pointer' && !m.est_prive) aTrier++
      if (m.nature === 'virement_interne' || m.est_prive) continue
      if (m.montant > 0) entrees += m.montant
      else sorties += -m.montant
    }
    return { entrees, sorties, aTrier }
  }, [mouvementsFiltres])

  const dateDernierMouvement = useMemo(() => {
    let max: string | null = null
    for (const m of mouvements) {
      if (!max || m.date_operation > max) max = m.date_operation
    }
    return max
  }, [mouvements])

  const aucuneDonnee = !chargement && mouvements.length === 0 && recherche === '' && compteFiltre === 'tous'

  // ── File de tri ──
  const remplacerMouvement = useCallback((maj: Mouvement) => {
    setMouvements((prec) => {
      const existe = prec.some((m) => m.id === maj.id)
      return existe ? prec.map((m) => (m.id === maj.id ? maj : m)) : prec
    })
  }, [])

  const ouvrirMouvement = useCallback(
    (m: Mouvement) => {
      setFinTri(false)
      if (m.statut_pointage === 'a_pointer') {
        // La cliquée passe en tête de file, les autres « à trier » suivent.
        const autres = mouvementsFiltres.filter(
          (x) => x.id !== m.id && x.statut_pointage === 'a_pointer' && !x.est_prive,
        )
        setPanneau({ file: [m, ...autres], modeFile: true })
      } else {
        setPanneau({ file: [m], modeFile: false })
      }
    },
    [mouvementsFiltres],
  )

  const ouvrirFile = useCallback(() => {
    const aTrier = mouvementsFiltres.filter((m) => m.statut_pointage === 'a_pointer' && !m.est_prive)
    if (aTrier.length === 0) {
      toast.info('Tout est déjà trié ✓')
      return
    }
    setFinTri(false)
    setPanneau({ file: aTrier, modeFile: true })
  }, [mouvementsFiltres])

  const surPointe = useCallback(
    (maj: Mouvement) => {
      remplacerMouvement(maj)
      setRafraichirCaisse((n) => n + 1)
      setPanneau((prec) => {
        if (!prec) return null
        const reste = prec.file.slice(1)
        if (reste.length === 0) {
          if (prec.modeFile) setFinTri(true)
          return null
        }
        return { ...prec, file: reste }
      })
    },
    [remplacerMouvement],
  )

  const surMaj = useCallback(
    (maj: Mouvement) => {
      remplacerMouvement(maj)
      setPanneau((prec) => {
        if (!prec) return prec
        return { ...prec, file: [maj, ...prec.file.slice(1)] }
      })
    },
    [remplacerMouvement],
  )

  const surPasser = useCallback(() => {
    setPanneau((prec) => {
      if (!prec) return prec
      if (prec.file.length <= 1) {
        toast.info('Il ne reste que celle-ci — autant la trier maintenant 😉')
        return prec
      }
      const [tete, ...reste] = prec.file
      return { ...prec, file: [...reste, tete] }
    })
  }, [])

  const fermerPanneau = useCallback(() => {
    setPanneau(null)
    setFinTri(false)
  }, [])

  /** Après déclaration d'un mouvement de caisse : il rejoint la liste et part au tri. */
  const surMouvementCaisseDeclare = useCallback((m: Mouvement) => {
    setMouvements((prec) => {
      const liste = [m, ...prec]
      liste.sort((a, b) =>
        a.date_operation === b.date_operation ? 0 : a.date_operation < b.date_operation ? 1 : -1,
      )
      return liste
    })
    setFinTri(false)
    setPanneau({ file: [m], modeFile: true })
  }, [])

  const mouvementCourant = panneau?.file[0] ?? null

  // ── Rendu ──
  return (
    <div className="max-w-5xl mx-auto">
      {/* Sous-onglets */}
      <div
        className="flex items-center gap-1 border-b border-navy/[0.08] mb-6"
        role="tablist"
        aria-label="Sections Dépenses et Banque"
      >
        {(
          [
            { id: 'operations', label: 'Opérations' },
            { id: 'caisse', label: 'Caisse' },
            { id: 'chantiers', label: 'Par chantier' },
          ] as { id: Onglet; label: string }[]
        ).map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`relative px-4 py-2.5 text-[14px] font-semibold transition-colors ${
              onglet === o.id ? 'text-navy' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {o.label}
            {onglet === o.id && (
              <span
                aria-hidden="true"
                className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-orange"
              />
            )}
          </button>
        ))}
      </div>

      {erreurChargement && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-[13px] text-red-800" role="alert">
          {erreurChargement}
        </div>
      )}

      {onglet === 'caisse' ? (
        <CaisseTab
          compteCaisse={compteCaisse}
          categories={categories}
          onCreerCaisse={() => setCompteModal({ type: 'caisse' })}
          onOuvrirMouvement={ouvrirMouvement}
          onMouvementDeclare={surMouvementCaisseDeclare}
          rafraichir={rafraichirCaisse}
        />
      ) : onglet === 'chantiers' ? (
        <ParChantierTab
          onOuvrirTri={() => {
            setOnglet('operations')
            ouvrirFile()
          }}
        />
      ) : chargement ? (
        <div className="flex items-center justify-center py-24 text-gray-400" role="status" aria-live="polite">
          <Loader2 size={22} className="animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm font-semibold">Chargement de vos opérations…</span>
        </div>
      ) : aucuneDonnee ? (
        <EtatVide onImporter={() => setImportOuvert(true)} onAide={() => setAideOuverte(true)} />
      ) : (
        <>
          {/* Rappel du périmètre (décision validée : banque + caisse uniquement) */}
          <div className="flex items-start gap-2 bg-cream border border-gold/50 rounded-xl px-4 py-2.5 mb-4 text-[12.5px] text-navy/80">
            <span className="mt-px" aria-hidden="true">💡</span>
            <p>
              Ici, vous voyez <strong>l’argent qui bouge</strong> (votre banque + votre caisse). Les dépenses
              saisies à la main se rangent dans{' '}
              <Link href="/dashboard/achats" className="font-bold underline underline-offset-2">
                Achats&nbsp;→
              </Link>
            </p>
          </div>

          {/* Bandeau relevé à jour */}
          {dateDernierMouvement && (
            <div className="flex items-center gap-2 text-[12.5px] text-gray-500 mb-4 flex-wrap">
              <span className="w-1.5 h-1.5 rounded-full bg-sky inline-block" aria-hidden="true" />
              Relevé à jour au {dateDernierMouvement.split('-').reverse().join('/')}
              <button
                onClick={() => setImportOuvert(true)}
                className="font-bold text-navy underline underline-offset-2 hover:text-orange transition"
              >
                Importer la suite
              </button>
            </div>
          )}

          {/* Cartes de synthèse — AUCUN solde bancaire affiché (décision C5) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Entrées</p>
              <p className="font-semibold text-xl text-green-700 tabular-nums">+ {euros(totaux.entrees)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sorties</p>
              <p className="font-semibold text-xl text-red-700/80 tabular-nums">− {euros(totaux.sorties)}</p>
            </div>
            {totaux.aTrier > 0 ? (
              <button
                onClick={ouvrirFile}
                className="bg-white rounded-2xl border-2 border-orange/60 shadow-sm px-5 py-4 text-left hover:bg-orange/[0.04] transition"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange mb-1">À trier</p>
                <p className="font-syne font-bold text-xl text-navy">
                  {totaux.aTrier} opération{totaux.aTrier > 1 ? 's' : ''}{' '}
                  <span className="text-[12px] font-manrope font-semibold text-orange">
                    → Commencer le tri
                  </span>
                </p>
              </button>
            ) : (
              <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange mb-1">À trier</p>
                <p className="font-syne font-bold text-xl text-navy">Tout est trié ✓</p>
              </div>
            )}
          </div>

          {/* Filtres période + compte + recherche + actions */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Période affichée">
              {(
                [
                  { id: 'mois', label: 'Ce mois' },
                  { id: 'dernier', label: 'Mois dernier' },
                  { id: '3mois', label: '3 derniers mois' },
                  { id: 'annee', label: 'Année' },
                ] as { id: Periode; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriode(p.id)}
                  aria-pressed={periode === p.id}
                  className={`h-8 px-3 rounded-full border-[1.5px] text-[12.5px] font-semibold transition ${
                    periode === p.id
                      ? 'bg-navy border-navy text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-sky'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {comptes.length > 1 && (
              <select
                value={compteFiltre}
                onChange={(e) => setCompteFiltre(e.target.value)}
                aria-label="Filtrer par compte"
                className="h-10 px-3 rounded-xl border-[1.5px] border-gray-200 bg-white text-sm font-semibold text-navy focus:outline-none focus:border-sky transition"
              >
                <option value="tous">Tous les comptes</option>
                {comptes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une opération…"
                aria-label="Rechercher une opération"
                className="w-full h-10 pl-9 pr-3 rounded-xl border-[1.5px] border-gray-200 bg-white text-sm focus:outline-none focus:border-sky transition"
              />
            </div>

            <button
              onClick={() => setImportOuvert(true)}
              className="h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white font-semibold text-sm text-navy hover:border-orange transition inline-flex items-center gap-2"
            >
              <ArrowDownToLine size={16} aria-hidden="true" /> Importer un relevé
            </button>
            <Link
              href="/dashboard/achats?new=1"
              className="h-10 px-4 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-sm transition inline-flex items-center gap-1.5"
            >
              <Plus size={16} aria-hidden="true" /> Dépense
            </Link>
          </div>

          {/* Liste groupée par mois */}
          {mouvementsFiltres.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-12">
              Aucune opération ne correspond à votre recherche sur cette période.
            </p>
          ) : (
            <div className="space-y-6">
              {parMois.map(([cleMois, liste]) => {
                let entreesMois = 0
                let sortiesMois = 0
                for (const m of liste) {
                  if (m.nature === 'virement_interne' || m.est_prive) continue
                  if (m.montant > 0) entreesMois += m.montant
                  else sortiesMois += -m.montant
                }
                return (
                  <div key={cleMois}>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      {libelleMois(cleMois)}{' '}
                      <span className="normal-case tracking-normal text-gray-400 tabular-nums">
                        · {liste.length} opération{liste.length > 1 ? 's' : ''} ·{' '}
                        <span className="text-green-700">+ {euros(entreesMois)}</span> ·{' '}
                        <span className="text-navy">− {euros(sortiesMois)}</span>
                      </span>
                    </p>
                    <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm divide-y divide-gray-100 overflow-hidden">
                      {liste.map((m) => (
                        <LigneOperation
                          key={m.id}
                          mouvement={m}
                          categorie={m.categorie_id ? categories.get(m.categorie_id) : undefined}
                          estCaisse={comptesCaisse.has(m.compte_id)}
                          onClick={() => ouvrirMouvement(m)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modales & panneau ── */}
      {importOuvert && (
        <ImportReleveModal
          comptes={comptes.filter((c) => c.type === 'bancaire')}
          onClose={() => setImportOuvert(false)}
          onImported={() => {
            setImportOuvert(false)
            void chargerDonnees()
          }}
          onCreerCompte={() => setCompteModal({ type: 'bancaire' })}
          onAide={() => setAideOuverte(true)}
        />
      )}
      {compteModal && (
        <CompteModal
          typeInitial={compteModal.type}
          onClose={() => setCompteModal(null)}
          onCreated={() => {
            setCompteModal(null)
            void chargerDonnees()
          }}
        />
      )}
      {aideOuverte && <AideReleveModal onClose={() => setAideOuverte(false)} />}

      {mouvementCourant && panneau && (
        <PanneauPointage
          key={mouvementCourant.id}
          mouvement={mouvementCourant}
          compte={comptes.find((c) => c.id === mouvementCourant.compte_id)}
          categories={categoriesListe}
          franchiseTva={franchiseTva}
          resteATrier={panneau.modeFile ? panneau.file.length : 0}
          modeFile={panneau.modeFile}
          onClose={fermerPanneau}
          onMaj={surMaj}
          onPointe={surPointe}
          onPasser={surPasser}
        />
      )}

      {finTri && <PanneauToutTrie onClose={() => setFinTri(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fin de file : « Tout est trié ✓ »
// ---------------------------------------------------------------------------

function PanneauToutTrie({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-navy/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col items-center justify-center px-8 text-center"
        role="dialog"
        aria-modal="true"
        aria-label="Tri terminé"
      >
        <div
          className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-4"
          aria-hidden="true"
        >
          <Check size={28} />
        </div>
        <p className="font-syne font-bold text-xl text-navy mb-2">Tout est trié ✓</p>
        <p className="text-[13px] text-gray-500 mb-5">Plus rien à vérifier. Vos chiffres sont à jour.</p>
        <button
          onClick={onClose}
          className="h-11 px-6 rounded-xl bg-navy text-white font-bold hover:bg-navy-mid transition"
        >
          Fermer
        </button>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// État vide « à 3 portes » (fidèle à la maquette)
// ---------------------------------------------------------------------------

function EtatVide({ onImporter, onAide }: { onImporter: () => void; onAide: () => void }) {
  return (
    <div className="max-w-3xl mx-auto text-center pt-6 pb-10">
      <svg
        viewBox="0 0 200 90"
        className="mx-auto w-52 h-auto mb-6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="20" y="30" width="70" height="45" rx="6" stroke="#0f1a3a" strokeWidth="2.5" />
        <path d="M20 44h70" stroke="#0f1a3a" strokeWidth="2.5" />
        <circle cx="76" cy="59" r="4" fill="#e87a2a" />
        <path d="M120 70 L145 25 L170 70" stroke="#0f1a3a" strokeWidth="2.5" />
        <path d="M130 52h30" stroke="#e87a2a" strokeWidth="2.5" />
        <path d="M148 25l-6 14h10l-8 16" stroke="#f5c842" strokeWidth="2.5" />
        <circle cx="105" cy="20" r="6" stroke="#5ab4e0" strokeWidth="2.5" />
      </svg>
      <h2 className="font-syne font-bold text-2xl sm:text-3xl text-navy mb-3">
        Suivez où part votre argent, chantier par chantier
      </h2>
      <p className="text-gray-600 max-w-xl mx-auto mb-8">
        Ajoutez vos dépenses comme ça vous arrange. Pas besoin de connaître la compta&nbsp;: une photo du
        ticket suffit.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        {/* Porte 1 : photo — renvoie vers Achats pour l'instant */}
        <Link
          href="/dashboard/achats?new=1"
          className="group bg-white rounded-2xl border-2 border-orange p-5 shadow-sm hover:-translate-y-0.5 transition text-left block"
        >
          <span className="w-11 h-11 rounded-xl bg-orange/10 text-orange flex items-center justify-center mb-3">
            <Camera size={24} aria-hidden="true" />
          </span>
          <p className="font-syne font-bold text-[15px] text-navy mb-1">Photographier un ticket</p>
          <p className="text-[13px] text-gray-500 leading-snug">Le plus rapide. Le ticket est gardé avec la dépense.</p>
          <span className="inline-block mt-3 text-[12.5px] font-bold text-orange group-hover:underline">
            Via la page Achats →
          </span>
        </Link>
        {/* Porte 2 : saisie manuelle — renvoie vers Achats */}
        <Link
          href="/dashboard/achats?new=1"
          className="group bg-white rounded-2xl border border-navy/[0.08] p-5 shadow-sm hover:-translate-y-0.5 hover:border-sky transition text-left block"
        >
          <span className="w-11 h-11 rounded-xl bg-sky/15 text-navy flex items-center justify-center mb-3">
            <PencilLine size={24} aria-hidden="true" />
          </span>
          <p className="font-syne font-bold text-[15px] text-navy mb-1">Saisir une dépense à la main</p>
          <p className="text-[13px] text-gray-500 leading-snug">30 secondes, montant + chantier.</p>
          <span className="inline-block mt-3 text-[12.5px] font-bold text-sky group-hover:underline">Saisir →</span>
        </Link>
        {/* Porte 3 : import */}
        <button
          onClick={onImporter}
          className="group bg-white rounded-2xl border border-navy/[0.08] p-5 shadow-sm hover:-translate-y-0.5 hover:border-gold transition text-left"
        >
          <span className="w-11 h-11 rounded-xl bg-gold/20 text-navy flex items-center justify-center mb-3">
            <ArrowDownToLine size={24} aria-hidden="true" />
          </span>
          <p className="font-syne font-bold text-[15px] text-navy mb-1">Importer mon relevé bancaire</p>
          <p className="text-[13px] text-gray-500 leading-snug">
            Le fichier CSV que votre banque vous laisse télécharger. On s’occupe du reste.
          </p>
          <span className="inline-block mt-3 text-[12.5px] font-bold text-navy group-hover:underline">
            Importer →
          </span>
        </button>
      </div>

      <button
        onClick={onAide}
        className="mt-6 text-[13px] text-gray-500 underline underline-offset-2 hover:text-navy transition"
      >
        Où télécharger mon relevé&nbsp;?
      </button>
    </div>
  )
}
