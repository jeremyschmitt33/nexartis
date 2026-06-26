/**
 * lib/documents-types/index.ts
 * -----------------------------------------------------------------------------
 * Point d'entree de la bibliotheque de documents types. Expose :
 *   - les types et helpers de contexte ;
 *   - les generateurs de modeles (CGV, PV de reception) ;
 *   - un dispatcher generateDocTypeTemplate(type, ctx) ;
 *   - les metadonnees d'affichage (titre, description) pour la page dashboard.
 *
 * Perimetre de cette vague : 'cgv' et 'pv_reception'. Le contrat de
 * sous-traitance viendra dans une vague ulterieure.
 */

import { DocTypeContext } from './context'
import { generateCgvTemplate } from './cgv'
import { generatePvReceptionTemplate } from './pv-reception'

export * from './context'
export { generateCgvTemplate } from './cgv'
export { generatePvReceptionTemplate } from './pv-reception'

/** Identifiants de type (alignes sur la contrainte CHECK de la table SQL). */
export type DocTypeKind = 'cgv' | 'pv_reception'

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
  icon: 'ScrollText' | 'ClipboardCheck'
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
    default:
      return ''
  }
}
