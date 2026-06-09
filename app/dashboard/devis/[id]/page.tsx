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
import DocumentRender from '@/components/document/DocumentRender'
import { buildDevisDocument } from '@/lib/document-data'
import { themeFromEntreprise } from '@/lib/document-theme'
import { logoConfigFromEntreprise } from '@/lib/logo-config'
import { fetchAndDownloadPdf } from '@/lib/download-pdf'
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
      // D1 (2026-06-08) : router.refresh() au lieu de window.location.reload()
      // → conserve l'état React local (scroll, modals), revalide juste les Server Components
      router.refresh()
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

  // V3.0d : telechargement PDF cross-platform via helper lib/download-pdf.ts.
  //   - iOS Safari : ouvre le PDF dans un nouvel onglet (impossible de "telecharger"
  //     directement sur iOS sans intervention user). Toast : "Le PDF s'est ouvert
  //     dans Safari, utilise Partager -> Enregistrer dans Fichiers".
  //   - Android / desktop : <a download> + clic synthetique sur Blob URL.
  //     Toast confirmation : "PDF telecharge".
  async function handleDownloadDevisPdf() {
    if (!devis) return
    try {
      setToastMsg('Génération du PDF...')
      const result = await fetchAndDownloadPdf(
        '/api/download-devis',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devisId: devis.id }),
        },
        `Devis-${devis.numero}.pdf`,
      )
      // Toast adapte plateforme : long sur iOS (instructions), court ailleurs (confirmation).
      setToastMsg(result.helpMessage)
      setTimeout(() => setToastMsg(null), result.openedInNewTab ? 6000 : 2500)
    } catch (err) {
      console.error('Download devis error:', err)
      setToastMsg(err instanceof Error ? err.message : 'Erreur téléchargement PDF')
      setTimeout(() => setToastMsg(null), 4000)
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
        <p className="text-sm font-hanken text-gray-500 mt-4">Devis introuvable.</p>
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

  // V3.0b — DocumentData unifie pour le rendu visuel (header + cartes + tableau + recap).
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
    lignes: (lignesRaw ?? []).map((l, idx) => ({
      designation: String((l as Record<string, unknown>).designation ?? ''),
      quantite: Number((l as Record<string, unknown>).quantite ?? 0),
      unite: String((l as Record<string, unknown>).unite ?? ''),
      prix_unitaire_ht: Number((l as Record<string, unknown>).prix_unitaire_ht ?? 0),
      taux_tva: Number((l as Record<string, unknown>).taux_tva ?? 0),
      ordre: Number((l as Record<string, unknown>).ordre ?? idx),
      type: ((l as Record<string, unknown>).type ?? null) as string | null,
      niveau: ((l as Record<string, unknown>).niveau ?? null) as number | null,
      numero: ((l as Record<string, unknown>).numero ?? null) as string | null,
    })),
    client: {
      civilite: client?.civilite ?? null,
      nom: client?.nom ?? null,
      prenom: client?.prenom ?? null,
      adresse: client?.adresse ?? null,
      code_postal: client?.code_postal ?? null,
      ville: client?.ville ?? null,
      telephone: client?.telephone ?? null,
      email: client?.email ?? null,
      siret: client?.siret ?? null,
    },
    entreprise: {
      nom: (entreprise?.nom as string | undefined) ?? null,
      adresse: (entreprise?.adresse as string | undefined) ?? null,
      code_postal: (entreprise?.code_postal as string | undefined) ?? null,
      ville: (entreprise?.ville as string | undefined) ?? null,
      siret: (entreprise?.siret as string | undefined) ?? null,
      tva_intracommunautaire: (entreprise?.tva_intracommunautaire as string | undefined) ?? null,
      telephone: (entreprise?.telephone as string | undefined) ?? null,
      email: (entreprise?.email as string | undefined) ?? null,
      iban: (entreprise?.iban as string | undefined) ?? null,
      bic: (entreprise?.bic as string | undefined) ?? null,
      logo_url: (entreprise?.logo_url as string | undefined) ?? null,
      signature_base64: (entreprise?.signature_base64 as string | undefined) ?? null,
      tampon_base64: (entreprise?.tampon_base64 as string | undefined) ?? null,
      assurance_nom: (entreprise?.assurance_nom as string | undefined) ?? null,
      decennale_numero: (entreprise?.decennale_numero as string | undefined) ?? null,
      assurance_zone: (entreprise?.assurance_zone as string | undefined) ?? null,
      rcs_rm: (entreprise?.rcs_rm as string | undefined) ?? null,
      code_naf: (entreprise?.code_naf as string | undefined) ?? null,
      forme_juridique: (entreprise?.forme_juridique as string | undefined) ?? null,
      mediateur: (entreprise?.mediateur as string | undefined) ?? null,
      mediateur_nom: (entreprise?.mediateur_nom as string | undefined) ?? null,
      mediateur_adresse: (entreprise?.mediateur_adresse as string | undefined) ?? null,
      mediateur_code_postal: (entreprise?.mediateur_code_postal as string | undefined) ?? null,
      mediateur_ville: (entreprise?.mediateur_ville as string | undefined) ?? null,
      auto_entrepreneur: (entreprise?.auto_entrepreneur as boolean | undefined) ?? null,
      franchise_tva: (entreprise?.franchise_tva as boolean | undefined) ?? null,
    },
    chantier: null,
  })

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 no-print">
        <div className="flex items-center gap-3">
          {/* V4 : retour + titre extrabold + status pill premium uppercase tracking */}
          <Link href="/dashboard/devis" className="p-2 rounded-xl hover:bg-[#fafbfc] border border-transparent hover:border-gray-200 transition-colors">
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <h1 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em]">
            Devis <span className="font-spline-mono font-bold">{devis.numero}</span>
          </h1>
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${statutStyle}`}>
            {STATUT_LABELS[devis.statut] ?? devis.statut}
          </span>
        </div>
        {/* V4 : barre d'actions — boutons secondaires sauf "Envoyer email" en primary orange */}
        <div className="flex items-center gap-2 relative flex-wrap">
          <button onClick={handleDownloadDevisPdf} className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-semibold bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all text-[#0f1a3a]">
            <Download size={14} /> <span className="hidden xs:inline">Télécharger</span> PDF
          </button>
          <button onClick={() => setSendModalOpen(true)} className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-bold text-white rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200">
            <SendHorizonal size={14} /> <span className="hidden xs:inline">Envoyer par</span> email
          </button>
          <button onClick={() => router.push(`/dashboard/devis/${id}/modifier`)} className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-semibold bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all text-[#0f1a3a]">
            <Pencil size={14} /> Modifier
          </button>
          <button onClick={() => handleConvertToFacture(false)} className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-semibold bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all text-[#0f1a3a]">
            <FileText size={14} /> <span className="hidden xs:inline">Convertir en</span> facture
          </button>
          {devis.signature_token && devis.statut === 'envoye' && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://nexartis.fr/signer/${devis.signature_token}`)
                setToastMsg('Lien de signature copié !')
                setTimeout(() => setToastMsg(null), 3000)
              }}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-semibold bg-white border-[1.5px] border-gray-200 rounded-xl hover:border-[#ff7a1a] hover:bg-[#fafbfc] transition-all text-[#0f1a3a]"
            >
              <Link2 size={14} /> <span className="hidden xs:inline">Copier lien</span> signature
            </button>
          )}
          <button onClick={handleDeleteDevis} className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-hanken font-semibold bg-white border-[1.5px] border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all text-red-600">
            <Trash2 size={14} /> <span className="hidden xs:inline">Supprimer</span>
          </button>
        </div>
      </div>

      {/* V2.4a — Bannière "Mentions légales incomplètes" (composant partagé).
          N'apparaît que si un champ obligatoire (Code de commerce L441-9) manque
          sur le profil entreprise. Ne s'imprime pas (classe no-print). */}
      <ProfilIncompletBanner entreprise={entreprise as Record<string, unknown> | null | undefined} className="mb-5" />

      {/* V4 : Banderole "Devis accepté — à planifier" — bandeau success premium */}
      {devis.statut === 'signe' && !devis.chantier_id && (
        <div className="no-print mb-5 flex items-start gap-4 bg-emerald-50/80 border border-emerald-200/70 rounded-xl px-5 py-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
            <CheckCircle2 size={18} className="text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-hanken font-extrabold text-emerald-800">Devis accepté — à planifier</span>
              <span className="text-[11px] font-hanken font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Signé</span>
            </div>
            <p className="text-[13px] font-hanken text-emerald-800 mb-3 leading-relaxed">
              <strong>{clientNom}</strong>
              {devis.objet && <> · {devis.objet}</>}
              {' '}· <strong className="font-spline-mono">{formatCurrency(totalTTC)}</strong>
              <br />
              <span className="text-emerald-700/80 text-[12px]">Ce devis est signé. Créez le chantier associé pour suivre l&apos;avancement et planifier les interventions.</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCreateChantier}
                disabled={chantierCreating}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-hanken font-bold rounded-xl shadow-[0_4px_12px_rgba(5,150,105,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {chantierCreating ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Création...</>
                ) : (
                  <><CheckCircle2 size={14} /> Créer le chantier</>
                )}
              </button>
              <Link
                href="/dashboard/planning"
                className="inline-flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-[13px] font-hanken font-bold rounded-xl transition-colors"
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
            <DocumentRender data={documentData} theme={themeFromEntreprise(entreprise)} logoConfig={logoConfigFromEntreprise(entreprise)} />
          </div>
        </div>

        {/* V4 : Sidebar — 2 cartes secondaires (rounded-2xl, bordure subtile, ombre douce) */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-5 lg:sticky lg:top-24 lg:self-start no-print">
          {/* Carte Infos */}
          <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 space-y-4 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-500">Statut</span>
              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider ${statutStyle}`}>
                {STATUT_LABELS[devis.statut] ?? devis.statut}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-500">Client</span>
              <span className="text-sm font-hanken font-semibold text-[#0f1a3a] truncate ml-3">{clientNom}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-500">Créé le</span>
              <span className="text-sm font-spline-mono text-[#0f1a3a]">{formatDate(devis.created_at)}</span>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-500">Total TTC</span>
              <span className="text-lg font-spline-mono font-bold text-[#0f1a3a] tabular-nums">{formatCurrency(totalTTC)}</span>
            </div>
          </div>

          {/* Carte "Changer le statut" */}
          {devis.statut !== 'facture' && (
            <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
              <p className="text-[11.5px] font-hanken font-bold text-[#ff7a1a] uppercase tracking-[0.12em] mb-3">Changer le statut</p>
              <div className="space-y-2">
                {devis.statut !== 'signe' && (
                  <button
                    onClick={() => handleChangeStatut('signe')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-emerald-200 bg-emerald-50/80 text-emerald-700 text-sm font-hanken font-semibold hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    Marquer Accepté
                  </button>
                )}
                {devis.statut !== 'refuse' && (
                  <button
                    onClick={() => handleChangeStatut('refuse')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-red-200 bg-red-50/80 text-red-700 text-sm font-hanken font-semibold hover:bg-red-100 hover:border-red-300 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    Marquer Refuse
                  </button>
                )}
                {devis.statut !== 'envoye' && devis.statut !== 'brouillon' && (
                  <button
                    onClick={() => handleChangeStatut('envoye')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-blue-200 bg-blue-50/80 text-blue-700 text-sm font-hanken font-semibold hover:bg-blue-100 hover:border-blue-300 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    Remettre en Envoyé
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* V4 : toast premium, navy fond, ombre douce */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-5 py-3 rounded-xl shadow-[0_12px_32px_rgba(15,26,58,0.25)] text-sm font-hanken font-semibold z-50">
          {toastMsg}
        </div>
      )}

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
