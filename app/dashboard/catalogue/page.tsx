'use client'

// ---------------------------------------------------------------------------
// Ancienne page « Catalogue ». Le catalogue par metier a ete fusionne dans la
// page unifiee /dashboard/prestations (mode « Catalogue »). On conserve cette
// URL pour ne pas casser les anciens liens : redirection immediate.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CatalogueRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/prestations')
  }, [router])
  return null
}
