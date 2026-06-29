/**
 * lib/documents-types/index.ts
 * -----------------------------------------------------------------------------
 * Point d'entree de la bibliotheque de documents types. Expose :
 *   - les types et helpers de contexte ;
 *   - les generateurs de modeles (CGV, PV de reception, Courrier libre) ;
 *   - un dispatcher generateDocTypeTemplate(type, ctx) ;
 *   - les metadonnees d'affichage (titre, description) pour la page dashboard.
 *
 * Perimetre actuel : 'cgv', 'pv_reception' et 'courrier'. Le contrat de
 * sous-traitance viendra dans une vague ulterieure.
 */

import { DocTypeContext } from './context'
import { generateCgvTemplate } from './cgv'
import { generatePvReceptionTemplate } from './pv-reception'
import { generateCourrierTemplate } from './courrier'

export * from './context'
export { generateCgvTemplate } from './cgv'
export { generatePvReceptionTemplate } from './pv-reception'
export {
  generateCourrierTemplate,
  COURRIER_MODELES,
  getCourrierModele,
  type CourrierModele,
} from './courrier'

/** Identifiants de type (alignes sur la contrainte CHECK de la table SQL). */
export type DocTypeKind = 'cgv' | 'pv_reception' | 'courrier'

/** Metadonnees d'affichage d'un modele dans la page dashboard. */
export interface DocTypeMeta {
  type: DocTypeKind
  /** Titre par defaut donne au document cree (modifiable). */
  titre: string
  /** Libelle court affiche sur la carte. */
  label: string
  /** Description courte affichee sur la carte. */
  description: string
  /** Nom d'icone lucide-react (resolu cote composant). */
  icon: 'ScrollText' | 'ClipboardCheck' | 'Mail'
}

/** Liste ordonnee des modeles disponibles (source unique pour l'UI). */
export const DOC_TYPES_META: DocTypeMeta[] = [
  {
    type: 'cgv',
    titre: 'Conditions Generales de Vente',
    label: 'CGV',
    description:
      'Conditions generales de vente pre-remplies a partir de votre profil : prix, paiement, garanties, retractation, mediation.',
    icon: 'ScrollText',
  },
  {
    type: 'pv_reception',
    titre: 'Proces-verbal de reception',
    label: 'PV de reception de chantier',
    description:
      'Proces-verbal de reception des travaux avec ou sans reserves, point de depart des garanties, et blocs de signature.',
    icon: 'ClipboardCheck',
  },
  {
    type: 'courrier',
    titre: 'Courrier',
    label: 'Courrier libre',
    description:
      'Une lettre vierge avec votre en-tete et votre logo. Ecrivez ce que vous voulez : la mise en page est automatique. Liez un client pour pre-remplir le destinataire.',
    icon: 'Mail',
  },
]

/** Retourne la metadonnee d'un type donne (ou undefined). */
export function getDocTypeMeta(type: string): DocTypeMeta | undefined {
  return DOC_TYPES_META.find((m) => m.type === type)
}

/** Dispatcher : genere le texte pre-rempli du modele demande. */
export function generateDocTypeTemplate(type: DocTypeKind, ctx: DocTypeContext): string {
  switch (type) {
    case 'cgv':
      return generateCgvTemplate(ctx)
    case 'pv_reception':
      return generatePvReceptionTemplate(ctx)
    case 'courrier':
      return generateCourrierTemplate(ctx)
    default:
      return ''
  }
}
