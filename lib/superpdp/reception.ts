// lib/superpdp/reception.ts
// ---------------------------------------------------------------------------
// RECEPTION des factures electroniques (obligation 01/09/2026).
//
// Ce module masque la forme reelle de l'API SUPER PDP derriere UN type
// normalise (`ReceivedInvoice`). Toute la connaissance "fragile" (forme exacte
// du payload entrant, encore partiellement inconnue) est concentree ici dans
// `normalizeInvoice()` : si SUPER PDP change/precise sa reponse, on ne touche
// qu'a une seule fonction (cf. DESIGN_RECEPTION_EFACTURE.md §2).
//
// 100% serveur (jamais de jeton cote navigateur).
// ---------------------------------------------------------------------------

import {
  getSuperPdpEndpoint,
  SuperPdpError,
  type SuperPdpInvoice,
  type SuperPdpList,
} from './client'

export { downloadInvoiceFile } from './client'
export type { SuperPdpFileResult, SuperPdpDownloadFormat } from './client'

/** Mode de recuperation des entrantes — isole l'hypothese API (cf. DESIGN §2). */
export type ReceptionMode = 'direction_in'
export function getReceptionMode(): ReceptionMode {
  // Une seule hypothese confirmee a ce jour (RAPPORT_SUPERPDP_RECEPTION) :
  // GET /v1.beta/invoices?direction=in. Le flag permet d'en basculer une autre
  // sans toucher au cron ni a l'UI.
  return (process.env.SUPERPDP_RECEPTION_MODE as ReceptionMode) || 'direction_in'
}

/** Detail d'un taux de TVA (multi-taux defensif). */
export interface TvaDetail {
  taux: number | null
  base: number | null
  montant: number | null
}

/** Facture REÇUE, normalisee (forme stable cote Nexartis). */
export interface ReceivedInvoice {
  superpdpId: number
  direction: string
  numero: string | null
  typeDocument: 'facture' | 'avoir'
  emetteurNom: string | null
  emetteurSiren: string | null
  emetteurSiret: string | null
  emetteurTvaIntra: string | null
  dateEmission: string | null // YYYY-MM-DD
  dateEcheance: string | null // YYYY-MM-DD
  devise: string
  montantHt: number | null
  montantTva: number | null
  montantTtc: number | null
  tvaDetails: TvaDetail[] | null
  statutPdpCode: string | null
  statutPdpText: string | null
  raw: unknown
}

// ---------------------------------------------------------------------------
// Helpers de parsing DEFENSIF (le payload entrant n'est pas garanti)
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Recupere la 1re valeur non-vide en suivant des chemins "a.b.c". */
function pick(root: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = root
    let ok = true
    for (const seg of path.split('.')) {
      const rec = asRecord(cur)
      if (!rec || !(seg in rec)) { ok = false; break }
      cur = rec[seg]
    }
    if (ok && cur !== undefined && cur !== null && cur !== '') return cur
  }
  return undefined
}

