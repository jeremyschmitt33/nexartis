/**
 * lib/email-copie.ts
 *
 * Copie automatique a l'artisan des documents envoyes a ses clients.
 *
 * Demande utilisateur du 21/08/2026 (Plomberie Life Systeme) : "Est-il
 * possible de recevoir automatiquement les devis ou factures que l'on envoie
 * aux clients ?". Avant, la seule solution etait de retelecharger le PDF
 * depuis le dashboard.
 *
 * Mise en oeuvre : un BCC (copie cachee) sur l'envoi Brevo, pilote par la
 * colonne entreprises.copie_documents_envoyes (defaut TRUE).
 * Le client ne voit RIEN : le BCC n'apparait pas dans l'email recu.
 *
 * Helper partage volontairement : le meme envoi existe dans send-devis et
 * send-facture, et ce projet a un historique de divergence entre rendus
 * dupliques. Toute evolution se fait ICI.
 */

/** Champs de l'entreprise necessaires au calcul du BCC. */
export interface EntrepriseCopie {
  nom?: string | null
  email?: string | null
  copie_documents_envoyes?: boolean | null
}

/** Destinataire au format attendu par l'API Brevo. */
export interface DestinataireBrevo {
  email: string
  name?: string
}

/**
 * Renvoie le tableau `bcc` a passer a Brevo, ou undefined s'il ne faut pas
 * mettre l'artisan en copie.
 *
 * Renvoie undefined quand :
 *   - l'artisan a decoche l'option (false explicite ; null/undefined = actif) ;
 *   - son email d'entreprise n'est pas renseigne ;
 *   - il est deja le destinataire (Brevo rejette la meme adresse en to ET bcc,
 *     cas courant quand l'artisan s'envoie un document a lui-meme pour tester).
 */
export function bccArtisan(
  ent: EntrepriseCopie | null | undefined,
  emailDestinataire: string | null | undefined,
): DestinataireBrevo[] | undefined {
  if (!ent) return undefined
  // NULL/undefined = active (defaut DB TRUE + retrocompatibilite).
  if (ent.copie_documents_envoyes === false) return undefined

  const email = (ent.email || '').trim()
  if (!email) return undefined

  const dest = (emailDestinataire || '').trim().toLowerCase()
  if (dest && dest === email.toLowerCase()) return undefined

  return [{ email, name: ent.nom || undefined }]
}
