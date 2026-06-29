'use client'

import { useState, useMemo } from 'react'
import { ScrollText, ClipboardCheck, Plus, Pencil, Trash2, FileText } from 'lucide-react'
import {
  useDocumentsTypes,
  useEntreprise,
  useClients,
  useChantiers,
  useDevis,
  softDeleteRow,
  LoadingSkeleton,
  ErrorBanner,
} from '@/lib/hooks'
import { PremiumButton, PremiumCard } from '@/components/ui/v4'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import { DOC_TYPES_META, getDocTypeMeta, type DocTypeKind } from '@/lib/documents-types'
import DocumentEditorModal from '@/components/documents/DocumentEditorModal'
import CoffreFortSection from '@/components/documents/CoffreFortSection'
import HistoriqueEnvoisSection from '@/components/documents/HistoriqueEnvoisSection'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

const ICONS: Record<string, typeof ScrollText> = {
  ScrollText,
  ClipboardCheck,
}

export default function DocumentsPage() {
  const askConfirm = useConfirm()
  const { data: docs, loading, error, refetch } = useDocumentsTypes()
  const { entreprise } = useEntreprise()
  const { data: clients } = useClients()
  const { data: chantiers } = useChantiers()
  const { data: devis } = useDevis()

  // Modale : type = creation d'un nouveau modele ; editing = edition d'une ligne.
  const [createType, setCreateType] = useState<DocTypeKind | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const modalOpen = createType !== null || editing !== null

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))
  }, [docs])

  async function handleDelete(doc: Row) {
    const ok = await askConfirm({
      title: 'Mettre a la corbeille ?',
      message: `Le document "${str(doc.titre)}" sera deplace dans la corbeille.`,
      confirmLabel: 'Mettre a la corbeille',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await softDeleteRow('documents_types', str(doc.id))
      toast.success('Document mis a la corbeille.')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Echec de la suppression.')
    }
  }

  function closeModal() { setCreateType(null); setEditing(null) }
  function onSaved() { closeModal(); refetch() }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-hanken text-2xl font-bold text-[#0f1a3a]">Documents types</h1>
        <p className="mt-1 font-manrope text-sm text-gray-500">
          Generez des modeles pre-remplis a partir de votre profil, modifiez-les, puis telechargez-les en PDF. 100% gratuit.
        </p>
      </header>

      {/* Cartes des modeles disponibles */}
      <section>
        <h2 className="mb-3 font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">
          Creer un document
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOC_TYPES_META.map((m) => {
            const Icon = ICONS[m.icon] || FileText
            return (
              <PremiumCard key={m.type} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1e6] text-[#ff7a1a]">
                    <Icon size={22} />
                  </span>
                  <h3 className="font-hanken text-base font-bold text-[#0f1a3a]">{m.label}</h3>
                </div>
                <p className="font-manrope text-sm leading-relaxed text-gray-500">{m.description}</p>
                <div className="mt-auto pt-1">
                  <PremiumButton variant="primary" icon={<Plus size={18} />} onClick={() => setCreateType(m.type)}>
                    Creer ce document
                  </PremiumButton>
                </div>
              </PremiumCard>
            )
          })}
        </div>
      </section>

      {/* Liste des documents enregistres */}
      <section>
        <h2 className="mb-3 font-hanken text-sm font-semibold uppercase tracking-wide text-gray-400">
          Mes documents
        </h2>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : error ? (
          <ErrorBanner message={error} onRetry={refetch} />
        ) : sortedDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
            <p className="font-manrope text-sm text-gray-400">
              Aucun document enregistre pour le moment. Creez votre premier modele ci-dessus.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDocs.map((doc) => {
              const meta = getDocTypeMeta(str(doc.type))
              const Icon = meta ? (ICONS[meta.icon] || FileText) : FileText
              return (
                <div
                  key={str(doc.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,26,58,0.04)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f1a3a]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-hanken text-sm font-semibold text-[#0f1a3a]">{str(doc.titre)}</p>
                    <p className="font-manrope text-xs text-gray-400">
                      {meta?.label || str(doc.type)}
                      {str(doc.updated_at) ? ` - modifie le ${new Date(str(doc.updated_at)).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(doc)}
                    aria-label="Modifier"
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a]"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    aria-label="Supprimer"
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Coffre-fort : documents televerses par l'artisan (Vague 2b) */}
      <CoffreFortSection devis={devis} clients={clients} />

      {/* Journal des envois : trace de qui a recu quoi et quand. */}
      <HistoriqueEnvoisSection />

      {modalOpen && (
        <DocumentEditorModal
          type={createType}
          editing={editing}
          entreprise={entreprise}
          clients={clients}
          chantiers={chantiers}
          devis={devis}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
