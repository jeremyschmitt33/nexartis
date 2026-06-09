'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { useSupabaseRecord, updateRow, LoadingSkeleton } from '@/lib/hooks'

interface ClientRecord {
  id: string
  type?: 'particulier' | 'professionnel' | null
  civilite?: string | null
  prenom?: string | null
  nom: string
  raison_sociale?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  siret?: string | null
  notes_internes?: string | null
}

// Liste des civilités proposées dans le sélecteur (la valeur vide = aucune)
const CIVILITES = ['', 'M.', 'Mme', 'Mlle']

// -------------------------------------------------------------------
// Styles V4 Light Premium centralisés (input, select, textarea, labels)
// On les définit ici en constantes locales pour éviter de toucher aux
// composants legacy partagés (Input/Select/Textarea) — cf. règle d'or n°7
// du DESIGN_SYSTEM_V4.md.
// -------------------------------------------------------------------

// Style commun aux inputs / select V4 : bordure 1.5px, fond gris froid très
// clair, focus halo orange à 4px. Hauteur ajustée via py-2.5.
const inputCls =
  'w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc] ' +
  'font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4] ' +
  'placeholder:text-gray-400 ' +
  'focus:outline-none focus:border-[#ff7a1a] focus:bg-white ' +
  'focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)] ' +
  'transition-all duration-200'

// Variante mono : pour les champs DATA (chiffres : email, téléphone, SIRET,
// code postal). Ajoute Spline Sans Mono + tracking comptable.
const inputMonoCls = inputCls + ' font-spline-mono font-medium tracking-[0.5px]'

// Style label : SMALL CAPS Hanken, gris foncé, espacement lettre élargi.
const labelCls =
  'block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2'

// Style titre de section dans une carte (au-dessus des champs).
const sectionTitleCls =
  'font-hanken font-bold text-base text-[#0f1a3a] tracking-[-0.01em] mb-5'

// -------------------------------------------------------------------
// Page Modifier client — V4 Light Premium
// Refonte visuelle uniquement. AUCUNE modification de la logique métier
// (useSupabaseRecord, updateRow, handleSave, validation, gestion erreur).
// -------------------------------------------------------------------

