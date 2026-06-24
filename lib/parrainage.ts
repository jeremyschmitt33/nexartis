import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Utilitaires partages du systeme de PARRAINAGE.
 *
 * Regle metier (validee) :
 *   - Un artisan possede un code de parrainage unique (entreprises.referral_code).
 *   - Quand un nouvel artisan s'inscrit via ?ref=CODE, on enregistre le duo
 *     parrain <-> filleul dans la table `parrainages` (statut 'en_attente').
 *   - La recompense (1 mois offert pour les deux) est appliquee plus tard, par
 *     le webhook Stripe, au 1er vrai paiement du filleul (cf lib/parrainage-recompense.ts).
 *
 * Ce fichier ne contient QUE la capture du lien (pas la recompense Stripe).
 */

/** Nettoie un code de parrainage recu (URL, cookie, body). Renvoie null si invalide. */
export function sanitizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  // Les codes generes font 8 caracteres ; on tolere 6-16 par securite.
  return code.length >= 6 ? code : null
}

export type AttachResult = {
  created: boolean
  reason?:
    | 'no_code'
    | 'filleul_introuvable'
    | 'auto_parrainage'
    | 'code_invalide'
    | 'deja_parraine'
    | 'erreur_insert'
}

/**
 * Rattache un filleul a son parrain (cree la ligne `parrainages` en 'en_attente').
 *
 * - Idempotent : la contrainte UNIQUE(filleul_entreprise_id) empeche tout doublon
 *   (un filleul ne peut etre parraine qu'une seule fois) ; un doublon renvoie
 *   { created:false, reason:'deja_parraine' } sans erreur.
 * - Anti auto-parrainage : refuse si le code pointe vers la propre entreprise du filleul.
 * - NON bloquant pour l'appelant : ne jette jamais (renvoie un resultat).
 *
 * @param admin  client Supabase avec la cle service_role (ignore la RLS)
 */
export async function attacherParrainage(
  admin: SupabaseClient,
  filleulUserId: string,
  refCodeRaw: unknown,
): Promise<AttachResult> {
  const code = sanitizeReferralCode(refCodeRaw)
  if (!code) return { created: false, reason: 'no_code' }

  // Entreprise du filleul (creee par le trigger handle_new_user a l'inscription)
  const { data: filleul } = await admin
    .from('entreprises')
    .select('id, referral_code')
    .eq('user_id', filleulUserId)
    .single()
  if (!filleul) return { created: false, reason: 'filleul_introuvable' }

  // On ne se parraine pas soi-meme (par code)
  if (filleul.referral_code === code) return { created: false, reason: 'auto_parrainage' }

  // Entreprise du parrain via le code
  const { data: parrain } = await admin
    .from('entreprises')
    .select('id')
    .eq('referral_code', code)
    .single()
  if (!parrain) return { created: false, reason: 'code_invalide' }
  if (parrain.id === filleul.id) return { created: false, reason: 'auto_parrainage' }

  // Creation du lien (idempotente grace a la contrainte UNIQUE sur filleul)
  const { error } = await admin.from('parrainages').insert({
    parrain_entreprise_id: parrain.id,
    filleul_entreprise_id: filleul.id,
    statut: 'en_attente',
  })

  if (error) {
    // 23505 = unique_violation = filleul deja parraine => OK silencieux
    if ((error as { code?: string }).code === '23505') {
      return { created: false, reason: 'deja_parraine' }
    }
    console.error('[parrainage] insert error:', error)
    return { created: false, reason: 'erreur_insert' }
  }

  return { created: true }
}
