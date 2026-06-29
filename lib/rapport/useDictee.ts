'use client'

/**
 * useDictee — dictée vocale d'un champ via la reconnaissance vocale du
 * navigateur (Web Speech API). Aucune dépendance, aucun appel serveur Nexartis.
 *
 * - Marche sur Chrome (PC + Android) et Edge. Capricieux sur Safari iOS,
 *   absent sur Firefox -> dans ce cas `supported` vaut false et le bouton micro
 *   ne s'affiche pas (l'astuce "micro du clavier" reste le repli sur mobile).
 * - Langue fr-FR. Le texte FINAL reconnu est renvoyé via onFinalText (à AJOUTER
 *   au champ, pas à écraser — c'est l'appelant qui concatène).
 * - Nécessite une connexion (Chrome envoie l'audio à un service distant) et
 *   l'autorisation micro du navigateur.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => RecognitionLike) | null
}

export function useDictee(onFinalText: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<RecognitionLike | null>(null)
  const onTextRef = useRef(onFinalText)
  onTextRef.current = onFinalText

  const supported = getRecognitionCtor() !== null

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    setError(null)
    const rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    // On ne traite que les résultats FINAUX (pas d'aperçu "qui danse") ; le
    // bouton micro rouge pulsé suffit comme retour visuel pendant la dictée.
    rec.interimResults = false
    rec.onresult = (e) => {
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
      }
      final = final.trim()
      if (final) onTextRef.current(final)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Micro refusé. Autorisez le micro dans la barre d’adresse du navigateur.')
      } else if (e.error === 'no-speech' || e.error === 'aborted') {
        setError(null)
      } else {
        setError('Reconnaissance vocale indisponible (vérifiez votre connexion).')
      }
      setListening(false)
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      setError('Impossible de démarrer le micro.')
    }
  }, [])

  // Arrêt propre au démontage du composant.
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* ignore */ } }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported, listening, error, start, stop, toggle }
}
