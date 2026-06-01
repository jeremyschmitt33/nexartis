'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  Send,
  RotateCcw,
  AlertTriangle,
  CreditCard,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  X,
  Pencil,
} from 'lucide-react'
import EnvoyerFactureModal from '@/components/dashboard/EnvoyerFactureModal'
import LegalMentionsBlock from '@/components/legal/LegalMentionsBlock'
import ProfilIncompletBanner from '@/components/legal/ProfilIncompletBanner'
import {
  useSupabaseRecord,
  useFactureLignes,
  useEntreprise,
  updateRow,
  LoadingSkeleton,
} from '@/lib/hooks'

interface FactureRecord {
  id: string
  numero: string
  statut: string
  client_id: string
  chantier_id?: string
  devis_id?: string
  date_emission?: string
  date_echeance?: string
  date_envoi?: string
  montant_ht?: number
  montant_tva?: number
  montant_ttc?: number
  montant_paye?: number
  notes?: string
  notes_personnalisees?: string
  objet?: string
  client_nom?: string
  client_adresse?: string
  client_telephone?: string
  client_email?: string
  notes_client?: string
  conditions_paiement?: string
  acompte_pourcent?: number
  acompte_montant_ht?: number
  acompte_montant_ttc?: number
  acompte_label?: string
  created_at: string
  updated_at?: string
}

const DEFAULT_CONDITIONS_PAIEMENT =
  'Méthodes de paiement acceptées : Virement bancaire, Chèque.'

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
  /** P11 (audit) : SIRET du client à afficher sur facture (art. L441-9 C. comm.) */
  siret?: string
}

interface LigneRecord {
  id: string
  designation: string
  unite: string
  quantite: number
  prix_unitaire_ht: number
  total_ht: number
  taux_tva?: number
  ordre: number
  type?: string
  niveau?: number
  numero?: string
}

