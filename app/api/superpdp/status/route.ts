import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/api-security'

/**
 * Etat de la connexion SUPER PDP de l'utilisateur (etape 2).
 *
 * Renvoie UNIQUEMENT des infos non sensibles (connecte ou non, nom de
 * l'entreprise, environnement). Les jetons (access_token / refresh_token)
 * ne sont JAMAIS exposes au navigateur.
 *
 * Reserve a l'admin tant que la fonctionnalite n'est pas finalisee.
 * Lecture via service_role car la table superpdp_connexions n'a aucune
 * policy RLS pour les roles anon/authenticated (jetons secrets).
 */
export async function GET() {
  const user = await getAdminUser()
  // Non-admin (ou non connecte) : on ne revele rien, on dit juste "non connecte".
  if (!user) {
    return NextResponse.json({ connected: false })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    console.error('superpdp/status: configuration serveur incomplete')
    return NextResponse.json({ connected: false, error: 'indisponible' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data } = await admin
    .from('superpdp_connexions')
    .select('formal_name, status, environment, created_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    status: data?.status ?? null,
    formalName: data?.formal_name ?? null,
    environment: data?.environment ?? null,
    connectedAt: data?.created_at ?? null,
  })
}
