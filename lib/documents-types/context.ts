/**
 * lib/documents-types/context.ts
 * -----------------------------------------------------------------------------
 * Types et helpers partages pour la generation des modeles de documents types
 * (CGV, PV de reception). Les modeles renvoient un TEXTE pre-rempli et EDITABLE
 * par l'artisan (meme philosophie que lib/pacte-chantier.ts).
 *
 * IMPORTANT : le PDF utilise helvetica (police par defaut jsPDF) qui ne supporte
 * PAS les caracteres Unicode etendus (puces rondes, fleches, etc.). On reste
 * donc en ASCII + caracteres francais de base. Les "titres" sont en MAJUSCULES.
 */

/** Vue minimale de l'entreprise pour pre-remplir les modeles. */
export interface DocTypeEntreprise {
  nom?: string | null
  forme_juridique?: string | null
  siret?: string | null
  tva_intracommunautaire?: string | null
  code_naf?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  franchise_tva?: boolean | null
  conditions_paiement?: string | null
  delai_paiement_defaut?: string | null
  decennale_numero?: string | null
  assurance_nom?: string | null
  mediateur_nom?: string | null
  mediateur_adresse?: string | null
  mediateur_code_postal?: string | null
  mediateur_ville?: string | null
  [key: string]: unknown
}

/** Vue minimale du client (optionnel — rattachement). */
export interface DocTypeClient {
  prenom?: string | null
  nom?: string | null
  raison_sociale?: string | null
  type?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}

/** Vue minimale du chantier / devis (optionnel — rattachement). */
export interface DocTypeChantier {
  titre?: string | null
  adresse_chantier?: string | null
  code_postal_chantier?: string | null
  ville_chantier?: string | null
  date_debut?: string | null
  date_fin_prevue?: string | null
}

export interface DocTypeDevis {
  numero?: string | null
  objet?: string | null
  montant_ttc?: number | null
}

/** Contexte complet passe aux generateurs de modeles. */
export interface DocTypeContext {
  entreprise?: DocTypeEntreprise | null
  client?: DocTypeClient | null
  chantier?: DocTypeChantier | null
  devis?: DocTypeDevis | null
}

/** Disclaimer affiche en tete de chaque modele. */
export const DOC_TYPE_DISCLAIMER =
  'Modele fourni a titre indicatif, ne constitue pas un conseil juridique. A adapter a votre situation.'

/** Format date FR longue : "13 avril 2026". */
export function fmtDateFr(d: string | null | undefined): string {
  if (!d) return '________________'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '________________'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Nom affichable du client (raison sociale en priorite, sinon prenom + nom). */
export function clientDisplayName(c: DocTypeClient | null | undefined): string {
  if (!c) return '________________________'
  const rs = (c.raison_sociale || '').toString().trim()
  if (rs) return rs
  const full = [c.prenom, c.nom].filter(Boolean).join(' ').trim()
  return full || '________________________'
}

/** Adresse postale sur une ligne. */
export function adresseLigne(
  adresse?: string | null,
  cp?: string | null,
  ville?: string | null,
): string {
  const cpVille = [cp, ville].filter(Boolean).join(' ').trim()
  const parts = [adresse, cpVille].filter(Boolean)
  return parts.length ? parts.join(', ') : '________________________'
}

/**
 * true si l'entreprise est en franchise en base de TVA (auto-entrepreneur /
 * micro / EI). Reprend la logique de lib/helpers.ts isAutoEntrepreneur sans
 * creer de dependance circulaire.
 */
export function isFranchiseTva(e: DocTypeEntreprise | null | undefined): boolean {
  if (!e) return false
  if (e.franchise_tva === true) return true
  const fj = (e.forme_juridique || '').toString().toLowerCase().trim()
  return (
    fj.includes('micro') ||
    fj === 'ei' ||
    fj.includes('entreprise individuelle') ||
    fj.includes('auto')
  )
}

/** Bloc identification entreprise (commun CGV + PV). */
export function blocEntreprise(e: DocTypeEntreprise | null | undefined): string {
  const nom = (e?.nom || '').toString().trim() || '________________________'
  const lignes: string[] = [nom]
  const adr = adresseLigne(e?.adresse, e?.code_postal, e?.ville)
  lignes.push(adr)
  const siret = (e?.siret || '').toString().trim()
  if (siret) lignes.push(`SIRET : ${siret}`)
  const naf = (e?.code_naf || '').toString().trim()
  if (naf) lignes.push(`Code APE/NAF : ${naf}`)
  if (!isFranchiseTva(e)) {
    const tva = (e?.tva_intracommunautaire || '').toString().trim()
    if (tva) lignes.push(`TVA intracommunautaire : ${tva}`)
  }
  const contact = [e?.telephone, e?.email].filter(Boolean).join(' - ')
  if (contact) lignes.push(contact)
  return lignes.join('\n')
}
