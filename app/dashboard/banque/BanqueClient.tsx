'use client'

// ============================================================================
// BanqueClient — contenu de l'onglet « Dépenses & Banque » (Lot 2a)
// ----------------------------------------------------------------------------
// Périmètre V1 validé par jeremy (SPEC §6, décision n°2) :
//   - Opérations = l'argent qui bouge (banque + caisse) UNIQUEMENT,
//   - AUCUN solde bancaire affiché (décision C5),
//   - pas de chantier sur les mouvements (décision n°3),
//   - les dépenses saisies à la main → onglet Achats.
// Sous-onglets Caisse et Par chantier : placeholders (Lot 2b).
// Le clic sur une opération ouvre un panneau latéral placeholder (Lot 2b).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CompteModal from './CompteModal'
import ImportReleveModal from './ImportReleveModal'
import AideReleveModal from './AideReleveModal'
import {
  ArrowDownToLine,
  Camera,
  PencilLine,
  Search,
  Paperclip,
  X,
  Plus,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types des données lues (schéma : sql/2026-07-12-banque-03 et -04)
// ---------------------------------------------------------------------------

export interface CompteTresorerie {
  id: string
  nom: string
  type: 'bancaire' | 'caisse'
  banque_nom: string | null
  iban_masque: string | null
}

interface Mouvement {
  id: string
  compte_id: string
  date_operation: string
  libelle_banque: string
  libelle_perso: string | null
  montant: number
  statut_pointage: 'a_pointer' | 'pointe' | 'ignore'
  nature: 'normal' | 'remboursement' | 'virement_interne'
  est_prive: boolean
  categorie_id: string | null
  justificatif_path: string | null
  source: string
}

interface Categorie {
  id: string
  label: string
  groupe: 'recette' | 'depense' | 'neutre'
}

type Periode = 'mois' | 'dernier' | '3mois' | 'annee'
type Onglet = 'operations' | 'caisse' | 'chantiers'

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

const formateurEuros = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function euros(valeur: number): string {
  return `${formateurEuros.format(valeur)} €`
}

function montantSigne(valeur: number): string {
  return valeur >= 0 ? `+ ${euros(valeur)}` : `− ${euros(Math.abs(valeur))}`
}

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

function libelleMois(cle: string): string {
  const [annee, mois] = cle.split('-').map(Number)
  const brut = new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  return brut.charAt(0).toUpperCase() + brut.slice(1)
}

function jourMois(dateIso: string): string {
  const [, m, j] = dateIso.split('-')
  return `${j}/${m}`
}

/** Pastille (emoji) selon la nature / le sens du mouvement — fidèle à la maquette. */
function pastille(mouvement: Mouvement, categorie: Categorie | undefined): { emoji: string; fond: string } {
  if (mouvement.nature === 'virement_interne') return { emoji: '🔄', fond: 'bg-gray-100' }
  if (mouvement.est_prive) return { emoji: '👤', fond: 'bg-gray-100' }
  if (mouvement.montant > 0) return { emoji: '💶', fond: 'bg-green-100' }
  if (categorie?.groupe === 'neutre') return { emoji: '🔄', fond: 'bg-gray-100' }
  return { emoji: '⚡', fond: 'bg-sky/15' }
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

  const [onglet, setOnglet] = useState<Onglet>('operations')
  const [periode, setPeriode] = useState<Periode>('3mois')
  const [recherche, setRecherche] = useState('')
  const [compteFiltre, setCompteFiltre] = useState<string>('tous')

  const [importOuvert, setImportOuvert] = useState(false)
  const [compteModalOuvert, setCompteModalOuvert] = useState(false)
  const [aideOuverte, setAideOuverte] = useState(false)
  const [mouvementOuvert, setMouvementOuvert] = useState<Mouvement | null>(null)

  // ── Chargement des données ──
  const chargerDonnees = useCallback(async () => {
    setChargement(true)
    setErreurChargement(null)
    try {
      const bornes = bornesPeriode(periode)

      const [resComptes, resCategories] = await Promise.all([
        supabase
          .from('comptes_tresorerie')
          .select('id, nom, type, banque_nom, iban_masque')
          .is('deleted_at', null)
          .eq('actif', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('depense_categories')
          .select('id, label, groupe')
          .is('deleted_at', null)
          .eq('actif', true),
      ])
      if (resComptes.error) throw resComptes.error
      if (resCategories.error) throw resCategories.error

      let requete = supabase
        .from('banque_mouvements')
        .select(
          'id, compte_id, date_operation, libelle_banque, libelle_perso, montant, statut_pointage, nature, est_prive, categorie_id, justificatif_path, source',
        )
        .is('deleted_at', null)
        .gte('date_operation', bornes.debut)
        .order('date_operation', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000)
      if (bornes.fin) requete = requete.lte('date_operation', bornes.fin)
      const resMouvements = await requete
      if (resMouvements.error) throw resMouvements.error

      setComptes((resComptes.data ?? []) as CompteTresorerie[])
      setMouvements((resMouvements.data ?? []) as Mouvement[])
      const mapCategories = new Map<string, Categorie>()
      for (const c of (resCategories.data ?? []) as Categorie[]) mapCategories.set(c.id, c)
      setCategories(mapCategories)
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
  const comptesCaisse = useMemo(() => new Set(comptes.filter((c) => c.type === 'caisse').map((c) => c.id)), [comptes])

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

  const parMois = useMemo(() => {
    const groupes = new Map<string, Mouvement[]>()
    for (const m of mouvementsFiltres) {
      const cle = m.date_operation.slice(0, 7)
      const liste = groupes.get(cle)
      if (liste) liste.push(m)
      else groupes.set(cle, [m])
    }
    return Array.from(groupes.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [mouvementsFiltres])

  // Entrées / Sorties de la période : les virements internes et le perso
  // sont EXCLUS (maquette : « Mouvement interne — exclu des Entrées/Sorties »).
  const totaux = useMemo(() => {
    let entrees = 0
    let sorties = 0
    let aTrier = 0
    for (const m of mouvementsFiltres) {
      if (m.statut_pointage === 'a_pointer') aTrier++
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

  // ── Rendu ──
  return (
    <div className="max-w-5xl mx-auto">
      {/* Sous-onglets */}
      <div className="flex items-center gap-1 border-b border-navy/[0.08] mb-6" role="tablist" aria-label="Sections Dépenses et Banque">
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

      {onglet !== 'operations' ? (
        <PlaceholderOnglet onglet={onglet} />
      ) : chargement ? (
        <div className="flex items-center justify-center py-24 text-gray-400" role="status" aria-live="polite">
          <Loader2 size={22} className="animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm font-semibold">Chargement de vos opérations…</span>
        </div>
      ) : aucuneDonnee ? (
        <EtatVide
          onImporter={() => setImportOuvert(true)}
          onAide={() => setAideOuverte(true)}
        />
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

          {/* Cartes de synthèse — AUCUN solde affiché (décision C5) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Entrées</p>
              <p className="font-semibold text-xl text-green-700 tabular-nums">+ {euros(totaux.entrees)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sorties</p>
              <p className="font-semibold text-xl text-red-700/80 tabular-nums">− {euros(totaux.sorties)}</p>
            </div>
            <div
              className={`bg-white rounded-2xl px-5 py-4 shadow-sm ${
                totaux.aTrier > 0 ? 'border-2 border-orange/60' : 'border border-navy/[0.06]'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange mb-1">À trier</p>
              <p className="font-syne font-bold text-xl text-navy">
                {totaux.aTrier === 0 ? (
                  <>Tout est trié ✓</>
                ) : (
                  <>
                    {totaux.aTrier} opération{totaux.aTrier > 1 ? 's' : ''}{' '}
                    <span className="text-[12px] font-manrope font-semibold text-orange">
                      → le tri arrive au prochain lot
                    </span>
                  </>
                )}
              </p>
            </div>
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
              href="/dashboard/achats"
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
                          onClick={() => setMouvementOuvert(m)}
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
          onCreerCompte={() => setCompteModalOuvert(true)}
          onAide={() => setAideOuverte(true)}
        />
      )}
      {compteModalOuvert && (
        <CompteModal
          onClose={() => setCompteModalOuvert(false)}
          onCreated={() => {
            setCompteModalOuvert(false)
            void chargerDonnees()
          }}
        />
      )}
      {aideOuverte && <AideReleveModal onClose={() => setAideOuverte(false)} />}
      {mouvementOuvert && (
        <PanneauPointagePlaceholder
          mouvement={mouvementOuvert}
          categorie={mouvementOuvert.categorie_id ? categories.get(mouvementOuvert.categorie_id) : undefined}
          onClose={() => setMouvementOuvert(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ligne d'opération
// ---------------------------------------------------------------------------

function LigneOperation({
  mouvement,
  categorie,
  estCaisse,
  onClick,
}: {
  mouvement: Mouvement
  categorie: Categorie | undefined
  estCaisse: boolean
  onClick: () => void
}) {
  const { emoji, fond } = pastille(mouvement, categorie)
  const titre = mouvement.libelle_perso || mouvement.libelle_banque
  const griser = mouvement.est_prive || mouvement.nature === 'virement_interne'

  let sousTitre: string
  if (mouvement.est_prive) sousTitre = 'Perso — rien à voir avec l’entreprise'
  else if (mouvement.nature === 'virement_interne') sousTitre = 'Mouvement interne — exclu des Entrées/Sorties'
  else if (categorie && mouvement.statut_pointage === 'a_pointer')
    sousTitre = `Catégorie proposée : ${categorie.label}`
  else if (categorie) sousTitre = categorie.label
  else if (mouvement.montant > 0 && mouvement.statut_pointage === 'a_pointer')
    sousTitre = 'Virement reçu — à rapprocher d’une facture'
  else if (mouvement.statut_pointage === 'a_pointer') sousTitre = 'À trier'
  else sousTitre = ''

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition ${
        mouvement.est_prive ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${fond}`}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-[14px] text-navy truncate">{titre}</span>
        <span className="block text-[12px] text-gray-500 truncate mt-px">
          {sousTitre}
          {estCaisse && (
            <span className="ml-1.5 inline-flex items-center px-2 py-px rounded-full bg-cream text-navy/70 text-[11px] font-semibold">
              Espèces
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-2.5 flex-shrink-0">
        <span className="hidden sm:inline text-[11px] text-gray-400 tabular-nums">
          {jourMois(mouvement.date_operation)}
        </span>
        <span
          className={`text-sm tabular-nums ${
            griser ? 'text-gray-400' : mouvement.montant > 0 ? 'text-green-700' : 'text-navy'
          }`}
        >
          {montantSigne(mouvement.montant)}
        </span>
        {mouvement.justificatif_path && (
          <Paperclip size={14} className="text-orange" role="img" aria-label="Justificatif joint" />
        )}
        {mouvement.statut_pointage === 'a_pointer' && !mouvement.est_prive && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange/10 text-orange text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange" aria-hidden="true" />À trier
          </span>
        )}
      </span>
    </button>
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
          href="/dashboard/achats"
          className="group bg-white rounded-2xl border-2 border-orange p-5 shadow-sm hover:-translate-y-0.5 transition text-left block"
        >
          <span className="w-11 h-11 rounded-xl bg-orange/10 text-orange flex items-center justify-center mb-3">
            <Camera size={24} aria-hidden="true" />
          </span>
          <p className="font-syne font-bold text-[15px] text-navy mb-1">Photographier un ticket</p>
          <p className="text-[13px] text-gray-500 leading-snug">Le plus rapide. On lit le montant pour vous.</p>
          <span className="inline-block mt-3 text-[12.5px] font-bold text-orange group-hover:underline">
            Via la page Achats →
          </span>
        </Link>
        {/* Porte 2 : saisie manuelle — renvoie vers Achats */}
        <Link
          href="/dashboard/achats"
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

// ---------------------------------------------------------------------------
// Placeholders des sous-onglets Caisse / Par chantier (Lot 2b)
// ---------------------------------------------------------------------------

function PlaceholderOnglet({ onglet }: { onglet: Onglet }) {
  const contenu =
    onglet === 'caisse'
      ? {
          emoji: '💶',
          fond: 'bg-gold/20',
          titre: 'Vous encaissez ou payez parfois en liquide ?',
          texte:
            'La caisse espèces arrive au prochain lot : fond de caisse, argent reçu, argent dépensé — tout au même endroit.',
        }
      : {
          emoji: '🏠',
          fond: 'bg-sky/15',
          titre: 'Est-ce que vos chantiers vous rapportent ?',
          texte:
            'La rentabilité par chantier arrive au prochain lot : facturé, dépensé, et ce que chaque chantier vous a vraiment rapporté.',
        }
  return (
    <div className="max-w-md mx-auto text-center pt-12 pb-10">
      <div
        className={`w-16 h-16 rounded-2xl ${contenu.fond} text-navy flex items-center justify-center mx-auto mb-5 text-3xl`}
        aria-hidden="true"
      >
        {contenu.emoji}
      </div>
      <h2 className="font-syne font-bold text-xl sm:text-2xl text-navy mb-3">{contenu.titre}</h2>
      <p className="text-gray-600 mb-6">{contenu.texte}</p>
      <span className="inline-flex items-center px-4 py-2 rounded-full bg-cream border border-gold/50 text-[13px] font-bold text-navy">
        Bientôt disponible
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panneau latéral placeholder — le pointage arrive au Lot 2b
// ---------------------------------------------------------------------------

function PanneauPointagePlaceholder({
  mouvement,
  categorie,
  onClose,
}: {
  mouvement: Mouvement
  categorie: Categorie | undefined
  onClose: () => void
}) {
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
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Détail de l’opération"
      >
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={`font-syne font-bold text-[28px] leading-tight ${
                mouvement.montant > 0 ? 'text-green-700' : 'text-navy'
              }`}
            >
              {montantSigne(mouvement.montant)}
            </p>
            <p className="text-[15px] font-bold text-navy mt-1">
              {mouvement.libelle_perso || mouvement.libelle_banque}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 break-words">{mouvement.libelle_banque}</p>
            <p className="text-[12px] text-gray-500 mt-1">
              {mouvement.date_operation.split('-').reverse().join('/')}
              {categorie ? ` · Catégorie proposée : ${categorie.label}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
            aria-label="Fermer le panneau"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream text-navy flex items-center justify-center text-2xl mb-4" aria-hidden="true">
            🗂️
          </div>
          <p className="font-syne font-bold text-lg text-navy mb-2">Pointage — arrive au prochain lot</p>
          <p className="text-[13px] text-gray-500">
            Bientôt&nbsp;: catégorie, rattachement à un chantier ou à une facture, justificatif photo, «&nbsp;c’est
            perso&nbsp;»… tout se fera ici, en quelques secondes.
          </p>
        </div>
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-navy text-white font-bold hover:bg-navy-mid transition"
          >
            Fermer
          </button>
        </div>
      </aside>
    </>
  )
}
