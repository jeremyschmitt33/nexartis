'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Plus, ArrowLeft, Mic, MicOff, X } from 'lucide-react'
import { useClients, useChantiers, useEntreprise, usePointsCollecte, usePrestations, insertRow, LoadingSkeleton } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { computeHierarchicalNumbers } from '@/lib/numerotation'
import { isAutoEntrepreneur } from '@/lib/helpers'
import { buildSuggestions, memorizePrestations } from '@/lib/prestations-memo'
import { mergeCatalogueSuggestions } from '@/lib/catalogue'
import LineCard from '@/components/mobile/LineCard'
import LineSheet, { type SheetLine } from '@/components/mobile/LineSheet'
import LineStatutSelect, { type InclusionStatut, inclusionToDb } from '@/components/devis/LineStatut'
import DesignationAutocomplete from '@/components/DesignationAutocomplete'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface LineItem {
  id: number
  designation: string
  qty: number
  unit: string
  priceHT: number
  tva: number
  type: 'line' | 'section' | 'subsection' | 'text'
  // Statut d'inclusion : ferme (toujours inclus) / facultatif (le client peut retirer) / option (le client peut ajouter)
  inclusion: InclusionStatut
}

interface ClientRecord { id: string; nom: string; prenom?: string; adresse?: string; telephone?: string; email?: string; code_postal?: string; ville?: string }
interface ChantierRecord { id: string; titre: string; description?: string }

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const UNIT_SUGGESTIONS = ['U', 'm²', 'm', 'ml', 'cm', 'kg', 't', 'h', 'jour', 'demi-journée', 'forfait', 'ensemble', 'lot', 'm³']
const TVA_RATES = [0, 5.5, 10, 20]

// Liste de prestations intégrées (toujours disponibles, même sans données en base)
const PRESTATIONS_INTEGREES = [
  'Installation tableau électrique', 'Remplacement tableau électrique', 'Mise aux normes électriques',
  'Installation prises de courant', 'Installation interrupteurs', 'Câblage / tirage de câbles',
  'Installation éclairage intérieur', 'Installation éclairage extérieur', 'Pose spots encastrés',
  'Installation VMC (ventilation)', 'Installation chauffe-eau électrique', 'Installation radiateurs électriques',
  'Domotique / automatisation', 'Borne de recharge véhicule électrique', 'Mise à la terre',
  'Diagnostic électrique', 'Installation alarme / sécurité', 'Sonette / interphone / visiophone',
  'Installation sanitaires (WC, lavabo, douche)', 'Remplacement robinetterie', 'Débouchage canalisations',
  'Réparation fuite d\'eau', 'Installation chauffe-eau', 'Remplacement chaudière',
  'Construction mur / cloison', 'Démolition mur / cloison', 'Ouverture de mur porteur',
  'Coulage dalle béton', 'Ragréage sol', 'Enduit / crépi extérieur', 'Isolation thermique',
  'Pose fenêtres double vitrage', 'Pose porte d\'entrée', 'Pose porte intérieure',
  'Installation volets roulants', 'Pose parquet', 'Construction terrasse bois', 'Pose pergola',
  'Peinture intérieure', 'Peinture extérieure', 'Pose papier peint', 'Pose carrelage / faïence',
  'Ravalement de façade', 'Travaux de plomberie générale', 'Travaux de charpente',
  'Fourniture et pose de matériel', 'Main d\'œuvre', 'Déplacement et frais de chantier',
  'Nettoyage fin de chantier', 'Dépose / évacuation gravats', 'Visite et diagnostic',
  'Salle de bain', 'Cuisine', 'Rénovation complète', 'Mise en conformité',
]

const PAYMENT_OPTIONS = [
  { id: 'p30', label: '30% à la commande, solde à la réception' },
  { id: 'p50', label: '50% à la commande, solde à la réception' },
  { id: 'comptant', label: 'Paiement comptant à la réception' },
  { id: 'j30', label: 'Paiement à 30 jours' },
  { id: 'reception', label: 'Paiement à réception de facture' },
  { id: 'virement', label: 'Virement bancaire uniquement' },
  { id: 'cheque', label: 'Chèque accepté' },
  { id: 'penalites', label: 'Pénalités de retard : 3 fois le taux légal' },
]

let nextId = 100

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// SIREN = 9 chiffres (minimum legal), SIRET = 14 chiffres (SIREN + etablissement).
// On accepte les DEUX. Champ vide autorise (tant qu'on n'enregistre pas).
// Retourne un message d'erreur si invalide, sinon null.
function validateClientSiret(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 0 || digits.length === 9 || digits.length === 14) return null
  return `Numéro invalide : un SIREN fait 9 chiffres, un SIRET 14 (vous avez saisi ${digits.length}).`
}

// V4 : style input partagé sur cette page — bordure 1.5px, bg #fafbfc, focus halo orange
const inputCls = 'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4] placeholder:text-gray-400 focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200'

// -------------------------------------------------------------------
// Voice Modal — V3.0e Vague 1
// Refonte : MediaRecorder + /api/voice-devis-v2 (Gemini 2.5 Flash).
// Pourquoi MediaRecorder vs Web Speech API :
//   - Web Speech API ne fonctionne pas sur iPhone Safari (bug Apple connu).
//   - Web Speech API est limitee a Chrome desktop + Android Chrome.
//   - MediaRecorder est supporte partout (iOS 14.5+, Android, desktop).
//   - L'audio est ensuite traite cote serveur par Gemini multimodal qui fait
//     transcription + extraction structuree en UN seul appel API.
// -------------------------------------------------------------------

