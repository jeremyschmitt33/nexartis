/**
 * lib/documents-types/cgv.ts
 * -----------------------------------------------------------------------------
 * Modele de Conditions Generales de Vente (CGV) pour artisan du batiment.
 * Texte sobre, generique et prudent, pre-rempli depuis le profil entreprise.
 * Editable librement par l'artisan avant enregistrement / export PDF.
 *
 * Sources : service-public.fr, economie.gouv.fr, Legifrance (verifie 2026).
 * Points cles confirmes par recherche juridique :
 *   - Retractation 14 j (L221-18 C. conso.) : delai court a compter de la
 *     CONCLUSION du contrat pour des travaux (prestation de services), pas
 *     de la reception.
 *   - Decennale : art. 1792-4-1 C. civ. (et NON l'ancien 2270, obsolete 2008).
 *   - Penalites de retard B2B : L441-10 C. com. (formule, pas de % fige) +
 *     indemnite forfaitaire 40 EUR (D441-5 C. com.).
 *   - Franchise TVA : "TVA non applicable, art. 293 B du CGI" (valable 2026).
 *   - Acompte vs arrhes : en B2C la presomption legale par defaut = arrhes
 *     (L214-1 C. conso.) ; pour engager fermement le client, on ecrit ACOMPTE.
 *   - Mediation conso : L616-1 C. conso. (obligatoire vente aux particuliers).
 */

import {
  DocTypeContext,
  DOC_TYPE_DISCLAIMER,
  blocEntreprise,
  isFranchiseTva,
} from './context'

