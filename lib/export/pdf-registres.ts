// lib/export/pdf-registres.ts
// ---------------------------------------------------------------------------
// Registres légaux du micro-entrepreneur, générés CÔTÉ NAVIGATEUR (jsPDF +
// jspdf-autotable), comme lib/export/pdf-achats.ts.
//
//   1. Livre des recettes  — obligatoire pour TOUTES les activités micro.
//   2. Registre des achats — obligatoire uniquement pour la vente de
//      marchandises / l'hébergement (note affichée dans le PDF).
//
// Base légale (service-public.gouv.fr F36018, vérifiée le 21/02/2026) :
//   - Livre des recettes : montant + origine des recettes PERÇUES (encaissées),
//     chronologique, DISTINGUER les espèces des autres règlements, références
//     des pièces justificatives, identité du client.
//   - Registre des achats : date du RÈGLEMENT, moyen de paiement (distinguer le
//     chèque), référence justificatif, montant (décaissement), chronologique.
//   - Conservation 10 ans. Tenue informatique admise si datée à l'établissement.
//
// GARDE-FOU PRODUIT (décision Nexartis) : on ne promet AUCUNE conformité. Le PDF
// est une reproduction datée des données saisies, pas un registre certifié
// inaltérable. Un encart d'exclusions prévient des recettes non couvertes, pour
// ne jamais donner l'illusion trompeuse d'un registre complet (risque de faux).
//
// Police : "helvetica" intégrée à jsPDF (aucune fonte à enregistrer côté client).
// ---------------------------------------------------------------------------

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadPdfBlob, type PdfDownloadResult } from '@/lib/download-pdf'

// ===== Palette Nexartis (RGB) — identique à pdf-achats.ts =====
const NAVY: [number, number, number] = [15, 26, 58]
const ORANGE: [number, number, number] = [255, 122, 26]
const MUTED: [number, number, number] = [123, 139, 163]
const GREY_LINE: [number, number, number] = [230, 236, 242]
const HEAD_BG: [number, number, number] = [250, 251, 252]

// ===== Identité légale de l'entreprise (en-tête) =====
export interface EntrepriseIdentite {
  nom?: string | null
  siret?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  forme_juridique?: string | null
  regime_fiscal?: string | null
}

// ===== Helpers =====

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmtEur(n: number): string {
  // helvetica ne gère pas l'espace fine insécable -> espace simple + "EUR".
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
}

function fmtDateFr(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR')
}

/** Modes de règlement normalisés. La distinction espèces/chèque est légale. */
export type ModeReglement = 'especes' | 'cheque' | 'autres' | 'inconnu'

/**
 * Normalise un moyen de paiement en texte libre vers un bucket fiable.
 * On retire accents et casse, puis on cherche des racines. Toute valeur non
 * reconnue -> 'inconnu' (AFFICHÉE séparément dans le PDF : jamais noyée dans
 * "autres", pour ne pas fausser le sous-total espèces, sensible légalement).
 */
export function normaliserMode(raw?: string | null): ModeReglement {
  if (!raw) return 'inconnu'
  const s = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents (diacritiques combinants)
    .toLowerCase()
    .trim()
  if (!s) return 'inconnu'
  if (/(espece|cash|liquide|numeraire)/.test(s)) return 'especes'
  if (/(cheque|chq)/.test(s)) return 'cheque'
  // 'autre' est une valeur DÉLIBÉRÉE du CHECK paiements.methode → bucket "autres".
  if (s === 'autre' || s === 'autres') return 'autres'
  if (/(virement|\bvir\b|\bcb\b|carte|prlv|prelevement|wero|paylib|mandat|sepa)/.test(s)) return 'autres'
  // Valeur présente mais non reconnue -> AFFICHÉE comme "Non précisé" (jamais
  // noyée dans "autres", pour ne pas fausser le sous-total espèces).
  return 'inconnu'
}

const LIBELLE_MODE: Record<ModeReglement, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  autres: 'Virement / CB',
  inconnu: 'Non précisé',
}

