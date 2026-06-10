'use client'

/**
 * ConfirmDialog — Modale de confirmation V4 (remplacement de confirm() natif).
 *
 * Deux usages :
 *
 * 1) Imperatif via useConfirm() :
 *      const confirm = useConfirm()
 *      if (await confirm({ title: 'Supprimer ?', variant: 'danger' })) { ... }
 *    Renvoie une Promise<boolean>. La modale est centralisee (un seul DOM rendu).
 *
 * 2) Declaratif via <ConfirmDialog open onConfirm onCancel /> si on veut
 *    afficher une modale controlee par un state local (rare ici).
 *
 * Design :
 *   - Backdrop noir semi-transparent (50%).
 *   - Modale centree, max 420px, radius 16px, Hanken Grotesk.
 *   - Bouton primaire orange (gradient V4) ou rouge (variant=danger).
 *   - Bouton annuler "secondary" (blanc + border gris).
 *   - Escape => cancel.
 *   - Click sur backdrop => cancel.
 *   - Focus auto sur le bouton primaire a l'ouverture.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ConfirmVariant = 'default' | 'danger'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_BTN: Record<ConfirmVariant, string> = {
  default:
    'bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] text-white shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105',
  danger:
    'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_8px_20px_rgba(220,38,38,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105',
}

const VARIANT_ICON: Record<ConfirmVariant, { bg: string; color: string; path: string }> = {
  default: {
    bg: 'bg-orange-100',
    color: 'text-orange-600',
    path:
      'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  danger: {
    bg: 'bg-red-100',
    color: 'text-red-600',
    path:
      'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  },
}

/**
 * Composant declaratif (peu utilise dans le projet, mais expose pour completude).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Focus auto + Escape ferme.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel, onConfirm])

  if (!open || !mounted) return null

  const icon = VARIANT_ICON[variant]

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 font-hanken"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Annuler"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
      />
      {/* Modale */}
      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-white shadow-2xl animate-modal-in"
        style={{
          boxShadow:
            '0 25px 50px -12px rgba(15, 26, 58, 0.35), 0 0 0 1px rgba(15, 26, 58, 0.05)',
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              className={`flex-shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full ${icon.bg}`}
              aria-hidden="true"
            >
              <svg
                className={`h-6 w-6 ${icon.color}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={icon.path} />
              </svg>
            </span>
            <div className="flex-1 pt-0.5">
              <h3
                id="confirm-title"
                className="text-[17px] font-extrabold text-[#0f1a3a] leading-tight tracking-tight"
              >
                {title}
              </h3>
              {message && (
                <p className="mt-2 text-[14px] text-gray-600 leading-relaxed">
                  {message}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-5 rounded-[12px] bg-white text-[#0f1a3a] border-[1.5px] border-gray-200 font-bold text-[14px] hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              className={`h-11 px-5 rounded-[12px] font-bold text-[14px] transition-all duration-150 ${VARIANT_BTN[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.15s ease-out; }
        .animate-modal-in { animation: modal-in 0.18s cubic-bezier(0.22, 0.61, 0.36, 1); }
      `}</style>
    </div>
  )

  return createPortal(node, document.body)
}

// ---------------------------------------------------------------------------
// Hook imperatif useConfirm()
// ---------------------------------------------------------------------------

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

/**
 * Provider a monter une fois (dans app/dashboard/layout.tsx).
 * Conserve la modale au niveau du layout pour eviter de remonter le DOM a chaque appel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (pending) {
      pending.resolve(true)
      setPending(null)
    }
  }, [pending])

  const handleCancel = useCallback(() => {
    if (pending) {
      pending.resolve(false)
      setPending(null)
    }
  }, [pending])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          open
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          variant={pending.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}

/**
 * useConfirm() — Hook qui retourne une fonction `confirm(options) => Promise<boolean>`.
 *
 * Defensive : si le provider n'est pas monte (route hors dashboard ou test),
 * on tombe sur window.confirm() pour ne pas casser le flux. Un warning console
 * indique au developpeur qu'il faut monter le ConfirmProvider.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (ctx) return ctx
  return (options: ConfirmOptions) => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        '[useConfirm] ConfirmProvider non monte, fallback sur window.confirm()',
      )
      const txt =
        options.title + (options.message ? '\n\n' + options.message : '')
      return Promise.resolve(window.confirm(txt))
    }
    return Promise.resolve(false)
  }
}

export default ConfirmDialog
