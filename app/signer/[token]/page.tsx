'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import LegalMentionsBlock from '@/components/legal/LegalMentionsBlock'
import type { LegalContext } from '@/lib/legal-mentions'
import DocumentRender from '@/components/document/DocumentRender'
import { buildDevisDocument } from '@/lib/document-data'

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

interface DevisData {
  id: string
  numero: string
  statut: string
  date_emission?: string
  date_validite?: string
  date_debut_travaux?: string
  duree_estimee?: string
  objet?: string
  conditions_paiement?: string
  acompte_pourcent?: number
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  date_signature?: string
  signed_by?: string
  client_signature_base64?: string
  dechets_nature?: string
  dechets_quantite?: string
  dechets_responsable?: string
  dechets_tri?: string
  dechets_collecte_nom?: string
  dechets_collecte_adresse?: string
  dechets_collecte_type?: string
  dechets_cout?: number
  dechets_inclure_cout?: boolean
}

interface Ligne {
  designation: string
  quantite: number
  unite: string
  prix_unitaire_ht: number
  taux_tva: number
  montant_ht: number
  ordre: number
  type: string
  optionnel: boolean
}

interface Entreprise {
  nom?: string
  adresse?: string
  code_postal?: string
  ville?: string
  telephone?: string
  email?: string
  siret?: string
  /** P11 (audit) : N° TVA intracom de l'émetteur, à afficher sur le devis */
  tva_intracommunautaire?: string
  /** P12 (audit) : assurance décennale + zone géographique (obligation BTP) */
  assurance_nom?: string
  decennale_numero?: string
  assurance_zone?: string
  /** Mentions légales (forme juridique, RCS, qualification, médiateur, etc.) */
  forme_juridique?: string
  capital_social?: string
  rcs_rm?: string
  qualification_pro?: string
  /** Médiateur de la consommation — legacy (champ libre) */
  mediateur?: string
  /** Médiateur — sous-champs structurés (V2.4c) */
  mediateur_nom?: string
  mediateur_adresse?: string
  mediateur_code_postal?: string
  mediateur_ville?: string
  /** Mentions personnalisées libres (textarea Paramètres) — V2.4c */
  mentions_legales_custom?: string
  /** Auto-entrepreneur / micro-entreprise / EI → franchise TVA art. 293 B CGI */
  franchise_tva?: boolean
  logo_url?: string
  signature_base64?: string
  tampon_base64?: string
}

