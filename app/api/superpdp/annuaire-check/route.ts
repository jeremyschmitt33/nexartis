import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getCompanyMe,
  getDirectoryEntries,
  checkFrenchDirectoryCompany,
  SuperPdpError,
} from '@/lib/superpdp/client'
import { getValidAccessTokenForUser } from '@/lib/superpdp/connexion'
import {
  getAuthenticatedUser, getAdminUser, getClientIp, checkRateLimit,
  rateLimitError, secureError, unauthorizedError, secureJson,
} from '@/lib/api-security'

// ---------------------------------------------------------------------------
// DIAGNOSTIC ANNUAIRE (RECEPTION) — BLOQUANT n°1.
// Pour RECEVOIR des factures, l'entreprise doit etre RECEPTEUR dans l'annuaire
// SUPER PDP (adresse = SIREN). Sans cela, ZERO facture n'est routee, meme si
// tout le code est parfait. Cette route confirme l'etat de l'annuaire.
//
// Reserve a l'ADMIN tant que la reception n'est pas ouverte a tous (comme
// l'envoi). Lecture seule : ne modifie rien (l'ouverture eventuelle se fait
// via un re-consentement OAuth 'send_and_receive' ou un POST dedie).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`annuaire-check:${ip}`, 10, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()
  const admin = await getAdminUser()
  if (!admin) return secureError('Fonctionnalite reservee a l administrateur', 403)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return secureError('Configuration serveur invalide', 500)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  let token: string
  try {
    token = await getValidAccessTokenForUser(supabase, user.id)
  } catch (e) {
    const err = e as SuperPdpError
    if (err.status === 409) return secureError('Connecte d abord ta facturation electronique.', 409)
    if (err.status === 401) return secureError('Reconnexion SUPER PDP requise.', 401)
    return secureError('Acces SUPER PDP impossible.', 500)
  }

  // 1) Entreprise connectee (pour recuperer le SIREN).
  let company: Record<string, unknown> = {}
  try { company = (await getCompanyMe(token)) as Record<string, unknown> } catch { /* best effort */ }
  const siren =
    (company.siren as string) ||
    (company.company_number as string) ||
    (company.registration_number as string) ||
    null

  // 2) Lignes d'annuaire de l'entreprise (sens emission/reception).
  let directoryEntries: unknown = null
  let entriesError: string | null = null
  try { directoryEntries = await getDirectoryEntries(token) } catch (e) { entriesError = (e as Error).message }

  // 3) Verification annuaire FR (routable / recepteur) si on a le SIREN.
  let frenchDirectory: unknown = null
  let frError: string | null = null
  if (siren) {
    try { frenchDirectory = await checkFrenchDirectoryCompany(token, siren) } catch (e) { frError = (e as Error).message }
  }

  // On renvoie le brut : l'interpretation "recepteur OUI/NON" se fait a la
  // lecture (la forme exacte de l'annuaire n'est pas garantie par la doc).
  return secureJson({
    ok: true,
    formal_name: company.formal_name ?? null,
    siren,
    directory_entries: directoryEntries,
    directory_entries_error: entriesError,
    french_directory: frenchDirectory,
    french_directory_error: frError,
    note: 'Verifier qu une entree direction=receive existe pour le SIREN. Sinon : re-consentir OAuth (send_and_receive) ou ouvrir la ligne.',
  })
}
