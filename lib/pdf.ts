// lib/pdf.ts - V3.0c "Edition Signature"
// Orchestrateur PDF Devis + Facture. La logique de rendu est repartie dans
// les modules lib/pdf/* (palette, utils, header, identity, objet, table,
// totals, legal, signatures, footer).
//
// Exports publics conserves (utilises par les routes API) :
//   - generateDevisPdf(data: DevisData): string
//   - generateFacturePdf(data: FactureData): string

import { jsPDF } from 'jspdf'
import { registerPdfFonts } from '@/lib/pdf-fonts'

import { fmt, fmtDate, font, setFill, normalizeLignes, detectForfaitMode, type PdfLigne } from './pdf/utils'
import { drawHeader, drawMiniHeaderPages2Plus } from './pdf/header'
import { drawIdentityCards } from './pdf/identity'
import { drawObjet } from './pdf/objet'
import { drawTable } from './pdf/table'
import { drawTotals } from './pdf/totals'
import {
  drawLegal,
  getChampsLegauxManquants,
  drawIncompletProfileBanner,
  type LegalEntreprise,
} from './pdf/legal'
import { drawSignatures } from './pdf/signatures'
import { drawFooterAllPages } from './pdf/footer'
import { buildPalette, type Palette } from './pdf/palette'
import type { DocumentTheme } from './document-theme'

// ---------------------------------------------------------------------------
// Interfaces publiques (conservation stricte des champs vs ancien lib/pdf.ts)
// ---------------------------------------------------------------------------

export interface Entreprise {
  nom?: string
  metier?: string
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
  couleur_principale?: string
  logo_url?: string
  signature_base64?: string
  tampon_base64?: string
  mediateur?: string
  mediateur_nom?: string
  mediateur_adresse?: string
  mediateur_code_postal?: string
  mediateur_ville?: string
  iban?: string
  bic?: string
  // V3.1 : personnalisation de l'incrustation du logo
  doc_logo_style?: 'carte-classique' | 'carte-minimaliste' | 'sans-carte' | null
  doc_logo_size?: number | null
  doc_nom_size?: number | null
  // V3.1.7 : toggle affichage du nom de la societe a cote du logo (PDF + HTML)
  document_show_company_name?: boolean | null
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

export interface Dechets {
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
  clientSiret?: string
  clientTvaIntra?: string
  /** Adresse du chantier (peut differer de l'adresse client). */
  chantier_adresse?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  lignes: Ligne[]
  entreprise: Entreprise
  dechets?: Dechets
  statut?: string
  date_signature?: string
  client_signature_base64?: string
  // 2026-06-10 — Autoliquidation TVA BTP (sous-traitance, art. 283-2 nonies CGI).
  autoliquidation_btp?: boolean
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
  clientSiret?: string
  clientTvaIntra?: string
  chantier_adresse?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  lignes: Ligne[]
  entreprise: Entreprise
  /** @deprecated utiliser `conditions_paiement` + `notes_personnalisees` */
  notes?: string
  conditions_paiement?: string
  notes_personnalisees?: string
  acompte_pourcent?: number
  acompte_montant_ht?: number
  acompte_montant_ttc?: number
  acompte_label?: string
  type?: 'standard' | 'acompte' | 'situation' | 'avoir'
  numero_situation?: number
  pourcentage_situation?: number
  devis_ref?: string
  devis_date?: string
  montant_situation_precedent_ht?: number
  montant_situation_precedent_ttc?: number
  reste_a_facturer_ht?: number
  reste_a_facturer_ttc?: number
  // 2026-06-10 — Autoliquidation TVA BTP (sous-traitance, art. 283-2 nonies CGI).
  // Quand true : pousse hasSousTraitanceBTP=true dans le LegalContext → la mention
  // d'autoliquidation est ajoutee automatiquement en pied de doc (cf. legal-mentions.ts).
  // Note : c'est a l'appelant (route API) de garantir que toutes les lignes ont
  // bien taux_tva=0 quand ce flag est actif (parite HTML).
  autoliquidation_btp?: boolean
}

export const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'

// ===========================================================================
// DEVIS
// ===========================================================================
// V3.0d : `theme` est optionnel. Quand omis (ou null), la palette retombe
// sur la charte Nexartis historique → aucun changement visuel pour les devis
// existants. Quand fourni, toutes les couleurs thematables sont injectees
// dans la palette puis propagees a chaque module dessinateur.
export function generateDevisPdf(data: DevisData, theme?: DocumentTheme | null): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerPdfFonts(doc)
  const ent = data.entreprise
  // 2026-06-10 — Autoliquidation BTP : forcer TVA=0 sur les lignes (parite HTML).
  const rawLignes = data.autoliquidation_btp === true
    ? (data.lignes as PdfLigne[]).map(l => ({ ...l, taux_tva: 0 }))
    : (data.lignes as PdfLigne[])
  const lignes = normalizeLignes(rawLignes)
  const palette = buildPalette(theme ?? null)

