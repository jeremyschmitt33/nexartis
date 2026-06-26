import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * GET /api/documents/download?id=<documentId>
 *
 * Coffre-fort (Vague 2b). Verifie l'auth + la PROPRIETE du document
 * (user_id), puis renvoie une URL signee (GET) temporaire pour telecharger
 * le fichier prive depuis R2. Meme pattern que les photos de chantier
 * (presignR2Url 'GET'). Le bucket est prive : seule cette signature donne acces.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`doc-download:${ip}`, 60, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return secureError('ID du document manquant')
  if (!isValidUUID(id)) return secureError('ID du document invalide')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('documents/download: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: doc } = await admin
    .from('documents_stockes')
    .select('id, nom, fichier_url, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()
  if (!doc) return secureError('Document introuvable', 404)

  const key = String(doc.fichier_url || '')
  // Defense en profondeur : la cle DOIT appartenir au prefixe de cet utilisateur.
  if (!key.startsWith(`${user.id}/`)) return secureError('Cle de fichier invalide', 403)

  // Forcer le NOM D'ORIGINE au telechargement (au lieu de la cle UUID R2).
  // RFC 5987 : filename*=UTF-8''<valeur encodee> gere les accents/espaces.
  const nom = String(doc.nom || 'document')
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`

  return secureJson({
    url: presignR2Url('GET', key, 300, { responseContentDisposition: disposition }),
    nom: doc.nom,
  })
}
