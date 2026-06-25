import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, checkRateLimit } from '@/lib/api-security'
import { buildAuthorizeUrl } from '@/lib/superpdp/client'

/**
 * Depart de la connexion SUPER PDP (flux OAuth Authorization Code).
 * L'artisan connecte clique sur "Connecter ma facturation electronique" :
 * on l'envoie vers le tunnel SUPER PDP avec un parametre anti-CSRF (state).
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }

  // Ouvert a TOUS les artisans connectes (reception 2026 + emission 2027).
  // La securite repose sur : auth obligatoire, state anti-CSRF (cookie),
  // rate-limit, et l'isolation multi-tenant cote stockage des jetons.

  // Anti brute-force
  if (!checkRateLimit(`superpdp_connect_${user.id}`, 10, 60_000)) {
    return NextResponse.redirect(
      new URL('/dashboard/parametres?superpdp=erreur', req.nextUrl.origin),
    )
  }

  const clientId = process.env.SUPERPDP_OAUTH_CLIENT_ID
  if (!clientId) {
    console.error('superpdp/connect: SUPERPDP_OAUTH_CLIENT_ID absente')
    return NextResponse.redirect(
      new URL('/dashboard/parametres?superpdp=indisponible', req.nextUrl.origin),
    )
  }

  const redirectUri =
    process.env.SUPERPDP_REDIRECT_URI || `${req.nextUrl.origin}/api/superpdp/callback`

  // state aleatoire pour empecher une attaque CSRF sur le callback
  const state = crypto.randomUUID()

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    loginHint: user.email ?? undefined,
  })

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set({
    name: 'superpdp_oauth_state',
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  return res
}
