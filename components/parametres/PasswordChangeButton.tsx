'use client'

// -------------------------------------------------------------------
// Bouton + modale de changement de mot de passe (Parametres > Compte).
// Reutilise le mecanisme eprouve de app/reset-password : Supabase
// auth.updateUser({ password }). L'utilisateur etant deja connecte,
// la session courante autorise la mise a jour.
// Composant isole expres : evite d'alourdir/corrompre le gros fichier
// app/dashboard/parametres/page.tsx.
// -------------------------------------------------------------------

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KeyRound, Eye, EyeOff, X, CheckCircle2 } from 'lucide-react'

export default function PasswordChangeButton() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError(null)
    setSuccess(false)
    setLoading(false)
    setShow(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message || 'Une erreur est survenue. Reessayez.')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  const inputCls =
    'w-full h-11 px-4 pr-11 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white transition-all'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-hanken font-semibold text-sm text-[#0f1a3a] bg-white border-[1.5px] border-gray-200 hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all duration-200"
      >
        <KeyRound size={16} className="text-[#ff7a1a]" />
        Modifier le mot de passe
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={close}
        >
          <div
            className="bg-white w-full max-w-[440px] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[3px] bg-gradient-to-r from-[#ff7a1a] to-[#ffb070]" />
            <div className="px-6 pt-5 pb-2 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fafbfc] border border-[#0f1a3a]/[0.08] flex items-center justify-center text-[#ff7a1a]">
                  <KeyRound size={20} />
                </div>
                <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] mt-1">Modifier le mot de passe</h2>
              </div>
              <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {success ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 size={42} className="text-green-600 mx-auto mb-3" />
                <p className="font-hanken font-bold text-[15px] text-[#0f1a3a]">Mot de passe modifie</p>
                <p className="font-hanken text-sm text-gray-500 mt-1">Votre nouveau mot de passe est actif.</p>
                <button
                  onClick={close}
                  className="mt-5 h-11 px-6 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken font-bold text-sm"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div>
                  <label className="block font-hanken text-[12px] font-semibold uppercase tracking-wider text-[#0f1a3a] mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className={inputCls}
                      placeholder="Au moins 8 caracteres"
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f1a3a]" aria-label={show ? 'Masquer' : 'Afficher'}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-hanken text-[12px] font-semibold uppercase tracking-wider text-[#0f1a3a] mb-1.5">Confirmer le mot de passe</label>
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full h-11 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white transition-all"
                    placeholder="Repetez le mot de passe"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    <p className="font-hanken text-[13px] text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={close} disabled={loading} className="h-11 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken font-semibold text-sm text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all disabled:opacity-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={loading} className="h-11 px-6 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken font-bold text-sm shadow-[0_6px_16px_rgba(255,122,26,0.30)] hover:brightness-105 transition-all disabled:opacity-50">
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
