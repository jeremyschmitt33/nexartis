import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, secureJson, secureError, unauthorizedError,
} from '@/lib/api-security'
import { r2Delete } from '@/lib/r2'

/**
 * DELETE /api/chantier-photos/[id]
 * Supprime une photo : retire les objets R2 (original + miniature) puis
 * soft-delete la ligne. Verifie la propriete.
 */
export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  const id = params.id
  if (!id) return secureError('id requis')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: photo } = await admin
    .from('chantier_photos')
    .select('id, r2_key, thumb_key')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()
  if (!photo) return secureError('Photo introuvable', 404)

  // Supprimer les binaires R2 (best effort)
  try {
    await r2Delete(photo.r2_key as string)
    if (photo.thumb_key) await r2Delete(photo.thumb_key as string)
  } catch (e) {
    console.error('[chantier-photos] r2 delete:', e)
    // On continue : on marque quand meme la ligne supprimee cote metier.
  }

  await admin
    .from('chantier_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return secureJson({ ok: true })
}
