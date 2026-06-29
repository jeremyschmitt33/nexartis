'use client'

import { useState, useEffect } from 'react'
import { X, Download, Save } from 'lucide-react'
import { PremiumButton, PremiumInput, PremiumSelect, PremiumTextarea, InfoBanner, FieldLabel } from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { insertRow, updateRow, type EntrepriseRecord } from '@/lib/hooks'
import {
  DOC_TYPES_META,
  generateDocTypeTemplate,
  COURRIER_MODELES,
  getCourrierModele,
  type DocTypeKind,
  type DocTypeContext,
} from '@/lib/documents-types'
import { generateDocumentTypePdf } from '@/lib/pdf-document-type'

type Row = Record<string, unknown>

interface Props {
  /** Type du modele a creer (mode creation) — ignore si `editing` fourni. */
  type: DocTypeKind | null
  /** Document existant a editer (mode edition). */
  editing: Row | null
  entreprise: EntrepriseRecord | null
  clients: Row[]
  chantiers: Row[]
  devis: Row[]
  onClose: () => void
  onSaved: () => void
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

export default function DocumentEditorModal({
  type, editing, entreprise, clients, chantiers, devis, onClose, onSaved,
}: Props) {
  const isEdit = Boolean(editing)
  const effType: DocTypeKind = (editing ? (str(editing.type) as DocTypeKind) : type) || 'cgv'
  const meta = DOC_TYPES_META.find((m) => m.type === effType)

  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  const [clientId, setClientId] = useState('')
  const [chantierId, setChantierId] = useState('')
  const [devisId, setDevisId] = useState('')
  const [saving, setSaving] = useState(false)
  // Modele de courrier choisi (uniquement pour le type 'courrier', en creation).
  const [modeleSlug, setModeleSlug] = useState('vierge')

  // Initialisation : edition -> charge la ligne ; creation -> pre-remplit.
  useEffect(() => {
    if (editing) {
      setTitre(str(editing.titre))
      setContenu(str(editing.contenu))
      setClientId(str(editing.client_id))
      setChantierId(str(editing.chantier_id))
      setDevisId(str(editing.devis_id))
      return
    }
    if (type) {
      const m = DOC_TYPES_META.find((x) => x.type === type)
      const ctx: DocTypeContext = { entreprise: entreprise as DocTypeContext['entreprise'] }
      setTitre(m?.titre || 'Document')
      setContenu(generateDocTypeTemplate(type, ctx))
      setClientId(''); setChantierId(''); setDevisId('')
      setModeleSlug('vierge')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, type])

  // Construit le contexte de generation a partir des selections courantes.
  function buildCtx(nextClientId: string, nextChantierId: string, nextDevisId: string): DocTypeContext {
    const client = clients.find((c) => str(c.id) === nextClientId) || null
    const chantier = chantiers.find((c) => str(c.id) === nextChantierId) || null
    const dv = devis.find((d) => str(d.id) === nextDevisId) || null
    return {
      entreprise: entreprise as DocTypeContext['entreprise'],
      client: client as DocTypeContext['client'],
      chantier: chantier as DocTypeContext['chantier'],
      devis: dv as DocTypeContext['devis'],
    }
  }

  // Re-genere le texte a partir d'un client/chantier/devis selectionne
  // (uniquement en creation, pour ne pas ecraser un texte deja edite/sauve).
  function regenerateFrom(nextClientId: string, nextChantierId: string, nextDevisId: string) {
    if (isEdit) return
    const ctx = buildCtx(nextClientId, nextChantierId, nextDevisId)
    if (effType === 'courrier') {
      const m = getCourrierModele(modeleSlug)
      setContenu(m ? m.generate(ctx) : generateDocTypeTemplate('courrier', ctx))
    } else {
      setContenu(generateDocTypeTemplate(effType, ctx))
    }
  }

  // Applique un modele de courrier choisi dans le selecteur.
  function applyCourrierModele(slug: string) {
    setModeleSlug(slug)
    if (isEdit) return
    const m = getCourrierModele(slug)
    if (!m) return
    setContenu(m.generate(buildCtx(clientId, chantierId, devisId)))
    setTitre(slug === 'vierge' ? 'Courrier' : m.label)
  }

  async function handleSave() {
    if (!titre.trim()) { toast.error('Le titre est obligatoire.'); return }
    if (!contenu.trim()) { toast.error('Le contenu est vide.'); return }
    setSaving(true)
    try {
      const payload = {
        type: effType,
        titre: titre.trim(),
        contenu,
        client_id: clientId || null,
        chantier_id: chantierId || null,
        devis_id: devisId || null,
      }
      if (isEdit && editing) {
        await updateRow('documents_types', str(editing.id), payload)
      } else {
        await insertRow('documents_types', payload)
      }
      toast.success('Document enregistre.')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Echec de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  function handleDownload() {
    if (!contenu.trim()) { toast.error('Le contenu est vide.'); return }
    try {
      const res = generateDocumentTypePdf(titre.trim() || 'Document', contenu, entreprise)
      if (res.helpMessage) toast.info(res.helpMessage)
    } catch {
      toast.error('Echec de la generation du PDF.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl my-4">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-hanken text-lg font-bold text-[#0f1a3a]">
            {isEdit ? 'Modifier le document' : `Nouveau modele - ${meta?.label || ''}`}
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <InfoBanner variant="warn">
            Modele fourni a titre indicatif, il ne constitue pas un conseil juridique. Relisez et adaptez-le a votre situation avant de l&apos;utiliser.
          </InfoBanner>

          {effType === 'courrier' && !isEdit && (
            <div>
              <PremiumSelect
                label="Modele de courrier"
                value={modeleSlug}
                onChange={(e) => applyCourrierModele(e.target.value)}
              >
                {COURRIER_MODELES.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label}</option>
                ))}
              </PremiumSelect>
              {getCourrierModele(modeleSlug)?.description && (
                <p className="mt-1.5 font-hanken text-xs text-gray-500">
                  {getCourrierModele(modeleSlug)?.description}
                </p>
              )}
              {getCourrierModele(modeleSlug)?.note && (
                <p className="mt-1.5 font-hanken text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Attention : {getCourrierModele(modeleSlug)?.note}
                </p>
              )}
            </div>
          )}

          <PremiumInput
            label="Titre du document"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex : CGV 2026"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PremiumSelect
              label="Client (optionnel)"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); regenerateFrom(e.target.value, chantierId, devisId) }}
            >
              <option value="">Aucun</option>
              {clients.map((c) => (
                <option key={str(c.id)} value={str(c.id)}>
                  {str(c.raison_sociale) || [str(c.prenom), str(c.nom)].filter(Boolean).join(' ') || 'Client'}
                </option>
              ))}
            </PremiumSelect>

            <PremiumSelect
              label="Chantier (optionnel)"
              value={chantierId}
              onChange={(e) => { setChantierId(e.target.value); regenerateFrom(clientId, e.target.value, devisId) }}
            >
              <option value="">Aucun</option>
              {chantiers.map((c) => (
                <option key={str(c.id)} value={str(c.id)}>{str(c.titre) || 'Chantier'}</option>
              ))}
            </PremiumSelect>

            <PremiumSelect
              label="Devis (optionnel)"
              value={devisId}
              onChange={(e) => { setDevisId(e.target.value); regenerateFrom(clientId, chantierId, e.target.value) }}
            >
              <option value="">Aucun</option>
              {devis.map((d) => (
                <option key={str(d.id)} value={str(d.id)}>
                  {str(d.numero) ? `${str(d.numero)} - ` : ''}{str(d.objet) || 'Devis'}
                </option>
              ))}
            </PremiumSelect>
          </div>

          <div>
            <FieldLabel>Contenu du document (modifiable)</FieldLabel>
            <PremiumTextarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={16}
              mono
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <PremiumButton variant="secondary" icon={<Download size={18} />} onClick={handleDownload}>
            Telecharger en PDF
          </PremiumButton>
          <PremiumButton variant="primary" icon={<Save size={18} />} loading={saving} onClick={handleSave}>
            Enregistrer
          </PremiumButton>
        </div>
      </div>
    </div>
  )
}
