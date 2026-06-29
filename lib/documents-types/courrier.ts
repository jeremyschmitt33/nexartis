/**
 * lib/documents-types/courrier.ts
 * -----------------------------------------------------------------------------
 * Modele "Courrier libre" + bibliotheque de MODELES DE COURRIER par situation.
 *
 * Le PDF (lib/pdf-document-type.ts) ajoute deja l'EN-TETE de l'entreprise
 * (logo, nom, adresse, SIRET, contact) et le titre. Chaque modele ne fournit
 * donc que le CORPS de la lettre : date, destinataire (si client rattache),
 * objet, formule d'appel, texte, formule de politesse, signature.
 *
 * Convention du module (cf. context.ts) : ASCII / caracteres francais de base,
 * sans accents ni puces Unicode (la police PDF helvetica les rend mal). Les
 * variables a completer par l'artisan sont entre crochets : [numero de devis]...
 * Aucune ligne entierement en MAJUSCULES dans le corps (rendue en gras = titre).
 *
 * Sources des modeles : CAPEB, Lettres-Utiles, Organilog, Manuscry, Habitatpresto
 * Pro (situations reelles d'artisans du batiment), adaptes et neutralises.
 */

import {
  type DocTypeContext,
  clientDisplayName,
  adresseLigne,
  fmtDateFr,
} from './context'

// -- Helpers d'en-tete / pied communs a tous les courriers --------------------

function teteCourrier(ctx: DocTypeContext, objet: string): string[] {
  const e = ctx.entreprise || {}
  const c = ctx.client || null
  const ville = (e.ville || '').toString().trim() || '____________'
  const dateDuJour = fmtDateFr(new Date().toISOString())

  const out: string[] = []
  if (c) {
    out.push(clientDisplayName(c))
    const adr = adresseLigne(c.adresse, c.code_postal, c.ville)
    if (adr && !adr.startsWith('____')) out.push(adr)
    out.push('')
  }
  out.push(`${ville}, le ${dateDuJour}`)
  out.push('')
  out.push(`Objet : ${objet}`)
  out.push('')
  out.push('Madame, Monsieur,')
  out.push('')
  return out
}

function piedCourrier(ctx: DocTypeContext): string[] {
  const e = ctx.entreprise || {}
  const signataire = (e.nom || '').toString().trim() || '____________________'
  return [
    '',
    'Je vous prie d\'agreer, Madame, Monsieur, l\'expression de mes salutations distinguees.',
    '',
    signataire,
  ]
}

function build(ctx: DocTypeContext, objet: string, corps: string[]): string {
  return [...teteCourrier(ctx, objet), ...corps, ...piedCourrier(ctx)].join('\n')
}

// -- Courrier vierge (modele par defaut) --------------------------------------

export function generateCourrierTemplate(ctx: DocTypeContext): string {
  return build(ctx, '____________________', [
    'Ecrivez ici le corps de votre courrier. La mise en page, votre',
    'en-tete et votre logo sont ajoutes automatiquement.',
  ])
}

// -- Bibliotheque de modeles par situation ------------------------------------

export interface CourrierModele {
  slug: string
  label: string
  description: string
  /** Avertissement affiche pour les modeles juridiquement sensibles. */
  note?: string
  generate: (ctx: DocTypeContext) => string
}

