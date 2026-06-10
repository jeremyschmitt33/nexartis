'use client'

/**
 * UIProviders — Wrap Toaster + ConfirmProvider en un seul composant.
 * Permet de monter tout le systeme UI (toasts + confirm dialogs) avec un
 * seul import dans le layout dashboard, ce qui evite de modifier trop de
 * lignes dans un fichier sensible (cross-OS truncation).
 */

import type { ReactNode } from 'react'
import { Toaster } from './Toaster'
import { ConfirmProvider } from './ConfirmDialog'

export function UIProviders({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
      {children}
      <Toaster />
    </ConfirmProvider>
  )
}

export default UIProviders
