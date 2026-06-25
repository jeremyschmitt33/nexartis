'use client'

// ===================================================================
// Onglet "Factures recues" (RECEPTION e-facture, obligation 01/09/2026).
// Liste dual layout (cards mobile 375px / table desktop), filtres,
// drawer de detail avec apercu securise (signed URL courte) + refus motive.
// Design : V4 light (navy #0f1a3a, orange #ff7a1a, font-hanken/spline-mono).
// Accessibilite : pastilles de statut avec LIBELLE TEXTE (pas couleur seule),
// aria-label sur les boutons icone.
// ===================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  Inbox, Search, X, Download, Ban, FileText, Building2,
  AlertTriangle, ExternalLink, Loader2,
} from 'lucide-react'
import { useFacturesRecues, updateRow, LoadingSkeleton, ErrorBanner } from '@/lib/hooks'
import { PremiumInput, PremiumSelect, FieldLabel } from '@/components/ui/v4'
import { toast } from '@/lib/toast'

// --- Statuts : libelle + couleurs (texte toujours present pour l'a11y) ------
const STATUT_META: Record<string, { label: string; bg: string; fg: string }> = {
  recue:       { label: 'Nouvelle',            bg: '#e0edff', fg: '#1e40af' },
  consultee:   { label: 'Consultée',           bg: '#eef2f7', fg: '#334155' },
  approuvee:   { label: 'Approuvée',           bg: '#dcfce7', fg: '#15803d' },
  litige:      { label: 'En litige',           bg: '#fef3c7', fg: '#b45309' },
  refusee:     { label: 'Refusée',             bg: '#fee2e2', fg: '#b91c1c' },
  encaissee:   { label: 'Payée',               bg: '#dcfce7', fg: '#15803d' },
  rejetee:     { label: 'Rejetée (technique)', bg: '#fee2e2', fg: '#b91c1c' },
  irrecevable: { label: 'Irrecevable',         bg: '#fee2e2', fg: '#b91c1c' },
  en_attente:  { label: 'En attente',          bg: '#eef2f7', fg: '#334155' },
  classee:     { label: 'Classée',             bg: '#eef2f7', fg: '#334155' },
}

const REFUS_MOTIFS: { code: string; label: string }[] = [
  { code: 'AMOUNT_INCORRECT', label: 'Montant(s) incorrect(s)' },
  { code: 'VAT_INCORRECT', label: 'TVA incorrecte' },
  { code: 'PRICE_NOT_AGREED', label: 'Prix non conforme à la commande / au devis' },
  { code: 'DUPLICATE', label: 'Facture en double' },
  { code: 'NO_ORDER', label: 'Aucune commande ne correspond' },
  { code: 'WRONG_RECIPIENT', label: 'Destinataire erroné (pas pour nous)' },
  { code: 'MISSING_REFERENCE', label: 'Référence obligatoire manquante' },
  { code: 'GOODS_NOT_RECEIVED', label: 'Marchandise / prestation non reçue' },
  { code: 'SERVICE_NOT_CONFORM', label: 'Prestation non conforme' },
  { code: 'WORK_NOT_DONE', label: 'Travaux non réalisés / incomplets' },
  { code: 'LEGAL_MENTIONS_MISSING', label: 'Mentions légales manquantes' },
  { code: 'WRONG_VAT_NUMBER', label: 'N° de TVA / SIRET erroné' },
  { code: 'COMMERCIAL_DISPUTE', label: 'Litige commercial' },
  { code: 'OTHER', label: 'Autre motif (à préciser)' },
]

type Rec = Record<string, unknown>

function fmtMoney(v: unknown): string {
  const n = Number(v ?? 0)
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(v: unknown): string {
  const s = v as string | undefined
  return s ? new Date(s).toLocaleDateString('fr-FR') : '—'
}

function StatutPill({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] || { label: statut, bg: '#eef2f7', fg: '#334155' }
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full font-hanken text-[11.5px] font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  )
}

