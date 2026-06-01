// -------------------------------------------------------------------
// Server-side PDF generation for devis & factures
// jsPDF + jspdf-autotable
// Refonte v2 : hiérarchie 3 niveaux (sections / sous-sections / prestations),
// nouvelle palette Nexartis, factures de situation, footer répété.
// -------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellHookData, Styles } from 'jspdf-autotable'
// V2.4a — Source unique de verite des mentions TVA (parite stricte HTML/PDF).
// On garde l'import limite aux 3 constantes ; lib/legal-mentions.ts est
// server-safe (pas de dependance React/DOM).
import {
  TVA_MENTION_10 as LEGAL_TVA_MENTION_10,
  TVA_MENTION_5_5 as LEGAL_TVA_MENTION_5_5,
  TVA_MENTION_AE as LEGAL_TVA_MENTION_AE,
} from '@/lib/legal-mentions'

// -------------------------------------------------------------------
// Palette Nexartis (RGB)
// jsPDF ne supporte pas l'alpha sur setFillColor : on utilise les
// équivalents solides calculés sur fond blanc pour les zones « avec
// opacité » (cadres artisan/client, bandeau objet, etc.).
// -------------------------------------------------------------------

const C = {
  navy: [15, 26, 58] as [number, number, number],          // #0f1a3a
  navyText: [15, 26, 58] as [number, number, number],
  sky: [90, 180, 224] as [number, number, number],         // #5ab4e0
  skySection: [168, 212, 236] as [number, number, number], // #a8d4ec (fond section tableau)
  skyPale: [220, 238, 250] as [number, number, number],    // #dceefa
  skyVeryPale: [232, 244, 251] as [number, number, number],// #e8f4fb (objet)
  skyArtisanBg: [230, 243, 251] as [number, number, number], // #e6f3fb (fond cadre artisan pale)
  skyBorder: [171, 214, 236] as [number, number, number],  // #abd6ec (bordure 40%)
  netBlue: [26, 111, 181] as [number, number, number],     // #1a6fb5 (NET A PAYER, accents)
  netBlueAccent: [45, 139, 201] as [number, number, number], // #2d8bc9
  green: [34, 197, 94] as [number, number, number],        // #22c55e
  greenDark: [21, 128, 61] as [number, number, number],    // #15803d
  greenPale: [230, 247, 235] as [number, number, number],  // #e6f7eb (fond cadre client pale)
  greenBorder: [168, 216, 185] as [number, number, number],// #a8d8b9
  orange: [232, 122, 42] as [number, number, number],      // #e87a2a
  muted: [95, 108, 128] as [number, number, number],       // #5f6c80
  border: [230, 236, 242] as [number, number, number],     // #e6ecf2
  white: [255, 255, 255] as [number, number, number],
  black: [40, 40, 40] as [number, number, number],
  grayLightBg: [249, 250, 251] as [number, number, number], // #f9fafb (fond récap totaux)
  // Filet de sécurité — bannière "mentions légales incomplètes"
  amberBg: [254, 243, 199] as [number, number, number],    // #fef3c7 (amber-100)
  amberBorder: [252, 211, 77] as [number, number, number], // #fcd34d (amber-300)
  amberText: [120, 53, 15] as [number, number, number],    // #78350f (amber-900)
  amberAccent: [180, 83, 9] as [number, number, number],   // #b45309 (amber-700)
}

// ─────────────────────────────────────────────────────────────
// Détection profil entreprise incomplet (mentions légales)
// ─────────────────────────────────────────────────────────────
//
// Doit rester en miroir avec lib/helpers.ts (CHAMPS_LEGAUX_DEVIS).
// On ne fait pas l'import depuis helpers pour garder ce fichier
// 100% server-safe et autonome.

const CHAMPS_LEGAUX_PDF: { champ: string; label: string }[] = [
  { champ: 'nom', label: 'Raison sociale' },
  { champ: 'siret', label: 'SIRET' },
  { champ: 'forme_juridique', label: 'Forme juridique' },
  { champ: 'adresse', label: 'Adresse' },
  { champ: 'code_postal', label: 'Code postal' },
  { champ: 'ville', label: 'Ville' },
]

function getChampsLegauxManquants(ent: Record<string, unknown> | null | undefined): string[] {
  if (!ent) return CHAMPS_LEGAUX_PDF.map(c => c.label)
  return CHAMPS_LEGAUX_PDF
    .filter(c => {
      const val = ent[c.champ]
      return !val || String(val).trim() === ''
    })
    .map(c => c.label)
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function fmt(n: number): string {
  // Bug fix (V8) : Intl.NumberFormat('fr-FR') retourne un narrow no-break space U+202F
  // (Node >= 18) ou un no-break space U+00A0 (anciens runtimes) comme separateur de milliers.
  // La police Helvetica de jsPDF ne sait pas dessiner ces glyphes et affiche un caractere
  // casse en prod ("40/000,00 €" au lieu de "40 000,00 €"). On normalise donc tous
  // les espaces unicode vers un espace ASCII standard.
  const raw = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  // U+00A0 no-break, U+202F narrow no-break, U+2009 thin space
  const safe = raw.replace(/[\u00a0\u202f\u2009]/g, ' ')
  return safe + ' €'
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

function setFill(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]) }
function setDraw(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]) }
function setText(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]) }

// -------------------------------------------------------------------
// Interfaces
// -------------------------------------------------------------------

interface Entreprise {
  nom?: string
  adresse?: string
  code_postal?: string
  ville?: string
  siret?: string
  telephone?: string
  email?: string
  forme_juridique?: string
  capital_social?: string
  rcs_rm?: string
  tva_intracommunautaire?: string
  franchise_tva?: boolean
  assurance_nom?: string
  decennale_numero?: string
  assurance_zone?: string
  qualification_pro?: string
  mentions_legales_custom?: string
  couleur_principale?: string
  logo_url?: string
  signature_base64?: string
  tampon_base64?: string
  // Médiateur — ancien champ libre (rétro-compatibilité) + 4 nouveaux sous-champs (28/05/2026).
  mediateur?: string
  mediateur_nom?: string
  mediateur_adresse?: string
  mediateur_code_postal?: string
  mediateur_ville?: string
  iban?: string
  bic?: string
}

export interface Ligne {
  id?: string
  type?: 'section' | 'sous_section' | 'prestation' | 'commentaire' | 'saut_page'
  niveau?: 1 | 2 | 3
  numero?: string
  parent_id?: string | null
  ordre?: number
  designation: string
  quantite?: number
  unite?: string
  prix_unitaire_ht?: number
  taux_tva?: number
}

interface Dechets {
  nature?: string
  quantite?: string
  responsable?: string
  tri?: string
  collecte_nom?: string
  collecte_adresse?: string
  collecte_type?: string
  cout?: number
  inclure_cout?: boolean
}

export interface DevisData {
  numero: string
  date_emission?: string
  date_validite?: string
  date_debut_travaux?: string
  duree_travaux?: string
  objet?: string
  conditions_paiement?: string
  acompte_pourcent?: number
  clientNom: string
  clientAdresse?: string
  clientType?: string
  /** SIRET du client si professionnel (B2B). Obligatoire art. L441-9 C. comm. */
  clientSiret?: string
  /** N° TVA intracommunautaire du client (B2B intra-UE). */
  clientTvaIntra?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  lignes: Ligne[]
  entreprise: Entreprise
  dechets?: Dechets
  statut?: string
  date_signature?: string
  client_signature_base64?: string
}

export interface FactureData {
  numero: string
  date_emission?: string
  date_echeance?: string
  date_prestation?: string
  objet?: string
  clientNom: string
  clientAdresse?: string
  clientType?: string
  /** SIRET du client si professionnel (B2B). Obligatoire art. L441-9 C. comm. */
  clientSiret?: string
  /** N° TVA intracommunautaire du client (B2B intra-UE). */
  clientTvaIntra?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  lignes: Ligne[]
  entreprise: Entreprise
  /** @deprecated utiliser `conditions_paiement` (UI dédiée) + `notes_personnalisees` (notes visibles client) */
  notes?: string
  /** Conditions de règlement visibles sur le PDF. Pré-rempli par défaut si vide. */
  conditions_paiement?: string
  /** Notes libres visibles client (ex: "Travaux du 11 au 13 mai 2026"). Remplace l'ancien "notes internes". */
  notes_personnalisees?: string
  /** Acompte déjà versé — montants HT/TTC et libellé optionnel. */
  acompte_pourcent?: number
  acompte_montant_ht?: number
  acompte_montant_ttc?: number
  acompte_label?: string
  // Factures de situation
  type?: 'standard' | 'acompte' | 'situation' | 'avoir'
  numero_situation?: number
  pourcentage_situation?: number
  devis_ref?: string
  devis_date?: string
  montant_situation_precedent_ht?: number
  montant_situation_precedent_ttc?: number
  reste_a_facturer_ht?: number
  reste_a_facturer_ttc?: number
}