export const COURRIER_MODELES: CourrierModele[] = [
  {
    slug: 'vierge',
    label: 'Lettre vierge',
    description: 'Page blanche avec votre en-tete. Vous ecrivez tout.',
    generate: generateCourrierTemplate,
  },
  {
    slug: 'accompagnement_devis',
    label: "Accompagnement d'un devis",
    description: 'A joindre au devis envoye, pour inviter a la signature.',
    generate: (ctx) => build(ctx, 'votre devis numero [numero de devis]', [
      'Je vous remercie de la confiance que vous m\'accordez et de l\'interet que vous portez a mon entreprise pour vos travaux de [nature des travaux].',
      '',
      'Vous trouverez ci-joint le devis correspondant a votre projet situe au [adresse du chantier]. Je me suis efforce de repondre au mieux a votre besoin, en privilegiant des materiaux de qualite et une intervention soignee.',
      '',
      'Ce devis est valable [duree de validite] jours a compter de sa date d\'emission. Il reste modifiable : n\'hesitez pas a me contacter pour ajuster certains postes ou obtenir des precisions.',
      '',
      'Pour valider votre commande, il vous suffit de me retourner le devis date et signe avec la mention manuscrite "bon pour accord".',
      '',
      'Je reste a votre disposition pour tout renseignement complementaire et vous remercie par avance de votre retour.',
    ]),
  },
  {
    slug: 'accompagnement_facture',
    label: "Accompagnement d'une facture",
    description: 'A joindre a la facture apres travaux (ce n\'est pas une relance).',
    generate: (ctx) => build(ctx, 'votre facture numero [numero de facture]', [
      'Les travaux de [nature des travaux] realises a votre domicile, [adresse du chantier], sont a present termines. Je vous remercie sincerement de la confiance que vous m\'avez accordee.',
      '',
      'Vous trouverez ci-joint la facture correspondante, d\'un montant de [montant] TTC, etablie conformement au devis numero [numero de devis] que vous aviez accepte.',
      '',
      'Le reglement peut etre effectue par [moyens de paiement] au plus tard le [date d\'echeance]. Les coordonnees utiles au paiement figurent sur la facture.',
      '',
      'Je me tiens a votre disposition pour toute question relative a cette facture ou aux travaux realises.',
    ]),
  },
  {
    slug: 'confirmation_intervention',
    label: 'Confirmation de date d\'intervention',
    description: 'Confirmer par ecrit la date convenue apres accord du devis.',
    generate: (ctx) => build(ctx, 'confirmation de votre intervention du [date d\'intervention]', [
      'Je vous confirme par la presente notre rendez-vous pour la realisation des travaux de [nature des travaux] a votre domicile, [adresse du chantier].',
      '',
      'Date d\'intervention : [date d\'intervention]',
      'Heure d\'arrivee prevue : [heure]',
      'Duree estimee : [duree estimee]',
      '',
      'Notre equipe se presentera a l\'adresse indiquee a l\'horaire convenu. Je vous remercie de vous assurer qu\'une personne majeure soit presente pour nous donner acces aux lieux.',
      '',
      'Si cette date ne vous convenait plus, merci de me prevenir au plus tot au [telephone] afin de convenir d\'un nouveau creneau.',
    ]),
  },
  {
    slug: 'preparation_acces',
    label: 'Preparation du logement et acces',
    description: 'Lister ce que le client doit preparer avant l\'intervention.',
    generate: (ctx) => build(ctx, 'preparation de votre logement avant l\'intervention du [date d\'intervention]', [
      'Afin que les travaux de [nature des travaux] se deroulent dans les meilleures conditions le [date d\'intervention], je vous remercie de bien vouloir preparer les points suivants :',
      '',
      '- Liberer et degager la zone d\'intervention de tout meuble ou objet fragile.',
      '- Permettre un acces facile au [point d\'acces : compteur, arrivee d\'eau, tableau electrique].',
      '- Prevoir une personne majeure presente pour nous ouvrir.',
      '- Dans la mesure du possible, faciliter le stationnement de notre vehicule a proximite.',
      '',
      'Ces quelques precautions nous permettront d\'intervenir plus rapidement et de proteger au mieux votre interieur.',
      '',
      'Je reste a votre disposition pour toute question et vous remercie par avance de votre cooperation.',
    ]),
  },
  {
    slug: 'fin_de_chantier',
    label: 'Information de fin de chantier',
    description: 'Annoncer l\'achevement des travaux. Ce n\'est PAS un PV de reception.',
    note: 'Ce courrier est seulement informatif. Il ne remplace pas le proces-verbal de reception (document signe qui declenche les garanties legales).',
    generate: (ctx) => build(ctx, 'achevement de vos travaux', [
      'J\'ai le plaisir de vous informer que les travaux de [nature des travaux] realises a votre domicile, [adresse du chantier], sont a present termines.',
      '',
      'Ces travaux ont ete executes conformement au devis numero [numero de devis] accepte le [date d\'acceptation].',
      '',
      'Je vous invite a verifier la bonne realisation de l\'ensemble des prestations. Si vous constatez le moindre point necessitant un ajustement, n\'hesitez pas a me le signaler : je m\'engage a y remedier dans les meilleurs delais.',
      '',
      'Je vous remercie de la confiance que vous m\'avez accordee et reste a votre disposition pour tout besoin futur.',
    ]),
  },
  {
    slug: 'remerciement_avis',
    label: 'Remerciement + demande d\'avis',
    description: 'Apres un chantier reussi, remercier et inviter a laisser un avis en ligne.',
    generate: (ctx) => build(ctx, 'merci pour votre confiance', [
      'Je tenais a vous remercier personnellement d\'avoir fait appel a mon entreprise pour vos travaux de [nature des travaux]. Ce fut un plaisir d\'intervenir chez vous et j\'espere que le resultat repond pleinement a vos attentes.',
      '',
      'Si vous etes satisfait de mon travail, un avis en ligne m\'aiderait beaucoup a faire connaitre mon savoir-faire et a rassurer de futurs clients de votre region. Cela ne prend que quelques minutes.',
      '',
      'Vous pouvez laisser votre avis a l\'adresse suivante : [lien avis]',
      '',
      'Quoi qu\'il en soit, je vous remercie encore de votre confiance et reste a votre disposition pour vos projets a venir.',
    ]),
  },
  {
    slug: 'report_chantier',
    label: 'Report / decalage de chantier',
    description: 'Informer d\'un decalage de date (intemperies, retard fournisseur, alea).',
    note: 'Restez courtois et ne vous engagez pas sur une date ferme si vous n\'en etes pas sur. Ne reconnaissez aucune faute par ecrit.',
    generate: (ctx) => build(ctx, 'report de la date de votre intervention', [
      'Je me permets de vous contacter au sujet des travaux de [nature des travaux] prevus a votre domicile, [adresse du chantier], initialement programmes le [date initiale].',
      '',
      'En raison de [motif : conditions meteorologiques, delai d\'approvisionnement, imprevu sur un chantier precedent], je suis contraint de decaler cette intervention. Je vous prie de m\'excuser pour la gene occasionnee et vous remercie de votre comprehension.',
      '',
      'Je vous propose de reprogrammer l\'intervention le [nouvelle date]. Si cette date ne vous convient pas, contactez-moi au [telephone] afin de trouver ensemble un creneau adapte.',
      '',
      'Je reste pleinement mobilise pour realiser vos travaux dans les meilleures conditions et vous remercie de votre patience.',
    ]),
  },
  {
    slug: 'reponse_reclamation',
    label: 'Reponse a une reclamation',
    description: 'Accuser reception d\'un mecontentement et apaiser, sans reconnaitre de faute.',
    note: 'Ne reconnaissez jamais de faute ou de responsabilite par ecrit avant un constat sur place. Ce modele reste volontairement neutre.',
    generate: (ctx) => build(ctx, 'votre recente reclamation', [
      'J\'ai bien recu votre message concernant les travaux de [nature des travaux] realises a votre domicile, [adresse du chantier], et je vous remercie de m\'avoir fait part de votre ressenti.',
      '',
      'Je comprends votre insatisfaction et je prends votre demande tres au serieux. La qualite de mes prestations et la satisfaction de mes clients sont essentielles pour moi.',
      '',
      'Afin d\'examiner la situation precisement, je vous propose de convenir d\'un rendez-vous sur place le [date proposee] pour constater ensemble les points que vous evoquez. Vous pouvez egalement me joindre au [telephone].',
      '',
      'Soyez assure de ma volonte de trouver une solution dans un esprit de dialogue et de confiance mutuelle.',
    ]),
  },
  {
    slug: 'demande_documents',
    label: 'Demande de documents au client',
    description: 'Obtenir des elements necessaires au chantier (plans, autorisations, infos).',
    generate: (ctx) => build(ctx, 'documents necessaires a votre dossier', [
      'Afin de poursuivre la preparation de vos travaux de [nature des travaux] au [adresse du chantier], j\'ai besoin de quelques elements complementaires de votre part :',
      '',
      '- [document ou information 1]',
      '- [document ou information 2]',
      '- [document ou information 3]',
      '',
      'Vous pouvez me transmettre ces elements par retour de courrier ou par email a l\'adresse [email]. Sans ces informations, je ne suis pas en mesure de finaliser [le devis / la commande / la planification].',
      '',
      'Je vous remercie par avance de votre retour et reste a votre disposition pour toute precision.',
    ]),
  },
  {
    slug: 'courrier_fournisseur',
    label: 'Reclamation a un fournisseur',
    description: 'Signaler une livraison non conforme, defectueuse ou en retard.',
    generate: (ctx) => build(ctx, 'reclamation concernant la commande numero [numero de commande]', [
      'Je fais suite a la commande numero [numero de commande] passee le [date de commande] et livree le [date de livraison].',
      '',
      'A la reception, j\'ai constate le probleme suivant : [description : produits manquants, materiel endommage, reference non conforme, retard].',
      '',
      'Cette situation perturbe l\'organisation de mes chantiers. Je vous demande de proceder a [remplacement / completement / avoir / remboursement] dans les meilleurs delais.',
      '',
      'Vous trouverez en piece jointe [bon de livraison / photos / justificatifs] attestant de ce constat.',
      '',
      'Dans l\'attente de votre retour rapide, je vous remercie de votre diligence.',
    ]),
  },
]

/** Retourne un modele de courrier par son slug (ou undefined). */
export function getCourrierModele(slug: string): CourrierModele | undefined {
  return COURRIER_MODELES.find((m) => m.slug === slug)
}
