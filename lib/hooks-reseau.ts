'use client'

// ============================================================================
// lib/hooks-reseau.ts — Couche de données du "réseau" (invitations / contacts).
// ----------------------------------------------------------------------------
// S'appuie sur les RPC SECURITY DEFINER de la migration
// 2026-07-22-messagerie-03-invitations. La sécurité est en base (RLS + RPC).
// Les contacts acceptés se lisent via useContacts (lib/hooks-messagerie).
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

export interface DemandeRecue {
  relation_id: string
  demandeur_user_id: string
  nom: string | null
  metier: string | null
  mot: string | null
  created_at: string
}

export interface InvitationEnvoyee {
  relation_id: string
  lien_token: string
  destinataire_email: string | null
  destinataire_nom: string | null
  deja_inscrit: boolean
  created_at: string
}

export interface InvitationInfos {
  inviteur_nom: string | null
  inviteur_metier: string | null
  statut: string
  deja_pris: boolean
}

export interface ResultatEnvoi {
  relation_id: string
  lien_token: string
  destinataire_existe: boolean
  deja_relie: boolean
  /** false si l'email d'invitation n'a pas pu être envoyé (l'utilisateur copie le lien). */
  email_envoye?: boolean
}

// ── Demandes reçues (invitations en attente vers moi) ────────────────────────
export function useDemandesRecues(): {
  demandes: DemandeRecue[]
  loading: boolean
  refetch: () => void
} {
  const [demandes, setDemandes] = useState<DemandeRecue[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDemandes([]); setLoading(false); return }
    const { data } = await supabase.rpc('mes_demandes_recues')
    setDemandes((data ?? []) as DemandeRecue[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { demandes, loading, refetch: fetch }
}

// ── Invitations envoyées (en attente) ────────────────────────────────────────
export function useInvitationsEnvoyees(): {
  invitations: InvitationEnvoyee[]
  loading: boolean
  refetch: () => void
} {
  const [invitations, setInvitations] = useState<InvitationEnvoyee[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setInvitations([]); setLoading(false); return }
    const { data } = await supabase.rpc('mes_invitations_envoyees')
    setInvitations((data ?? []) as InvitationEnvoyee[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { invitations, loading, refetch: fetch }
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Envoie une invitation à un confrère par email.
 * - Crée la relation (RPC) et récupère le token.
 * - Si le destinataire n'est pas encore inscrit, envoie l'email via l'API.
 * Renvoie le résultat (dont le lien_token pour "copier le lien").
 */
export async function envoyerInvitation(email: string, mot?: string): Promise<ResultatEnvoi> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('envoyer_invitation_confrere', {
    p_email: email,
    p_mot: mot && mot.trim() ? mot.trim() : null,
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as ResultatEnvoi[]
  const res = rows[0]
  if (!res) throw new Error("L'invitation n'a pas pu être créée.")

  // Destinataire non inscrit → on envoie l'email (côté serveur pour la clé Brevo).
  let emailEnvoye = true
  if (!res.destinataire_existe) {
    emailEnvoye = false
    try {
      const r = await fetch('/api/reseau/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: res.lien_token }),
      })
      emailEnvoye = r.ok
    } catch {
      // L'email a pu échouer, mais la relation existe : on ne bloque pas,
      // l'utilisateur peut copier/partager le lien manuellement.
    }
  }
  return { ...res, email_envoye: emailEnvoye }
}

/** Répondre à une demande reçue : 'accepter' | 'refuser' | 'bloquer'. */
export async function repondreInvitation(
  relationId: string,
  action: 'accepter' | 'refuser' | 'bloquer',
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('repondre_invitation', {
    p_relation_id: relationId,
    p_action: action,
  })
  if (error) throw new Error(error.message)
}

/** Annuler une invitation envoyée / retirer un contact. */
export async function supprimerRelation(relationId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('supprimer_relation', { p_relation_id: relationId })
  if (error) throw new Error(error.message)
}

/** Accepter une invitation via son token (page d'atterrissage, connecté). */
export async function accepterParToken(token: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('accepter_invitation_par_token', { p_token: token })
  if (error) throw new Error(error.message)
  return data as string
}

/** Infos publiques d'une invitation (nom/métier de l'inviteur). */
export async function chargerInvitationInfos(token: string): Promise<InvitationInfos | null> {
  const supabase = createClient()
  const { data } = await supabase.rpc('invitation_infos', { p_token: token })
  const rows = (data ?? []) as InvitationInfos[]
  return rows[0] ?? null
}
