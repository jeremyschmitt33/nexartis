'use client'

/**
 * CertificationsSection — Section "Certifications & assurances" des Parametres.
 *
 * Vague 3a. Permet a l'artisan de gerer ses assurances (decennale, RC pro,
 * vigilance URSSAF) et certifications (RGE, Qualibat, Qualifelec, habilitation).
 * Le cron `certifications-rappels` envoie des rappels email J-30 / J-15.
 *
 * Design V4 Light : Hanken Grotesk, navy #0f1a3a / orange #e87a2a / cream.
 * CRUD direct via supabase client (insert / update / soft-delete) + RLS, sur
 * le meme modele que RappelsSection. Refetch apres chaque action.
 *
 * Sur upload d'attestation : flux R2 (sign-upload -> PUT -> confirm) identique
 * au coffre-fort, puis OCR (/api/certifications/ocr) pour pre-remplir le
 * formulaire. La validation humaine est OBLIGATOIRE avant enregistrement.
 */

import { useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/v4/ConfirmDialog'
import { useCertifications, useDocumentsStockes } from '@/lib/hooks'
import {
  CERTIFICATION_PRESETS,
  getPreset,
  addMonths,
  computeUrgence,
  isAssurance,
  type CertificationType,
  type EtatUrgence,
} from '@/lib/certifications/presets'

type Row = Record<string, unknown>
function str(v: unknown): string { return v == null ? '' : String(v) }

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

function fmtDateFr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

const URGENCE_META: Record<EtatUrgence, { card: string; bar: string; badgeBg: string; badgeTx: string }> = {
  valide:  { card: '#7bbf3a', bar: '#7bbf3a', badgeBg: '#e8f3df', badgeTx: '#3b6d11' },
  bientot: { card: '#eaa12b', bar: '#eaa12b', badgeBg: '#fbeed5', badgeTx: '#8a5208' },
  urgent:  { card: '#e0533f', bar: '#e0533f', badgeBg: '#fbe6e3', badgeTx: '#a3281d' },
  expire:  { card: '#e0533f', bar: '#e0533f', badgeBg: '#fbe6e3', badgeTx: '#a3281d' },
}

// Rang de tri : expire (0) < urgent (1) < bientot (2) < valide (3).
const URGENCE_RANK: Record<EtatUrgence, number> = { expire: 0, urgent: 1, bientot: 2, valide: 3 }

function badgeLabel(etat: EtatUrgence, jours: number): string {
  if (etat === 'expire') {
    const n = Math.abs(jours)
    return n === 0 ? "Expiré aujourd'hui" : `Expiré depuis ${n} j`
  }
  if (etat === 'valide') return 'Valide'
  return jours <= 0 ? "Expire aujourd'hui" : `Expire dans ${jours} j`
}

// Pourcentage de duree ecoulee (jauge) entre obtention et expiration.
function gaugePct(obtention: string, expiration: string, etat: EtatUrgence): number {
  if (etat === 'expire') return 100
  const exp = new Date(`${expiration.slice(0, 10)}T00:00:00Z`).getTime()
  const obt = obtention
    ? new Date(`${obtention.slice(0, 10)}T00:00:00Z`).getTime()
    : exp - 365 * 24 * 3600 * 1000
  const now = Date.now()
  if (!isFinite(exp) || !isFinite(obt) || exp <= obt) return 50
  const pct = ((now - obt) / (exp - obt)) * 100
  return Math.max(2, Math.min(100, Math.round(pct)))
}

// ---------------------------------------------------------------------------
// Icones SVG (inline, pas de dependance)
// ---------------------------------------------------------------------------

function IconBouclier() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  )
}
function IconMedaille() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="M8.2 12.5 7 22l5-3 5 3-1.2-9.5" />
    </svg>
  )
}
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  )
}
function IconEclair() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  )
}
function typeIcon(type: string) {
  const ic = getPreset(type).icone
  if (ic === 'bouclier') return <IconBouclier />
  if (ic === 'medaille') return <IconMedaille />
  if (ic === 'eclair') return <IconEclair />
  return <IconDoc />
}

