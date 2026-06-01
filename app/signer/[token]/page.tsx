'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import LegalMentionsBlock from '@/components/legal/LegalMentionsBlock'
import type { LegalContext } from '@/lib/legal-mentions'

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
        {/* ═══ DEVIS PREVIEW — design harmonisé avec le PDF ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">

            {/* HEADER : logo gauche + DEVIS centré bleu + numéro */}
            <div className="grid grid-cols-3 items-center pb-4 border-b border-gray-100">
              <div className="flex items-center">
                {entreprise.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entreprise.logo_url} alt="Logo" className="h-14 max-w-[120px] object-contain" />
                ) : (
                  <div className="h-14" />
                )}
              </div>
              <div className="text-center">
                <h1 className="font-syne font-extrabold text-3xl sm:text-4xl text-[#2563eb] tracking-tight">DEVIS</h1>
                <p className="font-manrope font-bold text-sm text-[#1a1a2e] mt-1">N° {devis.numero}</p>
              </div>
              <div />
            </div>

            {/* BANDEAU DATES — pas de date de début des travaux : non pertinent
                pour le client (il peut mettre du temps à répondre, la date deviendrait fausse).
                Ce champ reste utilisable côté artisan pour le planning interne. */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 text-xs font-manrope text-gray-600 -mt-2">
              {devis.date_emission && <p><span className="font-semibold">Date :</span> {formatDate(devis.date_emission)}</p>}
              {devis.date_validite && <p><span className="font-semibold">Valide jusqu&apos;au :</span> {formatDate(devis.date_validite)}</p>}
              {devis.duree_estimee && <p><span className="font-semibold">Durée estimée :</span> {devis.duree_estimee}</p>}
            </div>

            {/* CADRES ARTISAN / CLIENT — comme dans le PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg p-4" style={{background:'#cde4f5', border:'1px solid #5ab4e0', borderLeft:'4px solid #5ab4e0'}}>
                <p className="text-[10px] font-manrope font-bold uppercase tracking-wider mb-2" style={{color:'#1a6fb5'}}>Artisan</p>
                <p className="font-manrope font-bold text-[#1a1a2e] text-sm mb-1">{entreprise.nom}</p>
                {entreprise.adresse && <p className="font-manrope text-gray-700 text-xs">{entreprise.adresse}</p>}
                {(entreprise.code_postal || entreprise.ville) && (
                  <p className="font-manrope text-gray-700 text-xs">{entreprise.code_postal} {entreprise.ville}</p>
                )}
                {entreprise.siret && <p className="font-manrope text-gray-700 text-xs mt-1">SIRET : {entreprise.siret}</p>}
                {entreprise.tva_intracommunautaire && (
                  <p className="font-manrope text-gray-700 text-xs">TVA intracom. : {entreprise.tva_intracommunautaire}</p>
                )}
                {entreprise.telephone && <p className="font-manrope text-gray-700 text-xs">Tél : {entreprise.telephone}</p>}
              </div>
              <div className="rounded-lg p-4" style={{background:'#c9efd5', border:'1px solid #22c55e', borderLeft:'4px solid #22c55e'}}>
                <p className="text-[10px] font-manrope font-bold uppercase tracking-wider mb-2" style={{color:'#15803d'}}>Client</p>
                <p className="font-manrope font-bold text-[#1a1a2e] text-sm mb-1">{client.nom}</p>
                {client.adresse && client.adresse.split(/\s*\|\s*/).map(s=>s.trim()).filter(Boolean).map((part,idx)=>(
                  <p key={idx} className="font-manrope text-gray-700 text-xs">{part}</p>
                ))}
                {client.siret && <p className="font-manrope text-gray-700 text-xs mt-1">SIRET : {client.siret}</p>}
                {client.telephone && <p className="font-manrope text-gray-700 text-xs mt-1">{client.telephone}</p>}
                {client.email && <p className="font-manrope text-gray-700 text-xs">{client.email}</p>}
              </div>
            </div>

            {/* OBJET — barre verticale bleue + texte */}
            {devis.objet && (
              <div className="border-l-4 border-[#2563eb] pl-4 py-1">
                <p className="text-[10px] font-manrope font-bold text-[#2563eb] uppercase tracking-wider">Objet</p>
                <p className="font-manrope text-[#1a1a2e] text-sm font-medium mt-0.5">{devis.objet}</p>
              </div>
            )}

            {/* TABLEAU DES LIGNES — header bleu */}
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#2563eb] text-white">
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-left w-[40px]">N°</th>
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-left">Désignation</th>
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-right">Qté</th>
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-right hidden sm:table-cell">Unité</th>
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-right hidden sm:table-cell">Prix U. HT</th>
                    <th className="py-2.5 px-2 sm:px-3 font-manrope font-bold text-[10px] uppercase tracking-wider text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const subtotalAt = (idx: number): number => {
                      const cur = lignes[idx]
                      if (!cur || (cur.type !== 'section' && cur.type !== 'sous_section')) return 0
                      let sum = 0
                      for (let j = idx + 1; j < lignes.length; j++) {
                        const ll = lignes[j]
                        if (cur.type === 'section' && ll.type === 'section') break
                        if (cur.type === 'sous_section' && (ll.type === 'section' || ll.type === 'sous_section')) break
                        if (!ll.type || ll.type === 'prestation') sum += (ll.quantite ?? 0) * (ll.prix_unitaire_ht ?? 0)
                      }
                      return sum
                    }
                    return lignes.map((l, i) => {
                    if (l.type === 'section') {
                      return (
                        <tr key={i} style={{background:'#dceefa', borderLeft:'4px solid #5ab4e0'}}>
                          <td className="py-2.5 px-3 font-manrope font-bold text-xs" style={{color:'#1a6fb5'}}>{i+1}</td>
                          <td colSpan={4} className="py-2.5 px-3 font-manrope font-bold text-sm" style={{color:'#0f1a3a'}}>
                            {l.designation}
                          </td>
                          <td className="py-2.5 px-3 font-manrope font-bold text-right" style={{color:'#1a6fb5'}}>{formatCurrency(subtotalAt(i))}</td>
                        </tr>
                      )
                    }
                    if (l.type === 'sous_section') {
                      return (
                        <tr key={i} style={{background:'#e8f4fb'}}>
                          <td className="py-2.5 px-3 font-manrope text-xs text-gray-600">{i+1}</td>
                          <td colSpan={4} className="py-2.5 px-3 font-manrope font-semibold text-sm" style={{color:'#0f1a3a'}}>
                            {l.designation}
                          </td>
                          <td className="py-2.5 px-3 font-manrope font-semibold text-right" style={{color:'#0f1a3a'}}>{formatCurrency(subtotalAt(i))}</td>
                        </tr>
                      )
                    }
                    if (l.type === 'commentaire') {
                      return (
                        <tr key={i}>
                          <td colSpan={6} className="py-1 px-3 font-manrope text-gray-500 text-xs italic">
                            {l.designation}
                          </td>
                        </tr>
                      )
                    }
                    if (l.type === 'saut_page') return null
                    const montantHT = l.quantite * l.prix_unitaire_ht
                    const lineNum = lignes.slice(0, i + 1).filter(x => x.type !== 'section' && x.type !== 'commentaire' && x.type !== 'saut_page').length
                    return (
                      <tr key={i} className={`border-b border-gray-100 ${l.optionnel ? 'opacity-60' : ''}`}>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-gray-500 text-center">{lineNum}</td>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-[#1a1a2e]">
                          {l.designation}
                          {l.optionnel && <span className="ml-2 text-xs text-orange-500 font-medium">(option)</span>}
                        </td>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-gray-700 text-right">{l.quantite}</td>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-gray-700 text-right hidden sm:table-cell">{l.unite}</td>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-gray-700 text-right hidden sm:table-cell">{formatCurrency(l.prix_unitaire_ht)}</td>
                        <td className="py-2.5 px-2 sm:px-3 font-manrope text-[#1a1a2e] font-medium text-right">{formatCurrency(montantHT)}</td>
                      </tr>
                    )
                  })
                  })()}
                </tbody>
              </table>
            </div>

            {/* SECTION BAS : conditions/mentions à gauche, totaux à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

              {/* COLONNE GAUCHE — Conditions, mentions, déchets */}
              <div className="space-y-4 text-xs font-manrope">
                {devis.conditions_paiement && (
                  <div>
                    <p className="font-bold text-[#1a1a2e] mb-1">Conditions de paiement</p>
                    <p className="text-gray-700 whitespace-pre-line">{devis.conditions_paiement}</p>
                  </div>
                )}
                {/* V2.4c — Mentions légales centralisées via <LegalMentionsBlock>
                    (parité stricte avec PDF + dashboards). Le clientType est déduit
                    de la présence du SIRET : SIRET → 'pro', sinon → 'particulier'. */}
                {(() => {
                  const ctx: LegalContext = {
                    kind: 'devis',
                    entreprise: entreprise as unknown as LegalContext['entreprise'],
                    client: { siret: client.siret || null },
                    clientType: (client.siret && client.siret.trim() !== '') ? 'pro' : 'particulier',
                    lignes,
                  }
                  return (
                    <div>
                      <p className="font-bold text-[#1a1a2e] mb-1 uppercase text-[10px] tracking-wider">Mentions légales</p>
                      <LegalMentionsBlock ctx={ctx} variant="signer" className="text-gray-600" />
                    </div>
                  )
                })()}
                {devis.dechets_nature && (
                  <div>
                    <p className="font-bold text-[#1a1a2e] mb-1 uppercase text-[10px] tracking-wider">Gestion des déchets (AGEC)</p>
                    <p className="text-gray-600 leading-relaxed">
                      {[
                        devis.dechets_nature && `Nature : ${devis.dechets_nature}`,
                        devis.dechets_responsable && devis.dechets_responsable,
                        devis.dechets_tri && `Tri : ${devis.dechets_tri}`,
                        devis.dechets_collecte_nom && `Collecte : ${devis.dechets_collecte_nom}${devis.dechets_collecte_type ? ` (${devis.dechets_collecte_type})` : ''}`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              {/* COLONNE DROITE — Totaux + NET À PAYER (parité stricte devis/facture) */}
              <div className="space-y-1 text-sm font-manrope">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-700">{isSansTva ? 'Total' : 'Total HT'}</span>
                  <span className="text-[#1a1a2e] font-semibold">{formatCurrency(totalHT)}</span>
                </div>
                {!isSansTva && Object.entries(tvaGroups).map(([rate, vals]) => (
                  <div key={rate} className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-700">TVA {rate}%</span>
                    <span className="text-[#1a1a2e]">{formatCurrency(vals.tva)}</span>
                  </div>
                ))}
                {!isSansTva && (
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-[#0f1a3a] font-bold">Total TTC</span>
                    <span className="text-[#0f1a3a] font-bold">{formatCurrency(totalTTC)}</span>
                  </div>
                )}
                {isSansTva && (
                  <p className="text-[11px] font-manrope italic text-gray-500 py-1.5">
                    TVA non applicable, art. 293 B du CGI
                  </p>
                )}
                {/* Acompte (en vert, comme devis/facture HTML) */}
                {devis.acompte_pourcent && devis.acompte_pourcent > 0 && (() => {
                  const baseAcompte = isSansTva ? totalHT : totalTTC
                  const acompte = baseAcompte * devis.acompte_pourcent / 100
                  return (
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-[#15803d] font-bold">Acompte à verser ({devis.acompte_pourcent}%)</span>
                      <span className="text-[#15803d] font-bold">- {formatCurrency(acompte)}</span>
                    </div>
                  )
                })()}
                {/* NET À PAYER (parité devis : netBlue #1a6fb5 + font-syne text-base).
                    Si acompte présent, on affiche le solde restant après acompte
                    (label "NET À PAYER À RÉCEPTION"). */}
                {(() => {
                  const base = isSansTva ? totalHT : totalTTC
                  const acomptePct = devis.acompte_pourcent || 0
                  const hasAcompteSigner = acomptePct > 0
                  const acompteMontant = base * (acomptePct / 100)
                  const netAPayerSigner = hasAcompteSigner ? Math.max(base - acompteMontant, 0) : base
                  const netLabelSigner = hasAcompteSigner ? 'NET À PAYER À RÉCEPTION' : 'NET À PAYER'
                  return (
                    <div className="bg-[#1a6fb5] text-white rounded-md px-3 py-2.5 flex justify-between items-center mt-2 shadow-md">
                      <span className="font-syne font-bold text-sm uppercase tracking-wider">{netLabelSigner}</span>
                      <span className="font-syne font-bold text-base">{formatCurrency(netAPayerSigner)}</span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* CADRES SIGNATURES (artisan / client) — comme PDF */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="border border-gray-200 rounded-lg p-3 min-h-[80px]">
                <p className="text-[10px] font-manrope font-bold text-gray-500 uppercase tracking-wider text-center">Artisan</p>
                {entreprise.signature_base64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entreprise.signature_base64} alt="Signature artisan" className="h-12 mx-auto mt-1 object-contain" />
                )}
              </div>
              <div className="border border-gray-200 rounded-lg p-3 min-h-[80px] flex flex-col items-center justify-center">
                <p className="text-[10px] font-manrope font-bold text-gray-500 uppercase tracking-wider">Client</p>
                {(devis.statut === 'signe' || devis.statut === 'facture') ? (
                  <>
                    {devis.client_signature_base64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={devis.client_signature_base64} alt="Signature client" className="h-12 mx-auto mt-1 object-contain" />
                    ) : (
                      <p className="text-xs font-bold text-green-700 mt-1">Bon pour accord</p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {devis.date_signature ? formatDate(devis.date_signature) : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-xs italic text-gray-400 mt-1">En attente</p>
                )}
              </div>
            </div>

          </div>

          {/* FOOTER — mentions légales artisan (comme dans le PDF) */}
          <div className="border-t border-gray-100 px-6 sm:px-8 py-4 text-center text-[10px] font-manrope text-gray-500 leading-relaxed">
            {entreprise.nom}
            {entreprise.adresse && ` — ${entreprise.adresse}`}
            {(entreprise.code_postal || entreprise.ville) && `, ${entreprise.code_postal || ''} ${entreprise.ville || ''}`}
            {entreprise.siret && ` — SIRET : ${entreprise.siret}`}
            {entreprise.tva_intracommunautaire && ` — TVA intracom. : ${entreprise.tva_intracommunautaire}`}
            {(entreprise.telephone || entreprise.email) && (
              <p className="mt-0.5">
                {entreprise.telephone && `Tél : ${entreprise.telephone}`}
                {entreprise.telephone && entreprise.email && ' — '}
                {entreprise.email && `Email : ${entreprise.email}`}
              </p>
            )}
            {/* V2.4c — Décennale, forme juridique, capital, RCS, médiateur, qualification,
                mentions custom : tout est désormais centralisé dans <LegalMentionsBlock>
                placé plus haut dans la colonne gauche (parité PDF + dashboards). */}
          </div>
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
