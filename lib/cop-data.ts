// ============================================================================
// lib/cop-data.ts
// ----------------------------------------------------------------------------
// SOURCE UNIQUE de donnees pour le "Contrat d'ouverture de porte" (COP).
// Calque lib/document-data.ts : on REUTILISE buildArtisan (via un mini-adaptateur
// local base sur les memes champs), eur() et tauxLabel().
//
// Phase 1a : aucune logique de signature ici (elle viendra en 1b).
// ============================================================================

import {
  eur,
  tauxLabel,
  type DocumentArtisan,
  type RawEntreprise,
} from '@/lib/document-data'

export { eur, tauxLabel }

// Email de contact Nexartis (RGPD — droits d'acces / effacement).
const CONTACT_EMAIL = 'contact.nexartis@gmail.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopLigne {
  designation: string
  quantite: number
  unite: string
  pu_ht: number
  tva_taux: number
}

export interface CopClient {
  nom: string
  prenom?: string
  adresse?: string
  cp?: string
  ville?: string
}

export interface CopMeta {
  numero: string
  dateIntervention: string // deja formatee fr-FR (date + heure)
  lieu: string
}

export interface CopTvaLine {
  taux: number
  base: number
  montant: number
}

export interface CopTotals {
  ht: number
  tva: number
  ttc: number
  parTaux: CopTvaLine[]
}

export interface CopLegal {
  attestation: string
  prixFerme: string
  renonciation: string[] // 3 mentions
  blocB: string
  rgpd: string
}

export interface CopData {
  artisan: DocumentArtisan
  client: CopClient
  meta: CopMeta
  lignes: CopLigne[]
  totals: CopTotals
  statutOccupant?: 'locataire' | 'proprietaire'
  pieceNature?: string
  identiteVerifiee: boolean
  natureUrgence?: string
  statut?: string
  clientSignatureBase64?: string
  signedBy?: string
  dateSignature?: string // formatee fr-FR (date + heure)
}

// ---------------------------------------------------------------------------
// Raw input (shape brut : formulaire / DB)
// ---------------------------------------------------------------------------

export interface RawCop {
  numero?: string | null
  client_nom?: string | null
  client_prenom?: string | null
  client_adresse?: string | null
  client_cp?: string | null
  client_ville?: string | null
  statut_occupant?: 'locataire' | 'proprietaire' | null
  identite_verifiee?: boolean | null
  piece_nature?: string | null
  date_intervention?: string | null
  lieu?: string | null
  lignes?: CopLigne[] | null
  nature_urgence?: string | null
  statut?: string | null
  client_signature_base64?: string | null
  signed_by?: string | null
  date_signature?: string | null
}

// ---------------------------------------------------------------------------
// Helpers date
// ---------------------------------------------------------------------------

// Date + heure au format fr-FR (ex "01/07/2026 a 22:30"). Vide si non fournie.
function fmtDateHeure(d: string | null | undefined): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const date = dt.toLocaleDateString('fr-FR')
    const heure = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `${date} a ${heure}`
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Artisan (reutilise EXACTEMENT le mapping de document-data via RawEntreprise)
// ---------------------------------------------------------------------------
// buildArtisan n'est pas exporte par document-data ; on reconstruit ici le meme
// DocumentArtisan a partir des memes champs RawEntreprise pour garantir la parite
// visuelle avec les devis (memes cartes Emetteur, meme pied de page).

