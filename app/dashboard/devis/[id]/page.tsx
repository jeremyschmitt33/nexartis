'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  SendHorizonal,
  Download,
  FileText,
  Trash2,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  Link2,
} from 'lucide-react'
import { createChantierFromDevis } from '@/lib/services/devis-automatisms'
import EnvoyerDevisModal from '@/components/dashboard/EnvoyerDevisModal'
import LegalMentionsBlock from '@/components/legal/LegalMentionsBlock'
import ProfilIncompletBanner from '@/components/legal/ProfilIncompletBanner'
import {
  useSupabaseRecord,
  useDevisLignes,
  useEntreprise,
  insertRow,
  updateRow,
  softDeleteRow,
  LoadingSkeleton,
} from '@/lib/hooks'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface DevisRecord {
  id: string
  numero: string
  statut: string
  client_id: string
  chantier_id?: string
  date_emission?: string
  date_validite?: string
  date_debut_travaux?: string
  duree_estimee?: string
  conditions_paiement?: string
  acompte_pourcent?: number
  montant_ht?: number
  montant_tva?: number
  objet?: string
  description?: string
  notes_client?: string
  dechets_nature?: string
  dechets_quantite?: string
  dechets_responsable?: string
  dechets_tri?: string
  dechets_collecte_nom?: string
  dechets_collecte_adresse?: string
  dechets_collecte_type?: string
  dechets_cout?: number
  dechets_inclure_cout?: boolean
  date_signature?: string
  signed_by?: string
  client_signature_base64?: string
  signature_token?: string
  created_at: string
  updated_at?: string
}

interface ClientRecord {
  id: string
  nom: string
  prenom?: string
  civilite?: string
  adresse?: string
  code_postal?: string
  ville?: string
  telephone?: string
  email?: string
  client_type?: string
  /** P11 (audit) : SIRET du client à afficher sur devis */
  siret?: string
}

interface LigneRecord {
  id: string
  designation: string
  quantite: number
  unite: string
  prix_unitaire_ht: number
  taux_tva: number
  ordre: number
  type?: string
  niveau?: number
  numero?: string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(d: string | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR')
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  signe: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  facture: 'Facturé',
  finalise: 'Envoyé',
}

const STATUT_STYLES: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  envoye: 'bg-blue-50 text-blue-700',
  signe: 'bg-green-50 text-green-700',
  refuse: 'bg-red-50 text-red-700',
  expire: 'bg-orange-50 text-orange-700',
  facture: 'bg-purple-50 text-purple-700',
  finalise: 'bg-blue-50 text-blue-700',
}

// -------------------------------------------------------------------
// Print styles
// -------------------------------------------------------------------

