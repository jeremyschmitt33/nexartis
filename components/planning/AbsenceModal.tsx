'use client'

// -------------------------------------------------------------------
// Formulaire d'ajout d'une indisponibilite (absence) — composant autonome.
// Une absence se pose sur un membre de "Mon equipe" OU sur un nom libre
// (n'importe quel nom), sur une journee, une demi-journee ou une plage de
// vacances. Le composant ne fait que construire le payload et le remonter
// via onSave ; la persistance Supabase est geree par la page planning.
// -------------------------------------------------------------------

import { useState, useEffect } from 'react'
import { X, Loader2, CalendarOff } from 'lucide-react'
import { ABSENCE_TYPES } from '@/lib/planning-absences'

export interface AbsencePayload {
  intervenant_id: string | null
  nom_libre: string | null
  date_debut: string
  date_fin: string
  demi_journee: string | null
  type: string
  motif: string | null
}

interface Props {
  intervenants: { id: string; label: string }[]
  onClose: () => void
  onSave: (payload: AbsencePayload) => void
  saving?: boolean
  // Mode édition : valeurs initiales à pré-remplir (sinon création vierge).
  initial?: { intervenant_id?: string | null; nom_libre?: string | null; date_debut?: string; date_fin?: string; demi_journee?: string | null; type?: string | null; motif?: string | null } | null
  editing?: boolean
}

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function AbsenceModal({ intervenants, onClose, onSave, saving, initial, editing }: Props) {
  const [personId, setPersonId] = useState<string>(initial ? (initial.intervenant_id ?? '__libre__') : (intervenants[0]?.id ?? '__libre__'))
  const [nomLibre, setNomLibre] = useState(initial?.nom_libre ?? '')
  const [dateDebut, setDateDebut] = useState((initial?.date_debut ?? '').slice(0, 10) || todayIso())
  const [dateFin, setDateFin] = useState((initial?.date_fin ?? '').slice(0, 10) || todayIso())
  const [demiJournee, setDemiJournee] = useState<string>(initial?.demi_journee ?? '')
  const [type, setType] = useState(initial?.type ?? 'conge')
  const [motif, setMotif] = useState(initial?.motif ?? '')
  const [error, setError] = useState('')

  // Accessibilité : fermeture au clavier via Échap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isLibre = personId === '__libre__'
  const multiJours = dateFin > dateDebut

  const submit = () => {
    if (isLibre && !nomLibre.trim()) { setError('Indique un nom pour l’absence.'); return }
    if (!dateDebut) { setError('Choisis une date de début.'); return }
    if (dateFin < dateDebut) { setError('La date de fin doit être après le début.'); return }
    setError('')
    onSave({
      intervenant_id: isLibre ? null : personId,
      nom_libre: isLibre ? nomLibre.trim() : null,
      date_debut: dateDebut,
      date_fin: dateFin || dateDebut,
      demi_journee: multiJours ? null : (demiJournee || null),
      type,
      motif: motif.trim() || null,
    })
  }

  const labelCls = 'block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-600 mb-1.5'
  const inputCls = 'w-full rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] py-2.5 px-3.5 font-hanken text-sm text-[#0f1a3a] focus:border-[#ff7a1a] focus:bg-white focus:outline-none'

  return (
    <div className="fixed inset-0 bg-[#0f1a3a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="absence-modal-title" className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* En-tete */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e6ecf2]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff1e6] text-[#ff7a1a]">
              <CalendarOff size={18} />
            </span>
            <h3 id="absence-modal-title" className="font-hanken font-extrabold text-lg text-[#0f1a3a]">{editing ? 'Modifier l’absence' : 'Ajouter une absence'}</h3>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Qui */}
          <div>
            <label className={labelCls}>Personne</label>
            <select autoFocus value={personId} onChange={e => { setPersonId(e.target.value); setError('') }} className={`${inputCls} cursor-pointer`}>
              {intervenants.map(iv => <option key={iv.id} value={iv.id}>{iv.label}</option>)}
              <option value="__libre__">Autre (saisir un nom)…</option>
            </select>
            {isLibre && (
              <>
                <input
                  type="text"
                  value={nomLibre}
                  onChange={e => { setNomLibre(e.target.value); setError('') }}
                  placeholder="Ex : Renfort intérim Paul"
                  className={`${inputCls} mt-2`}
                />
                <p className="mt-1.5 font-hanken text-[11px] text-[#7b8ba3] leading-snug">
                  Ce nom apparaîtra dans la liste « Qui est absent », mais pas dans les lignes du planning (réservées aux membres de l’équipe).
                </p>
              </>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Du</label>
              <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value); setError('') }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Au</label>
              <input type="date" value={dateFin} min={dateDebut} onChange={e => { setDateFin(e.target.value); setError('') }} className={inputCls} />
            </div>
          </div>

          {/* Demi-journee (uniquement si 1 seul jour) */}
          {!multiJours && (
            <div>
              <label className={labelCls}>Durée</label>
              <div className="flex gap-2">
                {[{ v: '', l: 'Journée entière' }, { v: 'matin', l: 'Matin' }, { v: 'apres_midi', l: 'Après-midi' }].map(o => (
                  <button
                    key={o.v || 'jour'}
                    type="button"
                    onClick={() => setDemiJournee(o.v)}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-semibold border-[1.5px] transition-all ${demiJournee === o.v ? 'border-[#ff7a1a] bg-[#fff1e6] text-[#e8590c]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className={labelCls}>Motif</label>
            <select value={type} onChange={e => setType(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {ABSENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Note libre */}
          <div>
            <label className={labelCls}>Note (optionnel)</label>
            <input type="text" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Précision éventuelle…" className={inputCls} />
          </div>

          {error && <p role="alert" className="text-sm font-hanken text-red-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#e6ecf2]">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-hanken font-semibold text-sm text-[#0f1a3a] bg-white border-[1.5px] border-gray-200 hover:bg-gray-50">Annuler</button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-hanken font-bold text-sm text-white bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] shadow-[0_8px_20px_rgba(255,122,26,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarOff size={16} />}
            {editing ? 'Enregistrer les modifications' : 'Enregistrer l’absence'}
          </button>
        </div>
      </div>
    </div>
  )
}
