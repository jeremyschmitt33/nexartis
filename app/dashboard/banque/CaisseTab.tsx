'use client'

// ============================================================================
// CaisseTab — la caisse espèces (Lot 2b)
// ----------------------------------------------------------------------------
// La caisse n'est qu'un compte de trésorerie de type 'caisse' (sql/03) :
//  - fond de caisse = solde_initial (modifiable),
//  - opérations = banque_mouvements en source 'manuel' sur ce compte,
//  - SOLDE DE CAISSE calculé et affiché : solde_initial + somme des mouvements
//    non supprimés. ⚠️ Autorisé pour la CAISSE UNIQUEMENT — jamais de solde
//    bancaire dans le module (décision C5 de la confrontation).
// Chaque mouvement déclaré part dans la file de pointage (catégorie, chantier,
// justificatif) comme une opération bancaire.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { Loader2, X } from 'lucide-react'
import {
  dateFr,
  euros,
  grouperParMois,
  libelleMois,
  parserMontantSaisi,
  LigneOperation,
  MOUVEMENT_COLONNES,
  type Categorie,
  type CompteTresorerie,
  type Mouvement,
} from './commun'

export default function CaisseTab({
  compteCaisse,
  categories,
  onCreerCaisse,
  onOuvrirMouvement,
  onMouvementDeclare,
  rafraichir,
}: {
  /** Le compte caisse actif (null = caisse pas encore démarrée). */
  compteCaisse: CompteTresorerie | null
  categories: Map<string, Categorie>
  /** Ouvre la création d'un compte caisse (CompteModal pré-réglée « caisse »). */
  onCreerCaisse: () => void
  /** Ouvre le panneau de pointage sur un mouvement de caisse. */
  onOuvrirMouvement: (mouvement: Mouvement) => void
  /** Après déclaration : proposer le tri immédiat (maquette « proposés juste après »). */
  onMouvementDeclare: (mouvement: Mouvement) => void
  /** Signal de rechargement (incrémenté par le parent après un pointage). */
  rafraichir: number
}) {
  const supabase = useMemo(() => createClient(), [])

  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [modaleSens, setModaleSens] = useState<'in' | 'out' | null>(null)
  const [modaleFond, setModaleFond] = useState(false)

  const chargerMouvements = useCallback(async () => {
    if (!compteCaisse) {
      setChargement(false)
      return
    }
    setChargement(true)
    setErreur(null)
    try {
      // TOUS les mouvements de la caisse (pas de filtre période : le solde
      // se calcule depuis le premier jour).
      const { data, error } = await supabase
        .from('banque_mouvements')
        .select(MOUVEMENT_COLONNES)
        .eq('compte_id', compteCaisse.id)
        .is('deleted_at', null)
        .order('date_operation', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      setMouvements((data ?? []) as Mouvement[])
    } catch (e) {
      console.error('Chargement de la caisse impossible', e)
      setErreur('Impossible de charger votre caisse. Rechargez la page.')
    } finally {
      setChargement(false)
    }
  }, [supabase, compteCaisse])

  useEffect(() => {
    void chargerMouvements()
  }, [chargerMouvements, rafraichir])

  // Solde de caisse = fond de caisse + somme des mouvements (caisse UNIQUEMENT).
  const solde = useMemo(() => {
    const total = mouvements.reduce((s, m) => s + m.montant, 0)
    return Math.round(((compteCaisse?.solde_initial ?? 0) + total) * 100) / 100
  }, [mouvements, compteCaisse])

  const parMois = useMemo(() => grouperParMois(mouvements), [mouvements])

  // ── Caisse pas encore démarrée ──
  if (!compteCaisse) {
    return (
      <div className="max-w-md mx-auto text-center pt-12 pb-10">
        <div
          className="w-16 h-16 rounded-2xl bg-gold/20 text-navy flex items-center justify-center mx-auto mb-5 text-3xl"
          aria-hidden="true"
        >
          💶
        </div>
        <h2 className="font-syne font-bold text-xl sm:text-2xl text-navy mb-3">
          Vous encaissez ou payez parfois en liquide&nbsp;?
        </h2>
        <p className="text-gray-600 mb-6">
          Notez-le ici pour ne rien perdre. Un billet oublié, c’est une dépense qui disparaît de vos
          chiffres.
        </p>
        <button
          onClick={onCreerCaisse}
          className="h-12 px-6 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold transition"
        >
          Démarrer ma caisse
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Rappel du fonctionnement */}
      <div className="flex items-start gap-2 bg-cream border border-gold/50 rounded-xl px-4 py-2.5 mb-4 text-[12.5px] text-navy/80">
        <span className="mt-px" aria-hidden="true">💡</span>
        <p>
          Votre liquide, tout simplement. Chaque mouvement de caisse apparaît aussi dans{' '}
          <strong>Opérations</strong> avec la pastille «&nbsp;Espèces&nbsp;».
        </p>
      </div>

      {erreur && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-[13px] text-red-800" role="alert">
          {erreur}
        </div>
      )}

      {/* Solde + actions */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-stretch mb-6">
        <div className="bg-white rounded-2xl border border-navy/[0.06] shadow-sm px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Dans la caisse
          </p>
          <p className={`font-syne font-bold text-3xl ${solde < 0 ? 'text-red-700/80' : 'text-navy'}`}>
            {euros(solde)}
          </p>
          <p className="text-[12px] text-gray-500 mt-1.5">
            Fond de caisse de départ&nbsp;: {euros(compteCaisse.solde_initial)} le{' '}
            {dateFr(compteCaisse.solde_initial_date)} ·{' '}
            <button
              onClick={() => setModaleFond(true)}
              className="underline underline-offset-2 hover:text-navy transition"
            >
              Modifier
            </button>
          </p>
          {solde < 0 && (
            <p className="text-[12px] text-red-700/80 mt-1.5">
              Une caisse ne peut pas être négative&nbsp;: il manque sûrement un «&nbsp;Argent reçu&nbsp;» ou
              le fond de caisse est à corriger.
            </p>
          )}
        </div>
        <div className="flex sm:flex-col gap-3 sm:justify-center">
          <button
            onClick={() => setModaleSens('in')}
            className="flex-1 sm:flex-none h-12 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-bold text-sm text-navy hover:border-sky transition"
          >
            + Argent reçu
          </button>
          <button
            onClick={() => setModaleSens('out')}
            className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-sm transition"
          >
            − Argent dépensé
          </button>
        </div>
      </div>

      {/* Liste des mouvements */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-gray-400" role="status" aria-live="polite">
          <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm font-semibold">Chargement de votre caisse…</span>
        </div>
      ) : mouvements.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-10">
          Aucun mouvement pour l’instant. Notez votre premier encaissement ou votre première dépense en
          liquide avec les boutons ci-dessus.
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
                    · {liste.length} mouvement{liste.length > 1 ? 's' : ''} ·{' '}
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
                      estCaisse={false}
                      onClick={() => onOuvrirMouvement(m)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modales ── */}
      {modaleSens && (
        <MouvementCaisseModal
          sens={modaleSens}
          compte={compteCaisse}
          onClose={() => setModaleSens(null)}
          onSaved={(m) => {
            setModaleSens(null)
            setMouvements((prec) => [m, ...prec])
            onMouvementDeclare(m)
          }}
        />
      )}
      {modaleFond && (
        <FondDeCaisseModal
          compte={compteCaisse}
          onClose={() => setModaleFond(false)}
          onSaved={() => {
            setModaleFond(false)
            void chargerMouvements()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modale : + Argent reçu / − Argent dépensé
// ---------------------------------------------------------------------------

function MouvementCaisseModal({
  sens,
  compte,
  onClose,
  onSaved,
}: {
  sens: 'in' | 'out'
  compte: CompteTresorerie
  onClose: () => void
  onSaved: (mouvement: Mouvement) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const aujourdHui = new Date().toISOString().split('T')[0]

  const [montantTexte, setMontantTexte] = useState('')
  const [libelle, setLibelle] = useState('')
  const [date, setDate] = useState(aujourdHui)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreurLocale, setErreurLocale] = useState<string | null>(null)

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  async function enregistrer() {
    setErreurLocale(null)
    const montant = parserMontantSaisi(montantTexte)
    if (montant === null || montant <= 0) {
      setErreurLocale('Le montant est illisible. Exemple : 20,00')
      return
    }
    const libellePropre = libelle.trim()
    if (!libellePropre) {
      setErreurLocale(
        sens === 'in'
          ? 'Dites en un mot d’où vient cet argent (ex. « Dépannage M. Fabre »).'
          : 'Dites en un mot où est parti cet argent (ex. « Ampoules — Brico Cash »).',
      )
      return
    }
    if (!date) {
      setErreurLocale('Choisissez la date du mouvement.')
      return
    }
    setEnregistrement(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErreurLocale('Votre session a expiré. Rechargez la page et reconnectez-vous.')
        return
      }
      const { data, error } = await supabase
        .from('banque_mouvements')
        .insert({
          user_id: user.id,
          compte_id: compte.id,
          date_operation: date,
          libelle_banque: libellePropre,
          montant: sens === 'in' ? montant : -montant,
          source: 'manuel',
          statut_pointage: 'a_pointer',
        })
        .select(MOUVEMENT_COLONNES)
        .single()
      if (error) throw error
      toast.success('Mouvement de caisse enregistré ✓')
      onSaved(data as Mouvement)
    } catch (e) {
      console.error('Déclaration du mouvement de caisse impossible', e)
      setErreurLocale('Impossible d’enregistrer ce mouvement. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-[20px] w-full max-w-sm max-h-[88vh] overflow-y-auto shadow-2xl p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Mouvement de caisse"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-syne font-bold text-lg text-navy">
            {sens === 'in' ? '+ Argent reçu' : '− Argent dépensé'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {erreurLocale && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 mb-4 text-[13px] text-red-800" role="alert">
            {erreurLocale}
          </div>
        )}

        <label htmlFor="caisse-montant" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          Montant
        </label>
        <input
          id="caisse-montant"
          type="text"
          inputMode="decimal"
          value={montantTexte}
          onChange={(e) => setMontantTexte(e.target.value)}
          placeholder="20,00"
          className="w-full h-14 rounded-xl border-[1.5px] border-gray-200 font-bold text-2xl text-center tabular-nums focus:outline-none focus:border-sky transition mb-4"
        />

        <label htmlFor="caisse-libelle" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          {sens === 'in' ? 'Reçu pour quoi ?' : 'Dépensé pour quoi ?'}
        </label>
        <input
          id="caisse-libelle"
          type="text"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          maxLength={140}
          placeholder={sens === 'in' ? 'Dépannage express — M. Fabre' : 'Ampoules dépannage — Brico Cash'}
          className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm focus:outline-none focus:border-sky transition mb-4"
        />

        <label htmlFor="caisse-date" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          Date
        </label>
        <input
          id="caisse-date"
          type="date"
          value={date}
          max={aujourdHui}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm tabular-nums focus:outline-none focus:border-sky transition mb-2"
        />
        <p className="text-[12px] text-gray-500 mb-4">
          Catégorie et chantier&nbsp;: proposés juste après, comme pour une opération bancaire.
        </p>

        <button
          onClick={() => void enregistrer()}
          disabled={enregistrement}
          className="w-full h-12 rounded-xl bg-orange hover:bg-orange-hover disabled:opacity-60 text-white font-bold transition inline-flex items-center justify-center gap-2"
        >
          {enregistrement && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          C’est noté ✓
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modale : corriger le fond de caisse
// ---------------------------------------------------------------------------

function FondDeCaisseModal({
  compte,
  onClose,
  onSaved,
}: {
  compte: CompteTresorerie
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [montantTexte, setMontantTexte] = useState(
    compte.solde_initial.toFixed(2).replace('.', ','),
  )
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreurLocale, setErreurLocale] = useState<string | null>(null)

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  async function enregistrer() {
    setErreurLocale(null)
    const montant = parserMontantSaisi(montantTexte)
    if (montant === null || montant < 0) {
      setErreurLocale('Le fond de caisse est illisible. Exemple : 120,00')
      return
    }
    setEnregistrement(true)
    try {
      const { error } = await supabase
        .from('comptes_tresorerie')
        .update({ solde_initial: montant })
        .eq('id', compte.id)
      if (error) throw error
      toast.success('Fond de caisse mis à jour ✓')
      onSaved()
    } catch (e) {
      console.error('Mise à jour du fond de caisse impossible', e)
      setErreurLocale('Impossible de mettre à jour le fond de caisse. Réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white rounded-[20px] w-full max-w-sm shadow-2xl p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Fond de caisse"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-syne font-bold text-lg text-navy">Fond de caisse</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {erreurLocale && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 mb-4 text-[13px] text-red-800" role="alert">
            {erreurLocale}
          </div>
        )}

        <p className="text-[14px] font-semibold text-navy mb-1">
          Combien aviez-vous en liquide au départ&nbsp;?
        </p>
        <p className="text-[12px] text-gray-500 mb-3">
          C’est le point de départ du solde de caisse — corrigez-le si besoin, le solde se recalcule
          tout seul.
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={montantTexte}
          onChange={(e) => setMontantTexte(e.target.value)}
          aria-label="Fond de caisse en euros"
          className="w-full h-14 rounded-xl border-[1.5px] border-gray-200 font-bold text-2xl text-center tabular-nums focus:outline-none focus:border-sky transition mb-4"
        />
        <button
          onClick={() => void enregistrer()}
          disabled={enregistrement}
          className="w-full h-12 rounded-xl bg-orange hover:bg-orange-hover disabled:opacity-60 text-white font-bold transition inline-flex items-center justify-center gap-2"
        >
          {enregistrement && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
