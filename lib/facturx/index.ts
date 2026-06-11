import type { FactureData } from '../pdf'
import { invoicer } from './invoicer'
import { mapFactureToFacturX, type MappingResult } from './mapping'
import { packagePdfA3 } from './pdfa3'

export { mapFactureToFacturX } from './mapping'
export type { MappingResult } from './mapping'
export { unitCode } from './units'
export { packagePdfA3 } from './pdfa3'

export async function genererFacturXml(facture: FactureData): Promise<string> {
  const { data } = mapFactureToFacturX(facture)
  const invoice = invoicer.create(data)
  return invoice.toXML()
}

export async function embarquerFacturX(
  pdf: Buffer | Uint8Array,
  facture: FactureData,
  options?: { titre?: string },
): Promise<Buffer> {
  const xml = await genererFacturXml(facture)
  return packagePdfA3(pdf, xml, {
    title: options?.titre || `Facture ${facture.numero}`,
    numero: facture.numero,
  })
}

export type FacturXMappingResult = MappingResult
