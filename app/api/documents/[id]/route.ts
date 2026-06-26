import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'
import { r2Delete } from '@/lib/r2'

/**
 * DELETE /api/documents/[id]
 *
 * Coffre-fort (Vague 2b). Suppression DEFINITIVE d'un document stocke :
 * verifie l'auth + la PROPRIETE (user_id), supprime le binaire de R2 (RGPD :
 * un RIB / Kbis supprime ne doit PAS rester sur le stockage), PUIS supprime la
 * ligne en base (hard delete). Meme pattern que DELETE /api/chantier-photos/[id]
 * (qui appelle r2Delete) — ici la corbeille generique ne gere pas les fichiers
 * R2, donc la suppression du coffre-fort purge directement le stockage.
 */
export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`doc-delete:${ip}`, 30, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const id = params.id
  if (!id || !isValidUUID(id)) return secureError('Document invalide')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('documents DELETE: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Verif propriete + recuperation de la cle R2.
  const { data: doc } = await admin
    .from('documents_stockes')
    .select('id, fichier_url, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!doc) return secureError('Document introuvable', 404)

  const key = String(doc.fichier_url || '')
  // Defense en profondeur : la cle DOIT appartenir au prefixe de cet utilisateur.
  if (key && !key.startsWith(`${user.id}/`)) return secureError('Cle de fichier invalide', 403)

  // Purge R2 (best effort) AVANT de retirer la ligne. Si R2 echoue, on log mais
  // on supprime quand meme la ligne pour ne pas laisser un document fantome.
  try {
    await r2Delete(key)
  } catch (e) {
    console.error('[documents] r2 delete:', e)
  }

  const { error } = await admin
    .from('documents_stockes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    console.error('[documents] delete error:', error)
    return secureError('Suppression impossible', 500)
  }

  return secureJson({ ok: true })
}
