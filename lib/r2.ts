import crypto from 'crypto'

/**
 * Acces a Cloudflare R2 (stockage des photos de chantier).
 *
 * - presignR2Url : URLs SIGNEES (query string) pour que le NAVIGATEUR envoie (PUT)
 *   / lise (GET) les fichiers DIRECTEMENT vers R2, sans transiter par Vercel.
 * - r2Delete / r2HeadContentLength : requetes SERVEUR signees dans l'EN-TETE
 *   (Authorization SigV4) — methode fiable pour DELETE et HEAD sur R2.
 *
 * SigV4 implemente avec `crypto` (Node natif) : aucune dependance npm ajoutee.
 * Bucket PRIVE : seules ces signatures donnent acces.
 */

const REGION = 'auto'
const SERVICE = 's3'
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function getConf() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Configuration R2 manquante (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)')
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, host: `${accountId}.r2.cloudflarestorage.com` }
}

function sha256hex(s: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}
function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}
function signingKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac('AWS4' + secret, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  return hmac(kService, 'aws4_request')
}
/** Encodage RFC3986 strict (AWS exige !*'() encodes). */
function enc(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}
function encPath(key: string): string {
  return key.split('/').map(enc).join('/')
}
function amzNow(): { amzDate: string; dateStamp: string } {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

/**
 * URL signee (presigned, query string) pour le navigateur.
 * @param method GET (lecture) ou PUT (upload)
 */
export function presignR2Url(method: 'GET' | 'PUT', key: string, expiresSec = 900): string {
  const { accessKeyId, secretAccessKey, bucket, host } = getConf()
  const { amzDate, dateStamp } = amzNow()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const canonicalUri = `/${bucket}/${encPath(key)}`

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuerystring = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&')
  const canonicalRequest = [method, canonicalUri, canonicalQuerystring, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n')
  const signature = crypto.createHmac('sha256', signingKey(secretAccessKey, dateStamp)).update(stringToSign, 'utf8').digest('hex')
  return `https://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`
}

/**
 * Requete serveur signee dans l'en-tete (Authorization SigV4), corps vide.
 * Utilisee pour DELETE et HEAD (fiable sur R2, contrairement aux presigned DELETE).
 */
async function r2SignedRequest(method: 'DELETE' | 'HEAD', key: string): Promise<Response> {
  const { accessKeyId, secretAccessKey, bucket, host } = getConf()
  const { amzDate, dateStamp } = amzNow()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const canonicalUri = `/${bucket}/${encPath(key)}`
  const payloadHash = EMPTY_SHA256

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n')
  const signature = crypto.createHmac('sha256', signingKey(secretAccessKey, dateStamp)).update(stringToSign, 'utf8').digest('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(`https://${host}${canonicalUri}`, {
    method,
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  })
}

/** Supprime un objet R2 (cote serveur, signature en-tete). */
export async function r2Delete(key: string): Promise<void> {
  if (!key) return
  const res = await r2SignedRequest('DELETE', key)
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete a echoue: ${res.status}`)
  }
}

/** Renvoie la taille reelle (octets) d'un objet R2, ou null si absent. */
export async function r2HeadContentLength(key: string): Promise<number | null> {
  if (!key) return null
  const res = await r2SignedRequest('HEAD', key)
  if (!res.ok) return null
  const len = res.headers.get('content-length')
  return len ? parseInt(len, 10) : null
}
