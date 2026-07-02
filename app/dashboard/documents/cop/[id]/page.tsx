'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Printer, KeyRound, Check, Receipt } from 'lucide-react'
import { useEntreprise, useSupabaseRecord, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { PremiumButton } from '@/components/ui/v4'
import { buildCopDocument, type RawCop } from '@/lib/cop-data'
import { hasMetier } from '@/lib/metiers'
import { themeFromEntreprise } from '@/lib/document-theme'
import { logoConfigFromEntreprise } from '@/lib/logo-config'
import CopDocument from '@/components/document/CopDocument'
import CopSignSection from '@/components/documents/CopSignSection'
import CopFactureSection from '@/components/documents/CopFactureSection'

// Next 14 App Router (client component) : on lit l'id via useParams().
export default function CopDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const { entreprise, loading: loadingEntreprise } = useEntreprise()
  const { data: cop, loading, error } = useSupabaseRecord<Record<string, unknown>>('contrats_ouverture', id || null)

  const isSerrurier = hasMetier(entreprise as Record<string, unknown> | null, 'serrurier')

  const previewData = useMemo(() => {
    if (!entreprise || !cop) return null
    return buildCopDocument(cop as RawCop, entreprise as unknown as Record<string, unknown>)
  }, [entreprise, cop])

  const theme = useMemo(() => themeFromEntreprise(entreprise), [entreprise])
  const logoConfig = useMemo(() => logoConfigFromEntreprise(entreprise), [entreprise])

  if (loadingEntreprise || loading) {
    return <div className="p-6"><LoadingSkeleton rows={8} /></div>
  }

  if (!isSerrurier) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1e6] text-[#ff7a1a]">
          <KeyRound size={26} />
        </span>
        <h1 className="font-hanken text-xl font-bold text-[#0f1a3a]">Reserve aux serruriers</h1>
        <div className="mt-6">
          <Link href="/dashboard/documents">
            <PremiumButton variant="secondary" icon={<ArrowLeft size={18} />}>Retour aux documents</PremiumButton>
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="p-6"><ErrorBanner message={error} /></div>
  }

  if (!cop) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-hanken text-xl font-bold text-[#0f1a3a]">Contrat introuvable</h1>
        <div className="mt-6">
          <Link href="/dashboard/documents">
            <PremiumButton variant="secondary" icon={<ArrowLeft size={18} />}>Retour aux documents</PremiumButton>
          </Link>
        </div>
      </div>
    )
  }

  // Impression : window.print() en 1a. Le PDF jsPDF viendra en 1b.
  function handlePrint() {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/documents" className="inline-flex items-center gap-1.5 font-manrope text-xs text-gray-400 hover:text-[#0f1a3a]">
            <ArrowLeft size={14} /> Documents
          </Link>
          <h1 className="mt-1 font-hanken text-2xl font-bold text-[#0f1a3a]">
            {String((cop as Record<string, unknown>).numero || 'Contrat d\'ouverture de porte')}
          </h1>
        </div>
        <PremiumButton variant="secondary" icon={<Printer size={18} />} onClick={handlePrint}>Imprimer</PremiumButton>
      </div>

      {String((cop as Record<string, unknown>).statut) === 'signe' ? (
        <>
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 font-manrope text-sm text-[#166534]">
            <Check size={16} />
            <span>
              Contrat signe
              {(cop as Record<string, unknown>).signed_by ? ` par ${String((cop as Record<string, unknown>).signed_by)}` : ''}
              {(cop as Record<string, unknown>).date_signature
                ? ` le ${new Date(String((cop as Record<string, unknown>).date_signature)).toLocaleString('fr-FR')}`
                : ''}.
            </span>
          </div>
          {(cop as Record<string, unknown>).facture_id ? (
            <Link
              href="/dashboard/factures"
              className="mb-6 flex items-center gap-2 rounded-xl border border-[#dbe4ff] bg-[#fafbff] px-4 py-3 font-manrope text-sm text-[#1d4ed8] hover:bg-[#eef2ff]"
            >
              <Receipt size={16} /> Une facture a ete generee pour ce contrat — voir dans Factures
            </Link>
          ) : (
            <CopFactureSection copId={id} />
          )}
        </>
      ) : (
        <CopSignSection
          copId={id}
          defaultSignedBy={[
            (cop as Record<string, unknown>).client_prenom,
            (cop as Record<string, unknown>).client_nom,
          ].filter(Boolean).join(' ')}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(15,26,58,0.06)]">
        {previewData && <CopDocument data={previewData} theme={theme} logoConfig={logoConfig} />}
      </div>
    </div>
  )
}