// ---------------------------------------------------------------------------
// Etat du formulaire
// ---------------------------------------------------------------------------

interface FormState {
  id: string | null
  type: CertificationType
  intitule: string
  organisme: string
  numero: string
  dateExpiration: string
  dateObtention: string
  dateAudit: string
  lienDocumentId: string
  dateMode: 'directe' | 'duree'
}

const EMPTY_FORM: FormState = {
  id: null,
  type: 'autre',
  intitule: '',
  organisme: '',
  numero: '',
  dateExpiration: '',
  dateObtention: '',
  dateAudit: '',
  lienDocumentId: '',
  dateMode: 'directe',
}

type FilterKey = 'tout' | 'assurances' | 'certifications'

// ===========================================================================
// COMPOSANT PRINCIPAL
// ===========================================================================

export default function CertificationsSection() {
  const askConfirm = useConfirm()
  const { data: certifs, loading, refetch } = useCertifications()
  const { data: documents, refetch: refetchDocs } = useDocumentsStockes()

  const [filter, setFilter] = useState<FilterKey>('tout')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrBanner, setOcrBanner] = useState(false)
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Memorise la date d'expiration au moment d'ouvrir l'edition.
  // Sert a savoir, au save, si l'artisan a change la date (renouvellement)
  // -> nettoyage immediat des rappels auto sans attendre le cron (24h).
  const editingOriginalExp = useRef<string>('')

  // --- Tri par urgence puis date d'expiration ---
  const sorted = useMemo(() => {
    return [...certifs].sort((a, b) => {
      const ua = computeUrgence(str(a.date_expiration))
      const ub = computeUrgence(str(b.date_expiration))
      const ra = URGENCE_RANK[ua.etat]
      const rb = URGENCE_RANK[ub.etat]
      if (ra !== rb) return ra - rb
      return ua.joursRestants - ub.joursRestants
    })
  }, [certifs])

  const filtered = useMemo(() => {
    if (filter === 'assurances') return sorted.filter((c) => isAssurance(str(c.type)))
    if (filter === 'certifications') return sorted.filter((c) => !isAssurance(str(c.type)))
    return sorted
  }, [sorted, filter])

  const counts = useMemo(() => ({
    tout: certifs.length,
    assurances: certifs.filter((c) => isAssurance(str(c.type))).length,
    certifications: certifs.filter((c) => !isAssurance(str(c.type))).length,
  }), [certifs])

  // --- Ouvrir la modale (ajout / edition) ---
  const openAdd = useCallback((preset?: CertificationType) => {
    if (preset) {
      const p = getPreset(preset)
      setForm({
        ...EMPTY_FORM,
        type: p.type,
        intitule: p.intituleDefaut,
        organisme: '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setOcrBanner(false)
    setUploadedDocId(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((c: Row) => {
    setForm({
      id: str(c.id),
      type: (str(c.type) || 'autre') as CertificationType,
      intitule: str(c.intitule),
      organisme: str(c.organisme),
      numero: str(c.numero),
      dateExpiration: str(c.date_expiration).slice(0, 10),
      dateObtention: str(c.date_obtention).slice(0, 10),
      dateAudit: str(c.date_audit).slice(0, 10),
      lienDocumentId: str(c.lien_document_id),
      dateMode: 'directe',
    })
    editingOriginalExp.current = str(c.date_expiration).slice(0, 10)
    setOcrBanner(false)
    setUploadedDocId(null)
    setModalOpen(true)
  }, [])

  function closeModal() {
    if (saving || ocrLoading) return
    setModalOpen(false)
  }

  // --- Selection d'un preset DANS la modale ---
  function applyPreset(type: CertificationType) {
    const p = getPreset(type)
    setForm((f) => ({
      ...f,
      type: p.type,
      intitule: f.intitule && f.id ? f.intitule : (p.intituleDefaut || f.intitule),
    }))
  }

  // --- Boutons +duree ---
  function applyDuree(mois: number) {
    setForm((f) => {
      const base = f.dateObtention || new Date().toISOString().slice(0, 10)
      return { ...f, dateObtention: base, dateExpiration: addMonths(base, mois) }
    })
  }

  // --- Upload + OCR ---
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (10 Mo maximum).')
      return
    }
    setOcrLoading(true)
    try {
      // 1) URL signee + verif quota/MIME
      const signRes = await fetch('/api/documents/sign-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime_type: file.type, size: file.size }),
      })
      const sign = await signRes.json().catch(() => ({}))
      if (!signRes.ok) throw new Error(sign.message || sign.error || 'Type de fichier non autorise.')

      // 2) PUT direct vers R2
      const putRes = await fetch(sign.putUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Echec du televersement du fichier.')

      // 3) Confirmer l'enregistrement coffre-fort (cree la ligne documents_stockes)
      const confirmRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ r2_key: sign.key, nom: file.name, categorie: 'autre', mime_type: file.type }),
      })
      const confirmJson = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok || !confirmJson.id) throw new Error(confirmJson.message || confirmJson.error || 'Enregistrement du document impossible.')
      setUploadedDocId(confirmJson.id)
      await refetchDocs()

      // 4) OCR : on envoie le meme fichier pour pre-remplir le formulaire
      const fd = new FormData()
      fd.append('file', file)
      const ocrRes = await fetch('/api/certifications/ocr', { method: 'POST', body: fd })
      const ocr = await ocrRes.json().catch(() => ({}))
      if (ocrRes.ok && ocr.ok && ocr.data) {
        const d = ocr.data as Record<string, string | null>
        setForm((f) => ({
          ...f,
          type: (d.type as CertificationType) || f.type,
          intitule: d.intitule || f.intitule || getPreset(d.type || f.type).intituleDefaut,
          organisme: d.organisme || f.organisme,
          numero: d.numero || f.numero,
          dateObtention: (d.date_obtention || f.dateObtention || '').slice(0, 10),
          dateExpiration: (d.date_expiration || f.dateExpiration || '').slice(0, 10),
          dateAudit: (d.date_audit || f.dateAudit || '').slice(0, 10),
          lienDocumentId: confirmJson.id,
          dateMode: 'directe',
        }))
        setOcrBanner(true)
        toast.success('Document lu. Vérifiez les informations avant d’enregistrer.')
      } else {
        // OCR rate : on garde le doc lie mais on laisse l'artisan saisir
        setForm((f) => ({ ...f, lienDocumentId: confirmJson.id }))
        toast.info('Document ajouté. La lecture automatique n’a rien trouvé, complétez à la main.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Echec du téléversement.')
    } finally {
      setOcrLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // --- Enregistrement (insert / update) ---
  async function handleSave() {
    const intitule = form.intitule.trim()
    if (!intitule) { toast.error('Indiquez un intitulé.'); return }
    if (!form.dateExpiration) { toast.error("Indiquez une date d'expiration."); return }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Session expirée, reconnectez-vous.'); setSaving(false); return }

      const payload: Record<string, unknown> = {
        type: form.type,
        intitule,
        organisme: form.organisme.trim() || null,
        numero: form.numero.trim() || null,
        date_expiration: form.dateExpiration,
        date_obtention: form.dateObtention || null,
        date_audit: form.type === 'rge' && form.dateAudit ? form.dateAudit : null,
        lien_document_id: form.lienDocumentId || null,
      }

      if (form.id) {
        // Edition : on remet les tampons de rappels a zero pour reprogrammer.
        const { error } = await supabase
          .from('certifications')
          .update({
            ...payload,
            rappel_envoye_j30: null,
            rappel_envoye_j15: null,
            rappel_audit_envoye: null,
          })
          .eq('id', form.id)
        if (error) throw error

        // Renouvellement : si la date d'expiration a change, on soft-delete
        // immediatement les rappels auto lies a cette certif (sinon l'ancien
        // rappel "expire" resterait affiche jusqu'au prochain cron, ~24h).
        // Le cron recreera proprement le bon palier selon la nouvelle date.
        // On ne nettoie PAS si la date est inchangee (simple edition de note),
        // pour ne pas supprimer a tort un rappel encore pertinent.
        if (form.dateExpiration !== editingOriginalExp.current) {
          const { error: clotErr } = await supabase
            .from('rappels')
            .update({ deleted_at: new Date().toISOString() })
            .eq('lien_certification_id', form.id)
            .in('source', ['auto_certif_30', 'auto_certif_15', 'auto_certif_expire', 'auto_rge_audit'])
            .is('deleted_at', null)
          if (clotErr) console.error('[certifications] cleanup rappels', clotErr.message)
        }

        toast.success('Certification mise à jour, rappel reprogrammé.')
      } else {
        const { error } = await supabase
          .from('certifications')
          .insert({ ...payload, user_id: user.id })
        if (error) throw error
        toast.success('Certification enregistrée, rappel programmé.')
      }
      setModalOpen(false)
      await refetch()
    } catch (e) {
      console.error('[certifications] save', e)
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  // --- Soft delete ---
  async function handleDelete(c: Row) {
    const ok = await askConfirm({
      title: 'Supprimer cette certification ?',
      message: `"${str(c.intitule)}" sera retirée de votre liste. Vous ne recevrez plus de rappel pour ce document.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('certifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', str(c.id))
      if (error) throw error
      toast.success('Certification supprimée.')
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  // --- Telechargement du document lie ---
  async function openDoc(docId: string) {
    try {
      const res = await fetch(`/api/documents/download?id=${encodeURIComponent(docId)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) throw new Error(json.error || 'Téléchargement impossible.')
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Téléchargement impossible.')
    }
  }

  const docName = (docId: string) => {
    const d = documents.find((x) => str(x.id) === docId)
    return d ? str(d.nom) : ''
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <section className="font-hanken">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[19px] font-bold text-[#0f1a3a] tracking-[-0.01em]">Certifications &amp; assurances</h2>
          <p className="text-[13.5px] text-[#6b7385] mt-0.5">
            On vous prévient automatiquement 30 et 15 jours avant chaque expiration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="inline-flex items-center gap-2 bg-[#0f1a3a] hover:bg-[#1a2d5a] text-white font-semibold text-[14px] rounded-xl px-4 transition-colors"
          style={{ minHeight: '44px' }}
        >
          <span className="text-[18px] leading-none" aria-hidden="true">+</span>
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-40 rounded-2xl bg-[#f0ede4] animate-pulse" />)}
        </div>
      ) : certifs.length === 0 ? (
        <EmptyState onPick={openAdd} />
      ) : (
        <>
          {/* Filtres */}
          <div className="flex gap-2 flex-wrap mb-4" role="tablist" aria-label="Filtrer les certifications">
            {([
              { k: 'tout' as FilterKey, label: `Tout (${counts.tout})` },
              { k: 'assurances' as FilterKey, label: `Assurances (${counts.assurances})` },
              { k: 'certifications' as FilterKey, label: `Certifications (${counts.certifications})` },
            ]).map(({ k, label }) => {
              const active = filter === k
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(k)}
                  className={[
                    'text-[13px] font-semibold rounded-full border px-3.5 py-2 transition-colors',
                    active ? 'bg-[#0f1a3a] text-white border-[#0f1a3a]' : 'bg-white text-[#6b7385] border-[#e4e0d6] hover:border-[#0f1a3a]/30',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Grille de cartes */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            {filtered.map((c) => (
              <CertifCard
                key={str(c.id)}
                certif={c}
                docName={str(c.lien_document_id) ? docName(str(c.lien_document_id)) : ''}
                onEdit={() => openEdit(c)}
                onDelete={() => handleDelete(c)}
                onOpenDoc={() => openDoc(str(c.lien_document_id))}
              />
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <CertifModal
          form={form}
          setForm={setForm}
          documents={documents}
          uploadedDocId={uploadedDocId}
          ocrBanner={ocrBanner}
          ocrLoading={ocrLoading}
          saving={saving}
          onClose={closeModal}
          onSave={handleSave}
          onApplyPreset={applyPreset}
          onApplyDuree={applyDuree}
          onPickFile={() => fileInputRef.current?.click()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
    </section>
  )
}

// ===========================================================================
// CARTE
// ===========================================================================

function CertifCard({
  certif, docName, onEdit, onDelete, onOpenDoc,
}: {
  certif: Row
  docName: string
  onEdit: () => void
  onDelete: () => void
  onOpenDoc: () => void
}) {
  const type = str(certif.type) || 'autre'
  const expiration = str(certif.date_expiration)
  const obtention = str(certif.date_obtention)
  const { etat, joursRestants } = computeUrgence(expiration)
  const meta = URGENCE_META[etat]
  const assur = isAssurance(type)
  const pct = gaugePct(obtention, expiration, etat)
  const dateAudit = str(certif.date_audit)
  const hasDoc = !!str(certif.lien_document_id)

  return (
    <div
      className="relative overflow-hidden bg-white border border-[#e4e0d6] rounded-2xl p-4 pl-5 shadow-[0_6px_22px_-18px_rgba(15,26,58,0.4)]"
    >
      <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: meta.bar }} aria-hidden="true" />

      {/* Top : icone + identite + badge */}
      <div className="flex gap-3 items-start">
        <span
          className="flex-none w-10 h-10 rounded-xl grid place-items-center"
          style={{ background: assur ? '#e8eefb' : '#fbf1dc', color: assur ? '#1a2d5a' : '#8a5208' }}
          aria-hidden="true"
        >
          {typeIcon(type)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15.5px] text-[#0f1a3a] tracking-[-0.01em] truncate">{str(certif.intitule) || 'Sans intitulé'}</div>
          {str(certif.organisme) && <div className="text-[13px] text-[#6b7385] mt-0.5 truncate">{str(certif.organisme)}</div>}
          {str(certif.numero) && (
            <div className="text-[12px] text-[#6b7385] mt-1">N° <b className="text-[#0f1a3a] font-medium font-spline-mono">{str(certif.numero)}</b></div>
          )}
        </div>
        <span
          className="flex-none inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-full whitespace-nowrap"
          style={{ background: meta.badgeBg, color: meta.badgeTx }}
        >
          {etat === 'valide' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          ) : etat === 'expire' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          )}
          {badgeLabel(etat, joursRestants)}
        </span>
      </div>

      {/* Dates + jauge */}
      <div className="flex justify-between text-[12px] text-[#6b7385] mt-3.5 mb-1.5">
        <span>Obtenue <b className="text-[#0f1a3a] font-medium">{fmtDateFr(obtention)}</b></span>
        <span>{etat === 'expire' ? 'Expirée' : 'Expire'} <b className="text-[#0f1a3a] font-medium">{fmtDateFr(expiration)}</b></span>
      </div>
      <div className="h-1.5 rounded-full bg-[#eee9dd] overflow-hidden" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: meta.bar }} />
      </div>

      {/* Chip audit RGE */}
      {dateAudit && (
        <div className="inline-flex items-center gap-1.5 mt-3 text-[11.5px] font-semibold bg-[#f1ecfb] text-[#4a3a86] px-2.5 py-1.5 rounded-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="13" height="13" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          Audit intermédiaire à faire avant le {fmtDateFr(dateAudit)}
        </div>
      )}

      {/* Footer : doc + actions */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#e4e0d6] gap-2">
        {hasDoc ? (
          <button
            type="button"
            onClick={onOpenDoc}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1a2d5a] hover:underline min-w-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="flex-none" aria-hidden="true"><path d="m21.4 11.1-9 9a5 5 0 0 1-7-7l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-1.5-1.5l8.5-8.5" /></svg>
            <span className="truncate">{docName || 'Document lié'}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6b7385]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true"><path d="m21.4 11.1-9 9a5 5 0 0 1-7-7l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-1.5-1.5l8.5-8.5" /></svg>
            Aucun document
          </span>
        )}
        <div className="flex gap-2 flex-none">
          {etat === 'expire' && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[12.5px] font-semibold text-[#e87a2a] border border-[#f3d6b8] bg-[#fdf3e8] rounded-lg px-3 hover:bg-[#fbe9d6] transition-colors"
              style={{ minHeight: '40px' }}
            >
              Renouveler
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Modifier ${str(certif.intitule)}`}
            className="text-[12.5px] font-semibold text-[#0f1a3a] bg-[#f0ede4] border border-[#e4e0d6] rounded-lg px-3 hover:bg-[#e8e3d7] transition-colors"
            style={{ minHeight: '40px' }}
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Supprimer ${str(certif.intitule)}`}
            className="grid place-items-center text-[#6b7385] bg-[#f0ede4] border border-[#e4e0d6] rounded-lg hover:bg-[#fbe6e3] hover:text-[#a3281d] transition-colors"
            style={{ minHeight: '40px', minWidth: '40px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// ETAT VIDE
// ===========================================================================

function EmptyState({ onPick }: { onPick: (t: CertificationType) => void }) {
  const quick: CertificationType[] = ['decennale', 'rc_pro', 'vigilance_urssaf', 'rge']
  return (
    <div className="bg-white border border-dashed border-[#e4e0d6] rounded-2xl px-6 py-9 text-center">
      <div className="text-[42px]" aria-hidden="true">🛡️</div>
      <h3 className="text-[18px] font-bold text-[#0f1a3a] mt-2.5">Gardez vos assurances et certifications à jour</h3>
      <p className="text-[14px] text-[#6b7385] mt-1.5 mb-5 max-w-[440px] mx-auto">
        Enregistrez-les une fois. On vous prévient par email 30 et 15 jours avant chaque expiration — vous ne perdrez plus jamais un chantier pour une décennale ou un RGE périmé.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-[520px] mx-auto">
        {quick.map((t) => {
          const p = getPreset(t)
          return <PresetTile key={t} preset={p} selected={false} onClick={() => onPick(t)} />
        })}
      </div>
    </div>
  )
}

// ===========================================================================
// TUILE PRESET
// ===========================================================================

function PresetTile({
  preset, selected, onClick,
}: {
  preset: ReturnType<typeof getPreset>
  selected: boolean
  onClick: () => void
}) {
  const dureeLabel =
    preset.type === 'rge' ? '4 ans + audit'
      : preset.dureeMois === 6 ? 'Validité 6 mois'
        : preset.dureeMois === 12 ? 'Validité 1 an'
          : preset.dureeMois === 36 ? 'Validité 3 ans'
            : preset.dureeMois === 48 ? 'Validité 4 ans'
              : preset.type === 'autre' ? 'Saisie libre'
                : `Validité ${preset.dureeMois} mois`
  const emoji =
    preset.icone === 'bouclier' ? '🛡️'
      : preset.icone === 'medaille' ? '🏅'
        : preset.icone === 'eclair' ? '⚡'
          : preset.type === 'autre' ? '＋' : '📋'
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col items-start gap-1.5 border-[1.5px] rounded-xl p-3 text-left transition-colors',
        selected ? 'border-[#e87a2a] bg-[#fdf3e8] shadow-[0_0_0_3px_rgba(232,122,42,0.13)]' : 'border-[#e4e0d6] bg-white hover:border-[#e87a2a] hover:bg-[#fdf3e8]',
      ].join(' ')}
      style={{ minHeight: '44px' }}
    >
      <span className="text-[18px]" aria-hidden="true">{emoji}</span>
      <span className="text-[13px] font-bold text-[#0f1a3a]">{preset.label}</span>
      <span className="text-[11px] text-[#6b7385]">{dureeLabel}</span>
    </button>
  )
}

// ===========================================================================
// MODALE
// ===========================================================================

function CertifModal({
  form, setForm, documents, uploadedDocId, ocrBanner, ocrLoading, saving,
  onClose, onSave, onApplyPreset, onApplyDuree, onPickFile,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  documents: Row[]
  uploadedDocId: string | null
  ocrBanner: boolean
  ocrLoading: boolean
  saving: boolean
  onClose: () => void
  onSave: () => void
  onApplyPreset: (t: CertificationType) => void
  onApplyDuree: (mois: number) => void
  onPickFile: () => void
}) {
  const isRge = form.type === 'rge'
  const inputCls = 'w-full font-hanken text-[14px] px-3 py-2.5 border border-[#e4e0d6] rounded-xl bg-[#fcfbf8] text-[#0f1a3a] focus:outline-none focus:border-[#e87a2a] focus:shadow-[0_0_0_3px_rgba(232,122,42,0.13)]'

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f1a3a]/40 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={form.id ? 'Modifier une certification' : 'Ajouter une certification'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] bg-white rounded-[20px] shadow-[0_30px_70px_-30px_rgba(15,26,58,0.7)] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e4e0d6] flex justify-between items-center">
          <h3 className="text-[17px] font-bold text-[#0f1a3a]">
            {form.id ? 'Modifier la certification' : 'Ajouter une certification ou assurance'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[#6b7385] text-[22px] leading-none px-2 py-1 rounded-lg hover:bg-[#f0ede4]">&times;</button>
        </div>

        <div className="px-5 py-5 max-h-[68vh] overflow-y-auto">
          {/* Upload / OCR */}
          <button
            type="button"
            onClick={onPickFile}
            disabled={ocrLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#f09050] to-[#e87a2a] text-white font-bold text-[14px] rounded-xl px-4 py-3.5 transition-all hover:brightness-105 disabled:opacity-70 disabled:cursor-wait"
          >
            {ocrLoading ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="18" height="18" className="animate-spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
            )}
            {ocrLoading ? 'Lecture en cours…' : 'Téléverser mon attestation (lecture auto)'}
          </button>
          <p className="text-[11.5px] text-[#6b7385] mt-2 text-center">PDF ou photo — on lit les infos pour vous, vous validez ensuite.</p>

          {ocrBanner && (
            <div className="mt-3 flex items-start gap-2 bg-[#fbeed5] border border-[#eaa12b]/40 rounded-xl px-3.5 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#8a5208" strokeWidth="2" width="16" height="16" className="flex-none mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
              <p className="text-[12.5px] text-[#8a5208] font-semibold">Vérifiez les informations lues avant d’enregistrer.</p>
            </div>
          )}

          {/* Presets */}
          <div className="mt-5">
            <div className="text-[12px] font-semibold text-[#6b7385] uppercase tracking-[0.08em] mb-2.5">Type</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CERTIFICATION_PRESETS.map((p) => (
                <PresetTile key={p.type} preset={p} selected={form.type === p.type} onClick={() => onApplyPreset(p.type)} />
              ))}
            </div>
          </div>

          {/* Intitule */}
          <div className="mt-4">
            <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5" htmlFor="cf-intitule">Intitulé</label>
            <input id="cf-intitule" type="text" value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} className={inputCls} placeholder="Assurance décennale" />
          </div>

          {/* Organisme + numero */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5" htmlFor="cf-org">Organisme</label>
              <input id="cf-org" type="text" value={form.organisme} onChange={(e) => setForm((f) => ({ ...f, organisme: e.target.value }))} className={inputCls} placeholder={getPreset(form.type).organismeSuggere || 'AXA, Allianz…'} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5" htmlFor="cf-num">N° de contrat / police</label>
              <input id="cf-num" type="text" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} className={inputCls} placeholder="DEC-9920341" />
            </div>
          </div>

          {/* Date d'expiration : 2 modes */}
          <div className="mt-4">
            <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5">Date d'expiration</label>
            <div className="flex gap-2 mb-2.5">
              {([['directe', 'Je saisis la date'], ['duree', "Date d'émission + durée"]] as const).map(([mode, label]) => {
                const on = form.dateMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, dateMode: mode }))}
                    className={['flex-1 text-[12.5px] font-semibold rounded-lg border px-2 py-2 transition-colors', on ? 'bg-[#0f1a3a] text-white border-[#0f1a3a]' : 'bg-white text-[#6b7385] border-[#e4e0d6]'].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {form.dateMode === 'directe' ? (
              <input type="date" value={form.dateExpiration} onChange={(e) => setForm((f) => ({ ...f, dateExpiration: e.target.value }))} className={inputCls} aria-label="Date d'expiration" />
            ) : (
              <>
                <input type="date" value={form.dateObtention} onChange={(e) => setForm((f) => ({ ...f, dateObtention: e.target.value }))} className={inputCls} aria-label="Date d'émission" />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {([['+ 6 mois', 6], ['+ 1 an', 12], ['+ 4 ans', 48], ['+ 10 ans', 120]] as const).map(([label, mois]) => (
                    <button key={mois} type="button" onClick={() => onApplyDuree(mois)} className="text-[11.5px] font-semibold text-[#1a2d5a] bg-[#f0ede4] border border-[#e4e0d6] rounded-lg px-2.5 py-1.5 hover:bg-[#e8e3d7]">{label}</button>
                  ))}
                </div>
                {form.dateExpiration && (
                  <p className="text-[12px] text-[#3b6d11] mt-2 font-semibold">Expiration calculée : {fmtDateFr(form.dateExpiration)}</p>
                )}
              </>
            )}
          </div>

          {/* Audit RGE */}
          {isRge && (
            <div className="mt-4">
              <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5" htmlFor="cf-audit">
                Date limite audit intermédiaire <span className="text-[#6b7385] font-normal">(optionnel)</span>
              </label>
              <input id="cf-audit" type="date" value={form.dateAudit} onChange={(e) => setForm((f) => ({ ...f, dateAudit: e.target.value }))} className={inputCls} />
            </div>
          )}

          {/* Document lie */}
          <div className="mt-4">
            <label className="block text-[13px] font-semibold text-[#0f1a3a] mb-1.5" htmlFor="cf-doc">
              Document lié <span className="text-[#6b7385] font-normal">(optionnel)</span>
            </label>
            <select id="cf-doc" value={form.lienDocumentId} onChange={(e) => setForm((f) => ({ ...f, lienDocumentId: e.target.value }))} className={inputCls}>
              <option value="">Aucun — lier plus tard</option>
              {documents.map((d) => (
                <option key={str(d.id)} value={str(d.id)}>
                  {str(d.nom)}{uploadedDocId === str(d.id) ? ' (vient d’être ajouté)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#e4e0d6] bg-[#fcfbf8] flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={saving} className="text-[13.5px] font-semibold text-[#6b7385] border border-[#e4e0d6] rounded-xl px-4 hover:bg-[#f0ede4] disabled:opacity-60" style={{ minHeight: '44px' }}>Annuler</button>
          <button type="button" onClick={onSave} disabled={saving || ocrLoading} className="text-[13.5px] font-semibold text-white bg-[#e87a2a] rounded-xl px-5 hover:bg-[#f09050] disabled:opacity-60" style={{ minHeight: '44px' }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
