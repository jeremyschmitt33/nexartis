'use client'

// ============================================================================
// app/signer/cop/[token]/page.tsx
// ----------------------------------------------------------------------------
// Page PUBLIQUE (sans compte) : le client ouvre le lien recu par email et
// consulte / imprime sa copie du contrat d'ouverture de porte. Lecture seule.
// Route sous /signer => pas de header/footer marketing (HIDDEN_ROUTES).
// ============================================================================

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { buildCopDocument, type RawCop } from '@/lib/cop-data'
import { themeFromEntreprise } from '@/lib/document-theme'
import { logoConfigFromEntreprise } from '@/lib/logo-config'
import CopDocument from '@/components/document/CopDocument'

interface PublicCopResponse {
  cop: RawCop
  entreprise: Record<string, unknown>
}

export default function SignerCopPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [data, setData] = useState<PublicCopResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/public/cop/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Lien invalide ou expire')
        }
        return r.json()
      })
      .then((d: PublicCopResponse) => { if (!cancelled) setData(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Lien invalide') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eceef4]">
        <p className="font-manrope text-sm text-gray-500">Chargement de votre contrat…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eceef4] px-4">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="font-hanken text-lg font-bold text-[#0f1a3a]">Lien indisponible</h1>
          <p className="mt-2 font-manrope text-sm text-gray-500">{error || 'Ce lien n\'est plus valide.'}</p>
        </div>
      </div>
    )
  }

  const copData = buildCopDocument(data.cop, data.entreprise as unknown as Record<string, unknown>)
  const theme = themeFromEntreprise(data.entreprise)
  const logoConfig = logoConfigFromEntreprise(data.entreprise)

  return (
    <div className="min-h-screen bg-[#eceef4] px-3 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-hanken text-lg font-bold text-[#0f1a3a]">Votre contrat d&apos;ouverture de porte</h1>
          <button
            type="button"
            onClick={() => { if (typeof window !== 'undefined') window.print() }}
            className="flex items-center gap-2 rounded-xl border border-[#0f1a3a] bg-white px-4 py-2.5 font-hanken text-sm font-bold text-[#0f1a3a]"
          >
            <Printer size={16} /> Imprimer / PDF
          </button>
        </div>

        <div id="cop-print-area" className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(15,26,58,0.06)]">
          <CopDocument data={copData} theme={theme} logoConfig={logoConfig} />
        </div>
      </div>

      {/* Impression : n'afficher que le contrat. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #cop-print-area, #cop-print-area * { visibility: visible !important; }
          #cop-print-area { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
          @page { size: A4; margin: 0; }
        }
      ` }} />
    </div>
  )
}
