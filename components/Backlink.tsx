'use client'

import { usePathname } from 'next/navigation'

/** Signature discrete : affichee uniquement sur l'accueil et les mentions legales. */
export default function Backlink() {
  const raw = usePathname() || '/'
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw
  if (path !== '/' && path !== '/mentions-legales') return null
  return (
    <>{' '}&middot; Site cr&eacute;&eacute; par <a href="https://jeremyschmitt.fr" target="_blank" rel="noopener" className="underline underline-offset-2">jeremyschmitt.fr</a></>
  )
}
