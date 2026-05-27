'use client'

/**
 * Modal de contact utilisateur — 3 types de message :
 *   - bug      : signaler un anomalie
 *   - feature  : suggerer une amelioration
 *   - question : poser une question (besoin d'aide)
 *
 * Le formulaire envoie a /api/contact qui relaie l'email vers
 * contact@nexartis.fr via Brevo (cf. lib/email.ts).
 *
 * Aucune mention du programme "1 bug = 1 mois offert" dans cette UI :
 * decision business (Jeremy) pour eviter les abus.
 */

import { useState, useEffect } from 'react'
import { X, Bug, Lightbulb, HelpCircle, CheckCircle2, Loader2 } from 'lucide-react'

type ContactType = 'bug' | 'feature' | 'question'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type TypeConfig = {
  label: string
  Icon: typeof Bug
  bgClass: string
  borderClass: string
  iconColor: string
  subjectPlaceholder: string
  descPlaceholder: string
}

const TYPE_CONFIG: Record<ContactType, TypeConfig> = {
  bug: {
    label: 'Signaler un bug',
    Icon: Bug,
    bgClass: 'bg-orange/10',
    borderClass: 'border-orange',
    iconColor: 'text-orange',
    subjectPlaceholder: "Ex : Le bouton \"Envoyer le devis\" ne fonctionne pas",
    descPlaceholder: "Decrivez ce qui s'est passe, ce que vous attendiez, et si possible les etapes pour reproduire le bug.",
  },
  feature: {
    label: 'Suggerer une amelioration',
    Icon: Lightbulb,
    bgClass: 'bg-sky/10',
    borderClass: 'border-sky',
    iconColor: 'text-sky',
    subjectPlaceholder: "Ex : Pouvoir dupliquer un devis en un clic",
    descPlaceholder: "Decrivez la fonctionnalite que vous aimeriez voir, et pourquoi elle serait utile pour vous.",
  },
  question: {
    label: 'Poser une question',
    Icon: HelpCircle,
    bgClass: 'bg-gold/10',
    borderClass: 'border-gold',
    iconColor: 'text-gold',
    subjectPlaceholder: "Ex : Comment activer la TVA 5,5 % ?",
    descPlaceholder: "Posez votre question le plus precisement possible. Une reponse personnelle vous sera envoyee par email.",
  },
}

export default function ContactModal({ isOpen, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<ContactType | null>(null)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  // Fermer avec ESC
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isValid =
    selectedType !== null &&
    subject.trim().length >= 3 &&
    subject.length <= 100 &&
    description.trim().length >= 10 &&
    description.length <= 2000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !selectedType || status === 'loading') return

    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          subject: subject.trim(),
          description: description.trim(),
        }),
      })
      if (!res.ok) throw new Error('Erreur serveur')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const handleClose = () => {
    onClose()
    // Reset apres animation de fermeture
    setTimeout(() => {
      setSelectedType(null)
      setSubject('')
      setDescription('')
      setStatus('idle')
    }, 300)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm px-4 py-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-cream rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-navy/40 hover:text-navy transition"
          aria-label="Fermer"
        >
          <X size={24} />
        </button>

        {status === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle2 size={64} className="mx-auto text-green-600 mb-4" />
            <h2 className="font-syne font-bold text-2xl text-navy mb-2">
              Message envoye !
            </h2>
            <p className="font-manrope text-sm text-navy/70 mb-6">
              Une reponse personnelle vous sera envoyee sous 48h sur votre adresse email.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="bg-navy hover:bg-navy-mid text-cream font-semibold rounded-lg py-3 px-6 transition"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h2
              id="contact-modal-title"
              className="font-syne font-bold text-2xl text-navy mb-1"
            >
              Nous contacter
            </h2>
            <p className="font-manrope text-sm text-navy/70 mb-6">
              Choisissez le type de message
            </p>

            <div className="grid grid-cols-1 gap-3 mb-6">
              {(Object.keys(TYPE_CONFIG) as ContactType[]).map((type) => {
                const config = TYPE_CONFIG[type]
                const isSelected = selectedType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`
                      flex items-center gap-3 border-2 rounded-xl p-4 transition text-left
                      ${isSelected
                        ? `${config.bgClass} ${config.borderClass}`
                        : 'border-navy/10 hover:border-navy/30 bg-white'}
                    `}
                  >
                    <config.Icon size={24} className={config.iconColor} />
                    <span className="font-manrope font-medium text-navy">
                      {config.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {selectedType && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block font-manrope text-sm font-medium text-navy/80 mb-1"
                  >
                    Sujet
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={TYPE_CONFIG[selectedType].subjectPlaceholder}
                    maxLength={100}
                    className="w-full bg-white border border-navy/20 rounded-lg p-3 font-manrope text-navy focus:border-sky focus:ring-2 focus:ring-sky/20 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-description"
                    className="block font-manrope text-sm font-medium text-navy/80 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="contact-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={TYPE_CONFIG[selectedType].descPlaceholder}
                    maxLength={2000}
                    rows={6}
                    className="w-full bg-white border border-navy/20 rounded-lg p-3 font-manrope text-navy focus:border-sky focus:ring-2 focus:ring-sky/20 focus:outline-none transition resize-y"
                  />
                  <div className="text-right text-xs text-navy/50 mt-1 font-manrope">
                    {description.length} / 2000
                  </div>
                </div>

                {status === 'error' && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm font-manrope">
                    Impossible d'envoyer votre message. Verifiez votre connexion ou reessayez dans quelques minutes.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isValid || status === 'loading'}
                  className="w-full bg-navy hover:bg-navy-mid disabled:bg-navy/40 disabled:cursor-not-allowed text-cream font-semibold rounded-lg py-3 px-6 transition flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le message'
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
