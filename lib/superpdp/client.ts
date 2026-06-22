/**
 * Client serveur SUPER PDP (facturation electronique / Plateforme Agreee).
 *
 * Ce module est la "boite a outils" qui dialogue avec l'API SUPER PDP.
 * Il est uniquement utilise cote serveur : les jetons et secrets ne doivent
 * JAMAIS etre exposes cote navigateur.
 *
 * Base API : https://api.superpdp.tech (identique sandbox / production).
 * Version : v1.beta (peut encore evoluer cote SUPER PDP).
 */

const DEFAULT_ENDPOINT = 'https://api.superpdp.tech'

/** Base de l'API SUPER PDP (surchargeable via la variable d'env SUPERPDP_ENDPOINT). */
export function getSuperPdpEndpoint(): string {
  return process.env.SUPERPDP_ENDPOINT || DEFAULT_ENDPOINT
}

// ---------------------------------------------------------------------------
// Types (minimaux — on enrichira au besoin)
// ---------------------------------------------------------------------------

export interface SuperPdpTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
}

export interface SuperPdpCompany {
  formal_name?: string
  [key: string]: unknown
}

/** Evenement de cycle de vie d'une facture (renvoye dans invoice.events). */
export interface SuperPdpInvoiceEvent {
  id?: number
  invoice_id?: number
  status_code?: string // ex: 'api:uploaded', 'api:sent', 'fr:212'...
  status_text?: string // libelle lisible fourni par SUPER PDP
  created_at?: string
  [key: string]: unknown
}

export interface SuperPdpInvoice {
  id: number
  en_invoice?: unknown
  /** Liste des evenements de traitement (cycle de vie) — present sur GET /invoices/{id}. */
  events?: SuperPdpInvoiceEvent[]
  [key: string]: unknown
}

export interface SuperPdpList<T> {
  data: T[]
}

/** Format de facture demande a SUPER PDP. */
export type SuperPdpFormat = 'factur-x' | 'ubl' | 'cii'

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export class SuperPdpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'SuperPdpError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/**
 * Obtient un jeton d'acces via le flux "client_credentials"
 * (un seul compte : bac a sable / tests). L'access_token vit ~30 minutes.
 */
export async function getClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<SuperPdpTokenResponse> {
  const resp = await fetch(`${getSuperPdpEndpoint()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })
  if (!resp.ok) {
    throw new SuperPdpError('Echec d authentification SUPER PDP', resp.status)
  }
  return (await resp.json()) as SuperPdpTokenResponse
}

/**
 * Flux "Authorization Code" (PRODUIT : chaque artisan relie SON compte).
 * Construit l'URL vers laquelle on envoie l'artisan pour qu'il autorise
 * Nexartis a acceder a son compte SUPER PDP.
 */
export interface AuthorizeUrlParams {
  clientId: string
  redirectUri: string
  state: string
  loginHint?: string
  companyNumber?: string
  companyScheme?: 'sandbox' | 'fr_siren' | 'be_numero_entreprise'
}

export function buildAuthorizeUrl(p: AuthorizeUrlParams): string {
  const url = new URL(`${getSuperPdpEndpoint()}/oauth2/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', p.clientId)
  url.searchParams.set('redirect_uri', p.redirectUri)
  url.searchParams.set('state', p.state)
  if (p.loginHint) url.searchParams.set('login_hint', p.loginHint)
  if (p.companyNumber && p.companyScheme) {
    url.searchParams.set('superpdp_company_number', p.companyNumber)
    url.searchParams.set('superpdp_company_number_scheme', p.companyScheme)
  }
  return url.toString()
}

/** Echange le "code" recu au retour contre des jetons (access + refresh). */
export async function exchangeCodeForTokens(opts: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<SuperPdpTokenResponse> {
  const resp = await fetch(`${getSuperPdpEndpoint()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
    }).toString(),
  })
  if (!resp.ok) throw new SuperPdpError('Echec de l echange du code SUPER PDP', resp.status)
  return (await resp.json()) as SuperPdpTokenResponse
}

/** Rafraichit un access_token expire a partir du refresh_token. */
export async function refreshAccessToken(opts: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<SuperPdpTokenResponse> {
  const resp = await fetch(`${getSuperPdpEndpoint()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }).toString(),
  })
  if (!resp.ok) throw new SuperPdpError('Echec du rafraichissement du jeton SUPER PDP', resp.status)
  return (await resp.json()) as SuperPdpTokenResponse
}

// ---------------------------------------------------------------------------
// Helper interne : appel authentifie
// ---------------------------------------------------------------------------

