import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/api-security'
import { exchangeCodeForTokens, getCompanyMe } from '@/lib/superpdp/client'
import { encryptToken } from '@/lib/superpdp/crypto'

/**
 * Retour du tunnel SUPER PDP (flux OAuth Authorization Code).
 * SUPER PDP renvoie l'artisan ici avec un "code" : on l'echange contre des
 * jetons, qu'on stocke cote serveur uniquement (table superpdp_connexions,
 * accessible seulement via service_role).
 */
function back(origin: string, statut: string) {
  return NextResponse.redirect(new URL(`/dashboard/parametres?superpdp=${statut}`, origin))
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error')

  // L'artisan doit etre connecte (c'est lui qui a initie la connexion)
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Ouvert a tous les artisans connectes. La protection anti-CSRF repose sur le
  // "state" verifie ci-dessous (cookie pose par /connect, propre a cet utilisateur).

  if (oauthError || !code) {
    return back(origin, 'refuse')
  }

  // Verification anti-CSRF : le state doit correspondre au cookie pose au depart
  const expectedState = req.cookies.get('superpdp_oauth_state')?.value
  if (!expectedState || !state || expectedState !== state) {
    return back(origin, 'erreur')
  }

  const clientId = process.env.SUPERPDP_OAUTH_CLIENT_ID
  const clientSecret = process.env.SUPERPDP_OAUTH_CLIENT_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!clientId || !clientSecret || !serviceRoleKey || !supabaseUrl) {
    console.error('superpdp/callback: configuration serveur incomplete')
    return back(origin, 'indisponible')
  }

  const redirectUri =
    process.env.SUPERPDP_REDIRECT_URI || `${origin}/api/superpdp/callback`

  try {
    // 1) Echange du code contre les jetons
    const tokens = await exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri })

    // 2) Recupere les infos de l'entreprise connectee (best effort)
    let formalName: string | null = null
    try {
      const company = await getCompanyMe(tokens.access_token)
      formalName = (company.formal_name as string) ?? null
    } catch {
      // pas bloquant
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    // 3) Stockage cote serveur uniquement (service_role, contourne la RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const row = {
      user_id: user.id,
      environment: 'production',
      status: 'connecte',
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token ?? null),
      token_expires_at: expiresAt,
      formal_name: formalName,
      deleted_at: null,
    }

    // Upsert manuel : on met a jour la connexion active si elle existe, sinon on insere
    const { data: existing } = await admin
      .from('superpdp_connexions')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    const { error: writeError } = existing
      ? await admin.from('superpdp_connexions').update(row).eq('id', existing.id)
      : await admin.from('superpdp_connexions').insert(row)

    if (writeError) {
      console.error('superpdp/callback: echec ecriture connexion')
      return back(origin, 'erreur')
    }

    const res = back(origin, 'connecte')
    res.cookies.delete('superpdp_oauth_state')
    return res
  } catch (e) {
    console.error('superpdp/callback: echec', (e as Error).name)
    return back(origin, 'erreur')
  }
}
