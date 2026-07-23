'use client'

// ============================================================================
// app/dashboard/chantiers-confies/page.tsx — Route conservée (accès direct).
// ----------------------------------------------------------------------------
// L'espace « Chantiers confiés » vit désormais comme ONGLET dans la messagerie
// (il n'est plus dans le menu principal). Cette route reste valide pour les
// liens directs / anciens favoris et réutilise exactement le même contenu.
// ============================================================================

import ChantiersConfiesWorkspace from '@/components/collab/ChantiersConfiesWorkspace'

export default function ChantiersConfiesPage() {
  return <ChantiersConfiesWorkspace />
}
