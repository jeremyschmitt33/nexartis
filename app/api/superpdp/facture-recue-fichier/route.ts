import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createRlsClient } from '@/lib/supabase/server'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, rateLimitError, secureError, unauthorizedError, secureJson,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// Sert le fichier d'une facture RECUE via une SIGNED URL courte (bucket prive).
// Securite :
//  - auth obligatoire ;
//  - PROPRIETE verifiee via le client RLS (l'utilisateur ne "voit" la ligne
//    factures_recues que si la RLS multi-entreprise l'autorise) ;
//  - la signature de l'objet Storage se fait en service_role, mais UNIQUEMENT
//    apres que la propriete a ete prouvee ;
//  - URL signee a duree courte (120 s) ; jamais d'URL publique.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'factures-recues'
const SIGNED_TTL = 120 // secondes

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`facture-recue-fichier:${ip}`, 60, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const id = req.nextUrl.searchParams.get('id') || ''
  if (!isValidUUID(id)) return secureError('Identifiant invalide')

  // 1) Propriete via RLS : si la ligne remonte, l'utilisateur y a droit.
  const rls = createRlsClient()
  const { data: row, error } = await rls
    .from('factures_recues')
    .select('id, fichier_path')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return secureError('Lecture impossible', 500)
  if (!row) return secureError('Facture introuvable', 404)
  if (!row.fichier_path) return secureError('Aucun fichier disponible pour cette facture', 404)

  // 2) Signature en service_role (apres preuve de propriete).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return secureError('Configuration serveur invalide', 500)
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.fichier_path as string, SIGNED_TTL)

  if (signErr || !signed?.signedUrl) return secureError('Lien de fichier indisponible', 500)

  return secureJson({ ok: true, url: signed.signedUrl, expiresIn: SIGNED_TTL })
}
