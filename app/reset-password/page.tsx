'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Supabase sets the session from the URL hash automatically
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also check if already in recovery state
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    // Nettoyage : evite une fuite d'abonnement au demontage.
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#5ab4e0] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-manrope">Vérification en cours...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px]">
        <div className="bg-white shadow-lg rounded-2xl p-10 border border-gray-100">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h1 className="font-syne font-bold text-xl text-[#1a1a2e] mb-2">Mot de passe modifié</h1>
              <p className="text-sm text-gray-500 font-manrope">Redirection vers votre espace...</p>
            </div>
          ) : (
            <>
              <h1 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-2">Nouveau mot de passe</h1>
              <p className="text-sm text-gray-500 font-manrope mb-8">Choisissez un nouveau mot de passe sécurisé.</p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm font-manrope rounded-lg px-4 py-3 mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full h-12 rounded-lg border border-gray-200 px-4 pr-12 font-manrope text-sm text-[#1a1a2e] focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">Confirmer</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-12 rounded-lg border border-gray-200 px-4 font-manrope text-sm text-[#1a1a2e] focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0] outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-[#e87a2a] hover:bg-[#f09050] text-white font-syne font-bold text-base rounded-xl transition disabled:opacity-60"
                >
                  {loading ? 'Modification...' : 'Modifier le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
