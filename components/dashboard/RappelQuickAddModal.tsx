'use client'

/**
 * RappelQuickAddModal — modale de création rapide d'un rappel "post-it".
 *
 * 3 champs : Titre (autofocus, obligatoire), Date (optionnel), Priorité (défaut normale).
 * Submit on Enter, validation côté client, INSERT direct via supabase client.
 *
 * Cohérent avec le design V4 Light Premium (Hanken Grotesk, palette navy/orange,
 * inputs #fafbfc avec focus ring orange, boutons gradient orange).
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Priorite = 'basse' | 'normale' | 'haute' | 'urgente'

interface RappelQuickAddModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function RappelQuickAddModal({ open, onClose, onCreated }: RappelQuickAddModalProps) {
  const [titre, setTitre] = useState('')
  const [dueDate, setDueDate] = useState('') // format YYYY-MM-DD
  const [priorite, setPriorite] = useState<Priorite>('normale')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset à chaque ouverture + autofocus
  useEffect(() => {
    if (open) {
      setTitre('')
      setDueDate('')
      setPriorite('normale')
      setError(null)
      setSaving(false)
      // Petit délai pour laisser le DOM s'afficher avant focus
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Fermer avec Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const titreTrim = titre.trim()
    if (!titreTrim) {
      setError('Le titre est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expirée. Reconnectez-vous.')
        setSaving(false)
        return
      }
      // Convertit YYYY-MM-DD → ISO timestamp (midi local pour éviter les surprises timezone)
      // sinon null si pas de date saisie.
      let dueIso: string | null = null
      if (dueDate) {
        const [y, m, d] = dueDate.split('-').map(Number)
        if (y && m && d) {
          const local = new Date(y, m - 1, d, 12, 0, 0, 0)
          dueIso = local.toISOString()
        }
      }
      const { error: insertErr } = await supabase.from('rappels').insert({
        user_id: user.id,
        titre: titreTrim,
        due_date: dueIso,
        priorite,
        statut: 'actif',
        source: 'manuel',
      })
      if (insertErr) {
        // Catch défensif : si la table n'existe pas encore côté DB
        if (insertErr.code === '42P01' || insertErr.code === '42703' || insertErr.message?.includes('does not exist')) {
          setError('La table rappels n\'est pas encore initialisée. Exécutez la migration SQL.')
        } else {
          setError(insertErr.message || 'Erreur lors de la création.')
        }
        setSaving(false)
        return
      }
      onCreated()
      onClose()
    } catch (err) {
      console.error('[RappelQuickAdd] erreur:', err)
      setError('Erreur inattendue. Réessayez.')
      setSaving(false)
    }
  }

  const prioOptions: { value: Priorite; label: string; dot: string }[] = [
    { value: 'basse', label: 'Basse', dot: '#94a3b8' },
    { value: 'normale', label: 'Normale', dot: '#5ab4e0' },
    { value: 'haute', label: 'Haute', dot: '#e87a2a' },
    { value: 'urgente', label: 'Urgente', dot: '#ef4444' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rappel-modal-title"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-7 max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(15,26,58,0.25)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="rappel-modal-title" className="font-hanken font-extrabold text-[20px] text-[#0f1a3a] tracking-[-0.02em]">
            Nouveau rappel
          </h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#445068" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Titre */}
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Titre *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Ex : Rappeler le comptable"
              maxLength={200}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] placeholder:text-gray-400 focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12)] transition-all duration-200"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Date (optionnel)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12)] transition-all duration-200"
            />
          </div>

          {/* Priorité — chips */}
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Priorité
            </label>
            <div className="grid grid-cols-4 gap-2">
              {prioOptions.map(p => {
                const active = priorite === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriorite(p.value)}
                    className={[
                      'flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border-[1.5px] font-hanken text-[12.5px] font-bold transition-all duration-200',
                      active
                        ? 'border-[#ff7a1a] bg-[#fff7ed] text-[#0f1a3a] shadow-[0_2px_8px_rgba(255,122,26,0.15)]'
                        : 'border-gray-200 bg-[#fafbfc] text-[#445068] hover:border-[#ff7a1a]/40',
                    ].join(' ')}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: p.dot }} />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5">
              <p className="font-hanken text-[13px] font-semibold text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-12 rounded-[14px] font-hanken font-bold text-[14px] bg-white text-[#0f1a3a] border-[1.5px] border-gray-200 hover:bg-gray-50 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !titre.trim()}
              className="flex-1 h-12 rounded-[14px] font-hanken font-bold text-[14px] text-white bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] shadow-[0_8px_20px_rgba(255,122,26,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin" />
                  Création…
                </span>
              ) : 'Créer le rappel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