const STATUT_STYLES: Record<string, string> = {
  'Encaissée': 'bg-green-50 text-green-700 border-green-200',
  'payee': 'bg-green-50 text-green-700 border-green-200',
  'Partiellement payée': 'bg-blue-50 text-blue-700 border-blue-200',
  'partielle': 'bg-blue-50 text-blue-700 border-blue-200',
  'En attente': 'bg-orange-50 text-orange-700 border-orange-200',
  'En retard': 'bg-red-50 text-red-700 border-red-200',
  'en_retard': 'bg-red-50 text-red-700 border-red-200',
  'archivee': 'bg-gray-100 text-gray-500 border-gray-200',
  'brouillon': 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUT_LABELS: Record<string, string> = {
  'payee': 'Encaissée',
  'partielle': 'Partiellement payée',
  'en_retard': 'En retard',
  'archivee': 'Archivée',
  'brouillon': 'Brouillon',
  'En attente': 'En attente',
  'Encaissée': 'Encaissée',
}

export default function FactureDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data: facture, loading: loadingFacture } = useSupabaseRecord<FactureRecord>('factures', id)
  const { data: lignesRaw, loading: loadingLignes } = useFactureLignes(id)
  const { data: client, loading: loadingClient } = useSupabaseRecord<ClientRecord>('clients', facture?.client_id ?? null)
  const { data: devisSource } = useSupabaseRecord<{ notes_client?: string }>('devis', facture?.devis_id ?? null)
  const { entreprise } = useEntreprise()

  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf() {
    if (!facture || downloading) return
    setDownloading(true)
    try {
      const res = await fetch('/api/download-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factureId: facture.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert('Erreur : ' + (data.error || 'Échec du téléchargement'))
        return
      }
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `Facture-${facture.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    } finally {
      setDownloading(false)
    }
  }

  async function handleMarkPaid() {
    if (!facture || updating) return
    setUpdating(true)
    try {
      await updateRow('factures', facture.id, {
        statut: 'payee',
        montant_paye: facture.montant_ttc || 0,
        date_paiement: new Date().toISOString(),
      })
      setToastMsg('Facture marquée comme payée !')
      setTimeout(() => setToastMsg(null), 3000)
      window.location.reload()
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    } finally { setUpdating(false) }
  }

  async function handleArchive() {
    if (!facture || updating) return
    setUpdating(true)
    try {
      await updateRow('factures', facture.id, { statut: 'archivee', archivee: true })
      setToastMsg('Facture archivée !')
      setTimeout(() => setToastMsg(null), 3000)
      window.location.reload()
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    } finally { setUpdating(false) }
  }

  async function handleUnarchive() {
    if (!facture || updating) return
    setUpdating(true)
    try {
      await updateRow('factures', facture.id, { statut: 'payee', archivee: false })
      setToastMsg('Facture désarchivée !')
      setTimeout(() => setToastMsg(null), 3000)
      window.location.reload()
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'Échec'))
    } finally { setUpdating(false) }
  }

  const loading = loadingFacture || loadingLignes || loadingClient

  if (loading) return <div className="space-y-6"><LoadingSkeleton rows={8} /></div>

  if (!facture) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/factures" className="p-2 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2 text-sm text-gray-500">
          <ArrowLeft size={20} /> Retour
        </Link>
        <p className="text-sm font-manrope text-gray-500">Facture introuvable.</p>
      </div>
    )
  }

  const lignes = lignesRaw as unknown as LigneRecord[]
  // Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont")
  const resolvedClientName = client
    ? [client.civilite, client.prenom, client.nom].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    : facture.client_nom || devisSource?.notes_client?.split(' | ')[0] || 'Non renseigné'
  const totalHT = facture.montant_ht ?? lignes.reduce((s, l) => s + (l.total_ht ?? 0), 0)
  const totalTVA = facture.montant_tva ?? 0
  const totalTTC = facture.montant_ttc ?? totalHT + totalTVA
  const totalPaye = facture.montant_paye ?? 0
  const resteAPayer = totalTTC - totalPaye
  const paymentPercent = totalTTC > 0 ? Math.round((totalPaye / totalTTC) * 100) : 0
  // Acompte versé (style Obat : sous-total brut, acompte, net à payer)
  const acompteTTC =
    facture.acompte_montant_ttc !== undefined && facture.acompte_montant_ttc !== null
      ? facture.acompte_montant_ttc
      : (facture.acompte_pourcent && facture.acompte_pourcent > 0
        ? totalTTC * (facture.acompte_pourcent / 100)
        : 0)
  const hasAcompte = acompteTTC > 0
  const netAPayerAffiche = hasAcompte ? Math.max(totalTTC - acompteTTC, 0) : totalTTC
  // Conditions et notes
  const conditionsAffichees = (facture.conditions_paiement && facture.conditions_paiement.trim())
    || (facture.notes && facture.notes.trim())
    || DEFAULT_CONDITIONS_PAIEMENT
  const notesPersoAffichees = facture.notes_personnalisees && facture.notes_personnalisees.trim()
    ? facture.notes_personnalisees
    : ''

  const statutLabel = STATUT_LABELS[facture.statut] ?? facture.statut
  const statutStyle = STATUT_STYLES[facture.statut] ?? 'bg-gray-100 text-gray-600 border-gray-200'

  const fmt = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0)
  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

  // TVA groups
  // V15 — Detection "facture sans TVA" basee UNIQUEMENT sur les taux saisis.
  // Regle simplifiee (cf. consigne 21/05) :
  //   taux === 0 sur toutes les lignes prestation -> sans TVA (mention 293 B affichee)
  //   sinon -> TVA classique (pas de mention)
  // Le helper isAutoEntrepreneur reste utile pour pre-cocher 0 dans les formulaires
  // et pour le footer "Entrepreneur individuel", mais ne pilote PLUS l'affichage TVA.
  const lignesPrestations = lignes.filter(l => !l.designation?.startsWith('---') && l.type !== 'section' && l.type !== 'sous_section' && l.type !== 'commentaire')
  const allLinesZeroTva = lignesPrestations.length > 0 && lignesPrestations.every(l => l.taux_tva === 0)
  const isSansTva = allLinesZeroTva

  const tvaGroups: Record<number, { ht: number; tva: number }> = {}
  if (!isSansTva) {
    lignes.forEach(l => {
      if (l.designation?.startsWith('---')) return
      if (l.type === 'section' || l.type === 'sous_section' || l.type === 'commentaire') return
      // Parite PDF (lib/pdf.ts) : meme fallback 20% (taux normal France) si non renseigne
      const rate = l.taux_tva ?? 20
      if (rate <= 0) return
      const ht = l.total_ht || (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0)
      if (!tvaGroups[rate]) tvaGroups[rate] = { ht: 0, tva: 0 }
      tvaGroups[rate].ht += ht
      tvaGroups[rate].tva += ht * rate / 100
    })
  }

  // Bug fix (V8) — Detection mode "forfait global" : si toutes les lignes ont
  // un prix unitaire HT a 0 mais que le total HT est positif, c'est que l'artisan
  // a saisi un montant forfaitaire global. On affiche un bandeau explicatif pour
  // eviter la confusion (lignes a 0 EUR + total a 40 000 EUR).
  const sumLignes = lignes
    .filter(l => l.type !== 'section' && l.type !== 'sous_section' && l.type !== 'commentaire')
    .reduce((s, l) => s + (l.quantite ?? 0) * (l.prix_unitaire_ht ?? 0), 0)
  const isForfaitMode = totalHT > 0 && sumLignes < 0.01 && lignes.length > 0

  // V11 — Bug fix : en mode forfait global, les lignes sont a 0 EUR donc tvaGroups
  // est vide. La ligne TVA disparaissait du recap (filtre g.tva > 0.005 ligne 550)
  // alors que facture.montant_tva > 0 (ex: forfait 3000 HT + TVA 10% = 3300 TTC).
  // On reconstruit tvaGroups depuis facture.montant_tva en deduisant le taux.
  if (isForfaitMode && totalTVA > 0 && totalHT > 0) {
    const tauxBrut = (totalTVA / totalHT) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups[taux] = { ht: totalHT, tva: totalTVA }
  }

  // V12 — Bug fix : meme probleme en mode normal. Si les lignes existent mais
  // que taux_tva est null sur toutes (legacy ou import), tvaGroups reste vide
  // et la ligne TVA disparait du recap alors que facture.montant_tva > 0.
  // Fallback : reconstruire un seul groupe TVA depuis le montant total.
  if (!isSansTva && Object.keys(tvaGroups).length === 0 && facture.montant_tva && facture.montant_tva > 0 && totalHT > 0) {
    const tauxBrut = (facture.montant_tva / totalHT) * 100
    const taux = Math.round(tauxBrut * 10) / 10
    tvaGroups[taux] = { ht: totalHT, tva: facture.montant_tva }
  }

  // V2.4a — Les mentions TVA automatiques (293 B / 10% / 5.5%) sont désormais
  // rendues par <LegalMentionsBlock> (source unique lib/legal-mentions.ts).
  // Les constantes locales TVA_MENTION_10/5_5/AE et l'array tvaMentions ont
  // été supprimées d'ici pour éviter toute divergence avec le PDF.

  const printStyles = `@media print {
    nav, header, aside, .no-print, .sidebar-col { display: none !important; }
    body { background: white !important; }
    .print-zone { box-shadow: none !important; border: none !important; margin: 0 !important; }
  }`

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/factures" className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-syne font-bold text-[#0f1a3a]">Facture {facture.numero}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-manrope font-medium border ${statutStyle}`}>{statutLabel}</span>
            </div>
            <p className="text-sm font-manrope text-gray-500 mt-1">{resolvedClientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadPdf} disabled={downloading} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-manrope text-[#1a1a2e] transition-colors disabled:opacity-50">
            <Download size={14} /> {downloading ? 'Téléchargement...' : 'Télécharger PDF'}
          </button>
          <button onClick={() => setSendModalOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1a6fb5] hover:bg-[#2d8bc9] text-white text-sm font-manrope transition-colors">
            <Send size={14} /> Envoyer par email
          </button>
          {facture.statut === 'brouillon' ? (
            <Link href={`/dashboard/factures/${facture.id}/modifier`} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-manrope text-[#1a1a2e] transition-colors">
              <Pencil size={14} /> Modifier
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Facture émise : modification interdite par la loi (art. L441-9 C. comm.). Créez un avoir pour corriger."
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-gray-50 text-sm font-manrope text-gray-400 cursor-not-allowed"
            >
              <Pencil size={14} /> Modifier (verrouillée)
            </button>
          )}
          {facture.statut !== 'payee' && facture.statut !== 'Encaissée' && facture.statut !== 'archivee' && (
            <button onClick={handleMarkPaid} disabled={updating} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-sm font-manrope text-green-700 transition-colors disabled:opacity-50">
              <CreditCard size={14} /> Marquer payée
            </button>
          )}
          {(facture.statut === 'payee' || facture.statut === 'Encaissée') && (
            <button onClick={handleArchive} disabled={updating} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-manrope text-[#1a1a2e] transition-colors disabled:opacity-50">
              <RotateCcw size={14} /> Archiver
            </button>
          )}
          {facture.statut === 'archivee' && (
            <button onClick={handleUnarchive} disabled={updating} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-sm font-manrope text-blue-700 transition-colors disabled:opacity-50">
              <RotateCcw size={14} /> Désarchiver
            </button>
          )}
          {facture.statut !== 'payee' && facture.statut !== 'Encaissée' && facture.statut !== 'archivee' && (
            <button onClick={() => setSendModalOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-sm font-manrope text-orange-700 transition-colors">
              <AlertTriangle size={14} /> Relancer
            </button>
          )}
        </div>
      </div>

      {/* V2.4a — Bannière "Mentions légales incomplètes" (composant partagé).
          N'apparaît que si un champ obligatoire (Code de commerce L441-9) manque
          sur le profil entreprise. Ne s'imprime pas (classe no-print). */}
      <ProfilIncompletBanner entreprise={entreprise as Record<string, unknown> | null | undefined} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Invoice preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-8 print-zone">

            {/* HEADER — Logo + FACTURE centré (parité PDF) */}
            <div style={{position:'relative', marginBottom:10, minHeight: 60}}>
              {/* FACTURE + Numéro + Date — centré au milieu de la page (parité PDF : sobre, sans letter-spacing massif) */}
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:0, paddingBottom:0}}>
                <div style={{fontSize:28, fontWeight:700, color:'#1a6fb5', textTransform:'uppercase', lineHeight:1}}>FACTURE</div>
                <div style={{fontSize:12, color:'#6b7280', marginTop:6, lineHeight:1}}>N° <strong>{facture.numero}</strong></div>
                <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 4 }}>
                  Date : {formatDate(facture.date_emission || facture.created_at)}
                  {(facture as FactureRecord & { date_prestation?: string }).date_prestation && ` | Prestation : ${formatDate((facture as FactureRecord & { date_prestation?: string }).date_prestation)}`}
                  {facture.date_echeance && ` | Échéance : ${formatDate(facture.date_echeance)}`}
                </div>
              </div>
              {/* Logo — sobre, position absolue à gauche (parité PDF : hauteur 60px ≈ 22mm) */}
              {Boolean(entreprise?.logo_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(entreprise?.logo_url || '')} alt="Logo" style={{ position:'absolute', left:0, top:0, height:60, width:'auto', maxWidth: 90, objectFit: 'contain' }} />
              )}
            </div>

            <div style={{height:3, background:'#5ab4e0', borderRadius:2, marginBottom:22}} />

            {/* Cadres Artisan + Client — parité PDF (fond pâle, bordure 1px, accent gauche 3px) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22, alignItems: 'stretch' }}>
              {/* Cadre artisan — fond sky très pâle + bordure 1px + accent gauche 3px */}
              <div style={{ background: '#e6f3fb', border: '1px solid #5ab4e0', borderLeft: '3px solid #5ab4e0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#1a6fb5', marginBottom: 6 }}>Artisan</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 3 }}>{String(entreprise?.nom || 'Mon Entreprise')}</div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7 }}>
                  {Boolean(entreprise?.adresse) && <div>{String(entreprise?.adresse || '')}</div>}
                  {Boolean(entreprise?.code_postal || entreprise?.ville) && <div>{String(entreprise?.code_postal || '')} {String(entreprise?.ville || '')}</div>}
                  {Boolean(entreprise?.siret) && <div>SIRET : {String(entreprise?.siret || '')}</div>}
                  {Boolean((entreprise as Record<string, unknown> | null | undefined)?.tva_intracommunautaire) && (
                    <div>TVA intracom. : {String((entreprise as Record<string, unknown> | null | undefined)?.tva_intracommunautaire || '')}</div>
                  )}
                  {Boolean(entreprise?.telephone) && <div>Tel : {String(entreprise?.telephone || '')}</div>}
                </div>
              </div>
              {/* Cadre client — fond green très pâle + bordure 1px + accent gauche 3px (parité PDF) */}
              <div style={{ background: '#e6f7eb', border: '1px solid #22c55e', borderLeft: '3px solid #22c55e', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#15803d', marginBottom: 6 }}>Client</div>
                <div style={{ lineHeight: 1.7 }}>
                  {facture.notes_client ? (() => {
                    // Parité PDF : split UNIQUEMENT par "|" (pas de séparation email/tél/CP)
                    const parts = facture.notes_client
                      .split(/\s*\|\s*/)
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                    return parts.map((info: string, i: number) => (
                      <div key={i} style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#111' : '#6b7280', fontSize: i === 0 ? 12 : 11 }}>
                        {info}
                      </div>
                    ))
                  })() : (
                    <>
                      <div style={{ fontWeight: 700, color: '#111', fontSize: 12 }}>{resolvedClientName}</div>
                      {client?.adresse && <div style={{ color: '#6b7280', fontSize: 11 }}>{client.adresse}</div>}
                      {(client?.code_postal || client?.ville) && (
                        <div style={{ color: '#6b7280', fontSize: 11 }}>{client?.code_postal ?? ''} {client?.ville ?? ''}</div>
                      )}
                      {client?.siret && <div style={{ color: '#6b7280', fontSize: 11 }}>SIRET : {client.siret}</div>}
                      {client?.telephone && <div style={{ color: '#6b7280', fontSize: 11 }}>{client.telephone}</div>}
                      {client?.email && <div style={{ color: '#6b7280', fontSize: 11 }}>{client.email}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* (titre FACTURE déplacé dans le header au-dessus) */}

            {/* Objet — bandeau pleine largeur sky pâle, accent gauche bleu (parité PDF) */}
            {facture.objet && (
              <div style={{ marginTop: 14, marginBottom: 18, background: '#e8f4fb', border: '1.5px solid #5ab4e0', borderLeft: '5px solid #5ab4e0', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#2d8bc9', textTransform: 'uppercase', letterSpacing: 1.2 }}>OBJET :</div>
                <div style={{ fontSize: 13, color: '#0f1a3a', fontWeight: 700 }}>{facture.objet}</div>
              </div>
            )}

            {/* FORFAIT GLOBAL (V10) — bandeau bleu (parite design system) si lignes a 0 EUR + total positif */}
            {isForfaitMode && (
              <div style={{ marginBottom: 14, background: '#e8f4fb', border: '1.5px solid #1a6fb5', borderLeft: '5px solid #1a6fb5', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1a6fb5', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>FORFAIT GLOBAL</div>
                <div style={{ fontSize: 12, color: '#5f6c80' }}>Montant total convenu de <strong style={{ color: '#0f1a3a' }}>{fmt(totalHT)} HT</strong>. Le detail ci-dessous est informatif.</div>
              </div>
            )}

            {/* TABLEAU — bandeau navy (parité PDF) */}
            {lignes.length > 0 && (
              <table className="w-full mb-8 print-table">
                <thead>
                  <tr className="bg-[#0f1a3a] text-white">
                    <th className="px-2 py-1.5 text-left text-[10px] font-manrope font-semibold uppercase w-8 border-r border-white/30">N°</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-manrope font-semibold uppercase border-r border-white/30">Désignation</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-manrope font-semibold uppercase w-14 border-r border-white/30">Qté</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-manrope font-semibold uppercase w-14 border-r border-white/30">Unité</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-manrope font-semibold uppercase w-20 border-r border-white/30">Prix U. HT</th>
                    {/* V2.5 — Colonne TVA par ligne (parite Obat / PDF) */}
                    <th className="px-2 py-1.5 text-center text-[10px] font-manrope font-semibold uppercase w-14 border-r border-white/30">TVA</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-manrope font-semibold uppercase w-20">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne, i) => {
                    // Helper : calcule le sous-total d'une section ou sous-section
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
                    if (ligne.type === 'section') {
                      // Parité PDF : numéro + total en #1a6fb5 (netBlue), designation en #0f1a3a (navy)
                      return (
                        <tr key={ligne.id ?? i} className="bg-[#a8d4ec]">
                          <td className="px-2 py-1.5 text-[11px] font-manrope font-bold text-[#1a6fb5]">{ligne.numero || ''}</td>
                          {/* V2.5 — colSpan etendu (5 au lieu de 4) suite a l'ajout de la colonne TVA */}
                          <td className="px-2 py-1.5 text-[11px] font-manrope font-bold text-[#0f1a3a]" colSpan={5}>{ligne.designation}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-bold text-[#1a6fb5]">{fmt(subtotalAt(i))}</td>
                        </tr>
                      )
                    }
                    if (ligne.type === 'sous_section') {
                      return (
                        <tr key={ligne.id ?? i} className="bg-[#dceefa]">
                          <td className="px-2 py-1.5 text-[11px] font-manrope font-semibold text-[#1a6fb5]">{ligne.numero || ''}</td>
                          {/* V2.5 — colSpan etendu (5 au lieu de 4) suite a l'ajout de la colonne TVA */}
                          <td className="px-2 py-1.5 text-[11px] font-manrope font-semibold text-[#0f1a3a]" colSpan={5}>{ligne.designation}</td>
                          <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-semibold text-[#1a6fb5]">{fmt(subtotalAt(i))}</td>
                        </tr>
                      )
                    }
                    if (ligne.type === 'commentaire') {
                      return (
                        <tr key={ligne.id ?? i}>
                          <td className="px-3 py-1.5 text-xs font-manrope text-[#6b7280]" />
                          {/* V2.5 — colSpan etendu (6 au lieu de 5) suite a l'ajout de la colonne TVA */}
                          <td className="px-3 py-1.5 text-xs font-manrope italic text-[#6b7280]" colSpan={6}>{ligne.designation}</td>
                        </tr>
                      )
                    }
                    if (ligne.type === 'saut_page') {
                      // V2.5 — colSpan etendu (7 au lieu de 6) suite a l'ajout de la colonne TVA
                      return <tr key={ligne.id ?? i}><td colSpan={7} className="py-1 border-t border-dashed border-gray-300" /></tr>
                    }
                    // backward compat : ancien format ---
                    const isLegacySection = !ligne.type && ligne.designation?.startsWith('---')
                    if (isLegacySection) {
                      return (
                        <tr key={ligne.id ?? i} className="bg-[#dceefa] border-l-4 border-[#5ab4e0]">
                          {/* V2.5 — colSpan etendu (7 au lieu de 6) suite a l'ajout de la colonne TVA */}
                          <td colSpan={7} className="px-3 py-2 text-sm font-manrope font-bold text-[#0f1a3a]">{ligne.designation.replace(/^---\s*/, '').replace(/\s*---$/, '')}</td>
                        </tr>
                      )
                    }
                    return (
                      // Parité PDF : pas de zébrage sur les lignes prestation
                      <tr key={ligne.id ?? i}>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-[#6b7280] border-r border-gray-100">{ligne.numero || ''}</td>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-[#1a1a2e] border-r border-gray-100">{ligne.designation}</td>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-center text-[#1a1a2e] border-r border-gray-100">{ligne.quantite}</td>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-center text-[#6b7280] border-r border-gray-100">{ligne.unite}</td>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-right text-[#1a1a2e] border-r border-gray-100">{fmt(ligne.prix_unitaire_ht ?? 0)}</td>
                        {/* V2.5 — Colonne TVA par ligne (parite Obat / PDF) */}
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-center text-[#6b7280] border-r border-gray-100">{(ligne.taux_tva ?? 0).toString().replace('.', ',')}%</td>
                        <td className="px-2 py-1.5 text-[11px] font-manrope text-right font-semibold text-[#1a1a2e]">{fmt(ligne.total_ht || (ligne.quantite ?? 0) * (ligne.prix_unitaire_ht ?? 0))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* TOTAUX (parité PDF) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 mt-6">
              {/* Colonne gauche : conditions de paiement + notes personnalisées + mentions */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-manrope font-bold text-sm text-[#1a6fb5] mb-1.5">Conditions de paiement</h4>
                  <p className="text-sm font-manrope text-[#5f6c80] leading-relaxed whitespace-pre-wrap">{conditionsAffichees}</p>
                </div>
                {Boolean(notesPersoAffichees) && (
                  <div>
                    <h4 className="font-manrope font-bold text-sm text-[#1a6fb5] mb-1.5">Notes</h4>
                    <p className="text-sm font-manrope text-[#0f1a3a] leading-relaxed whitespace-pre-wrap">{notesPersoAffichees}</p>
                  </div>
                )}
                {/* V2.4a — La liste complète des mentions légales (pénalités,
                    escompte, TVA, L441-3, etc.) est maintenant rendue UNE seule
                    fois plus bas via <LegalMentionsBlock>, en remplacement de
                    l'ancien bloc "MENTIONS LÉGALES entreprise". On évite ainsi
                    la duplication / divergence entre ces 2 blocs historiques. */}
              </div>

              {/* Colonne droite : récap (avec acompte intégré) + NET À PAYER en dernier */}
              <div>
                <div className="rounded-lg border-2 border-gray-300 bg-gray-100 overflow-hidden shadow-sm">
                  <div className="px-3 py-2 text-[10px] font-manrope font-bold text-[#5f6c80] uppercase tracking-wider border-b border-gray-300 bg-gray-200/60">Récapitulatif</div>
                  {/* V10 — En mode forfait global, on remplace "Sous-total HT" par "Forfait global HT"
                      pour eviter l'incoherence visuelle (lignes a 0 EUR + sous-total positif). */}
                  <div className="px-3 py-2.5 flex justify-between text-sm font-manrope">
                    <span className="text-[#5f6c80]">{isForfaitMode ? 'Forfait global HT' : 'Sous-total HT'}</span>
                    <span className="text-[#0f1a3a] font-bold">{fmt(totalHT)}</span>
                  </div>
                  {/* Bug fix (V8.1) : on filtre rate <= 0 ET tva == 0 pour ne PAS afficher
                      "TVA 10% — 0,00 €" quand la facture est en mode "Sans TVA" ou forfait global a 0. */}
                  {Object.entries(tvaGroups)
                    .filter(([r, g]) => Number(r) > 0 && g.tva > 0.005)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([rate, group]) => (
                      <div key={rate} className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                        <span className="text-[#5f6c80]">TVA {rate}%</span>
                        <span className="text-[#0f1a3a]">{fmt(group.tva)}</span>
                      </div>
                    ))}
                  <div className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                    <span className="text-[#0f1a3a] font-bold">Total TTC</span>
                    <span className="text-[#0f1a3a] font-bold">{fmt(totalTTC)}</span>
                  </div>
                  {hasAcompte && (
                    <div className="px-3 py-2.5 flex justify-between text-sm font-manrope border-t border-gray-300">
                      <span className="text-[#15803d] font-bold">
                        Acompte versé{facture.acompte_pourcent ? ` (${facture.acompte_pourcent}%)` : ''}
                      </span>
                      <span className="text-[#15803d] font-bold">- {fmt(acompteTTC)}</span>
                    </div>
                  )}
                </div>

                {/* NET À PAYER — parité PDF : taille modérée, sobre.
                    Si acompte versé, label "NET À PAYER À RÉCEPTION" pour clarifier
                    qu'il s'agit du solde restant. Font-syne pour parité devis. */}
                <div className="bg-[#1a6fb5] text-white rounded-lg px-3 py-2.5 mt-2 flex justify-between items-center shadow-md">
                  <span className="font-syne font-bold text-sm">{hasAcompte ? 'NET À PAYER À RÉCEPTION' : 'NET À PAYER'}</span>
                  <span className="font-syne font-bold text-base">{fmt(netAPayerAffiche)}</span>
                </div>

                {/* Ventilation TVA multi-taux (parité PDF : drawTvaBreakdown) */}
                {Object.keys(tvaGroups).filter(r => Number(r) > 0).length > 1 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-manrope font-bold text-[#5f6c80] uppercase tracking-wider border-b border-gray-200 bg-gray-50">Ventilation TVA</div>
                    <table className="w-full text-[11px] font-manrope">
                      <thead>
                        <tr className="text-[#5f6c80]">
                          <th className="px-3 py-1.5 text-left font-medium">Taux</th>
                          <th className="px-3 py-1.5 text-right font-medium">Base HT</th>
                          <th className="px-3 py-1.5 text-right font-medium">TVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(tvaGroups)
                          .filter(([r]) => Number(r) > 0)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([rate, group]) => (
                            <tr key={rate} className="border-t border-gray-100">
                              <td className="px-3 py-1.5 text-[#0f1a3a]">{rate}%</td>
                              <td className="px-3 py-1.5 text-right text-[#0f1a3a]">{fmt(group.ht)}</td>
                              <td className="px-3 py-1.5 text-right text-[#0f1a3a]">{fmt(group.tva)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* V2.4a — MENTIONS LÉGALES facture (composant partagé).
                Source unique lib/legal-mentions.ts. Détecte automatiquement le
                type de client (SIRET → pro, sinon particulier) et applique
                l'ordre légal facture (décennale → TVA → forme juridique → RCS →
                qualification → médiateur B2C → pénalités L441-10 → indemnité
                40 € B2B → escompte → L441-3 → custom). */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '0.5px solid #e5e7eb' }}>
              <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Mentions légales</p>
              <LegalMentionsBlock
                ctx={{
                  kind: 'facture',
                  entreprise: entreprise as Record<string, unknown> | null | undefined,
                  client,
                  clientType: client?.client_type === 'professionnel' || (client?.siret && String(client.siret).trim()) ? 'pro' : 'particulier',
                  lignes,
                  factureType: 'standard',
                }}
                variant="dashboard"
                className="text-[9px]"
              />
            </div>

            {/* ────────────────────────────────────────────────── */}
            {/* BLOC IBAN/BIC — moitié gauche, juste après mentions (parité PDF) */}
            {/* ────────────────────────────────────────────────── */}
            {Boolean(entreprise?.iban && String(entreprise?.iban).trim()) && (
              <div style={{
                marginTop: 12,
                background: '#e8f4fb',
                border: '1px solid #5ab4e0',
                borderLeft: '4px solid #5ab4e0',
                borderRadius: 8,
                padding: '10px 14px',
                width: '50%',
                maxWidth: 360,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1a6fb5', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>POUR RÉGLER PAR VIREMENT</div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12.5, color: '#0f1a3a', fontWeight: 700, letterSpacing: 0.5 }}>
                  IBAN : {String(entreprise?.iban || '').replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g)?.join(' ')}
                </div>
                {Boolean(entreprise?.bic && String(entreprise?.bic).trim()) && (
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, color: '#0f1a3a', fontWeight: 700, marginTop: 2 }}>
                    BIC : {String(entreprise?.bic || '').trim().toUpperCase()}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#5f6c80', marginTop: 4 }}>
                  Bénéficiaire : {String(entreprise?.nom || '')}
                </div>
              </div>
            )}

            {/* FOOTER COORDONNÉES — parité PDF : 2 lignes (entreprise/adresse/SIRET/email + tel/décennale) */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid #5ab4e0', fontSize: 9.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.7 }}>
              <div>
                {[
                  String(entreprise?.nom || ''),
                  entreprise?.adresse ? `${String(entreprise?.adresse)}${entreprise?.code_postal || entreprise?.ville ? `, ${String(entreprise?.code_postal || '')} ${String(entreprise?.ville || '')}`.replace(/  +/g, ' ').trim() : ''}` : '',
                  entreprise?.siret ? `SIRET : ${String(entreprise?.siret)}` : '',
                  entreprise?.email ? `Email : ${String(entreprise?.email)}` : '',
                ].filter(Boolean).join(' — ')}
              </div>
              {(entreprise?.telephone || entreprise?.assurance_nom) && (
                <div>
                  {[
                    entreprise?.telephone ? `Tél : ${String(entreprise?.telephone)}` : '',
                    entreprise?.assurance_nom
                      ? `Garantie décennale ${String(entreprise?.assurance_nom)}${entreprise?.decennale_numero ? ` (n° ${String(entreprise?.decennale_numero)})` : ''}`
                      : '',
                  ].filter(Boolean).join(' — ')}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sidebar-col">
          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-syne font-bold text-[#0f1a3a] uppercase tracking-wider">Informations</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-manrope text-gray-500">Date de facture</p>
                  <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{formatDate(facture.date_emission || facture.created_at)}</p>
                </div>
              </div>
              {facture.date_echeance && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-manrope text-gray-500">Échéance</p>
                    <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{formatDate(facture.date_echeance)}</p>
                  </div>
                </div>
              )}
              {facture.date_envoi && (
                <div className="flex items-start gap-3">
                  <Send size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-manrope text-gray-500">Envoyée le</p>
                    <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{formatDate(facture.date_envoi)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <User size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-manrope text-gray-500">Client</p>
                  <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{resolvedClientName}</p>
                </div>
              </div>
              {client?.adresse && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-manrope text-gray-500">Adresse</p>
                    <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{client.adresse}{client.code_postal ? `, ${client.code_postal}` : ''} {client.ville || ''}</p>
                  </div>
                </div>
              )}
              {client?.telephone && (
                <div className="flex items-start gap-3">
                  <Phone size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-manrope text-gray-500">Téléphone</p>
                    <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{client.telephone}</p>
                  </div>
                </div>
              )}
              {client?.email && (
                <div className="flex items-start gap-3">
                  <Mail size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-manrope text-gray-500">Email</p>
                    <p className="text-sm font-manrope font-medium text-[#1a1a2e]">{client.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment tracking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-syne font-bold text-[#0f1a3a] uppercase tracking-wider">Paiements</h3>
            <div>
              <div className="flex justify-between text-sm font-manrope mb-2">
                <span className="text-gray-500">Progression</span>
                <span className={`font-medium ${paymentPercent >= 100 ? 'text-green-600' : 'text-blue-600'}`}>{paymentPercent}%</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${paymentPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(paymentPercent, 100)}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-manrope">
                <span className="text-gray-500">Total</span>
                <span className="font-medium text-[#1a1a2e]">{fmt(totalTTC)}</span>
              </div>
              <div className="flex justify-between text-sm font-manrope">
                <span className="text-gray-500">Payé</span>
                <span className="font-medium text-green-600">{fmt(totalPaye)}</span>
              </div>
              <div className="flex justify-between text-sm font-manrope">
                <span className="text-gray-500">Reste</span>
                <span className="font-medium text-[#1a1a2e]">{fmt(resteAPayer)}</span>
              </div>
            </div>
            {paymentPercent < 100 && (
              <button onClick={() => setPaymentModalOpen(true)} className="w-full h-9 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white text-sm font-syne font-bold transition-colors">
                Enregistrer un paiement
              </button>
            )}
            {paymentPercent >= 100 && (
              <div className="text-center py-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-manrope font-medium">
                  <CreditCard size={12} /> Intégralement payée
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-manrope z-50">{toastMsg}</div>
      )}

      {facture && (
        <EnvoyerFactureModal
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          factureId={facture.id}
          numeroFacture={facture.numero}
          clientEmail={client?.email || facture.client_email || facture.notes_client?.split(' | ').find((p: string) => p.includes('@')) || devisSource?.notes_client?.split(' | ').find((p: string) => p.includes('@')) || ''}
          clientNom={resolvedClientName}
          montantTTC={fmt(totalTTC)}
          onSuccess={() => {
            setToastMsg('Facture envoyée avec succès !')
            setTimeout(() => { setToastMsg(null); window.location.reload() }, 2000)
          }}
        />
      )}

      {paymentModalOpen && facture && (
        <PaymentModal
          resteAPayer={resteAPayer}
          factureId={facture.id}
          currentPaye={totalPaye}
          totalTTC={totalTTC}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setToastMsg('Paiement enregistré !')
            setTimeout(() => setToastMsg(null), 3000)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

function PaymentModal({
  resteAPayer, factureId, currentPaye, totalTTC, onClose, onSuccess,
}: {
  resteAPayer: number; factureId: string; currentPaye: number; totalTTC: number; onClose: () => void; onSuccess: () => void
}) {
  const [montant, setMontant] = useState(resteAPayer.toFixed(2))
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0])
  const [mode, setMode] = useState('Virement')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    const amount = parseFloat(montant)
    if (isNaN(amount) || amount <= 0) { setError('Montant invalide'); return }
    setSaving(true); setError(null)
    try {
      const newPaye = currentPaye + amount
      const newStatut = newPaye >= totalTTC ? 'payee' : 'partielle'
      await updateRow('factures', factureId, {
        montant_paye: Math.min(newPaye, totalTTC),
        date_paiement: datePaiement,
        mode_paiement: mode,
        statut: newStatut,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setSaving(false)
    }
  }

  const fmtLocal = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-syne font-bold text-xl text-[#1a1a2e]">Enregistrer un paiement</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm font-manrope">
            <span className="text-gray-500">Reste à payer</span>
            <span className="font-bold text-[#1a1a2e]">{fmtLocal(resteAPayer)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Montant reçu</label>
            <input type="number" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]" />
          </div>
          <div>
            <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Date de paiement</label>
            <input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]" />
          </div>
          <div>
            <label className="block text-sm font-manrope font-medium text-[#1a1a2e] mb-1">Mode de paiement</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm font-manrope outline-none focus:border-[#5ab4e0] focus:ring-1 focus:ring-[#5ab4e0]">
              <option>Virement</option>
              <option>Cheque</option>
              <option>Especes</option>
              <option>Carte bancaire</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-600 font-manrope">{error}</p>
          </div>
        )}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="h-10 px-6 rounded-lg border border-gray-200 text-sm font-manrope hover:bg-gray-50">Annuler</button>
          <button onClick={handleConfirm} disabled={saving} className="h-10 px-6 rounded-lg bg-[#e87a2a] text-white text-sm font-syne font-bold hover:bg-[#f09050] disabled:opacity-50 flex items-center gap-2">
            {saving ? 'Enregistrement...' : 'Confirmer le paiement'}
          </button>
        </div>
      </div>
    </div>
  )
}
