import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { presignR2Url } from '@/lib/r2'

/**
 * POST /api/documents/sign-upload
 * Body : { filename, mime_type, size }
 *
 * Coffre-fort de documents (Vague 2b). Verifie l'auth + le QUOTA de stockage,
 * controle le type MIME (whitelist) et la taille (<= 10 Mo), puis renvoie une
 * URL signee (PUT) pour que le NAVIGATEUR envoie le fichier DIRECTEMENT vers R2
 * (cle scopee `${user.id}/coffre/${uuid}.ext`). On reutilise EXACTEMENT le
 * pattern presigne des photos de chantier.
 */
export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10 Mo : limite par fichier
const QUOTA_BYTES = 200 * 1024 * 1024 // 200 Mo : quota coffre-fort par artisan

// Liste blanche par EXTENSION (source de verite). On valide sur l'extension du
// nom de fichier plutot que sur le type MIME, car les navigateurs renvoient un
// MIME vide ou incoherent pour beaucoup de fichiers (typiquement le CSV, vu
// comme '' ou 'application/vnd.ms-excel' selon l'OS). Pas de SVG/HTML (vecteurs
// XSS) ni d'executables.
const ALLOWED_EXT = new Set<string>([
  // Documents
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
  // Tableurs & donnees
  'xls', 'xlsx', 'csv', 'tsv', 'ods',
  // Presentations
  'ppt', 'pptx', 'odp',
  // Images & scans
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff',
  // Archives (ex : catalogue fournisseur)
  'zip',
])

// Extrait l'extension en minuscules du nom de fichier ('facture.CSV' -> 'csv').
function extFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i < 0 || i === name.length - 1) return ''
  return name.slice(i + 1).toLowerCase()
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`doc-sign:${ip}`, 60, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let body: { filename?: string; mime_type?: string; size?: number }
  try { body = await req.json() } catch { return secureError('Requete invalide') }

  const ext = extFromName(String(body.filename || ''))
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return secureError('Type de fichier non autorise (PDF, Word, Excel, CSV, image, ZIP...).')
  }

  const taille = Number(body.size) || 0
  if (taille <= 0) return secureError('Fichier vide')
  if (taille > MAX_BYTES) return secureError('Fichier trop volumineux (10 Mo maximum)')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('documents/sign-upload: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Quota : somme des tailles des documents non supprimes de l'artisan
  const { data: rows } = await admin
    .from('documents_stockes')
    .select('taille_octets')
    .eq('user_id', user.id)
    .is('deleted_at', null)
  const used = (rows ?? []).reduce((s, r) => s + (Number(r.taille_octets) || 0), 0)

  if (used + taille > QUOTA_BYTES) {
    return secureJson({
      error: 'quota_depasse',
      message: 'Vous avez atteint la limite de stockage du coffre-fort (200 Mo). Supprimez des documents pour en ajouter de nouveaux.',
    }, 403)
  }

  const uuid = randomUUID()
  const key = `${user.id}/coffre/${uuid}.${ext}`

  return secureJson({
    key,
    putUrl: presignR2Url('PUT', key, 900),
  })
}