// -------------------------------------------------------------------
// Conditions de paiement par défaut (si vide)
// -------------------------------------------------------------------
const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'

// -------------------------------------------------------------------
// TVA mentions automatiques
// -------------------------------------------------------------------
//
// V2.4a — Source de verite : lib/legal-mentions.ts (re-export ci-dessous
// sous les memes noms pour preserver le code existant de ce fichier).
// Toute modification doit etre faite dans lib/legal-mentions.ts pour ne
// pas faire diverger HTML dashboard / HTML signer / PDF.

const TVA_MENTION_10 = LEGAL_TVA_MENTION_10
const TVA_MENTION_5_5 = LEGAL_TVA_MENTION_5_5
const TVA_MENTION_AE = LEGAL_TVA_MENTION_AE

function getTvaMentions(lignes: Ligne[]): string[] {
  const prest = lignes.filter(isPrestation)
  const taux = new Set(prest.map((l) => l.taux_tva ?? 20))
  const mentions: string[] = []
  const allZero = prest.length > 0 && prest.every((l) => (l.taux_tva ?? 20) === 0)
  if (allZero) { mentions.push(TVA_MENTION_AE); return mentions }
  if (taux.has(10)) mentions.push(TVA_MENTION_10)
  if (taux.has(5.5)) mentions.push(TVA_MENTION_5_5)
  return mentions
}

function computeTvaGroups(lignes: Ligne[]): Record<number, number> {
  const groups: Record<number, number> = {}
  for (const l of lignes.filter(isPrestation)) {
    const rate = l.taux_tva ?? 20
    const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
    groups[rate] = (groups[rate] || 0) + ht * (rate / 100)
  }
  return groups
}

function computeTvaBases(lignes: Ligne[]): Record<number, number> {
  const bases: Record<number, number> = {}
  for (const l of lignes.filter(isPrestation)) {
    const rate = l.taux_tva ?? 20
    const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
    bases[rate] = (bases[rate] || 0) + ht
  }
  return bases
}

/**
 * Detecte le "mode forfait global" : l'artisan a coche la case "prix forfaitaire
 * global" cote saisie, ce qui sauvegarde un montant_ht > 0 alors que toutes les
 * lignes ont un prix unitaire HT a 0. Sans cette detection, le PDF affiche des
 * lignes a 0 EUR + un sous-total a 40 000 EUR = confusion client garantie.
 *
 * Retour true uniquement si :
 *   - il y a au moins une prestation
 *   - la somme des prestations vaut 0
 *   - le montant_ht passe par l'appelant est strictement positif
 */
export function detectForfaitMode(lignes: Ligne[], montantHt: number): boolean {
  const prest = lignes.filter(isPrestation)
  if (prest.length === 0) return false
  if (!(montantHt > 0)) return false
  const sumLignes = prest.reduce((s, l) => s + (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0), 0)
  return sumLignes < 0.01
}

/**
 * Dessine un bandeau "MODE FORFAIT GLOBAL" pleine largeur juste avant le tableau,
 * pour expliquer pourquoi les lignes vont apparaitre a 0 EUR alors que le total
 * indique 40 000 EUR. Visible parite HTML/PDF.
 */
function drawForfaitBanner(doc: jsPDF, montantHt: number, y: number): number {
  const M = 14
  const pageW = 210
  const w = pageW - 2 * M
  const h = 11
  // V10 — Bandeau bleu (parite design system Nexartis) au lieu d'orange.
  // Fond #e8f4fb (skyVeryPale), bordure et accent #1a6fb5 (netBlue).
  setFill(doc, C.skyVeryPale)
  setDraw(doc, C.netBlue); doc.setLineWidth(0.4)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'FD')
  setFill(doc, C.netBlue)
  doc.rect(M, y, 1.8, h, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlue)
  doc.text('FORFAIT GLOBAL', M + 5, y + 4.6)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
  doc.text(
    `Montant total convenu de ${fmt(montantHt)} HT. Le detail ci-dessous est informatif.`,
    M + 5, y + 8.6
  )
  return y + h + 4
}

// -------------------------------------------------------------------
// Hiérarchie : normalisation + sous-totaux
// -------------------------------------------------------------------

function isPrestation(l: Ligne): boolean {
  // backward compat : ligne sans type/niveau = prestation
  if (!l.type && !l.niveau) return true
  if (l.type === 'prestation') return true
  if (l.niveau === 3 && l.type !== 'commentaire' && l.type !== 'saut_page') return true
  return false
}

/**
 * Normalise les lignes : si aucune n'a de type/niveau (ancien format),
 * toutes deviennent des prestations niveau 3 avec numéro séquentiel.
 * Sinon, on remplit les niveau/type/numero manquants au mieux.
 */
function normalizeLignes(input: Ligne[]): Ligne[] {
  const hasHierarchy = input.some(l => l.type || l.niveau || l.numero || l.parent_id)

  if (!hasHierarchy) {
    return input.map((l, i) => ({
      ...l,
      type: 'prestation' as const,
      niveau: 3 as const,
      numero: String(i + 1),
    }))
  }

  // Format hiérarchique : on garde tel quel, en complétant les défauts
  return input.map((l, i) => {
    const niveau = (l.niveau ?? (l.type === 'section' ? 1 : l.type === 'sous_section' ? 2 : 3)) as 1 | 2 | 3
    const type = l.type ?? (niveau === 1 ? 'section' : niveau === 2 ? 'sous_section' : 'prestation')
    return {
      ...l,
      niveau,
      type,
      numero: l.numero ?? '',
    }
  })
}

/**
 * Calcule les sous-totaux pour chaque section et sous-section.
 * Retourne un Map<id, total HT>.
 *
 * Règle :
 * - Sous-section = somme des prestations dont parent_id = id de la sous-section
 * - Section = somme des sous-totaux de ses sous-sections + somme directe des
 *   prestations dont parent_id = id de la section (cas où il n'y a pas de
 *   sous-section intermédiaire)
 */
export function computeSubtotals(lignes: Ligne[]): Map<string, number> {
  const map = new Map<string, number>()

  // V12 — Bug fix : la version precedente s'appuyait sur l.parent_id qui n'est
  // PAS stocke en DB (sauvegarde page Nouveau/Modifier ne le persiste pas).
  // Resultat : tous les sous-totaux a 0,00 EUR sur le PDF.
  // Nouvelle approche : on itere dans l'ordre visuel. Chaque prestation est
  // rattachee implicitement a la derniere section/sous-section vue, comme dans
  // le rendu HTML. C'est plus robuste et fonctionne pour les factures historiques
  // sans parent_id.
  const sorted = [...lignes].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))

  let currentSectionId: string | null = null
  let currentSubSectionId: string | null = null

  for (const l of sorted) {
    if (l.type === 'section' && l.id) {
      currentSectionId = l.id as string
      currentSubSectionId = null
      if (!map.has(currentSectionId)) map.set(currentSectionId, 0)
    } else if (l.type === 'sous_section' && l.id) {
      currentSubSectionId = l.id as string
      if (!map.has(currentSubSectionId)) map.set(currentSubSectionId, 0)
    } else if (isPrestation(l)) {
      const ht = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
      if (currentSubSectionId) {
        map.set(currentSubSectionId, (map.get(currentSubSectionId) ?? 0) + ht)
      }
      if (currentSectionId) {
        map.set(currentSectionId, (map.get(currentSectionId) ?? 0) + ht)
      }
    }
  }

  return map
}

// -------------------------------------------------------------------
// Footer répété sur chaque page
// -------------------------------------------------------------------