  // 1. HEADER bandeau navy
  const headerBottomY = drawHeader(
    doc,
    ent,
    'DEVIS',
    data.numero,
    fmtDate(data.date_emission),
    'Émis le',
    fmtDate(data.date_validite),
    "Valable jusqu'au",
    palette,
  )

  // 2. Filet securite mentions incompletes (juste sous le bandeau)
  let y = headerBottomY + 6
  const champsManquants = getChampsLegauxManquants(ent as LegalEntreprise)
  if (champsManquants.length > 0) {
    y = drawIncompletProfileBanner(doc, champsManquants, y)
  }

  // 3. Cartes identite (badges chevauchent 2.5mm au-dessus de yStart)
  y = drawIdentityCards(
    doc,
    ent,
    {
      clientNom: data.clientNom,
      clientAdresse: data.clientAdresse,
      clientSiret: data.clientSiret,
      clientTvaIntra: data.clientTvaIntra,
    },
    y,
    palette,
  )

  // 4. Objet + adresse chantier
  if (data.objet || data.chantier_adresse) {
    y = drawObjet(doc, data.objet, data.chantier_adresse, y, palette) + 4
  }

  // 5. Tableau
  const isForfait = detectForfaitMode(lignes, data.montant_ht)
  y = drawTable(doc, lignes, y, isForfait, ent, data.objet, data.montant_ht, palette)

  // 6. Bloc CONDITIONS + RECAP + NET A PAYER
  y = drawTotals(
    doc,
    {
      numero: data.numero,
      conditions_paiement: data.conditions_paiement,
      acompte_pourcent: data.acompte_pourcent,
      montant_ht: data.montant_ht,
      montant_tva: data.montant_tva,
      montant_ttc: data.montant_ttc,
      entreprise: ent,
      netLabel: 'Net à payer',
    },
    lignes,
    false, // pas de bloc IBAN pour les devis
    y,
    palette,
  )

  // 7. Mentions legales (encadre 2x2 + AGEC + TVA)
  y += 4
  if (y > 250) { doc.addPage(); y = 25 }
  y = drawLegal(
    doc,
    ent as LegalEntreprise,
    { clientSiret: data.clientSiret, clientType: data.clientType },
    lignes,
    'devis',
    y,
    { dechets: data.dechets, hasSousTraitanceBTP: data.autoliquidation_btp === true },
    palette,
  )

  // 8. Signatures : enchainees apres les mentions legales sur la meme page
  // (drawSignatures gere automatiquement le saut de page si y > 230)
  drawSignatures(doc, ent, {
    statut: data.statut,
    date_signature: data.date_signature,
    client_signature_base64: data.client_signature_base64,
  }, y + 8, palette)

  // 9. Mini-header pages 2+ + footer toutes pages
  drawMiniHeaderPages2Plus(doc, ent, 'DEVIS', data.numero, data.date_emission)
  drawFooterAllPages(doc, ent, data.numero, 'Devis', palette)

  return doc.output('datauristring').split(',')[1]
}