export default function ModifierClientPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: client, loading } = useSupabaseRecord<ClientRecord>('clients', id)

  const [type, setType] = useState<'particulier' | 'professionnel'>('particulier')
  const [civilite, setCivilite] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [raisonSociale, setRaisonSociale] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [siret, setSiret] = useState('')
  const [notesInternes, setNotesInternes] = useState('')

  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!client || loaded) return
    setType((client.type as 'particulier' | 'professionnel') || 'particulier')
    setCivilite(client.civilite || '')
    setPrenom(client.prenom || '')
    setNom(client.nom || '')
    setRaisonSociale(client.raison_sociale || '')
    setEmail(client.email || '')
    setTelephone(client.telephone || '')
    setAdresse(client.adresse || '')
    setCodePostal(client.code_postal || '')
    setVille(client.ville || '')
    setSiret(client.siret || '')
    setNotesInternes(client.notes_internes || '')
    setLoaded(true)
  }, [client, loaded])

  const handleSave = async () => {
    if (!client) return
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const values: Record<string, unknown> = {
        type,
        prenom: prenom.trim() || null,
        nom: nom.trim(),
        email: email.trim() || null,
        telephone: telephone.trim() || null,
        adresse: adresse.trim() || null,
        code_postal: codePostal.trim() || null,
        ville: ville.trim() || null,
        siret: siret.trim() || null,
        notes_internes: notesInternes.trim() || null,
      }
      if (civilite) values.civilite = civilite
      if (type === 'professionnel') values.raison_sociale = raisonSociale.trim() || null
      else values.raison_sociale = null

      await updateRow('clients', client.id, values)
      router.push(`/dashboard/clients/${client.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>
  if (!client) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-sm font-hanken font-semibold text-gray-500 hover:text-[#0f1a3a] transition-colors"
        >
          <ArrowLeft size={16} /> Retour aux clients
        </Link>
        <p className="text-sm font-hanken text-gray-500">Client introuvable.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* ============ Top bar sticky V4 ============ */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#0f1a3a]/[0.06] py-3 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dashboard/clients/${id}`}
            className="p-1.5 rounded-lg hover:bg-[#fafbfc] flex-shrink-0 transition-colors"
            aria-label="Retour à la fiche client"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </Link>
          <h2 className="font-hanken font-extrabold text-base sm:text-lg text-[#0f1a3a] tracking-tight truncate">
            Modifier {`${client.prenom ?? ''} ${client.nom}`.trim() || 'le client'}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Bouton Annuler — secondaire V4 */}
          <Link
            href={`/dashboard/clients/${id}`}
            className="inline-flex items-center h-9 px-4 rounded-xl bg-white border-[1.5px] border-gray-200
                       text-sm font-hanken font-semibold text-[#0f1a3a]
                       shadow-[0_2px_6px_rgba(15,26,58,0.04)]
                       hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                       active:translate-y-0 transition-all duration-200"
          >
            Annuler
          </Link>
          {/* Bouton Enregistrer — gradient orange V4 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl
                       bg-gradient-to-br from-[#ff9d4d] to-[#ff7a1a] text-white
                       font-hanken font-bold text-sm
                       shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]
                       hover:-translate-y-0.5 hover:brightness-105
                       active:translate-y-0 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100"
          >
            <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ============ Bandeau erreur de validation ============ */}
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50/80 border border-red-200/70 px-4 py-3 text-sm font-hanken text-red-800"
          >
            {error}
          </div>
        )}

        {/* ============ Type de client — PremiumCard V4 ============ */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          {/* Accent line orange — signature V4 */}
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

          <h3 className={sectionTitleCls}>Type de client</h3>
          <div className="flex gap-2">
            {(['particulier', 'professionnel'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`h-10 px-5 rounded-xl border-[1.5px] text-sm font-hanken font-semibold capitalize transition-all duration-200 ${
                  type === t
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/10 text-[#0f1a3a]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#ff7a1a] hover:bg-[#fafbfc]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ============ Identité — PremiumCard V4 ============ */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

          <h3 className={sectionTitleCls}>Identité</h3>

          <div className="space-y-5">
            {type === 'professionnel' && (
              <div>
                <label className={labelCls}>Raison sociale</label>
                <input
                  type="text"
                  value={raisonSociale}
                  onChange={(e) => setRaisonSociale(e.target.value)}
                  className={inputCls}
                  placeholder="Nom de la société"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-5">
              <div>
                <label className={labelCls}>Civilité</label>
                <select
                  value={civilite}
                  onChange={(e) => setCivilite(e.target.value)}
                  className={inputCls + ' cursor-pointer'}
                >
                  {CIVILITES.map((c) => (
                    <option key={c} value={c}>{c || '—'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className={inputCls}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Nom <span className="text-[#ff7a1a]">*</span>
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className={inputCls}
                  placeholder="Nom"
                  required
                />
              </div>
            </div>

            {type === 'professionnel' && (
              <div>
                <label className={labelCls}>SIRET</label>
                <input
                  type="text"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                  className={inputMonoCls}
                  placeholder="123 456 789 00012"
                  maxLength={17}
                />
              </div>
            )}
          </div>
        </div>

        {/* ============ Contact — PremiumCard V4 ============ */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

          <h3 className={sectionTitleCls}>Contact</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputMonoCls}
                placeholder="exemple@mail.com"
              />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className={inputMonoCls}
                placeholder="06 00 00 00 00"
              />
            </div>
          </div>
        </div>

        {/* ============ Adresse — PremiumCard V4 ============ */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

          <h3 className={sectionTitleCls}>Adresse</h3>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>Adresse</label>
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className={inputCls}
                placeholder="N° et rue"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-5">
              <div>
                <label className={labelCls}>Code postal</label>
                <input
                  type="text"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  className={inputMonoCls}
                  placeholder="33000"
                  maxLength={10}
                />
              </div>
              <div>
                <label className={labelCls}>Ville</label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  className={inputCls}
                  placeholder="Bordeaux"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============ Notes internes — PremiumCard V4 ============ */}
        <div className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                        shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]">
          <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />

          <h3 className={sectionTitleCls}>Notes internes</h3>

          <textarea
            value={notesInternes}
            onChange={(e) => setNotesInternes(e.target.value)}
            rows={4}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]
                       placeholder:text-gray-400 resize-y
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
            placeholder="Visible uniquement par vous"
          />
        </div>

        {/* ============ Boutons d'action mobile (sticky bottom dupliqué) ============ */}
        <div className="sm:hidden flex flex-col gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl
                       bg-gradient-to-br from-[#ff9d4d] to-[#ff7a1a] text-white
                       font-hanken font-bold text-sm
                       shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]
                       hover:-translate-y-0.5 hover:brightness-105
                       active:translate-y-0 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100"
          >
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link
            href={`/dashboard/clients/${id}`}
            className="inline-flex items-center justify-center h-11 rounded-xl
                       bg-white border-[1.5px] border-gray-200
                       text-sm font-hanken font-semibold text-[#0f1a3a]
                       shadow-[0_2px_6px_rgba(15,26,58,0.04)]
                       hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                       active:translate-y-0 transition-all duration-200"
          >
            Annuler
          </Link>
        </div>
      </div>
    </div>
  )
}