function buildArtisanFromEntreprise(ent: RawEntreprise): DocumentArtisan {
  const adresseLine1 = (ent.adresse ?? '').trim()
  const adresseLine2 = [(ent.code_postal ?? '').trim(), (ent.ville ?? '').trim()]
    .filter(Boolean)
    .join(' ')

  const assuranceParts: string[] = []
  if (ent.assurance_nom) assuranceParts.push(ent.assurance_nom)
  if (ent.decennale_numero) assuranceParts.push(`Garantie decennale n° ${ent.decennale_numero}`)
  if (ent.assurance_zone) assuranceParts.push(`Zone : ${ent.assurance_zone}`)
  const assurance = assuranceParts.length > 0 ? assuranceParts.join(' — ') : undefined

  const medParts: string[] = []
  if (ent.mediateur_nom) medParts.push(ent.mediateur_nom)
  const medLoc = [
    ent.mediateur_adresse,
    [ent.mediateur_code_postal, ent.mediateur_ville].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')
  if (medLoc) medParts.push(medLoc)
  const mediateurFromFields = medParts.length > 0 ? medParts.join(' — ') : undefined

  return {
    nom: ent.nom ?? '',
    baseline: ent.metier ?? '',
    adresseLine1,
    adresseLine2,
    siret: ent.siret ?? undefined,
    tvaIntra: ent.tva_intracommunautaire ?? undefined,
    tel: ent.telephone ?? undefined,
    email: ent.email ?? undefined,
    iban: ent.iban ?? undefined,
    bic: ent.bic ?? undefined,
    logoUrl: ent.logo_url ?? undefined,
    signatureBase64: ent.signature_base64 ?? undefined,
    tamponBase64: ent.tampon_base64 ?? undefined,
    assurance,
    rcs: ent.rcs_rm ?? undefined,
    ape: ent.code_naf ?? undefined,
    formeJuridique: ent.forme_juridique ?? undefined,
    mediateurNom: ent.mediateur_nom ?? undefined,
    mediateurAdresse: mediateurFromFields ?? ent.mediateur ?? undefined,
    mediateurCp: ent.mediateur_code_postal ?? undefined,
    mediateurVille: ent.mediateur_ville ?? undefined,
    isAutoEntrepreneur: Boolean(ent.auto_entrepreneur ?? ent.franchise_tva),
  }
}

// ---------------------------------------------------------------------------
// Totaux (somme par taux) — arrondi 2 decimales
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function computeCopTotals(lignes: CopLigne[]): CopTotals {
  let ht = 0
  const parTauxMap: Record<string, number> = {}

  for (const l of lignes) {
    const totalLigne = (Number(l.quantite) || 0) * (Number(l.pu_ht) || 0)
    ht += totalLigne
    const key = String(Number(l.tva_taux) || 0)
    parTauxMap[key] = (parTauxMap[key] ?? 0) + totalLigne
  }

  const parTaux: CopTvaLine[] = Object.keys(parTauxMap)
    .map((k) => Number(k))
    .filter((taux) => taux > 0)
    .sort((a, b) => a - b)
    .map((taux) => ({
      taux,
      base: round2(parTauxMap[String(taux)]),
      montant: round2(parTauxMap[String(taux)] * (taux / 100)),
    }))

  const tva = parTaux.reduce((s, l) => s + l.montant, 0)
  return {
    ht: round2(ht),
    tva: round2(tva),
    ttc: round2(ht + tva),
    parTaux,
  }
}

// ---------------------------------------------------------------------------
// Textes legaux (constantes) — interpolation des {…} a la construction
// ---------------------------------------------------------------------------

function buildLegal(opts: {
  clientNomComplet: string
  statutOccupant?: 'locataire' | 'proprietaire'
  adresseComplete: string
  entrepriseNom: string
  ttc: number
}): CopLegal {
  const { clientNomComplet, statutOccupant, adresseComplete, entrepriseNom, ttc } = opts
  const nom = clientNomComplet || '…'
  const statut = statutOccupant === 'proprietaire' ? 'proprietaire' : statutOccupant === 'locataire' ? 'locataire' : 'occupant'
  const adresse = adresseComplete || '…'
  const entreprise = entrepriseNom || "l'entreprise"

  const attestation =
    `Je soussigne(e) ${nom}, ${statut} du logement situe ${adresse}, atteste etre en droit d'y acceder ` +
    `et requiers expressement ${entreprise} pour proceder a l'ouverture de la ou des fermetures de condamnation ` +
    `de la porte, PAR TOUS LES MOYENS CONVENABLES. Le choix de la technique d'ouverture releve du professionnel ; ` +
    `j'accepte que l'ouverture puisse necessiter une intervention destructive (notamment le percage du cylindre) ` +
    `et j'y consens expressement. La presente attestation vaut reconnaissance de mon droit d'acces et acceptation ` +
    `des moyens techniques employes ; elle ne degage pas l'entreprise de sa responsabilite en cas de faute ` +
    `professionnelle dans l'execution.`

  const prixFerme =
    `Le prix de l'ouverture d'urgence est fixe fermement a ${eur(ttc)} TTC selon le bareme ci-dessus. ` +
    `Aucun supplement ne sera facture pour cette prestation d'ouverture. Toute prestation supplementaire ` +
    `(remise en etat, remplacement de serrure/cylindre, fournitures) fera l'objet d'un devis complementaire ` +
    `chiffre et signe avant toute execution.`

  const renonciation = [
    `Je suis informe(e) que, s'agissant d'un contrat conclu hors etablissement, je dispose en principe d'un delai de retractation de 14 jours.`,
    `Je demande expressement l'execution immediate de l'ouverture, avant la fin de ce delai, en raison de son caractere urgent (art. L221-2 et L221-28 du Code de la consommation).`,
    `Je reconnais qu'une fois l'ouverture d'urgence executee, je ne beneficie plus du droit de retractation pour cette seule prestation.`,
  ]

  const blocB =
    `La remise en etat (remplacement de serrure/cylindre, reparation, fournitures) n'a pas de caractere urgent : ` +
    `elle fera l'objet d'un devis distinct pour lequel vous conservez un droit de retractation de 14 jours.`

  const rgpd =
    `L'identite de l'occupant est verifiee sur place par l'intervenant a seule fin d'etablir son droit d'acces ` +
    `au logement (interet legitime). Aucune copie ni numero de piece d'identite n'est conserve. Le present contrat ` +
    `est conserve pour la duree de prescription applicable. Droits d'acces et d'effacement : ${CONTACT_EMAIL}.`

  return { attestation, prixFerme, renonciation, blocB, rgpd }
}

// ---------------------------------------------------------------------------
// Builder principal
// ---------------------------------------------------------------------------

export function buildCopDocument(raw: RawCop, entreprise: RawEntreprise): CopData & { legal: CopLegal } {
  const artisan = buildArtisanFromEntreprise(entreprise)
  const lignes = (raw.lignes ?? []).map((l) => ({
    designation: l.designation ?? '',
    quantite: Number(l.quantite) || 0,
    unite: (l.unite ?? '').toString(),
    pu_ht: Number(l.pu_ht) || 0,
    tva_taux: Number(l.tva_taux) || 0,
  }))
  const totals = computeCopTotals(lignes)

  const nomComplet = [raw.client_prenom, raw.client_nom].filter(Boolean).join(' ').trim()
  const adresseComplete = [
    raw.client_adresse,
    [raw.client_cp, raw.client_ville].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const legal = buildLegal({
    clientNomComplet: nomComplet,
    statutOccupant: raw.statut_occupant ?? undefined,
    adresseComplete,
    entrepriseNom: artisan.nom,
    ttc: totals.ttc,
  })

  return {
    artisan,
    client: {
      nom: raw.client_nom ?? '',
      prenom: raw.client_prenom ?? undefined,
      adresse: raw.client_adresse ?? undefined,
      cp: raw.client_cp ?? undefined,
      ville: raw.client_ville ?? undefined,
    },
    meta: {
      numero: raw.numero ?? '—',
      dateIntervention: fmtDateHeure(raw.date_intervention),
      lieu: raw.lieu ?? '',
    },
    lignes,
    totals,
    statutOccupant: raw.statut_occupant ?? undefined,
    pieceNature: raw.piece_nature ?? undefined,
    identiteVerifiee: Boolean(raw.identite_verifiee),
    natureUrgence: raw.nature_urgence ?? undefined,
    statut: raw.statut ?? undefined,
    clientSignatureBase64: raw.client_signature_base64 ?? undefined,
    signedBy: raw.signed_by ?? undefined,
    dateSignature: fmtDateHeure(raw.date_signature) || undefined,
    legal,
  }
}

// ---------------------------------------------------------------------------
// Prereglage du bareme par defaut depuis les colonnes cop_* de l'entreprise
// ---------------------------------------------------------------------------

// entreprise est volontairement large (Record) car les colonnes cop_* ne sont
// pas toutes typees dans EntrepriseRecord (ajoutees dynamiquement via [key]).
export function defaultCopLignes(entreprise: Record<string, unknown> | null | undefined): CopLigne[] {
  const tvaDefaut = numOrNull(entreprise?.tva_defaut) ?? 10
  const forfaitOuv = numOrNull(entreprise?.cop_forfait_ouverture_ht)
  const forfaitDepl = numOrNull(entreprise?.cop_forfait_deplacement_ht)

  const lignes: CopLigne[] = [
    {
      designation: 'Ouverture de porte (intervention d\'urgence)',
      quantite: 1,
      unite: 'forfait',
      pu_ht: forfaitOuv ?? 0,
      tva_taux: tvaDefaut,
    },
  ]

  if (forfaitDepl != null && forfaitDepl > 0) {
    lignes.push({
      designation: 'Deplacement',
      quantite: 1,
      unite: 'forfait',
      pu_ht: forfaitDepl,
      tva_taux: tvaDefaut,
    })
  }

  return lignes
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
