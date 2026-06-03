import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  getAdminUser, getClientIp, checkRateLimit, isValidUUID,
  secureJson, secureError, rateLimitError, forbiddenError,
} from '@/lib/api-security'

/** Supabase admin client (bypass RLS) */
function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// -------------------------------------------------------------------
// GET /api/admin/users — liste TOUS les utilisateurs (auth + entreprises)
// -------------------------------------------------------------------
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbiddenError()

  const supabaseAdmin = adminSupabase()

  // 1. Source de vérité : TOUS les comptes auth Supabase
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // 2. Récupérer les données entreprises pour enrichir
  const { data: entreprises } = await supabaseAdmin
    .from('entreprises')
    .select('*')

  // Index entreprises par user_id
  const entMap: Record<string, Record<string, unknown>> = {}
  for (const e of entreprises ?? []) {
    entMap[e.user_id] = e
  }

  // 3. Construire la liste combinée (auth = base, entreprise = enrichissement)
  const adminEmails = (process.env.ADMIN_EMAILS || 'admin@nexartis.fr').split(',').map(e => e.trim().toLowerCase())
  const users = (authUsers?.users ?? [])
    .filter(u => !u.email || !adminEmails.includes(u.email.toLowerCase())) // Exclure les admins
    .map(u => {
      const ent = entMap[u.id] || {}
      const meta = (u.user_metadata as Record<string, unknown>) ?? {}
      return {
        // IDs
        id: (ent.id as string) || u.id, // entreprise ID si existe, sinon auth ID
        user_id: u.id,
        has_entreprise: !!entMap[u.id], // utile pour savoir si le profil existe

        // Identité (priorité : entreprise > auth metadata)
        nom: (ent.nom as string) || (meta.entreprise as string) || '',
        prenom: (ent.prenom as string) || (meta.prenom as string) || '',
        auth_email: u.email ?? '',
        email: (ent.email as string) || u.email || '',
        telephone: (ent.telephone as string) || '',

        // Entreprise
        metier: (ent.metier as string) || '',
        ville: (ent.ville as string) || '',
        siret: (ent.siret as string) || '',
        adresse: (ent.adresse as string) || '',
        code_postal: (ent.code_postal as string) || '',
        forme_juridique: (ent.forme_juridique as string) || '',

        // Abonnement
        abonnement_type: (ent.abonnement_type as string) || 'trial',
        trial_started_at: (ent.trial_started_at as string) || u.created_at || '',
        abonnement_expire_at: (ent.abonnement_expire_at as string) || null,
        notes_admin: (ent.notes_admin as string) || null,

        // Dates
        created_at: u.created_at || (ent.created_at as string) || '',
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,

        // Auth metadata (fallback pour nom/prénom)
        auth_prenom: (meta.prenom as string) || '',
        auth_nom: (meta.nom as string) || '',
        auth_entreprise: (meta.entreprise as string) || '',
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return secureJson({ users })
}

// -------------------------------------------------------------------
// PATCH /api/admin/users — modifier l'abonnement d'un utilisateur
// -------------------------------------------------------------------
export async function PATCH(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbiddenError()

  const body = await request.json()
  // V3.0c.21 DEBUG : trace ce que le serveur recoit exactement (a retirer apres diagnostic)
  console.log('[ADMIN PATCH] body recu:', JSON.stringify({
    entreprise_id: body.entreprise_id,
    abonnement_type: body.abonnement_type,
    has_geste_commercial_mois: 'geste_commercial_mois' in body,
    geste_commercial_mois: body.geste_commercial_mois,
    type_of_flag: typeof body.geste_commercial_mois,
    has_expire: 'abonnement_expire_at' in body,
  }))
  const { entreprise_id, abonnement_type, notes_admin, abonnement_expire_at, geste_commercial_mois } = body

  if (!entreprise_id || !abonnement_type) {
    return secureError('Paramètres manquants')
  }

  // ✅ SÉCURITÉ : Valider les inputs
  if (!isValidUUID(entreprise_id)) return secureError('ID entreprise invalide')
  const validTypes = ['trial', 'actif', 'suspendu', 'lifetime']
  if (!validTypes.includes(abonnement_type)) return secureError('Type d\'abonnement invalide')
  if (notes_admin && typeof notes_admin === 'string' && notes_admin.length > 500) return secureError('Notes trop longues (max 500 caractères)')

  const supabaseAdmin = adminSupabase()

  // V3.0c.18 : recuperer l'etat AVANT update pour detecter une prolongation
  const { data: avant } = await supabaseAdmin
    .from('entreprises')
    .select('abonnement_expire_at, abonnement_type, user_id, nom, prenom, email')
    .eq('id', entreprise_id)
    .single()

  const updates: Record<string, unknown> = { abonnement_type }
  if (notes_admin !== undefined) updates.notes_admin = notes_admin
  if (abonnement_expire_at !== undefined) updates.abonnement_expire_at = abonnement_expire_at

  // Si on passe en lifetime, on supprime la date d'expiration
  if (abonnement_type === 'lifetime') {
    updates.abonnement_expire_at = null
  }

  const { error } = await supabaseAdmin
    .from('entreprises')
    .update(updates)
    .eq('id', entreprise_id)

  if (error) return secureError(error.message, 500)

  // V3.0c.18 / V3.0c.20 : mail automatique selon le contexte
  // - Geste commercial (+1 / +3 mois) → sendGesteCommercialEmail (mail valorisant + nouveautes)
  // - Prolongation simple ou passage lifetime → sendSubscriptionExtendedEmail (mail neutre)
  // Non-bloquant : si l'email echoue, l'update reste valide.
  try {
    const passageLifetime = abonnement_type === 'lifetime' && avant?.abonnement_type !== 'lifetime'
    const prolongation = abonnement_expire_at !== undefined
      && abonnement_expire_at !== null
      && (!avant?.abonnement_expire_at || new Date(abonnement_expire_at) > new Date(avant.abonnement_expire_at as string))
    const gesteCommercial = typeof geste_commercial_mois === 'number' && geste_commercial_mois > 0

    if (passageLifetime || prolongation || gesteCommercial) {
      // Recuperer l'email auth en priorite (entreprises.email peut etre vide)
      let destEmail = (avant?.email as string) || ''
      if (!destEmail && avant?.user_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(avant.user_id as string)
        destEmail = authUser?.user?.email || ''
      }
      const destName = `${(avant?.prenom as string) || ''} ${(avant?.nom as string) || ''}`.trim() || 'Cher utilisateur'

      if (destEmail) {
        if (gesteCommercial && abonnement_expire_at) {
          // V3.0c.20 : mail dedie geste commercial
          const { sendGesteCommercialEmail } = await import('@/lib/email')
          await sendGesteCommercialEmail({
            email: destEmail,
            name: destName,
            moisOfferts: geste_commercial_mois as number,
            newExpireAt: abonnement_expire_at as string,
          }).catch((e) => {
            console.error('sendGesteCommercialEmail failed:', e)
          })
        } else {
          // V3.0c.18 : mail neutre prolongation / lifetime
          const { sendSubscriptionExtendedEmail } = await import('@/lib/email')
          await sendSubscriptionExtendedEmail({
            email: destEmail,
            name: destName,
            newExpireAt: passageLifetime ? '' : (abonnement_expire_at as string),
            abonnementType: abonnement_type,
          }).catch((e) => {
            console.error('sendSubscriptionExtendedEmail failed:', e)
          })
        }
      }
    }
  } catch (e) {
    console.error('Subscription email trigger error:', e)
  }

  return secureJson({ success: true })
}

// -------------------------------------------------------------------
// DELETE /api/admin/users — supprimer un compte utilisateur complet
// -------------------------------------------------------------------
export async function DELETE(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')

  if (!userId) {
    return secureError('user_id requis')
  }

  // ✅ SÉCURITÉ : Valider le format UUID
  if (!isValidUUID(userId)) return secureError('user_id invalide')

  const supabaseAdmin = adminSupabase()

  // 1. Supprimer toutes les données liées dans les tables
  //    (ordre important : enfants avant parents pour éviter les FK violations)
  const tablesToClean = [
    'chantier_notes',
    'chantier_intervenants',
    'sous_traitant_paiements',
    'planning_interventions',
    'facture_lignes',
    'devis_lignes',
    'paiements',
    'factures',
    'devis',
    'achats',
    'materiel',
    'documents',
    'relances',
    'points_collecte',
    'prestations',
    'chantiers',
    'clients',
    'fournisseurs',
    'intervenants',
    'entreprises',
  ]

  const errors: string[] = []
  for (const table of tablesToClean) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId)
    if (error) {
      // Ignorer les tables inexistantes ('PGRST205') mais garder les autres erreurs
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        console.error(`Error deleting from ${table}:`, error.message)
        errors.push(`${table}: ${error.message}`)
      }
    }
  }

  // 2. Supprimer le compte auth Supabase
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('Auth delete error:', authError)
    // Retourner le vrai message d'erreur + les erreurs des tables pour debug
    const details = [authError.message, ...errors].filter(Boolean).join(' | ')
    return secureError(`Suppression échouée : ${details}`, 500)
  }

  return secureJson({ success: true, cleanedTables: tablesToClean.length })
}