function drawFooterAllPages(doc: jsPDF, ent: Entreprise, numero: string) {
  const total = doc.getNumberOfPages()
  const pageW = 210
  const pageH = 297
  const M = 14
  const footerTop = pageH - 14 // y du trait sky

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // Trait sky 0.4mm
    setDraw(doc, C.sky)
    doc.setLineWidth(0.4)
    doc.line(M, footerTop, pageW - M, footerTop)

    let y = footerTop + 3.2

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    setText(doc, C.muted)

    // Ligne 1 : entreprise + adresse + SIRET + email
    // L'email vient toujours de la fiche entreprise (workaround V8 retiré le 21/05/2026)
    const id = [
      ent.nom,
      ent.adresse ? `${ent.adresse}${ent.code_postal || ent.ville ? `, ${ent.code_postal || ''} ${ent.ville || ''}`.replace(/  +/g, ' ').trim() : ''}` : '',
      ent.siret ? `SIRET : ${ent.siret}` : '',
      ent.email ? `Email : ${ent.email}` : '',
    ].filter(Boolean).join(' — ')
    if (id) doc.text(id, pageW / 2, y, { align: 'center', maxWidth: pageW - 2 * M })
    y += 3.2

    // Ligne 2 : tel + décennale (avec zone géographique, P12 audit)
    const line2Parts: string[] = []
    if (ent.telephone) line2Parts.push(`Tél : ${ent.telephone}`)
    if (ent.assurance_nom) {
      let partAssurance = `Garantie décennale ${ent.assurance_nom}`
      if (ent.decennale_numero) partAssurance += ` (n° ${ent.decennale_numero})`
      // P12 (audit) : zone géographique couverte par la décennale (obligation BTP)
      if (ent.assurance_zone) partAssurance += ` — Zone : ${ent.assurance_zone}`
      line2Parts.push(partAssurance)
    }
    if (line2Parts.length) doc.text(line2Parts.join(' — '), pageW / 2, y, { align: 'center', maxWidth: pageW - 2 * M })

    // Coin bas-droit : Page X sur Y + N°
    doc.setFontSize(7)
    setText(doc, C.muted)
    doc.text(`Page ${i} sur ${total} — N° ${numero}`, pageW - M, pageH - 4, { align: 'right' })
  }
}

// -------------------------------------------------------------------
// Mini-header pour pages 2+ (titre + numéro + page X/Y, trait sky)
// Doit être appelé APRÈS le rendu complet (toutes pages connues)
// -------------------------------------------------------------------

function drawMiniHeaderAllPagesAfterFirst(doc: jsPDF, title: string, numero: string) {
  const total = doc.getNumberOfPages()
  if (total < 2) return
  const pageW = 210
  const M = 14

  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    // Texte centré "TITRE N° XXX — Page X/Y"
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setText(doc, C.navy)
    doc.text(`${title} N° ${numero} — Page ${i}/${total}`, pageW / 2, 10, { align: 'center' })
    // Trait sky 0.3mm
    setDraw(doc, C.sky); doc.setLineWidth(0.3)
    doc.line(M, 13, pageW - M, 13)
  }
}

// -------------------------------------------------------------------
// Header (logo + titre + n° + dates) — partagé devis/facture
// -------------------------------------------------------------------

interface HeaderOpts {
  title: string          // "DEVIS" ou "FACTURE" ou "FACTURE DE SITUATION"
  numero: string
  subtitle?: string      // ex "Situation N° 2"
  refLine?: string       // ex "Sur devis N° D-2025-001 du 01/01/2025"
  dateLine: string       // ligne dates centrée
}

function drawHeader(doc: jsPDF, ent: Entreprise, opts: HeaderOpts, startY: number): number {
  const pageW = 210
  const M = 14
  const centerX = pageW / 2
  const titleTopY = startY

  // === Logo plus généreux — style Obat ===
  // hauteur 22mm (avant 14), largeur max 58mm
  // Position : aligné verticalement au centre du bloc titre+numero
  const LOGO_H = 22
  const LOGO_MAX_W = 58
  let logoDrawn = false
  if (ent.logo_url && ent.logo_url.startsWith('data:image')) {
    try {
      const logoFormat = ent.logo_url.includes('image/png') ? 'PNG' : 'JPEG'
      const imgProps = doc.getImageProperties(ent.logo_url)
      const ratio = imgProps.width / imgProps.height
      let logoW = LOGO_H * ratio
      if (logoW > LOGO_MAX_W) {
        logoW = LOGO_MAX_W
      }
      // Aligner verticalement le logo avec le titre (centré sur LOGO_H)
      const logoTopY = titleTopY - 1
      doc.addImage(ent.logo_url, logoFormat, M, logoTopY, logoW, LOGO_H)
      logoDrawn = true
    } catch { /* logo invalide, ignoré */ }
  }
  if (!logoDrawn && ent.nom) {
    // Pas de logo : nom entreprise stylisé à gauche
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    setText(doc, C.netBlue)
    doc.text(ent.nom, M, titleTopY + 10)
  }

  // === Titre centré ===
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  setText(doc, C.netBlue)
  doc.text(opts.title, centerX, titleTopY + 8, { align: 'center' })

  // N° doc
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  setText(doc, C.muted)
  doc.text(`N° ${opts.numero}`, centerX, titleTopY + 14, { align: 'center' })

  let y = titleTopY + 18

  // Sous-titre éventuel (situation)
  if (opts.subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    setText(doc, C.netBlueAccent)
    doc.text(opts.subtitle, centerX, y, { align: 'center' })
    y += 4
  }
  if (opts.refLine) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    setText(doc, C.muted)
    doc.text(opts.refLine, centerX, y, { align: 'center' })
    y += 4
  }

  // V5 : Ligne dates AU-DESSUS du trait bleu, juste sous le numéro
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  setText(doc, C.muted)
  doc.text(opts.dateLine, centerX, y, { align: 'center' })
  y += 4.5

  // S'assurer que le header descend au moins en dessous du logo
  const minYAfterLogo = titleTopY + LOGO_H + 1
  if (y < minYAfterLogo) y = minYAfterLogo

  // Trait sky 0.7mm — séparateur fin du header
  setFill(doc, C.sky)
  doc.rect(M, y, pageW - 2 * M, 0.7, 'F')
  // V5 : marge trait—cadres = 8mm (identique à cadres—tableau = 8mm dans drawIdentityBoxes)
  y += 8

  return y
}

// -------------------------------------------------------------------
// Cadres ARTISAN + CLIENT
// -------------------------------------------------------------------

function drawIdentityBoxes(
  doc: jsPDF,
  ent: Entreprise,
  data: {
    clientNom: string
    clientAdresse?: string
    /** SIRET du client (si pro). Obligatoire art. L441-9 C. comm. */
    clientSiret?: string
    /** N° TVA intracom du client (B2B intra-UE). */
    clientTvaIntra?: string
  },
  y: number,
): number {
  const M = 14
  const boxW = 88
  const lx = M
  const rx = M + boxW + 6
  const padX = 5
  const padTop = 5
  const radius = 1.8

  // --- Mesure contenu ARTISAN ---
  const artisanLines: { text: string; size: number; bold?: boolean; color: [number, number, number] }[] = []
  artisanLines.push({ text: 'A R T I S A N', size: 8, bold: true, color: C.netBlue })
  artisanLines.push({ text: ent.nom || '', size: 11, bold: true, color: C.navyText })
  if (ent.adresse) artisanLines.push({ text: ent.adresse, size: 8.5, color: C.muted })
  if (ent.code_postal || ent.ville) artisanLines.push({ text: `${ent.code_postal || ''} ${ent.ville || ''}`.trim(), size: 8.5, color: C.muted })
  if (ent.siret) artisanLines.push({ text: `SIRET : ${ent.siret}`, size: 8.5, color: C.muted })
  // P11 (audit) : afficher le N° TVA intracom de l'émetteur. Obligation
  // facture B2B / intra-UE. Champ DB : entreprises.tva_intracommunautaire.
  if (ent.tva_intracommunautaire) {
    artisanLines.push({ text: `TVA intracom. : ${ent.tva_intracommunautaire}`, size: 8.5, color: C.muted })
  }
  if (ent.telephone) artisanLines.push({ text: `Tél : ${ent.telephone}`, size: 8.5, color: C.muted })

  // --- Mesure contenu CLIENT ---
  const clientLines: { text: string; size: number; bold?: boolean; color: [number, number, number] }[] = []
  clientLines.push({ text: 'C L I E N T', size: 8, bold: true, color: C.greenDark })
  clientLines.push({ text: data.clientNom, size: 11, bold: true, color: C.navyText })
  if (data.clientAdresse) {
    const parts = data.clientAdresse.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) clientLines.push({ text: p, size: 8.5, color: C.muted })
  }
  // P11 (audit) : afficher le SIRET du client si pro. Obligation art. L441-9 C. comm.
  if (data.clientSiret) {
    clientLines.push({ text: `SIRET : ${data.clientSiret}`, size: 8.5, color: C.muted })
  }
  // TVA intracom du client (B2B intra-UE) — affiché si présent.
  if (data.clientTvaIntra) {
    clientLines.push({ text: `TVA intracom. : ${data.clientTvaIntra}`, size: 8.5, color: C.muted })
  }

  // Hauteur uniforme
  const lineHeight = (size: number) => size * 0.42 + 1.6
  const heightOf = (lines: { size: number }[]) => lines.reduce((s, l) => s + lineHeight(l.size), 0)
  const hA = heightOf(artisanLines)
  const hC = heightOf(clientLines)
  const boxH = Math.max(hA, hC) + padTop + 4

  // --- Dessin ARTISAN ---
  setFill(doc, C.skyArtisanBg)
  doc.roundedRect(lx, y, boxW, boxH, radius, radius, 'F')
  setDraw(doc, C.sky)
  doc.setLineWidth(0.6)
  doc.roundedRect(lx, y, boxW, boxH, radius, radius, 'S')
  // Bordure gauche épaisse 4px — 1.4mm
  setFill(doc, C.sky)
  doc.rect(lx, y, 1.4, boxH, 'F')

  let ay = y + padTop
  for (const line of artisanLines) {
    doc.setFontSize(line.size)
    doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
    setText(doc, line.color)
    ay += line.size * 0.42
    doc.text(line.text, lx + padX, ay, { maxWidth: boxW - padX - 3 })
    ay += 1.6
  }

  // --- Dessin CLIENT ---
  setFill(doc, C.greenPale)
  doc.roundedRect(rx, y, boxW, boxH, radius, radius, 'F')
  setDraw(doc, C.green)
  doc.setLineWidth(0.6)
  doc.roundedRect(rx, y, boxW, boxH, radius, radius, 'S')
  setFill(doc, C.green)
  doc.rect(rx, y, 1.4, boxH, 'F')

  let cy = y + padTop
  for (const line of clientLines) {
    doc.setFontSize(line.size)
    doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
    setText(doc, line.color)
    cy += line.size * 0.42
    doc.text(line.text, rx + padX, cy, { maxWidth: boxW - padX - 3 })
    cy += 1.6
  }

  // V5 : marge cadres — objet/tableau = 8mm (identique à trait—cadres pour symétrie parfaite)
  return y + boxH + 8
}

