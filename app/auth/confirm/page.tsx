'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { safeNextPath, NEXT_COOKIE } from '@/lib/safe-redirect'

/**
 * Page client pour gérer la confirmation email.
 * Supabase redirige ici avec un #access_token dans l'URL (hash fragment).
 * Cette page lit le token, établit la session, et redirige vers le dashboard.
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    async function handleConfirm() {
      const supabase = createClient()

      // 0. Destination finale après confirmation : ?next= dans l'URL (scellé
      //    dans le lien email, survit donc même sur un autre appareil), sinon
      //    cookie de secours (même navigateur), sinon /dashboard. Toujours
      //    validé (anti open-redirect). On lit AVANT de nettoyer l'URL.
      let nextPath = '/dashboard'
      try {
        const fromQuery = new URLSearchParams(window.location.search).get('next')
        if (fromQuery) {
          nextPath = safeNextPath(fromQuery)
        } else {
          const m = document.cookie.split('; ').find((c) => c.startsWith(`${NEXT_COOKIE}=`))
          if (m) nextPath = safeNextPath(decodeURIComponent(m.split('=')[1] || ''))
        }
        // On consomme le cookie pour qu'il ne « colle » pas à une navigation ultérieure.
        document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0; SameSite=Lax`
      } catch {
        nextPath = '/dashboard'
      }

      // 1. Extraire manuellement les tokens du hash fragment (#access_token=...&refresh_token=...)
      // Supabase ne le fait pas toujours automatiquement, surtout avec @supabase/ssr.
      const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorParam = params.get('error')
      const errorDescription = params.get('error_description')

      // 2. Si Supabase a renvoyé une erreur dans l'URL (token expiré/déjà utilisé)
      if (errorParam) {
        console.error('Supabase auth error in URL:', errorParam, errorDescription)
        setStatus('error')
        return
      }

      // 3. Si on a les tokens, créer la session manuellement
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (data.session && !error) {
          setStatus('success')
          // Nettoyer le hash de l'URL pour éviter qu'il traîne
          window.history.replaceState(null, '', window.location.pathname)
          setTimeout(() => router.push(nextPath), 600)
          return
        }
        console.error('setSession error:', error)
      }

      // 4. Fallback : peut-être que la session existe déjà (utilisateur déjà connecté)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('success')
        setTimeout(() => router.push(nextPath), 500)
        return
      }

      // 5. Sinon, vraie erreur
      setStatus('error')
    }

    handleConfirm()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#e87a2a] rounded-full animate-spin mx-auto mb-6" />
            <h1 className="font-syne font-bold text-xl text-[#1a1a2e] mb-2">Confirmation en cours...</h1>
            <p className="font-manrope text-sm text-gray-500">Votre compte est en cours d&apos;activation.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-syne font-bold text-xl text-[#1a1a2e] mb-2">Compte confirmé !</h1>
            <p className="font-manrope text-sm text-gray-500">Redirection vers votre espace...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="font-syne font-bold text-xl text-[#1a1a2e] mb-2">Votre compte est peut-être déjà confirmé</h1>
            <p className="font-manrope text-sm text-gray-500 mb-6">
              Si vous avez déjà cliqué sur ce lien, votre compte est probablement actif.
              Essayez de vous connecter directement.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-2.5 bg-[#e87a2a] text-white font-syne font-bold text-sm rounded-xl hover:bg-[#f09050] transition"
              >
                Se connecter
              </button>
              <button
                onClick={() => router.push('/register')}
                className="px-6 py-2.5 border border-gray-200 text-[#1a1a2e] font-manrope font-medium text-sm rounded-xl hover:bg-gray-50 transition"
              >
                S&apos;inscrire
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