/** Bloc en-tête commun : identité entreprise + titre + dates + mention légale. */
function enteteRegistre(
  doc: jsPDF,
  ent: EntrepriseIdentite,
  titre: string,
  annee: number,
  M: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text(`${titre} — Année ${annee}`, M, 16)

  // Filet orange sous le titre
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.setLineWidth(0.8)
  doc.line(M, 19.5, M + 48, 19.5)

  // Identité entreprise (gauche)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text(ent.nom || 'Entreprise', M, 27)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  const ligneAdresse = [ent.adresse, [ent.code_postal, ent.ville].filter(Boolean).join(' ')]
    .filter((p) => p && String(p).trim())
    .join(' — ')
  const infosGauche = [
    ligneAdresse,
    ent.siret ? `SIRET : ${ent.siret}` : '',
    [ent.forme_juridique, ent.regime_fiscal].filter(Boolean).join(' · '),
  ].filter((l) => l && l.trim())
  let y = 32
  for (const l of infosGauche) {
    doc.text(l, M, y)
    y += 4.5
  }

  // Mention de génération (droite)
  const pageW = doc.internal.pageSize.getWidth()
  const genLe = new Date().toLocaleDateString('fr-FR')
  doc.setFontSize(8)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  doc.text(`Reproduction des données saisies`, pageW - M, 27, { align: 'right' })
  doc.text(`Établi le ${genLe}`, pageW - M, 31.5, { align: 'right' })

  return Math.max(y, 40) // Y de départ pour le corps
}

/** Pied de page garde-fou commun (sur la dernière position connue). */
function piedGardeFou(doc: jsPDF, M: number, extra?: string) {
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  const yBase = pageH - 14
  doc.setDrawColor(GREY_LINE[0], GREY_LINE[1], GREY_LINE[2])
  doc.setLineWidth(0.2)
  doc.line(M, yBase - 3, pageW - M, yBase - 3)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  const base =
    'Document établi par Nexartis à partir de vos données. Ne se substitue pas à un expert-comptable. À conserver 10 ans.'
  doc.text(extra ? `${extra}  •  ${base}` : base, M, yBase, { maxWidth: pageW - 2 * M })
}

// ===========================================================================
// 1) LIVRE DES RECETTES
// ===========================================================================

export interface RecetteRow {
  /** Date d'encaissement (paiements.date_paiement). */
  date_paiement?: string | null
  /** Référence de la pièce (factures.numero). */
  facture_numero?: string | null
  /** Identité du client (factures.client_nom). */
  client_nom?: string | null
  /** Nature de la prestation (factures.objet). */
  objet?: string | null
  /** Moyen de règlement (paiements.methode, texte libre). */
  methode?: string | null
  /** Montant encaissé. */
  montant?: number | string | null
}

export interface LivreRecettesData {
  entreprise: EntrepriseIdentite
  annee: number
  /** Recettes de l'année, déjà filtrées (deleted_at null), triées ou non. */
  recettes: RecetteRow[]
  /** Nombre de paiements exclus faute de date (pour l'encart d'exclusions). */
  nbSansDate?: number
}

