'use client'

// ============================================================================
// app/auth/invitation/[token]/page.tsx — Activation d'un compte employé invité.
// ----------------------------------------------------------------------------
// Page CLIENT standalone (sous /auth → exclue du header/footer marketing par
// ConditionalLayout). Reprend l'univers visuel de /login (carte centrée, logo
// Nexartis, navy/orange) tout en utilisant la police projet `font-hanken`.
//
// Flux :
//   1. Au montage : GET /api/equipe/invitation/{token}
//        → { valid, entrepriseNom?, role?, email?, expired? }
//   2. Si invalide / expirée → écran d'information + lien /login.
//   3. Si valide → formulaire (mot de passe + confirmation, prénom/nom option.)
//        → POST /api/equipe/activer { token, password, prenom, nom }
//        → puis supabase.auth.signInWithPassword({ email, password })
//        → router.push(DEFAULT_LANDING[role] ?? '/dashboard')
//
// Sécurité : le token vient de l'URL (params). La vérification réelle est faite
// côté serveur (back). Cette page ne fait que de l'affichage + relais.
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, DEFAULT_LANDING, isUserRole, type UserRole } from '@/lib/roles'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Statut = 'loading' | 'invalid' | 'expired' | 'valid'

interface InvitationInfo {
  valid: boolean
  entrepriseNom?: string
  role?: string
  email?: string
  expired?: boolean
}

