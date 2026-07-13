'use client'

// ============================================================================
// commun.tsx — types, helpers et ligne d'opération partagés (module banque)
// ----------------------------------------------------------------------------
// Partagé entre BanqueClient (Opérations), CaisseTab et PanneauPointage.
// Schéma de référence : sql/2026-07-12-banque-03 / -04 (appliqués en prod).
// ============================================================================

import { Paperclip } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types des données lues
// ---------------------------------------------------------------------------

export interface CompteTresorerie {
  id: string
  nom: string
  type: 'bancaire' | 'caisse'
  banque_nom: string | null
  iban_masque: string | null
  solde_initial: number
  solde_initial_date: string
}

export interface Mouvement {
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
  /**
   * true = la catégorie (ou la reconnaissance du marchand) vient de la MACHINE,
   * pas de l'utilisateur. Discrimine les 3 états du tri :
   *   a_pointer + categorisation_auto → « À confirmer » (avec cat = suggéré,
   *   sans cat = binaire pro/perso) ; a_pointer sinon → « À trier » ;
   *   pointe + categorisation_auto → « Classé auto » (tag + pourquoi).
   */
  categorisation_auto: boolean
  justificatif_path: string | null
  notes: string | null
  source: string
}

/** Colonnes sélectionnées pour un Mouvement (à garder alignées sur le type). */
export const MOUVEMENT_COLONNES =
  'id, compte_id, date_operation, libelle_banque, libelle_perso, montant, statut_pointage, nature, est_prive, categorie_id, categorisation_auto, justificatif_path, notes, source'

export interface Categorie {
  id: string
  code: string
  label: string
  groupe: 'recette' | 'depense' | 'neutre'
}

export interface ChantierLeger {
  id: string
  /** La table chantiers nomme ses chantiers via la colonne `titre`. */
  titre: string | null
  statut: string | null
}

// ---------------------------------------------------------------------------
// Helpers d'affichage / de saisie
// ---------------------------------------------------------------------------

const formateurEuros = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function euros(valeur: number): string {
  return `${formateurEuros.format(valeur)} €`
}

export function montantSigne(valeur: number): string {
  return valeur >= 0 ? `+ ${euros(valeur)}` : `− ${euros(Math.abs(valeur))}`
}

export function dateFr(dateIso: string): string {
  return dateIso.split('-').reverse().join('/')
}

export function jourMois(dateIso: string): string {
  const [, m, j] = dateIso.split('-')
  return `${j}/${m}`
}

export function libelleMois(cle: string): string {
  const [annee, mois] = cle.split('-').map(Number)
  const brut = new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  return brut.charAt(0).toUpperCase() + brut.slice(1)
}

/** Parse un montant saisi « à la française » (virgule décimale). null si illisible. */
export function parserMontantSaisi(brut: string): number | null {
  const s = brut.replace(/[\s  ]/g, '').replace(/€/g, '').replace(',', '.')
  if (!s) return null
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const v = Math.round(parseFloat(s) * 100) / 100
  return isFinite(v) ? v : null
}

/** Groupe une liste de mouvements (déjà triée date desc) par mois « AAAA-MM ». */
export function grouperParMois(liste: Mouvement[]): [string, Mouvement[]][] {
  const groupes = new Map<string, Mouvement[]>()
  for (const m of liste) {
    const cle = m.date_operation.slice(0, 7)
    const existante = groupes.get(cle)
    if (existante) existante.push(m)
    else groupes.set(cle, [m])
  }
  return Array.from(groupes.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

/** Pastille (emoji) selon la nature / le sens du mouvement — fidèle à la maquette. */
export function pastille(
  mouvement: Mouvement,
  categorie: Categorie | undefined,
): { emoji: string; fond: string } {
  if (mouvement.nature === 'virement_interne') return { emoji: '🔄', fond: 'bg-gray-100' }
  if (mouvement.est_prive) return { emoji: '👤', fond: 'bg-gray-100' }
  if (mouvement.montant > 0) return { emoji: '💶', fond: 'bg-green-100' }
  if (categorie?.groupe === 'neutre') return { emoji: '🔄', fond: 'bg-gray-100' }
  return { emoji: '⚡', fond: 'bg-sky/15' }
}

// ---------------------------------------------------------------------------
// Ligne d'opération (liste Opérations + liste Caisse)
// ---------------------------------------------------------------------------

export function LigneOperation({
  mouvement,
  categorie,
  estCaisse,
  onClick,
}: {
  mouvement: Mouvement
  categorie: Categorie | undefined
  /** Affiche la pastille « Espèces » (utile dans la liste mixte Opérations). */
  estCaisse: boolean
  onClick: () => void
}) {
  const { emoji, fond } = pastille(mouvement, categorie)
  const titre = mouvement.libelle_perso || mouvement.libelle_banque
  const griser = mouvement.est_prive || mouvement.nature === 'virement_interne'

  let sousTitre: string
  if (mouvement.est_prive) sousTitre = 'Perso — rien à voir avec l’entreprise'
  else if (mouvement.nature === 'virement_interne')
    sousTitre = 'Mouvement interne — exclu des Entrées/Sorties'
  else if (mouvement.nature === 'remboursement')
    sousTitre = `Remboursement ou avoir${categorie ? ` · ${categorie.label}` : ''}`
  else if (categorie && mouvement.statut_pointage === 'a_pointer')
    sousTitre = `Catégorie proposée : ${categorie.label}`
  else if (mouvement.statut_pointage === 'pointe' && mouvement.montant > 0 && mouvement.notes)
    sousTitre = mouvement.notes
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
        <span className="block font-hanken font-bold text-[14px] text-navy truncate">{titre}</span>
        <span className="block font-hanken text-[12px] text-gray-500 truncate mt-px">
          {sousTitre}
          {estCaisse && (
            <span className="ml-1.5 inline-flex items-center px-2 py-px rounded-full bg-cream text-navy/70 font-hanken text-[11px] font-semibold">
              Espèces
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-2.5 flex-shrink-0">
        <span className="hidden sm:inline font-spline-mono text-[11px] text-gray-400">
          {jourMois(mouvement.date_operation)}
        </span>
        <span
          className={`font-spline-mono font-medium text-sm ${
            griser ? 'text-gray-400' : mouvement.montant > 0 ? 'text-green-700' : 'text-navy'
          }`}
        >
          {montantSigne(mouvement.montant)}
        </span>
        {mouvement.justificatif_path && (
          <Paperclip size={14} className="text-orange" role="img" aria-label="Justificatif joint" />
        )}
        {mouvement.est_prive ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-hanken text-[11px] font-semibold">
            Perso
          </span>
        ) : (
          mouvement.statut_pointage === 'a_pointer' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange/10 text-orange font-hanken text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange" aria-hidden="true" />À trier
            </span>
          )
        )}
      </span>
    </button>
  )
}
