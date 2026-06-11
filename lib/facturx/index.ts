// lib/facturx/index.ts
// ---------------------------------------------------------------------------
// API publique du module Factur-X.
//
// Deux fonctions seulement, volontairement minimales :
//   - genererFacturXml(facture)            -> string  (le XML CII EN 16931)
//   - embarquerFacturX(pdf, facture, opts) -> Buffer  (PDF/A-3 hybride final)
//
// ETAT : module de FONDATION, non encore branche aux routes API de facturation.
// Le branchement (download-facture / send-facture) fera l'objet d'une etape
// dediee et revue separement (voir FACTURX_ARCHITECTURE.md). Tant qu'aucune
// route ne l'importe, ce module n'a AUCUN impact sur la production.
// ---------------------------------------------------------------------------

import type { FactureData } from '../pdf'
import { invoicer } from './invoicer'
import { mapFactureToFacturX, type MappingResult } from './mapping'

export { mapFactureToFacturX } from './mapping'
export type { MappingResult } from './mapping'
export { unitCode } from './units'

/**
 * Genere le XML Factur-X (Cross Industry Invoice, profil EN 16931) d'une facture.
 * Le XML seul ne constitue pas une facture electronique complete : il doit etre
 * embarque dans un PDF/A-3 via `embarquerFacturX`. Utile pour tests / archivage.
 */
export async function genererFacturXml(facture: FactureData): Promise<string> {
  const { data } = mapFactureToFacturX(facture)
  const invoice = invoicer.create(data)
  return invoice.toXML()
}

/**
 * Produit le PDF/A-3 hybride final : le PDF visuel existant + le XML Factur-X
 * embarque en piece jointe (fichier `factur-x.xml`, relation /Alternative).
 *
 * @param pdf      Le PDF visuel de la facture (sortie du generateur jsPDF existant).
 * @param facture  Les donnees de la facture (doivent correspondre exactement au PDF).
 * @param options  Metadonnees optionnelles (titre du document).
 * @returns        Un Buffer PDF/A-3 pret a etre telecharge ou envoye par email.
 */
export async function embarquerFacturX(
  pdf: Buffer | Uint8Array,
  facture: FactureData,
  options?: { titre?: string },
): Promise<Buffer> {
  const { data } = mapFactureToFacturX(facture)
  const invoice = invoicer.create(data)
  const result = await invoice.embedInPdf(pdf as Buffer, {
    metadata: { title: options?.titre || `Facture ${facture.numero}` },
  })
  return Buffer.from(result)
}

/** Re-export pratique du recapitulatif de totaux recalcules (audit de reconciliation). */
export type FacturXMappingResult = MappingResult
