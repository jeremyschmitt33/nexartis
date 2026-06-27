import type { FactureData, Ligne } from '../pdf'
import type { FacturXSchema } from './invoicer'
import { unitCode } from './units'

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function isBillable(ligne: Ligne): boolean {
  return !ligne.type || ligne.type === 'prestation'
}

function splitAddress(adresse: string | undefined, fallbackName: string): {
  line1: string
  postCode: string
  city: string
} {
  const parts = String(adresse || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const last = parts[parts.length - 1] || ''
  const match = last.match(/(\d{5})\s+(.+)/)
  const line1 = parts[0] || fallbackName || 'NC'
  if (match) return { line1, postCode: match[1], city: match[2] }
  return { line1, postCode: '00000', city: last || 'NC' }
}

interface VatCategory {
  code: 'S' | 'Z' | 'E' | 'AE'
  rate: number
  reason?: string
}

export interface MappingResult {
  data: FacturXSchema
  reconciliation: {
    lineTotalHt: number
    taxTotal: number
    grandTotalTtc: number
    duePayable: number
    billableLineCount: number
  }
}

export function mapFactureToFacturX(facture: FactureData): MappingResult {
  const ent = facture.entreprise || {}
  const isPro = facture.clientType === 'professionnel'
  const isAutoliquidation = facture.autoliquidation_btp === true
  const isFranchise = ent.franchise_tva === true

  function categoryOf(rate?: number): VatCategory {
    if (isAutoliquidation) {
      return { code: 'AE', rate: 0, reason: 'Autoliquidation - article 283-2 nonies du CGI' }
    }
    if (isFranchise) {
      return { code: 'E', rate: 0, reason: 'TVA non applicable, article 293 B du CGI' }
    }
    if (Number(rate) > 0) return { code: 'S', rate: Number(rate) }
    return { code: 'Z', rate: 0 }
  }

  const billable = (facture.lignes || []).filter(isBillable)

  const vatMap = new Map<string, { code: VatCategory['code']; rate: number; reason?: string; basis: number }>()
  for (const ligne of billable) {
    const category = categoryOf(ligne.taux_tva)
    const base = round2(Number(ligne.quantite || 0) * Number(ligne.prix_unitaire_ht || 0))
    const key = `${category.code}@${category.rate}`
    const group = vatMap.get(key) || { code: category.code, rate: category.rate, reason: category.reason, basis: 0 }
    group.basis = round2(group.basis + base)
    vatMap.set(key, group)
  }
  const vatGroups = Array.from(vatMap.values()).map((g) => ({ ...g, tax: round2((g.basis * g.rate) / 100) }))

  const lineTotalHt = round2(vatGroups.reduce((sum, g) => sum + g.basis, 0))
  const taxTotal = round2(vatGroups.reduce((sum, g) => sum + g.tax, 0))
  const grandTotalTtc = round2(lineTotalHt + taxTotal)
  // V2 imputation : un avoir d'un autre dossier impute en reglement est un montant
  // DEJA REGLE (par compensation) -> on le compte comme "prepaye" (BT-113), au meme
  // titre que l'acompte. Ainsi le montant DU structure (XML) = ce que le client doit
  // vraiment payer, coherent avec le PDF visuel. Le total HT/TVA/TTC reste PLEIN.
  const avoirImpute = round2((facture.type !== 'avoir' ? (facture.avoir_impute_montant || 0) : 0))
  const paidAmount = round2((facture.acompte_montant_ttc || 0) + avoirImpute)
  const duePayable = round2(grandTotalTtc - paidAmount)

  const sellerVat = ent.tva_intracommunautaire && !isFranchise ? ent.tva_intracommunautaire : undefined
  const sellerTaxRegistration = sellerVat
    ? { vatIdentifier: sellerVat }
    : ent.siret
      ? { localIdentifier: ent.siret }
      : undefined

  const typeCode = facture.type === 'avoir' ? '381' : facture.type === 'acompte' ? '386' : '380'

  const buyerAddr = splitAddress(facture.clientAdresse, facture.clientNom)
  const today = new Date().toISOString().slice(0, 10)

  const data = {
    businessProcessType: 'A1',
    number: facture.numero,
    typeCode,
    issueDate: new Date(facture.date_emission || today),
    includedNote: facture.conditions_paiement ? [{ content: String(facture.conditions_paiement) }] : undefined,
    transaction: {
      line: billable.map((ligne, index) => {
        const category = categoryOf(ligne.taux_tva)
        const netPrice = round2(Number(ligne.prix_unitaire_ht || 0))
        const quantity = Number(ligne.quantite || 0)
        return {
          identifier: String(index + 1),
          tradeProduct: { name: String(ligne.designation || 'Prestation').slice(0, 500) },
          tradeAgreement: { netTradePrice: { chargeAmount: netPrice } },
          tradeDelivery: { billedQuantity: { amount: quantity, unitMeasureCode: unitCode(ligne.unite) } },
          tradeSettlement: {
            tradeTax: { typeCode: 'VAT', categoryCode: category.code, rateApplicablePercent: category.rate },
            monetarySummation: { lineTotalAmount: round2(netPrice * quantity) },
          },
        }
      }),
      tradeAgreement: {
        buyerReference: facture.clientSiret || facture.numero,
        seller: {
          name: ent.nom || 'NC',
          identifier: ent.siret ? [ent.siret] : undefined,
          organization: ent.siret
            ? { registrationIdentifier: { value: ent.siret, schemeIdentifier: '0009' } }
            : undefined,
          postalAddress: {
            line1: ent.adresse || 'NC',
            city: ent.ville || 'NC',
            postCode: ent.code_postal || '00000',
            countryCode: 'FR',
          },
          taxRegistration: sellerTaxRegistration,
          electronicAddress: ent.email ? { value: ent.email, schemeIdentifier: 'EM' } : undefined,
          tradeContact: { name: ent.nom || 'NC', phoneNumber: ent.telephone, emailAddress: ent.email },
        },
        buyer: {
          name: facture.clientNom || 'NC',
          postalAddress: {
            line1: buyerAddr.line1,
            city: buyerAddr.city,
            postCode: buyerAddr.postCode,
            countryCode: 'FR',
          },
          taxRegistration: isPro && facture.clientTvaIntra ? { vatIdentifier: facture.clientTvaIntra } : undefined,
        },
      },
      tradeDelivery: {
        information: { deliveryDate: new Date(facture.date_prestation || facture.date_emission || today) },
      },
      tradeSettlement: {
        currencyCode: 'EUR',
        vatBreakdown: vatGroups.map((g) => ({
          calculatedAmount: g.tax,
          typeCode: 'VAT',
          basisAmount: g.basis,
          categoryCode: g.code,
          rateApplicablePercent: g.rate,
          ...(g.reason ? { exemptionReasonText: g.reason } : {}),
        })),
        monetarySummation: {
          lineTotalAmount: lineTotalHt,
          taxBasisTotalAmount: lineTotalHt,
          taxTotal: taxTotal > 0 ? { amount: taxTotal, currencyCode: 'EUR' } : undefined,
          grandTotalAmount: grandTotalTtc,
          paidAmount: paidAmount > 0 ? paidAmount : undefined,
          duePayableAmount: duePayable,
        },
        paymentTerms: {
          ...(facture.date_echeance ? { dueDate: new Date(facture.date_echeance) } : {}),
          description:
            (facture.conditions_paiement && String(facture.conditions_paiement).trim()) ||
            (facture.date_echeance
              ? `Paiement au plus tard le ${new Date(facture.date_echeance).toLocaleDateString('fr-FR')}.`
              : 'Paiement a reception de la facture.'),
        },
        paymentInstruction: ent.iban
          ? { typeCode: '58', transfers: [{ paymentAccountIdentifier: ent.iban }] }
          : { typeCode: '30' },
      },
    },
  }

  return {
    data: data as unknown as FacturXSchema,
    reconciliation: {
      lineTotalHt,
      taxTotal,
      grandTotalTtc,
      duePayable,
      billableLineCount: billable.length,
    },
  }
}
