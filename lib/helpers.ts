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
// V2.4a : la source de verite a ete deplacee vers lib/legal-mentions.ts.
// Ces re-exports preservent la compatibilite avec les fichiers qui
// importent depuis '@/lib/helpers' (ex: app/dashboard/devis/page.tsx).
//
// Sources legales :
//   - Code de commerce art. L441-9 (mentions obligatoires devis)
//   - CGI art. 242 nonies A (mentions obligatoires facture)

export {
  CHAMPS_LEGAUX_DEVIS,
  champsLegauxManquants,
  isProfilLegalIncomplet,
} from '@/lib/legal-mentions'