// -------------------------------------------------------------------
// Bandeau OBJET
// -------------------------------------------------------------------

// ─────────────────────────────────────────────────────────────
// Bannière jaune "Mentions légales incomplètes" (filet de sécurité)
// ─────────────────────────────────────────────────────────────
//
// Affichée en haut du PDF du devis dès qu'au moins une mention
// obligatoire manque dans le profil entreprise. Coûte ~16mm de
// hauteur. Disparaît automatiquement dès que l'artisan complète
// son profil dans les Paramètres.
function drawIncompletProfileBanner(
  doc: jsPDF,
  champsManquants: string[],
  y: number,
): number {
  const M = 14
  const pageW = 210
  const w = pageW - 2 * M
  const h = 14
  setFill(doc, C.amberBg)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'F')
  setDraw(doc, C.amberBorder); doc.setLineWidth(0.5)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'S')
  // Trait gauche épais
  setFill(doc, C.amberAccent)
  doc.rect(M, y, 1.8, h, 'F')

  // Titre
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  setText(doc, C.amberText)
  doc.text('MENTIONS LEGALES INCOMPLETES', M + 5, y + 5)

  // Liste des champs manquants
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  setText(doc, C.amberAccent)
  const champsStr = `Manquant${champsManquants.length > 1 ? 's' : ''} dans le profil entreprise : ${champsManquants.join(', ')}.`
  const split = doc.splitTextToSize(champsStr, w - 8)
  doc.text(split, M + 5, y + 9.8)

  return y + h + 4
}

function drawObjet(doc: jsPDF, objet: string, y: number): number {
  const M = 14
  const pageW = 210
  const w = pageW - 2 * M
  const h = 9  // V4 : un poil plus haut pour la respiration
  setFill(doc, C.skyVeryPale)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'F')
  // Bordure visible
  setDraw(doc, C.sky); doc.setLineWidth(0.4)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'S')
  // Trait gauche épais 5px — 1.8mm
  setFill(doc, C.sky)
  doc.rect(M, y, 1.8, h, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  setText(doc, C.netBlueAccent)
  doc.text('OBJET :', M + 5, y + 5.6)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  setText(doc, C.navyText)
  doc.text(objet, M + 22, y + 5.6, { maxWidth: w - 24 })

  // V4 : marge plus généreuse objet — tableau
  return y + h + 6
}

// -------------------------------------------------------------------
// Tableau hiérarchique (sections / sous-sections / prestations)
// -------------------------------------------------------------------

interface RowMeta {
  kind: 'section' | 'sous_section' | 'prestation' | 'commentaire'
  ligneIdx: number
}

