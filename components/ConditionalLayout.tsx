'use client'

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const HIDDEN_ROUTES = ['/dashboard', '/onboarding', '/login', '/register', '/auth', '/signer', '/offline', '/maintenance']

// V4 (2026-06-08) — Routes qui masquent UNIQUEMENT le header marketing.
// La home "/" est dans cette liste : elle a sa propre navigation dark
// (`<LandingNav />`) intégrée par `app/page.tsx`. Le Footer reste affiché
// pour préserver le maillage interne SEO (10 pages métier).
const HEADER_ONLY_HIDDEN_ROUTES = ['/']

export default function ConditionalLayout({
  header,
  footer,
  children,
  forceHidden = false,
}: {
  header: ReactNode
  footer: ReactNode
  children: ReactNode
  /**
   * Permet au layout racine de forcer le masquage du header/footer même
   * quand l'URL du navigateur ne correspond à aucune route cachée.
   * Utilisé notamment en mode maintenance : le middleware fait un rewrite
   * vers /maintenance mais l'URL côté client reste l'URL d'origine, donc
   * usePathname() ne voit pas /maintenance.
   */
  forceHidden?: boolean
}) {
  const pathname = usePathname()
  const isHidden =
    forceHidden || HIDDEN_ROUTES.some((route) => pathname.startsWith(route))

  // Header-only hiding : exact match sur "/" pour ne pas affecter "/blog" etc.
  const isHeaderOnlyHidden =
    !isHidden && HEADER_ONLY_HIDDEN_ROUTES.includes(pathname)

  const showHeader = !isHidden && !isHeaderOnlyHidden
  const showFooter = !isHidden

  return (
    <>
      {showHeader && header}
      <main>{children}</main>
      {showFooter && footer}
    </>
  )
}
