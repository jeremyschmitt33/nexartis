import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getAuthenticatedUser, secureJson, unauthorizedError } from '@/lib/api-security'
import { presignR2Url, r2HeadContentLength, r2Delete } from '@/lib/r2'

/**
 * GET /api/chantier-photos/selftest
 *
 * DIAGNOSTIC TEMPORAIRE. Teste l'acces R2 cote SERVEUR (sans navigateur, donc
 * sans CORS) : ecrit un minuscule fichier, le relit (HEAD), puis le supprime.
 * Renvoie la VRAIE reponse de R2 -> permet de distinguer un probleme de cles,
 * de signature, ou de CORS navigateur. A SUPPRIMER une fois le souci resolu.
 */
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const env = {
    accountId_len: (process.env.R2_ACCOUNT_ID || '').length,
    accessKey_len: (process.env.R2_ACCESS_KEY_ID || '').length,
    secret_len: (process.env.R2_SECRET_ACCESS_KEY || '').length,
    bucket: process.env.R2_BUCKET || null,
  }

  const result: Record<string, unknown> = { env }

  try {
    const key = `selftest/${randomUUID()}.txt`
    const putUrl = presignR2Url('PUT', key, 300)
    const putRes = await fetch(putUrl, { method: 'PUT', body: 'hello-nexartis' })
    result.put_status = putRes.status
    if (!putRes.ok) {
      result.put_body = (await putRes.text()).slice(0, 700)
    } else {
      result.head_len = await r2HeadContentLength(key)
      try { await r2Delete(key); result.cleaned = true } catch { result.cleaned = false }
    }
  } catch (e) {
    result.exception = (e as Error).message
  }

  // Sonde du controle CORS preliminaire (ce que fait le navigateur avant le PUT)
  try {
    const key2 = `selftest/${randomUUID()}.txt`
    const putUrl2 = presignR2Url('PUT', key2, 300)
    const opt = await fetch(putUrl2, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://nexartis.fr',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    result.preflight_status = opt.status
    result.preflight_allow_origin = opt.headers.get('access-control-allow-origin')
    result.preflight_allow_methods = opt.headers.get('access-control-allow-methods')
    result.preflight_allow_headers = opt.headers.get('access-control-allow-headers')
  } catch (e) {
    result.preflight_exception = (e as Error).message
  }

  return secureJson(result)
}