// ===========================================================================
// FACTURE
// ===========================================================================
// V3.0d : meme contrat que generateDevisPdf — theme optionnel, palette propagee.
export function generateFacturePdf(data: FactureData, theme?: DocumentTheme | null): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerPdfFonts(doc)
  const ent = data.entreprise
  // 2026-06-10 — Autoliquidation BTP : on force le taux TVA a 0 sur toutes les
  // lignes prestations (parite stricte HTML/PDF). Les lignes section/sous_section
  // et commentaires gardent leur valeur (ignorees par les calculs TVA).
  const rawLignes = data.autoliquidation_btp === true
    ? (data.lignes as PdfLigne[]).map(l => ({ ...l, taux_tva: 0 }))
    : (data.lignes as PdfLigne[])
  const lignes = normalizeLignes(rawLignes)
  const isSituation = data.type === 'situation'
  const palette = buildPalette(theme ?? null)

  const title = isSituation ? 'FACTURE DE SITUATION' : 'FACTURE'

  // 1. HEADER
  const headerBottomY = drawHeader(
    doc,
    ent,
    title,
    data.numero,
    fmtDate(data.date_emission),
    'Émis le',
    fmtDate(data.date_echeance),
    'Échéance',
    palette,
  )

  // 2. Filet securite mentions incompletes
  let y = headerBottomY + 6
  const champsManquants = getChampsLegauxManquants(ent as LegalEntreprise)
  if (champsManquants.length > 0) {
    y = drawIncompletProfileBanner(doc, champsManquants, y)
  }

  // 3. Cartes identite
  y = drawIdentityCards(
    doc,
    ent,
    {
      clientNom: data.clientNom,
      clientAdresse: data.clientAdresse,
      clientSiret: data.clientSiret,
      clientTvaIntra: data.clientTvaIntra,
    },
    y,
    palette,
  )

  // 4. Objet + adresse chantier
  if (data.objet || data.chantier_adresse) {
    y = drawObjet(doc, data.objet, data.chantier_adresse, y, palette) + 4
  }

  // 4.bis V3.0c.18 — Bandeau AVANCEMENT pour factures de situation
  // (porté depuis lib/pdf.ts.clean L1098-1144, adapté à l'architecture modulaire V3.0c).
  // Affiche : Situation #N · % avancement | cumul précédent | cette situation | reste à facturer.
  if (isSituation) {
    y = drawSituationBanner(
      doc,
      {
        numeroSituation: data.numero_situation,
        pourcentageSituation: data.pourcentage_situation,
        devisRef: data.devis_ref,
        devisDate: data.devis_date,
        montantHt: data.montant_ht,
        montantTtc: data.montant_ttc,
        montantPrecedentHt: data.montant_situation_precedent_ht,
        montantPrecedentTtc: data.montant_situation_precedent_ttc,
        resteAFacturerHt: data.reste_a_facturer_ht,
        resteAFacturerTtc: data.reste_a_facturer_ttc,
      },
      y,
      palette,
    )
  }

  // 5. Tableau
  const isForfait = detectForfaitMode(lignes, data.montant_ht)
  y = drawTable(doc, lignes, y, isForfait, ent, data.objet, data.montant_ht, palette)

  // 6. Bloc CONDITIONS (avec IBAN) + RECAP + NET A PAYER
  y = drawTotals(
    doc,
    {
      numero: data.numero,
      conditions_paiement: data.conditions_paiement || data.notes,
      notes_personnalisees: data.notes_personnalisees,
      acompte_pourcent: data.acompte_pourcent,
      acompte_montant_ht: data.acompte_montant_ht,
      acompte_montant_ttc: data.acompte_montant_ttc,
      acompte_label: data.acompte_label,
      montant_ht: data.montant_ht,
      montant_tva: data.montant_tva,
      montant_ttc: data.montant_ttc,
      entreprise: ent,
      netLabel: 'Net à payer',
    },
    lignes,
    true, // bloc IBAN actif pour facture
    y,
    palette,
  )

  // 7. Mentions legales
  y += 4
  if (y > 250) { doc.addPage(); y = 25 }
  y = drawLegal(
    doc,
    ent as LegalEntreprise,
    { clientSiret: data.clientSiret, clientType: data.clientType },
    lignes,
    'facture',
    y,
    { factureType: data.type, hasSousTraitanceBTP: data.autoliquidation_btp === true },
    palette,
  )

  // 8. Mini-header pages 2+ + footer toutes pages
  drawMiniHeaderPages2Plus(doc, ent, title, data.numero, data.date_emission)
  drawFooterAllPages(doc, ent, data.numero, 'Facture', palette)

  return doc.output('datauristring').split(',')[1]
}