const printStyles = `
@page { margin: 7mm 9mm; size: A4 portrait; }
@media print {
  nav, header, aside, .no-print, [class*="lg:w-80"],
  [class*="no-print"], button, a[href] { display: none !important; }
  body { background: white !important; margin: 0 !important; padding: 0 !important; }
  html, body { height: auto !important; overflow: visible !important; }
  .min-h-screen { min-height: 0 !important; height: auto !important; }
  .print-zone {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    width: 100% !important;
  }
  .flex-col, .lg\\:flex-row { flex-direction: column !important; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .grid { display: block !important; }
  .grid-cols-2, .grid-cols-1 { display: grid !important; grid-template-columns: 1fr 1fr !important; }
  p, div { orphans: 3; widows: 3; }

  /* ── Compactage titre ── */
  .print-header-block { margin-bottom: 6px !important; }
  .print-devis-title { font-size: 24px !important; letter-spacing: 2px !important; }

  /* ── Compactage dates ── */
  .print-dates { margin-bottom: 8px !important; padding: 4px 0 !important; gap: 12px !important; font-size: 12px !important; }
  .print-dates span { font-size: 12px !important; }

  /* ── Compactage cadres artisan/client ── */
  .print-info-box { padding: 8px !important; }
  .print-info-box > div:first-child { margin-bottom: 4px !important; font-size: 9px !important; }
  .print-info-box > div:nth-child(2) { font-size: 13px !important; margin-bottom: 2px !important; }
  .print-info-lines { line-height: 1.45 !important; font-size: 11.5px !important; }
  .print-info-lines div { font-size: 11.5px !important; line-height: 1.45 !important; }

  /* ── Compactage objet ── */
  .print-zone .mb-4.p-3 { margin-bottom: 6px !important; padding: 5px 8px !important; }

  /* ── Compactage tableau ── */
  .print-table { margin-bottom: 6px !important; }
  .print-table th, .print-table td { padding-top: 3px !important; padding-bottom: 3px !important; padding-left: 6px !important; padding-right: 6px !important; font-size: 11px !important; line-height: 1.3 !important; }
  .print-table thead tr th { padding-top: 4px !important; padding-bottom: 4px !important; font-size: 9.5px !important; }

  /* ── Forcer les backgrounds à l'impression (NET À PAYER bleu, etc.) ── */
  .print-zone { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  .print-net-payer { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; background: #1a6fb5 !important; color: white !important; }

  /* ── Logo print : hauteur alignée au bloc titre, largeur auto ── */
  .print-logo-img { height: 100% !important; width: auto !important; max-width: 120px !important; object-fit: contain !important; }

  /* ── Compactage bas de page ── */
  .print-bottom { gap: 8px !important; margin-bottom: 4px !important; }
  .print-bottom .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
  .print-bottom .py-1\\.5 { padding-top: 3px !important; padding-bottom: 3px !important; }
  .print-bottom .mt-2 { margin-top: 4px !important; }
  .print-bottom .mt-3 { margin-top: 6px !important; }
  .print-bottom .pt-2 { padding-top: 4px !important; }
  .print-bottom h4 { font-size: 11px !important; margin-bottom: 2px !important; }
  .print-bottom p { font-size: 11px !important; line-height: 1.4 !important; }
  .print-bottom span { font-size: 11px !important; }
  .print-bottom .text-lg { font-size: 13px !important; }
  .print-bottom .p-3 { padding: 5px 8px !important; }

  /* ── Compactage signatures ── */
  .print-sigs { margin-top: 6px !important; gap: 8px !important; }
  .print-sig-box { min-height: 52px !important; padding: 6px !important; }
  .print-sig-box .mt-8 { margin-top: 12px !important; }
}`

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function DevisDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: devis, loading: loadingDevis } = useSupabaseRecord<DevisRecord>('devis', id)
  const { data: lignesRaw, loading: loadingLignes } = useDevisLignes(id)
  const { data: client, loading: loadingClient } = useSupabaseRecord<ClientRecord>('clients', devis?.client_id ?? null)

  const loading = loadingDevis || loadingLignes || loadingClient

  const searchParams = useSearchParams()
  const { entreprise } = useEntreprise()
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [convertTriggered, setConvertTriggered] = useState(false)
  const [relanceTriggered, setRelanceTriggered] = useState(false)
  const [chantierCreating, setChantierCreating] = useState(false)

  // Auto-ouvrir modal envoi si ?relance=1 ou ?send=1 (depuis widget "À faire" ou liste devis)
  useEffect(() => {
    if ((searchParams.get('relance') === '1' || searchParams.get('send') === '1') && !loading && devis && !relanceTriggered) {
      setRelanceTriggered(true)
      setSendModalOpen(true)
    }
  }, [searchParams, loading, devis, relanceTriggered])

  // Auto-conversion quand ?convert=1 est dans l'URL (depuis la liste devis)
  useEffect(() => {
    if (searchParams.get('convert') === '1' && devis && !loading && !convertTriggered) {
      setConvertTriggered(true)
      handleConvertToFacture(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devis, loading, searchParams, convertTriggered])

  async function handleConvertToFacture(skipConfirm = false) {
    if (!devis) return
    if (!skipConfirm && !confirm('Convertir ce devis en facture ?')) return
    try {
      const now = new Date()
      const numero = `F-${now.getFullYear()}-${String(Date.now()).slice(-5)}`
      const facture = await insertRow('factures', {
        client_id: devis.client_id || null,
        devis_id: devis.id,
        numero,
        statut: 'brouillon',
        montant_ht: totalHT,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        notes: devis.conditions_paiement || null,
        objet: devis.objet || devis.description || null,
        notes_client: devis.notes_client || null,
        client_nom: client?.nom || null,
        client_adresse: client?.adresse || null,
      })
      const factureId = (facture as Record<string,unknown>).id as string
      if (!factureId) throw new Error('ID facture manquant')
      for (const l of lignes) {
        await insertRow('facture_lignes', {
          facture_id: factureId,
          designation: l.designation,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          taux_tva: l.taux_tva || 10,
          ordre: l.ordre,
          type: l.type || null,
          niveau: l.niveau || null,
          numero: l.numero || null,
        })
      }
      // Marquer le devis comme "Facturé"
      await updateRow('devis', devis.id, { statut: 'facture' })
      router.push(`/dashboard/factures/${factureId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      alert('Erreur conversion : ' + msg)
    }
  }

  async function handleChangeStatut(newStatut: string) {
    if (!devis) return
    try {
      await updateRow('devis', devis.id, { statut: newStatut })
      setToastMsg(`Statut mis à jour : ${STATUT_LABELS[newStatut] ?? newStatut}`)
      setTimeout(() => setToastMsg(null), 3000)
      // Recharger la page pour mettre à jour l'affichage
      window.location.reload()
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    }
  }

  async function handleCreateChantier() {
    if (!devis) return
    setChantierCreating(true)
    try {
      const chantier = await createChantierFromDevis(devis.id)
      const c = chantier as Record<string, unknown>
      router.push(`/dashboard/chantiers/${c.id}`)
    } catch (err) {
      alert('Erreur création chantier : ' + (err instanceof Error ? err.message : 'Échec'))
      setChantierCreating(false)
    }
  }

  async function handleDeleteDevis() {
    if (!devis || !confirm('Envoyer ce devis à la corbeille ?')) return
    try {
      await softDeleteRow('devis', devis.id)
      router.push('/dashboard/devis')
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    }
  }

  // V2.4d : remplace l'ancien window.print() (rendu HTML divergent) par un
  // appel a /api/download-devis qui renvoie exactement le meme PDF jsPDF
  // que celui envoye par email — parite stricte entre les rendus.
  async function handleDownloadDevisPdf() {
    if (!devis) return
    try {
      setToastMsg('Generation du PDF...')
      const res = await fetch('/api/download-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devisId: devis.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.pdfBase64) {
        setToastMsg(json.error || 'Erreur generation PDF')
        setTimeout(() => setToastMsg(null), 3000)
        return
      }
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${json.pdfBase64}`
      link.download = json.filename || `Devis-${devis.numero}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setToastMsg(null)
    } catch (err) {
      console.error('Download devis error:', err)
      setToastMsg('Erreur telechargement PDF')
      setTimeout(() => setToastMsg(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="p-6"><LoadingSkeleton rows={8} /></div>
      </div>
    )
  }

  const lignes = (lignesRaw ?? []) as unknown as LigneRecord[]

  if (!devis) {
    return (
      <div className="min-h-screen p-6">
        <Link href="/dashboard/devis" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors inline-flex items-center gap-2 text-sm text-gray-500">
          <ArrowLeft size={18} /> Retour
        </Link>
        <p className="text-sm font-manrope text-gray-500 mt-4">Devis introuvable.</p>
      </div>
    )
  }

  // Computations
  // V15 — Detection "devis sans TVA" basee UNIQUEMENT sur les taux saisis.
  // Regle simplifiee (cf. consigne 21/05) :
  //   taux === 0 sur toutes les lignes prestation -> sans TVA (mention 293 B affichee)
  //   sinon -> TVA classique (pas de mention)
  // Cas tordu couvert : un AE qui depasse le seuil en cours d'annee peut saisir
  // un taux > 0 — la mention 293 B disparait automatiquement, c'est juridiquement correct.
  // Le helper isAutoEntrepreneur reste utilise UNIQUEMENT pour pre-cocher le taux 0
  // dans les formulaires et pour le footer "Entrepreneur individuel".
  const lignesPrestations = lignes.filter(l => l.type !== 'section' && l.type !== 'sous_section' && l.type !== 'commentaire')
  const allLinesZeroTva = lignesPrestations.length > 0 && lignesPrestations.every(l => l.taux_tva === 0)
  const isSansTva = allLinesZeroTva

  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  let totalHT = 0
  lignes.forEach((l) => {
    const lineTotal = (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
    if (l.type === 'section' || l.type === 'sous_section' || l.type === 'commentaire') return
    totalHT += lineTotal
    if (isSansTva) return
    // Parite PDF (lib/pdf.ts) : meme fallback 20% (taux normal France) si non renseigne
    const rate = l.taux_tva ?? 20
    if (rate <= 0) return
    if (!tvaGroups[rate]) tvaGroups[rate] = { ht: 0, tva: 0 }
    tvaGroups[rate].ht += lineTotal
    tvaGroups[rate].tva += lineTotal * (rate / 100)
  })
  const totalTVA = Object.values(tvaGroups).reduce((s, g) => s + g.tva, 0)
  const totalTTC = totalHT + totalTVA
  // Bug fix (V8) — Detection mode "forfait global" : si toutes les lignes ont
  // un prix unitaire HT a 0 mais que le total HT (devis.montant_ht) est positif,
  // on affiche un bandeau explicatif. Parite stricte avec la facture et le PDF.
  const sumLignesDevis = lignes
    .filter(l => l.type !== 'section' && l.type !== 'sous_section' && l.type !== 'commentaire')
    .reduce((s, l) => s + ((l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)), 0)
  const totalHtDevis = devis.montant_ht ?? totalHT
  const isForfaitMode = totalHtDevis > 0 && sumLignesDevis < 0.01 && lignes.length > 0

  // V11 — Bug fix : meme correction qu'en facture. En mode forfait global,
  // tvaGroups est vide (lignes a 0 EUR). On reconstruit depuis devis.montant_tva
  // pour afficher la ligne TVA dans le recapitulatif.
  const devisMontantTva = devis.montant_tva ?? 0
  if (isForfaitMode && devisMontantTva > 0 && totalHtDevis > 0) {
    const tauxBrut = (devisMontantTva / totalHtDevis) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups[taux] = { ht: totalHtDevis, tva: devisMontantTva }
  }

  // V14 — Bug F (parite facture) : si tvaGroups est vide mais montant_tva > 0
  // (cas mode normal avec lignes ayant taux_tva = null en DB), on reconstruit
  // tvaGroups depuis devis.montant_tva. Sinon la ligne TVA disparait du recap.
  if (Object.keys(tvaGroups).length === 0 && devisMontantTva > 0 && totalHtDevis > 0) {
    const tauxBrut = (devisMontantTva / totalHtDevis) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups[taux] = { ht: totalHtDevis, tva: devisMontantTva }
  }
  const statutStyle = STATUT_STYLES[devis.statut] ?? 'bg-gray-100 text-gray-600'
  const clientNom = client?.nom ?? devis.notes_client?.split(' | ')[0] ?? 'Non renseigné'

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 no-print">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/devis" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeft size={18} className="text-[#6b7280]" />
          </Link>
          <h1 className="font-syne font-bold text-xl text-[#1a1a2e]">Devis {devis.numero}</h1>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${statutStyle}`}>
            {STATUT_LABELS[devis.statut] ?? devis.statut}
          </span>
        </div>
        <div className="flex items-center gap-2 relative flex-wrap">
          <button onClick={handleDownloadDevisPdf} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[#1a1a2e]">
            <Download size={14} /> <span className="hidden xs:inline">Télécharger</span> PDF
          </button>
          <button onClick={() => setSendModalOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[#1a1a2e]">
            <SendHorizonal size={14} /> <span className="hidden xs:inline">Envoyer par</span> email
          </button>
          <button onClick={() => router.push(`/dashboard/devis/${id}/modifier`)} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[#1a1a2e]">
            <Pencil size={14} /> Modifier
          </button>
          <button onClick={() => handleConvertToFacture(false)} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[#1a1a2e]">
            <FileText size={14} /> <span className="hidden xs:inline">Convertir en</span> facture
          </button>
          {devis.signature_token && devis.statut === 'envoye' && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://nexartis.fr/signer/${devis.signature_token}`)
                setToastMsg('Lien de signature copié !')
                setTimeout(() => setToastMsg(null), 3000)
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[#1a1a2e]"
            >
              <Link2 size={14} /> <span className="hidden xs:inline">Copier lien</span> signature
            </button>
          )}
          <button onClick={handleDeleteDevis} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-manrope bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors text-red-600">
            <Trash2 size={14} /> <span className="hidden xs:inline">Supprimer</span>
          </button>
        </div>
      </div>

      {/* V2.4a — Bannière "Mentions légales incomplètes" (composant partagé).
          N'apparaît que si un champ obligatoire (Code de commerce L441-9) manque
          sur le profil entreprise. Ne s'imprime pas (classe no-print). */}
      <ProfilIncompletBanner entreprise={entreprise as Record<string, unknown> | null | undefined} className="mb-5" />

      {/* ── Banderole "À planifier" — visible uniquement si devis accepté sans chantier ── */}
      {devis.statut === 'signe' && !devis.chantier_id && (
        <div className="no-print mb-5 flex items-start gap-4 bg-[#f0fdf4] border border-[#86efac] rounded-xl px-5 py-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#22c55e]/20 flex items-center justify-center mt-0.5">
            <CheckCircle2 size={18} className="text-[#16a34a]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-syne font-bold text-[#15803d]">Devis accepté — à planifier</span>
              <span className="text-[11px] font-manrope font-semibold bg-[#dcfce7] text-[#16a34a] px-2 py-0.5 rounded-full">● Signé</span>
            </div>
            <p className="text-[13px] font-manrope text-[#166534] mb-3 leading-relaxed">
              <strong>{clientNom}</strong>
              {devis.objet && <> · {devis.objet}</>}
              {' '}· <strong>{formatCurrency(totalTTC)}</strong>
              <br />
              <span className="text-[#4ade80] text-[12px]">Ce devis est signé. Créez le chantier associé pour suivre l&apos;avancement et planifier les interventions.</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCreateChantier}
                disabled={chantierCreating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-[13px] font-manrope font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {chantierCreating ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Création...</>
                ) : (
                  <><CheckCircle2 size={14} /> Créer le chantier</>
                )}
              </button>
              <Link
                href="/dashboard/planning"
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#86efac] bg-white hover:bg-[#f0fdf4] text-[#16a34a] text-[13px] font-manrope font-semibold rounded-lg transition-colors"
              >
                <CalendarDays size={14} /> Voir le planning <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main -- preview card */}
        <div className="flex-1 min-w-0">
          <div className="bg-white shadow-xl rounded-xl p-3 sm:p-8 lg:p-12 print-zone">
            <div className="devis-header-block" style={{position:'relative', marginBottom:10, minHeight: 90}}>
              {/* DEVIS + Numéro — centré absolument au milieu de la page */}
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:0, paddingBottom:0}}>
                <div className="print-devis-title" style={{fontSize:38, fontWeight:900, color:'#1a6fb5', letterSpacing:4, textTransform:'uppercase', lineHeight:1}}>DEVIS</div>
                <div style={{fontSize:14, color:'#374151', marginTop:10, lineHeight:1}}>N° <strong>{devis.numero}</strong></div>
              </div>
              {/* Logo — généreux, position absolue à gauche, hauteur agrandie pour mise en valeur (parité facture style Obat) */}
              {Boolean(entreprise?.logo_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(entreprise?.logo_url || '')} alt="Logo" className="print-logo-img" style={{ position:'absolute', left:0, top:0, height:90, width:'auto', maxWidth: 220, objectFit: 'contain', mixBlendMode: 'multiply' }} />
              )}
            </div>

            {/* V5 — Dates AU-DESSUS du trait bleu, juste sous le numéro */}
            <div className="print-dates" style={{display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'16px', marginTop: -4, marginBottom:12, padding:'4px 0'}}>
              <span style={{fontSize:12, color:'#374151'}}>Date : <strong style={{color:'#1a1a2e'}}>{formatDate(devis.date_emission || devis.created_at)}</strong></span>
              {devis.date_validite && <span style={{fontSize:12, color:'#374151'}}>Valide jusqu&apos;au : <strong style={{color:'#1a1a2e'}}>{formatDate(devis.date_validite)}</strong></span>}
              {devis.duree_estimee && <span style={{fontSize:12, color:'#374151'}}>Durée estimée : <strong style={{color:'#1a1a2e'}}>{devis.duree_estimee}</strong></span>}
            </div>

            {/* Trait bleu — séparateur fin du header */}
            <div style={{height:3, background:'#5ab4e0', borderRadius:2, marginBottom:22}} />

            {/* 2 CADRES : artisan gauche, client droite — marges symétriques V5 (trait↔cadre = cadre↔tableau = 22) */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:22, alignItems:'stretch'}}>
              {/* Cadre artisan */}
              <div className="print-info-box" style={{background:'#cde4f5', border:'2px solid #5ab4e0', borderLeft:'5px solid #5ab4e0', borderRadius:8, padding:10, display:'flex', flexDirection:'column'}}>
                <div style={{fontSize:9, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#1a6fb5', marginBottom:6}}>Artisan</div>
                <div style={{fontSize:12, fontWeight:700, color:'#111', marginBottom:3}}>{String(entreprise?.nom || 'Mon Entreprise')}</div>
                <div className="print-info-lines" style={{fontSize:11, color:'#6b7280', lineHeight:1.7}}>
                  {Boolean(entreprise?.adresse) && <div>{String(entreprise?.adresse || '')}</div>}
                  {Boolean(entreprise?.code_postal || entreprise?.ville) && <div>{String(entreprise?.code_postal || '')} {String(entreprise?.ville || '')}</div>}
                  {Boolean(entreprise?.siret) && <div>SIRET : {String(entreprise?.siret || '')}</div>}
                  {Boolean((entreprise as Record<string, unknown> | null | undefined)?.tva_intracommunautaire) && (
                    <div>TVA intracom. : {String((entreprise as Record<string, unknown> | null | undefined)?.tva_intracommunautaire || '')}</div>
                  )}
                  {Boolean(entreprise?.telephone) && <div>Tél : {String(entreprise?.telephone || '')}</div>}
                </div>
              </div>
              {/* Cadre client */}
              <div className="print-info-box" style={{background:'#c9efd5', border:'2px solid #22c55e', borderLeft:'5px solid #22c55e', borderRadius:8, padding:10, display:'flex', flexDirection:'column'}}>
                <div style={{fontSize:9, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#15803d', marginBottom:6}}>Client</div>
                <div className="print-info-lines" style={{lineHeight:1.7}}>
                  {devis.notes_client ? (() => {
                    const parts = devis.notes_client.split(/\s*\|\s*/).map(s=>s.trim()).filter(Boolean)
                    return parts.map((info: string, i: number) => (
                      <div key={i} style={{fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#111' : '#6b7280', fontSize: i === 0 ? 12 : 11}}>
                        {info}
                      </div>
                    ))
                  })() : (
                    <>
                      {/* Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont") */}
                      <div style={{fontWeight:700, color:'#111', fontSize:12}}>{
                        client
                          ? [client.civilite, client.prenom, client.nom].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Non renseigné'
                          : 'Non renseigné'
                      }</div>
                      {client?.adresse && <div style={{color:'#6b7280', fontSize:11}}>{client.adresse}</div>}
                      {(client?.code_postal || client?.ville) && (
                        <div style={{color:'#6b7280', fontSize:11}}>{client?.code_postal ?? ''} {client?.ville ?? ''}</div>
                      )}
                      {client?.siret && <div style={{color:'#6b7280', fontSize:11}}>SIRET : {client.siret}</div>}
                      {client?.telephone && <div style={{color:'#6b7280', fontSize:11}}>{client.telephone}</div>}
                      {client?.email && <div style={{color:'#6b7280', fontSize:11}}>{client.email}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ OBJET — parité facture, bandeau pleine largeur sky pâle, accent gauche bleu ═══ */}
            {devis.objet && (
              <div style={{ marginTop: 14, marginBottom: 18, background: '#e8f4fb', border: '1.5px solid #5ab4e0', borderLeft: '5px solid #5ab4e0', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#2d8bc9', textTransform: 'uppercase', letterSpacing: 1.2 }}>OBJET :</div>
                <div style={{ fontSize: 13, color: '#0f1a3a', fontWeight: 700 }}>{devis.objet}</div>
              </div>
            )}

            {/* FORFAIT GLOBAL (V10) — bandeau bleu (parite design system) si lignes a 0 EUR + total positif */}
            {isForfaitMode && (
              <div style={{ marginBottom: 14, background: '#e8f4fb', border: '1.5px solid #1a6fb5', borderLeft: '5px solid #1a6fb5', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1a6fb5', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>FORFAIT GLOBAL</div>
                <div style={{ fontSize: 12, color: '#5f6c80' }}>Montant total convenu de <strong style={{ color: '#0f1a3a' }}>{formatCurrency(totalHtDevis)} HT</strong>. Le detail ci-dessous est informatif.</div>
              </div>
            )}

            {/* ═══ TABLEAU — plus de marge au-dessus pour aérer (V4) ═══ */}
            {lignes.length > 0 && (
              <table className="w-full mb-8 print-table">
                <thead>
                  <tr className="bg-[#0f1a3a] text-white">
                    <th className="px-2 py-1.5 text-left text-[10px] font-manrope font-semibold uppercase w-8 border-r border-white/30">N°</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-manrope font-semibold uppercase border-r border-white/30">Désignation</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-manrope font-semibold uppercase w-14 border-r border-white/30">Qté</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-manrope font-semibold uppercase w-14 border-r border-white/30">Unité</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-manrope font-semibold uppercase w-20 border-r border-white/30">Prix U. HT</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-manrope font-semibold uppercase w-20">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Helper : calcule le sous-total d'une section (somme des prestations
                    // jusqu'a la prochaine section) ou sous-section (jusqu'a la prochaine
                    // section ou sous-section).
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
                      const numAffiche = l.numero || ''
                      if (l.type === 'section') {
                        // Parité facture/PDF : numero + total HT de section en netBlue (#1a6fb5)
                        return (
                          <tr key={l.id ?? i} className="bg-[#a8d4ec]">
                            <td className="px-2 py-1.5 text-[11px] font-manrope font-bold text-[#1a6fb5]">{numAffiche}</td>
                            <td className="px-2 py-1.5 text-[11px] font-manrope font-bold text-[#0f1a3a]" colSpan={4}>{l.designation}</td>
                            <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-bold text-[#1a6fb5]">{formatCurrency(subtotalAt(i))}</td>
                          </tr>
                        )
                      }
                      if (l.type === 'sous_section') {
                        return (
                          <tr key={l.id ?? i} className="bg-[#dceefa]">
                            <td className="px-2 py-1.5 text-[11px] font-manrope font-semibold text-[#1a6fb5]">{numAffiche}</td>
                            <td className="px-2 py-1.5 text-[11px] font-manrope font-semibold text-[#0f1a3a]" colSpan={4}>{l.designation}</td>
                            <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-semibold text-[#1a6fb5]">{formatCurrency(subtotalAt(i))}</td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={l.id ?? i} className={i % 2 === 1 ? 'bg-[#f8faff]' : ''}>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-[#6b7280] border-r border-gray-100">{numAffiche}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-[#1a1a2e] border-r border-gray-100">{l.designation}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-center text-[#1a1a2e] border-r border-gray-100">{l.quantite}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-center text-[#6b7280] border-r border-gray-100">{l.unite}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-right text-[#1a1a2e] border-r border-gray-100">{formatCurrency(l.prix_unitaire_ht)}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-semibold text-[#1a1a2e]">{formatCurrency(l.quantite * l.prix_unitaire_ht)}</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            )}

            {/* ═══ CONDITIONS + TOTAUX : 2 colonnes côte à côte ═══ */}
            <div className="print-bottom grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 mt-6">
              {/* Gauche : conditions de paiement + mentions légales + déchets (discret en bas) */}
              <div className="space-y-2">
                {/* Conditions de paiement — en premier, c'est le plus important */}
                {devis.conditions_paiement && (
                  <div>
                    <h4 className="font-manrope font-semibold text-xs text-[#1a1a2e] mb-0.5">Conditions de paiement</h4>
                    <p className="text-xs font-manrope text-[#6b7280] leading-relaxed">{devis.conditions_paiement}</p>
                  </div>
                )}
                {/* V2.4a — Mentions légales obligatoires : composant partagé
                    (source unique lib/legal-mentions.ts). Détecte automatiquement
                    le type de client (SIRET → pro, sinon particulier) et applique
                    l'ordre légal devis (décennale → TVA → forme juridique → RCS →
                    qualification → médiateur B2C → rétractation B2C → custom). */}
                <div className="border-t border-gray-100 pt-1.5">
                  <h4 className="font-manrope font-semibold text-[9px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Mentions légales</h4>
                  <LegalMentionsBlock
                    ctx={{
                      kind: 'devis',
                      entreprise: entreprise as Record<string, unknown> | null | undefined,
                      client,
                      clientType: client?.siret && String(client.siret).trim() ? 'pro' : 'particulier',
                      lignes,
                    }}
                    variant="dashboard"
                    className="text-[9px]"
                  />
                </div>
                {/* Déchets — discret, grisé, tout en bas */}
                {(devis.dechets_nature || devis.dechets_quantite || devis.dechets_collecte_nom) && (
                  <div className="border-t border-gray-100 pt-1.5">
                    <h4 className="font-manrope font-semibold text-[9px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Gestion des déchets (AGEC)</h4>
                    <div className="text-[9px] font-manrope text-[#9ca3af] leading-relaxed">
                      {devis.dechets_nature && <span>Nature : {devis.dechets_nature}</span>}
                      {devis.dechets_quantite && <span> · Qté : {devis.dechets_quantite}</span>}
                      {devis.dechets_responsable && <span> · {devis.dechets_responsable}</span>}
                      {devis.dechets_tri && <span> · Tri : {devis.dechets_tri}</span>}
                      {devis.dechets_collecte_nom && <span> · Collecte : {devis.dechets_collecte_nom}{devis.dechets_collecte_type && ` (${devis.dechets_collecte_type})`}</span>}
                      {devis.dechets_cout != null && devis.dechets_cout > 0 && <span> · Coût estimé : {formatCurrency(devis.dechets_cout)} TTC {devis.dechets_inclure_cout ? '(inclus)' : '(informatif)'}</span>}
                    </div>
                  </div>
                )}
              </div>
              {/* Droite : récap (avec acompte intégré) + NET À PAYER en dernier — parité stricte facture */}
              <div>
                <div className="rounded-lg border-2 border-gray-300 bg-gray-100 overflow-hidden shadow-sm">
                  <div className="px-3 py-2 text-[10px] font-manrope font-bold text-[#5f6c80] uppercase tracking-wider border-b border-gray-300 bg-gray-200/60">Récapitulatif</div>
                  {/* V10 — En mode forfait global, on remplace "Sous-total HT" par "Forfait global HT"
                      pour eviter l'incoherence visuelle (lignes a 0 EUR + sous-total positif). */}
                  <div className="px-3 py-2.5 flex justify-between text-sm font-manrope">
                    <span className="text-[#5f6c80]">{isForfaitMode ? 'Forfait global HT' : 'Sous-total HT'}</span>
                    <span className="text-[#0f1a3a] font-bold">{formatCurrency(totalHT)}</span>
                  </div>
                  {/* Bug fix (V8.1) : on filtre rate <= 0 ET tva == 0 pour ne PAS afficher
                      "TVA 10% — 0,00 €" quand le devis est en mode "Sans TVA" ou forfait global a 0. */}
                  {Object.entries(tvaGroups)
                    .filter(([rate, group]) => Number(rate) > 0 && group.tva > 0.005)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([rate, group]) => (
                      <div key={rate} className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                        <span className="text-[#5f6c80]">TVA {rate}%</span>
                        <span className="text-[#0f1a3a]">{formatCurrency(group.tva)}</span>
                      </div>
                    ))}
                  <div className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                    <span className="text-[#0f1a3a] font-bold">Total TTC</span>
                    <span className="text-[#0f1a3a] font-bold">{formatCurrency(totalTTC)}</span>
                  </div>
                  {Boolean(devis.acompte_pourcent && devis.acompte_pourcent > 0) && (
                    <div className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                      <span className="text-[#15803d] font-bold">Acompte à verser ({devis.acompte_pourcent}%)</span>
                      <span className="text-[#15803d] font-bold">- {formatCurrency(totalTTC * ((devis.acompte_pourcent || 0) / 100))}</span>
                    </div>
                  )}
                </div>
                {/* NET À PAYER — toujours la dernière ligne, la plus importante.
                    Si un acompte est demandé, on affiche le solde restant après acompte
                    (label "NET À PAYER À RÉCEPTION" pour éviter la confusion). */}
                {(() => {
                  const acomptePct = devis.acompte_pourcent || 0
                  const hasAcompteDevis = acomptePct > 0
                  const acompteMontant = totalTTC * (acomptePct / 100)
                  const netAPayerDevis = hasAcompteDevis ? Math.max(totalTTC - acompteMontant, 0) : totalTTC
                  const netLabelDevis = hasAcompteDevis ? 'NET À PAYER À RÉCEPTION' : 'NET À PAYER'
                  return (
                    <div className="print-net-payer bg-[#1a6fb5] text-white rounded-lg p-3 mt-2 flex justify-between items-center shadow-md">
                      <span className="font-syne font-bold text-sm">{netLabelDevis}</span>
                      <span className="font-syne font-bold text-lg">{formatCurrency(netAPayerDevis)}</span>
                    </div>
                  )
                })()}
                {/* ═══ SIGNATURES — sous NET À PAYER, 2 cadres identiques ═══ */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {/* Signature artisan */}
                  <div className="border border-gray-300 rounded p-2 flex flex-col items-center justify-center" style={{ height: 70 }}>
                    <div className="text-[8px] font-manrope font-bold text-[#9ca3af] uppercase tracking-widest mb-1">Artisan</div>
                    {(Boolean(entreprise?.signature_base64) || Boolean(entreprise?.tampon_base64)) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(entreprise?.signature_base64 || entreprise?.tampon_base64 || '')}
                        alt={entreprise?.signature_base64 ? 'Signature' : 'Tampon'}
                        className="max-w-full"
                        style={{ height: entreprise?.tampon_base64 && !entreprise?.signature_base64 ? 48 : 42, objectFit: 'contain' }}
                      />
                    ) : null}
                  </div>
                  {/* Signature client */}
                  <div className="border border-gray-300 rounded p-2 flex flex-col items-center justify-center" style={{ height: 70 }}>
                    <div className="text-[8px] font-manrope font-bold text-[#9ca3af] uppercase tracking-widest mb-1">Client</div>
                    {devis.date_signature ? (
                      devis.client_signature_base64 ? (
                        <div className="text-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={devis.client_signature_base64}
                            alt="Signature client"
                            className="max-w-full"
                            style={{ height: 38, objectFit: 'contain' }}
                          />
                          <div className="text-[7px] font-manrope text-[#6b7280] mt-0.5">
                            {new Date(devis.date_signature).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-[9px] font-manrope font-semibold text-green-600">Signé</div>
                          <div className="text-[8px] font-manrope text-[#6b7280]">
                            {new Date(devis.date_signature).toLocaleDateString('fr-FR')}
                            {devis.signed_by && ` — ${devis.signed_by}`}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="text-[8px] font-manrope text-[#c0c0c0] italic">En attente</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ FOOTER LÉGAL ═══ */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid #e5e7eb', fontSize: 9.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5, pageBreakBefore: 'avoid', breakBefore: 'avoid' }}>
              {String(entreprise?.nom || '')} — {String(entreprise?.adresse || '')}, {String(entreprise?.code_postal || '')} {String(entreprise?.ville || '')}
              {Boolean(entreprise?.siret) && ` — SIRET : ${String(entreprise?.siret || '')}`}
              {Boolean(entreprise?.email) && ` — Email : ${String(entreprise?.email || '')}`}
              <br /><span style={{ color: '#d1d5db' }}>Généré via Nexartis — nexartis.fr</span>
            </div>

          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-6 lg:sticky lg:top-24 lg:self-start no-print">
          {/* Infos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-manrope text-[#6b7280]">Statut</span>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-manrope font-medium ${statutStyle}`}>
                {STATUT_LABELS[devis.statut] ?? devis.statut}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-manrope text-[#6b7280]">Client</span>
              <span className="text-sm font-manrope font-medium text-[#1a1a2e]">{clientNom}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="text-sm font-manrope text-[#6b7280]">Créé le</span>
              <span className="text-sm font-manrope text-[#1a1a2e]">{formatDate(devis.created_at)}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="text-sm font-manrope text-[#6b7280]">Total TTC</span>
              <span className="text-lg font-syne font-bold text-[#1a1a2e]">{formatCurrency(totalTTC)}</span>
            </div>
          </div>

          {/* Changer le statut manuellement */}
          {devis.statut !== 'facture' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-manrope font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Changer le statut</p>
              <div className="space-y-2">
                {devis.statut !== 'signe' && (
                  <button
                    onClick={() => handleChangeStatut('signe')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm font-manrope hover:bg-green-100 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    Marquer Accepté
                  </button>
                )}
                {devis.statut !== 'refuse' && (
                  <button
                    onClick={() => handleChangeStatut('refuse')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-manrope hover:bg-red-100 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    Marquer Refuse
                  </button>
                )}
                {devis.statut !== 'envoye' && devis.statut !== 'brouillon' && (
                  <button
                    onClick={() => handleChangeStatut('envoye')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-manrope hover:bg-blue-100 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    Remettre en Envoye
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toastMsg && <div className="fixed bottom-6 right-6 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-manrope z-50">{toastMsg}</div>}

      {devis && (
        <EnvoyerDevisModal
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          devisId={devis.id}
          numeroDevis={devis.numero}
          clientEmail={client?.email ?? (devis.notes_client?.split(' | ').find((s: string) => s.includes('@')) ?? '')}
          chantier={devis.objet || devis.description || ''}
          onSuccess={() => { setToastMsg('Email envoye avec succes !'); setTimeout(() => setToastMsg(null), 3000) }}
        />
      )}
    </div>
  )
}
