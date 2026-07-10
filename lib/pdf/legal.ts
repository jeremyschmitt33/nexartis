// lib/pdf/legal.ts - V3.0c
// Mentions legales : TVA italique muted + AGEC + grille 2x2 mentions
// dans encadre skyVeryPale (Assurance / Statut / Mediateur / Retractation).
// + banniere amber profil incomplet.

import type { jsPDF } from 'jspdf'
import { C, type Palette } from './palette'
import {
  font,
  setFill,
  setDraw,
  type PdfLigne,
} from './utils'
import {
  getLegalMentionsDevis,
  getLegalMentionsFacture,
  type LegalContext,
  type LegalMention,
} from '@/lib/legal-mentions'
import { buildDechetsText } from '@/lib/dechets-parts'

export interface LegalEntreprise {
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
  code_naf?: string
  tva_intracommunautaire?: string
  franchise_tva?: boolean
  assurance_nom?: string
  decennale_numero?: string
  assurance_zone?: string
  qualification_pro?: string
  mentions_legales_custom?: string
  mediateur?: string
  mediateur_nom?: string
  mediateur_adresse?: string
  mediateur_code_postal?: string
  mediateur_ville?: string
  iban?: string
  bic?: string
}

export interface LegalClient {
  clientSiret?: string
  clientType?: string
}

export interface LegalDechets {
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

// ---------------------------------------------------------------------------
// Filet securite : champs obligatoires manquants
// ---------------------------------------------------------------------------
const CHAMPS_LEGAUX: { champ: keyof LegalEntreprise; label: string }[] = [
  { champ: 'nom', label: 'Raison sociale' },
  { champ: 'siret', label: 'SIRET' },
  { champ: 'forme_juridique', label: 'Forme juridique' },
  { champ: 'adresse', label: 'Adresse' },
  { champ: 'code_postal', label: 'Code postal' },
  { champ: 'ville', label: 'Ville' },
]

export function getChampsLegauxManquants(ent: LegalEntreprise | null | undefined): string[] {
  if (!ent) return CHAMPS_LEGAUX.map(c => c.label)
  return CHAMPS_LEGAUX
    .filter(c => {
      const val = ent[c.champ]
      return !val || String(val).trim() === ''
    })
    .map(c => c.label)
}

export function drawIncompletProfileBanner(
  doc: jsPDF,
  champsManquants: string[],
  y: number,
): number {
  const M = 18
  const w = 174
  const h = 11
  setFill(doc, C.amberBg)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'F')
  setDraw(doc, C.amberBorder); doc.setLineWidth(0.5)
  doc.roundedRect(M, y, w, h, 1.5, 1.5, 'S')
  setFill(doc, C.amberAccent)
  doc.rect(M, y, 1.8, h, 'F')

  font(doc, 'Hanken Grotesk', 'bold', 7, C.amberText)
  doc.text('MENTIONS LÉGALES INCOMPLÈTES', M + 5, y + 4.2)

  font(doc, 'Hanken Grotesk', 'normal', 7, C.amberAccent)
  const txt = `Manquant${champsManquants.length > 1 ? 's' : ''} dans le profil entreprise : ${champsManquants.join(', ')}.`
  const split = doc.splitTextToSize(txt, w - 8)
  doc.text(split, M + 5, y + 8.2)

  return y + h + 4
}

// ---------------------------------------------------------------------------
// LegalContext builder
// ---------------------------------------------------------------------------
export function buildLegalContext(
  kind: 'devis' | 'facture',
  ent: LegalEntreprise,
  lignes: PdfLigne[],
  client: { siret?: string; type?: string },
  factureType?: 'standard' | 'avoir' | 'acompte' | 'situation',
  hasSousTraitanceBTP?: boolean,
): LegalContext {
  const explicit = (client.type || '').toLowerCase()
  let clientType: 'particulier' | 'pro' = 'particulier'
  if (explicit === 'professionnel' || explicit === 'pro' || explicit === 'entreprise') {
    clientType = 'pro'
  } else if (client.siret && client.siret.trim() !== '') {
    clientType = 'pro'
  }
  return {
    kind,
    entreprise: ent as unknown as LegalContext['entreprise'],
    client: { siret: client.siret, client_type: client.type },
    clientType,
    lignes: lignes as unknown as LegalContext['lignes'],
    factureType,
    hasSousTraitanceBTP: hasSousTraitanceBTP === true,
  }
}

// ---------------------------------------------------------------------------
// Rendu d'une liste de mentions en italique 6.5 pt muted
// ---------------------------------------------------------------------------
const TVA_KEYS = new Set(['tva-ae', 'tva-10', 'tva-55'])

