// ============================================================================
// /dashboard/banque — Onglet « Dépenses & Banque » (Lot 2a)
// ----------------------------------------------------------------------------
// Composant SERVEUR minimal : porte les metadata (noindex, page privée), tout
// le contenu vit dans BanqueClient (composant client). L'auth est gérée par
// le middleware Supabase (route /dashboard couverte) + RLS sur chaque table.
// ============================================================================

import type { Metadata } from 'next'
import BanqueClient from './BanqueClient'

export const metadata: Metadata = {
  title: 'Dépenses & Banque — Nexartis',
  description:
    "Suivez l'argent qui entre et qui sort : import de relevé bancaire, pointage des opérations, caisse espèces.",
  robots: { index: false, follow: false },
}

export default function BanquePage() {
  return <BanqueClient />
}
