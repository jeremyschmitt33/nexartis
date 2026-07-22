'use client'

// ============================================================================
// app/invitation/[token]/page.tsx — Page d'atterrissage PUBLIQUE d'invitation.
// ----------------------------------------------------------------------------
// Montre qui invite (nom/métier) SANS exiger de compte. Pour entrer dans le
// réseau, l'invité crée un compte gratuit (ou se connecte). C'est la "voie
// médiane" : on montre la valeur, on n'ouvre pas la conversation à un anonyme.
// Route ajoutée à HIDDEN_ROUTES (pas de header/footer marketing).
// ============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks'
import { chargerInvitationInfos, accepterParToken, type InvitationInfos } from '@/lib/hooks-reseau'
import { Loader2, CheckCircle2, UserPlus, LogIn, MessageCircle } from 'lucide-react'

export default function InvitationLandingPage({ params }: { params: { token: string } }) {
  const token = params.token
  const router = useRouter()
  const { user, loading: loadingUser } = useUser()

  const [infos, setInfos] = useState<InvitationInfos | null>(null)
  const [loadingInfos, setLoadingInfos] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const i = await chargerInvitationInfos(token)
        if (!cancelled) { setInfos(i); setLoadingInfos(false) }
      } catch {
        if (!cancelled) { setInfos(null); setLoadingInfos(false) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [token])

  async function accepter() {
    setAccepting(true); setErreur(null)
    try {
      await accepterParToken(token)
      router.push('/dashboard/reseau')
    } catch (e) {
      setErreur((e as Error).message)
      setAccepting(false)
    }
  }

  const nom = infos?.inviteur_nom || 'Un artisan'
  const metier = infos?.inviteur_metier || ''
  const dejaAcceptee = infos?.statut === 'acceptee'

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-navy-mid flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange to-orange-hover h-1.5" />
        <div className="p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-navy grid place-items-center text-white font-extrabold text-sm">N</div>
            <span className="font-bold text-navy font-manrope">Nexartis</span>
          </div>

          {loadingInfos || loadingUser ? (
            <div className="py-10"><Loader2 className="w-8 h-8 text-orange animate-spin mx-auto" /></div>
          ) : !infos ? (
            <div className="py-6">
              <p className="text-lg font-bold text-navy">Invitation introuvable</p>
              <p className="text-sm text-gray-500 mt-2">Ce lien d'invitation n'est plus valide ou a été annulé.</p>
              <Link href="/" className="inline-block mt-6 text-sm font-semibold text-orange hover:underline">Découvrir Nexartis</Link>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-extrabold text-xl mx-auto mb-4">
                {nom.trim().slice(0, 2).toUpperCase()}
              </div>
              <p className="text-[15px] text-gray-500">
                <strong className="text-navy">{nom}</strong>{metier ? ` · ${metier}` : ''}
              </p>
              <h1 className="text-2xl font-extrabold text-navy font-manrope mt-2 leading-tight">
                vous invite à le rejoindre sur Nexartis
              </h1>
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                Échangez messages et documents entre artisans, en toute confidentialité —
                l'outil de gestion pensé pour les artisans.
              </p>

              {erreur && <p className="text-sm text-red-500 mt-4">{erreur}</p>}

              <div className="mt-7 space-y-2.5">
                {user ? (
                  dejaAcceptee ? (
                    <Link href="/dashboard/reseau" className="flex items-center justify-center gap-2 h-12 rounded-xl bg-navy text-white font-semibold hover:bg-navy-mid transition-colors">
                      <MessageCircle className="w-5 h-5" /> Aller à mon réseau
                    </Link>
                  ) : (
                    <button onClick={accepter} disabled={accepting} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-orange text-white font-semibold hover:bg-orange-hover transition-colors disabled:opacity-40">
                      {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Accepter l'invitation
                    </button>
                  )
                ) : (
                  <>
                    <Link href={`/register?next=${encodeURIComponent(`/invitation/${token}`)}`} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-orange text-white font-semibold hover:bg-orange-hover transition-colors">
                      <UserPlus className="w-5 h-5" /> Créer mon compte gratuit
                    </Link>
                    <Link href={`/login?next=${encodeURIComponent(`/invitation/${token}`)}`} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gray-100 text-navy font-semibold hover:bg-gray-200 transition-colors">
                      <LogIn className="w-5 h-5" /> J'ai déjà un compte
                    </Link>
                    <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
                      Inscrivez-vous avec l'adresse email sur laquelle vous avez reçu l'invitation
                      pour retrouver {nom} dans votre réseau.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