// ===========================================================================
// HELPER — Bandeau AVANCEMENT (factures de situation)
// ===========================================================================
// Carte sky avec barre orange à gauche, en-tête "AVANCEMENT DES TRAVAUX",
// puis ligne descriptive + grille 3 cellules :
//   1. Montant cumulé précédent  (= situations antérieures)
//   2. Cette situation           (= montant de la facture courante)
//   3. Reste à facturer          (omis si NULL, donc inconnu)
// Backward-compatible : si numero_situation/pourcentage_situation absents,
// affiche un libellé degrade ("Situation N°? · ?%") plutôt que de planter.
interface SituationBannerData {
  numeroSituation?: number
  pourcentageSituation?: number
  devisRef?: string
  devisDate?: string
  montantHt: number
  montantTtc: number
  montantPrecedentHt?: number
  montantPrecedentTtc?: number
  resteAFacturerHt?: number
  resteAFacturerTtc?: number
}

function drawSituationBanner(
  doc: jsPDF,
  d: SituationBannerData,
  yStart: number,
  palette: Palette,
): number {
  const P = palette
  const X = 18
  const W = 174
  const PAD = 5
  const BAR_W = 2

  const numStr = d.numeroSituation !== undefined ? String(d.numeroSituation) : '?'
  const pct = d.pourcentageSituation ?? 0
  const refSuffix = d.devisRef
    ? ` · Devis ${d.devisRef}${d.devisDate ? ` du ${fmtDate(d.devisDate)}` : ''}`
    : ''
  const headerLabel = `Situation N°${numStr} · ${pct}% d'avancement${refSuffix}`

  // Construction conditionnelle des cellules (reste facturer caché si NULL)
  const cells: Array<{ label: string; htValue?: number; ttcValue?: number }> = [
    {
      label: 'Cumul précédent',
      htValue: d.montantPrecedentHt,
      ttcValue: d.montantPrecedentTtc,
    },
    {
      label: 'Cette situation',
      htValue: d.montantHt,
      ttcValue: d.montantTtc,
    },
  ]
  const hasReste = d.resteAFacturerHt !== undefined || d.resteAFacturerTtc !== undefined
  if (hasReste) {
    cells.push({
      label: 'Reste à facturer',
      htValue: d.resteAFacturerHt,
      ttcValue: d.resteAFacturerTtc,
    })
  }

  // Hauteurs (mm)
  const H_HEADER = 6.2 // titre encadré
  const H_DESC = 5.6 // ligne descriptive
  const H_CELL = 11.5 // hauteur d'une cellule (label + montants)
  const totalH = H_HEADER + H_DESC + H_CELL + PAD * 2

  // Pagebreak si pas assez de place avant le footer
  if (yStart + totalH > 270) {
    doc.addPage()
    yStart = 25
  }

  // Carte de fond + barre orange
  setFill(doc, P.skyVeryPale)
  doc.roundedRect(X, yStart, W, totalH, 3, 3, 'F')
  setFill(doc, P.orange)
  doc.rect(X, yStart, BAR_W, totalH, 'F')

  const innerX = X + BAR_W + PAD
  const innerW = W - BAR_W - PAD * 2
  let cursorY = yStart + PAD + 3

  // En-tête uppercase (semblable aux autres bandeaux)
  font(doc, 'Hanken Grotesk', 'semibold', 7.5, P.muted)
  doc.text('AVANCEMENT DES TRAVAUX', innerX, cursorY, { charSpace: 0.6 })
  cursorY += H_HEADER

  // Ligne descriptive (bold navy)
  font(doc, 'Hanken Grotesk', 'bold', 10, P.navy)
  const descLines = doc.splitTextToSize(headerLabel, innerW)
  doc.text(descLines[0] ?? headerLabel, innerX, cursorY)
  cursorY += H_DESC

  // Grille de cellules (séparées par une fine bordure verticale)
  const cellW = innerW / cells.length
  const cellY = cursorY
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const cx = innerX + i * cellW
    // Label
    font(doc, 'Hanken Grotesk', 'semibold', 6.8, P.muted)
    doc.text(c.label.toUpperCase(), cx, cellY + 2.5, { charSpace: 0.5 })
    // Montant HT (principal)
    font(doc, 'Hanken Grotesk', 'extrabold', 10.5, P.navy)
    const htStr = c.htValue !== undefined ? fmt(c.htValue) : '—'
    doc.text(`${htStr} HT`, cx, cellY + 7.2)
    // Montant TTC (secondaire)
    if (c.ttcValue !== undefined) {
      font(doc, 'Hanken Grotesk', 'normal', 7, P.muted)
      doc.text(`${fmt(c.ttcValue)} TTC`, cx, cellY + 10.6)
    }
  }

  return yStart + totalH + 4
}