function drawHierTable(doc: jsPDF, lignes: Ligne[], startY: number, bottomMargin = 22): number {
  const M = 14
  const pageW = 210
  const tableW = pageW - 2 * M

  const subtotals = computeSubtotals(lignes)

  // Construction des lignes du tableau dans l'ordre des `lignes` reçues
  const body: (string | { content: string; styles?: Partial<Styles> })[][] = []
  const meta: RowMeta[] = []

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i]
    if (l.type === 'saut_page') continue

    if (l.type === 'section') {
      const sub = (l.id && subtotals.get(l.id)) || 0
      body.push([
        l.numero ?? '',
        l.designation.toUpperCase(),
        '', '', '',
        fmt(sub),
      ])
      meta.push({ kind: 'section', ligneIdx: i })
    } else if (l.type === 'sous_section') {
      const sub = (l.id && subtotals.get(l.id)) || 0
      body.push([
        l.numero ?? '',
        l.designation,
        '', '', '',
        fmt(sub),
      ])
      meta.push({ kind: 'sous_section', ligneIdx: i })
    } else if (l.type === 'commentaire') {
      body.push([
        l.numero ?? '',
        l.designation,
        '', '', '', '',
      ])
      meta.push({ kind: 'commentaire', ligneIdx: i })
    } else {
      // prestation (default)
      const q = l.quantite ?? 0
      const pu = l.prix_unitaire_ht ?? 0
      body.push([
        l.numero ?? '',
        l.designation,
        String(q),
        l.unite ?? '',
        fmt(pu),
        fmt(q * pu),
      ])
      meta.push({ kind: 'prestation', ligneIdx: i })
    }
  }

  autoTable(doc, {
    startY,
    head: [['N°', 'DÉSIGNATION', 'QTÉ', 'UNITÉ', 'PRIX U. HT', 'TOTAL HT']],
    body,
    theme: 'plain',
    margin: { left: M, right: M, top: 18, bottom: bottomMargin },
    tableWidth: tableW,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.2,
      lineColor: C.border,
      lineWidth: 0.1,
      textColor: C.navyText,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.8,
      lineWidth: 0,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 13 },
      3: { halign: 'center', cellWidth: 13 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26 },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return
      const m = meta[data.row.index]
      if (!m) return

      if (m.kind === 'section') {
        data.cell.styles.fillColor = C.skySection
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.cellPadding = 2.8
        if (data.column.index === 0) {
          data.cell.styles.textColor = C.netBlue
        } else if (data.column.index === 1) {
          data.cell.styles.textColor = C.navy
        } else if (data.column.index === 5) {
          data.cell.styles.textColor = C.netBlue
          data.cell.styles.halign = 'right'
        } else {
          data.cell.styles.textColor = C.navy
        }
      } else if (m.kind === 'sous_section') {
        data.cell.styles.fillColor = C.skyPale
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.cellPadding = 2.6
        if (data.column.index === 0) {
          data.cell.styles.textColor = C.netBlue
          data.cell.styles.fontStyle = 'bold'
        } else if (data.column.index === 1) {
          data.cell.styles.textColor = C.navy
          data.cell.styles.fontStyle = 'bold'
        } else if (data.column.index === 5) {
          data.cell.styles.textColor = C.netBlue
          data.cell.styles.halign = 'right'
        } else {
          data.cell.styles.textColor = C.navy
        }
      } else if (m.kind === 'commentaire') {
        data.cell.styles.fillColor = C.white
        data.cell.styles.textColor = C.muted
        data.cell.styles.fontStyle = 'italic'
      } else {
        // prestation
        if (data.column.index === 0) {
          data.cell.styles.textColor = C.muted
        } else if (data.column.index === 3) {
          data.cell.styles.textColor = C.muted
        } else if (data.column.index === 5) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = C.navy
        }
      }
    },
    didDrawCell: (data: CellHookData) => {
      // Trait gauche d'accent : SECTION (2pt netBlue) et SOUS_SECTION (1pt sky)
      if (data.section === 'body' && data.column.index === 0) {
        const m = meta[data.row.index]
        if (m?.kind === 'section') {
          setFill(doc, C.netBlue)
          doc.rect(data.cell.x, data.cell.y, 1.2, data.cell.height, 'F')
        } else if (m?.kind === 'sous_section') {
          setFill(doc, C.sky)
          doc.rect(data.cell.x, data.cell.y, 0.8, data.cell.height, 'F')
        }
      }
      // Traits verticaux fins entre colonnes (header + lignes prestation uniquement,
      // pas pour sections/sous-sections qui ont des cellules fusionnees visuellement)
      const m = meta[data.row.index]
      const isPrestationRow = data.section === 'body' && (!m || m.kind === 'prestation')
      const isHeader = data.section === 'head'
      if ((isHeader || isPrestationRow) && data.column.index < 5) {
        setDraw(doc, isHeader ? [255, 255, 255] : C.border)
        doc.setLineWidth(0.1)
        const x = data.cell.x + data.cell.width
        doc.line(x, data.cell.y, x, data.cell.y + data.cell.height)
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 4
}

// -------------------------------------------------------------------
// Bloc totaux + NET A PAYER (à droite) — refonte v3 : 3 blocs encadrés
// -------------------------------------------------------------------

interface TotalsOpts {
  ht: number
  ttc: number
  tvaGroups: Record<number, number>
  netLabel?: string
  netAmount?: number
  // Bloc C — Acompte (devis uniquement)
  acomptePct?: number
  acompteMontant?: number
  resteMontant?: number
  // Bloc C alternatif — Reste à facturer (factures de situation)
  resteAFacturerHT?: number
  resteAFacturerTTC?: number
  // V9 — Mode forfait global : remplace le libellé "Sous-total HT" par
  // "Forfait global" pour eviter l'incoherence visuelle (lignes a 0 EUR
  // au-dessus + sous-total positif). Coche cote saisie "Appliquer un prix
  // forfaitaire global". Calcule via detectForfaitMode() par l'appelant.
  isForfait?: boolean
}

function drawTotals(doc: jsPDF, opts: TotalsOpts, y: number): number {
  const pageW = 210
  const M = 14
  const blockW = 80
  const rightX = pageW - M - blockW
  const padX = 3
  const valueX = pageW - M - padX
  const labelX = rightX + padX

  // V4 : l'acompte devient une LIGNE du récap (entre Total TTC et NET À PAYER),
  // pour que NET À PAYER reste la dernière ligne — la plus importante.
  const hasAcompte = opts.acomptePct !== undefined && opts.acomptePct > 0
    && opts.acompteMontant !== undefined && opts.resteMontant !== undefined

  // —— BLOC A — RÉCAPITULATIF HT/TVA/TTC (+ acompte si présent) ——
  // Bug fix (V8) : on filtre les taux nuls / NaN / negatifs (cas "Sans TVA",
  // franchise art. 293 B CGI / auto-entrepreneur) pour ne PAS afficher de ligne
  // "TVA 0% — 0,00 €" ni "TVA 10% — 0,00 €" parasites dans le recapitulatif.
  // Si pas de TVA -> aucune ligne TVA n'est dessinee.
  const sortedRates = Object.keys(opts.tvaGroups)
    .map(Number)
    .filter((r) => Number.isFinite(r) && r > 0 && (opts.tvaGroups[r] ?? 0) > 0.005)
    .sort((a, b) => a - b)
  const headerH = 5
  const rowH = 4.8         // un poil plus aéré
  // 2 lignes fixes (HT + TTC) + TVA(s) + (acompte si présent)
  const rowsCount = 2 + sortedRates.length + (hasAcompte ? 1 : 0)
  const blockAH = headerH + rowsCount * rowH + 1.8

  // Cadre extérieur — fond gris très clair, bordure visible
  setFill(doc, C.grayLightBg)
  setDraw(doc, C.border); doc.setLineWidth(0.4)
  doc.roundedRect(rightX, y, blockW, blockAH, 1.5, 1.5, 'FD')

  // Header "RÉCAPITULATIF"
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setText(doc, C.muted)
  doc.text('RÉCAPITULATIF', labelX, y + 3.4, { charSpace: 0.4 })

  let rowY = y + headerH + 0.5
  let rowIdx = 0

  // Helper : dessine une ligne — couleurs configurables pour l'acompte (vert)
  const drawRow = (
    label: string,
    value: string,
    isBold: boolean,
    labelColor?: [number, number, number],
    valueColor?: [number, number, number],
  ) => {
    if (rowIdx > 0) {
      setDraw(doc, C.border); doc.setLineWidth(0.15)
      doc.line(rightX + 1.5, rowY, rightX + blockW - 1.5, rowY)
    }
    doc.setFontSize(8.5)
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    setText(doc, labelColor ?? (isBold ? C.navy : C.muted))
    doc.text(label, labelX, rowY + rowH - 1.6)
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    setText(doc, valueColor ?? C.navy)
    doc.text(value, valueX, rowY + rowH - 1.6, { align: 'right' })
    rowY += rowH
    rowIdx++
  }

  // Sous-total HT — V9 : si mode forfait global (case "prix forfaitaire global"
  // cochee cote saisie), on remplace le libelle pour eviter l'incoherence
  // visuelle (lignes a 0 EUR + sous-total positif). Le bandeau "MODE FORFAIT
  // GLOBAL" est deja dessine au-dessus du tableau (voir drawForfaitBanner).
  drawRow(opts.isForfait ? 'Forfait global HT' : 'Sous-total HT', fmt(opts.ht), true)
  // TVA par taux
  for (const rate of sortedRates) {
    drawRow(`TVA ${rate}%`, fmt(opts.tvaGroups[rate]), false)
  }
  // Total TTC
  drawRow('Total TTC', fmt(opts.ttc), true)
  // Acompte versé (intégré au récap, en vert, avec signe -)
  if (hasAcompte) {
    const label = opts.acomptePct ? `Acompte versé (${opts.acomptePct}%)` : 'Acompte versé'
    drawRow(label, `- ${fmt(opts.acompteMontant!)}`, true, C.greenDark, C.greenDark)
  }

  y = y + blockAH + 3 // marge 3mm récap — NET À PAYER

  // —— BLOC B — NET À PAYER (toujours en dernier — ligne la plus importante) ——
  const netH = 12
  setFill(doc, C.netBlue)
  doc.roundedRect(rightX, y, blockW, netH, 2, 2, 'F')
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setText(doc, C.white)
  doc.text(opts.netLabel ?? 'NET À PAYER', rightX + 4, y + netH / 2 + 1.5)
  doc.setFontSize(12)
  // Si acompte présent, netAmount = TTC - acompte (déjà calculé par l'appelant)
  doc.text(fmt(opts.netAmount ?? opts.ttc), pageW - M - 4, y + netH / 2 + 2, { align: 'right' })
  y += netH + 2

  // —— BLOC C — Reste à facturer (factures de situation uniquement) ——
  const hasReste = opts.resteAFacturerHT !== undefined || opts.resteAFacturerTTC !== undefined

  if (false) {
    // hasAcompte est maintenant géré DANS le récap ci-dessus — bloc séparé supprimé
  } else if (hasReste) {
    const accH = 13
    setFill(doc, C.greenPale)
    doc.roundedRect(rightX, y, blockW, accH, 1.5, 1.5, 'F')
    setFill(doc, C.green)
    doc.rect(rightX, y, 1.4, accH, 'F')

    const lineGap = 5
    const yLine1 = y + 5
    const yLine2 = yLine1 + lineGap

    if (opts.resteAFacturerHT !== undefined) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
      doc.text('Reste à facturer HT', rightX + 4, yLine1)
      doc.setFont('helvetica', 'bold'); setText(doc, C.navy)
      doc.text(fmt(opts.resteAFacturerHT), pageW - M - padX, yLine1, { align: 'right' })
    }
    if (opts.resteAFacturerTTC !== undefined) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setText(doc, C.greenDark)
      doc.text('Reste à facturer TTC', rightX + 4, yLine2)
      doc.text(fmt(opts.resteAFacturerTTC), pageW - M - padX, yLine2, { align: 'right' })
    }

    y += accH + 2
  }

  return y
}

// -------------------------------------------------------------------
// Ventilation TVA (tableau simple aligné à droite)
// -------------------------------------------------------------------

function drawTvaBreakdown(doc: jsPDF, lignes: Ligne[], y: number): number {
  const groups = computeTvaGroups(lignes)
  const bases = computeTvaBases(lignes)
  // Bug fix (V8) : on exclut les taux nuls / NaN / negatifs ET les montants nuls
  // du tableau de ventilation TVA (franchise art. 293 B CGI : pas de mention
  // "Taux 0% — Base : X — 0 €" ni "TVA 10% — 0 €" parasite).
  const rates = Object.keys(groups)
    .map(Number)
    .filter((r) => Number.isFinite(r) && r > 0 && (groups[r] ?? 0) > 0.005)
    .sort((a, b) => a - b)
  if (rates.length === 0) return y

  const pageW = 210
  const M = 14
  const rightX = pageW - M - 80
  const valueX = pageW - M

  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); setText(doc, C.muted)
  doc.text('VENTILATION TVA', rightX, y)
  y += 3

  setDraw(doc, C.border); doc.setLineWidth(0.2)
  doc.line(rightX, y, valueX, y); y += 3

  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  for (const r of rates) {
    setText(doc, C.muted); doc.text(`Taux ${r}%`, rightX, y)
    setText(doc, C.navy); doc.text(`Base : ${fmt(bases[r] ?? 0)}`, rightX + 26, y)
    doc.text(fmt(groups[r]), valueX, y, { align: 'right' })
    y += 4
  }

  return y + 1
}