export default function InvitationActivationPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''

  const [statut, setStatut] = useState<Statut>('loading')
  const [info, setInfo] = useState<InvitationInfo | null>(null)

  // Formulaire
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // True quand l'activation échoue car un compte existe déjà (HTTP 409) :
  // on propose alors un bouton « Se connecter » directement dans l'erreur.
  const [compteExistant, setCompteExistant] = useState(false)

  // --- 1. Vérifier l'invitation au montage ---
  useEffect(() => {
    let cancelled = false
    async function verify() {
      if (!token) {
        if (!cancelled) setStatut('invalid')
        return
      }
      try {
        const res = await fetch(`/api/equipe/invitation/${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const data: InvitationInfo = await res.json().catch(() => ({ valid: false }))
        if (cancelled) return

        if (!res.ok || !data?.valid) {
          setStatut(data?.expired ? 'expired' : 'invalid')
          setInfo(data ?? null)
          return
        }
        if (data.expired) {
          setStatut('expired')
          setInfo(data)
          return
        }
        setInfo(data)
        setStatut('valid')
      } catch {
        if (!cancelled) setStatut('invalid')
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [token])

  const roleValue: UserRole | null =
    info?.role && isUserRole(info.role) ? info.role : null
  const roleLabel = roleValue ? ROLE_LABELS[roleValue] : info?.role ?? 'Membre'

  // --- 2. Soumission du formulaire d'activation ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setCompteExistant(false)

    if (password.length < 8) {
      setFormError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/equipe/activer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          prenom: prenom.trim() || undefined,
          nom: nom.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        // 409 = email déjà pris, etc. On affiche le message serveur si présent.
        const fallback =
          res.status === 409
            ? 'Un compte existe déjà avec cet email. Connectez-vous directement.'
            : "Impossible d'activer le compte. Réessayez ou demandez une nouvelle invitation."
        setCompteExistant(res.status === 409)
        setFormError(typeof data?.error === 'string' ? data.error : fallback)
        setSubmitting(false)
        return
      }

      // 3. Connexion automatique puis redirection selon le rôle.
      const email = info?.email
      if (email) {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          // Compte créé mais connexion échouée → on renvoie vers /login.
          router.push('/login')
          return
        }
      }
      const landing = roleValue ? DEFAULT_LANDING[roleValue] ?? '/dashboard' : '/dashboard'
      router.push(landing)
    } catch {
      setFormError('Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.')
      setSubmitting(false)
    }
  }

  // --- Rendu ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-10 font-hanken">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Image
            src="/images/logo-nexartis-v3.svg"
            alt="Nexartis"
            width={480}
            height={240}
            priority
            className="h-24 w-auto object-contain"
            unoptimized
          />
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-8 sm:p-10 border border-gray-100">
          {statut === 'loading' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-[#ff7a1a] rounded-full animate-spin mx-auto mb-6" />
              <p className="font-hanken text-sm text-gray-500">
                Vérification de votre invitation...
              </p>
            </div>
          )}

          {(statut === 'invalid' || statut === 'expired') && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-6">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ff7a1a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="font-hanken font-extrabold text-xl text-[#0f1a3a] mb-2 tracking-[-0.02em]">
                {statut === 'expired'
                  ? "Cette invitation a expiré"
                  : "Cette invitation n'est plus valide"}
              </h1>
              <p className="font-hanken text-sm text-gray-500 mb-7 leading-relaxed">
                {statut === 'expired'
                  ? 'Le lien d’invitation a dépassé sa durée de validité. Demandez à votre employeur de vous réinviter.'
                  : 'Ce lien est introuvable ou a déjà été utilisé. Demandez à votre employeur de vous réinviter.'}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-[52px] bg-[#ff7a1a] hover:brightness-105 text-white font-hanken font-bold text-base rounded-xl transition"
              >
                Aller à la connexion
              </Link>
            </div>
          )}

          {statut === 'valid' && (
            <>
              <h1 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] mb-2 tracking-[-0.02em]">
                Activez votre compte
              </h1>
              <p className="text-sm text-gray-500 font-hanken mb-3 leading-relaxed">
                Vous avez été invité à rejoindre{' '}
                <span className="font-bold text-[#0f1a3a]">
                  {info?.entrepriseNom || 'votre entreprise'}
                </span>{' '}
                en tant que <span className="font-bold text-[#ff7a1a]">{roleLabel}</span>.
              </p>
              <p className="text-sm text-gray-500 font-hanken mb-6 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                Nexartis est l&apos;outil de gestion utilisé par{' '}
                <span className="font-semibold text-[#0f1a3a]">
                  {info?.entrepriseNom || 'votre entreprise'}
                </span>
                . En activant votre compte, vous accéderez à votre espace de travail.
              </p>

              {formError && (
                <div className="bg-red-50 text-red-600 text-sm font-hanken rounded-lg px-4 py-3 mb-5">
                  <p>{formError}</p>
                  {compteExistant && (
                    <Link
                      href="/login"
                      className="mt-3 inline-flex items-center justify-center w-full h-11 bg-[#ff7a1a] hover:brightness-105 text-white font-hanken font-bold text-sm rounded-lg transition"
                    >
                      Se connecter
                    </Link>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email (lecture seule) */}
                <div>
                  <label
                    htmlFor="inv-email"
                    className="block font-hanken font-medium text-sm text-gray-700 mb-1.5"
                  >
                    Votre email
                  </label>
                  <input
                    id="inv-email"
                    type="email"
                    value={info?.email || ''}
                    readOnly
                    aria-readonly="true"
                    className="w-full h-12 rounded-lg border border-gray-200 bg-gray-50 px-4 font-hanken text-sm text-gray-500 outline-none cursor-not-allowed"
                  />
                </div>

                {/* Prénom / Nom (optionnels) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="inv-prenom"
                      className="block font-hanken font-medium text-sm text-gray-700 mb-1.5"
                    >
                      Prénom <span className="text-gray-400 font-normal">(optionnel)</span>
                    </label>
                    <input
                      id="inv-prenom"
                      type="text"
                      autoComplete="given-name"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className="w-full h-12 rounded-lg border border-gray-200 px-4 font-hanken text-sm text-[#0f1a3a] placeholder:text-gray-400 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a] outline-none transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inv-nom"
                      className="block font-hanken font-medium text-sm text-gray-700 mb-1.5"
                    >
                      Nom <span className="text-gray-400 font-normal">(optionnel)</span>
                    </label>
                    <input
                      id="inv-nom"
                      type="text"
                      autoComplete="family-name"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="w-full h-12 rounded-lg border border-gray-200 px-4 font-hanken text-sm text-[#0f1a3a] placeholder:text-gray-400 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a] outline-none transition"
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <label
                    htmlFor="inv-password"
                    className="block font-hanken font-medium text-sm text-gray-700 mb-1.5"
                  >
                    Choisissez un mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="inv-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      aria-describedby="inv-password-hint"
                      className="w-full h-12 rounded-lg border border-gray-200 px-4 pr-12 font-hanken text-sm text-[#0f1a3a] focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a] outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p id="inv-password-hint" className="mt-1.5 font-hanken text-xs text-gray-500">
                    Au moins 8 caractères.
                  </p>
                </div>

                {/* Confirmation */}
                <div>
                  <label
                    htmlFor="inv-confirm"
                    className="block font-hanken font-medium text-sm text-gray-700 mb-1.5"
                  >
                    Confirmez le mot de passe
                  </label>
                  <input
                    id="inv-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full h-12 rounded-lg border border-gray-200 px-4 font-hanken text-sm text-[#0f1a3a] focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a] outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-[52px] bg-[#ff7a1a] hover:brightness-105 text-white font-hanken font-bold text-base rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Activation...' : 'Activer mon compte'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 font-hanken mt-7">
                Vous avez déjà un compte ?{' '}
                <Link href="/login" className="text-[#ff7a1a] font-semibold hover:underline">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
