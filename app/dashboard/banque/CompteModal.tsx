'use client'

// ============================================================================
// CompteModal — création d'un compte de trésorerie (Lot 2a)
// ----------------------------------------------------------------------------
// Table cible : comptes_tresorerie (sql/2026-07-12-banque-03). RLS active
// (pattern entreprise + dirigeant) : l'insert passe par le client Supabase
// à cookies, avec user_id = utilisateur connecté.
// ⚠️ Garde-fou légal (SPEC §5) : JAMAIS d'IBAN complet en base — on ne
// demande que les 4 derniers chiffres, stockés masqués (« •••• 1234 »).
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'

type TypeCompte = 'bancaire' | 'caisse'

/** Parse un montant saisi « à la française » (virgule décimale). null si illisible. */
function parserMontantSaisi(brut: string): number | null {
  const s = brut.replace(/[\s  ]/g, '').replace(/€/g, '').replace(',', '.')
  if (!s) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const v = Math.round(parseFloat(s) * 100) / 100
  return isFinite(v) ? v : null
}

export default function CompteModal({
  onClose,
  onCreated,
  typeInitial = 'bancaire',
}: {
  onClose: () => void
  onCreated: () => void
  /** Pré-sélection du type (ex. « Démarrer ma caisse » ouvre en mode caisse). */
  typeInitial?: TypeCompte
}) {
  const supabase = useRef(createClient()).current

  const [type, setType] = useState<TypeCompte>(typeInitial)
  const [nom, setNom] = useState(typeInitial === 'caisse' ? 'Caisse espèces' : '')
  const [banqueNom, setBanqueNom] = useState('')
  const [iban4, setIban4] = useState('')
  const [fondCaisse, setFondCaisse] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose])

  async function enregistrer() {
    setErreur(null)
    const nomPropre = nom.trim()
    if (!nomPropre) {
      setErreur('Donnez un nom à ce compte (ex. « Compte pro Boursorama »).')
      return
    }
    let soldeInitial = 0
    if (type === 'caisse' && fondCaisse.trim()) {
      const montant = parserMontantSaisi(fondCaisse)
      if (montant === null || montant < 0) {
        setErreur('Le fond de caisse est illisible. Exemple : 120,00')
        return
      }
      soldeInitial = montant
    }

    setEnregistrement(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErreur('Votre session a expiré. Rechargez la page et reconnectez-vous.')
        return
      }
      const { error } = await supabase.from('comptes_tresorerie').insert({
        user_id: user.id,
        nom: nomPropre,
        type,
        banque_nom: type === 'bancaire' && banqueNom.trim() ? banqueNom.trim() : null,
        // JAMAIS l'IBAN complet : uniquement les 4 derniers chiffres, masqués.
        iban_masque: type === 'bancaire' && iban4.trim() ? `•••• ${iban4.trim()}` : null,
        solde_initial: soldeInitial,
      })
      if (error) {
        if (error.code === '23505') {
          setErreur('Vous avez déjà un compte avec ce nom. Choisissez-en un autre.')
        } else {
          console.error('Création compte trésorerie impossible', error)
          setErreur("Impossible de créer le compte. Réessayez.")
        }
        return
      }
      onCreated()
    } catch (e) {
      console.error('Création compte trésorerie impossible', e)
      setErreur("Impossible de créer le compte. Réessayez.")
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
        aria-label="Nouveau compte"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-syne font-bold text-lg text-navy">Nouveau compte</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {erreur && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 mb-4 text-[13px] text-red-800" role="alert">
            {erreur}
          </div>
        )}

        {/* Type de compte */}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Quel genre de compte&nbsp;?
        </p>
        <div className="flex gap-2 mb-4" role="group" aria-label="Type de compte">
          {(
            [
              { id: 'bancaire', label: '🏦 Compte bancaire' },
              { id: 'caisse', label: '💶 Caisse espèces' },
            ] as { id: TypeCompte; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={`flex-1 min-h-[44px] px-3 rounded-xl border-[1.5px] text-[13px] font-semibold transition ${
                type === t.id
                  ? 'bg-navy border-navy text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-sky'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Nom */}
        <label htmlFor="compte-nom" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          Nom du compte
        </label>
        <input
          id="compte-nom"
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={80}
          placeholder={type === 'bancaire' ? 'Compte pro Boursorama' : 'Caisse espèces'}
          className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm focus:outline-none focus:border-sky transition mb-4"
        />

        {type === 'bancaire' ? (
          <>
            {/* Banque */}
            <label htmlFor="compte-banque" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Banque (facultatif)
            </label>
            <input
              id="compte-banque"
              type="text"
              value={banqueNom}
              onChange={(e) => setBanqueNom(e.target.value)}
              maxLength={80}
              placeholder="Boursorama, Crédit Agricole…"
              className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm focus:outline-none focus:border-sky transition mb-4"
            />

            {/* 4 derniers chiffres — jamais l'IBAN complet */}
            <label htmlFor="compte-iban4" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              4 derniers chiffres du compte (facultatif)
            </label>
            <input
              id="compte-iban4"
              type="text"
              inputMode="numeric"
              value={iban4}
              onChange={(e) => setIban4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="1234"
              className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm tabular-nums focus:outline-none focus:border-sky transition mb-1.5"
            />
            <p className="text-[12px] text-gray-500 mb-5">
              Juste pour reconnaître le compte. On ne vous demandera <strong>jamais</strong> votre IBAN complet ni
              vos identifiants bancaires.
            </p>
          </>
        ) : (
          <>
            {/* Fond de caisse */}
            <label htmlFor="compte-fond" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Combien avez-vous en liquide aujourd&rsquo;hui&nbsp;? (facultatif)
            </label>
            <input
              id="compte-fond"
              type="text"
              inputMode="decimal"
              value={fondCaisse}
              onChange={(e) => setFondCaisse(e.target.value)}
              placeholder="0,00"
              className="w-full h-11 px-3 rounded-xl border-[1.5px] border-gray-200 text-sm tabular-nums focus:outline-none focus:border-sky transition mb-1.5"
            />
            <p className="text-[12px] text-gray-500 mb-5">Ça peut être 0 — vous pourrez corriger plus tard.</p>
          </>
        )}

        <button
          onClick={() => void enregistrer()}
          disabled={enregistrement}
          className="w-full h-12 rounded-xl bg-orange hover:bg-orange-hover disabled:opacity-60 text-white font-bold transition inline-flex items-center justify-center gap-2"
        >
          {enregistrement && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Créer le compte
        </button>
      </div>
    </div>
  )
}