// ===================================================================
// DEVIS PDF
// ===================================================================

export function generateDevisPdf(data: DevisData): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ent = data.entreprise
  const lignes = normalizeLignes(data.lignes)

  // —— HEADER ——
  const dateParts: string[] = []
  dateParts.push(`Date : ${fmtDate(data.date_emission)}`)
  if (data.date_validite) dateParts.push(`Valide jusqu'au : ${fmtDate(data.date_validite)}`)
  if (data.duree_travaux) dateParts.push(`Durée estimée : ${data.duree_travaux}`)

  let y = drawHeader(doc, ent, {
    title: 'DEVIS',
    numero: data.numero,
    dateLine: dateParts.join(' | '),
  }, 12)

  // —— FILET DE SÉCURITÉ : bannière "mentions légales incomplètes" ——
  // Disparaît dès que le profil entreprise est complet.
  const champsManquantsDevis = getChampsLegauxManquants(ent as unknown as Record<string, unknown>)
  if (champsManquantsDevis.length > 0) {
    y = drawIncompletProfileBanner(doc, champsManquantsDevis, y)
  }

  // —— CADRES ARTISAN + CLIENT ——
  y = drawIdentityBoxes(doc, ent, { clientNom: data.clientNom, clientAdresse: data.clientAdresse }, y)

  // —— OBJET ——
  if (data.objet) y = drawObjet(doc, data.objet, y)

  // —— MODE FORFAIT GLOBAL (V8) : bandeau explicite si les lignes sont a 0 EUR ——
  if (detectForfaitMode(lignes, data.montant_ht)) {
    y = drawForfaitBanner(doc, data.montant_ht, y)
  }

  // —— TABLE HIÉRARCHIQUE ——
  y = drawHierTable(doc, lignes, y)

  // —— TOTAUX (à droite) ——
  // Hauteur estimée : récap (~30mm) + NET (11+2) + acompte éventuel (15) + signatures (~32) — 95mm
  const hasAcompte = !!(data.acompte_pourcent && data.acompte_pourcent > 0)
  const NEEDED_BOTTOM = hasAcompte ? 85 : 72
  if (y + NEEDED_BOTTOM > 270) { doc.addPage(); y = 20 }

  y += 10 // V4 : marge respiration tableau — totaux (devis)
  let tvaGroups = computeTvaGroups(lignes)
  const isForfaitDevis = detectForfaitMode(lignes, data.montant_ht)
  // V11 — Meme fix qu'en facture : mode forfait + TVA > 0, on reconstruit
  // tvaGroups depuis data.montant_tva sinon la ligne TVA disparait du recap.
  if (isForfaitDevis && data.montant_tva > 0 && data.montant_ht > 0) {
    const tauxBrut = (data.montant_tva / data.montant_ht) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups = { [taux]: data.montant_tva }
  }
  const totalsStartY = y
  const acompteTTC = hasAcompte ? data.montant_ttc * ((data.acompte_pourcent as number) / 100) : undefined
  const resteTTC = hasAcompte ? data.montant_ttc - (acompteTTC as number) : undefined

  let rightY = drawTotals(doc, {
    ht: data.montant_ht,
    ttc: data.montant_ttc,
    tvaGroups,
    // Parite HTML : si acompte present, NET A PAYER = TTC - acompte
    // et label devient "NET A PAYER A RECEPTION" pour eviter la confusion
    // (le total TTC reste affiche dans le recap juste au-dessus).
    netLabel: hasAcompte ? 'NET À PAYER À RÉCEPTION' : 'NET À PAYER',
    netAmount: hasAcompte ? resteTTC : undefined,
    acomptePct: hasAcompte ? data.acompte_pourcent : undefined,
    acompteMontant: acompteTTC,
    resteMontant: resteTTC,
    isForfait: isForfaitDevis,
  }, y)

  // —— VENTILATION TVA (sous totaux à droite, si plusieurs taux) ——
  if (Object.keys(tvaGroups).length > 1) {
    rightY = drawTvaBreakdown(doc, lignes, rightY + 1)
  }

  // —— COLONNE GAUCHE : conditions + mentions ——
  let leftY = totalsStartY
  const M = 14
  const leftMaxW = 88

  if (data.conditions_paiement) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setText(doc, C.navy)
    doc.text('Conditions de paiement', M, leftY); leftY += 4
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
    const split = doc.splitTextToSize(data.conditions_paiement, leftMaxW)
    doc.text(split, M, leftY); leftY += split.length * 3.2 + 3
  }

  // Mentions TVA (italique, petit)
  const tvaMentions = getTvaMentions(lignes)
  if (tvaMentions.length > 0) {
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
    for (const m of tvaMentions) {
      const split = doc.splitTextToSize(m, leftMaxW)
      doc.text(split, M, leftY); leftY += split.length * 2.6 + 1.5
    }
  }

  // Déchets AGEC
  if (data.dechets && (data.dechets.nature || data.dechets.collecte_nom)) {
    leftY += 1
    setDraw(doc, C.border); doc.setLineWidth(0.2)
    doc.line(M, leftY, M + leftMaxW, leftY); leftY += 2.5
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setText(doc, C.muted)
    doc.text('GESTION DES DÉCHETS (AGEC)', M, leftY); leftY += 3
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
    const dechParts: string[] = []
    if (data.dechets.nature) dechParts.push(`Nature : ${data.dechets.nature}`)
    if (data.dechets.responsable) dechParts.push(data.dechets.responsable)
    if (data.dechets.tri) dechParts.push(`Tri : ${data.dechets.tri}`)
    if (data.dechets.collecte_nom) dechParts.push(`Collecte : ${data.dechets.collecte_nom}${data.dechets.collecte_type ? ` (${data.dechets.collecte_type})` : ''}`)
    const dechWrapped = doc.splitTextToSize(dechParts.join(' · '), leftMaxW)
    doc.text(dechWrapped, M, leftY); leftY += dechWrapped.length * 2.8
  }

  // P12 (audit) — Mentions légales entreprise sur le DEVIS (parité facture)
  // Inclut : assurance décennale + zone géographique (obligation BTP),
  // forme juridique, capital, RCS/RM, qualification pro, médiateur.
  const entMentionsDevis: string[] = []
  if (ent.assurance_nom || ent.decennale_numero) {
    let line = `Assurance décennale : ${ent.assurance_nom || ''}`
    if (ent.decennale_numero) line += ` — n° ${ent.decennale_numero}`
    if (ent.assurance_zone) line += ` — Zone : ${ent.assurance_zone}`
    entMentionsDevis.push(line.trim())
  }
  if (ent.forme_juridique === 'EI' || ent.forme_juridique === 'Micro-entreprise') {
    entMentionsDevis.push(`${ent.nom || ''} — ${ent.forme_juridique === 'Micro-entreprise' ? 'Entrepreneur individuel (Micro-entreprise)' : 'Entrepreneur individuel (EI)'}`)
  }
  if (ent.capital_social && ['EURL', 'SARL', 'SAS', 'SASU'].includes(String(ent.forme_juridique || ''))) {
    entMentionsDevis.push(`${ent.forme_juridique} au capital de ${ent.capital_social}`)
  }
  if (ent.rcs_rm) entMentionsDevis.push(String(ent.rcs_rm))
  if (ent.qualification_pro) entMentionsDevis.push(`Qualification : ${ent.qualification_pro}`)
  // Médiateur : on reconstitue depuis les 4 nouveaux champs ; fallback sur l'ancien champ libre.
  {
    const mNom = (ent.mediateur_nom as string) || ''
    const mAdr = (ent.mediateur_adresse as string) || ''
    const mCP = (ent.mediateur_code_postal as string) || ''
    const mVille = (ent.mediateur_ville as string) || ''
    const ligneAdresse = [mAdr, [mCP, mVille].filter(Boolean).join(' ')].filter(Boolean).join(' — ')
    const mediateurFmt = [mNom, ligneAdresse].filter(Boolean).join(' — ')
    if (mediateurFmt) {
      entMentionsDevis.push(`Médiateur : ${mediateurFmt}`)
    } else if (ent.mediateur) {
      entMentionsDevis.push(`Médiateur : ${ent.mediateur}`)
    }
  }
  if (ent.mentions_legales_custom) entMentionsDevis.push(String(ent.mentions_legales_custom))

  if (entMentionsDevis.length > 0) {
    leftY += 1
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
    for (const m of entMentionsDevis) {
      const split = doc.splitTextToSize(m, leftMaxW)
      doc.text(split, M, leftY); leftY += split.length * 2.6 + 0.6
    }
    leftY += 1
  }

  // —— SIGNATURES (bas de page, 2 cadres dashed) ——
  let sigY = Math.max(leftY, rightY) + 4
  // Hauteur minimale réservée
  if (sigY > 250) { doc.addPage(); sigY = 25 }

  const pageW = 210
  const sigBoxW = (pageW - 2 * M - 6) / 2  // 2 colonnes égales
  const sigH = 28
  const sigLeftX = M
  const sigRightX = M + sigBoxW + 6

  // Dashed approximation : on fait des petits segments
  const drawDashedRect = (x: number, yy: number, w: number, h: number, color: [number, number, number]) => {
    setDraw(doc, color); doc.setLineWidth(0.3)
    const dash = 1.6, gap = 1.2
    let cx = x
    while (cx < x + w) {
      const end = Math.min(cx + dash, x + w)
      doc.line(cx, yy, end, yy)
      doc.line(cx, yy + h, end, yy + h)
      cx += dash + gap
    }
    let cy = yy
    while (cy < yy + h) {
      const end = Math.min(cy + dash, yy + h)
      doc.line(x, cy, x, end)
      doc.line(x + w, cy, x + w, end)
      cy += dash + gap
    }
  }

  // Cadre ARTISAN
  drawDashedRect(sigLeftX, sigY, sigBoxW, sigH, C.sky)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlue)
  doc.text('A R T I S A N', sigLeftX + 3, sigY + 5)
  const artisanVisual = ent.signature_base64 || ent.tampon_base64
  if (artisanVisual) {
    try { doc.addImage(artisanVisual, 'PNG', sigLeftX + 4, sigY + 7, 0, sigH - 12) } catch { /* ignore */ }
  }

  // Cadre CLIENT
  drawDashedRect(sigRightX, sigY, sigBoxW, sigH, C.green)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setText(doc, C.greenDark)
  doc.text('C L I E N T', sigRightX + 3, sigY + 5)

  const isAccepte = data.statut === 'signe' || data.statut === 'facture'
  if (isAccepte) {
    if (data.client_signature_base64) {
      try { doc.addImage(data.client_signature_base64, 'PNG', sigRightX + 4, sigY + 7, 0, sigH - 14) } catch { /* ignore */ }
    } else {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setText(doc, C.greenDark)
      doc.text('Bon pour accord', sigRightX + sigBoxW / 2, sigY + sigH / 2 + 1, { align: 'center' })
    }
    if (data.date_signature) {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
      doc.text(`Le ${fmtDate(data.date_signature)}`, sigRightX + sigBoxW / 2, sigY + sigH - 3, { align: 'center' })
    }
  } else {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
    doc.text('Date et signature précédées de "Bon pour accord"', sigRightX + sigBoxW / 2, sigY + sigH - 3, { align: 'center' })
  }

  drawMiniHeaderAllPagesAfterFirst(doc, 'DEVIS', data.numero)
  drawFooterAllPages(doc, ent, data.numero)
  return doc.output('datauristring').split(',')[1]
}

