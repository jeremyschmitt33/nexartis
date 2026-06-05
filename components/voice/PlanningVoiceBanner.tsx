'use client'
// components/voice/PlanningVoiceBanner.tsx — V3.1
// Banniere affichee en haut de /dashboard/planning quand on arrive avec
// ?voicePayload (= l'utilisateur a dicte un evenement via la commande vocale
// universelle). Affiche un resume + boutons "Creer" / "Ignorer".
// Le bouton "Creer" insere directement dans planning_interventions et recharge.

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, X, Check, Loader2 } from 'lucide-react'

interface PlanningPayload {
  evenement_type?: 'rdv' | 'intervention' | 'livraison' | null
  titre?: string | null
  date_debut?: string | null
  date_fin?: string | null
  duree?: string | null
  client_nom?: string | null
  client_telephone?: string | null
  chantier_adresse?: string | null
  notes?: string | null
}

function decodePayload(encoded: string | null | undefined): PlanningPayload | null {
  if (!encoded) return null
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json) as PlanningPayload
  } catch {
    return null
  }
}

// Convertit "2026-06-09T14:00" ou "JJ/MM/AAAA HH:MM" vers { date: "YYYY-MM-DD", time: "HH:MM" }
function parseDate(input: string | null | undefined): { date: string | null; time: string | null } {
  if (!input) return { date: null, time: null }
  // Format ISO 2026-06-09T14:00
  const iso = input.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{1,2}):(\d{2}))?/)
  if (iso) {
    return { date: iso[1], time: iso[2] ? `${iso[2].padStart(2, '0')}:${iso[3]}` : null }
  }
  // Format JJ/MM/AAAA HH:MM
  const fr = input.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (fr) {
    return {
      date: `${fr[3]}-${fr[2]}-${fr[1]}`,
      time: fr[4] ? `${fr[4].padStart(2, '0')}:${fr[5]}` : null,
    }
  }
  return { date: null, time: null }
}

function addOneHour(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + 60
  const newH = Math.floor((total / 60) % 24)
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

const EVENT_LABELS: Record<string, string> = {
  rdv: 'Rendez-vous',
  intervention: 'Intervention chantier',
  livraison: 'Livraison',
}

export default function PlanningVoiceBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [payload, setPayload] = useState<PlanningPayload | null>(null)
  const [hidden, setHidden] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const decoded = decodePayload(searchParams.get('voicePayload'))
    if (decoded) setPayload(decoded)
  }, [searchParams])

  const handleCreate = useCallback(async () => {
    if (!payload) return
    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Tu n es plus connecte, recharge la page')
        setSubmitting(false)
        return
      }

      const { date, time } = parseDate(payload.date_debut)
      const finParsed = parseDate(payload.date_fin)
      const startTime = time || '09:00'
      const endTime = finParsed.time || addOneHour(startTime) || '10:00'
      const startDate = date || new Date().toISOString().slice(0, 10)
      const endDate = finParsed.date || startDate

      const titreFinal = payload.titre
        || (payload.client_nom ? `${EVENT_LABELS[payload.evenement_type || 'rdv']} chez ${payload.client_nom}` : EVENT_LABELS[payload.evenement_type || 'rdv'])

      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        titre: titreFinal,
        description_travaux: titreFinal,
        date_debut: `${startDate}T${startTime}:00`,
        date_fin: `${endDate}T${endTime}:00`,
        heure_debut: startTime,
        heure_fin: endTime,
        creneau: 'creneau',
        statut: 'planifie',
        type_intervention: payload.evenement_type || 'rdv',
        client_libre: payload.client_nom || null,
        client_libre_telephone: payload.client_telephone || null,
        client_libre_adresse: payload.chantier_adresse || null,
        chantier_libre: payload.chantier_adresse || null,
        notes: payload.notes || null,
      }

      const { error: insertErr } = await supabase
        .from('planning_interventions')
        .insert(insertPayload)

      if (insertErr) {
        setError(`Erreur creation : ${insertErr.message}`)
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setSubmitting(false)
      // Nettoyer l'URL pour eviter doublon si l'utilisateur recharge
      setTimeout(() => {
        router.replace('/dashboard/planning')
        router.refresh()
      }, 1000)
    } catch (e) {
      const err = e as Error
      setError(err.message || 'Erreur inconnue')
      setSubmitting(false)
    }
  }, [payload, router])

  const handleDismiss = () => {
    setHidden(true)
    router.replace('/dashboard/planning')
  }

  if (!payload || hidden) return null

  const { date: parsedDate, time: parsedTime } = parseDate(payload.date_debut)
  const dateDisplay = parsedDate
    ? new Date(`${parsedDate}T${parsedTime || '00:00'}:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date non precisee'

  return (
    <div className="bg-gradient-to-r from-sky/15 to-sky/5 border-y border-sky/30 px-4 py-3 print:hidden">
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-sky/20 flex items-center justify-center">
          <Calendar size={20} className="text-sky" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-syne font-bold text-sm sm:text-base text-navy">
              {EVENT_LABELS[payload.evenement_type || 'rdv']} detecte par la voix
            </p>
            <span className="text-[10px] font-manrope font-semibold text-sky-dark bg-sky/15 px-2 py-0.5 rounded-full uppercase tracking-wide">Vocal</span>
          </div>
          <p className="text-sm font-manrope text-navy/80 leading-snug">
            <strong className="font-semibold">{payload.titre || (payload.client_nom ? `Chez ${payload.client_nom}` : 'Sans titre')}</strong>
            {' — '}
            <span>{dateDisplay}</span>
            {parsedTime && <span> a <strong>{parsedTime}</strong></span>}
            {payload.chantier_adresse && <span>, {payload.chantier_adresse}</span>}
          </p>
          {error && (
            <p className="text-xs font-manrope text-red-600 mt-1">{error}</p>
          )}
          {success && (
            <p className="text-xs font-manrope text-green-700 mt-1 font-semibold">Evenement cree, rafraichissement...</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || success}
            className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl bg-sky hover:bg-sky-dark disabled:bg-gray-300 text-white font-manrope font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
            {submitting ? 'Creation...' : success ? 'Cree' : 'Creer'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-navy/15 hover:border-navy/30 text-navy/60 transition-all active:scale-95"
            aria-label="Ignorer cet evenement"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
