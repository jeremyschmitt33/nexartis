import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, secureJson, secureError } from '@/lib/api-security'

/**
 * POST /api/auth/ensure-entreprise
 *
 * Cree la ligne `entreprises` de l'utilisateur connecte si elle n'existe pas.
 *
 * ------------------------------------------------------------------------
 * POURQUOI (27/08/2026)
 * ------------------------------------------------------------------------
 * Un compte auth sans ligne `entreprises` etait un double probleme :
 *   1. CUL-DE-SAC : /dashboard/abonnement affichait « Impossible de charger
 *      votre profil », sans aucune action possible. L'utilisateur ne pouvait
 *      ni s'abonner ni corriger quoi que ce soit, et le checkout Stripe
 *      renvoyait de toute facon « Profil entreprise introuvable ».
 *   2. ACCES GRATUIT ILLIMITE : middleware et layout sont fail-open quand la
 *      ligne est absente, donc ce compte n'etait jamais bloque.
 *
 * La ligne est normalement creee par le trigger SQL `handle_new_user`. Cette
 * route est le filet : elle repare le compte au lieu de laisser l'utilisateur
 * devant un ecran mort.
 *
 * IMPORTANT — on ne recree PAS un essai neuf : `trial_started_at` reprend la
 * date de creation du compte auth. Sans cela, un compte de six mois sans
 * profil obtiendrait 14 jours gratuits a chaque appel de cette route.
 *
 * Idempotente : si la ligne existe deja, on ne touche a rien.
 */
export async function POST() {
  const user = await getAuthenticatedUser()
  if (!user) return secureError('Non authentifie', 401)

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: existante } = await supabaseAdmin
    .from('entreprises')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existante) {
    return secureJson({ ok: true, cree: false })
  }

  const meta = (user.user_metadata as Record<string, unknown>) ?? {}

  const { error } = await supabaseAdmin.from('entreprises').insert({
    user_id: user.id,
    email: user.email ?? null,
    nom: (meta.entreprise as string) || '',
    prenom: (meta.prenom as string) || '',
    metier: '',
    abonnement_type: 'trial',
    // Voir l'en-tete : on repart de la date d'inscription reelle.
    trial_started_at: user.created_at ?? new Date().toISOString(),
  })

  if (error) {
    console.error('[ensure-entreprise] insert error:', error.message, 'user:', user.id)
    return secureError('Impossible de creer le profil', 500)
  }

  console.warn(`[ensure-entreprise] profil recree pour ${user.id} (trigger handle_new_user manquant ?)`)
  return secureJson({ ok: true, cree: true })
}
