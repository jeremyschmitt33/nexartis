'use client'

import { useEffect, useState } from 'react'
import { Gift, Copy, Check, Mail, MessageCircle, Share2 } from 'lucide-react'

interface Filleul {
  numero: number
  statut: string
  inscrit_le: string
  recompense_le: string | null
}

interface MesInfos {
  code: string
  lien: string
  plafond: number
  stats: { inscrits: number; abonnes: number; mois_gagnes: number }
  filleuls: Filleul[]
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Libelle + couleur d'un statut, cote PARRAIN (anonymise).
function statutBadge(statut: string): { label: string; cls: string } {
  switch (statut) {
    case 'recompense':
      return { label: 'Mois offert obtenu', cls: 'bg-green-100 text-green-700' }
    case 'recompense_filleul_seul':
      return { label: 'Abonnez-vous pour activer votre mois', cls: 'bg-amber-100 text-amber-800' }
    case 'non_recompense_plafond':
      return { label: 'Abonné (plafond atteint)', cls: 'bg-sky/15 text-[#1a6fb5]' }
    case 'annule':
      return { label: 'Annulé', cls: 'bg-red-100 text-red-700' }
    default:
      return { label: 'Inscrit — en attente', cls: 'bg-gray-100 text-gray-600' }
  }
}

export default function ParrainageSection() {
  const [infos, setInfos] = useState<MesInfos | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/parrainage/mes-infos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInfos(d))
      .catch(() => setInfos(null))
      .finally(() => setLoading(false))
  }, [])

  const copyLien = async () => {
    if (!infos) return
    try {
      await navigator.clipboard.writeText(infos.lien)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const message = infos
    ? `Je gère mes devis et factures avec Nexartis et je le recommande. Inscris-toi avec mon lien : on gagne chacun 1 mois offert ! ${infos.lien}`
    : ''
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
  const mailUrl = `mailto:?subject=${encodeURIComponent('Découvre Nexartis (1 mois offert pour nous deux)')}&body=${encodeURIComponent(message)}`
  const fbUrl = infos ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(infos.lien)}` : '#'

  if (loading) {
    return <div className="text-sm text-gray-400 font-manrope py-8">Chargement…</div>
  }
  if (!infos) {
    return <div className="text-sm text-gray-500 font-manrope py-8">Impossible de charger vos informations de parrainage pour le moment.</div>
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky/10 flex items-center justify-center flex-shrink-0">
          <Gift size={20} className="text-[#1a6fb5]" />
        </div>
        <div>
          <h2 className="font-syne font-bold text-lg text-[#1a1a2e]">Parrainage</h2>
          <p className="font-manrope text-sm text-gray-500 leading-relaxed">
            Invitez un autre artisan. Dès qu’il prend son 1<sup>er</sup> abonnement, vous gagnez chacun 1 mois offert
            (jusqu’à {infos.plafond} mois offerts).
          </p>
        </div>
      </div>

      {/* Lien + partage */}
      <div className="bg-sky/5 border border-sky/20 rounded-2xl p-5">
        <label className="block font-manrope font-semibold text-sm text-[#1a1a2e] mb-2">Votre lien de parrainage</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            value={infos.lien}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 h-11 rounded-lg border border-gray-200 px-3 font-mono text-xs sm:text-sm text-[#1a1a2e] bg-white"
          />
          <button
            onClick={copyLien}
            className="h-11 px-4 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white font-manrope font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-manrope text-[#1a1a2e] hover:bg-gray-50 transition">
            <MessageCircle size={15} /> WhatsApp
          </a>
          <a href={mailUrl} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-manrope text-[#1a1a2e] hover:bg-gray-50 transition">
            <Mail size={15} /> Email
          </a>
          <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-manrope text-[#1a1a2e] hover:bg-gray-50 transition">
            <Share2 size={15} /> Facebook
          </a>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Filleuls inscrits</div>
          <div className="text-2xl font-syne font-bold text-[#1a1a2e] mt-1">{infos.stats.inscrits}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Devenus abonnés</div>
          <div className="text-2xl font-syne font-bold text-[#1a1a2e] mt-1">{infos.stats.abonnes}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Mois offerts gagnés</div>
          <div className="text-2xl font-syne font-bold text-green-600 mt-1">
            {infos.stats.mois_gagnes}
            <span className="text-sm text-gray-400 font-manrope font-normal"> / {infos.plafond}</span>
          </div>
        </div>
      </div>

      {/* Liste filleuls (anonymisee) */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-manrope font-semibold text-sm text-[#1a1a2e]">
          Vos filleuls
        </div>
        {infos.filleuls.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 font-manrope">
            Aucun filleul pour l’instant. Partagez votre lien pour commencer !
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {infos.filleuls.map((f) => {
              const badge = statutBadge(f.statut)
              return (
                <li key={f.numero} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-manrope font-semibold text-sm flex-shrink-0">
                      {f.numero}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-manrope text-[#1a1a2e]">Filleul n°{f.numero}</div>
                      <div className="text-xs text-gray-400 font-manrope">Inscrit le {formatDate(f.inscrit_le)}</div>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-manrope font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 font-manrope leading-relaxed">
        Pour respecter la vie privée de vos filleuls, leur identité n’est jamais affichée. Le mois offert s’applique
        au mois suivant le 1<sup>er</sup> paiement, pour vous comme pour votre filleul.
      </p>
    </div>
  )
}
