'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, HardHat } from 'lucide-react'
import { useClients, useDevis, insertRow, updateRow, LoadingSkeleton } from '@/lib/hooks'
import {
  PremiumCard,
  SectionHeader,
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumButton,
  InfoBanner,
} from '@/components/ui/v4'

// -------------------------------------------------------------------
// Constantes locales — labels statut (logique métier inchangée).
// -------------------------------------------------------------------
const STATUT_OPTIONS = ['prospection', 'signe', 'en_cours', 'livre', 'cloture', 'archive']
const STATUT_LABELS: Record<string, string> = {
  prospection: 'Prospection',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  cloture: 'Clôturé',
  archive: 'Archivé',
}

export default function NouveauChantierPage() {
  const router = useRouter()
  const { data: clients, loading: loadingClients } = useClients()
  const { data: allDevis } = useDevis()

  // ── State formulaire — logique métier INTACTE ──
  const [nom, setNom] = useState('')
  const [clientId, setClientId] = useState('')
  const [adresse, setAdresse] = useState('')
  const [adresseManuallyEdited, setAdresseManuallyEdited] = useState(false)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [statut, setStatut] = useState('prospection')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // BUG E FIX : auto-remplir l'adresse quand on choisit un client
  // (uniquement si l'utilisateur n'a pas déjà tapé une adresse manuellement)
  useEffect(() => {
    if (!clientId || adresseManuallyEdited) return
    const c = (clients as Array<Record<string, unknown>>).find((cl) => cl.id === clientId)
    if (!c) return
    const fullAdresse = [
      (c.adresse as string) || '',
      `${(c.code_postal as string) || ''} ${(c.ville as string) || ''}`.trim(),
    ].filter(Boolean).join(', ')
    if (fullAdresse) setAdresse(fullAdresse)
  }, [clientId, clients, adresseManuallyEdited])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim()) {
      setError('Le nom du chantier est requis.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const chantier = await insertRow('chantiers', {
        titre: nom.trim(),
        client_id: clientId || null,
        adresse_chantier: adresse || null,
        date_debut: dateDebut || null,
        date_fin_prevue: dateFin || null,
        statut,
        notes: notes || null,
      })
      const newChantierId = (chantier as { id: string }).id

      // BUG F FIX : auto-rattacher tous les devis signés/finalisés du même client
      // qui n'ont pas encore de chantier_id (statuts valides du schema:
      // brouillon, envoye, finalise, signe, refuse, expire, facture)
      if (clientId && allDevis) {
        const devisToLink = (allDevis as Array<Record<string, unknown>>).filter((d) =>
          d.client_id === clientId &&
          (d.statut === 'signe' || d.statut === 'finalise' || d.statut === 'envoye') &&
          !d.chantier_id
        )
        for (const d of devisToLink) {
          try {
            await updateRow('devis', d.id as string, { chantier_id: newChantierId })
          } catch { /* ignore les erreurs individuelles, on ne bloque pas */ }
        }
      }

      router.push(`/dashboard/chantiers/${newChantierId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
      setSaving(false)
    }
  }

  if (loadingClients) {
    return <div className="space-y-6"><LoadingSkeleton rows={6} /></div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header de page : bouton retour discret + titre Hanken extrabold ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/chantiers"
          aria-label="Retour à la liste des chantiers"
          className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 transition-all"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em]">
          Nouveau chantier
        </h1>
      </div>

      {/* ── Carte principale V4 — formulaire de création ── */}
      <PremiumCard>
        <SectionHeader
          icon={<HardHat size={20} />}
          title="Informations du chantier"
          subtitle="Renseignez les éléments clés du chantier à créer"
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Erreur globale du formulaire — InfoBanner V4 variante danger */}
          {error && (
            <InfoBanner variant="danger">{error}</InfoBanner>
          )}

          {/* Nom du chantier — champ obligatoire */}
          <PremiumInput
            label="Nom du chantier *"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Rénovation salle de bain"
            required
          />

          {/* Client — auto-remplit l'adresse via useEffect ci-dessus */}
          <PremiumSelect
            label="Client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            hint="Sélectionner un client pré-rempli son adresse"
          >
            <option value="">Sélectionner un client...</option>
            {(clients as { id: string; prenom?: string; nom?: string }[]).map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.prenom ?? ''} ${c.nom ?? ''}`.trim()}
              </option>
            ))}
          </PremiumSelect>

          {/* Adresse — modifiable (flag adresseManuallyEdited) */}
          <PremiumInput
            label="Adresse du chantier"
            type="text"
            value={adresse}
            onChange={(e) => { setAdresse(e.target.value); setAdresseManuallyEdited(true) }}
            placeholder="12 rue des Lilas, 33000 Bordeaux"
          />

          {/* Dates en grille 2 colonnes — chiffrées donc mono */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PremiumInput
              label="Date de début"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              mono
            />
            <PremiumInput
              label="Date de fin prévue"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              mono
            />
          </div>

          {/* Statut métier */}
          <PremiumSelect
            label="Statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
          >
            {STATUT_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUT_LABELS[s]}</option>
            ))}
          </PremiumSelect>

          {/* Notes libres — textarea V4 */}
          <PremiumTextarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes internes sur ce chantier..."
          />

          {/* Actions : annuler (secondaire) / créer (primaire orange) */}
          <div className="flex justify-end gap-3 pt-2">
            <Link href="/dashboard/chantiers">
              <PremiumButton variant="secondary" type="button">
                Annuler
              </PremiumButton>
            </Link>
            <PremiumButton
              variant="primary"
              type="submit"
              disabled={saving}
              loading={saving}
            >
              {saving ? 'Création...' : 'Créer le chantier'}
            </PremiumButton>
          </div>
        </form>
      </PremiumCard>
    </div>
  )
}
