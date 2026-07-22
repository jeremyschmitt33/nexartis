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
import { preparerFichierMessage } from '@/lib/messagerie-fichiers'
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

/**
 * Le SOUS-TRAITANT (B) verse une photo dans le chantier d'un confrère (A).
 *
 * Rien n'est copié dans le compte de B : la photo est enregistrée directement
 * dans l'espace du propriétaire A (elle apparaîtra dans SA galerie chantier),
 * avec une trace `uploaded_by = B`. Tout est validé côté serveur (B doit être
 * collaborateur ACTIF avec le droit photos) ; le navigateur ne fait que
 * préparer l'image et pousser le binaire vers R2.
 *
 * Étapes : préparation (HEIC→JPEG, compression) → URL signée dans l'espace de A
 * → PUT direct vers R2 → confirmation serveur qui crée la ligne `photos`.
 */
export async function televerserPhotoConfie(
  chantierId: string,
  file: File,
  opts?: { album?: 'avant' | 'pendant' | 'apres'; legende?: string },
): Promise<void> {
  const pret = await preparerFichierMessage(file)
  if (pret.typePj !== 'photo') {
    throw new Error('Seules les photos sont acceptées ici (JPEG, PNG ou HEIC).')
  }

  // 1) URL signée : le serveur vérifie que B est collaborateur actif et renvoie
  //    une clé dans l'espace R2 du propriétaire A.
  const signRes = await fetch('/api/chantier-collab/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chantier_id: chantierId, size: pret.blob.size }),
  })
  const signData = await signRes.json().catch(() => ({} as Record<string, unknown>))
  if (!signRes.ok || !signData?.putUrl || !signData?.key) {
    throw new Error(
      (signData?.message as string) ||
        (signData?.error as string) ||
        "Impossible de préparer l'envoi de la photo.",
    )
  }
  const key = signData.key as string
  const putUrl = signData.putUrl as string

  // 2) Envoi direct du binaire vers R2 (le Content-Type n'est pas signé).
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    body: pret.blob,
    headers: { 'Content-Type': pret.contentType || 'image/jpeg' },
  })
  if (!putRes.ok) throw new Error("L'envoi de la photo a échoué. Réessayez.")

  // 3) Confirmation : le serveur relit la taille réelle sur R2 et crée la ligne
  //    `photos` au nom de A (avec uploaded_by = B).
  const confRes = await fetch('/api/chantier-collab/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chantier_id: chantierId,
      r2_key: key,
      album: opts?.album,
      legende: opts?.legende,
    }),
  })
  const confData = await confRes.json().catch(() => ({} as Record<string, unknown>))
  if (!confRes.ok) {
    throw new Error(
      (confData?.message as string) ||
        (confData?.error as string) ||
        "La photo n'a pas pu être enregistrée.",
    )
  }
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