async function authedFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${getSuperPdpEndpoint()}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

// ---------------------------------------------------------------------------
// Appels metier
// ---------------------------------------------------------------------------

/** Renvoie l'entreprise associee au jeton (utile pour verifier la connexion). */
export async function getCompanyMe(accessToken: string): Promise<SuperPdpCompany> {
  const resp = await authedFetch(accessToken, '/v1.beta/companies/me')
  if (!resp.ok) throw new SuperPdpError('Lecture entreprise impossible', resp.status)
  return (await resp.json()) as SuperPdpCompany
}

/** Genere une facture de TEST prete a etre envoyee (bac a sable uniquement). */
export async function generateTestInvoice(
  accessToken: string,
  format: SuperPdpFormat = 'ubl',
): Promise<string> {
  const resp = await authedFetch(
    accessToken,
    `/v1.beta/invoices/generate_test_invoice?format=${encodeURIComponent(format)}`,
  )
  if (!resp.ok) throw new SuperPdpError('Generation facture de test impossible', resp.status)
  return resp.text()
}

/** Envoie une facture (Factur-X / UBL / CII). Renvoie la facture creee (avec id). */
export async function sendInvoice(
  accessToken: string,
  invoiceContent: string | Uint8Array,
): Promise<SuperPdpInvoice> {
  const resp = await authedFetch(accessToken, '/v1.beta/invoices', {
    method: 'POST',
    body: invoiceContent as BodyInit,
  })
  if (!resp.ok) throw new SuperPdpError('Envoi de la facture impossible', resp.status)
  return (await resp.json()) as SuperPdpInvoice
}

/** Liste les factures du compte (params : order, starting_after_id...). */
export async function listInvoices(
  accessToken: string,
  params: Record<string, string | number> = {},
): Promise<SuperPdpList<SuperPdpInvoice>> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  const resp = await authedFetch(accessToken, `/v1.beta/invoices${qs ? `?${qs}` : ''}`)
  if (!resp.ok) throw new SuperPdpError('Lecture des factures impossible', resp.status)
  return (await resp.json()) as SuperPdpList<SuperPdpInvoice>
}

/** Recupere une facture precise par son id. */
export async function getInvoice(
  accessToken: string,
  id: number | string,
): Promise<SuperPdpInvoice> {
  const resp = await authedFetch(accessToken, `/v1.beta/invoices/${id}`)
  if (!resp.ok) throw new SuperPdpError('Lecture de la facture impossible', resp.status)
  return (await resp.json()) as SuperPdpInvoice
}

/** Envoie un evenement de cycle de vie (ex. "Encaissee" = status_code "fr:212"). */
export async function sendInvoiceEvent(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const resp = await authedFetch(accessToken, '/v1.beta/invoice_events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new SuperPdpError('Envoi du statut impossible', resp.status)
  return true
}

// ---------------------------------------------------------------------------
// Validation (pre-envoi) — verifie la conformite d'une facture AVANT de l'envoyer
// ---------------------------------------------------------------------------

/** Rapport de validation renvoye par SUPER PDP (champ cle : is_valid). */
export interface SuperPdpValidationReport {
  is_valid: boolean
  [key: string]: unknown
}

/**
 * Valide une facture (Factur-X / UBL / CII) via le validateur officiel SUPER PDP.
 * Le format est detecte automatiquement. N'envoie PAS la facture : verifie juste
 * sa conformite (schematrons EN 16931 + regles France) pour bloquer en amont une
 * facture invalide. Ne necessite pas de jeton (endpoint de validation public).
 *
 * Renvoie le 1er rapport (`data[0]`). `is_valid === true` => la facture est conforme.
 */
export async function validateInvoice(
  content: Uint8Array | Buffer | string,
  filename = 'facture.pdf',
): Promise<SuperPdpValidationReport> {
  const form = new FormData()
  // Blob accepte string ou donnees binaires (Buffer/Uint8Array) cote Node 18+.
  const blob =
    typeof content === 'string'
      ? new Blob([content])
      : new Blob([new Uint8Array(content)])
  form.append('file', blob, filename)

  const resp = await fetch(`${getSuperPdpEndpoint()}/v1.beta/validation_reports`, {
    method: 'POST',
    body: form,
  })
  if (!resp.ok) {
    throw new SuperPdpError('Validation de la facture impossible', resp.status)
  }
  const json = (await resp.json()) as { data?: SuperPdpValidationReport[] }
  return json.data?.[0] ?? { is_valid: false }
}
