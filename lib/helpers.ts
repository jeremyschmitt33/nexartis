/**
 * Helpers transverses Nexartis.
 */

/**
 * Detecte si une entreprise a un STATUT JURIDIQUE auto-entrepreneur / micro / EI.
 *
 * PERIMETRE STRICT (V15 - decision 21/05/2026) :
 *   - A utiliser UNIQUEMENT pour :
 *     1) Pre-cocher le taux TVA a 0 au chargement d'un nouveau devis/facture
 *        dans les formulaires (UX confort).
 *     2) Afficher la mention de statut juridique en pied de PDF/HTML
 *        ("Entrepreneur individuel (Micro-entreprise)").
 *
 *   - NE PAS UTILISER pour conditionner l'affichage de la mention
 *     "TVA non applicable, art. 293 B du CGI". Cette mention doit etre basee
 *     UNIQUEMENT sur les taux saisis : si toutes les lignes prestation ont
 *     taux === 0, mention affichee ; sinon, non. Justification : un AE qui
 *     depasse le seuil de franchise en cours d'annee peut legitimement saisir
 *     un taux > 0, la mention doit alors disparaitre automatiquement.
 *
 * Regle de detection :
 *   - Si franchise_tva === true (case cochee dans Parametres) -> true.
 *   - Sinon, si la forme juridique contient micro / EI / auto -> true (securite :
 *     l'artisan a oublie de cocher).
 *
 * @param entreprise objet entreprise (ou null/undefined si pas encore charge)
 * @returns true si l'entreprise est juridiquement en statut de franchise
 */
export function isAutoEntrepreneur(
  entreprise:
    | { forme_juridique?: string | null; franchise_tva?: boolean | null }
    | null
    | undefined
): boolean {
  if (!entreprise) return false
  if (entreprise.franchise_tva === true) return true
  const fj = (entreprise.forme_juridique || '').toLowerCase().trim()
  return (
    fj.includes('micro') ||
    fj === 'ei' ||
    fj.includes('entreprise individuelle') ||
    fj.includes('auto')
  )
}

// ─────────────────────────────────────────────────────────────
// Champs LEGAUX obligatoires sur un devis/facture en France
// ─────────────────────────────────────────────────────────────
//
// Sources :
//   - Code de commerce art. L441-9 (mentions obligatoires devis)
//   - CGI art. 242 nonies A (mentions obligatoires facture)
//
// Cette liste est volontairement plus restreinte que celle du
// dashboard (qui inclut aussi assurance decennale). Ici on
// retient les champs qui rendent le PDF NON CONFORME s'ils
// manquent (pas de raison sociale = pas d'entreprise identifiable).

const CHAMPS_LEGAUX_DEVIS: { champ: string; label: string }[] = [
  { champ: 'nom', label: 'Raison sociale' },
  { champ: 'siret', label: 'SIRET' },
  { champ: 'forme_juridique', label: 'Forme juridique' },
  { champ: 'adresse', label: 'Adresse' },
  { champ: 'code_postal', label: 'Code postal' },
  { champ: 'ville', label: 'Ville' },
]

/**
 * Retourne la liste des champs legaux manquants sur le profil
 * entreprise. Si la liste est vide, le profil est conforme du
 * point de vue des mentions obligatoires d'un devis.
 *
 * Utilise pour :
 *   - Badge "Devis incomplet" dans la liste des devis (dashboard)
 *   - Banniere jaune en haut du PDF du devis (lib/pdf.ts)
 */
export function champsLegauxManquants(
  entreprise: Record<string, unknown> | null | undefined
): string[] {
  if (!entreprise) return CHAMPS_LEGAUX_DEVIS.map(c => c.label)
  return CHAMPS_LEGAUX_DEVIS
    .filter(c => {
      const val = entreprise[c.champ]
      return !val || String(val).trim() === ''
    })
    .map(c => c.label)
}

/**
 * Renvoie true si le profil entreprise est INCOMPLET au sens
 * legal (au moins un champ obligatoire manquant). Utile pour
 * afficher rapidement un badge ou une banniere.
 */
export function isProfilLegalIncomplet(
  entreprise: Record<string, unknown> | null | undefined
): boolean {
  return champsLegauxManquants(entreprise).length > 0
}