// ===================================================================
// FACTURE PDF
// ===================================================================

export function generateFacturePdf(data: FactureData): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ent = data.entreprise
  const lignes = normalizeLignes(data.lignes)
  const isSituation = data.type === 'situation'

  // —— 0. Calculs préliminaires (acompte versé) ——————————————————
  const hasAcompte = !!(
    (data.acompte_montant_ttc !== undefined && data.acompte_montant_ttc > 0) ||
    (data.acompte_pourcent !== undefined && data.acompte_pourcent > 0)
  )
  const acompteTTC = hasAcompte
    ? (data.acompte_montant_ttc !== undefined
      ? data.acompte_montant_ttc
      : data.montant_ttc * ((data.acompte_pourcent as number) / 100))
    : 0
  const acompteHT = hasAcompte
    ? (data.acompte_montant_ht !== undefined
      ? data.acompte_montant_ht
      : data.montant_ht * (acompteTTC / Math.max(data.montant_ttc, 1)))
    : 0
  const netAPayerTTC = Math.max(data.montant_ttc - acompteTTC, 0)

  const dateParts: string[] = []
  dateParts.push(`Date : ${fmtDate(data.date_emission)}`)
  if (data.date_echeance) dateParts.push(`Échéance : ${fmtDate(data.date_echeance)}`)
  if (data.date_prestation) dateParts.push(`Prestation : ${fmtDate(data.date_prestation)}`)

  const headerOpts: HeaderOpts = isSituation
    ? {
      title: 'FACTURE DE SITUATION',
      numero: data.numero,
      subtitle: data.numero_situation ? `Situation N° ${data.numero_situation}` : undefined,
      refLine: data.devis_ref ? `Sur devis N° ${data.devis_ref}${data.devis_date ? ` du ${fmtDate(data.devis_date)}` : ''}` : undefined,
      dateLine: dateParts.join(' | '),
    }
    : {
      title: 'FACTURE',
      numero: data.numero,
      dateLine: dateParts.join(' | '),
    }

  let y = drawHeader(doc, ent, headerOpts, 12)

  // —— FILET DE SÉCURITÉ : bannière "mentions légales incomplètes" ——
  // Mêmes mentions obligatoires que pour les devis (art. 242 nonies A CGI).
  const champsManquantsFacture = getChampsLegauxManquants(ent as unknown as Record<string, unknown>)
  if (champsManquantsFacture.length > 0) {
    y = drawIncompletProfileBanner(doc, champsManquantsFacture, y)
  }

  y = drawIdentityBoxes(doc, ent, { clientNom: data.clientNom, clientAdresse: data.clientAdresse }, y)
  if (data.objet) y = drawObjet(doc, data.objet, y)

  // —— V6 : pré-calcul de l'espace requis en bas pour totaux+conditions+IBAN ——
  // Le bottomMargin du tableau est calé sur ce besoin réel pour éviter tout vide blanc :
  // si la table ne tient pas, elle saute proprement de page ; si elle tient, les totaux suivent direct.
  const hasReste = isSituation && (data.reste_a_facturer_ht !== undefined || data.reste_a_facturer_ttc !== undefined)
  const hasIban = !!(ent.iban && ent.iban.trim())
  let NEEDED_BOTTOM = 55
  if (hasAcompte) NEEDED_BOTTOM += 14
  if (hasReste) NEEDED_BOTTOM += 14
  if (hasIban) NEEDED_BOTTOM += 26
  // +10mm de respiration entre fin tableau et début totaux
  const tableBottomMargin = NEEDED_BOTTOM + 10

  if (isSituation) {
    const M = 14, pageW = 210
    const w = pageW - 2 * M
    const pct = data.pourcentage_situation ?? 0
    const totalTTC = data.montant_ttc / (pct > 0 ? pct / 100 : 1)
    const desc = `Situation #${data.numero_situation ?? '?'} pour le devis n° ${data.devis_ref ?? '-'}${data.devis_date ? ` du ${fmtDate(data.devis_date)}` : ''} - ${pct}% TTC sur un montant total de ${fmt(totalTTC)} TTC`

    setFill(doc, C.skyVeryPale)
    const blockH = 22
    doc.roundedRect(M, y, w, blockH, 2, 2, 'F')
    setFill(doc, C.sky); doc.rect(M, y, 1.4, blockH, 'F')

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlueAccent)
    doc.text('DESCRIPTION DE LA SITUATION', M + 5, y + 5.5)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setText(doc, C.navy)
    const split = doc.splitTextToSize(desc, w - 10)
    doc.text(split, M + 5, y + 11)
    y += blockH + 4

    autoTable(doc, {
      startY: y,
      head: [['DÉSIGNATION', 'TOTAL HT']],
      body: [[`Situation N°${data.numero_situation ?? '?'} (${pct}%)`, fmt(data.montant_ht)]],
      theme: 'plain',
      margin: { left: M, right: M, bottom: tableBottomMargin },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: C.navy, lineColor: C.border, lineWidth: 0.1 },
      headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right', cellWidth: 32 } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4
  } else {
    // —— MODE FORFAIT GLOBAL (V8) : bandeau explicite si les lignes sont a 0 EUR ——
    if (detectForfaitMode(lignes, data.montant_ht)) {
      y = drawForfaitBanner(doc, data.montant_ht, y)
    }
    y = drawHierTable(doc, lignes, y, tableBottomMargin)
  }

  // V6 : si malgré la marge réservée, la fin du tableau dépasse, sécurité :
  if (y + NEEDED_BOTTOM > 290) { doc.addPage(); y = 20 }

  y += 10 // V4 : marge respiration tableau — totaux (facture)
  let tvaGroups = computeTvaGroups(lignes)
  const isForfaitFacture = detectForfaitMode(lignes, data.montant_ht)
  // V11 — Bug fix : en mode forfait global, les lignes sont a 0 EUR, donc
  // computeTvaGroups(lignes) retourne {} ou {10: 0}. La ligne TVA disparaissait
  // du recapitulatif (filtre > 0.005 ligne 878) alors que data.montant_tva > 0
  // (ex: facture forfait 3000 HT + TVA 10% = 3300 TTC, ligne TVA 300 invisible).
  // On reconstruit tvaGroups depuis data.montant_tva en deduisant le taux.
  if (isForfaitFacture && data.montant_tva > 0 && data.montant_ht > 0) {
    const tauxBrut = (data.montant_tva / data.montant_ht) * 100
    const taux = Math.round(tauxBrut * 10) / 10 // arrondi a 0.1% (gere 5.5, 10, 20)
    tvaGroups = { [taux]: data.montant_tva }
  }
  const totalsStartY = y

  // —— BLOC TOTAUX (droite) avec acompte si présent ——
  const rightEndY = drawTotals(doc, {
    ht: data.montant_ht,
    ttc: data.montant_ttc,
    tvaGroups,
    // Parite HTML : si acompte verse, label "NET A PAYER A RECEPTION"
    // pour clarifier qu'il s'agit du solde restant apres acompte.
    netLabel: hasAcompte ? 'NET À PAYER À RÉCEPTION' : 'NET À PAYER',
    netAmount: hasAcompte ? netAPayerTTC : undefined,
    acomptePct: hasAcompte
      ? (data.acompte_pourcent ?? Math.round((acompteTTC / Math.max(data.montant_ttc, 1)) * 100))
      : undefined,
    acompteMontant: hasAcompte ? acompteTTC : undefined,
    resteMontant: hasAcompte ? netAPayerTTC : undefined,
    resteAFacturerHT: hasReste ? data.reste_a_facturer_ht : undefined,
    resteAFacturerTTC: hasReste ? data.reste_a_facturer_ttc : undefined,
    isForfait: isForfaitFacture,
  }, y)

  // —— COLONNE GAUCHE : conditions + notes perso + mentions ——
  let leftY = totalsStartY
  const M = 14
  const leftMaxW = 88

  // Conditions de paiement (pré-remplies si absent)
  const conditions = (data.conditions_paiement && data.conditions_paiement.trim())
    || (data.notes && data.notes.trim()) // legacy fallback
    || DEFAULT_CONDITIONS_PAIEMENT

  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlue)
  doc.text('Conditions de paiement', M, leftY); leftY += 4
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
  const splitCond = doc.splitTextToSize(conditions, leftMaxW)
  doc.text(splitCond, M, leftY); leftY += splitCond.length * 3.2 + 2

  // Notes personnalisées (visibles client — ex: "Travaux du 11 au 13 mai")
  if (data.notes_personnalisees && data.notes_personnalisees.trim()) {
    leftY += 1.5
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlue)
    doc.text('Notes', M, leftY); leftY += 4
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setText(doc, C.navy)
    const splitNotes = doc.splitTextToSize(data.notes_personnalisees, leftMaxW)
    doc.text(splitNotes, M, leftY); leftY += splitNotes.length * 3.2 + 2
  }

  // Mentions légales standardisées
  leftY += 1
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); setText(doc, C.muted)
  doc.text('Pénalités de retard : 3x le taux d\'intérêt légal en vigueur (art. L.441-10 C. com.).', M, leftY, { maxWidth: leftMaxW })
  leftY += 5.5
  if (data.clientType === 'professionnel') {
    doc.text('Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D.441-5 C. com.).', M, leftY, { maxWidth: leftMaxW })
    leftY += 5.5
  }
  doc.text('Pas d\'escompte pour paiement anticipé.', M, leftY); leftY += 4

  // Mentions TVA (293B auto ou 10%/5.5%)
  const tvaMentions = getTvaMentions(lignes)
  if (tvaMentions.length > 0) {
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
    for (const m of tvaMentions) {
      const split = doc.splitTextToSize(m, leftMaxW)
      doc.text(split, M, leftY); leftY += split.length * 2.6 + 1.5
    }
  }

  // Article L441-3
  doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
  doc.text('Facture émise conformément aux articles L441-3 et suivants du Code de commerce.', M, leftY, { maxWidth: leftMaxW })
  leftY += 4

  // Mentions légales entreprise (parité HTML) — assurance décennale, RCS_RM,
  // médiateur, qualification pro, forme juridique, capital, custom.
  // Format compact italique 7pt, identique au reste des mentions.
  const entMentions: string[] = []
  if (ent.assurance_nom || ent.decennale_numero) {
    let line = `Assurance décennale : ${ent.assurance_nom || ''}`
    if (ent.decennale_numero) line += ` — n° ${ent.decennale_numero}`
    if (ent.assurance_zone) line += ` — Zone : ${ent.assurance_zone}`
    entMentions.push(line.trim())
  }
  if (ent.forme_juridique === 'EI' || ent.forme_juridique === 'Micro-entreprise') {
    entMentions.push(`${ent.nom || ''} — ${ent.forme_juridique === 'Micro-entreprise' ? 'Entrepreneur individuel (Micro-entreprise)' : 'Entrepreneur individuel (EI)'}`)
  }
  if (ent.capital_social && ['EURL', 'SARL', 'SAS', 'SASU'].includes(String(ent.forme_juridique || ''))) {
    entMentions.push(`${ent.forme_juridique} au capital de ${ent.capital_social}`)
  }
  if (ent.rcs_rm) entMentions.push(String(ent.rcs_rm))
  if (ent.qualification_pro) entMentions.push(`Qualification : ${ent.qualification_pro}`)
  // Médiateur : on reconstitue depuis les 4 nouveaux champs ; fallback sur l'ancien champ libre.
  {
    const mNom = (ent.mediateur_nom as string) || ''
    const mAdr = (ent.mediateur_adresse as string) || ''
    const mCP = (ent.mediateur_code_postal as string) || ''
    const mVille = (ent.mediateur_ville as string) || ''
    const ligneAdresse = [mAdr, [mCP, mVille].filter(Boolean).join(' ')].filter(Boolean).join(' — ')
    const mediateurFmt = [mNom, ligneAdresse].filter(Boolean).join(' — ')
    if (mediateurFmt) {
      entMentions.push(`Médiateur : ${mediateurFmt}`)
    } else if (ent.mediateur) {
      entMentions.push(`Médiateur : ${ent.mediateur}`)
    }
  }
  if (ent.mentions_legales_custom) entMentions.push(String(ent.mentions_legales_custom))

  if (entMentions.length > 0) {
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); setText(doc, C.muted)
    for (const m of entMentions) {
      const split = doc.splitTextToSize(m, leftMaxW)
      doc.text(split, M, leftY); leftY += split.length * 2.6 + 0.6
    }
    leftY += 1
  }

  // Ventilation TVA si plusieurs taux (sous totaux à droite)
  if (Object.keys(tvaGroups).length > 1) {
    drawTvaBreakdown(doc, lignes, rightEndY + 1)
  }

  // -----------------------------------------------------------------
  // BLOC IBAN/BIC - moitié gauche (88mm), juste APRÈS les mentions
  // -----------------------------------------------------------------
  if (hasIban) {
    const ribW = leftMaxW
    const ribH = 21
    const ribY = leftY + 2

    setFill(doc, C.skyVeryPale)
    setDraw(doc, C.sky); doc.setLineWidth(0.3)
    doc.roundedRect(M, ribY, ribW, ribH, 2, 2, 'FD')
    setFill(doc, C.sky)
    doc.rect(M, ribY, 1.6, ribH, 'F')

    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); setText(doc, C.netBlue)
    doc.text('POUR RÉGLER PAR VIREMENT', M + 5, ribY + 5)

    const ibanClean = (ent.iban as string).replace(/\s+/g, '').toUpperCase()
    const ibanFormatted = ibanClean.match(/.{1,4}/g)?.join(' ') || ibanClean

    doc.setFontSize(8); doc.setFont('courier', 'bold'); setText(doc, C.navy)
    doc.text(`IBAN : ${ibanFormatted}`, M + 5, ribY + 10)

    if (ent.bic && ent.bic.trim()) {
      doc.setFontSize(8); doc.setFont('courier', 'bold'); setText(doc, C.navy)
      doc.text(`BIC : ${ent.bic.trim().toUpperCase()}`, M + 5, ribY + 14.5)
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setText(doc, C.muted)
    doc.text(`Bénéficiaire : ${ent.nom || ''}`, M + 5, ribY + 18.5, { maxWidth: ribW - 8 })
  }

  const miniTitle = isSituation ? 'FACTURE DE SITUATION' : 'FACTURE'
  drawMiniHeaderAllPagesAfterFirst(doc, miniTitle, data.numero)
  drawFooterAllPages(doc, ent, data.numero)
  return doc.output('datauristring').split(',')[1]
}