export function buildLivreRecettesPdf(data: LivreRecettesData): jsPDF {
  const { entreprise, annee, recettes, nbSansDate = 0 } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 12

  const yStart = enteteRegistre(doc, entreprise, 'Livre des recettes', annee, M)

  // Tri chronologique par date d'encaissement.
  const lignes = [...recettes].sort((a, b) => {
    const da = a.date_paiement ? new Date(a.date_paiement).getTime() : 0
    const db = b.date_paiement ? new Date(b.date_paiement).getTime() : 0
    return da - db
  })

  // Sous-totaux par mode (distinction légale espèces / autres).
  let total = 0
  const parMode: Record<ModeReglement, number> = { especes: 0, cheque: 0, autres: 0, inconnu: 0 }

  const body = lignes.map((r, i) => {
    const montant = num(r.montant)
    const mode = normaliserMode(r.methode)
    total += montant
    parMode[mode] += montant
    return [
      String(i + 1),
      fmtDateFr(r.date_paiement),
      String(r.facture_numero ?? ''),
      String(r.client_nom ?? ''),
      String(r.objet ?? ''),
      LIBELLE_MODE[mode],
      fmtEur(montant),
    ]
  })

  autoTable(doc, {
    startY: yStart + 3,
    head: [['N°', 'Date', 'Réf. facture', 'Client', 'Nature', 'Règlement', 'Montant']],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: NAVY,
      lineColor: GREY_LINE,
      lineWidth: { bottom: 0.1 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: MUTED,
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: NAVY,
      lineWidth: { bottom: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'right' },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 38 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 24 },
      6: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: M, right: M, bottom: 22 },
  })

  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yStart
  y += 6

  // Anti-débordement : le bloc totaux + encart + pied (~75 mm) ne doit JAMAIS
  // être tronqué ni chevaucher le pied de page. Si le tableau finit trop bas,
  // on bascule ce bloc sur une nouvelle page (le total légal reste toujours lisible).
  if (y + 75 > doc.internal.pageSize.getHeight()) {
    doc.addPage()
    y = 20
  }

  // ===== Totaux (avec distinction espèces obligatoire) =====
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
  doc.setLineWidth(0.3)
  doc.line(pageW - M - 90, y, pageW - M, y)
  y += 5

  const ligneTotal = (label: string, montant: number, gras = false) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal')
    doc.setFontSize(gras ? 10 : 8.5)
    doc.setTextColor(gras ? NAVY[0] : MUTED[0], gras ? NAVY[1] : MUTED[1], gras ? NAVY[2] : MUTED[2])
    doc.text(label, pageW - M - 90, y)
    doc.setTextColor(gras ? ORANGE[0] : NAVY[0], gras ? ORANGE[1] : NAVY[1], gras ? ORANGE[2] : NAVY[2])
    doc.text(fmtEur(montant), pageW - M, y, { align: 'right' })
    y += gras ? 7 : 5
  }
  ligneTotal(`Total encaissé ${annee}`, total, true)
  ligneTotal('dont espèces', parMode.especes)
  ligneTotal('dont chèque', parMode.cheque)
  ligneTotal('dont virement / CB', parMode.autres)
  if (parMode.inconnu > 0) ligneTotal('dont règlement non précisé', parMode.inconnu)

  // ===== Encart d'exclusions (garde-fou anti-"faux") =====
  y += 3
  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2])
  doc.setDrawColor(GREY_LINE[0], GREY_LINE[1], GREY_LINE[2])
  const exclusions: string[] = [
    "Ce livre reprend uniquement les encaissements liés à une facture enregistrée dans Nexartis.",
    "Toute recette perçue sans facture doit être ajoutée séparément.",
    "Les avoirs et remboursements ne sont pas des encaissements et n'y figurent pas.",
  ]
  if (nbSansDate > 0) {
    exclusions.push(`${nbSansDate} paiement(s) sans date ont été exclus de ce registre.`)
  }
  if (parMode.inconnu > 0) {
    exclusions.push("Certains règlements n'ont pas de mode précisé (voir sous-total ci-dessus).")
  }
  const boxH = 5 + exclusions.length * 4
  doc.rect(M, y, pageW - 2 * M, boxH, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Périmètre de ce registre', M + 3, y + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  let yy = y + 9
  for (const ex of exclusions) {
    doc.text(`• ${ex}`, M + 3, yy, { maxWidth: pageW - 2 * M - 6 })
    yy += 4
  }

  piedGardeFou(doc, M)
  return doc
}

export function downloadLivreRecettesPdf(data: LivreRecettesData): PdfDownloadResult {
  const doc = buildLivreRecettesPdf(data)
  const blob = doc.output('blob')
  return downloadPdfBlob(blob, `nexartis_livre-recettes_${data.annee}.pdf`)
}

// ===========================================================================
// 2) REGISTRE DES ACHATS
// ===========================================================================

export interface AchatRegistreRow {
  /** Date du règlement (achats.date_reglement). */
  date_reglement?: string | null
  /** Fournisseur (nom résolu ou fournisseur_libre). */
  fournisseur?: string | null
  /** Référence de la pièce justificative (présence justificatif / description). */
  reference?: string | null
  /** Moyen de paiement (achats.moyen_paiement, texte libre). */
  moyen_paiement?: string | null
  /** Montant TTC (décaissement). */
  montant_ttc?: number | string | null
}

