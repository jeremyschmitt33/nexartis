'use client'

import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { safeNextPath, NEXT_COOKIE } from '@/lib/safe-redirect'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Ou renvoyer l'utilisateur apres connexion (ex : retour vers son invitation).
  // Valide cote client pour empecher tout open-redirect (voir lib/safe-redirect).
  const nextPath = safeNextPath(searchParams.get('next'))

  // Auto-redirect if already logged in (after OAuth callback)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push(nextPath)
    })
  }, [router, nextPath])

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth'
      ? 'Une erreur est survenue lors de l\'authentification.'
      : null
  )

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    router.push(nextPath)
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }

    // Cookie de secours (même navigateur) : posé UNIQUEMENT ici, au démarrage
    // réel d'un aller-retour email de confirmation, et rafraîchi/effacé à chaque
    // tentative pour ne jamais hériter d'un `next` d'une inscription précédente.
    if (nextPath !== '/dashboard') {
      document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(nextPath)}; path=/; max-age=3600; SameSite=Lax`
    } else {
      document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0; SameSite=Lax`
    }

    // Appeler notre API serveur qui crée le compte + envoie le mail de confirmation
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, next: nextPath }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erreur lors de la création du compte')
      setLoading(false)
      return
    }

    setSuccessMessage('Un email de confirmation vous a été envoyé. Cliquez sur le lien dans l\'email pour activer votre compte.')
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setSuccessMessage(null)
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo (image contient deja le wordmark Nexartis) */}
        <div className="flex items-center justify-center mb-8">
          <Image
            src="/images/logo-nexartis-v3.svg"
            alt="Nexartis"
            width={480}
            height={240}
            priority
            className="h-28 w-auto object-contain"
            unoptimized
          />
        </div>

        {/* Card */}
        <div className="bg-white shadow-lg rounded-2xl p-10 border border-gray-100">
          <h1 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">
            {mode === 'login' ? 'Accéder à votre espace' : 'Créer votre compte'}
          </h1>
          <p className="text-sm text-gray-500 font-manrope mb-8">
            {mode === 'login'
              ? 'Gérez votre activité artisanale depuis n\u0027importe quel appareil'
              : 'Commencez à gérer votre activité artisanale en quelques minutes'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-manrope rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 text-green-700 text-sm font-manrope rounded-lg px-4 py-3 mb-6">
              {successMessage}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleEmailLogin : handleEmailSignUp} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 rounded-lg border border-gray-200 px-4 font-manrope text-sm text-[#1a1a2e] placeholder:text-gray-400 focus:border-sky focus:ring-1 focus:ring-sky outline-none transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 rounded-lg border border-gray-200 px-4 pr-12 font-manrope text-sm text-[#1a1a2e] focus:border-sky focus:ring-1 focus:ring-sky outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-sky font-manrope hover:underline"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              )}
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full h-12 rounded-lg border border-gray-200 px-4 font-manrope text-sm text-[#1a1a2e] focus:border-sky focus:ring-1 focus:ring-sky outline-none transition"
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-[#e87a2a] hover:bg-[#f09050] text-white font-syne font-bold text-base rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? (mode === 'login' ? 'Connexion...' : 'Création...')
                : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400 font-manrope">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            className="w-full h-[52px] bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-3 font-manrope font-medium text-sm text-[#1a1a2e] hover:bg-gray-50 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </button>

          {/* Bottom toggle link */}
          <p className="text-center text-sm text-gray-500 font-manrope mt-8">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button onClick={switchMode} className="text-sky font-medium hover:underline">
                  S&apos;inscrire &rarr;
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button onClick={switchMode} className="text-sky font-medium hover:underline">
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">Chargement...</div></div>}>
      <LoginForm />
    </Suspense>
  )
}
