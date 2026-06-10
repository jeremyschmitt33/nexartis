'use client'

/**
 * lib/toast.ts — Systeme de toasts unifie Nexartis V4 (custom, sans dependance).
 *
 * Remplace tous les `alert()` natifs OS du dashboard par un toast elegant coherent
 * avec le design V4 (Hanken Grotesk + navy/orange + emerald/red/sky).
 *
 * Usage :
 *   import { toast } from '@/lib/toast'
 *   toast.success('Facture marquee comme payee')
 *   toast.error('Erreur : impossible de supprimer')
 *   toast.info('Brouillon enregistre')
 *   toast.warning('Attention, cette action est definitive')
 *
 * Le composant <Toaster /> doit etre monte dans `app/dashboard/layout.tsx`.
 * Defensive : si le Toaster n'est pas monte, on log dans la console (pas de plantage).
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  /** Duree en ms avant disparition automatique (par defaut 4000ms, 6000ms pour error) */
  duration?: number
  /** Description complementaire affichee sous le titre */
  description?: string
}

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
  description?: string
}

type Listener = (toasts: ToastItem[]) => void

// Store ultra-simple, partage entre composants via un module-singleton.
let toasts: ToastItem[] = []
const listeners = new Set<Listener>()

function emit() {
  // Copie defensive pour que React detecte le changement de reference.
  const snapshot = [...toasts]
  listeners.forEach((l) => {
    try {
      l(snapshot)
    } catch (e) {
      // Defensive : un listener qui plante ne casse pas les autres.
      // eslint-disable-next-line no-console
      console.error('[toast] listener error', e)
    }
  })
}

function genId(): string {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function push(variant: ToastVariant, message: string, options?: ToastOptions): string {
  // Defensive : sur le serveur on log juste (le toast n'a aucun sens en SSR).
  if (typeof window === 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`[toast.${variant}]`, message, options?.description ?? '')
    return ''
  }

  const id = genId()
  const duration =
    typeof options?.duration === 'number'
      ? options.duration
      : variant === 'error'
        ? 6000
        : 4000

  const item: ToastItem = {
    id,
    message,
    variant,
    duration,
    description: options?.description,
  }
  toasts = [...toasts, item]
  emit()

  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }
  return id
}

export function dismiss(id: string): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Snapshot initial pour synchroniser le composant qui monte.
  listener([...toasts])
  return () => {
    listeners.delete(listener)
  }
}

export const toast = {
  success: (message: string, options?: ToastOptions) => push('success', message, options),
  error: (message: string, options?: ToastOptions) => push('error', message, options),
  info: (message: string, options?: ToastOptions) => push('info', message, options),
  warning: (message: string, options?: ToastOptions) => push('warning', message, options),
  dismiss,
}

export default toast