interface ClientInfo {
  nom: string
  adresse: string
  telephone: string
  email: string
  /** P11 (audit) : SIRET du client (si pro), à afficher sur le devis signé */
  siret?: string
  // V3.0b — champs additionnels servis par /api/public/devis/[token]
  civilite?: string
  prenom?: string
  code_postal?: string
  ville?: string
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const formatDate = (d?: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ───────────────────────────────────────────────────────────────
// Signature Pad Component
// ───────────────────────────────────────────────────────────────

function SignaturePad({
  onSignature,
  onClear,
}: {
  onSignature: (base64: string) => void
  onClear: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasDrawn(true)
  }, [isDrawing, getPos])

  const endDraw = useCallback(() => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && hasDrawn) {
      onSignature(canvas.toDataURL('image/png'))
    }
  }, [hasDrawn, onSignature])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onClear()
  }, [onClear])

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full cursor-crosshair"
          style={{ height: 150 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm font-manrope">Dessinez votre signature ici</p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <button
          onClick={clear}
          className="mt-2 text-sm text-gray-500 hover:text-red-500 font-manrope transition-colors"
        >
          Effacer et recommencer
        </button>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// Main Page
// ───────────────────────────────────────────────────────────────

export default function SignerDevisPage() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devis, setDevis] = useState<DevisData | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [entreprise, setEntreprise] = useState<Entreprise>({})
  const [client, setClient] = useState<ClientInfo>({ nom: '', adresse: '', telephone: '', email: '' })

  // Signature state
  const [mode, setMode] = useState<'draw' | 'approve' | null>(null)
  const [signedBy, setSignedBy] = useState('')
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  // Fetch devis data
  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await fetch(`/api/public/devis/${token}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Erreur de chargement')
          return
        }
        setDevis(data.devis)
        setLignes(data.lignes)
        setEntreprise(data.entreprise)
        setClient(data.client)
        if (data.client?.nom) setSignedBy(data.client.nom)
        // Déjà signé ?
        if (data.devis.statut === 'signe' || data.devis.statut === 'facture') {
          setSigned(true)
        }
      } catch {
        setError('Impossible de charger le devis')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  // Handle signature submission
  async function handleSign() {
    if (!signedBy.trim()) {
      setSignError('Veuillez entrer votre nom')
      return
    }
    if (mode === 'draw' && !signatureBase64) {
      setSignError('Veuillez dessiner votre signature')
      return
    }
    setSigning(true)
    setSignError(null)
    try {
      const res = await fetch('/api/public/signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signedBy: signedBy.trim(),
          signatureBase64: mode === 'draw' ? signatureBase64 : null,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSignError(data.error || 'Erreur lors de la signature')
        return
      }
      setSigned(true)
    } catch {
      setSignError('Erreur de connexion, veuillez réessayer')
    } finally {
      setSigning(false)
    }
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-manrope">Chargement du devis...</p>
        </div>
      </div>
    )
  }

  // ─── Error ───
  if (error || !devis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-syne font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-500 font-manrope">{error || 'Ce devis n\'existe pas ou le lien a expiré.'}</p>
        </div>
      </div>
    )
  }

  // ─── Already signed ───
  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-syne font-bold text-gray-900 mb-2">Devis signé</h1>
          <p className="text-gray-500 font-manrope mb-4">
            Le devis n° {devis.numero} a été accepté{devis.signed_by ? ` par ${devis.signed_by}` : ''}.
          </p>
          <p className="text-sm text-gray-400 font-manrope">
            {entreprise.nom} a été notifié. Vous pouvez fermer cette page.
          </p>
        </div>
      </div>
    )
  }

  // ─── Main view ───
  const totalHT = devis.montant_ht || 0
  const totalTVA = devis.montant_tva || 0
  const totalTTC = devis.montant_ttc || 0

  // V15 — Detection "sans TVA" basee UNIQUEMENT sur les taux saisis (cf. consigne 21/05).
  // Regle simplifiee : taux === 0 sur toutes les lignes prestation -> mention 293 B.
  // Le helper isAutoEntrepreneur ne pilote PLUS l'affichage de la mention (un AE qui depasse
  // le seuil en cours d'annee peut saisir un taux > 0 -> mention disparait automatiquement).
  // Garde-fou : totalTVA === 0 (cas legacy avec lignes sans taux_tva en DB).
  const prestNonOpt = lignes.filter(l => l.type === 'prestation' && !l.optionnel)
  const allLinesZeroTva = prestNonOpt.length > 0 && prestNonOpt.every(l => (l.taux_tva ?? 0) === 0)
  const isSansTva = allLinesZeroTva || totalTVA === 0

  // Group lignes by TVA rate for the summary (uniquement si TVA applicable)
  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  if (!isSansTva) {
    prestNonOpt.forEach(l => {
      const rate = l.taux_tva || 10
      if (rate <= 0) return
      if (!tvaGroups[rate]) tvaGroups[rate] = { ht: 0, tva: 0 }
      const ht = l.quantite * l.prix_unitaire_ht
      tvaGroups[rate].ht += ht
      tvaGroups[rate].tva += ht * (rate / 100)
    })
  }

  // V3.0b — DocumentData unique pour le rendu visuel (header + cartes + tableau + recap).
  const documentData = buildDevisDocument({
    doc: {
      numero: devis.numero,
      date_emission: devis.date_emission ?? null,
      date_validite: devis.date_validite ?? null,
      objet: devis.objet ?? null,
      acompte_pourcent: devis.acompte_pourcent ?? null,
      conditions_paiement: devis.conditions_paiement ?? null,
      dechets_nature: devis.dechets_nature ?? null,
      dechets_responsable: devis.dechets_responsable ?? null,
      dechets_tri: devis.dechets_tri ?? null,
      dechets_collecte_nom: devis.dechets_collecte_nom ?? null,
      dechets_collecte_type: devis.dechets_collecte_type ?? null,
    },
    lignes: lignes.map((l, idx) => ({
      designation: l.designation,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      ordre: l.ordre ?? idx,
      type: l.type ?? null,
    })),
    client: {
      civilite: client.civilite ?? null,
      nom: client.nom ?? null,
      prenom: client.prenom ?? null,
      adresse: client.adresse ?? null,
      code_postal: client.code_postal ?? null,
      ville: client.ville ?? null,
      telephone: client.telephone ?? null,
      email: client.email ?? null,
      siret: client.siret ?? null,
    },
    entreprise: {
      nom: entreprise.nom ?? null,
      adresse: entreprise.adresse ?? null,
      code_postal: entreprise.code_postal ?? null,
      ville: entreprise.ville ?? null,
      siret: entreprise.siret ?? null,
      tva_intracommunautaire: entreprise.tva_intracommunautaire ?? null,
      telephone: entreprise.telephone ?? null,
      email: entreprise.email ?? null,
      logo_url: entreprise.logo_url ?? null,
      assurance_nom: entreprise.assurance_nom ?? null,
      decennale_numero: entreprise.decennale_numero ?? null,
      assurance_zone: entreprise.assurance_zone ?? null,
      rcs_rm: entreprise.rcs_rm ?? null,
      forme_juridique: entreprise.forme_juridique ?? null,
      mediateur: entreprise.mediateur ?? null,
      mediateur_nom: entreprise.mediateur_nom ?? null,
      mediateur_adresse: entreprise.mediateur_adresse ?? null,
      mediateur_code_postal: entreprise.mediateur_code_postal ?? null,
      mediateur_ville: entreprise.mediateur_ville ?? null,
      franchise_tva: entreprise.franchise_tva ?? null,
    },
    chantier: null,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar minimal — juste le rappel du numéro devis pour la navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-syne font-bold text-[#1a1a2e] text-sm truncate">{entreprise.nom}</span>
          <span className="text-xs font-manrope text-gray-400">Devis n° {devis.numero}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ═══ DEVIS — composant partagé V3.0b+c (Édition Signature) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <DocumentRender data={documentData} />
        </div>

        {/* ═══ SECTION SIGNATURE ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 space-y-5">
            <div>
              <h2 className="font-syne font-bold text-lg text-[#1a1a2e] mb-1">Signer ce devis</h2>
              <p className="font-manrope text-gray-500 text-sm">
                En signant, vous acceptez les termes et conditions de ce devis.
                {devis.date_validite && ` Ce devis est valable jusqu'au ${formatDate(devis.date_validite)}.`}
              </p>
            </div>

            {/* Nom du signataire */}
            <div>
              <label className="block text-sm font-manrope font-medium text-gray-700 mb-1.5">
                Votre nom complet <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-manrope text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Choix du mode de signature */}
            <div>
              <p className="text-sm font-manrope font-medium text-gray-700 mb-3">Choisissez votre mode de signature :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => { setMode('draw'); setSignError(null) }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === 'draw'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'draw' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <svg className={`w-5 h-5 ${mode === 'draw' ? 'text-blue-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-manrope font-semibold text-sm ${mode === 'draw' ? 'text-blue-700' : 'text-gray-700'}`}>Signature manuscrite</p>
                      <p className="font-manrope text-xs text-gray-500">Dessinez votre signature</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setMode('approve'); setSignatureBase64(null); setSignError(null) }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === 'approve'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'approve' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <svg className={`w-5 h-5 ${mode === 'approve' ? 'text-green-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-manrope font-semibold text-sm ${mode === 'approve' ? 'text-green-700' : 'text-gray-700'}`}>Approbation directe</p>
                      <p className="font-manrope text-xs text-gray-500">Cliquez pour approuver</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Signature pad (mode draw) */}
            {mode === 'draw' && (
              <SignaturePad
                onSignature={setSignatureBase64}
                onClear={() => setSignatureBase64(null)}
              />
            )}

            {/* Error */}
            {signError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm font-manrope">{signError}</p>
              </div>
            )}

            {/* Submit button */}
            {mode && (
              <button
                onClick={handleSign}
                disabled={signing}
                className={`w-full py-3.5 rounded-xl font-manrope font-bold text-white text-sm transition-all ${
                  signing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : mode === 'draw'
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                      : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
                }`}
              >
                {signing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signature en cours...
                  </span>
                ) : mode === 'draw' ? (
                  'Signer ce devis'
                ) : (
                  `J'approuve ce devis — ${formatCurrency(totalTTC)}`
                )}
              </button>
            )}

            {/* Legal text */}
            <p className="text-xs text-gray-400 font-manrope text-center leading-relaxed">
              En signant ce devis, vous reconnaissez avoir pris connaissance de l&apos;ensemble des prestations
              et conditions décrites ci-dessus et vous les acceptez. Cette signature a valeur d&apos;engagement contractuel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-400 font-manrope">
            Propulsé par <a href="https://nexartis.fr" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">Nexartis</a>
          </p>
        </div>
      </div>
    </div>
  )
}
