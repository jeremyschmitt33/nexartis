/**
 * lib/documents-types/pv-reception.ts
 * -----------------------------------------------------------------------------
 * Modele de Proces-Verbal (PV) de reception de chantier pour artisan du
 * batiment. Pre-rempli depuis entreprise + client + chantier/devis, editable.
 *
 * Sources (verifiees 2026) :
 *   - Reception : article 1792-6 du Code civil (acceptation avec ou sans
 *     reserves ; point de depart des garanties legales).
 *   - Garanties declenchees a la reception : parfait achevement (1792-6),
 *     biennale (1792-3), decennale (1792, 1792-2, 1792-4-1).
 *   - En marche prive, aucun texte n'impose une liste de mentions : le PV est
 *     une piece de preuve. Les mentions ci-dessous sont des bonnes pratiques.
 */

import {
  DocTypeContext,
  DOC_TYPE_DISCLAIMER,
  blocEntreprise,
  clientDisplayName,
  adresseLigne,
  fmtDateFr,
} from './context'

export function generatePvReceptionTemplate(ctx: DocTypeContext): string {
  const e = ctx.entreprise || null
  const c = ctx.client || null
  const ch = ctx.chantier || null
  const d = ctx.devis || null

  const objet =
    (ch?.titre || '').toString().trim() ||
    (d?.objet || '').toString().trim() ||
    '________________________'

  const adresseChantier = adresseLigne(
    ch?.adresse_chantier,
    ch?.code_postal_chantier,
    ch?.ville_chantier,
  )

  const refDevis = (d?.numero || '').toString().trim()
  const ligneDevis = refDevis ? `Devis de reference : n ${refDevis}` : 'Devis de reference : ________________'

  const dateDebut = ch?.date_debut ? fmtDateFr(ch.date_debut) : '________________'
  const dateFin = ch?.date_fin_prevue ? fmtDateFr(ch.date_fin_prevue) : '________________'

  return `${DOC_TYPE_DISCLAIMER}

PROCES-VERBAL DE RECEPTION DE TRAVAUX


L'ENTREPRISE

${blocEntreprise(e)}


LE MAITRE D'OUVRAGE (CLIENT)

${clientDisplayName(c)}
${adresseLigne(c?.adresse, c?.code_postal, c?.ville)}


LE CHANTIER

Objet des travaux : ${objet}
Adresse du chantier : ${adresseChantier}
${ligneDevis}
Date de demarrage : ${dateDebut}
Date d'achevement : ${dateFin}


RECEPTION DES TRAVAUX

Les parties, reunies de maniere contradictoire, procedent ce jour a la reception des travaux ci-dessus designes, au sens de l'article 1792-6 du Code civil.

Date de la reception : ________________

Cocher la situation applicable :

[  ] RECEPTION SANS RESERVE
     Le maitre d'ouvrage declare accepter l'ouvrage sans aucune reserve.

[  ] RECEPTION AVEC RESERVES
     Le maitre d'ouvrage accepte l'ouvrage sous les reserves listees ci-dessous.


LISTE DES RESERVES (le cas echeant)

1. ____________________________________________________________________

2. ____________________________________________________________________

3. ____________________________________________________________________

Delai convenu pour la levee des reserves : ________________
(Un proces-verbal de levee de reserves sera etabli apres execution.)


EFFETS DE LA RECEPTION

La reception, meme assortie de reserves, constitue le point de depart des garanties legales :
- Garantie de parfait achevement : 1 an (article 1792-6 du Code civil) ;
- Garantie biennale de bon fonctionnement : 2 ans (article 1792-3 du Code civil) ;
- Garantie decennale : 10 ans (articles 1792, 1792-2 et 1792-4-1 du Code civil).

Sauf reserve expresse, la reception emporte transfert de la garde de l'ouvrage au maitre d'ouvrage.


OBSERVATIONS COMPLEMENTAIRES

______________________________________________________________________

______________________________________________________________________


SIGNATURES

Fait a ________________, le ________________, en deux exemplaires originaux.


Le maitre d'ouvrage (client)                 L'entreprise
Nom : ${clientDisplayName(c)}
Mention "lu et approuve" :                    ${(e?.nom || '').toString().trim() || '________________'}


Signature :                                   Signature et cachet :`
}