function toStr(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return null
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Normalise une date en YYYY-MM-DD (accepte ISO, YYYYMMDD, etc.). */
function toDate(v: unknown): string | null {
  const s = toStr(v)
  if (!s) return null
  // YYYYMMDD (CII/UBL format 102)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/**
 * Transforme un objet SUPER PDP brut en `ReceivedInvoice`.
 * IMPORTANT : tout est optionnel. On essaie plusieurs chemins probables
 * (en_invoice EN 16931, champs plats, seller/supplier...) ; ce qui manque
 * reste null et `raw` est conserve pour re-parsing ulterieur.
 */
export function normalizeInvoice(inv: SuperPdpInvoice): ReceivedInvoice {
  const en = pick(inv, ['en_invoice'])
  const root: unknown = inv

  // typeCode 381 = avoir (note de credit), 380 = facture.
  const typeCode = toStr(pick(root, ['type_code', 'invoice_type_code', 'en_invoice.type_code', 'document_type']))
  const isAvoir = typeCode === '381' || /credit|avoir/i.test(typeCode || '')

  const seller = pick(root, ['seller', 'supplier', 'en_invoice.seller', 'from', 'sender']) ?? en

  const tvaDetailsRaw = pick(root, ['tax_breakdown', 'vat_breakdown', 'en_invoice.tax_breakdown', 'taxes'])
  let tvaDetails: TvaDetail[] | null = null
  if (Array.isArray(tvaDetailsRaw)) {
    tvaDetails = tvaDetailsRaw.map((t) => ({
      taux: toNum(pick(t, ['rate', 'percent', 'taux'])),
      base: toNum(pick(t, ['basis', 'base', 'taxable_amount'])),
      montant: toNum(pick(t, ['amount', 'tax_amount', 'montant'])),
    }))
  }

  // Statut PDP : dernier evenement connu, sinon champ status_code a plat.
  let statutPdpCode: string | null = null
  let statutPdpText: string | null = null
  const events = Array.isArray(inv.events) ? inv.events : null
  if (events && events.length > 0) {
    const last = events[events.length - 1]
    statutPdpCode = toStr(last?.status_code)
    statutPdpText = toStr(last?.status_text)
  }
  if (!statutPdpCode) statutPdpCode = toStr(pick(root, ['status_code', 'status']))
  if (!statutPdpText) statutPdpText = toStr(pick(root, ['status_text']))

  return {
    superpdpId: Number(inv.id),
    direction: toStr(pick(root, ['direction'])) ?? 'in',
    numero: toStr(pick(root, ['number', 'invoice_number', 'numero', 'en_invoice.number', 'id_number'])),
    typeDocument: isAvoir ? 'avoir' : 'facture',
    emetteurNom: toStr(pick(seller, ['name', 'legal_name', 'formal_name', 'nom'])),
    emetteurSiren: toStr(pick(seller, ['siren', 'registration_siren'])),
    emetteurSiret: toStr(pick(seller, ['siret', 'registration_siret', 'identifier'])),
    emetteurTvaIntra: toStr(pick(seller, ['vat', 'vat_number', 'tva_intra', 'tax_id'])),
    dateEmission: toDate(pick(root, ['issue_date', 'date', 'invoice_date', 'en_invoice.issue_date'])),
    dateEcheance: toDate(pick(root, ['due_date', 'payment_due_date', 'date_echeance', 'en_invoice.due_date'])),
    devise: toStr(pick(root, ['currency', 'devise', 'currency_code'])) ?? 'EUR',
    montantHt: toNum(pick(root, ['total_excl_tax', 'amount_excl_tax', 'montant_ht', 'tax_basis_total', 'en_invoice.total_excl_tax'])),
    montantTva: toNum(pick(root, ['total_tax', 'tax_amount', 'montant_tva', 'en_invoice.total_tax'])),
    montantTtc: toNum(pick(root, ['total_incl_tax', 'amount_incl_tax', 'grand_total', 'montant_ttc', 'en_invoice.total_incl_tax'])),
    tvaDetails,
    statutPdpCode,
    statutPdpText,
    raw: inv,
  }
}

// ---------------------------------------------------------------------------
// Recuperation paginee des entrantes
// ---------------------------------------------------------------------------

/**
 * Recupere les factures REÇUES, normalisees, depuis le curseur `sinceId`
 * (exclu). Suit la pagination curseur de SUPER PDP (order=asc + starting_after_id)
 * tant que `has_after` est vrai, dans la limite de `maxItems` (borne anti-timeout).
 *
 * La sequence `id` est strictement croissante PAR ENTREPRISE (RAPPORT SUPER PDP),
 * ce qui garantit l'exhaustivite sans trou tant qu'on avance le curseur sur le
 * plus grand id traite.
 */
export async function fetchReceivedInvoices(
  accessToken: string,
  opts: { sinceId?: number | null; maxItems?: number; pageSize?: number } = {},
): Promise<ReceivedInvoice[]> {
  const maxItems = opts.maxItems ?? 200
  const pageSize = Math.min(opts.pageSize ?? 50, 100)
  const out: ReceivedInvoice[] = []
  let cursor = opts.sinceId && opts.sinceId > 0 ? opts.sinceId : null
  let guard = 0 // anti-boucle infinie (securite)

  while (out.length < maxItems && guard < 100) {
    guard += 1
    const params = new URLSearchParams({
      direction: 'in',
      order: 'asc',
      limit: String(pageSize),
    })
    if (cursor) params.set('starting_after_id', String(cursor))

    const resp = await fetch(`${getSuperPdpEndpoint()}/v1.beta/invoices?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) throw new SuperPdpError('Lecture des factures recues impossible', resp.status)
    const page = (await resp.json()) as SuperPdpList<SuperPdpInvoice>
    const rows = Array.isArray(page.data) ? page.data : []
    if (rows.length === 0) break

    for (const inv of rows) {
      const normalized = normalizeInvoice(inv)
      // Securite : on n'accepte que des ids entiers positifs (anti path-traversal
      // sur le chemin Storage construit a partir de l'id, et coherence curseur).
      if (Number.isInteger(normalized.superpdpId) && normalized.superpdpId > 0) {
        out.push(normalized)
        cursor = normalized.superpdpId
      }
    }

    if (!page.has_after) break
  }

  return out
}
