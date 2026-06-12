'use client'

// ============================================================================
// lib/hooks-equipe.ts — Hooks LECTURE SEULE pour la gestion des comptes/accès
// (feature multi-utilisateur, Push 1).
// ----------------------------------------------------------------------------
// Fichier volontairement compact et SÉPARÉ de lib/hooks.tsx (665 lignes, à
// risque de troncature cross-OS). Suit EXACTEMENT le style de lib/hooks.tsx :
//   - 'use client'
//   - createClient depuis '@/lib/supabase/client'
//   - useState / useEffect / useCallback
//   - supabase.auth.getUser()
//
// IMPORTANT (périmètre Push 1) :
//   - Ces hooks NE FONT QUE LIRE la table entreprise_membres.
//   - L'étanchéité réelle est assurée par la RLS Supabase. Les helpers SQL
//     SECURITY DEFINER (current_entreprise_ids) limitent déjà chaque requête
//     à l'entreprise du membre courant.
//   - On NE retire AUCUN filtre .eq('user_id') ailleurs : ça, c'est le Push 2.
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from '@/lib/roles'

export type MembreStatut = 'actif' | 'invite' | 'revoque'

/** Ligne de la table `entreprise_membres` (schéma Phase 1, 2026-06-12). */
export interface EntrepriseMembre {
  id: string
  entreprise_id: string
  /** NULL tant que l'invité n'a pas activé son compte. */
  user_id: string | null
  role: UserRole
  statut: MembreStatut
  email_invite: string | null
  invite_expires_at?: string | null
  intervenant_id?: string | null
  invited_by?: string | null
  created_at: string | null
  updated_at?: string | null
}

// ----------------------------------------------------------------------------
// useCurrentRole — rôle + entreprise du membre ACTIF connecté.
// ----------------------------------------------------------------------------
//
// La RLS autorise un membre à lire SES propres lignes de entreprise_membres
// (user_id = auth.uid()). On récupère la ligne 'actif' : elle nous donne le
// rôle effectif et l'entreprise courante.
//
// Renvoie role=null / entrepriseId=null si l'utilisateur n'a pas (encore) de
// ligne membre active — cas des comptes legacy mono-utilisateur (Push 1 ne
// crée pas rétroactivement de ligne dirigeant ; le code appelant doit traiter
// `role === null` comme « propriétaire historique = dirigeant » côté UI, ou
// masquer la section selon le besoin).
export function useCurrentRole(): {
  role: UserRole | null
  entrepriseId: string | null
  loading: boolean
} {
  const [role, setRole] = useState<UserRole | null>(null)
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setRole(null)
          setEntrepriseId(null)
          setLoading(false)
        }
        return
      }
      const { data } = await supabase
        .from('entreprise_membres')
        .select('role, entreprise_id')
        .eq('user_id', user.id)
        .eq('statut', 'actif')
        .limit(1)
        .maybeSingle()

      if (!cancelled) {
        const r = (data?.role as UserRole | undefined) ?? null
        setRole(r)
        setEntrepriseId((data?.entreprise_id as string | undefined) ?? null)
        setLoading(false)
      }
    }
    fetch()
    return () => {
      cancelled = true
    }
  }, [])

  return { role, entrepriseId, loading }
}

// ----------------------------------------------------------------------------
// useEntrepriseMembres — liste de TOUS les membres de l'entreprise courante.
// ----------------------------------------------------------------------------
//
// La RLS limite déjà le SELECT aux membres de l'entreprise de l'utilisateur
// connecté (via current_entreprise_ids()), donc on ne pose pas de filtre
// entreprise_id ici : ce serait redondant et risquerait de masquer une ligne
// si l'entrepriseId côté client n'était pas encore chargé.
//
// Tri : le(s) dirigeant(s) d'abord, puis par date de création (ancien → récent).
export function useEntrepriseMembres(): {
  membres: EntrepriseMembre[]
  loading: boolean
  refetch: () => void
} {
  const [membres, setMembres] = useState<EntrepriseMembre[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setMembres([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('entreprise_membres')
      .select(
        'id, entreprise_id, user_id, role, statut, email_invite, invite_expires_at, intervenant_id, invited_by, created_at, updated_at',
      )
      .order('created_at', { ascending: true })

    const rows = (data ?? []) as EntrepriseMembre[]
    // Dirigeant d'abord, puis ordre chronologique (déjà appliqué par l'order SQL).
    rows.sort((a, b) => {
      if (a.role === 'dirigeant' && b.role !== 'dirigeant') return -1
      if (b.role === 'dirigeant' && a.role !== 'dirigeant') return 1
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return ta - tb
    })
    setMembres(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { membres, loading, refetch: fetch }
}
