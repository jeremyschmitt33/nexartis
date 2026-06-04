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

import { fmtDate, normalizeLignes, detectForfaitMode, type PdfLigne } from './pdf/utils'
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
import { buildPalette } from './pdf/palette'
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
  const lignes = normalizeLignes(data.lignes as PdfLigne[])
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
    { dechets: data.dechets },
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
  const lignes = normalizeLignes(data.lignes as PdfLigne[])
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
    { factureType: data.type },
    palette,
  )

  // 8. Mini-header pages 2+ + footer toutes pages
  drawMiniHeaderPages2Plus(doc, ent, title, data.numero, data.date_emission)
  drawFooterAllPages(doc, ent, data.numero, 'Facture', palette)

  return doc.output('datauristring').split(',')[1]
}