export interface RegistreAchatsData {
  entreprise: EntrepriseIdentite
  annee: number
  achats: AchatRegistreRow[]
}

export function buildRegistreAchatsPdf(data: RegistreAchatsData): jsPDF {
  const { entreprise, annee, achats } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 12

  const yStart = enteteRegistre(doc, entreprise, 'Registre des achats', annee, M)

  const lignes = [...achats].sort((a, b) => {
    const da = a.date_reglement ? new Date(a.date_reglement).getTime() : 0
    const db = b.date_reglement ? new Date(b.date_reglement).getTime() : 0
    return da - db
  })

  let total = 0
  const parMode: Record<ModeReglement, number> = { especes: 0, cheque: 0, autres: 0, inconnu: 0 }

  const body = lignes.map((a, i) => {
    const montant = num(a.montant_ttc)
    const mode = normaliserMode(a.moyen_paiement)
    total += montant
    parMode[mode] += montant
    return [
      String(i + 1),
      fmtDateFr(a.date_reglement),
      String(a.fournisseur ?? ''),
      String(a.reference ?? ''),
      LIBELLE_MODE[mode],
      fmtEur(montant),
    ]
  })

  autoTable(doc, {
    startY: yStart + 3,
    head: [['N°', 'Date règlement', 'Fournisseur', 'Réf. justificatif', 'Règlement', 'Montant TTC']],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: NAVY,
      lineColor: GREY_LINE,
      lineWidth: { bottom: 0.1 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: MUTED,
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: NAVY,
      lineWidth: { bottom: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'right' },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 40 },
      4: { cellWidth: 26 },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: M, right: M, bottom: 22 },
  })

  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yStart
  y += 6

  // Anti-débordement : bascule le bloc totaux + note + pied sur une nouvelle
  // page si le tableau finit trop bas (le total légal reste toujours lisible).
  if (y + 70 > doc.internal.pageSize.getHeight()) {
    doc.addPage()
    y = 20
  }

  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
  doc.setLineWidth(0.3)
  doc.line(pageW - M - 90, y, pageW - M, y)
  y += 5

  const ligneTotal = (label: string, montant: number, gras = false) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal')
    doc.setFontSize(gras ? 10 : 8.5)
    doc.setTextColor(gras ? NAVY[0] : MUTED[0], gras ? NAVY[1] : MUTED[1], gras ? NAVY[2] : MUTED[2])
    doc.text(label, pageW - M - 90, y)
    doc.setTextColor(gras ? ORANGE[0] : NAVY[0], gras ? ORANGE[1] : NAVY[1], gras ? ORANGE[2] : NAVY[2])
    doc.text(fmtEur(montant), pageW - M, y, { align: 'right' })
    y += gras ? 7 : 5
  }
  ligneTotal(`Total décaissé ${annee}`, total, true)
  ligneTotal('dont chèque', parMode.cheque)
  ligneTotal('dont espèces', parMode.especes)
  ligneTotal('dont virement / CB', parMode.autres)
  if (parMode.inconnu > 0) ligneTotal('dont règlement non précisé', parMode.inconnu)

  // Note d'applicabilité légale.
  y += 4
  doc.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2])
  doc.setDrawColor(GREY_LINE[0], GREY_LINE[1], GREY_LINE[2])
  const notes = [
    "Le registre des achats n'est légalement obligatoire que pour les activités de vente de",
    "marchandises, fournitures, denrées ou d'hébergement — pas pour les prestations de services.",
    "Il est fourni ici pour votre suivi de trésorerie.",
  ]
  const boxH = 5 + notes.length * 4
  doc.rect(M, y, pageW - 2 * M, boxH, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Bon à savoir', M + 3, y + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  let yy = y + 9
  for (const n of notes) {
    doc.text(n, M + 3, yy, { maxWidth: pageW - 2 * M - 6 })
    yy += 4
  }

  piedGardeFou(doc, M)
  return doc
}

export function downloadRegistreAchatsPdf(data: RegistreAchatsData): PdfDownloadResult {
  const doc = buildRegistreAchatsPdf(data)
  const blob = doc.output('blob')
  return downloadPdfBlob(blob, `nexartis_registre-achats_${data.annee}.pdf`)
}
