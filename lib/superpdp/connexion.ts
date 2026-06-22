// lib/superpdp/connexion.ts
// ---------------------------------------------------------------------------
// Recuperation cote serveur d'un access_token SUPER PDP VALIDE pour un
// utilisateur (artisan), avec rafraichissement automatique si expire.
//
// SECURITE : la table superpdp_connexions n'a aucune policy RLS -> elle n'est
// lisible que via la cle service_role (jamais le navigateur). Cette fonction
// DOIT donc recevoir un client Supabase cree avec SUPABASE_SERVICE_ROLE_KEY.
// Les jetons ne sont jamais renvoyes au client : seul le serveur les utilise.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshAccessToken, SuperPdpError } from './client'

/** Marge de securite : on rafraichit si le jeton expire dans moins de 2 minutes. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000

export interface SuperPdpConnexionRow {
  id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  environment: string | null
  formal_name: string | null
}

/**
 * Renvoie un access_token valide pour l'utilisateur donne.
 * - Lit la connexion active (deleted_at IS NULL).
 * - Si le jeton est expire (ou bientot) et qu'un refresh_token existe : le
 *   rafraichit aupres de SUPER PDP et met a jour la base.
 * - Leve une SuperPdpError explicite si aucune connexion / pas de jeton.
 */
export async function getValidAccessTokenForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: row, error } = await admin
    .from('superpdp_connexions')
    .select('id, access_token, refresh_token, token_expires_at, environment, formal_name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new SuperPdpError('Lecture de la connexion SUPER PDP impossible', 500)
  }
  if (!row) {
    // 409 : l'artisan n'a pas encore relie son compte SUPER PDP.
    throw new SuperPdpError('NON_CONNECTE', 409)
  }

  const connexion = row as SuperPdpConnexionRow

  // Jeton encore valide ? (avec marge)
  const expiresAtMs = connexion.token_expires_at
    ? new Date(connexion.token_expires_at).getTime()
    : 0
  const stillValid =
    !!connexion.access_token && expiresAtMs - Date.now() > EXPIRY_MARGIN_MS

  if (stillValid && connexion.access_token) {
    return connexion.access_token
  }

  // Sinon : rafraichissement obligatoire.
  if (!connexion.refresh_token) {
    throw new SuperPdpError('RECONNEXION_REQUISE', 401)
  }

  const clientId = process.env.SUPERPDP_OAUTH_CLIENT_ID
  const clientSecret = process.env.SUPERPDP_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new SuperPdpError('Configuration SUPER PDP incomplete', 500)
  }

  let refreshed
  try {
    refreshed = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: connexion.refresh_token,
    })
  } catch {
    // Le refresh_token est invalide/revoque : l'artisan doit se reconnecter.
    throw new SuperPdpError('RECONNEXION_REQUISE', 401)
  }

  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null

  // Mise a jour de la connexion (on garde l'ancien refresh_token si SUPER PDP
  // n'en renvoie pas de nouveau).
  await admin
    .from('superpdp_connexions')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connexion.refresh_token,
      token_expires_at: newExpiresAt,
      status: 'connecte',
    })
    .eq('id', connexion.id)

  return refreshed.access_token
}