export function isTvaMention(m: LegalMention): boolean {
  return TVA_KEYS.has(m.key)
}

export function drawLegalMentionsBlock(
  doc: jsPDF,
  mentions: LegalMention[],
  startY: number,
  x: number,
  maxW: number,
): number {
  let leftY = startY
  for (const m of mentions) {
    font(doc, 'Hanken Grotesk', m.italique === false ? 'normal' : 'normal', 6.5, C.muted)
    const split = doc.splitTextToSize(m.text, maxW)
    doc.text(split, x, leftY)
    leftY += split.length * 2.6 + 0.6
  }
  return leftY
}

// ---------------------------------------------------------------------------
// drawLegal : TVA + AGEC + grille 2x2 dans encadre skyVeryPale
// ---------------------------------------------------------------------------
const M = 18
const W = 174

interface DrawLegalOpts {
  factureType?: 'standard' | 'avoir' | 'acompte' | 'situation'
  dechets?: LegalDechets
  // 2026-06-10 — Autoliquidation BTP (art. 283-2 nonies CGI). Quand true, la
  // mention obligatoire est ajoutee aux mentions legales du document.
  hasSousTraitanceBTP?: boolean
}

export function drawLegal(
  doc: jsPDF,
  ent: LegalEntreprise,
  client: LegalClient,
  lignes: PdfLigne[],
  kind: 'devis' | 'facture',
  yStart: number,
  opts: DrawLegalOpts = {},
  palette: Palette = C,
): number {
  const P = palette
  let y = yStart

  // 1. Mentions TVA italiques : V3.0c.4 Fix 10 — DEPLACEES dans drawTvaCertifications
  //    cote totals.ts (colonne gauche, sous les conditions de paiement).
  //    Bloc retire ici pour eviter le doublon.

  // 2. AGEC dechets — V3.0c.5 Fix C : section visuellement separee avec trait
  // au-dessus + padding genereux (parite HTML dashboard).
  if (opts.dechets && (opts.dechets.nature || opts.dechets.collecte_nom)) {
    y += 4 // marge avant la section
    setDraw(doc, P.border)
    doc.setLineWidth(0.3)
    doc.line(M, y, M + W, y)
    y += 5 // padding apres le trait

    // Pastille "AGEC" (fond bandeau, texte blanc) + titre, alignes verticalement.
    const pillW = 11.5, pillH = 4.4
    const midY = y + pillH / 2
    setFill(doc, P.navy)
    doc.roundedRect(M, y, pillW, pillH, 1, 1, 'F')
    font(doc, 'Hanken Grotesk', 'bold', 6.5, P.white)
    doc.text('AGEC', M + pillW / 2, midY, { align: 'center', baseline: 'middle' })
    font(doc, 'Hanken Grotesk', 'semibold', 7, P.muted)
    doc.text('Gestion des déchets', M + pillW + 3, midY, { baseline: 'middle' })
    y = y + pillH + 3

    // Texte dense — MEME helper que le rendu HTML (parite stricte des 4 rendus).
    font(doc, 'Hanken Grotesk', 'normal', 8, P.navy)
    const dechetsText = buildDechetsText({
      nature: opts.dechets.nature,
      quantite: opts.dechets.quantite,
      responsable: opts.dechets.responsable,
      tri: opts.dechets.tri,
      collecteNom: opts.dechets.collecte_nom,
      collecteAdresse: opts.dechets.collecte_adresse,
      collecteType: opts.dechets.collecte_type,
      cout: opts.dechets.cout,
      coutInclus: opts.dechets.inclure_cout,
    })
    const split = doc.splitTextToSize(dechetsText, W)
    doc.text(split, M, y)
    y += split.length * 3.2 + 4 // padding apres
  }

  // 3. Encadre 2x2 mentions legales (Assurance / Statut / Mediateur / Retractation)
  const ctx = buildLegalContext(kind, ent, lignes, { siret: client.clientSiret, type: client.clientType }, opts.factureType, opts.hasSousTraitanceBTP)
  const allMentions = kind === 'devis' ? getLegalMentionsDevis(ctx) : getLegalMentionsFacture(ctx)
  // Mentions non-TVA, on les rend dans la grille / sous la grille
  const nonTva = allMentions.filter(m => !isTvaMention(m))

  // Cellules de la grille (textes construits ici a partir de l'entreprise)
  type Cell = { label: string; value: string }
  const cells: Cell[] = []
  cells.push({
    label: 'ASSURANCE DÉCENNALE',
    value: buildAssuranceText(ent),
  })
  cells.push({
    label: 'STATUT JURIDIQUE',
    value: buildStatutText(ent),
  })
  cells.push({
    label: 'MÉDIATEUR DE LA CONSOMMATION',
    value: buildMediateurText(ent),
  })
  cells.push({
    label: 'RÉTRACTATION',
    value: 'Rétractation 14 jours pour travaux hors établissement (art. L221-18 C. conso.).',
  })

  const cellW = (W - 6) / 2
  const padCell = 5
  // Mesure de hauteur dynamique (max des 2 lignes de la grille)
  const heights: number[] = cells.map(c => {
    font(doc, 'Hanken Grotesk', 'normal', 8, P.navy)
    const lines = doc.splitTextToSize(c.value, cellW - padCell * 2).length
    return 3.5 + lines * 3.4 + padCell
  })
  const row1H = Math.max(heights[0], heights[1])
  const row2H = Math.max(heights[2], heights[3])
  const boxH = padCell + row1H + 4 + row2H + padCell

  // V3.0d Fix : empeche l'encadre 2x2 de chevaucher le footer (qui demarre a y=282).
  // Si la grille ne tient pas dans la page courante (y + boxH > 280mm), saut de page propre.
  // Le footer est ajoute sur toutes les pages a la fin par drawFooterAllPages, donc apres
  // addPage() le contenu reste safe.
  const PAGE_BOTTOM_SAFE = 280
  if (y + boxH > PAGE_BOTTOM_SAFE) {
    doc.addPage()
    y = 25
  }

  setFill(doc, P.skyVeryPale)
  doc.roundedRect(M, y, W, boxH, 4, 4, 'F')

  // Positions des 4 cellules
  const positions = [
    { x: M + padCell, y: y + padCell, cell: cells[0] },
    { x: M + padCell + cellW + 6, y: y + padCell, cell: cells[1] },
    { x: M + padCell, y: y + padCell + row1H + 4, cell: cells[2] },
    { x: M + padCell + cellW + 6, y: y + padCell + row1H + 4, cell: cells[3] },
  ]

  for (const p of positions) {
    font(doc, 'Hanken Grotesk', 'semibold', 7, P.muted)
    doc.text(p.cell.label, p.x, p.y + 2.5, { charSpace: 0.6 })
    font(doc, 'Hanken Grotesk', 'normal', 8, P.navy)
    const split = doc.splitTextToSize(p.cell.value, cellW - padCell * 2)
    doc.text(split, p.x, p.y + 6.5)
  }
  y += boxH + 4

  // 4. Mentions complementaires (penalites, indemnite, escompte, L441-3, custom)
  if (nonTva.length > 0) {
    const compl = nonTva.filter(m => m.key !== 'decennale' && m.key !== 'forme-juridique' && m.key !== 'rcs-rm' && m.key !== 'mediateur' && m.key !== 'retractation')
    if (compl.length > 0) {
      y = drawLegalMentionsBlock(doc, compl, y, M, W)
      y += 2
    }
  }

  return y
}

