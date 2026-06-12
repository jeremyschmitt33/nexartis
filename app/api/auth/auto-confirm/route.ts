import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser, getClientIp, checkRateLimit,
  isValidUUID, isValidEmail, sanitizeString,
  secureJson, secureError, rateLimitError, unauthorizedError,
} from '@/lib/api-security'

/**
 * POST /api/auth/auto-confirm
 * Auto-confirme un utilisateur après inscription pour qu'il puisse se connecter immédiatement.
 * Utilise la service role key (bypass RLS).
 * Crée aussi la ligne dans la table "entreprises" si elle n'existe pas encore.
 *
 * ✅ SÉCURITÉ : Cette route est appelée UNIQUEMENT par le process d'inscription
 * côté serveur. Elle vérifie un secret interne pour empêcher les appels externes.
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SÉCURITÉ : Rate limiting strict (3 par minute par IP)
    const ip = getClientIp(request)
    if (!checkRateLimit(`auto-confirm:${ip}`, 3, 60_000)) {
      return rateLimitError()
    }

    const { user_id, email, prenom, nom, entreprise, internal_secret } = await request.json()

    // ✅ SÉCURITÉ : Vérifier le secret interne (empêche les appels directs par un attaquant)
    const expectedSecret = process.env.INTERNAL_API_SECRET
    if (!expectedSecret || internal_secret !== expectedSecret) {
      // On peut aussi vérifier que l'appelant est un admin
      const user = await getAuthenticatedUser()
      if (!user) {
        return unauthorizedError()
      }
      // Vérifier que c'est un admin
      const adminEmails = (process.env.ADMIN_EMAILS || 'admin@nexartis.fr').split(',').map(e => e.trim().toLowerCase())
      if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
        return secureError('Accès refusé', 403)
      }
    }

    if (!user_id) {
      return secureError('user_id requis')
    }

    // ✅ SÉCURITÉ : Valider le format UUID
    if (!isValidUUID(user_id)) {
      return secureError('user_id invalide')
    }

    // ✅ SÉCURITÉ (R1-002) : Valider strictement les inputs attaquant-contrôlés
    // avant toute insertion dans la table entreprises.
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !isValidEmail(email)) {
        return secureError('email invalide')
      }
    }
    if (entreprise !== undefined && entreprise !== null && entreprise !== '') {
      if (typeof entreprise !== 'string' || entreprise.length > 200) {
        return secureError('entreprise invalide')
      }
    }
    if (prenom !== undefined && prenom !== null && prenom !== '') {
      if (typeof prenom !== 'string' || prenom.length > 100) {
        return secureError('prenom invalide')
      }
    }
    if (nom !== undefined && nom !== null && nom !== '') {
      if (typeof nom !== 'string' || nom.length > 100) {
        return secureError('nom invalide')
      }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Auto-confirmer l'email de l'utilisateur
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email_confirm: true,
    })

    if (confirmError) {
      console.error('Auto-confirm error:', confirmError)
      return secureError('Erreur lors de la confirmation', 500)
    }

    // 2. Créer la ligne entreprise si elle n'existe pas encore
    const { data: existing } = await supabaseAdmin
      .from('entreprises')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (!existing) {
      // ✅ SÉCURITÉ (R1-002) : nettoyer les champs texte avant insertion
      const { error: insertError } = await supabaseAdmin.from('entreprises').insert({
        user_id,
        email: email ? sanitizeString(email, 320) : '',
        nom: entreprise ? sanitizeString(entreprise, 200) : '',
        prenom: prenom ? sanitizeString(prenom, 100) : '',
        metier: '',
        abonnement_type: 'trial',
        trial_started_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error('Entreprise insert error:', insertError)
        // Non bloquant — l'utilisateur peut quand même se connecter
      }
    }

    return secureJson({ success: true })
  } catch (err) {
    console.error('Auto-confirm route error:', err)
    return secureError('Erreur serveur', 500)
  }
}
