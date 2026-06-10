'use client'

/**
 * Toaster — Container global des toasts V4 (a monter une fois dans le layout).
 *
 * - Position bottom-right desktop, top-center mobile (decision : bottom masque
 *   la bottom-nav mobile, donc on remonte sur mobile).
 *   --> finalement on garde bottom partout (bottom-nav a 56px de haut, on offset).
 * - aria-live="polite" pour annonces lecteur d'ecran.
 * - Animation in/out CSS (slide + fade).
 * - Cliquer sur le toast = dismiss.
 * - Bouton X = dismiss.
 *
 * Couleurs V4 :
 *   success : emerald-500 + bg emerald-50
 *   error   : red-500 + bg red-50
 *   info    : sky-500 + bg sky-50
 *   warning : orange-500 + bg orange-50
 */

import { useEffect, useState } from 'react'
import { subscribe, dismiss, type ToastItem, type ToastVariant } from '@/lib/toast'

const ICON: Record<ToastVariant, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
}

const STYLES: Record<
  ToastVariant,
  { wrap: string; icon: string; title: string; close: string }
> = {
  success: {
    wrap: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600 bg-emerald-100',
    title: 'text-emerald-900',
    close: 'text-emerald-700 hover:bg-emerald-100',
  },
  error: {
    wrap: 'bg-red-50 border-red-200',
    icon: 'text-red-600 bg-red-100',
    title: 'text-red-900',
    close: 'text-red-700 hover:bg-red-100',
  },
  info: {
    wrap: 'bg-sky-50 border-sky-200',
    icon: 'text-sky-600 bg-sky-100',
    title: 'text-sky-900',
    close: 'text-sky-700 hover:bg-sky-100',
  },
  warning: {
    wrap: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-600 bg-orange-100',
    title: 'text-orange-900',
    close: 'text-orange-700 hover:bg-orange-100',
  },
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const unsub = subscribe(setItems)
    return unsub
  }, [])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto sm:px-0"
      style={{
        // Sur mobile la bottom-nav fait ~70px, on remonte largement au-dessus.
        // Sur desktop on reste a 16px du bord bas.
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
      }}
    >
      {items.map((item) => {
        const style = STYLES[item.variant]
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto w-full max-w-[420px] rounded-xl border shadow-lg ${style.wrap} animate-toast-in font-hanken`}
            style={{
              boxShadow:
                '0 10px 30px -10px rgba(15, 26, 58, 0.18), 0 4px 12px -6px rgba(15, 26, 58, 0.12)',
            }}
          >
            <div className="flex items-start gap-3 p-3.5">
              <span
                className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg ${style.icon}`}
                aria-hidden="true"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={ICON[item.variant]}
                  />
                </svg>
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <p
                  className={`text-[14px] font-semibold leading-snug ${style.title}`}
                >
                  {item.message}
                </p>
                {item.description && (
                  <p className="mt-1 text-[13px] text-gray-700 leading-snug">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Fermer la notification"
                className={`flex-shrink-0 -m-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${style.close}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
      <style jsx global>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-toast-in {
          animation: toast-in 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
        }
      `}</style>
    </div>
  )
}

export default Toaster