// ---------------------------------------------------------------------------
// Builders de texte de cellule
// ---------------------------------------------------------------------------
function buildAssuranceText(ent: LegalEntreprise): string {
  const parts: string[] = []
  if (ent.assurance_nom) parts.push(ent.assurance_nom)
  if (ent.decennale_numero) parts.push(`n° ${ent.decennale_numero}`)
  if (ent.assurance_zone) parts.push(`Zone : ${ent.assurance_zone}`)
  return parts.length > 0 ? `Garantie décennale — ${parts.join(' — ')}` : '—'
}

function buildStatutText(ent: LegalEntreprise): string {
  const lines: string[] = []
  const main: string[] = []
  if (ent.nom) main.push(ent.nom)
  if (ent.forme_juridique) main.push(ent.forme_juridique)
  if (main.length > 0) lines.push(main.join(' — '))
  if (ent.rcs_rm) lines.push(`RCS/RM : ${ent.rcs_rm}`)
  if (ent.code_naf) lines.push(`APE/NAF : ${ent.code_naf}`)
  return lines.length > 0 ? lines.join('\n') : '—'
}

function buildMediateurText(ent: LegalEntreprise): string {
  // Nouveaux champs (4 sous-champs)
  const parts: string[] = []
  if (ent.mediateur_nom) parts.push(ent.mediateur_nom)
  if (ent.mediateur_adresse) parts.push(ent.mediateur_adresse)
  const cv = `${ent.mediateur_code_postal || ''} ${ent.mediateur_ville || ''}`.trim()
  if (cv) parts.push(cv)
  if (parts.length > 0) return parts.join(', ')
  // Fallback ancien champ libre
  if (ent.mediateur) return ent.mediateur
  return 'Non renseigné'
}
