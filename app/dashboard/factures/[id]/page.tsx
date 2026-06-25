'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  FileCheck2,
  Loader2,
  Zap,
} from 'lucide-react'
import EnvoyerFactureModal from '@/components/dashboard/EnvoyerFactureModal'
import RelanceSmsButton from '@/components/factures/RelanceSmsButton'
import LegalMentionsBlock from '@/components/legal/LegalMentionsBlock'
import ProfilIncompletBanner from '@/components/legal/ProfilIncompletBanner'
import DocumentRender from '@/components/document/DocumentRender'
import FactureRelancesTimeline from '@/components/dashboard/FactureRelancesTimeline'
import EfactureStatutCard from '@/components/dashboard/EfactureStatutCard'
import PhotoSection from '@/components/photos/PhotoSection'
import { buildFactureDocument } from '@/lib/document-data'
import { themeFromEntreprise } from '@/lib/document-theme'
import { logoConfigFromEntreprise } from '@/lib/logo-config'
import { fetchAndDownloadPdf } from '@/lib/download-pdf'
import { toast } from '@/lib/toast'
import {
  useSupabaseRecord,
  useFactureLignes,
  useEntreprise,
  useUser,
  updateRow,
  LoadingSkeleton,
} from '@/lib/hooks'

interface FactureRecord {
  id: string
  numero: string
  statut: string
  // Verrouillage : NULL = modifiable, non-NULL = figee (premiere transmission)
  verrouillee_at?: string | null
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
  // V3.0c.18 — Champs factures de situation (migration-facture-situation.sql)
  type?: string | null
  numero_situation?: number | null
  pourcentage_situation?: number | null
  devis_ref?: string | null
  devis_date?: string | null
  montant_situation_precedent_ht?: number | null
  montant_situation_precedent_ttc?: number | null
  reste_a_facturer_ht?: number | null
  reste_a_facturer_ttc?: number | null
  // 2026-06-10 — Autoliquidation BTP (sous-traitance). Nullable car la migration
  // SQL peut ne pas etre encore executee en BDD (colonne absente → undefined).
  autoliquidation_btp?: boolean | null
  superpdp_invoice_id?: string | null
  superpdp_status?: string | null
  superpdp_envoyee_at?: string | null
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
  /** Type reel du client en base ('particulier' | 'professionnel'). */
  type?: 'particulier' | 'professionnel'
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

// V4 light : badges statut avec couleurs sémantiques douces, bordure 1.5px, fond pastel.
const STATUT_STYLES: Record<string, string> = {
  'Encaissée': 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70',
  'payee': 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70',
  'Partiellement payée': 'bg-[#fff5ec] text-[#ff7a1a] border-[#ffd4b0]',
  'partielle': 'bg-[#fff5ec] text-[#ff7a1a] border-[#ffd4b0]',
  'En attente': 'bg-amber-50/80 text-amber-800 border-amber-200/70',
  'En retard': 'bg-red-50/80 text-red-700 border-red-200/70',
  'en_retard': 'bg-red-50/80 text-red-700 border-red-200/70',
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
  // D1 (2026-06-08) : useRouter pour remplacer les window.location.reload()
  // qui cassent l'UX (perte scroll/state) par des router.refresh() ciblés.
  const router = useRouter()
  const id = params.id as string

  const { data: facture, loading: loadingFacture } = useSupabaseRecord<FactureRecord>('factures', id)
  const { data: lignesRaw, loading: loadingLignes } = useFactureLignes(id)
  const { data: client, loading: loadingClient } = useSupabaseRecord<ClientRecord>('clients', facture?.client_id ?? null)
  const { data: devisSource } = useSupabaseRecord<{ notes_client?: string }>('devis', facture?.devis_id ?? null)
  const { entreprise } = useEntreprise()
  const { user } = useUser()

  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  // Verrouillage : confirmation (cadre jaune) avant toute action de transmission.
  // poseVerrouAuConfirm = true pour download/electronique (verrou pose au "Continuer"),
  // = false pour l'email (le verrou est pose au SUCCES d'envoi, pas a l'ouverture du modal).
  const [lockConfirm, setLockConfirm] = useState<
    null | { titre: string; run: () => Promise<void> | void; poseVerrouAuConfirm: boolean }
  >(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingFx, setDownloadingFx] = useState(false)
  // Etape 3 e-facture (admin only) : envoi electronique vers SUPER PDP.
  const [sendingEfacture, setSendingEfacture] = useState(false)

  // V3.0d : telechargement PDF cross-platform via helper lib/download-pdf.ts.
  //   - iOS Safari : ouvre dans nouvel onglet + toast d'aide (Partager -> Fichiers).
  //   - Android / desktop : <a download> + toast confirmation "PDF telecharge".
  async function handleDownloadPdf() {
    if (!facture || downloading) return
    setDownloading(true)
    setToastMsg('Génération du PDF...')
    try {
      const result = await fetchAndDownloadPdf(
        '/api/download-facture',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factureId: facture.id }),
        },
        `Facture-${facture.numero}.pdf`,
      )
      setToastMsg(result.helpMessage)
      setTimeout(() => setToastMsg(null), result.openedInNewTab ? 6000 : 2500)
    } catch (err) {
      console.error('Download facture error:', err)
      setToastMsg(err instanceof Error ? err.message : 'Erreur téléchargement PDF')
      setTimeout(() => setToastMsg(null), 4000)
    } finally {
      setDownloading(false)
    }
  }

  // Factur-X : telechargement du PDF/A-3 hybride (PDF visuel identique + XML EN 16931).
  // Route ISOLEE /api/download-facture-x : ne modifie pas le telechargement PDF classique.
  async function handleDownloadFacturX() {
    if (!facture || downloadingFx) return
    setDownloadingFx(true)
    setToastMsg('Génération du Factur-X...')
    try {
      const result = await fetchAndDownloadPdf(
        '/api/download-facture-x',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factureId: facture.id }),
        },
        `Facture-${facture.numero}-facturx.pdf`,
      )
      setToastMsg(result.helpMessage)
      setTimeout(() => setToastMsg(null), result.openedInNewTab ? 6000 : 2500)
    } catch (err) {
      console.error('Download facture-x error:', err)
      setToastMsg('Échec de la génération Factur-X. Vous pouvez utiliser « Télécharger PDF ».')
      setTimeout(() => setToastMsg(null), 4000)
    } finally {
      setDownloadingFx(false)
    }
  }

  // Etape 3 (admin only) : envoi electronique vers SUPER PDP.
  // La route valide d'abord la facture ; si non conforme, elle bloque et
  // renvoie le detail. On affiche un toast clair dans tous les cas.
  async function handleSendEfacture() {
    if (!facture || sendingEfacture) return
    setSendingEfacture(true)
    try {
      const res = await fetch('/api/superpdp/send-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factureId: facture.id }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; invoiceId?: string | null; message?: string; error?: string }
        | null
      if (!res.ok || !data?.ok) {
        toast.error(data?.message || data?.error || "Échec de l'envoi électronique")
        return
      }
      toast.success(
        `Facture déposée chez SUPER PDP${data.invoiceId ? ` (id ${data.invoiceId})` : ''}`,
      )
      router.refresh()
    } catch (err) {
      toast.error('Erreur réseau : ' + (err instanceof Error ? err.message : 'Échec'))
    } finally {
      setSendingEfacture(false)
    }
  }

  // Verrouillage : execute une action de transmission. Si la facture est deja
  // verrouillee -> action directe (pas d'avertissement). Sinon -> ouvre le cadre
  // jaune de confirmation, qui posera verrouillee_at apres l'action (sauf email).
  function runWithLock(
    titre: string,
    action: () => Promise<void> | void,
    poseVerrouAuConfirm = true,
  ) {
    if (facture?.verrouillee_at) {
      action()
      return
    }
    setLockConfirm({ titre, run: action, poseVerrouAuConfirm })
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
      router.refresh()
    } catch (err) {
      toast.error('Erreur : ' + (err instanceof Error ? err.message : 'Echec'))
    } finally { setUpdating(false) }
  }

  async function handleArchive() {
    if (!facture || updating) return
    setUpdating(true)
    try {
      await updateRow('factures', facture.id, { statut: 'archivee', archivee: true })
      setToastMsg('Facture archivée !')
      setTimeout(() => setToastMsg(null), 3000)
      router.refresh()
    } catch (err) {
      toast.error('Erreur : ' + (err instanceof Error ? err.message : 'Echec'))
    } finally { setUpdating(false) }
  }

  async function handleUnarchive() {
    if (!facture || updating) return
    setUpdating(true)
    try {
      await updateRow('factures', facture.id, { statut: 'payee', archivee: false })
      setToastMsg('Facture désarchivée !')
      setTimeout(() => setToastMsg(null), 3000)
      router.refresh()
    } catch (err) {
      toast.error('Erreur : ' + (err instanceof Error ? err.message : 'Echec'))
    } finally { setUpdating(false) }
  }

  // V2.1 10/06/2026 — Relance manuelle 1 clic.
  // Appelle /api/factures/[id]/relancer-maintenant qui choisit le bon
  // palier (J+7 / J+15 / J+30) selon le delta echeance et envoie un email.
  const handleRelancerMaintenant = async () => {
    if (!facture) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/factures/${facture.id}/relancer-maintenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => null) as { ok?: boolean; niveau?: string; sent_to?: string; error?: string } | null
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Echec de l\'envoi de la relance')
        return
      }
      const niveauLabel = data.niveau === 'j30' ? 'J+30 (dernier rappel)'
        : data.niveau === 'j15' ? 'J+15 (rappel ferme)'
        : 'J+7 (courtois)'
      toast.success(`Relance ${niveauLabel} envoyée à ${data.sent_to}`)
      router.refresh()
    } catch (err) {
      toast.error('Erreur reseau : ' + (err instanceof Error ? err.message : 'Echec'))
    } finally { setUpdating(false) }
  }

  const loading = loadingFacture || loadingLignes || loadingClient

  if (loading) return <div className="space-y-6"><LoadingSkeleton rows={8} /></div>

  if (!facture) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/factures"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#fafbfc] transition-colors font-hanken text-sm text-gray-600"
        >
          <ArrowLeft size={18} /> Retour
        </Link>
        <p className="font-hanken text-sm text-gray-500">Facture introuvable.</p>
      </div>
    )
  }

  // Verrouillage : modifiable SSI verrouillee_at est NULL (peu importe le statut).
  const estVerrouillee = !!facture.verrouillee_at

  const lignes = lignesRaw as unknown as LigneRecord[]
  // Ordre logique : Civilite + Prenom + Nom (ex: "M. Eric Dupont")
  const resolvedClientName = client
    ? [client.civilite, client.prenom, client.nom].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    : facture.client_nom || devisSource?.notes_client?.split(' | ')[0] || 'Non renseigné'
  // E-facture : le bouton d'envoi electronique est actif uniquement pour un
  // client PRO avec SIRET (facturation electronique B2B). Ouvert a tous les
  // artisans connectes (la securite est verifiee cote serveur).
  const clientIsPro = client?.type === 'professionnel' && !!client?.siret
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

  // V3.0b — DocumentData unifie pour le rendu visuel (header + cartes + tableau + recap).
  const documentData = buildFactureDocument({
    doc: {
      numero: facture.numero,
      date_emission: facture.date_emission ?? null,
      date_echeance: facture.date_echeance ?? null,
      objet: facture.objet ?? null,
      conditions_paiement: facture.conditions_paiement ?? null,
      // V3.0c.18 — Champs facture de situation propagés au rendu HTML.
      // Si type !== 'situation', buildFactureDocument n'injecte pas meta.situation
      // donc DocumentRender garde son rendu standard (backward-compat).
      type: (facture.type as string | null | undefined) ?? null,
      numero_situation: (facture.numero_situation as number | null | undefined) ?? null,
      pourcentage_situation: (facture.pourcentage_situation as number | null | undefined) ?? null,
      devis_ref: (facture.devis_ref as string | null | undefined) ?? null,
      devis_date: (facture.devis_date as string | null | undefined) ?? null,
      montant_situation_precedent_ht: (facture.montant_situation_precedent_ht as number | null | undefined) ?? null,
      montant_situation_precedent_ttc: (facture.montant_situation_precedent_ttc as number | null | undefined) ?? null,
      reste_a_facturer_ht: (facture.reste_a_facturer_ht as number | null | undefined) ?? null,
      reste_a_facturer_ttc: (facture.reste_a_facturer_ttc as number | null | undefined) ?? null,
      // 2026-06-10 — Autoliquidation BTP. Defensif : si la colonne n'existe
      // pas encore en DB (migration non executee), la valeur est undefined → false.
      autoliquidation_btp: (facture.autoliquidation_btp as boolean | null | undefined) ?? null,
    },
    lignes: (lignes ?? []).map((l, idx) => ({
      designation: l.designation ?? '',
      quantite: Number(l.quantite ?? 0),
      unite: l.unite ?? '',
      prix_unitaire_ht: Number(l.prix_unitaire_ht ?? 0),
      taux_tva: Number(l.taux_tva ?? 0),
      ordre: Number(l.ordre ?? idx),
      type: l.type ?? null,
      niveau: l.niveau ?? null,
      numero: l.numero ?? null,
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
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Header V4 light : titre Hanken extrabold + badge statut + boutons d'actions. */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/factures"
            className="p-2 rounded-xl hover:bg-[#fafbfc] transition-colors flex-shrink-0"
            aria-label="Retour à la liste"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-hanken font-extrabold text-xl sm:text-2xl text-[#0f1a3a] tracking-[-0.025em]">
                Facture <span className="font-spline-mono font-medium tracking-[0.5px]">{facture.numero}</span>
              </h1>
              <span className={`inline-block px-2.5 py-1 rounded-full font-hanken text-[11.5px] font-bold uppercase tracking-wider border ${statutStyle}`}>
                {statutLabel}
              </span>
            </div>
            <p className="font-hanken text-sm text-gray-500 mt-1">{resolvedClientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Action principale : télécharger PDF */}
          <button
            onClick={() => runWithLock('télécharger le PDF', handleDownloadPdf)}
            disabled={downloading}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-[#ff7a1a] hover:bg-[#fafbfc] font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-all disabled:opacity-50"
          >
            <Download size={14} /> {downloading ? 'Téléchargement...' : 'Télécharger PDF'}
          </button>
          {/* V2 Factur-X (brainstorm 3 agents) : libelle humain "Facture electronique"
              (les artisans ne connaissent pas "Factur-X"), icone distincte FileCheck2
              (conformite, pas un 2e "Download"), aria-label + infobulle rassurante,
              focus visible. Le bouton "Telecharger PDF" reste inchange. */}
          <button
            onClick={() => runWithLock('télécharger la facture électronique', handleDownloadFacturX)}
            disabled={downloadingFx}
            aria-busy={downloadingFx}
            aria-label="Télécharger la facture électronique Factur-X : même facture, avec les données structurées conformes à la réforme 2026"
            title="Même facture, au format électronique exigé par la réforme 2026 — à transmettre à votre comptable ou à un logiciel de comptabilité."
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-[#ff7a1a] hover:bg-[#fafbfc] font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] focus-visible:ring-offset-2"
          >
            {downloadingFx ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
            {downloadingFx ? 'Génération...' : 'Facture électronique'}
          </button>
          {/* E-facture : envoi electronique vers SUPER PDP. Ouvert a tous les
              artisans connectes. Desactive (avec explication) si le client de la
              facture n'est pas professionnel + SIRET (facturation electronique B2B). */}
          {(
            facture.superpdp_invoice_id ? (
              <span
                title={`Déjà envoyée en électronique (id ${facture.superpdp_invoice_id})`}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-emerald-200 bg-emerald-50 font-hanken text-[13.5px] font-semibold text-emerald-700"
              >
                <Zap size={14} /> Envoyée en électronique
              </span>
            ) : (
              <button
                onClick={() => runWithLock('envoyer en électronique', handleSendEfacture)}
                disabled={sendingEfacture || !clientIsPro}
                title={
                  clientIsPro
                    ? 'Déposer cette facture chez SUPER PDP (validation de conformité puis envoi électronique).'
                    : 'Disponible uniquement pour un client professionnel avec SIRET (facturation électronique B2B).'
                }
                aria-label="Envoyer cette facture en électronique via SUPER PDP"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-[#5ab4e0]/40 bg-[#5ab4e0]/10 hover:bg-[#5ab4e0]/20 font-hanken text-[13.5px] font-semibold text-[#2b6c91] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ab4e0] focus-visible:ring-offset-2"
              >
                {sendingEfacture ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {sendingEfacture ? 'Envoi…' : 'Envoyer en électronique'}
              </button>
            )
          )}
          {/* CTA primaire orange : envoyer par email. Cas particulier : le verrou
              est pose au SUCCES de l'envoi (cf. onSuccess du SendModal), pas a
              l'ouverture du modal -> poseVerrouAuConfirm = false ici. */}
          <button
            onClick={() => {
              if (estVerrouillee) {
                setSendModalOpen(true)
              } else {
                setLockConfirm({ titre: 'envoyer par email', run: () => setSendModalOpen(true), poseVerrouAuConfirm: false })
              }
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all"
          >
            <Send size={14} /> Envoyer par email
          </button>
          {!estVerrouillee ? (
            <Link
              href={`/dashboard/factures/${facture.id}/modifier`}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-[#ff7a1a] hover:bg-[#fafbfc] font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-all"
            >
              <Pencil size={14} /> Modifier
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Facture transmise : non modifiable"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-gray-50 font-hanken text-[13.5px] font-semibold text-gray-400 cursor-not-allowed"
            >
              <Pencil size={14} /> Modifier (verrouillée)
            </button>
          )}
          {facture.statut !== 'payee' && facture.statut !== 'Encaissée' && facture.statut !== 'archivee' && (
            <button
              onClick={handleMarkPaid}
              disabled={updating}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-emerald-200 bg-emerald-50 hover:bg-emerald-100 font-hanken text-[13.5px] font-semibold text-emerald-700 transition-colors disabled:opacity-50"
            >
              <CreditCard size={14} /> Marquer payée
            </button>
          )}
          {(facture.statut === 'payee' || facture.statut === 'Encaissée') && (
            <button
              onClick={handleArchive}
              disabled={updating}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-gray-200 bg-white hover:bg-[#fafbfc] font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-colors disabled:opacity-50"
            >
              <RotateCcw size={14} /> Archiver
            </button>
          )}
          {facture.statut === 'archivee' && (
            <button
              onClick={handleUnarchive}
              disabled={updating}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-blue-200 bg-blue-50 hover:bg-blue-100 font-hanken text-[13.5px] font-semibold text-blue-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={14} /> Désarchiver
            </button>
          )}
          {facture.statut !== 'payee' && facture.statut !== 'Encaissée' && facture.statut !== 'archivee' && (
            <button
              onClick={handleRelancerMaintenant}
              disabled={updating}
              title="Envoie 1 email de relance immediat (palier choisi selon le retard : J+7 / J+15 / J+30)"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border-[1.5px] border-amber-200 bg-amber-50 hover:bg-amber-100 font-hanken text-[13.5px] font-semibold text-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
              aria-label="Envoyer une relance maintenant pour cette facture"
            >
              <AlertTriangle size={14} /> {updating ? 'Envoi…' : 'Relancer maintenant'}
            </button>
          )}
          {client && client.telephone && facture.statut !== 'payee' && facture.statut !== 'Encaissée' && facture.statut !== 'archivee' && (
            <RelanceSmsButton
              telephone={client.telephone}
              clientNom={[client.civilite, client.nom].filter(Boolean).join(' ')}
              numero={facture.numero}
              resteAPayer={(facture.montant_ttc || 0) - ((facture as { montant_paye?: number }).montant_paye || 0)}
              entrepriseNom={(entreprise?.nom as string | undefined) || undefined}
            />
          )}
        </div>
      </div>

      {/* V2.4a — Bannière "Mentions légales incomplètes" (composant partagé).
          N'apparaît que si un champ obligatoire (Code de commerce L441-9) manque
          sur le profil entreprise. Ne s'imprime pas (classe no-print). */}
      <ProfilIncompletBanner entreprise={entreprise as Record<string, unknown> | null | undefined} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main : aperçu facture rendu par DocumentRender (NE PAS modifier ce composant).
            Carte V4 light : fond blanc, bord 2xl, ombre douce. */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-3 sm:p-8 print-zone shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <DocumentRender data={documentData} theme={themeFromEntreprise(entreprise)} logoConfig={logoConfigFromEntreprise(entreprise)} />
          </div>

          {/* Photos liees a cette facture / intervention */}
          <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 sm:p-6 mt-4 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <PhotoSection
              scope="facture"
              clientId={String(facture.client_id ?? '')}
              factureId={facture.id}
              chantierId={facture.chantier_id || undefined}
              titre="Photos de l'intervention"
              adresse={String(facture.client_adresse ?? '')}
            />
          </div>
        </div>

        {/* Sidebar : informations + suivi paiements (cartes V4 light). */}
        <div className="space-y-4 sidebar-col">
          {/* E-facture : suivi du cycle de vie SUPER PDP, uniquement si la
              facture a deja ete envoyee en electronique. */}
          {facture.superpdp_invoice_id && (
            <EfactureStatutCard factureId={facture.id} />
          )}
          {/* Carte Informations — métadonnées de la facture */}
          <div className="relative bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 space-y-4 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            {/* Accent line orange V4 */}
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            <h3 className="font-hanken font-extrabold text-[13px] text-[#0f1a3a] uppercase tracking-wider">
              Informations
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Date de facture</p>
                  <p className="font-spline-mono font-medium text-[13px] text-[#0f1a3a] mt-0.5">{formatDate(facture.date_emission || facture.created_at)}</p>
                </div>
              </div>
              {facture.date_echeance && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Échéance</p>
                    <p className="font-spline-mono font-medium text-[13px] text-[#0f1a3a] mt-0.5">{formatDate(facture.date_echeance)}</p>
                  </div>
                </div>
              )}
              {facture.date_envoi && (
                <div className="flex items-start gap-3">
                  <Send size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Envoyée le</p>
                    <p className="font-spline-mono font-medium text-[13px] text-[#0f1a3a] mt-0.5">{formatDate(facture.date_envoi)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <User size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Client</p>
                  <p className="font-hanken font-semibold text-[14px] text-[#0f1a3a] mt-0.5">{resolvedClientName}</p>
                </div>
              </div>
              {client?.adresse && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Adresse</p>
                    <p className="font-hanken text-[13.5px] text-[#0f1a3a] mt-0.5">
                      {client.adresse}{client.code_postal ? `, ` : ''}
                      {client.code_postal && <span className="font-spline-mono font-medium">{client.code_postal}</span>}
                      {client.ville && ` ${client.ville}`}
                    </p>
                  </div>
                </div>
              )}
              {client?.telephone && (
                <div className="flex items-start gap-3">
                  <Phone size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Téléphone</p>
                    <p className="font-spline-mono font-medium text-[13px] text-[#0f1a3a] mt-0.5">{client.telephone}</p>
                  </div>
                </div>
              )}
              {client?.email && (
                <div className="flex items-start gap-3">
                  <Mail size={16} className="text-[#ff7a1a] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-hanken text-[11px] uppercase tracking-wider font-semibold text-gray-500">Email</p>
                    <p className="font-hanken text-[13.5px] text-[#0f1a3a] mt-0.5 truncate">{client.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Carte Paiements — barre de progression + récap + CTA orange */}
          <div className="relative bg-white rounded-2xl border border-[#0f1a3a]/[0.06] p-5 space-y-4 overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
            <h3 className="font-hanken font-extrabold text-[13px] text-[#0f1a3a] uppercase tracking-wider">
              Paiements
            </h3>
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-hanken text-[13px] text-gray-500">Progression</span>
                <span className={`font-spline-mono font-medium text-[13px] ${paymentPercent >= 100 ? 'text-emerald-600' : 'text-[#ff7a1a]'}`}>
                  {paymentPercent}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d]'}`}
                  style={{ width: `${Math.min(paymentPercent, 100)}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-hanken text-[13px] text-gray-500">Total</span>
                <span className="font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{fmt(totalTTC)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-hanken text-[13px] text-gray-500">Payé</span>
                <span className="font-spline-mono font-medium text-[14px] text-emerald-600">{fmt(totalPaye)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-hanken text-[13px] text-gray-500">Reste</span>
                <span className="font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{fmt(resteAPayer)}</span>
              </div>
            </div>
            {paymentPercent < 100 && (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="w-full h-10 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all"
              >
                Enregistrer un paiement
              </button>
            )}
            {paymentPercent >= 100 && (
              <div className="text-center py-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-br from-emerald-100/80 to-emerald-50 text-emerald-700 border border-emerald-200/60 font-hanken text-[11.5px] font-bold uppercase tracking-wider">
                  <CreditCard size={12} /> Intégralement payée
                </span>
              </div>
            )}
          </div>

          {/* V2.3 10/06/2026 — Timeline des relances envoyees pour cette facture.
              Lit la table `relances` (RLS user_id) et affiche un historique
              visuel par palier (J+7 / J+15 / J+30) avec date + ton. */}
          <FactureRelancesTimeline factureId={facture.id} />
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-[#0f1a3a] text-white px-4 py-2.5 rounded-xl shadow-xl font-hanken text-sm z-50">
          {toastMsg}
        </div>
      )}

      {/* Verrouillage : cadre jaune de confirmation avant la 1re transmission.
          "Continuer" execute l'action, puis pose verrouillee_at (sauf email :
          poseVerrouAuConfirm=false, le verrou est pose au succes d'envoi). */}
      {lockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={22} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="min-w-0">
                <h3 className="font-hanken font-extrabold text-[15px] text-amber-900">
                  ⚠️ Cette facture ne sera plus modifiable
                </h3>
                <p className="font-hanken text-sm text-amber-800 leading-relaxed mt-1.5">
                  Après cette action ({lockConfirm.titre}), la facture sera définitivement verrouillée. Vérifiez qu&apos;elle est correcte.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLockConfirm(null)}
                className="h-10 px-5 rounded-xl border-[1.5px] border-amber-300 bg-white font-hanken text-[13.5px] font-semibold text-amber-900 hover:bg-amber-100 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  const conf = lockConfirm
                  await conf.run()
                  if (conf.poseVerrouAuConfirm && !estVerrouillee) {
                    await updateRow('factures', facture.id, { verrouillee_at: new Date().toISOString() })
                  }
                  setLockConfirm(null)
                  router.refresh()
                }}
                className="h-10 px-5 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
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
            // Verrouillage email : pose verrouillee_at APRES un envoi reussi
            // (best-effort, ne bloque jamais le succes), si pas deja verrouillee.
            if (!estVerrouillee) {
              updateRow('factures', facture.id, { verrouillee_at: new Date().toISOString() }).catch(() => {})
            }
            setTimeout(() => { setToastMsg(null); router.refresh() }, 2000)
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
            router.refresh()
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

  // Modale V4 light : backdrop sombre, carte blanche radius 3xl, accent line orange en haut.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl w-full max-w-md mx-4 p-8 overflow-hidden shadow-2xl border border-[#0f1a3a]/[0.06]">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-hanken font-extrabold text-xl text-[#0f1a3a] tracking-[-0.025em]">
            Enregistrer un paiement
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#fafbfc] rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        {/* Rappel reste à payer (mono pour le montant) */}
        <div className="mb-5 p-3.5 bg-[#fafbfc] rounded-xl border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="font-hanken text-sm text-gray-500">Reste à payer</span>
            <span className="font-spline-mono font-medium text-[15px] text-[#0f1a3a]">{fmtLocal(resteAPayer)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Montant reçu
            </label>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-spline-mono font-medium text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200"
            />
          </div>
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Date de paiement
            </label>
            <input
              type="date"
              value={datePaiement}
              onChange={(e) => setDatePaiement(e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-spline-mono font-medium text-[14.5px] text-[#0f1a3a] focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200"
            />
          </div>
          <div>
            <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
              Mode de paiement
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] cursor-pointer focus:outline-none focus:border-[#ff7a1a] focus:bg-white focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] transition-all duration-200"
            >
              <option>Virement</option>
              <option>Cheque</option>
              <option>Especes</option>
              <option>Carte bancaire</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="mt-4 bg-red-50/80 border border-red-200/70 rounded-xl px-4 py-3">
            <p className="font-hanken text-sm text-red-700">{error}</p>
          </div>
        )}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="h-10 px-6 rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-[#ff7a1a] hover:bg-[#fafbfc] font-hanken text-[13.5px] font-semibold text-[#0f1a3a] transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white font-hanken text-[13.5px] font-bold shadow-[0_6px_16px_rgba(255,122,26,0.30),_inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
          >
            {saving ? 'Enregistrement...' : 'Confirmer le paiement'}
          </button>
        </div>
      </div>
    </div>
  )
}
