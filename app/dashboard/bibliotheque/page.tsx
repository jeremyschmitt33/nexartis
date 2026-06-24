'use client'

// ---------------------------------------------------------------------------
// Ancienne page « Bibliotheque ». Le CRUD a ete fusionne dans la page unifiee
// /dashboard/prestations (mode « Mes prestations »). On conserve cette URL pour
// ne pas casser les anciens liens / favoris : redirection immediate.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BibliothequeRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/prestations')
  }, [router])
  return null
}
