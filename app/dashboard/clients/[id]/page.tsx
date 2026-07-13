'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Pencil,
  FileText,
  HardHat,
  Receipt,
  Plus,
} from 'lucide-react'
import {
  useSupabaseRecord,
  useSupabaseQuery,
  LoadingSkeleton,
} from '@/lib/hooks'
import PhotoSection from '@/components/photos/PhotoSection'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Client {
  id: string
  prenom?: string
  nom: string
  type: string
  email: string
  telephone: string
  adresse: string
}

interface Chantier {
  id: string
  titre: string
  statut: string
  progression: number
}

interface Devis {
  id: string
  numero: string
  statut: string
  created_at: string
  montant_ttc: number
}

interface Facture {
  id: string
  numero: string
  statut: string
  created_at: string
  montant_ttc: number
  montant_paye?: number
}

const TABS = [
  { key: 'chantiers', label: 'Chantiers', icon: HardHat },
  { key: 'devis', label: 'Devis', icon: FileText },
  { key: 'factures', label: 'Factures', icon: Receipt },
]

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: client, loading } = useSupabaseRecord<Client>('clients', id)
  const { data: chantiers, loading: loadingChantiers } = useSupabaseQuery<Chantier>('chantiers', { filters: { client_id: id } })
  const { data: devis, loading: loadingDevis } = useSupabaseQuery<Devis>('devis', { filters: { client_id: id } })
  const { data: factures, loading: loadingFactures } = useSupabaseQuery<Facture>('factures', { filters: { client_id: id } })

  const [activeTab, setActiveTab] = useState('chantiers')

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-sm font-hanken font-semibold text-gray-500 hover:text-[#0f1a3a] transition-colors"
        >
          <ArrowLeft size={16} />
          Retour aux clients
        </Link>
        <p className="text-sm font-hanken text-gray-500">Client introuvable.</p>
      </div>
    )
  }

  const caEncaisse = factures.reduce((sum, f) => sum + (f.montant_paye ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* ============ Retour ============ */}
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm font-hanken font-semibold text-gray-500 hover:text-[#0f1a3a] transition-colors"
      >
        <ArrowLeft size={16} />
        Retour aux clients
      </Link>

      {/* ============ Header : nom + badge + bouton modifier (V4) ============ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-hanken font-extrabold text-3xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            {`${client.prenom ?? ''} ${client.nom}`.trim()}
          </h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200/60">
            {client.type || 'Particulier'}
          </span>
        </div>
        <button
          onClick={() => router.push(`/dashboard/clients/${id}/modifier`)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white border-[1.5px] border-gray-200
                     font-hanken font-semibold text-sm text-[#0f1a3a]
                     shadow-[0_2px_6px_rgba(15,26,58,0.04)]
                     hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                     active:translate-y-0 transition-all duration-200"
        >
          <Pencil size={14} />
          Modifier
        </button>
      </div>

      {/* ============ Info + Metrics — PremiumCard ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coordonnées — carte V4 avec accent line orange */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
          <h2 className="font-hanken font-extrabold text-base text-[#0f1a3a] tracking-[-0.02em] mb-4">Coordonnées</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-sm font-hanken text-[#0f1a3a]">
              <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span>{client.adresse || <span className="text-gray-400">Non renseignée</span>}</span>
            </div>
            {/* Email + tél en font-spline-mono (data) */}
            <div className="flex items-center gap-2.5 text-sm text-[#0f1a3a]">
              <Mail size={16} className="text-gray-400 flex-shrink-0" />
              <span className="font-spline-mono font-medium tracking-[0.3px]">
                {client.email || <span className="text-gray-400 font-hanken">Non renseigné</span>}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#0f1a3a]">
              <Phone size={16} className="text-gray-400 flex-shrink-0" />
              <span className="font-spline-mono font-medium tracking-[0.3px]">
                {client.telephone || <span className="text-gray-400 font-hanken">Non renseigné</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Métriques — carte V4 */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
          <h2 className="font-hanken font-extrabold text-base text-[#0f1a3a] tracking-[-0.02em] mb-4">Chiffres</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Encaissé</p>
              <p className="font-spline-mono font-semibold text-2xl text-[#0f1a3a] tracking-[-0.01em]">
                {caEncaisse.toLocaleString('fr-FR')} <span className="text-gray-400">€</span>
              </p>
            </div>
            <div>
              <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Chantiers</p>
              <p className="font-spline-mono font-semibold text-2xl text-[#0f1a3a]">{chantiers.length}</p>
            </div>
            <div>
              <p className="text-[11.5px] font-hanken font-semibold uppercase tracking-wider text-gray-500 mb-1">Devis</p>
              <p className="font-spline-mono font-semibold text-2xl text-[#0f1a3a]">{devis.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Contenu principal + Sidebar (V4) ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Onglets & contenu */}
        <div className="lg:col-span-3 space-y-4">
          {/* Barre d'onglets — accent orange V4 */}
          <div className="flex gap-1 border-b border-[#0f1a3a]/[0.08]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-hanken font-bold -mb-px border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#0f1a3a] border-[#ff7a1a]'
                    : 'text-gray-500 border-transparent hover:text-[#0f1a3a]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenu d'onglet */}
          <div className="bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-hidden shadow-[0_8px_24px_rgba(15,26,58,0.04)]">
            {activeTab === 'chantiers' && (
              loadingChantiers ? <div className="p-4"><LoadingSkeleton rows={2} /></div> : chantiers.length === 0 ? (
                <div className="py-12 text-center">
                  <HardHat size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-hanken text-gray-500">Aucun chantier</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
                      {['Chantier', 'Statut', 'Progression'].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chantiers.map((ch) => (
                      <tr key={ch.id} className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors">
                        <td className="px-4 py-3 text-sm font-hanken font-bold text-[#0f1a3a]">{ch.titre ?? ''}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                            {ch.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              {/* Barre orange — couleur signature V4 */}
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d]"
                                style={{ width: `${ch.progression ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-spline-mono font-medium text-gray-500">{ch.progression ?? 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'devis' && (
              loadingDevis ? <div className="p-4"><LoadingSkeleton rows={2} /></div> : devis.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-hanken text-gray-500">Aucun devis</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
                      {['Numéro', 'Statut', 'Date', 'Total TTC'].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devis.map((d) => (
                      <tr key={d.id} className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors">
                        {/* Numéro en mono : c'est un identifiant "data" */}
                        <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-[#0f1a3a] tracking-[0.3px]">{d.numero}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                            {d.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : ''}
                        </td>
                        <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-[#0f1a3a]">
                          {(d.montant_ttc ?? 0).toLocaleString('fr-FR')} <span className="text-gray-400">€</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'factures' && (
              loadingFactures ? <div className="p-4"><LoadingSkeleton rows={2} /></div> : factures.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-hanken text-gray-500">Aucune facture</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
                      {['Numéro', 'Statut', 'Date', 'Total TTC'].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-[11.5px] font-hanken font-bold uppercase tracking-wider text-gray-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {factures.map((f) => (
                      <tr key={f.id} className="border-b border-gray-100 hover:bg-[#fafbfc] transition-colors">
                        <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-[#0f1a3a] tracking-[0.3px]">{f.numero}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-hanken font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                            {f.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-spline-mono font-medium text-gray-600 tracking-[0.3px]">
                          {f.created_at ? new Date(f.created_at).toLocaleDateString('fr-FR') : ''}
                        </td>
                        <td className="px-4 py-3 text-sm font-spline-mono font-semibold text-[#0f1a3a]">
                          {(f.montant_ttc ?? 0).toLocaleString('fr-FR')} <span className="text-gray-400">€</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* ============ Sidebar — actions rapides V4 ============ */}
        <div className="space-y-3">
          <h2 className="text-[11.5px] font-hanken font-bold uppercase tracking-wider text-[#ff7a1a]">Actions rapides</h2>
          {/* CTA primaire — gradient orange V4 */}
          <Link
            href={`/dashboard/devis/nouveau?client_id=${id}`}
            className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl
                       bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white text-sm font-hanken font-bold
                       shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)]
                       hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0
                       transition-all duration-200"
          >
            <Plus size={16} />
            Créer un devis
          </Link>
          {client.telephone && (
            <a
              href={`tel:${client.telephone.replace(/\s/g, '')}`}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl
                         bg-white border-[1.5px] border-gray-200 text-sm font-hanken font-semibold text-[#0f1a3a]
                         shadow-[0_2px_6px_rgba(15,26,58,0.04)]
                         hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                         active:translate-y-0 transition-all duration-200"
            >
              <Phone size={16} />
              Appeler
            </a>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl
                         bg-white border-[1.5px] border-gray-200 text-sm font-hanken font-semibold text-[#0f1a3a]
                         shadow-[0_2px_6px_rgba(15,26,58,0.04)]
                         hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                         active:translate-y-0 transition-all duration-200"
            >
              <Mail size={16} />
              Envoyer un email
            </a>
          )}
        </div>
      </div>

      {/* ============ Photos du client (toutes interventions) ============ */}
      <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
        <PhotoSection scope="client" clientId={id} titre="Photos du client" adresse={String(client.adresse ?? '')} />
      </div>
    </div>
  )
}
