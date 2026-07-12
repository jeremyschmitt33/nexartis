// ============================================================================
// lib/banque/rpc-paiements.ts — Types + messages français des RPC paiements
// ----------------------------------------------------------------------------
// Les encaissements passent EXCLUSIVEMENT par rpc_enregistrer_paiement /
// rpc_annuler_paiement (sql/2026-07-12-banque-06) : la table paiements est la
// source de vérité, factures.montant_paye n'est qu'un cache recalculé par la
// RPC. Ne JAMAIS écrire montant_paye directement dans du nouveau code.
// Les RPC lèvent des exceptions préfixées ('PREFIXE: détail') mappées ici en
// messages français (même table que app/dashboard/factures/[id]/page.tsx).
// ============================================================================

/** JSONB renvoyé par rpc_enregistrer_paiement / rpc_annuler_paiement. */
export interface PaiementRpcResult {
  paiement_id: string
  facture_id: string
  montant_paye: number
  statut: string
  reste_du: number
}

export const PAIEMENT_RPC_MESSAGES: Record<string, string> = {
  MONTANT_INVALIDE: 'Le montant doit être supérieur à zéro.',
  FACTURE_INTROUVABLE: 'Facture introuvable ou inaccessible.',
  FACTURE_SUPPRIMEE: 'Cette facture est dans la corbeille : restaurez-la avant d\'enregistrer un paiement.',
  FACTURE_AVOIR: 'Un avoir ne peut pas recevoir de paiement.',
  MONTANT_TROP_ELEVE: 'Ce montant dépasse ce qu\'il reste à encaisser sur cette facture.',
  MOUVEMENT_INTROUVABLE: 'Le mouvement bancaire lié est introuvable.',
  MOUVEMENT_PAS_UN_CREDIT: 'Le mouvement bancaire lié n\'est pas un encaissement (crédit).',
  MOUVEMENT_DEPASSE: 'Ce virement est déjà entièrement pointé : le total affecté ne peut pas dépasser son montant.',
  PAIEMENT_INTROUVABLE: 'Paiement introuvable ou inaccessible.',
  PAIEMENT_DEJA_ANNULE: 'Ce paiement a déjà été annulé.',
}

export function mapPaiementRpcError(message: string | null | undefined): string {
  const prefixe = (message ?? '').split(':')[0]?.trim() ?? ''
  return (
    PAIEMENT_RPC_MESSAGES[prefixe] ??
    'Impossible d\'enregistrer le paiement. Réessayez, puis rechargez la page si le problème persiste.'
  )
}
