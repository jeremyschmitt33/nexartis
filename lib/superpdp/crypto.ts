// lib/superpdp/crypto.ts
// ---------------------------------------------------------------------------
// Chiffrement des jetons OAuth SUPER PDP stockes en base (table
// superpdp_connexions). AES-256-GCM (chiffrement authentifie).
//
// POURQUOI : meme si la table n'a aucune policy RLS (lisible seulement via
// service_role), on ne veut pas conserver les access_token / refresh_token
// EN CLAIR en base. En cas de fuite de la base, les jetons restent inutilisables
// sans la cle (variable d'env SUPERPDP_TOKEN_ENC_KEY, jamais en base).
//
// COMPATIBILITE : un jeton chiffre est prefixe par "enc:v1:". Une valeur SANS
// ce prefixe est consideree comme un ancien jeton EN CLAIR (legacy) et renvoyee
// telle quelle a la lecture -> aucune rupture pour les connexions existantes.
// A la prochaine ecriture (reconnexion ou refresh), elle sera chiffree.
//
// DEGRADATION : si la cle est absente, le chiffrement renvoie la valeur en clair
// (avec un avertissement serveur) pour ne pas casser la prod avant que la
// variable d'env soit posee. A corriger des que possible.
// ---------------------------------------------------------------------------

import crypto from 'crypto'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // 96 bits, recommande pour GCM
const TAG_LEN = 16 // 128 bits

/** Lit et valide la cle (32 octets) depuis SUPERPDP_TOKEN_ENC_KEY (base64 ou hex). */
function getKey(): Buffer | null {
  const raw = process.env.SUPERPDP_TOKEN_ENC_KEY
  if (!raw) return null
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    // Cle PRESENTE mais invalide = mauvaise configuration : on alerte FORT
    // (sinon on retomberait silencieusement en stockage clair en croyant chiffrer).
    console.error(
      `superpdp/crypto: SUPERPDP_TOKEN_ENC_KEY invalide (${key.length} octets apres decodage, 32 attendus). Jeton NON chiffre.`,
    )
    return null
  }
  return key
}

/** Chiffre un jeton. Renvoie une chaine prefixee "enc:v1:". null -> null. */
export function encryptToken(plain: string | null | undefined): string | null {
  if (plain == null) return null
  const key = getKey()
  if (!key) {
    console.warn(
      'superpdp/crypto: SUPERPDP_TOKEN_ENC_KEY absente ou invalide -> jeton stocke EN CLAIR (a corriger).',
    )
    return plain // repli legacy : valeur en clair, sans prefixe
  }
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64')
}

/** Dechiffre un jeton. Une valeur sans prefixe est renvoyee telle quelle (legacy clair). */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored == null) return null
  if (!stored.startsWith(PREFIX)) return stored // ancien jeton en clair
  const key = getKey()
  if (!key) {
    throw new Error(
      'superpdp/crypto: SUPERPDP_TOKEN_ENC_KEY absente -> impossible de dechiffrer un jeton chiffre.',
    )
  }
  const data = Buffer.from(stored.slice(PREFIX.length), 'base64')
  const iv = data.subarray(0, IV_LEN)
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = data.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}
