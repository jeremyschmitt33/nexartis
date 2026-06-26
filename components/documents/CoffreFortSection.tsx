'use client'

import { useState, useMemo, useRef } from 'react'
import { UploadCloud, Download, Mail, Trash2, FileText, Loader2 } from 'lucide-react'
import { useDocumentsStockes, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import EnvoiDocumentModal from './EnvoiDocumentModal'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

// Categories proposees (cle stockee -> libelle + couleur du badge).
const CATEGORIES: { value: string; label: string; badge: string }[] = [
  { value: 'rib', label: 'RIB', badge: 'bg-blue-50 text-blue-700' },
  { value: 'decennale', label: 'Assurance decennale', badge: 'bg-green-50 text-green-700' },
  { value: 'rc_pro', label: 'Assurance RC pro', badge: 'bg-teal-50 text-teal-700' },
  { value: 'ouverture', label: "Ouverture d'entreprise", badge: 'bg-purple-50 text-purple-700' },
  { value: 'genere', label: 'Document genere', badge: 'bg-amber-50 text-amber-700' },
  { value: 'autre', label: 'Autre', badge: 'bg-gray-100 text-gray-600' },
]
function catMeta(v: string) { return CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1] }

function formatTaille(octets: number): string {
  if (!octets) return ''
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

interface Props {
  devis: Row[]
  clients: Row[]
}

export default function CoffreFortSection({ devis, clients }: Props) {
  const askConfirm = useConfirm()
  const { data: docs, loading, error, refetch } = useDocumentsStockes()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [categorie, setCategorie] = useState('autre')
  const [uploading, setUploading] = useState(false)
  const [sendDoc, setSendDoc] = useState<Row | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))),
    [docs],
  )

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (10 Mo maximum).')
      return
    }
    setUploading(true)
    try {
      // 1) Demander une URL signee (PUT) + verif quota/MIME cote serveur
      const signRes = await fetch('/api/documents/sign-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime_type: file.type, size: file.size }),
      })
      const sign = await signRes.json().catch(() => ({}))
      if (!signRes.ok) throw new Error(sign.message || sign.error || "Type de fichier non autorise.")

      // 2) Upload direct du binaire vers R2
      const putRes = await fetch(sign.putUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error("Echec du televersement du fichier.")

      // 3) Confirmer l'enregistrement (insert metadonnees + relecture taille R2)
      const confirmRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          r2_key: sign.key,
          nom: file.name,
          categorie,
          mime_type: file.type,
        }),
      })
      const confirm = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok) throw new Error(confirm.message || confirm.error || 'Enregistrement impossible.')

      toast.success('Document ajoute.')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Echec de l'ajout du document.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(doc: Row) {
    try {
      const res = await fetch(`/api/documents/download?id=${encodeURIComponent(str(doc.id))}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) throw new Error(json.error || 'Telechargement impossible.')
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Telechargement impossible.')
    }
  }

  async function handleDelete(doc: Row) {
    const ok = await askConfirm({
      title: 'Supprimer ce document ?',
      message: `Le document "${str(doc.nom)}" sera supprime definitivement (y compris du stockage). Cette action est irreversible.`,
      confirmLabel: 'Supprimer definitivement',
      variant: 'danger',
    })
    if (!ok) return
    try {
      // Suppression DEFINITIVE : purge le fichier R2 puis la ligne en base.
      // (La corbeille generique ne gere pas les fichiers R2 ; on supprime ici
      // directement pour ne pas laisser de RIB/Kbis orphelin sur le stockage.)
      const res = await fetch(`/api/documents/${encodeURIComponent(str(doc.id))}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || json.error || 'Echec de la suppression.')
      toast.success('Document supprime.')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Echec de la suppression.')
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">
        Mes documents
      </h2>

      {/* Zone d'upload + categorie */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,26,58,0.04)]">
        <div className="mb-3">
          <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
            Categorie du document
          </label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="w-full max-w-xs cursor-pointer rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] py-2.5 px-4 font-hanken text-[14.5px] text-[#0f1a3a] focus:border-[#ff7a1a] focus:bg-white focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          className={[
            'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed px-6 py-8 text-center transition-all',
            dragOver ? 'border-[#ff7a1a] bg-[#fff1e6]' : 'border-gray-200 bg-[#fcfdfe] hover:border-[#ff7a1a] hover:bg-[#fff8f2]',
            uploading ? 'cursor-wait opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          {uploading ? (
            <Loader2 size={28} className="animate-spin text-[#ff7a1a]" />
          ) : (
            <UploadCloud size={28} className="text-[#ff7a1a]" />
          )}
          <span className="font-hanken text-sm font-semibold text-[#0f1a3a]">
            {uploading ? 'Televersement...' : 'Glisser-deposer ou cliquer pour ajouter'}
          </span>
          <span className="font-manrope text-xs text-gray-400">
            PDF, image, scan ou document Office &mdash; 10 Mo maximum
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Liste */}
      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : sortedDocs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="font-manrope text-sm text-gray-400">
            Aucun document dans votre coffre-fort. Ajoutez votre RIB, votre attestation decennale, votre Kbis...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDocs.map((doc) => {
            const meta = catMeta(str(doc.categorie))
            const taille = formatTaille(Number(doc.taille_octets) || 0)
            const dateFmt = str(doc.created_at) ? new Date(str(doc.created_at)).toLocaleDateString('fr-FR') : ''
            return (
              <div
                key={str(doc.id)}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,26,58,0.04)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f1a3a]">
                  <FileText size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-hanken text-sm font-semibold text-[#0f1a3a]">{str(doc.nom)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-manrope text-xs text-gray-400">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.badge}`}>{meta.label}</span>
                    {dateFmt && <span>{dateFmt}</span>}
                    {taille && <span>&middot; {taille}</span>}
                  </p>
                </div>
                <button onClick={() => handleDownload(doc)} aria-label="Telecharger" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a]">
                  <Download size={17} />
                </button>
                <button onClick={() => setSendDoc(doc)} aria-label="Envoyer" className="rounded-lg p-2 text-gray-400 hover:bg-[#fff1e6] hover:text-[#ff7a1a]">
                  <Mail size={17} />
                </button>
                <button onClick={() => handleDelete(doc)} aria-label="Supprimer" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={17} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {sendDoc && (
        <EnvoiDocumentModal
          document={sendDoc}
          devis={devis}
          clients={clients}
          onClose={() => setSendDoc(null)}
        />
      )}
    </section>
  )
}
