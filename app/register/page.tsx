'use client'

import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return score
}

const strengthLabels = ['Faible', 'Moyen', 'Fort']
const strengthColors = ['bg-red-500', 'bg-yellow-500', 'bg-green-500']

export default function RegisterPage() {
  const router = useRouter()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = getPasswordStrength(password)

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const resendConfirmation = async () => {
    setResending(true)
    setResendSuccess(false)
    const res = await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResending(false)
    if (res.ok) setResendSuccess(true)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Appeler notre API serveur qui crée le compte + envoie le mail de confirmation
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, prenom, nom, entreprise }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erreur lors de la création du compte')
      setLoading(false)
      return
    }

    // Afficher le message "vérifiez votre email"
    setShowConfirmation(true)
    setLoading(false)
  }

  const handleGoogleRegister = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const inputClasses =
    'w-full h-12 rounded-lg border border-gray-200 px-4 font-manrope text-sm text-[#1a1a2e] placeholder:text-gray-400 focus:border-sky focus:ring-1 focus:ring-sky outline-none transition'

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Logo (image contient deja le wordmark Nexartis) */}
        <div className="flex items-center justify-center mb-6">
          <Image src="/images/logo-nexartis.png" alt="Nexartis" width={320} height={160} quality={100} priority className="h-20 w-auto object-contain" />
        </div>

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-manrope font-medium px-4 py-2 rounded-full">
            &#10003; 14 jours gratuits &mdash; Sans carte bancaire
          </span>
        </div>

        {/* Écran confirmation email */}
        {showConfirmation && (
          <div className="bg-white shadow-lg rounded-2xl p-10 border border-gray-100 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-3">
              Vérifiez votre boîte mail
            </h1>
            <p className="font-manrope text-gray-500 text-sm leading-relaxed mb-2">
              Un email de confirmation a été envoyé à :
            </p>
            <p className="font-manrope font-semibold text-[#1a1a2e] text-base mb-6">
              {email}
            </p>
            <p className="font-manrope text-gray-500 text-sm leading-relaxed mb-8">
              Cliquez sur le bouton dans l&apos;email pour activer votre compte et accéder à votre espace Nexartis.
            </p>
            {/* Bouton renvoyer */}
            <button
              onClick={resendConfirmation}
              disabled={resending || resendSuccess}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-manrope font-semibold text-[#1a1a2e] hover:bg-gray-50 transition disabled:opacity-60 mb-4"
            >
              {resending ? 'Envoi en cours...' : resendSuccess ? 'Email renvoyé ✓' : 'Renvoyer l\'email de confirmation'}
            </button>

            <div className="bg-amber-50 rounded-xl p-4 text-left">
              <p className="font-manrope text-amber-700 text-xs leading-relaxed">
                <strong>Vous ne trouvez pas l&apos;email ?</strong> Vérifiez vos spams ou courriers indésirables. L&apos;email est envoyé depuis <strong>no-reply@nexartis.fr</strong>.
              </p>
            </div>
            <Link href="/login" className="inline-block mt-6 text-sm text-sky font-manrope font-medium hover:underline">
              Retour à la connexion
            </Link>
          </div>
        )}

        {/* Card formulaire */}
        {!showConfirmation && (
        <div className="bg-white shadow-lg rounded-2xl p-10 border border-gray-100">
          <h1 className="font-syne font-bold text-2xl text-[#1a1a2e] mb-8">
            Créer votre compte professionnel
          </h1>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-manrope rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Entreprise */}
            <div>
              <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                Nom de votre entreprise
              </label>
              <input
                type="text"
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                required
                className={inputClasses}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-manrope font-medium text-sm text-gray-700 mb-1.5">
                Email professionnel
              </label>
              <input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClasses}
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
                  minLength={8}
                  className={`${inputClasses} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition ${
                          i < strength ? strengthColors[strength - 1] : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`text-xs mt-1 font-manrope ${
                      strength === 1
                        ? 'text-red-500'
                        : strength === 2
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {strengthLabels[strength - 1]}
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-[#e87a2a] hover:bg-[#f09050] text-white font-syne font-bold text-base rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
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
            onClick={handleGoogleRegister}
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
            S&apos;inscrire avec Google
          </button>

          {/* Legal */}
          <p className="text-[11px] text-gray-400 font-manrope text-center mt-6 leading-relaxed">
            En créant votre compte, vous acceptez nos{' '}
            <Link href="/cgu" className="underline">
              CGU
            </Link>{' '}
            et notre{' '}
            <Link href="/confidentialite" className="underline">
              politique de confidentialité
            </Link>
            .
          </p>

          {/* Bottom link */}
          <p className="text-center text-sm text-gray-500 font-manrope mt-6">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-sky font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
        )}
      </div>
    </div>
  )
}