export default function FacturesRecuesTab() {
  const { data: factures, loading, error, refetch } = useFacturesRecues()

  const [connected, setConnected] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('Tous')
  const [selected, setSelected] = useState<Rec | null>(null)

  // Etat de connexion SUPER PDP (pour l'etat "pas connecte").
  useEffect(() => {
    let alive = true
    fetch('/api/superpdp/status')
      .then((r) => r.json())
      .then((d) => { if (alive) setConnected(!!d.connected) })
      .catch(() => { if (alive) setConnected(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    return factures.filter((f) => {
      const rec = f as Rec
      if (statutFilter !== 'Tous' && (rec.statut as string) !== statutFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const nom = String(rec.emetteur_nom ?? '').toLowerCase()
        const num = String(rec.numero ?? '').toLowerCase()
        return nom.includes(q) || num.includes(q)
      }
      return true
    })
  }, [factures, search, statutFilter])

  const nbNouvelles = useMemo(
    () => factures.filter((f) => (f as Rec).statut === 'recue').length,
    [factures],
  )

  if (loading) return <LoadingSkeleton rows={6} />
  if (error) return <ErrorBanner message={error} onRetry={refetch} />

  return (
    <div className="space-y-4">
      {/* Bandeau onboarding si pas connecte (et aucune facture deja recue, pour
          eviter toute contradiction : un membre voyant des factures n'est pas "non connecte"). */}
      {connected === false && factures.length === 0 && (
        <div className="rounded-2xl border border-[#ff7a1a]/30 bg-[#fff5ec] p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 text-[#ff7a1a] mt-0.5" />
          <div className="flex-1">
            <p className="font-hanken font-bold text-[14px] text-[#0f1a3a]">
              Activez la réception de vos factures électroniques
            </p>
            <p className="font-hanken text-[13px] text-gray-600 mt-1">
              Au 1<sup>er</sup> septembre 2026, vos fournisseurs vous enverront leurs factures par voie
              électronique. Connectez votre facturation pour les recevoir automatiquement ici.
            </p>
            <a
              href="/dashboard/parametres"
              className="inline-flex items-center gap-1.5 mt-2 font-hanken text-[13px] font-semibold text-[#ff7a1a] hover:underline"
            >
              Aller dans Paramètres <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      {/* Barre d'action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <PremiumInput
            type="text"
            placeholder="Rechercher un fournisseur, un n°..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="[&_input]:pl-10"
          />
        </div>
        <PremiumSelect value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="sm:w-auto">
          <option value="Tous">Tous les statuts</option>
          {Object.entries(STATUT_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </PremiumSelect>
      </div>

      {/* Compteur nouvelles */}
      {nbNouvelles > 0 && (
        <p className="font-hanken text-[13px] text-gray-600">
          <span className="font-bold text-[#0f1a3a]">{nbNouvelles}</span>{' '}
          nouvelle{nbNouvelles > 1 ? 's' : ''} facture{nbNouvelles > 1 ? 's' : ''} à traiter.
        </p>
      )}

      {/* Liste vide */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#0f1a3a]/[0.06] shadow-[0_8px_24px_rgba(15,26,58,0.06)]">
          <Inbox size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-hanken text-sm text-gray-500">
            {connected === false
              ? 'Aucune facture reçue pour le moment.'
              : 'Aucune facture reçue. Elles apparaîtront ici dès qu’un fournisseur vous en enverra une.'}
          </p>
        </div>
      ) : (
        <>
          {/* Cards mobile */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((f) => {
              const rec = f as Rec
              const id = rec.id as string
              return (
                <button
                  key={id}
                  onClick={() => openDetail(rec, setSelected, refetch)}
                  className="w-full text-left bg-white rounded-2xl border border-[#0f1a3a]/[0.06] px-4 py-3.5 hover:border-[#ff7a1a]/40 transition-all shadow-[0_2px_6px_rgba(15,26,58,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-hanken font-bold text-[14.5px] text-[#0f1a3a] truncate">
                        {String(rec.emetteur_nom ?? 'Fournisseur inconnu')}
                      </p>
                      <p className="font-spline-mono text-[11px] text-gray-500 truncate">
                        {String(rec.numero ?? '—')} · {fmtDate(rec.date_emission)}
                      </p>
                    </div>
                    <p className="font-spline-mono font-medium text-[15px] text-[#0f1a3a] shrink-0">
                      {fmtMoney(rec.montant_ttc)}&nbsp;€
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <StatutPill statut={String(rec.statut)} />
                    {rec.type_document === 'avoir' && (
                      <span className="font-hanken text-[11px] font-semibold text-[#b45309]">AVOIR</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Table desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#0f1a3a]/[0.06] overflow-x-auto shadow-[0_8px_24px_rgba(15,26,58,0.06)]">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#fafbfc] border-b border-[#0f1a3a]/[0.06]">
                  {['Fournisseur', 'N°', 'Émission', 'Échéance', 'Montant TTC', 'Statut', ''].map((c) => (
                    <th key={c} className="px-4 py-3.5 text-left font-hanken text-[11px] font-semibold uppercase tracking-wider text-gray-700">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const rec = f as Rec
                  const id = rec.id as string
                  return (
                    <tr
                      key={id}
                      onClick={() => openDetail(rec, setSelected, refetch)}
                      className="border-b border-[#0f1a3a]/[0.04] last:border-b-0 hover:bg-[#fafbfc] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-hanken text-[14px] font-semibold text-[#0f1a3a]">
                        {String(rec.emetteur_nom ?? 'Fournisseur inconnu')}
                        {rec.type_document === 'avoir' && (
                          <span className="ml-2 font-hanken text-[10px] font-bold text-[#b45309] align-middle">AVOIR</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{String(rec.numero ?? '—')}</td>
                      <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{fmtDate(rec.date_emission)}</td>
                      <td className="px-4 py-3 font-spline-mono text-[12.5px] text-gray-600">{fmtDate(rec.date_echeance)}</td>
                      <td className="px-4 py-3 font-spline-mono font-medium text-[14px] text-[#0f1a3a]">{fmtMoney(rec.montant_ttc)}&nbsp;€</td>
                      <td className="px-4 py-3"><StatutPill statut={String(rec.statut)} /></td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-hanken text-[12px] font-semibold text-[#ff7a1a]">Voir</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Drawer detail */}
      {selected && (
        <FactureDetailDrawer
          facture={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { refetch(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// Ouvre le detail + marque "consultee" si la facture etait "recue".
// NB : le compteur "a traiter" reste base sur recue+consultee tant que la
// facture n'est pas approuvee/refusee/classee (cf. confrontateur F2).
async function openDetail(
  rec: Rec,
  setSelected: (r: Rec) => void,
  refetch: () => void,
) {
  setSelected(rec)
  if (rec.statut === 'recue') {
    try {
      await updateRow('factures_recues', rec.id as string, { statut: 'consultee' })
      refetch()
    } catch { /* non bloquant */ }
  }
}

// ===================================================================
// Drawer de detail
// ===================================================================
function FactureDetailDrawer({
  facture, onClose, onChanged,
}: { facture: Rec; onClose: () => void; onChanged: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [showRefus, setShowRefus] = useState(false)

  const statut = String(facture.statut)
  const hasFile = !!facture.fichier_path
  const isPdf = facture.fichier_format === 'factur-x' || facture.fichier_format === 'pdf'
  const dejaTraitee = ['refusee', 'rejetee', 'irrecevable'].includes(statut)

  // Charge la signed URL courte a l'ouverture.
  useEffect(() => {
    if (!hasFile) return
    let alive = true
    setFileLoading(true)
    fetch(`/api/superpdp/facture-recue-fichier?id=${facture.id}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setFileUrl(d.url) })
      .catch(() => {})
      .finally(() => { if (alive) setFileLoading(false) })
    return () => { alive = false }
  }, [facture.id, hasFile])

  const tvaDetails = Array.isArray(facture.tva_details) ? (facture.tva_details as Rec[]) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#0f1a3a]/[0.06] px-5 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="font-hanken font-extrabold text-lg text-[#0f1a3a] truncate">
              {String(facture.emetteur_nom ?? 'Fournisseur inconnu')}
            </p>
            <p className="font-spline-mono text-[12px] text-gray-500">
              {String(facture.numero ?? '—')} · {fmtDate(facture.date_emission)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#fafbfc] rounded-lg" aria-label="Fermer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Statut + type */}
          <div className="flex items-center gap-2">
            <StatutPill statut={statut} />
            {facture.type_document === 'avoir' && (
              <span className="px-2.5 py-1 rounded-full font-hanken text-[11.5px] font-semibold bg-[#fef3c7] text-[#b45309]">
                Avoir (note de crédit)
              </span>
            )}
          </div>

          {/* Identite emetteur */}
          <section className="rounded-2xl border border-[#0f1a3a]/[0.06] p-4">
            <h3 className="font-hanken font-bold text-[13px] text-[#0f1a3a] mb-2 flex items-center gap-1.5">
              <Building2 size={15} /> Émetteur
            </h3>
            <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 font-hanken text-[13px]">
              <Info label="SIREN" value={facture.emetteur_siren} mono />
              <Info label="SIRET" value={facture.emetteur_siret} mono />
              <Info label="TVA intra." value={facture.emetteur_tva_intra} mono />
              <Info label="Devise" value={facture.devise} />
            </dl>
          </section>

          {/* Montants */}
          <section className="rounded-2xl border border-[#0f1a3a]/[0.06] p-4">
            <h3 className="font-hanken font-bold text-[13px] text-[#0f1a3a] mb-2">Montants</h3>
            <div className="space-y-1.5">
              <Line label="Total HT" value={`${fmtMoney(facture.montant_ht)} €`} />
              <Line label="TVA" value={`${fmtMoney(facture.montant_tva)} €`} />
              <Line label="Total TTC" value={`${fmtMoney(facture.montant_ttc)} €`} strong />
              <Line label="Échéance" value={fmtDate(facture.date_echeance)} />
            </div>
            {tvaDetails && tvaDetails.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#0f1a3a]/[0.06]">
                <p className="font-hanken text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Détail TVA</p>
                {tvaDetails.map((t, i) => (
                  <Line key={i} label={`Taux ${t.taux ?? '?'}%`} value={`base ${fmtMoney(t.base)} € · TVA ${fmtMoney(t.montant)} €`} />
                ))}
              </div>
            )}
          </section>

          {/* Apercu fichier */}
          <section className="rounded-2xl border border-[#0f1a3a]/[0.06] p-4">
            <h3 className="font-hanken font-bold text-[13px] text-[#0f1a3a] mb-2 flex items-center gap-1.5">
              <FileText size={15} /> Document
            </h3>
            {!hasFile ? (
              <p className="font-hanken text-[13px] text-gray-500">
                Données affichées ci-dessus (rendu indicatif). Le fichier d’origine n’a pas encore été récupéré.
              </p>
            ) : fileLoading ? (
              <div className="flex items-center gap-2 text-gray-500 font-hanken text-[13px]">
                <Loader2 size={15} className="animate-spin" /> Chargement du document…
              </div>
            ) : fileUrl ? (
              <div className="space-y-2">
                {isPdf ? (
                  <iframe src={fileUrl} title="Aperçu facture" className="w-full h-[420px] rounded-xl border border-[#0f1a3a]/[0.06]" />
                ) : (
                  <p className="font-hanken text-[12px] text-gray-500">
                    Format XML (UBL/CII) : les données ci-dessus sont un <strong>rendu indicatif</strong>.
                    Téléchargez le document d’origine pour la version officielle.
                  </p>
                )}
                <a
                  href={fileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-hanken text-[13px] font-semibold text-[#ff7a1a] hover:underline"
                >
                  <Download size={14} /> Télécharger l’original
                </a>
              </div>
            ) : (
              <p className="font-hanken text-[13px] text-gray-500">Document momentanément indisponible.</p>
            )}
          </section>

          {/* Statut plateforme (brut) */}
          {!!facture.statut_pdp_text && (
            <p className="font-hanken text-[12px] text-gray-500">
              Statut plateforme : <span className="font-spline-mono">{String(facture.statut_pdp_text)}</span>
            </p>
          )}

          {/* Refus deja motive */}
          {statut === 'refusee' && (
            <div className="rounded-2xl border border-[#b91c1c]/20 bg-[#fee2e2]/40 p-4">
              <p className="font-hanken text-[13px] font-bold text-[#b91c1c]">Facture refusée</p>
              <p className="font-hanken text-[13px] text-gray-700 mt-1">{String(facture.refus_motif_text ?? facture.refus_motif_code ?? '')}</p>
            </div>
          )}

          {/* Actions */}
          {!dejaTraitee && (
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowRefus(true)}
                className="h-10 px-5 rounded-xl border-[1.5px] border-[#b91c1c]/30 bg-white font-hanken text-[13.5px] font-semibold text-[#b91c1c] hover:bg-[#fee2e2]/40 transition-all inline-flex items-center gap-1.5"
              >
                <Ban size={15} /> Refuser la facture
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modale refus */}
      {showRefus && (
        <RefusModal
          factureId={facture.id as string}
          onClose={() => setShowRefus(false)}
          onDone={onChanged}
        />
      )}
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`text-[#0f1a3a] ${mono ? 'font-spline-mono text-[12.5px]' : ''}`}>{value ? String(value) : '—'}</dd>
    </div>
  )
}
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-hanken text-[13px] text-gray-600">{label}</span>
      <span className={`font-spline-mono text-[13px] ${strong ? 'font-bold text-[#0f1a3a]' : 'text-[#0f1a3a]'}`}>{value}</span>
    </div>
  )
}

// ===================================================================
// Modale de refus motive
// ===================================================================
function RefusModal({ factureId, onClose, onDone }: { factureId: string; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!code) { toast.error('Choisissez un motif de refus.'); return }
    if (code === 'OTHER' && text.trim().length < 3) { toast.error('Précisez le motif.'); return }
    setSaving(true)
    try {
      const resp = await fetch('/api/superpdp/facture-recue-refus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: factureId, motifCode: code, motifText: text }),
      })
      const d = await resp.json()
      if (!resp.ok) { toast.error(d.error || 'Refus impossible.'); return }
      toast.success('Facture refusée et motif transmis.')
      onDone()
    } catch {
      toast.error('Erreur réseau. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white rounded-3xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-hanken font-extrabold text-lg text-[#0f1a3a]">Refuser la facture</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#fafbfc] rounded-lg" aria-label="Fermer"><X size={20} className="text-gray-500" /></button>
        </div>
        <p className="font-hanken text-[13px] text-gray-600">
          Le refus est transmis officiellement à votre fournisseur via la plateforme. Un motif est obligatoire.
        </p>
        <PremiumSelect label="Motif" value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Sélectionner un motif…</option>
          {REFUS_MOTIFS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
        </PremiumSelect>
        <div>
          <FieldLabel>Précision {code === 'OTHER' ? '(obligatoire)' : '(facultative)'}</FieldLabel>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Détaillez le motif si nécessaire…"
            className="w-full rounded-xl border-[1.5px] border-gray-200 px-3.5 py-2.5 font-hanken text-[13.5px] text-[#0f1a3a] focus:border-[#ff7a1a] focus:outline-none transition-colors"
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="h-10 px-5 rounded-xl border-[1.5px] border-gray-200 bg-white font-hanken text-[13.5px] font-semibold text-[#0f1a3a] hover:bg-[#fafbfc] transition-all">Annuler</button>
          <button
            onClick={submit} disabled={saving}
            className="h-10 px-5 rounded-xl bg-[#b91c1c] text-white font-hanken text-[13.5px] font-bold hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
          >
            {saving ? 'Envoi…' : 'Confirmer le refus'}
          </button>
        </div>
      </div>
    </div>
  )
}
