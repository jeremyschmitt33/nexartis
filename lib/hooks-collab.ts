'use client'

// ============================================================================
// lib/hooks-collab.ts — Collaboration chantier (Phase 3, brique 3.1).
// ----------------------------------------------------------------------------
// Le donneur d'ordre A confie un LOT de son chantier à un confrère B (compte
// distinct). B voit ses « chantiers confiés » et accepte/refuse. Toute la
// sécurité est en base (RPC SECURITY DEFINER + RLS chantier_partages).
// Décision produit : infos travail + client, JAMAIS de financier partagé.
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

/** Un chantier qu'on m'a confié (vue sous-traitant B). */
export interface ChantierConfie {
  partage_id: string
  chantier_id: string
  lot: string | null
  statut: 'invite' | 'actif' | 'refuse' | 'revoque'
  peut_photos: boolean
  peut_avancement: boolean
  proprietaire_nom: string | null
  chantier_titre: string | null
  chantier_adresse: string | null
  chantier_ville: string | null
  chantier_statut: string | null
  date_debut: string | null
  date_fin_prevue: string | null
}

/** Un collaborateur d'un de mes chantiers (vue donneur d'ordre A). */
export interface CollaborateurChantier {
  partage_id: string
  collaborateur_id: string
  collaborateur_nom: string | null
  lot: string | null
  statut: 'invite' | 'actif' | 'refuse' | 'revoque'
}

/** A confie un lot de SON chantier à un confrère B (déjà dans son réseau). */
export async function confierLot(
  chantierId: string,
  collaborateurId: string,
  lot?: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('confier_lot', {
    p_chantier_id: chantierId,
    p_collaborateur_id: collaborateurId,
    p_lot: lot && lot.trim() ? lot.trim() : null,
  })
  if (error) throw new Error(error.message || 'La proposition a échoué.')
}

/** B répond à une invitation de collaboration : 'accepter' | 'refuser'. */
export async function repondrePartageChantier(
  partageId: string,
  action: 'accepter' | 'refuser',
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('repondre_partage_chantier', {
    p_partage_id: partageId,
    p_action: action,
  })
  if (error) throw new Error(error.message)
}

/** A (ou B) révoque un partage de chantier. */
export async function revoquerPartageChantier(partageId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('revoquer_partage_chantier', { p_partage_id: partageId })
  if (error) throw new Error(error.message)
}

/** Liste des chantiers qu'on m'a confiés (vue sous-traitant). */
export function useMesChantiersConfies(): {
  chantiers: ChantierConfie[]
  loading: boolean
  refetch: () => void
} {
  const [chantiers, setChantiers] = useState<ChantierConfie[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChantiers([]); return }
      const { data } = await supabase.rpc('mes_chantiers_confies')
      setChantiers((data ?? []) as ChantierConfie[])
    } catch {
      // Échec RPC/session : on retombe sur une liste vide plutôt qu'un skeleton
      // infini (le finally garantit setLoading(false)).
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { chantiers, loading, refetch: fetch }
}
