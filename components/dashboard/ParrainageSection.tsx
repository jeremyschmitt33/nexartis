'use client'

import { useEffect, useRef, useState } from 'react'
import { Gift, Copy, Check, Mail, MessageCircle, Share2, Pencil, Download, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

// Parrainage V2 (15/09/2026) — regle : cf. lib/parrainage.ts
//   filleul : 5 € de réduction ; parrain : 1 mois offert au 1er et au 10e
//   filleul payant, 5 € pour chacun des autres, sans plafond.

interface Filleul {
  numero: number
  statut: string
  recompense_type: string | null
  inscrit_le: string
  recompense_le: string | null
}

interface MesInfos {
  code: string
  lien: string
  stats: { inscrits: number; abonnes: number; mois_gagnes: number; euros_gagnes: number; en_attente: number }
  prochain_mois_offert: { rang: number; restants: number } | null
  filleuls: Filleul[]
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Libelle + couleur d'un statut, cote PARRAIN (anonymise).
function statutBadge(statut: string, type: string | null): { label: string; cls: string } {
  const gain = type === '5eur' ? '5 € obtenus' : '1 mois offert obtenu'
  switch (statut) {
    case 'recompense':
      return { label: gain, cls: 'bg-green-100 text-green-700' }
    case 'recompense_filleul_seul':
      return {
        label: type === '5eur' ? 'Abonnez-vous pour recevoir vos 5 €' : 'Abonnez-vous pour activer votre mois',
        cls: 'bg-amber-100 text-amber-800',
      }
    case 'non_recompense_plafond':
      return { label: 'Abonné (ancienne règle, plafond atteint)', cls: 'bg-sky/15 text-[#1a6fb5]' }
    case 'annule':
      return { label: 'Annulé', cls: 'bg-red-100 text-red-700' }
    default:
      return { label: 'Inscrit — pas encore abonné', cls: 'bg-gray-100 text-gray-600' }
  }
}

export default function ParrainageSection() {
  const [infos, setInfos] = useState<MesInfos | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'lien' | 'code' | null>(null)

  // Personnalisation du code
  const [editing, setEditing] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSaved, setCodeSaved] = useState(false)

  const qrWrapRef = useRef<HTMLDivElement>(null)

  const charger = () =>
    fetch('/api/parrainage/mes-infos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInfos(d))
      .catch(() => setInfos(null))

  useEffect(() => {
    charger().finally(() => setLoading(false))
  }, [])

  const copier = async (texte: string, quoi: 'lien' | 'code') => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopied(quoi)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  const ouvrirEdition = () => {
    if (!infos) return
    setCodeDraft(infos.code)
    setCodeError(null)
    setCodeSaved(false)
    setEditing(true)
  }

  const enregistrerCode = async () => {
    const code = codeDraft.trim().toUpperCase()
    if (!/^[A-Z0-9]{6,16}$/.test(code)) {
      setCodeError('De 6 à 16 lettres ou chiffres, sans espace, accent ni tiret.')
      return
    }
    setSaving(true)
    setCodeError(null)
    try {
      const res = await fetch('/api/parrainage/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCodeError((data as { error?: string }).error || 'Impossible d’enregistrer ce code.')
        return
      }
      await charger()
      setEditing(false)
      setCodeSaved(true)
      setTimeout(() => setCodeSaved(false), 3000)
    } catch {
      setCodeError('Erreur de connexion.')
    } finally {
      setSaving(false)
    }
  }

  const telechargerQr = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas')
    if (!canvas || !infos) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `QR-parrainage-${infos.code}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const message = infos
    ? `Je gère mes devis et factures avec Nexartis et je le recommande. Inscris-toi avec mon code ${infos.code} : 5 € offerts sur ton abonnement. ${infos.lien}`
    : ''
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
  const mailUrl = `mailto:?subject=${encodeURIComponent('Découvre Nexartis (5 € offerts avec mon code)')}&body=${encodeURIComponent(message)}`
  const fbUrl = infos ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(infos.lien)}` : '#'

  if (loading) {
    return <div className="text-sm text-gray-400 font-manrope py-8">Chargement…</div>
  }
  if (!infos) {
    return <div className="text-sm text-gray-500 font-manrope py-8">Impossible de charger vos informations de parrainage pour le moment.</div>
  }

  const gains: string[] = []
  if (infos.stats.mois_gagnes > 0) gains.push(`${infos.stats.mois_gagnes} mois`)
  if (infos.stats.euros_gagnes > 0) gains.push(`${infos.stats.euros_gagnes} €`)

  return (
    <div className="space-y-6">
      {/* Intro + règle */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky/10 flex items-center justify-center flex-shrink-0">
          <Gift size={20} className="text-[#1a6fb5]" />
        </div>
        <div>
          <h2 className="font-syne font-bold text-lg text-[#1a1a2e]">Parrainage</h2>
          <p className="font-manrope text-sm text-gray-500 leading-relaxed">
            Invitez d’autres artisans. Dès qu’un filleul prend son 1<sup>er</sup> abonnement :
          </p>
          <ul className="mt-2 space-y-1 font-manrope text-sm text-[#1a1a2e]">
            <li>• <strong>votre filleul</strong> gagne <strong>5 €</strong> de réduction sur sa prochaine facture ;</li>
            <li>• <strong>vous</strong> gagnez <strong>5 €</strong> de réduction par filleul, sans limite ;</li>
            <li>• bonus : <strong>1 mois offert</strong> pour votre 1<sup>er</sup> et votre 10<sup>e</sup> filleul (à la place des 5 €).</li>
          </ul>
        </div>
      </div>

      {/* Code + lien + partage + QR */}
      <div className="bg-sky/5 border border-sky/20 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Code */}
            <div>
              <label className="block font-manrope font-semibold text-sm text-[#1a1a2e] mb-2">Votre code parrain</label>
              {!editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center h-11 px-4 rounded-lg bg-white border border-gray-200 font-mono font-bold text-base tracking-wider text-[#1a1a2e]">
                    {infos.code}
                  </span>
                  <button
                    onClick={() => copier(infos.code, 'code')}
                    className="h-11 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-manrope text-[#1a1a2e] flex items-center gap-1.5 transition"
                  >
                    {copied === 'code' ? <><Check size={15} /> Copié</> : <><Copy size={15} /> Copier</>}
                  </button>
                  <button
                    onClick={ouvrirEdition}
                    className="h-11 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-manrope text-[#1a1a2e] flex items-center gap-1.5 transition"
                  >
                    <Pencil size={15} /> Personnaliser
                  </button>
                  {codeSaved && <span className="text-sm font-manrope text-green-700">Code enregistré ✓</span>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={codeDraft}
                      onChange={(e) => setCodeDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                      maxLength={16}
                      autoFocus
                      aria-label="Nouveau code parrain"
                      placeholder="EX : PLOMBERIEDUPONT"
                      className="flex-1 h-11 rounded-lg border border-gray-200 px-3 font-mono font-bold tracking-wider text-[#1a1a2e] bg-white outline-none focus:border-sky focus:ring-1 focus:ring-sky"
                    />
                    <button
                      onClick={enregistrerCode}
                      disabled={saving}
                      className="h-11 px-4 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white font-manrope font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      aria-label="Annuler"
                      className="h-11 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[#1a1a2e] flex items-center justify-center transition"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-xs font-manrope text-gray-500">
                    De 6 à 16 lettres ou chiffres. ⚠️ Les liens et QR codes déjà partagés avec l’ancien code ne fonctionneront plus.
                  </p>
                  {codeError && <p className="text-sm font-manrope text-red-600">{codeError}</p>}
                </div>
              )}
            </div>

            {/* Lien */}
            <div>
              <label className="block font-manrope font-semibold text-sm text-[#1a1a2e] mb-2">Votre lien de parrainage</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={infos.lien}
                  aria-label="Lien de parrainage"
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 h-11 rounded-lg border border-gray-200 px-3 font-mono text-xs sm:text-sm text-[#1a1a2e] bg-white"
                />
                <button
                  onClick={() => copier(infos.lien, 'lien')}
                  className="h-11 px-4 rounded-lg bg-[#e87a2a] hover:bg-[#f09050] text-white font-manrope font-semibold text-sm flex items-center justify-center gap-2 transition"
                >
                  {copied === 'lien' ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
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
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-2 md:w-44 flex-shrink-0">
            <div ref={qrWrapRef} className="bg-white p-3 rounded-xl border border-gray-200">
              <QRCodeCanvas value={infos.lien} size={512} marginSize={2} style={{ width: 140, height: 140 }} aria-label={`QR code du lien de parrainage ${infos.code}`} />
            </div>
            <button
              onClick={telechargerQr}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-manrope text-[#1a1a2e] hover:bg-gray-50 transition"
            >
              <Download size={15} /> Télécharger le QR code
            </button>
            <p className="text-[11px] text-gray-400 font-manrope text-center leading-snug">
              À mettre sur vos cartes de visite, votre camion ou vos réseaux.
            </p>
          </div>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Filleuls inscrits</div>
          <div className="text-2xl font-syne font-bold text-[#1a1a2e] mt-1">{infos.stats.inscrits}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Devenus abonnés</div>
          <div className="text-2xl font-syne font-bold text-[#1a1a2e] mt-1">{infos.stats.abonnes}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500 font-manrope">Vous avez gagné</div>
          <div className="text-2xl font-syne font-bold text-green-600 mt-1">{gains.length > 0 ? gains.join(' + ') : '0 €'}</div>
          {infos.stats.en_attente > 0 && (
            <div className="text-[11px] text-amber-700 font-manrope mt-1">
              {infos.stats.en_attente} récompense{infos.stats.en_attente > 1 ? 's' : ''} en attente de votre abonnement
            </div>
          )}
        </div>
      </div>

      {infos.prochain_mois_offert && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm font-manrope text-green-800">
          {infos.prochain_mois_offert.rang === 1
            ? <>🎁 Votre <strong>1<sup>er</sup> filleul abonné</strong> vous rapporte <strong>1 mois offert</strong>.</>
            : <>🎁 Plus que <strong>{infos.prochain_mois_offert.restants} filleul{infos.prochain_mois_offert.restants > 1 ? 's' : ''} abonné{infos.prochain_mois_offert.restants > 1 ? 's' : ''}</strong> avant votre prochain <strong>mois offert</strong> (au 10<sup>e</sup>).</>}
        </div>
      )}

      {/* Liste filleuls (anonymisée) */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-manrope font-semibold text-sm text-[#1a1a2e]">
          Vos filleuls
        </div>
        {infos.filleuls.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 font-manrope">
            Aucun filleul pour l’instant. Partagez votre code ou votre QR code pour commencer !
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {infos.filleuls.map((f) => {
              const badge = statutBadge(f.statut, f.recompense_type)
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
        Pour respecter la vie privée de vos filleuls, leur identité n’est jamais affichée. Les réductions sont
        déduites automatiquement de vos prochaines factures d’abonnement et se cumulent d’un mois à l’autre.
        Si vous en parlez publiquement sur vos réseaux sociaux en échange de ces avantages, la loi demande
        d’indiquer « Collaboration commerciale ».
      </p>
    </div>
  )
}