function VoiceModal({ open, onClose, onResult }: {
  open: boolean
  onClose: () => void
  onResult: (data: Record<string, unknown>) => void
}) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Limite de duree d enregistrement (cote client) — au-dela on coupe automatiquement.
  // 2 minutes suffisent largement pour dicter un devis BTP courant.
  const MAX_RECORDING_SEC = 120

  // Verifier le support MediaRecorder (devrait etre dispo partout en 2026, mais filet
  // de securite si l artisan a un vieux navigateur).
  const supported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'

  // Cleanup : si le composant ferme pendant un enregistrement, on stoppe tout.
  useEffect(() => {
    if (!open) {
      cleanup()
      resetState()
    }
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function cleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch { /* deja stoppe */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function resetState() {
    setRecording(false)
    setProcessing(false)
    setError(null)
    setElapsedSec(0)
    setAudioBlob(null)
    audioChunksRef.current = []
  }

  // Choisit le meilleur format audio supporte par le navigateur (Safari = mp4/aac,
  // Chrome/Firefox = webm/opus). Gemini accepte les deux via inlineData.
  function pickMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ]
    for (const t of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
    }
    return '' // laisse le browser choisir
  }

  async function startRecording() {
    setError(null)
    resetState()
    try {
      // V3.0e.1 fix : contraintes audio en mode "ideal" (non-strict). Certains
      // Chrome Android refusent sampleRate/channelCount stricts et throw
      // OverconstrainedError AVANT de demander la permission — d'ou les rapports
      // utilisateur "Acces au micro refuse" sans aucun popup natif. On laisse
      // le navigateur choisir les meilleurs reglages dispos.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 32_000 })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }

      recorder.start(250) // collecte des chunks toutes les 250ms (smooth)
      setRecording(true)

      // Timer + auto-stop a 2 minutes
      timerRef.current = setInterval(() => {
        setElapsedSec(prev => {
          const next = prev + 1
          if (next >= MAX_RECORDING_SEC) {
            stopRecording()
            return MAX_RECORDING_SEC
          }
          return next
        })
      }, 1000)
    } catch (err) {
      const e = err as Error & { name?: string }
      // V3.0e.1 : logs detailles cote console pour debug — n'expose pas le user
      // a la stacktrace mais on a l'info en F12 si on doit investiguer.
      console.error('[voice] getUserMedia error:', e.name, '|', e.message, '|', err)
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Accès au micro refusé. Touche les 3 points ⋮ Chrome → Infos du site → Microphone → Autoriser, puis recharge la page.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setError('Aucun microphone détecté sur cet appareil.')
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        setError('Le microphone est utilisé par une autre application. Ferme les autres apps qui pourraient l\'utiliser et réessaie.')
      } else if (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError') {
        setError('Ton micro ne supporte pas les réglages demandés. Recharge la page (ce bug devrait être corrigé après le prochain déploiement).')
      } else if (e.name === 'AbortError') {
        setError('Démarrage du micro interrompu. Réessaie.')
      } else if (e.name === 'SecurityError') {
        setError('Erreur de sécurité : assure-toi d\'être sur https://nexartis.fr (et pas http).')
      } else {
        setError(`Erreur micro (${e.name || 'inconnue'}) : ${e.message || 'pas de détail'}`)
      }
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop() } catch { /* ignore */ }
    }
    setRecording(false)
  }

  async function handleSubmit() {
    if (!audioBlob) return
    setProcessing(true)
    setError(null)
    try {
      const formData = new FormData()
      // Suffixe en fonction du mimeType pour aider le serveur a deviner
      const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
      formData.append('audio', audioBlob, `devis-vocal.${ext}`)

      const res = await fetch('/api/voice-devis-v2', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let msg = `Erreur serveur (${res.status})`
        try {
          const errJson = await res.json()
          if (errJson?.error) msg = errJson.error
        } catch { /* pas de JSON */ }
        setError(msg)
        setProcessing(false)
        return
      }

      const data = await res.json()
      if (data._warnings && Array.isArray(data._warnings) && data._warnings.length > 0) {
        // L'IA a renvoye du JSON partiellement invalide — on pré-remplit quand meme
        // mais on previent l'artisan que certains champs sont a verifier.
        console.warn('[voice] champs avec avertissement:', data._warnings)
      }
      onResult(data)
      onClose()
    } catch {
      setError('Erreur reseau. Vérifie ta connexion et réessaie.')
    }
    setProcessing(false)
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 sm:p-8 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-hanken font-bold text-xl text-navy">Dictée vocale</h3>
            <p className="text-xs font-hanken text-gray-500 mt-1">Décris ton devis à voix haute, l&apos;IA pré-remplit les champs.</p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 hover:bg-gray-100 rounded-lg" aria-label="Fermer"><X size={20} /></button>
        </div>

        {!supported ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-hanken text-red-700">Ton navigateur ne supporte pas l&apos;enregistrement audio. Mets-le à jour ou utilise Chrome/Safari récent.</p>
          </div>
        ) : (
          <>
            {/* Gros bouton micro central — taille gants-friendly 88px */}
            <div className="flex flex-col items-center mb-6">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                aria-label={recording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  recording
                    ? 'bg-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.2)] animate-pulse'
                    : processing
                      ? 'bg-gray-300 cursor-wait'
                      : 'bg-gradient-to-br from-orange to-orange-hover shadow-[0_10px_24px_-6px_rgba(232,122,42,0.5)] hover:scale-105'
                }`}
              >
                {recording ? (
                  <MicOff size={36} className="text-white" />
                ) : (
                  <Mic size={36} className="text-white" />
                )}
              </button>

              <div className="mt-4 text-center min-h-[48px]">
                {recording ? (
                  <>
                    <p className="font-hanken font-bold text-2xl text-red-500 tabular-nums">{formatTime(elapsedSec)}</p>
                    <p className="text-xs font-hanken text-gray-500 mt-0.5">Parle maintenant — touche le micro pour stopper</p>
                  </>
                ) : audioBlob ? (
                  <>
                    <p className="font-hanken font-bold text-lg text-navy">Enregistrement prêt ({formatTime(elapsedSec)})</p>
                    <p className="text-xs font-hanken text-gray-500 mt-0.5">Clique sur « Analyser » ou ré-enregistre</p>
                  </>
                ) : (
                  <p className="text-sm font-hanken text-gray-500">Touche le micro pour commencer</p>
                )}
              </div>
            </div>

            {/* Conseil */}
            {!recording && !audioBlob && !error && (
              <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#fff5ec', border: '1px solid #ffeadb' }}>
                <p className="text-xs font-hanken leading-relaxed" style={{ color: '#0f1a3a' }}>
                  <strong className="font-bold">Exemple : </strong>
                  « Devis pour Madame Aude Rouyer, 230 allée des merles, 33480 Sainte-Hélène. Pose de 25 mètres linéaires de clôture rigide gris anthracite à 195 euros le mètre. Acompte 30 pour cent. »
                </p>
              </div>
            )}

            {/* Etat traitement Gemini */}
            {processing && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: '#fff5ec', border: '1px solid #ffeadb' }}>
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#ff7a1a', borderTopColor: 'transparent' }} />
                <p className="text-sm font-hanken" style={{ color: '#0f1a3a' }}>L&apos;IA analyse ta dictée et pré-remplit les champs...</p>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm font-hanken text-red-700 flex items-start gap-2">
                  <span aria-hidden>⚠</span>
                  <span>{error}</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-between items-center">
              <button
                onClick={onClose}
                disabled={processing}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-hanken font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              {audioBlob && !recording && (
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="h-11 px-6 rounded-xl bg-gradient-to-br from-orange to-orange-hover text-white text-sm font-hanken font-bold shadow-[0_6px_16px_-4px_rgba(232,122,42,0.45)] disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {processing ? 'Analyse...' : 'Analyser et pré-remplir'}
                </button>
              )}
            </div>

            {/* Mention RGPD discrete */}
            <p className="text-[10.5px] font-hanken text-gray-400 mt-4 text-center leading-relaxed">
              Audio traité par Google Gemini pour transcription et extraction, puis supprimé. Pas de stockage permanent.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function NouveauDevisPageWrapper() {
  return <Suspense fallback={<div className="p-6"><LoadingSkeleton rows={8} /></div>}><NouveauDevisPage /></Suspense>
}

function NouveauDevisPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: clientsRaw, loading: loadingClients } = useClients()
  const { data: chantiersRaw } = useChantiers()
  const { entreprise } = useEntreprise()
  const { data: pointsCollecteRaw } = usePointsCollecte()
  const { data: prestationsRows } = usePrestations()
  const prestationSuggestions = useMemo(
    () => mergeCatalogueSuggestions(buildSuggestions(prestationsRows), (entreprise as { metier?: string } | null | undefined)?.metier),
    [prestationsRows, entreprise],
  )
  const clients = clientsRaw as unknown as ClientRecord[]
  const chantiers = chantiersRaw as unknown as ChantierRecord[]
  const pointsCollecte = pointsCollecteRaw as unknown as { id: string; nom: string; adresse?: string; type_installation?: string }[]

  // Client fields (free text)
  const [clientCivilite, setClientCivilite] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [clientPrenom, setClientPrenom] = useState('')
  const [clientSiret, setClientSiret] = useState('')
  // SIREN (9 chiffres) OU SIRET (14 chiffres) : tout autre nombre = invalide.
  const [clientSiretError, setClientSiretError] = useState<string | null>(null)
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientCodePostal, setClientCodePostal] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [clientSuggestions, setClientSuggestions] = useState<ClientRecord[]>([])
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  // Chantier (free text + autocomplete)
  const [chantierDesc, setChantierDesc] = useState('')
  const [chantierSuggestions, setChantierSuggestions] = useState<string[]>([])
  const [chantierDropdownOpen, setChantierDropdownOpen] = useState(false)

  // Lines
  const [lines, setLines] = useState<LineItem[]>([])
  const [autoEntrepreneur, setAutoEntrepreneur] = useState(false)
  const [globalTvaRate, setGlobalTvaRate] = useState(10)

  // Auto-cocher la TVA 0 si l'entreprise est en franchise (micro-entrepreneur / EI / auto-entrepreneur).
  // Source de vérité unique : helper isAutoEntrepreneur (lib/helpers.ts).
  // Pré-remplissage : si franchise → autoEntrepreneur=true ET globalTvaRate=0.
  // L'artisan peut malgré tout repasser à 10/20% (cas dépassement seuil de franchise).
  useEffect(() => {
    if (isAutoEntrepreneur(entreprise)) {
      setAutoEntrepreneur(true)
      setGlobalTvaRate(0)
    }
  }, [entreprise])
  const [useForfait, setUseForfait] = useState(false)
  const [forfaitHT, setForfaitHT] = useState(0)

  // Dates
  const [dateDevis, setDateDevis] = useState(new Date().toISOString().slice(0, 10))
  const [dateValidite, setDateValidite] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })
  const [dateTravaux, setDateTravaux] = useState('')
  const [duree, setDuree] = useState('')

  // Conditions
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set(['p30']))
  const [acomptePercent, setAcomptePercent] = useState('')
  const [conditionsLibres, setConditionsLibres] = useState('')
  const [notes, setNotes] = useState('')

  // Gestion des déchets (loi AGEC — 4 mentions obligatoires)
  const [dechetsNature, setDechetsNature] = useState('Déchets non dangereux (câbles, emballages)')
  const [dechetsQuantite, setDechetsQuantite] = useState('')
  const [dechetsResponsable, setDechetsResponsable] = useState('L\'entreprise')
  const [dechetsTri, setDechetsTri] = useState('Tri sur le chantier')
  const [dechetsCollecteNom, setDechetsCollecteNom] = useState('')
  const [dechetsCollecteAdresse, setDechetsCollecteAdresse] = useState('')
  const [dechetsCollecteType, setDechetsCollecteType] = useState('Déchetterie')
  const [dechetsCout, setDechetsCout] = useState('')
  const [dechetsInclureCout, setDechetsInclureCout] = useState(false)
  // Gestion des déchets (loi AGEC) : DÉCOCHÉE par défaut sur chaque nouveau devis.
  // L'artisan coche la case uniquement s'il veut déclarer ses déchets. Décision
  // 09/07 : pas de réglage dans les paramètres. Quand décochée, la section
  // n'apparaît pas dans le PDF (gating afficher_dechets côté routes download/send).
  const [afficherDechets, setAfficherDechets] = useState(false)
  const [dechetteriesProches, setDechetteriesProches] = useState<{nom:string;adresse:string;code_postal:string;commune:string;distance_km:number;accepte_pro:string;accepte_construction:boolean;accepte_deee:boolean}[]>([])
  const [loadingDechetteries, setLoadingDechetteries] = useState(false)

  // UI state
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)

  // --- Auto-open voice modal from URL ---
  useEffect(() => {
    if (searchParams.get('voice') === '1') setVoiceOpen(true)
  }, [searchParams])

  // --- V3.1 : Lecture du payload de la commande vocale universelle ---
  // L'utilisateur a dicte depuis n'importe ou via UniversalVoiceButton, l'API
  // /api/voice-command a detecte intent=devis, le VoiceResultScreen a redirige
  // ici avec ?voicePayload=base64(JSON). On decode et on pre-remplit.
  useEffect(() => {
    const encoded = searchParams.get('voicePayload')
    if (!encoded) return
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4) b64 += '='
      const json = decodeURIComponent(escape(atob(b64)))
      const data = JSON.parse(json) as Record<string, unknown>
      handleVoiceResult(data)
    } catch (e) {
      console.warn('[devis/nouveau] voicePayload decode error:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Chargement des déchetteries proches (API ADEME) ---
  useEffect(() => {
    if (!entreprise) return
    const cp = (entreprise as Record<string, unknown>).code_postal as string
    if (!cp) return
    setLoadingDechetteries(true)
    fetch(`/api/dechetteries?cp=${encodeURIComponent(cp)}`)
      .then(r => r.json())
      .then(data => {
        if (data.dechetteries) setDechetteriesProches(data.dechetteries)
      })
      .catch(() => { /* ignore — on retombe sur la saisie manuelle */ })
      .finally(() => setLoadingDechetteries(false))
  }, [entreprise])

  // --- Auto-entrepreneur toggle ---
  useEffect(() => {
    if (autoEntrepreneur) {
      setLines(prev => prev.map(l => ({ ...l, tva: 0 })))
      setGlobalTvaRate(0)
    }
  }, [autoEntrepreneur])

  // --- Line operations ---
  function updateLine(id: number, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)))
  }
  function removeLine(id: number) { setLines(prev => prev.filter(l => l.id !== id)) }
  // Calcule le sous-total d'une section ou sous-section : somme des lignes
  // qui suivent jusqu'a la prochaine section/sous-section de meme niveau ou superieur.
  function computeSubtotal(idx: number): number {
    const current = lines[idx]
    if (!current || (current.type !== 'section' && current.type !== 'subsection')) return 0
    let subtotal = 0
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i]
      if (current.type === 'section' && l.type === 'section') break
      if (current.type === 'subsection' && (l.type === 'section' || l.type === 'subsection')) break
      if (l.type === 'line') subtotal += l.qty * l.priceHT
    }
    return subtotal
  }

  function addLine(type: 'line' | 'section' | 'subsection' | 'text' = 'line') {
    setLines(prev => [...prev, {
      id: nextId++,
      designation: '',
      qty: type === 'line' ? 1 : 0,
      unit: 'U',
      priceHT: 0,
      tva: autoEntrepreneur ? 0 : 10,
      type,
      inclusion: 'ferme',
    }])
  }

  // ── Bottom sheet mobile (saisie/édition d'une ligne) ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLine, setSheetLine] = useState<LineItem | null>(null)
  const [sheetDefaultType, setSheetDefaultType] = useState<'line' | 'section' | 'subsection' | 'text'>('line')

  const openCreateSheet = (type: 'line' | 'section' | 'subsection' | 'text' = 'line') => {
    setSheetLine(null)
    setSheetDefaultType(type)
    setSheetOpen(true)
  }
  const openEditSheet = (line: LineItem) => {
    setSheetLine(line)
    setSheetDefaultType(line.type)
    setSheetOpen(true)
  }

  const handleSheetSave = (payload: SheetLine) => {
    if (sheetLine) {
      setLines(prev => prev.map(l => l.id === sheetLine.id ? {
        ...l,
        designation: payload.designation,
        qty: payload.qty,
        unit: payload.unit || l.unit,
        priceHT: payload.priceHT,
        type: payload.type,
        inclusion: payload.inclusion ?? l.inclusion,
      } : l))
    } else {
      setLines(prev => [...prev, {
        id: nextId++,
        designation: payload.designation,
        qty: payload.qty,
        unit: payload.unit || 'U',
        priceHT: payload.priceHT,
        tva: autoEntrepreneur ? 0 : 10,
        type: payload.type,
        inclusion: payload.inclusion ?? 'ferme',
      }])
    }
  }
  const handleSheetSaveAndNew = (payload: SheetLine) => {
    handleSheetSave(payload)
    setSheetLine(null)
    setSheetDefaultType('line')
    setSheetOpen(false)
    setTimeout(() => setSheetOpen(true), 50)
  }

  // --- Computations ---
  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  let totalHT = 0

  const effectiveTva = autoEntrepreneur ? 0 : globalTvaRate

  if (useForfait) {
    totalHT = forfaitHT
    // Mode forfait : on retombe sur le taux global (parite ancienne logique)
    if (effectiveTva > 0) {
      tvaGroups[effectiveTva] = { ht: totalHT, tva: totalHT * (effectiveTva / 100) }
    }
  } else {
    // V2.5 — TVA par ligne (parite Obat) : agregation par taux saisi sur chaque ligne
    lines.forEach(l => {
      if (l.type !== 'line') return
      // Les lignes "Option +" ne sont pas comptees dans le total principal
      // (elles sont proposees en plus ; le client peut les ajouter a la signature).
      if (l.inclusion === 'option') return
      const lineTotal = l.qty * l.priceHT
      totalHT += lineTotal
      const taux = autoEntrepreneur ? 0 : (l.tva ?? 0)
      if (taux > 0) {
        if (!tvaGroups[taux]) tvaGroups[taux] = { ht: 0, tva: 0 }
        tvaGroups[taux].ht += lineTotal
        tvaGroups[taux].tva += lineTotal * (taux / 100)
      }
    })
  }

  const totalTVA = Object.values(tvaGroups).reduce((s, g) => s + g.tva, 0)
  const dechetsCoutNum = dechetsCout ? parseFloat(dechetsCout) : 0
  const totalTTC = totalHT + totalTVA + (dechetsInclureCout ? dechetsCoutNum : 0)
  const acomptePct = (() => {
    if (selectedPayments.has('p30')) return 30
    if (selectedPayments.has('p50')) return 50
    if (selectedPayments.has('acompte') && acomptePercent) return parseFloat(acomptePercent)
    return 0
  })()
  const acompteMontant = acomptePct > 0 ? totalTTC * (acomptePct / 100) : 0
  const resteAPayer = totalTTC - acompteMontant

  // --- Build conditions string ---
  const conditionsStr = [
    ...Array.from(selectedPayments).map(id => {
      if (id === 'acompte') return `Acompte de ${acomptePercent || '...'}%`
      return PAYMENT_OPTIONS.find(p => p.id === id)?.label || ''
    }).filter(Boolean),
    conditionsLibres,
  ].filter(Boolean).join('\n')

  const handleSave = useCallback(async (action: 'brouillon' | 'enregistrer' | 'envoyer') => {
    // Blocage : client Societe + SIREN/SIRET non vide mais invalide (ni 9 ni 14 chiffres).
    // On ne bloque PAS si le champ est vide (enregistrement possible sans identifiant).
    if (clientCivilite === 'Société') {
      const siretMsg = validateClientSiret(clientSiret)
      if (siretMsg) {
        setClientSiretError(siretMsg)
        setError(siretMsg)
        return
      }
    }
    setSaving(true)
    setError(null)

    // Map action to statut values matching the DB CHECK constraint.
    // IMPORTANT : 'envoye' n'est attribué QUE quand l'email est réellement envoyé,
    // pas au moment de la sauvegarde. "Enregistrer" et "Envoyer" depuis ce formulaire
    // créent un devis 'finalise' (= prêt à être envoyé). Le passage à 'envoye'
    // se fait depuis l'API /api/send-devis quand le mail part vraiment.
    const statutMap = { brouillon: 'brouillon', enregistrer: 'finalise', envoyer: 'finalise' } as const
    const statut = statutMap[action]

    // Generate devis number: D-YYYY-NNNNN
    const now = new Date()
    const numero = `D-${now.getFullYear()}-${String(Date.now()).slice(-5)}`

    try {
      const clientDisplay = `${clientCivilite ? clientCivilite + ' ' : ''}${clientPrenom ? clientPrenom + ' ' : ''}${clientNom || ''}`.trim()
      const devisData: Record<string, unknown> = {
        numero,
        statut,
        date_emission: dateDevis,
        date_validite: dateValidite,
        date_debut_travaux: dateTravaux || null,
        duree_estimee: duree || null,
        objet: chantierDesc || null,
        description: chantierDesc || null,
        conditions_paiement: conditionsStr,
        // V2 : le champ libre est désormais des "notes personnalisées" (visibles client),
        // pour rester cohérent avec la facture (parité devis/facture).
        notes_personnalisees: notes || null,
        notes_internes: null, // déprécié — on n'écrit plus dans la colonne legacy
        notes_client: `${clientDisplay}${clientAdresse ? ` | ${clientAdresse}` : ''}${clientCodePostal || clientVille ? ` | ${clientCodePostal} ${clientVille}`.trim() : ''}${clientTelephone ? ` | ${clientTelephone}` : ''}${clientEmail ? ` | ${clientEmail}` : ''}`.trim() || null,
        acompte_pourcent: acomptePct > 0 ? acomptePct : null,
        montant_ht: totalHT,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        dechets_nature: dechetsNature || null,
        dechets_quantite: dechetsQuantite || null,
        dechets_responsable: dechetsResponsable || null,
        dechets_tri: dechetsTri || null,
        dechets_collecte_nom: dechetsCollecteNom || null,
        dechets_collecte_adresse: dechetsCollecteAdresse || null,
        dechets_collecte_type: dechetsCollecteType || null,
        dechets_cout: dechetsCout ? parseFloat(dechetsCout) : null,
        dechets_inclure_cout: dechetsInclureCout,
        afficher_dechets: afficherDechets,
        client_id: null,
        chantier_id: null,
      }
      const devis = await insertRow('devis', devisData)
      // Pre-calcul de la numerotation hierarchique (1, 1.1, 1.1.1, etc.)
      const lignesPourNumero = lines
        .filter(l => l.type === 'line' || !!l.designation)
        .map(l => ({
          type: (l.type === 'section' ? 'section' : l.type === 'subsection' ? 'sous_section' : l.type === 'text' ? 'commentaire' : 'prestation') as 'section' | 'sous_section' | 'prestation' | 'commentaire',
          _orig: l,
        }))
      const lignesAvecNumero = computeHierarchicalNumbers(lignesPourNumero)
      for (let i = 0; i < lignesAvecNumero.length; i++) {
        const item = lignesAvecNumero[i]
        const l = item._orig as typeof lines[0]
        const dbType = item.type
        const dbNiveau = dbType === 'section' ? 1 : dbType === 'sous_section' ? 2 : 3
        await insertRow('devis_lignes', {
          devis_id: (devis as { id: string }).id,
          designation: l.designation,
          quantite: l.qty,
          unite: l.unit,
          prix_unitaire_ht: l.priceHT,
          // V2.5 — TVA par ligne : on persiste le taux saisi sur la ligne.
          // En mode AE, on force 0. En mode forfait, on retombe sur effectiveTva.
          taux_tva: autoEntrepreneur ? 0 : (useForfait ? effectiveTva : (l.tva ?? effectiveTva)),
          ordre: i + 1,
          type: dbType,
          niveau: dbNiveau,
          numero: item.numero || null,
          // Statut d'inclusion : seules les vraies prestations peuvent etre facultatives/options.
          ...(dbType === 'prestation' ? inclusionToDb(l.inclusion) : { optionnel: false, inclus_par_defaut: true }),
        })
      }
      // Mémorisation auto des prestations (best-effort, ne bloque jamais le succès)
      await memorizePrestations(lines.map(l => ({ designation: l.designation, unit: l.unit, priceHT: l.priceHT, tva: (l as { tva?: number }).tva, type: l.type })))
      // Sauvegarder/mettre à jour le client + chantier dans la base de données et lier au devis
      const devisId = (devis as { id: string }).id
      let clientId: string | null = null
      let chantierID: string | null = null

      if (clientNom.trim() || chantierDesc.trim()) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            // Sauvegarder le client
            if (clientNom.trim()) {
              const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .eq('user_id', user.id)
                .ilike('nom', clientNom.trim())
                .maybeSingle()
              const clientData: Record<string, unknown> = {
                nom: clientNom.trim(),
                prenom: clientPrenom.trim() || null,
                adresse: clientAdresse || null,
                code_postal: clientCodePostal || null,
                ville: clientVille || null,
                telephone: clientTelephone || null,
                email: clientEmail || null,
                user_id: user.id,
              }
              // Ajouter civilite seulement si la valeur est définie
              if (clientCivilite) clientData.civilite = clientCivilite
              // Client professionnel (Societe) : on persiste type + SIRET pour la
              // facturation electronique B2B. Sinon on retombe sur 'particulier'.
              const isPro = clientCivilite === 'Société'
              clientData.type = isPro ? 'professionnel' : 'particulier'
              if (isPro) clientData.siret = clientSiret.trim() || null
              if (!existing) {
                const { data: newClient, error: insertErr } = await supabase.from('clients').insert({ ...clientData, actif: true }).select('id').single()
                if (insertErr) console.error('Erreur sauvegarde client:', insertErr.message)
                else if (newClient) clientId = newClient.id
              } else {
                const { error: updateErr } = await supabase.from('clients').update(clientData).eq('id', existing.id)
                if (updateErr) console.error('Erreur mise à jour client:', updateErr.message)
                else clientId = existing.id
              }
            }
            // RATTACHEMENT INTELLIGENT AU CHANTIER (Option A)
            // Logique métier : 1 client = 1 chantier OUVERT qui regroupe tous ses devis.
            //  - Si le client a déjà un chantier ouvert (prospection/signe/en_cours),
            //    on RATTACHE le devis à ce chantier (plus de doublons)
            //  - Sinon on en crée un nouveau (titre = chantierDesc OU nom client)
            if (clientId) {
              // 1. Chercher un chantier ouvert pour ce client
              const { data: existingChantier } = await supabase
                .from('chantiers')
                .select('id, montant_devis_total')
                .eq('user_id', user.id)
                .eq('client_id', clientId)
                .in('statut', ['prospection', 'signe', 'en_cours'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (existingChantier) {
                // RATTACHEMENT : on additionne le montant TTC au total du chantier
                chantierID = existingChantier.id
                const nouveauTotal = Number(existingChantier.montant_devis_total || 0) + totalTTC
                await supabase.from('chantiers').update({
                  montant_devis_total: nouveauTotal,
                }).eq('id', chantierID)
              } else {
                // CRÉATION : titre intelligent (saisi OU nom client par défaut)
                const titreChantier = chantierDesc.trim()
                  || `Chantier ${clientPrenom ? clientPrenom + ' ' : ''}${clientNom}`.trim()
                  || 'Nouveau chantier'
                const { data: newChantier, error: insertErr } = await supabase.from('chantiers').insert({
                  titre: titreChantier,
                  user_id: user.id,
                  client_id: clientId,
                  montant_devis_total: totalTTC || 0,
                  date_debut: dateTravaux || new Date().toISOString().split('T')[0],
                }).select('id').single()
                if (insertErr) console.error('Erreur sauvegarde chantier:', insertErr.message)
                else if (newChantier) chantierID = newChantier.id
              }
            } else if (chantierDesc.trim()) {
              // Fallback : pas de client mais nom de chantier saisi → on crée le chantier orphelin
              const { data: newChantier } = await supabase.from('chantiers').insert({
                titre: chantierDesc.trim(),
                user_id: user.id,
                client_id: null,
                montant_devis_total: totalTTC || 0,
                date_debut: dateTravaux || new Date().toISOString().split('T')[0],
              }).select('id').single()
              if (newChantier) chantierID = newChantier.id
            }
            // Mettre à jour le devis avec client_id et chantier_id
            if (clientId || chantierID) {
              const updates: Record<string, unknown> = {}
              if (clientId) updates.client_id = clientId
              if (chantierID) updates.chantier_id = chantierID
              const { error: updateErr } = await supabase.from('devis').update(updates).eq('id', devisId)
              if (updateErr) console.error('Erreur mise à jour devis:', updateErr.message)
            }
            // Sauvegarder le point de collecte pour réutilisation future
            if (dechetsCollecteNom.trim()) {
              const { data: existingPoint } = await supabase
                .from('points_collecte')
                .select('id')
                .eq('user_id', user.id)
                .ilike('nom', dechetsCollecteNom.trim())
                .maybeSingle()
              if (!existingPoint) {
                await supabase.from('points_collecte').insert({
                  nom: dechetsCollecteNom.trim(),
                  adresse: dechetsCollecteAdresse || null,
                  type_installation: dechetsCollecteType || null,
                  user_id: user.id,
                })
              }
            }
          }
        } catch (err) { console.error('Erreur sauvegarde client/chantier:', err) }
      }

      if (action === 'brouillon') {
        setToastMsg('Brouillon sauvegardé')
        setTimeout(() => setToastMsg(null), 3000)
        setSaving(false)
      } else {
        router.push(`/dashboard/devis/${(devis as { id: string }).id}`)
      }
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }, [clientCivilite, clientSiret, clientNom, clientPrenom, clientAdresse, clientCodePostal, clientVille, clientTelephone, clientEmail, dateDevis, dateValidite, dateTravaux, duree, chantierDesc, conditionsStr, notes, totalHT, totalTVA, totalTTC, effectiveTva, lines, router, acomptePct, dechetsNature, dechetsQuantite, dechetsResponsable, dechetsTri, dechetsCollecteNom, dechetsCollecteAdresse, dechetsCollecteType, dechetsCout, dechetsInclureCout])

  // --- Voice result handler ---
  const handleVoiceResult = (data: Record<string, unknown>) => {
    if (data.client_civilite) setClientCivilite(data.client_civilite as string)
    if (data.client_nom) setClientNom(data.client_nom as string)
    if (data.client_prenom) setClientPrenom(data.client_prenom as string)
    if (data.client_adresse) setClientAdresse(data.client_adresse as string)
    if (data.client_code_postal) setClientCodePostal(data.client_code_postal as string)
    if (data.client_ville) setClientVille(data.client_ville as string)
    if (data.client_telephone) setClientTelephone(data.client_telephone as string)
    if (data.client_email) setClientEmail(data.client_email as string)
    // Le champ "chantier/objet" du devis est unique cote formulaire (chantierDesc).
    // On donne la priorite au chantier explicitement nomme par l'artisan, sinon
    // on retombe sur l'objet (nature des travaux). Evite le double setState qui
    // ecrasait systematiquement chantier par objet.
    const chantierOuObjet = (data.chantier as string) || (data.objet as string) || ''
    if (chantierOuObjet) setChantierDesc(chantierOuObjet)
    if (data.conditions_paiement) setConditionsLibres(data.conditions_paiement as string)
    if (data.notes) setNotes(data.notes as string)
    if (data.tva_taux != null) setGlobalTvaRate(data.tva_taux as number)
    if (data.dechets_nature) setDechetsNature(data.dechets_nature as string)
    if (data.date_travaux) setDateTravaux(data.date_travaux as string)
    if (data.duree) setDuree(data.duree as string)
    if (data.acompte_pourcentage) {
      setAcomptePercent(String(data.acompte_pourcentage))
      setSelectedPayments(prev => {
        const next = new Set(prev)
        next.add('acompte')
        return next
      })
    }
    const voiceLines = data.lignes as Array<{ designation: string; quantite: number; unite: string; prix_unitaire: number }> | null
    if (voiceLines && voiceLines.length > 0) {
      setLines(voiceLines.map((vl, i) => ({
        id: nextId + i, designation: vl.designation, qty: vl.quantite || 1, unit: vl.unite || 'U', priceHT: vl.prix_unitaire || 0, tva: autoEntrepreneur ? 0 : 10, type: 'line' as const, inclusion: 'ferme' as const,
      })))
      nextId += voiceLines.length
    }
  }

  // --- Client autocomplete ---
  const handleClientNomChange = (value: string) => {
    setClientNom(value)
    if (value.length >= 1 && clients && clients.length > 0) {
      const q = value.toLowerCase().trim()
      const filtered = clients.filter(c => {
        const nom = String(c.nom || '').toLowerCase()
        const prenom = String(c.prenom || '').toLowerCase()
        const civilite = String((c as unknown as Record<string,string>).civilite || '').toLowerCase()
        return nom.includes(q) || prenom.includes(q) || (prenom + ' ' + nom).includes(q) || civilite.includes(q)
      })
      setClientSuggestions(filtered.slice(0, 8))
      setClientDropdownOpen(filtered.length > 0)
    } else {
      setClientSuggestions([])
      setClientDropdownOpen(false)
    }
  }

  const selectClientSuggestion = (c: ClientRecord) => {
    const raw = c as unknown as Record<string,string>
    setClientSiretError(null)
    if (raw.type === 'professionnel') {
      setClientCivilite('Société')
      setClientSiret(raw.siret || '')
    } else {
      setClientCivilite(raw.civilite || '')
    }
    setClientNom(c.nom)
    setClientPrenom(c.prenom || '')
    setClientAdresse(c.adresse || '')
    setClientCodePostal(c.code_postal || '')
    setClientVille(c.ville || '')
    setClientTelephone(c.telephone || '')
    setClientEmail(c.email || '')
    setClientSuggestions([])
    setClientDropdownOpen(false)
  }

  // --- Chantier autocomplete (DB + liste intégrée) ---
  const handleChantierDescChange = (value: string) => {
    setChantierDesc(value)
    if (value.length >= 1) {
      const q = value.toLowerCase()
      // Résultats depuis la base de données (champ titre dans la table chantiers)
      const fromDB = chantiers
        .map(c => (c.titre as string) || '')
        .filter(t => t.length > 0 && t.toLowerCase().includes(q))
      // Résultats depuis la liste intégrée (non déjà dans DB)
      const fromDB_set = new Set(fromDB.map(n => n.toLowerCase()))
      const fromBuiltin = PRESTATIONS_INTEGREES.filter(p =>
        p.toLowerCase().includes(q) && !fromDB_set.has(p.toLowerCase())
      )
      // Fusionner : DB en premier, puis suggestions intégrées
      const merged = [...fromDB, ...fromBuiltin].slice(0, 10)
      setChantierSuggestions(merged)
      setChantierDropdownOpen(merged.length > 0)
    } else {
      setChantierSuggestions([])
      setChantierDropdownOpen(false)
    }
  }

  // --- Toggle payment chip ---
  const togglePayment = (id: string) => {
    setSelectedPayments(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // p30 / p50 sont des conditions indépendantes, pas besoin d'activer acompte séparé
        if (id === 'p30') { setAcomptePercent('') }
        if (id === 'p50') { setAcomptePercent('') }
      }
      return next
    })
  }

  // ===================================================================
  // PREVIEW MODE
  // ===================================================================
  if (showPreview) {
    return (
      <div className="min-h-screen">
        <TopBar showPreview setShowPreview={setShowPreview} saving={saving} onDraft={() => handleSave('brouillon')} onFinish={() => handleSave('enregistrer')} />
        <div className="p-6 flex justify-center">
          <div className="max-w-[800px] w-full bg-white shadow-xl rounded-xl p-12">
            <div className="flex justify-between items-start mb-10">
              <div>
                {Boolean(entreprise?.logo_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(entreprise?.logo_url || '')} alt="Logo" className="h-16 w-auto object-contain mb-2" style={{ mixBlendMode: 'multiply', maxWidth: 160 }} />
                )}
                <h2 className="font-hanken font-bold text-xl text-[#0f1a3a]">{String(entreprise?.nom || 'Mon Entreprise')}</h2>
                <p className="text-sm font-hanken text-[#6b7280] mt-1 leading-relaxed">
                  {Boolean(entreprise?.adresse) && <>{String(entreprise?.adresse || '')}<br /></>}
                  {Boolean(entreprise?.code_postal || entreprise?.ville) && <>{String(entreprise?.code_postal || '')} {String(entreprise?.ville || '')}<br /></>}
                  {Boolean(entreprise?.siret) && <>SIRET : {String(entreprise?.siret || '')}<br /></>}
                  {Boolean(entreprise?.telephone) && <>Tél. : {String(entreprise?.telephone || '')}</>}
                </p>
              </div>
              <div className="text-right">
                <h3 className="font-hanken font-bold text-lg text-[#0f1a3a]">DEVIS</h3>
                <p className="text-sm font-hanken text-[#6b7280] mt-1">
                  Date : {new Date(dateDevis).toLocaleDateString('fr-FR')}<br />
                  Validité : {new Date(dateValidite).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-hanken font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Client</p>
              <p className="text-sm font-hanken text-[#0f1a3a] font-medium">{clientCivilite ? `${clientCivilite} ` : ''}{clientNom || 'Non renseigné'}</p>
              {clientAdresse && <p className="text-sm font-hanken text-[#6b7280]">{clientAdresse}</p>}
              {(clientCodePostal || clientVille) && <p className="text-sm font-hanken text-[#6b7280]">{clientCodePostal} {clientVille}</p>}
            </div>
            {chantierDesc && (
              <div className="mb-8"><p className="text-xs font-hanken font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Chantier</p><p className="text-sm font-hanken text-[#0f1a3a]">{chantierDesc}</p></div>
            )}

            <table className="w-full mb-8">
              <thead><tr className="bg-[#0f1a3a] text-white">
                <th className="px-3 py-2.5 text-left text-xs font-hanken font-semibold uppercase">Désignation</th>
                <th className="px-3 py-2.5 text-center text-xs font-hanken font-semibold uppercase">Qté</th>
                <th className="px-3 py-2.5 text-center text-xs font-hanken font-semibold uppercase">Unité</th>
                <th className="px-3 py-2.5 text-right text-xs font-hanken font-semibold uppercase">Prix U. HT</th>
                {/* V2.5 — Colonne TVA par ligne (parite Obat / PDF) */}
                <th className="px-3 py-2.5 text-center text-xs font-hanken font-semibold uppercase">TVA</th>
                <th className="px-3 py-2.5 text-right text-xs font-hanken font-semibold uppercase">Total HT</th>
              </tr></thead>
              <tbody>
                {lines.filter(l => l.designation || l.priceHT > 0).map((l, i) => (
                  <tr key={l.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2.5 text-sm font-hanken text-[#0f1a3a] whitespace-pre-wrap">{l.designation}</td>
                    <td className="px-3 py-2.5 text-sm font-hanken text-center">{l.type === 'line' ? l.qty : ''}</td>
                    <td className="px-3 py-2.5 text-sm font-hanken text-center text-[#6b7280]">{l.type === 'line' ? l.unit : ''}</td>
                    <td className="px-3 py-2.5 text-sm font-hanken text-right">{l.type === 'line' && l.priceHT > 0 ? formatCurrency(l.priceHT) : l.type === 'line' ? '--' : ''}</td>
                    <td className="px-3 py-2.5 text-sm font-hanken text-center text-[#6b7280]">{l.type === 'line' ? `${(l.tva ?? 0).toString().replace('.', ',')}%` : ''}</td>
                    <td className="px-3 py-2.5 text-sm font-hanken text-right font-semibold">{l.type === 'line' && l.priceHT > 0 ? formatCurrency(l.qty * l.priceHT) : l.type === 'line' ? '--' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-72">
                <div className="flex justify-between py-2 text-sm font-hanken"><span className="text-[#6b7280]">Total HT</span><span className="font-medium">{formatCurrency(totalHT)}</span></div>
                {!autoEntrepreneur && Object.entries(tvaGroups).filter(([r]) => Number(r) > 0).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, group]) => (
                  <div key={rate} className="flex justify-between py-2 text-sm font-hanken"><span className="text-[#6b7280]">TVA {rate}%</span><span className="font-medium">{formatCurrency(group.tva)}</span></div>
                ))}
                <div className="border-t mt-2 pt-2 flex justify-between py-2"><span className="text-[#6b7280]">Total TTC</span><span className="font-semibold">{formatCurrency(totalTTC)}</span></div>
                {autoEntrepreneur && <p className="text-xs text-[#6b7280] italic mt-1">TVA non applicable, art. 293 B du CGI</p>}
              </div>
            </div>

            {conditionsStr && <div className="mb-8"><h4 className="font-hanken font-semibold text-sm text-[#0f1a3a] mb-2">Conditions de paiement</h4><p className="text-sm font-hanken text-[#6b7280] whitespace-pre-wrap">{conditionsStr}</p></div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"><p className="text-sm font-hanken text-[#6b7280]">Signature du client</p><div className="h-20" /></div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-sm font-hanken text-[#6b7280]">Signature de l&apos;artisan</p>
                {Boolean(entreprise?.signature_base64) ? (
                  <div className="h-20 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={String(entreprise?.signature_base64 || '')} alt="Signature" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : <div className="h-20" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===================================================================
  // EDIT MODE
  // ===================================================================
  return (
    <div className="min-h-screen">
      <TopBar showPreview={false} setShowPreview={setShowPreview} saving={saving} onDraft={() => handleSave('brouillon')} onFinish={() => handleSave('enregistrer')} />

      <div className="p-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-sm text-red-600 font-hanken">{error}</p></div>}

        {/* Voice button */}
        <button onClick={() => setVoiceOpen(true)} className="flex items-center gap-2 bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white rounded-xl px-6 py-3 font-hanken font-bold text-sm shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all">
          <Mic size={18} /> Créer un devis par la voix
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Dates */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Date</label><input type="date" value={dateDevis} onChange={e => setDateDevis(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Valable jusqu&apos;au</label><input type="date" value={dateValidite} onChange={e => setDateValidite(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Durée estimée</label><input type="text" value={duree} onChange={e => setDuree(e.target.value)} placeholder="Ex. : 3 jours" className={inputCls} /></div>
          </div>

          {/* Right: Client + Chantier */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {/* Client — ancre pour le tutoriel onboarding (infobulle 1/2).
                Voir components/OnboardingTour.tsx, scénario devis. */}
            <div data-tour="devis-client" className="bg-white rounded-2xl border-2 border-gray-200 p-5 shadow-sm space-y-3">
              <label className="block text-sm font-hanken font-semibold text-[#0f1a3a]">Client</label>

              {/* Ligne 1 : Civilité + Nom (pleine largeur) + autocomplete */}
              <div className="relative">
                <div className="flex gap-2">
                  <select value={clientCivilite} onChange={e => { setClientCivilite(e.target.value); if (e.target.value !== 'Société') setClientSiretError(null) }} className="w-24 h-11 shrink-0 rounded-xl border-2 border-gray-200 px-2 text-sm font-hanken outline-none focus:border-[#ff7a1a] bg-white">
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Société">Société</option>
                  </select>
                  <input
                    type="text"
                    value={clientNom}
                    onChange={e => handleClientNomChange(e.target.value)}
                    onBlur={() => setTimeout(() => { setClientDropdownOpen(false); setClientSuggestions([]) }, 200)}
                    placeholder="Nom (tapez pour rechercher un client)"
                    className={inputCls}
                    autoComplete="off"
                  />
                </div>
                {/* Dropdown autocomplete — pleine largeur, au-dessus des autres champs */}
                {clientDropdownOpen && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#ff7a1a]/30 shadow-2xl z-50 w-full max-h-60 overflow-y-auto">
                    {clientSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); selectClientSuggestion(c) }}
                        className="w-full text-left px-4 py-3 font-hanken hover:bg-[#fff5ec] border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <span className="font-semibold text-[#0f1a3a] text-sm">
                          {c.prenom ? `${c.prenom} ${c.nom}` : c.nom}
                        </span>
                        {c.adresse && (
                          <span className="text-[#6b7280] text-xs block mt-0.5">
                            {c.adresse}{c.code_postal || c.ville ? ` · ${c.code_postal ?? ''} ${c.ville ?? ''}`.trim() : ''}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Ligne 2 : Prénom (ou SIRET si client professionnel) */}
              {clientCivilite === 'Société' ? (
                <div>
                  <input type="text" inputMode="numeric" value={clientSiret} onChange={e => setClientSiret(e.target.value)} onBlur={() => setClientSiretError(validateClientSiret(clientSiret))} placeholder="SIREN (9) ou SIRET (14)" className={inputCls + ' font-spline-mono font-medium tracking-[0.5px]' + (clientSiretError ? ' border-red-500 focus:border-red-500' : '')} />
                  {clientSiretError && <p className="mt-1 text-[12px] text-red-600 font-hanken">{clientSiretError}</p>}
                </div>
              ) : (
                <input type="text" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} placeholder="Prénom" className={inputCls} />
              )}

              {/* Ligne 3 : Adresse */}
              <input type="text" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} placeholder="Adresse" className={inputCls} />

              {/* Ligne 4 : Code postal + Ville */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" value={clientCodePostal} onChange={e => setClientCodePostal(e.target.value)} placeholder="Code postal" className={inputCls} />
                <input type="text" value={clientVille} onChange={e => setClientVille(e.target.value)} placeholder="Ville" className={inputCls} />
              </div>

              {/* Ligne 5 : Téléphone + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="tel" value={clientTelephone} onChange={e => setClientTelephone(e.target.value)} placeholder="Téléphone" className={inputCls} />
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email" className={inputCls} />
              </div>
            </div>

            {/* Chantier / Prestation avec autocomplete */}
            <div>
              <label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Chantier / Prestation</label>
              <div className="relative">
                <input
                  type="text"
                  value={chantierDesc}
                  onChange={e => handleChantierDescChange(e.target.value)}
                  onBlur={() => setTimeout(() => setChantierDropdownOpen(false), 150)}
                  placeholder="Description de la prestation / chantier..."
                  className={inputCls}
                  autoComplete="off"
                />
                {chantierDropdownOpen && chantierSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border-2 border-[#ff7a1a]/30 shadow-2xl z-50 w-full max-h-56 overflow-y-auto">
                    {chantierSuggestions.map((nom, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault()
                          setChantierDesc(nom)
                          setChantierSuggestions([])
                          setChantierDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-hanken hover:bg-[#fff5ec] border-b border-gray-100 last:border-0 transition-colors text-[#0f1a3a] font-medium"
                      >
                        {nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LINES TABLE */}
        <>
          {/* Prestations — ancre pour le tutoriel onboarding (infobulle 2/2).
              Voir components/OnboardingTour.tsx, scénario devis. */}
          <div data-tour="devis-prestations" className="bg-white rounded-xl border border-gray-200">

            {/* ── Mobile : cards + bottom sheet (V2 maquette validée) ── */}
            <div className="sm:hidden p-3 space-y-2">
              {lines.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-300 bg-[#fafbfc] px-4 py-6 text-center">
                  <p className="text-sm font-hanken text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                  <p className="text-[12px] font-hanken text-gray-400 mt-1">Touchez <strong>+ Ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
                </div>
              )}
              {lines.map(line => (
                <LineCard
                  key={line.id}
                  line={line}
                  subtotal={computeSubtotal(lines.indexOf(line))}
                  onTap={() => openEditSheet(line)}
                  onDelete={() => removeLine(line.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => openCreateSheet('line')}
                  className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"
                >
                  <Plus size={16} /> Ligne
                </button>
                <button
                  type="button"
                  onClick={() => openCreateSheet('section')}
                  className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"
                >
                  <Plus size={16} /> Section
                </button>
                <button
                  type="button"
                  onClick={() => openCreateSheet('subsection')}
                  className="flex-1 min-w-[44%] flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-hanken font-semibold text-[#0f1a3a] active:scale-95 transition-all"
                >
                  <Plus size={16} /> Sous-section
                </button>
              </div>
            </div>

            {/* ── Desktop : table classique (≥ sm) ── */}
            <div className="hidden sm:block overflow-x-auto">
              {/* V2.5 — Colonne TVA par ligne (parite Obat). 7 colonnes au lieu de 6. */}
              <div className="bg-[#0f1a3a] text-white grid grid-cols-[1fr_92px_70px_90px_100px_80px_100px_36px] min-w-[660px] items-center px-4 py-3 text-xs font-hanken font-semibold uppercase">
                <span>Désignation</span><span className="text-center">Statut</span><span className="text-center">Qté</span><span className="text-center">Unité</span><span className="text-right">Prix U. HT</span><span className="text-center">TVA</span><span className="text-right">Total HT</span><span />
              </div>
              {lines.length === 0 && (
                <div className="px-4 py-8 text-center border-b border-gray-100">
                  <p className="text-sm font-hanken text-[#5f6c80]">Aucune ligne pour l&apos;instant.</p>
                  <p className="text-[12px] font-hanken text-gray-400 mt-1">Cliquez sur <strong>+ Ligne</strong> ou <strong>+ Section</strong> ci-dessous pour commencer.</p>
                </div>
              )}
              {lines.map(line => (
                <div key={line.id} className={`grid grid-cols-[1fr_92px_70px_90px_100px_80px_100px_36px] min-w-[660px] items-start px-4 py-2 border-b border-gray-100 ${line.type === 'section' ? 'bg-[#fafbfc] border-l-4 border-l-[#ff7a1a]' : line.type === 'subsection' ? 'bg-white border-l-2 border-l-[#ff7a1a]/60' : ''}`}>
                  {line.type === 'line' ? (
                    <DesignationAutocomplete
                      value={line.designation}
                      onChange={v => updateLine(line.id, 'designation', v)}
                      onPick={s => {
                        updateLine(line.id, 'designation', s.designation)
                        updateLine(line.id, 'unit', s.unite)
                        updateLine(line.id, 'priceHT', s.prix_unitaire_ht)
                        updateLine(line.id, 'tva', autoEntrepreneur ? 0 : s.taux_tva)
                      }}
                      suggestions={prestationSuggestions}
                      placeholder="Désignation..."
                      rows={1}
                      className="w-full mr-2 text-sm font-hanken border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] px-2 py-1.5 resize-none overflow-hidden min-h-[38px]"
                    />
                  ) : (
                    <textarea
                      value={line.designation}
                      onChange={e => { updateLine(line.id, 'designation', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                      className={`text-sm font-hanken border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] px-2 py-1.5 mr-2 resize-none overflow-hidden min-h-[38px] ${line.type === 'section' ? 'font-bold text-[#0f1a3a]' : line.type === 'subsection' ? 'font-semibold text-[#0f1a3a]' : ''}`}
                      placeholder={line.type === 'section' ? 'Nom de la section (ex : Demolition, Maconnerie...)' : line.type === 'subsection' ? 'Nom de la sous-section (ex : Cuisine, Plomberie...)' : line.type === 'text' ? 'Texte libre...' : 'Désignation...'}
                      rows={1}
                    />
                  )}
                  {/* Colonne STATUT — case fixe, juste avant la quantité (lignes seulement) */}
                  {line.type === 'line'
                    ? <div className="mr-1 mt-0.5"><LineStatutSelect compact value={line.inclusion} onChange={s => updateLine(line.id, 'inclusion', s)} /></div>
                    : <span />}
                  {line.type === 'line' ? (
                    <>
                      <input type="number" value={line.qty} onChange={e => updateLine(line.id, 'qty', Number(e.target.value))} className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mt-0.5 mx-1" min={0} />
                      <select value={line.unit} onChange={e => updateLine(line.id, 'unit', e.target.value)} className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mt-0.5 mx-1 w-full">
                        {UNIT_SUGGESTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" value={line.priceHT} onChange={e => updateLine(line.id, 'priceHT', Number(e.target.value))} className="text-sm text-right border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 px-2 mt-0.5 mx-1" min={0} step={0.01} />
                      {/* V2.5 — Selecteur TVA par ligne (parite Obat) */}
                      <select
                        value={line.tva}
                        onChange={e => updateLine(line.id, 'tva', Number(e.target.value))}
                        disabled={autoEntrepreneur}
                        className="text-sm text-center border border-gray-200 hover:border-gray-300 rounded-md outline-none bg-white focus:border-[#ff7a1a] h-9 mt-0.5 mx-1 w-full disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {TVA_RATES.map(r => <option key={r} value={r}>{r === 0 ? '0%' : r === 5.5 ? '5,5%' : `${r}%`}</option>)}
                      </select>
                      <span className="text-sm font-semibold text-right mt-1.5">{line.priceHT > 0 ? formatCurrency(line.qty * line.priceHT) : '--'}</span>
                    </>
                  ) : (line.type === 'section' || line.type === 'subsection') ? (<><span /><span /><span /><span /><span className="text-sm font-bold text-right mt-1.5 text-[#0f1a3a]">{formatCurrency(computeSubtotal(lines.indexOf(line)))}</span></>) : <><span /><span /><span /><span /><span /></>}
                  <button onClick={() => removeLine(line.id)} className="p-1 text-gray-300 hover:text-red-500 mt-1.5"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* Boutons d'ajout */}
            <div className="flex flex-wrap gap-2 p-4 border-t border-gray-100">
              <button onClick={() => addLine('line')} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-hanken hover:bg-gray-100"><Plus size={14} /> Ajouter une ligne</button>
              <button onClick={() => addLine('section')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#0f1a3a] bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-lg"><Plus size={14} /> Section</button>
              <button onClick={() => addLine('subsection')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#0f1a3a] bg-white border border-gray-300 hover:border-[#ff7a1a] hover:bg-[#fff5ec] rounded-lg"><Plus size={14} /> Sous-section</button>
              <button onClick={() => addLine('text')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-hanken text-[#6b7280] hover:text-[#0f1a3a]"><Plus size={14} /> Texte libre</button>
            </div>
          </div>

            {/* V2.5 — Selecteur global = raccourci "Appliquer a toutes les lignes".
                Le taux reel est saisi ligne par ligne dans le tableau ;
                ce raccourci pousse la valeur sur TOUTES les lignes existantes. */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-hanken font-medium text-[#0f1a3a]">Appliquer à toutes les lignes :</label>
                <select
                  value={globalTvaRate}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setGlobalTvaRate(v)
                    setAutoEntrepreneur(v === 0)
                    // V2.5 : pousse le taux sur TOUTES les lignes existantes
                    setLines(prev => prev.map(l => l.type === 'line' ? { ...l, tva: v } : l))
                  }}
                  className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-hanken outline-none focus:border-[#ff7a1a] bg-white cursor-pointer"
                >
                  <option value={0}>Sans TVA</option><option value={5.5}>5,5%</option><option value={10}>10%</option><option value={20}>20%</option>
                </select>
              </div>
              <span className="text-xs font-hanken text-[#6b7280] italic">Astuce : modifiable aussi ligne par ligne dans le tableau.</span>
              {autoEntrepreneur && (
                <span className="text-xs font-hanken text-[#6b7280] italic">TVA non applicable, art. 293 B du CGI</span>
              )}
            </div>
          {/* Forfait option */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-hanken cursor-pointer">
              <input type="checkbox" checked={useForfait} onChange={e => setUseForfait(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#ff7a1a] focus:ring-[#ff7a1a]" />
              Appliquer un prix forfaitaire global
            </label>
            {useForfait && (
              <div className="flex items-center gap-2">
                <input type="number" value={forfaitHT} onChange={e => setForfaitHT(Number(e.target.value))} className="w-32 h-9 rounded-lg border border-gray-200 px-3 text-sm font-hanken outline-none focus:border-[#ff7a1a] text-right" min={0} step={0.01} />
                <span className="text-sm font-hanken text-[#6b7280]">€ HT</span>
              </div>
            )}
          </div>
          </>

        {/* Déchets + Totaux — côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Gestion des déchets (loi AGEC) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-hanken font-medium text-[#0f1a3a]">Gestion des déchets</label>
              <span className="text-[9px] font-hanken text-[#ff7a1a] border border-[#ff7a1a]/40 px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold">Loi AGEC</span>
              <button type="button" onClick={() => setAfficherDechets(v => !v)} aria-pressed={afficherDechets} aria-label="Afficher la gestion des déchets sur ce devis" className={`relative ml-auto w-11 h-6 rounded-full transition-colors ${afficherDechets ? 'bg-[#ff7a1a]' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${afficherDechets ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {!afficherDechets && <p className="text-[12px] font-hanken text-gray-400">Section masquée — elle n&apos;apparaîtra ni sur le devis ni sur le PDF.</p>}
            {afficherDechets && (<>
            {/* Nature + Quantité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Nature des déchets</label>
                <select value={dechetsNature} onChange={e => setDechetsNature(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                  <option value="Déchets non dangereux (câbles, emballages)">Déchets non dangereux (câbles, emballages)</option>
                  <option value="Déchets d'équipements électriques (DEEE)">DEEE (équipements électriques)</option>
                  <option value="Déchets inertes (gravats, plâtre, béton)">Déchets inertes (gravats, plâtre)</option>
                  <option value="Mélange non dangereux">Mélange non dangereux</option>
                  <option value="Déchets dangereux (amiante, peintures)">Déchets dangereux (amiante, peintures)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Quantité estimée</label>
                <input type="text" value={dechetsQuantite} onChange={e => setDechetsQuantite(e.target.value)} placeholder="Ex : 0.5 tonne, 2 m³" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
              </div>
            </div>
            {/* Enlèvement + Tri + Coût */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Enlèvement par</label>
                <select value={dechetsResponsable} onChange={e => setDechetsResponsable(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                  <option value="L'entreprise">L&apos;entreprise</option>
                  <option value="Le client (maître d'ouvrage)">Le client</option>
                  <option value="Prestataire externe">Prestataire externe</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Tri</label>
                <select value={dechetsTri} onChange={e => setDechetsTri(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                  <option value="Tri sur le chantier">Tri sur le chantier</option>
                  <option value="Collecte séparée">Collecte séparée</option>
                  <option value="Évacuation en mélange">Évacuation en mélange</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Coût estimé TTC (€)</label>
                <input type="number" value={dechetsCout} onChange={e => setDechetsCout(e.target.value)} placeholder="0.00" min={0} step={0.01} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={dechetsInclureCout} onChange={e => setDechetsInclureCout(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#ff7a1a] focus:ring-[#ff7a1a]" />
                  <span className="text-sm font-hanken text-[#0f1a3a]">Inclure dans le prix total</span>
                </label>
              </div>
            </div>
            {/* Point de collecte */}
            <div>
              <label className="block text-[11px] font-hanken text-[#6b7280] mb-1">Point de collecte</label>
              {!dechetsCollecteNom && (pointsCollecte?.length > 0 || dechetteriesProches.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pointsCollecte?.map(p => (
                    <button key={p.id} type="button" onClick={() => { setDechetsCollecteNom(p.nom); setDechetsCollecteAdresse(p.adresse || ''); setDechetsCollecteType(p.type_installation || 'Déchetterie') }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-hanken bg-[#fff5ec] border border-[#ff7a1a]/30 text-[#0f1a3a] hover:bg-[#ffeadb] transition-colors font-medium">
                      ★ {p.nom}
                    </button>
                  ))}
                  {dechetteriesProches.slice(0, 3).map((d, i) => {
                    // Lien Maps direct avec adresse complète (ouvre Google Maps app sur mobile, web sinon)
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.nom} ${d.adresse} ${d.code_postal} ${d.commune}`)}`
                    const acceptePro = d.accepte_pro && d.accepte_pro !== 'Non renseigné' && d.accepte_pro.toLowerCase() !== 'non'
                    return (
                      <div key={`api-${i}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 hover:border-gray-400 transition-colors overflow-hidden">
                        <button type="button" onClick={() => { setDechetsCollecteNom(d.nom); setDechetsCollecteAdresse(`${d.adresse}, ${d.code_postal} ${d.commune}`); setDechetsCollecteType('Déchetterie') }}
                          className="px-2.5 py-1 text-[11px] font-hanken text-[#6b7280] hover:bg-gray-50 transition-colors">
                          {d.nom} <span className="text-[#ff7a1a] font-semibold">({d.distance_km} km)</span>
                          {acceptePro && <span title="Accepte les professionnels" className="ml-1 px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">PRO</span>}
                          {d.accepte_construction && <span title="Accepte les déchets de construction (gravats)" className="ml-1 px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">GRAVATS</span>}
                          {d.accepte_deee && <span title="Accepte les équipements électriques et électroniques" className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">DEEE</span>}
                        </button>
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Voir sur Google Maps"
                          className="px-2 py-1 text-[#ff7a1a] hover:bg-[#fff5ec] transition-colors border-l border-gray-200">
                          ↗
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
              {loadingDechetteries && !dechetsCollecteNom && <p className="text-[11px] font-hanken text-[#9ca3af] mb-2 animate-pulse">Recherche des déchetteries proches...</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <input type="text" value={dechetsCollecteNom} onChange={e => setDechetsCollecteNom(e.target.value)} placeholder="Nom / raison sociale" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
                  {dechetsCollecteNom && (
                    <button type="button" onClick={() => { setDechetsCollecteNom(''); setDechetsCollecteAdresse(''); setDechetsCollecteType('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  )}
                </div>
                <input type="text" value={dechetsCollecteAdresse} onChange={e => setDechetsCollecteAdresse(e.target.value)} placeholder="Adresse" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]" />
                <select value={dechetsCollecteType} onChange={e => setDechetsCollecteType(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a]">
                  <option value="Déchetterie">Déchetterie</option>
                  <option value="Centre de tri">Centre de tri</option>
                  <option value="Plateforme de recyclage">Plateforme de recyclage</option>
                  <option value="Collecteur agréé">Collecteur agréé</option>
                </select>
              </div>
            </div>
            </>)}
          </div>

          {/* Totaux */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between py-2 text-sm font-hanken"><span className="text-[#6b7280]">Total HT</span><span className="font-medium">{formatCurrency(totalHT)}</span></div>
            {!autoEntrepreneur && Object.entries(tvaGroups).filter(([r]) => Number(r) > 0).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, group]) => (
              <div key={rate} className="flex justify-between py-2 text-sm font-hanken"><span className="text-[#6b7280]">TVA {rate}%</span><span className="font-medium">{formatCurrency(group.tva)}</span></div>
            ))}
            {dechetsInclureCout && dechetsCoutNum > 0 && (
              <div className="flex justify-between py-2 text-sm font-hanken"><span className="text-[#ff7a1a]">Gestion déchets TTC</span><span className="font-medium text-[#ff7a1a]">{formatCurrency(dechetsCoutNum)}</span></div>
            )}
            <div className="border-t mt-2 pt-2 flex justify-between py-2"><span className="text-[#6b7280]">{autoEntrepreneur ? 'Total' : 'Total TTC'}</span><span className="font-semibold">{formatCurrency(autoEntrepreneur ? totalHT : totalTTC)}</span></div>
            {autoEntrepreneur && <p className="text-xs text-[#6b7280] italic mt-1">TVA non applicable, art. 293 B du CGI</p>}
            {acompteMontant > 0 && (
              <>
                <div className="flex justify-between py-1.5 text-sm font-hanken border-t mt-1 pt-2">
                  <span className="text-[#0f1a3a] font-medium">Acompte à verser ({acomptePct}%)</span>
                  <span className="text-[#0f1a3a] font-semibold">{formatCurrency(acompteMontant)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-sm font-hanken">
                  <span className="text-[#6b7280]">Reste à facturer</span>
                  <span className="font-semibold text-[#0f1a3a]">{formatCurrency(resteAPayer)}</span>
                </div>
              </>
            )}
            <div className="bg-[#0f1a3a] text-white rounded-lg p-3 mt-3 flex justify-between items-center">
              <span className="font-hanken font-bold text-sm">NET À PAYER</span><span className="font-hanken font-bold text-lg">{formatCurrency(autoEntrepreneur ? totalHT : totalTTC)}</span>
            </div>
          </div>
        </div>

        {/* Conditions de paiement */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <label className="block text-sm font-hanken font-medium text-[#0f1a3a]">Conditions de paiement</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => togglePayment(opt.id)} className={`px-3 py-1.5 rounded-full text-sm font-hanken border transition-colors ${selectedPayments.has(opt.id) ? 'bg-[#fff5ec] border-[#ff7a1a] text-[#0f1a3a] font-medium' : 'border-gray-200 text-[#6b7280] hover:border-gray-400'}`}>
                {selectedPayments.has(opt.id) ? '✓ ' : '☐ '}{opt.label}
              </button>
            ))}
            <div
              onClick={() => togglePayment('acompte')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-hanken border transition-colors cursor-pointer select-none ${selectedPayments.has('acompte') ? 'bg-[#fff5ec] border-[#ff7a1a] text-[#0f1a3a] font-medium' : 'border-gray-200 text-[#6b7280] hover:border-gray-400'}`}>
              <span className="shrink-0">{selectedPayments.has('acompte') ? '✓' : '☐'}</span>
              <span className="shrink-0">Acompte de</span>
              <input
                type="number"
                value={acomptePercent}
                onChange={e => { e.stopPropagation(); setAcomptePercent(e.target.value); if (!selectedPayments.has('acompte')) togglePayment('acompte') }}
                onClick={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                className="w-12 text-center bg-transparent outline-none border-b border-current cursor-text"
                placeholder="..."
                min={0} max={100} step={1}
              />
              <span className="shrink-0">%</span>
            </div>
          </div>
          {/* "Conditions personnalisées" supprimé : doublon avec les conditions de paiement cochables et les notes personnalisées. */}
          <div><label className="block text-sm font-hanken font-medium text-[#0f1a3a] mb-1">Notes personnalisées <span className="text-[10px] text-gray-400 font-normal">(visibles par le client)</span></label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Écrire ici…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-hanken outline-none focus:border-[#ff7a1a] resize-none" /></div>
        </div>


        {/* Bottom buttons */}
        <div className="flex flex-wrap items-center gap-3 justify-end pb-8">
          <button onClick={() => handleSave('brouillon')} disabled={saving}
            className="h-12 px-6 rounded-xl border-2 border-gray-300 text-sm font-hanken font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Brouillon
          </button>
          <button onClick={() => handleSave('enregistrer')} disabled={saving}
            className="h-12 px-8 rounded-xl bg-emerald-600 text-white font-hanken font-bold text-sm hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Enregistrer
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-hanken z-50">{toastMsg}</div>}

      {/* Voice Modal */}
      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} onResult={handleVoiceResult} />

      {/* Bottom sheet mobile (saisie/édition ligne) */}
      <LineSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        line={sheetLine as SheetLine | null}
        onSave={handleSheetSave}
        onSaveAndNew={handleSheetSaveAndNew}
        defaultType={sheetDefaultType}
        unitOptions={UNIT_SUGGESTIONS}
        prestations={prestationSuggestions}
        autoEntrepreneur={autoEntrepreneur}
        showStatut
      />
    </div>
  )
}

// -------------------------------------------------------------------
// Top Bar
// -------------------------------------------------------------------

function TopBar({ showPreview, setShowPreview, saving, onDraft, onFinish }: {
  showPreview: boolean; setShowPreview: (v: boolean) => void; saving: boolean; onDraft: () => void; onFinish: () => void
}) {
  return (
    <div className="sticky top-0 bg-white border-b border-gray-200 z-10 py-3 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/devis" className="p-1.5 rounded-md hover:bg-gray-100"><ArrowLeft size={18} className="text-[#6b7280]" /></Link>
        <h2 className="hidden sm:block font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em]">Nouveau devis</h2>
      </div>
      <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-0.5">
        <button onClick={() => setShowPreview(false)} className={`px-4 py-1.5 rounded-md text-sm font-hanken font-medium transition-colors ${!showPreview ? 'bg-white shadow-sm text-[#0f1a3a]' : 'text-[#6b7280]'}`}>Édition</button>
        <button onClick={() => setShowPreview(true)} className={`px-4 py-1.5 rounded-md text-sm font-hanken font-medium transition-colors ${showPreview ? 'bg-white shadow-sm text-[#0f1a3a]' : 'text-[#6b7280]'}`}>Aperçu</button>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDraft} disabled={saving}
          className="h-9 px-4 rounded-xl border-2 border-gray-300 text-sm font-hanken font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Brouillon
        </button>
        <button onClick={onFinish} disabled={saving}
          className="h-9 px-4 rounded-xl bg-emerald-600 text-white font-hanken font-bold text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Enregistrer
        </button>
      </div>
    </div>
  )
}