export function generateCgvTemplate(ctx: DocTypeContext): string {
  const e = ctx.entreprise || null
  const nom = (e?.nom || '').toString().trim() || 'l\'entreprise'
  const franchise = isFranchiseTva(e)

  const delaiPaiement = (e?.delai_paiement_defaut || '').toString().trim() || '30 jours'
  const conditionsPaiement =
    (e?.conditions_paiement || '').toString().trim() ||
    '30 % a la commande, solde a la reception des travaux'

  // Bloc TVA : franchise (AE) ou regime normal.
  const blocTva = franchise
    ? `Les prix sont exprimes en euros, nets de TVA.
TVA non applicable, article 293 B du Code General des Impots (franchise en base de TVA).`
    : `Les prix sont exprimes en euros hors taxes (HT). La TVA applicable est celle en vigueur au jour de la facturation, selon le taux legal correspondant a la nature des travaux (20 %, 10 % ou 5,5 % selon les cas).`

  // Decennale : on mentionne l'assureur / numero si renseignes.
  const assureur = (e?.assurance_nom || '').toString().trim()
  const decNum = (e?.decennale_numero || '').toString().trim()
  const blocDecennale =
    assureur || decNum
      ? `${nom} est couverte par une assurance de responsabilite civile decennale${assureur ? ` souscrite aupres de ${assureur}` : ''}${decNum ? ` (police n ${decNum})` : ''}, conformement aux articles 1792 et suivants du Code civil et a l'article L241-1 du Code des assurances.`
      : `${nom} est couverte par une assurance de responsabilite civile decennale, conformement aux articles 1792 et suivants du Code civil et a l'article L241-1 du Code des assurances. L'attestation est disponible sur simple demande.`

  // Mediateur : depuis les sous-champs structures s'ils existent.
  const medNom = (e?.mediateur_nom || '').toString().trim()
  const medAdr = [e?.mediateur_adresse, [e?.mediateur_code_postal, e?.mediateur_ville].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const blocMediateur = medNom
    ? `Conformement a l'article L616-1 du Code de la consommation, en cas de litige non resolu, le client consommateur peut recourir gratuitement au mediateur de la consommation suivant : ${medNom}${medAdr ? `, ${medAdr}` : ''}.`
    : `Conformement aux articles L616-1 et L612-1 du Code de la consommation, en cas de litige non resolu, le client consommateur peut recourir gratuitement a un mediateur de la consommation. Les coordonnees du mediateur dont releve l'entreprise sont communiquees sur demande et figurent sur les documents contractuels.`

  return `${DOC_TYPE_DISCLAIMER}

CONDITIONS GENERALES DE VENTE

${blocEntreprise(e)}


ARTICLE 1 - OBJET ET CHAMP D'APPLICATION

Les presentes conditions generales de vente (CGV) regissent les relations contractuelles entre ${nom}, ci-apres "l'entreprise", et tout client ayant accepte un devis de l'entreprise, ci-apres "le client". Elles s'appliquent a l'ensemble des prestations de travaux et services proposes par l'entreprise. Toute commande implique l'acceptation sans reserve des presentes CGV.


ARTICLE 2 - DEVIS ET FORMATION DU CONTRAT

Chaque prestation fait l'objet d'un devis detaille et gratuit, valable pour la duree qui y est indiquee. Le contrat est forme a la date de signature du devis par le client, portant la mention "bon pour accord". Toute modification demandee en cours de chantier fait l'objet d'un devis complementaire signe avant execution.


ARTICLE 3 - PRIX ET TVA

Les prix sont ceux figurant sur le devis accepte. ${blocTva}


ARTICLE 4 - ACOMPTE ET MODALITES DE PAIEMENT

Sauf mention contraire au devis, un acompte peut etre demande a la commande. Lorsque le devis prevoit le versement d'une somme a la commande, celle-ci constitue un ACOMPTE et engage definitivement les deux parties a la realisation de la prestation (les sommes versees ne constituent pas des arrhes au sens de l'article 1590 du Code civil, sauf mention expresse contraire).

Modalites de paiement : ${conditionsPaiement}.
Delai de paiement des factures : ${delaiPaiement} a compter de la date de facturation.
Moyens de paiement acceptes : virement bancaire, cheque, especes (dans les limites legales).


ARTICLE 5 - DELAIS D'EXECUTION ET ALEAS

Les delais indiques sur le devis sont donnes a titre indicatif et courent a compter de l'encaissement de l'acompte et de la reunion des conditions necessaires au demarrage (acces, autorisations, approvisionnement). L'entreprise ne saurait etre tenue responsable des retards resultant d'un cas de force majeure, d'intemperies, du fait du client ou de tiers, ou de la decouverte d'aleas techniques non decelables avant travaux. Tout alea fait l'objet d'une information transparente et, le cas echeant, d'un devis complementaire signe.


ARTICLE 6 - RECEPTION DES TRAVAUX

A l'achevement des travaux, le client est invite a en prendre reception. La reception est l'acte par lequel le client declare accepter l'ouvrage, avec ou sans reserves (article 1792-6 du Code civil). Elle peut etre constatee par un proces-verbal signe des deux parties. La reception constitue le point de depart des garanties legales.


ARTICLE 7 - GARANTIES LEGALES

Les travaux beneficient des garanties legales applicables au secteur du batiment, courant a compter de la reception :
- Garantie de parfait achevement : 1 an (article 1792-6 du Code civil) ;
- Garantie biennale de bon fonctionnement des elements d'equipement dissociables : 2 ans (article 1792-3 du Code civil) ;
- Garantie decennale pour les dommages compromettant la solidite de l'ouvrage ou le rendant impropre a sa destination : 10 ans (articles 1792, 1792-2 et 1792-4-1 du Code civil).

${blocDecennale}


ARTICLE 8 - DROIT DE RETRACTATION (CLIENT CONSOMMATEUR)

Lorsque le contrat est conclu hors etablissement avec un client consommateur (a son domicile par exemple), celui-ci dispose d'un delai de retractation de 14 jours a compter de la conclusion du contrat, sans avoir a motiver sa decision (articles L221-18 et suivants du Code de la consommation). Un formulaire type de retractation est remis au client avec le contrat. Si le client souhaite que les travaux debutent avant l'expiration de ce delai, il doit en faire la demande expresse sur support durable ; il reste alors redevable du cout des prestations deja realisees. Des exceptions legales au droit de retractation existent (article L221-28 du Code de la consommation), notamment en cas d'urgence sollicitee expressement par le client.


ARTICLE 9 - RETARD DE PAIEMENT (CLIENT PROFESSIONNEL)

En cas de retard de paiement par un client professionnel, des penalites de retard sont exigibles de plein droit, sans rappel prealable, au taux d'interet legal majore, sans pouvoir etre inferieures a trois fois le taux d'interet legal en vigueur (article L441-10 du Code de commerce). S'y ajoute une indemnite forfaitaire pour frais de recouvrement de 40 euros (article D441-5 du Code de commerce). Aucun escompte n'est accorde pour paiement anticipe.


ARTICLE 10 - RESERVE DE PROPRIETE

Les materiaux et fournitures restent la propriete de l'entreprise jusqu'au paiement integral du prix par le client.


ARTICLE 11 - MEDIATION DE LA CONSOMMATION

${blocMediateur}


ARTICLE 12 - DONNEES PERSONNELLES (RGPD)

Les donnees personnelles du client sont collectees aux seules fins de l'execution du contrat, de la facturation et du suivi de la relation commerciale. Elles sont conservees pendant la duree legale et ne sont pas cedees a des tiers sans necessite contractuelle ou legale. Conformement au Reglement (UE) 2016/679 (RGPD) et a la loi Informatique et Libertes, le client dispose d'un droit d'acces, de rectification, d'effacement et d'opposition, qu'il peut exercer aupres de l'entreprise.


ARTICLE 13 - DROIT APPLICABLE ET LITIGES

Les presentes CGV sont soumises au droit francais. En cas de litige, et apres recherche d'une solution amiable (et, pour les consommateurs, recours possible a la mediation), les tribunaux competents sont ceux du ressort du siege de l'entreprise, sous reserve des regles imperatives de competence applicables aux consommateurs.


Fait a ________________, le ________________.

L'entreprise : ${nom}                       Le client (mention "lu et approuve") :`
}
