import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * POST /api/documents/cop/sign
 * Signature SUR PLACE d'un contrat d'ouverture de porte par le client
 * (l'artisan est authentifie et present ; le client signe sur son telephone).
 *
 * - Auth artisan obligatoire.
 * - 3 cases de renonciation obligatoires (les 3 doivent etre true).
 * - Journal de preuve serveur : date_signature (now), IP, user-agent.
 * - Enregistre le client dans la table `clients` s'il n'y est pas encore.
 *
 * Body : { copId, signatureBase64, signedBy,
 *          renonciationInfo, renonciationExecution, renonciationPerte }
 * La generation de la facture liee viendra en phase 1b-B.
 */
export const dynamic = 'force-dynamic'

const MAX_SIGNATURE_BYTES = 500_000 // ~500 KB

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkRateLimit(`cop-sign:${ip}`, 20, 60_000)) return rateLimitError()

  const user = await getAuthenticatedUser()
  if (!user) return unauthorizedError()

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return secureError('Requete invalide') }

  const copId = String(b.copId ?? '')
  if (!isValidUUID(copId)) return secureError('Contrat invalide')

  const signatureBase64 = typeof b.signatureBase64 === 'string' ? b.signatureBase64 : ''
  if (!signatureBase64.startsWith('data:image/')) return secureError('Signature manquante')
  if (signatureBase64.length > MAX_SIGNATURE_BYTES) return secureError('Signature trop volumineuse')

  const signedBy = sanitizeString(String(b.signedBy ?? ''), 200).trim()
  if (!signedBy) return secureError('Le nom du signataire est requis')

  // Les 3 cases de renonciation sont OBLIGATOIRES (validite juridique).
  const bool = (v: unknown) => v === true || v === 'true'
  if (!bool(b.renonciationInfo) || !bool(b.renonciationExecution) || !bool(b.renonciationPerte)) {
    return secureError('Les trois cases de reconnaissance doivent etre cochees')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('cop sign: SUPABASE_SERVICE_ROLE_KEY absente')
    return secureError('Configuration serveur invalide', 500)
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1) Charger le contrat et verifier propriete + etat.
  const { data: cop, error: copErr } = await admin
    .from('contrats_ouverture')
    .select('id, user_id, statut, client_id, client_nom, client_prenom, client_adresse, client_cp, client_ville, statut_occupant')
    .eq('id', copId)
    .eq('user_id', user.id)
    .single()
  if (copErr || !cop) return secureError('Contrat introuvable', 404)
  if (cop.statut === 'signe') return secureError('Ce contrat est deja signe', 409)

  // 2) Enregistrer le client dans `clients` s'il n'est pas encore lie.
  let clientId = (cop.client_id as string | null) ?? null
  try {
    if (!clientId && cop.client_nom) {
      const { data: newClient } = await admin
        .from('clients')
        .insert({
          user_id: user.id,
          type: 'particulier',
          nom: cop.client_nom,
          prenom: cop.client_prenom ?? null,
          adresse: cop.client_adresse ?? null,
          code_postal: cop.client_cp ?? null,
          ville: cop.client_ville ?? null,
        })
        .select('id')
        .single()
      clientId = newClient?.id ?? null
    }
  } catch (e) {
    // L'enregistrement du client ne doit pas bloquer la signature.
    console.error('[cop-sign] upsert client:', e)
  }

  // 3) Enregistrer la signature + le journal de preuve + le statut.
  try {
    const { error: updErr } = await admin
      .from('contrats_ouverture')
      .update({
        statut: 'signe',
        client_signature_base64: signatureBase64,
        signed_by: signedBy,
        date_signature: new Date().toISOString(),
        renonciation_info: true,
        renonciation_execution: true,
        renonciation_perte: true,
        attestation_acces: true,
        consentement_risque: true,
        signature_ip: ip,
        signature_user_agent: sanitizeString(req.headers.get('user-agent') ?? '', 400),
        client_id: clientId,
      })
      .eq('id', copId)
      .eq('user_id', user.id)

    if (updErr) {
      console.error('[cop-sign] update error:', updErr)
      return secureError('Enregistrement impossible', 500)
    }
    return secureJson({ ok: true, clientId })
  } catch (e) {
    console.error('[cop-sign] exception:', e)
    return secureError('Erreur serveur', 500)
  }
}
