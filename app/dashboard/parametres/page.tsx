'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  FileText,
  Receipt,
  Bell,
  User,
  Camera,
  PenTool,
  Palette,
  PlayCircle,
  Smartphone,
} from 'lucide-react'
import {
  useEntreprise,
  useUser,
  useOnboarding,
  LoadingSkeleton,
} from '@/lib/hooks'
import ThemeSelector from '@/components/ThemeSelector'
import DocumentThemePicker from '@/components/parametres/DocumentThemePicker'
import LogoThemeProposals from '@/components/parametres/LogoThemeProposals'
import LogoCustomization from '@/components/parametres/LogoCustomization'
import InstallPrompt from '@/components/InstallPrompt'
import { QRCodeSVG } from 'qrcode.react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'

// -------------------------------------------------------------------
// Types & constants
// -------------------------------------------------------------------

type Section =
  | 'entreprise'
  | 'documents'
  | 'facturation'
  | 'notifications'
  | 'compte'
  | 'signature'
  | 'apparence'
  | 'application'

interface NavItem {
  id: Section
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'entreprise', label: 'Entreprise', icon: Building2 },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'facturation', label: 'Facturation', icon: Receipt },
  { id: 'signature', label: 'Ma signature', icon: PenTool },
  { id: 'apparence', label: 'Apparence', icon: Palette },
  { id: 'application', label: 'Application', icon: Smartphone },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'compte', label: 'Compte', icon: User },
]
// Note : la section "Abonnement" a sa propre page dédiée /dashboard/abonnement

// -------------------------------------------------------------------
// Shared components
// -------------------------------------------------------------------

/**
 * InputField — wrapper "métier" autour du composant <Input> partagé.
 *
 * Garde la même signature qu'avant (label/value/onChange/type/readOnly/placeholder/error/hint)
 * pour que toutes les sections existantes (EntrepriseSection, FacturationSection, etc.)
 * continuent de fonctionner sans modif.
 *
 * Particularité conservée : l'erreur ne s'affiche qu'APRÈS le 1er blur
 * (touched = true), pour ne pas être anxiogène pendant la saisie.
 */
function InputField({
  label,
  value = '',
  onChange,
  type = 'text',
  readOnly = false,
  placeholder = '',
  error = null,
  hint = null,
}: {
  label: string
  value?: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  placeholder?: string
  error?: string | null
  hint?: string | null
}) {
  const [touched, setTouched] = useState(false)
  const displayedError = touched ? error : null
  return (
    <Input
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={() => setTouched(true)}
      readOnly={readOnly}
      placeholder={placeholder}
      error={displayedError}
      hint={hint ?? undefined}
    />
  )
}

// -------------------------------------------------------------------
// Validators (formats légaux français)
// -------------------------------------------------------------------

/** Normalise une chaîne en supprimant tous les espaces */
function clean(s: string): string {
  return (s || '').replace(/\s+/g, '')
}

/** SIRET = 14 chiffres exactement */
function validateSiret(s: string): string | null {
  if (!s) return null
  const c = clean(s)
  if (!/^\d+$/.test(c)) return 'Le SIRET ne doit contenir que des chiffres'
  if (c.length !== 14) return `Le SIRET doit faire 14 chiffres (actuellement ${c.length})`
  return null
}

/** TVA intracommunautaire FR : "FR" + 2 chiffres clé + 9 chiffres SIREN = 13 caractères */
function validateTva(s: string): string | null {
  if (!s) return null
  const c = clean(s).toUpperCase()
  if (!c.startsWith('FR')) return 'Le numéro de TVA français doit commencer par "FR"'
  const rest = c.substring(2)
  if (!/^\d+$/.test(rest)) return 'Après "FR", il ne doit y avoir que des chiffres'
  if (rest.length !== 11) return `Le N° TVA doit faire FR + 11 chiffres (actuellement FR + ${rest.length})`
  return null
}

/** Code NAF/APE = 4 chiffres + 1 lettre majuscule (ex: 4322A) */
function validateNaf(s: string): string | null {
  if (!s) return null
  const c = clean(s).toUpperCase()
  if (!/^\d{4}[A-Z]$/.test(c)) return 'Format attendu : 4 chiffres + 1 lettre (ex : 4322A)'
  return null
}

/** RCS / RM = format libre commençant par "RCS Ville" ou "RM Ville" + numéro à 9 chiffres */
function validateRcsRm(s: string): string | null {
  if (!s) return null
  const c = (s || '').trim()
  if (!/^(RCS|RM)\s+/i.test(c)) return 'Doit commencer par "RCS" ou "RM" suivi de la ville'
  const digits = c.replace(/\D/g, '')
  if (digits.length < 9) return 'Doit contenir au minimum 9 chiffres après "RCS" ou "RM"'
  return null
}

/** Code postal français = 5 chiffres */
function validateCodePostal(s: string): string | null {
  if (!s) return null
  const c = clean(s)
  if (!/^\d{5}$/.test(c)) return 'Le code postal français fait 5 chiffres'
  return null
}

/** Email standard */
function validateEmail(s: string): string | null {
  if (!s) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())) return 'Adresse email invalide'
  return null
}

/** Téléphone français : 10 chiffres OU format international +33 */
function validateTelephone(s: string): string | null {
  if (!s) return null
  const c = clean(s).replace(/[.\-()]/g, '')
  if (/^\+33\d{9}$/.test(c)) return null
  if (/^0\d{9}$/.test(c)) return null
  return 'Format attendu : 06 12 34 56 78 ou +33 6 12 34 56 78'
}

function ToggleSwitch({
  label,
  checked = false,
  onChange,
}: {
  label: string
  checked?: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="font-manrope text-sm text-[#1a1a2e]">{label}</span>
      <button
        type="button"
        onClick={() => onChange?.(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#5ab4e0]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

/**
 * TextAreaField — wrapper "métier" autour du composant <Textarea> partagé.
 * Garde la même signature qu'avant pour ne pas casser les sections existantes.
 */
function TextAreaField({
  label,
  value = '',
  onChange,
  rows = 3,
}: {
  label: string
  value?: string
  onChange?: (v: string) => void
  rows?: number
}) {
  return (
    <Textarea
      label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={rows}
    />
  )
}

function SaveButton({ onClick, saving, disabled = false }: { onClick: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="mt-8 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving || disabled}
        title={disabled ? 'Corrigez les erreurs avant d\'enregistrer' : ''}
        className="h-12 px-8 rounded-lg font-syne font-bold text-white bg-[#e87a2a] hover:bg-[#f09050] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </div>
  )
}

function SuccessMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mt-4 rounded-xl bg-emerald-50/80 border border-emerald-200/70 px-4 py-3">
      <p className="font-hanken text-sm text-emerald-800">{message}</p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="mt-4 rounded-xl bg-red-50/80 border border-red-200/70 px-4 py-3">
      <p className="font-hanken text-sm text-red-700">{message}</p>
    </div>
  )
}

// -------------------------------------------------------------------
// Sections
// -------------------------------------------------------------------

// ====================================================================
// Sous-composants V4 LIGHT PREMIUM — utilisés UNIQUEMENT par EntrepriseSection.
// Déclarés au niveau module (et non DANS le composant) pour éviter la perte
// de focus à chaque keystroke (React remount sinon).
// ====================================================================

/** Label premium : SMALL CAPS, gras, espacé */
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
      {children}
    </label>
  )
}

/** Hint discret sous l'input */
function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 font-hanken text-xs text-gray-500">{children}</p>
}

/** Message d'erreur sous l'input */
function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 font-hanken text-xs font-semibold text-red-600">{children}</p>
}

/** Input V4 Light Premium — local à la section Entreprise uniquement */
function PremiumInput({
  label, value, onChange, type = 'text', placeholder, hint, error, mono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string | null
  error?: string | null
  mono?: boolean
}) {
  const [touched, setTouched] = useState(false)
  const displayedError = touched ? error : null
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className={`
          w-full py-2.5 px-4 rounded-xl
          border-[1.5px] ${displayedError ? 'border-red-300' : 'border-gray-200'}
          bg-[#fafbfc]
          font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
          placeholder:text-gray-400
          focus:outline-none focus:border-[#ff7a1a] focus:bg-white
          focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
          transition-all duration-200
          ${mono ? 'font-spline-mono font-medium tracking-[0.5px]' : ''}
        `}
      />
      {displayedError ? <FieldError>{displayedError}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  )
}

/** Toggle V4 Light Premium — local à la section Entreprise */
function PremiumToggle({
  label, checked, onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#fafbfc] border-[1.5px] border-gray-200">
      <span className="font-hanken font-medium text-[14.5px] text-[#0f1a3a]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked
            ? 'bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] shadow-[0_2px_8px_rgba(255,122,26,0.35)]'
            : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

/** Sous-titre de groupe (Identité / Coordonnées / etc.) avec ligne dégradée */
function GroupTitle({ children, mt = 'mt-10' }: { children: ReactNode; mt?: string }) {
  return (
    <div className={`${mt} mb-4 flex items-center gap-3`}>
      <span className="font-hanken font-bold text-[11.5px] uppercase tracking-[0.12em] text-[#ff7a1a]">
        {children}
      </span>
      <span className="flex-1 h-px bg-gradient-to-r from-[#ff7a1a]/20 to-transparent" />
    </div>
  )
}

/** Bandeau d'info (bleu = info, ambre = obligation légale) */
function InfoBanner({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 border ${
        tone === 'warn'
          ? 'bg-amber-50/80 border-amber-200/70 text-amber-800'
          : 'bg-blue-50/80 border-blue-200/70 text-blue-800'
      }`}
    >
      <p className="font-hanken text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function EntrepriseSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [nom, setNom] = useState('')
  const [siret, setSiret] = useState('')
  const [tva, setTva] = useState('')
  const [naf, setNaf] = useState('')
  const [formeJuridique, setFormeJuridique] = useState('')
  const [capitalSocial, setCapitalSocial] = useState('')
  const [rcsRm, setRcsRm] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [assuranceNom, setAssuranceNom] = useState('')
  const [decennale, setDecennale] = useState('')
  // 2026-06-10 : date de fin de garantie décennale (utilisée par le cron rappels J-60)
  const [decennaleDateFin, setDecennaleDateFin] = useState('')
  const [assuranceZone, setAssuranceZone] = useState('')
  // Médiateur — 4 champs séparés depuis le 28/05/2026 (avant : 1 seul textarea libre).
  // Fallback automatique : si les 4 champs sont vides mais que l'ancien champ "mediateur"
  // existe en BDD, on remet sa valeur dans "mediateur_nom" pour rétrocompatibilité.
  const [mediateurNom, setMediateurNom] = useState('')
  const [mediateurAdresse, setMediateurAdresse] = useState('')
  const [mediateurCodePostal, setMediateurCodePostal] = useState('')
  const [mediateurVille, setMediateurVille] = useState('')
  const [rge, setRge] = useState(false)
  const [metier, setMetier] = useState('')
  const [franchiseTva, setFranchiseTva] = useState(false)
  const [qualificationPro, setQualificationPro] = useState('')
  // Horaires de travail par défaut (28/05/2026) — propagés au planning
  // pour les créneaux Matin / Après-midi / Journée entière.
  const [heureDebutMatin, setHeureDebutMatin] = useState('08:00')
  const [heureFinMatin, setHeureFinMatin] = useState('12:00')
  const [heureDebutAm, setHeureDebutAm] = useState('13:00')
  const [heureFinAm, setHeureFinAm] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (entreprise) {
      setNom((entreprise.nom as string) ?? '')
      setSiret((entreprise.siret as string) ?? '')
      setTva((entreprise.tva_intracommunautaire as string) ?? '')
      setNaf((entreprise.code_naf as string) ?? '')
      setFormeJuridique((entreprise.forme_juridique as string) ?? '')
      setCapitalSocial((entreprise.capital_social as string) ?? '')
      setRcsRm((entreprise.rcs_rm as string) ?? '')
      setAdresse((entreprise.adresse as string) ?? '')
      setCodePostal((entreprise.code_postal as string) ?? '')
      setVille((entreprise.ville as string) ?? '')
      setTelephone((entreprise.telephone as string) ?? '')
      setEmail((entreprise.email as string) ?? '')
      setIban((entreprise.iban as string) ?? '')
      setBic((entreprise.bic as string) ?? '')
      setAssuranceNom((entreprise.assurance_nom as string) ?? '')
      setDecennale((entreprise.decennale_numero as string) ?? '')
      setDecennaleDateFin((entreprise.decennale_date_fin as string) ?? '')
      setAssuranceZone((entreprise.assurance_zone as string) ?? '')
      // Médiateur : on hydrate les 4 nouveaux champs en priorité.
      // Si les 4 sont vides mais que l'ancien "mediateur" existe, on copie dans le nom.
      const nouveauNom = (entreprise.mediateur_nom as string) ?? ''
      const nouvelleAdresse = (entreprise.mediateur_adresse as string) ?? ''
      const nouveauCP = (entreprise.mediateur_code_postal as string) ?? ''
      const nouvelleVille = (entreprise.mediateur_ville as string) ?? ''
      const ancien = (entreprise.mediateur as string) ?? ''
      if (!nouveauNom && !nouvelleAdresse && !nouveauCP && !nouvelleVille && ancien) {
        setMediateurNom(ancien)
      } else {
        setMediateurNom(nouveauNom)
        setMediateurAdresse(nouvelleAdresse)
        setMediateurCodePostal(nouveauCP)
        setMediateurVille(nouvelleVille)
      }
      setRge(!!entreprise.rge)
      setMetier((entreprise.metier as string) ?? '')
      setFranchiseTva(!!entreprise.franchise_tva)
      setQualificationPro((entreprise.qualification_pro as string) ?? '')
      // Horaires de travail — fallback aux valeurs par défaut si non renseigné
      setHeureDebutMatin((entreprise.heure_debut_matin as string) || '08:00')
      setHeureFinMatin((entreprise.heure_fin_matin as string) || '12:00')
      setHeureDebutAm((entreprise.heure_debut_apres_midi as string) || '13:00')
      setHeureFinAm((entreprise.heure_fin_apres_midi as string) || '17:00')
    }
  }, [entreprise])

  // Liste des erreurs de validation actives sur la page (vide = tout est OK)
  const validationErrors = [
    validateSiret(siret),
    validateTva(tva),
    validateNaf(naf),
    validateRcsRm(rcsRm),
    validateCodePostal(codePostal),
    validateTelephone(telephone),
    validateEmail(email),
  ].filter((e): e is string => Boolean(e))
  const hasValidationErrors = validationErrors.length > 0

  const handleSave = async () => {
    if (hasValidationErrors) {
      setErrorMsg('Veuillez corriger les erreurs avant d\'enregistrer.')
      return
    }
    setSaving(true)
    setSuccess(null)
    setErrorMsg(null)
    try {
      const updates: Record<string, unknown> = {
        nom, siret, tva_intracommunautaire: tva, code_naf: naf,
        forme_juridique: formeJuridique || null, capital_social: capitalSocial || null, rcs_rm: rcsRm || null,
        adresse, code_postal: codePostal, ville, telephone, email,
        iban, bic,
        assurance_nom: assuranceNom || null, decennale_numero: decennale, decennale_date_fin: decennaleDateFin || null, assurance_zone: assuranceZone || null,
        mediateur_nom: mediateurNom || null,
        mediateur_adresse: mediateurAdresse || null,
        mediateur_code_postal: mediateurCodePostal || null,
        mediateur_ville: mediateurVille || null,
        rge, metier,
        franchise_tva: franchiseTva,
        qualification_pro: qualificationPro || null,
        heure_debut_matin: heureDebutMatin || '08:00',
        heure_fin_matin: heureFinMatin || '12:00',
        heure_debut_apres_midi: heureDebutAm || '13:00',
        heure_fin_apres_midi: heureFinAm || '17:00',
      }
      // Sync TVA : si franchise activée, on force le taux par défaut à 0 %
      // pour éviter qu'un taux 20 % stocké en facturation reste désynchronisé.
      if (franchiseTva) {
        updates.tva_defaut = 0
      }
      await update(updates)
      setSuccess('Informations de l\'entreprise enregistrées avec succès.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------------
  // Détection : l'entreprise a-t-elle déjà été configurée ? (pour badge)
  // On considère qu'elle l'est si au moins le SIRET est rempli.
  // ------------------------------------------------------------------
  const isConfigured = !!(entreprise?.siret && (entreprise.siret as string).trim() !== '')

  return (
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange en haut de la card */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* ============ HEADER : icône + titre + sous-titre + badge ============ */}
      <div className="flex items-start gap-4 mb-8">
        {/* Icône Building (40px, gradient orange, ombre douce) */}
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
          </svg>
        </div>

        {/* Titre + sous-titre + badge éventuel */}
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Profil entreprise
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <p className="font-hanken font-medium text-sm text-gray-500">
              Vos informations légales et coordonnées professionnelles
            </p>
            {isConfigured && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                           bg-gradient-to-br from-emerald-100/80 to-emerald-50
                           text-emerald-700 border border-emerald-200/60
                           text-[11.5px] font-hanken font-bold tracking-wider uppercase"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Configuré
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============ LOGO UPLOAD (composant existant, non touché) ============ */}
      <LogoUploadSection entreprise={entreprise} update={update} />

      {/* ============ IDENTITÉ ============ */}
      <GroupTitle mt="mt-8">Identité</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput label="Nom de l'entreprise" value={nom} onChange={setNom} />

        {/* Forme juridique : Select natif stylé V4 (on garde le <Select> partagé serait visuel non cohérent, on inline ici) */}
        <div>
          <FieldLabel>Forme juridique</FieldLabel>
          <select
            value={formeJuridique}
            onChange={(e) => {
              const newForme = e.target.value
              setFormeJuridique(newForme)
              // Auto : micro-entrepreneurs / EI sont quasi toujours en franchise de TVA
              if (newForme === 'Micro-entreprise' || newForme === 'EI') {
                setFranchiseTva(true)
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200 cursor-pointer"
          >
            <option value="">-- Choisir --</option>
            <option value="EI">EI (Entreprise Individuelle)</option>
            <option value="Micro-entreprise">Micro-entreprise (Auto-entrepreneur)</option>
            <option value="EURL">EURL</option>
            <option value="SARL">SARL</option>
            <option value="SAS">SAS</option>
            <option value="SASU">SASU</option>
          </select>
        </div>

        {/* SIRET — police mono "chiffres comptables" */}
        <PremiumInput
          label="SIRET"
          value={siret}
          onChange={setSiret}
          placeholder="123 456 789 00012"
          error={validateSiret(siret)}
          hint="14 chiffres (espaces tolérés)"
          mono
        />

        <PremiumInput
          label="N° TVA intracommunautaire"
          value={tva}
          onChange={(v) => setTva(v.toUpperCase().replace(/\s+/g, ''))}
          placeholder="FR 12 345678901"
          error={validateTva(tva)}
          hint="FR + 11 chiffres"
          mono
        />

        {/* Code NAF/APE — police mono également */}
        <PremiumInput
          label="Code NAF"
          value={naf}
          onChange={(v) => setNaf(v.toUpperCase())}
          placeholder="4322A"
          error={validateNaf(naf)}
          hint="4 chiffres + 1 lettre (ex : 4322A)"
          mono
        />

        <PremiumInput
          label="RCS / RM (n° + ville)"
          value={rcsRm}
          onChange={(v) => setRcsRm(v.toUpperCase())}
          placeholder="RM Bordeaux 123456789"
          error={validateRcsRm(rcsRm)}
          hint='"RCS" ou "RM" + ville + SIREN (9 chiffres)'
        />

        <PremiumInput
          label="Capital social"
          value={capitalSocial}
          onChange={setCapitalSocial}
          placeholder="10 000 € (laisser vide si EI)"
        />

        <PremiumInput
          label="Métier / activité"
          value={metier}
          onChange={setMetier}
        />
        {/* qualificationPro conservé en state (rétro-compat handleSave) mais UI retirée */}
      </div>

      {/* ============ RÉGIME TVA ============ */}
      <GroupTitle>Régime TVA</GroupTitle>
      <InfoBanner tone="info">
        Si vous êtes en franchise de TVA (micro-entreprise sous les seuils, ou EI non assujettie),
        activez cette option. La mention légale «&nbsp;TVA non applicable — art. 293 B du CGI&nbsp;»
        sera ajoutée automatiquement sur tous vos devis et factures.
      </InfoBanner>
      <PremiumToggle
        label="Franchise en base de TVA (non assujetti)"
        checked={franchiseTva}
        onChange={setFranchiseTva}
      />

      {/* ============ COORDONNÉES ============ */}
      <GroupTitle>Coordonnées</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput label="Adresse" value={adresse} onChange={setAdresse} />
        <PremiumInput
          label="Code postal"
          value={codePostal}
          onChange={setCodePostal}
          error={validateCodePostal(codePostal)}
          hint="5 chiffres"
          mono
        />
        <PremiumInput label="Ville" value={ville} onChange={setVille} />
        <PremiumInput
          label="Téléphone"
          value={telephone}
          onChange={setTelephone}
          error={validateTelephone(telephone)}
          hint="06 12 34 56 78 ou +33..."
        />
        <PremiumInput
          label="Email"
          value={email}
          onChange={setEmail}
          error={validateEmail(email)}
        />
      </div>

      {/* ============ ASSURANCE DÉCENNALE ============ */}
      <GroupTitle>Assurance décennale</GroupTitle>
      <InfoBanner tone="warn">
        Obligatoire sur tous vos devis et factures (amende jusqu&apos;à 75&nbsp;000&nbsp;€).
        Ces informations apparaîtront automatiquement sur vos documents.
      </InfoBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput
          label="Nom de l'assureur"
          value={assuranceNom}
          onChange={setAssuranceNom}
          placeholder="AXA, MAAF, SMABTP..."
        />
        <PremiumInput
          label="N° de police"
          value={decennale}
          onChange={(v) => setDecennale(v.toUpperCase())}
          placeholder="POL-2024-XXXXX"
        />
        <PremiumInput
          label="Zone géographique couverte"
          value={assuranceZone}
          onChange={setAssuranceZone}
          placeholder="France entière"
        />
        <div>
          <PremiumInput
            label="Date de fin de validité"
            type="date"
            value={decennaleDateFin}
            onChange={setDecennaleDateFin}
            hint="Cascade de rappels automatiques : J-60 (info) → J-30 (rappel) → J-7 (urgent)."
          />
          {/* V2.1 10/06/2026 : badge d'etat colore (vert/orange/rouge) selon la date renseignee. */}
          {decennaleDateFin && (() => {
            const target = new Date(`${decennaleDateFin}T00:00:00`)
            if (Number.isNaN(target.getTime())) return null
            const today = new Date()
            const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
            const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
            const diffDays = Math.floor((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))
            let bg = 'bg-emerald-50'
            let bd = 'border-emerald-200'
            let tx = 'text-emerald-800'
            let label = `Valide encore ${diffDays} jours`
            if (diffDays < 0) {
              bg = 'bg-red-50'; bd = 'border-red-300'; tx = 'text-red-800'
              label = `EXPIRÉE depuis ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? 's' : ''} — couverture rompue`
            } else if (diffDays <= 7) {
              bg = 'bg-red-50'; bd = 'border-red-300'; tx = 'text-red-800'
              label = `URGENT — expire dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`
            } else if (diffDays <= 30) {
              bg = 'bg-amber-50'; bd = 'border-amber-300'; tx = 'text-amber-800'
              label = `Expire dans ${diffDays} jours — renouvelez bientôt`
            } else if (diffDays <= 60) {
              bg = 'bg-amber-50'; bd = 'border-amber-200'; tx = 'text-amber-800'
              label = `Expire dans ${diffDays} jours — anticipez le renouvellement`
            }
            return (
              <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg} ${bd} ${tx} font-hanken font-semibold text-[12.5px]`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${diffDays < 0 || diffDays <= 7 ? 'bg-red-500' : diffDays <= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
                {label}
              </div>
            )
          })()}
        </div>
        <div className="flex items-end">
          <div className="w-full">
            <PremiumToggle label="Certification RGE" checked={rge} onChange={setRge} />
          </div>
        </div>
      </div>

      {/* ============ HORAIRES DE TRAVAIL ============ */}
      <GroupTitle>Horaires de travail par défaut</GroupTitle>
      <InfoBanner tone="info">
        Ces horaires sont utilisés par défaut pour les créneaux Matin / Après-midi / Journée entière
        du planning. Vous pouvez les modifier ici.
      </InfoBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput label="Début matin" type="time" value={heureDebutMatin} onChange={setHeureDebutMatin} mono />
        <PremiumInput label="Fin matin" type="time" value={heureFinMatin} onChange={setHeureFinMatin} mono />
        <PremiumInput label="Début après-midi" type="time" value={heureDebutAm} onChange={setHeureDebutAm} mono />
        <PremiumInput label="Fin après-midi" type="time" value={heureFinAm} onChange={setHeureFinAm} mono />
      </div>

      {/* ============ MÉDIATEUR DE LA CONSOMMATION ============ */}
      <GroupTitle>Médiateur de la consommation</GroupTitle>
      <InfoBanner tone="warn">
        Obligatoire depuis 2016 sur tous vos documents commerciaux
        (art. L612-1 du Code de la consommation).
      </InfoBanner>
      <div className="grid grid-cols-1 gap-5">
        <PremiumInput
          label="Nom du médiateur"
          value={mediateurNom}
          onChange={setMediateurNom}
          placeholder="Ex : Médiation de la consommation — CM2C"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <PremiumInput
          label="Adresse"
          value={mediateurAdresse}
          onChange={setMediateurAdresse}
          placeholder="14 rue Saint-Jean"
        />
        <div className="grid grid-cols-2 gap-4">
          <PremiumInput
            label="Code postal"
            value={mediateurCodePostal}
            onChange={setMediateurCodePostal}
            placeholder="75017"
            mono
          />
          <PremiumInput
            label="Ville"
            value={mediateurVille}
            onChange={setMediateurVille}
            placeholder="Paris"
          />
        </div>
      </div>

      {/* ============ INFORMATIONS BANCAIRES ============ */}
      <GroupTitle>Informations bancaires</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput label="IBAN" type="password" value={iban} onChange={setIban} mono />
        <PremiumInput label="BIC" value={bic} onChange={setBic} mono />
      </div>

      {/* ============ ERREURS DE VALIDATION (récap) ============ */}
      {hasValidationErrors && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 px-5 py-4">
          <p className="text-sm font-hanken font-bold text-red-700 mb-2">
            {validationErrors.length} erreur{validationErrors.length > 1 ? 's' : ''} à corriger avant d&apos;enregistrer
          </p>
          <ul className="list-disc list-inside text-xs text-red-600 font-hanken space-y-0.5">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* ============ BOUTON ENREGISTRER — V4 Premium ============ */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || hasValidationErrors}
          title={hasValidationErrors ? 'Corrigez les erreurs avant d\'enregistrer' : ''}
          className="
            inline-flex items-center gap-2.5
            h-[52px] px-9 rounded-[14px]
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-extrabold text-[15px] tracking-[-0.01em]
            shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            hover:shadow-[0_12px_32px_rgba(255,122,26,0.45),_inset_0_1px_0_rgba(255,255,255,0.4)]
            active:translate-y-0
            transition-all duration-[250ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
            disabled:hover:shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
          "
        >
          {/* Icône check */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>

      <SuccessMessage message={success} />
      <ErrorMessage message={errorMsg} />
    </div>
  )
}

function DocumentsSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [prefixDevis, setPrefixDevis] = useState('D')
  const [prefixFactures, setPrefixFactures] = useState('F')
  const [conditionsPaiement, setConditionsPaiement] = useState('')
  const [mentionsLegales, setMentionsLegales] = useState('')
  const [docColor, setDocColor] = useState('#5ab4e0')
  const [logoOnDocs, setLogoOnDocs] = useState(true)
  // PDF chantier V2 : modalites d'intervention + engagements par defaut
  const [modalitesDefault, setModalitesDefault] = useState('')
  const [engagementsDefault, setEngagementsDefault] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (entreprise) {
      setPrefixDevis((entreprise.prefix_devis as string) ?? 'D')
      setPrefixFactures((entreprise.prefix_factures as string) ?? 'F')
      setConditionsPaiement((entreprise.conditions_paiement as string) ?? '')
      setMentionsLegales((entreprise.mentions_legales_custom as string) ?? '')
      setDocColor((entreprise.couleur_principale as string) ?? '#5ab4e0')
      setModalitesDefault((entreprise.modalites_intervention_default as string) ?? '')
      setEngagementsDefault((entreprise.engagements_default as string) ?? '')
    }
  }, [entreprise])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(null)
    setErrorMsg(null)
    try {
      await update({
        prefix_devis: prefixDevis,
        prefix_factures: prefixFactures,
        conditions_paiement: conditionsPaiement,
        mentions_legales_custom: mentionsLegales || null,
        couleur_principale: docColor,
        modalites_intervention_default: modalitesDefault || null,
        engagements_default: engagementsDefault || null,
      })
      setSuccess('Paramètres de documents enregistrés avec succès.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    // ============ DocumentsSection — V4 Light Premium ============
    // Carte blanche premium avec accent line orange, header iconique,
    // PremiumInput pour préfixes (mono), groupes thématiques avec GroupTitle.
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange en haut */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* Header iconique */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Documents
          </h2>
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
            Numérotation, conditions, mentions légales et PDF chantier
          </p>
        </div>
      </div>

      {/* ============ NUMÉROTATION ============ */}
      <GroupTitle mt="mt-8">Numérotation</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Préfixe devis */}
        <div>
          <FieldLabel>Préfixe devis</FieldLabel>
          <input
            type="text"
            value={prefixDevis}
            onChange={(e) => setPrefixDevis(e.target.value)}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-spline-mono font-medium text-[14.5px] text-[#0f1a3a] leading-[1.4] tracking-[0.5px]
                       placeholder:text-gray-400
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
          <FieldHint>Format final : {prefixDevis}YYYY-NNNNN</FieldHint>
        </div>

        {/* Préfixe factures */}
        <div>
          <FieldLabel>Préfixe factures</FieldLabel>
          <input
            type="text"
            value={prefixFactures}
            onChange={(e) => setPrefixFactures(e.target.value)}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-spline-mono font-medium text-[14.5px] text-[#0f1a3a] leading-[1.4] tracking-[0.5px]
                       placeholder:text-gray-400
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
          <FieldHint>Format final : {prefixFactures}YYYY-NNNNN</FieldHint>
        </div>
      </div>

      {/* ============ MENTIONS LÉGALES ============ */}
      <GroupTitle>Mentions légales</GroupTitle>
      <div className="space-y-5">
        <div>
          <FieldLabel>Conditions de paiement par défaut</FieldLabel>
          <textarea
            value={conditionsPaiement}
            onChange={(e) => setConditionsPaiement(e.target.value)}
            rows={3}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]
                       placeholder:text-gray-400 resize-y
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
        </div>
        <div>
          <FieldLabel>Mentions légales personnalisées</FieldLabel>
          <textarea
            value={mentionsLegales}
            onChange={(e) => setMentionsLegales(e.target.value)}
            rows={3}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]
                       placeholder:text-gray-400 resize-y
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
        </div>
      </div>

      {/* ============ APPARENCE ============ */}
      <GroupTitle>Apparence</GroupTitle>
      <div className="space-y-5">
        {/* Couleur principale */}
        <div>
          <FieldLabel>Couleur principale documents</FieldLabel>
          <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#fafbfc] border-[1.5px] border-gray-200 w-fit">
            <input
              type="color"
              value={docColor}
              onChange={(e) => setDocColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
              aria-label="Choisir la couleur principale"
            />
            <span className="font-spline-mono font-medium text-[14.5px] text-[#0f1a3a] tracking-[0.5px]">{docColor}</span>
          </div>
        </div>

        <PremiumToggle label="Logo sur les documents" checked={logoOnDocs} onChange={setLogoOnDocs} />
      </div>

      {/* ============ PDF CHANTIER V2 ============ */}
      <GroupTitle>PDF planification de chantier</GroupTitle>
      <InfoBanner tone="info">
        Ces paramètres apparaissent automatiquement sur tous vos PDF de planification chantier envoyés au client. Vous pouvez les écraser au cas par cas dans la fiche d&apos;un chantier spécifique.
      </InfoBanner>

      <div className="space-y-5 mt-4">
        {/* Modalités d'intervention par défaut */}
        <div>
          <FieldLabel>Modalités d&apos;intervention par défaut</FieldLabel>
          <textarea
            value={modalitesDefault}
            onChange={(e) => setModalitesDefault(e.target.value)}
            rows={5}
            placeholder={'Horaires d\'intervention : généralement entre 8h et 18h, en semaine\nLes horaires peuvent varier selon les contraintes du chantier (livraisons, météo, etc.)\nEn cas de retard ou modification, vous serez prévenu(e) au plus tôt'}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]
                       placeholder:text-gray-400 resize-y
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
          <FieldHint>
            Indiquez vos horaires habituels, jours d&apos;intervention, pauses, règles générales. Ce que vos clients doivent savoir avant le démarrage du chantier.
          </FieldHint>
        </div>

        {/* Engagements qualité par défaut */}
        <div>
          <FieldLabel>Mes engagements qualité</FieldLabel>
          <textarea
            value={engagementsDefault}
            onChange={(e) => setEngagementsDefault(e.target.value)}
            rows={5}
            placeholder={'• Site nettoyé chaque fin de journée\n• Photos d\'avancement envoyées régulièrement\n• Réponse à vos questions sous 24h ouvrées\n• Information immédiate par SMS en cas d\'imprévu\n• Respect des dates communiquées (sauf intempéries documentées)'}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]
                       placeholder:text-gray-400 resize-y
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200"
          />
          <FieldHint>
            Ce sur quoi vous vous engagez systématiquement (photos, propreté, communication). Affiché en évidence dans le PDF chantier — c&apos;est ce qui vous différencie d&apos;un concurrent qui n&apos;ose pas l&apos;écrire.
          </FieldHint>
        </div>
      </div>

      {/* ============ BOUTON ENREGISTRER — V4 Premium ============ */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="
            inline-flex items-center gap-2.5
            h-[52px] px-9 rounded-[14px]
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-extrabold text-[15px] tracking-[-0.01em]
            shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            active:translate-y-0
            transition-all duration-[250ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>

      <SuccessMessage message={success} />
      <ErrorMessage message={errorMsg} />
    </div>
  )
}

function FacturationSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [tvaDefaut, setTvaDefaut] = useState('20')
  const [delaiPaiement, setDelaiPaiement] = useState('30')
  const [penalites, setPenalites] = useState("3 fois le taux d'intérêt légal")
  const [indemnite, setIndemnite] = useState('40 EUR')
  const [escompte, setEscompte] = useState('Aucun escompte accordé')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (entreprise) {
      setTvaDefaut(String(entreprise.tva_defaut ?? '20'))
      setDelaiPaiement(String(entreprise.delai_paiement_defaut ?? '30'))
      // D5 (2026-06-08) : hydrater aussi les 3 mentions légales par défaut
      // (avant : les valeurs étaient affichées mais non chargées depuis la DB,
      //  donc l'utilisateur voyait toujours les défauts hardcodés).
      if (entreprise.penalites_retard_defaut) {
        setPenalites(String(entreprise.penalites_retard_defaut))
      }
      if (entreprise.indemnite_forfaitaire_defaut) {
        setIndemnite(String(entreprise.indemnite_forfaitaire_defaut))
      }
      if (entreprise.escompte_defaut) {
        setEscompte(String(entreprise.escompte_defaut))
      }
    }
  }, [entreprise])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(null)
    setErrorMsg(null)
    try {
      // D5 (2026-06-08) : ajout des 3 mentions légales par défaut dans
      // l'UPDATE. Sans ça, les saisies utilisateur de "Pénalités de retard",
      // "Indemnité forfaitaire" et "Escompte" étaient silencieusement perdues.
      // Nécessite migration SQL : lib/supabase/migration-2026-06-08-D5-penalites-indemnite-escompte.sql
      await update({
        tva_defaut: parseFloat(tvaDefaut),
        delai_paiement_defaut: parseInt(delaiPaiement, 10),
        penalites_retard_defaut: penalites.trim() || null,
        indemnite_forfaitaire_defaut: indemnite.trim() || null,
        escompte_defaut: escompte.trim() || null,
      })
      setSuccess('Paramètres de facturation enregistrés avec succès.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    // ============ FacturationSection — V4 Light Premium ============
    // Carte blanche premium, header iconique Receipt, groupes Taux / Délais /
    // Mentions légales. PremiumSelect natif stylé + PremiumInput.
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* Header iconique Receipt */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2z" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="8" y1="16" x2="12" y2="16" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Facturation
          </h2>
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
            Taux de TVA, délais de paiement et mentions légales par défaut
          </p>
        </div>
      </div>

      {/* ============ TAUX & DÉLAIS ============ */}
      <GroupTitle mt="mt-8">Taux & délais</GroupTitle>

      <div className="space-y-5">
        {/* TVA par défaut — masqué si franchise TVA activée dans l'onglet Entreprise */}
        {entreprise.franchise_tva === true ? (
          <InfoBanner tone="info">
            <strong>TVA automatiquement à 0 %</strong> — vous êtes en franchise de TVA (option activée dans l&apos;onglet <em>Entreprise</em>).
            La mention <em>« TVA non applicable, art. 293 B du CGI »</em> est ajoutée automatiquement à vos devis et factures.
            <br />
            <span className="text-xs opacity-80 mt-2 block">
              Pour activer un taux de TVA différent, désactivez d&apos;abord la franchise dans l&apos;onglet <em>Entreprise</em>.
            </span>
          </InfoBanner>
        ) : (
          <div>
            <FieldLabel>Taux de TVA par défaut</FieldLabel>
            <select
              value={tvaDefaut}
              onChange={(e) => setTvaDefaut(e.target.value)}
              className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                         font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                         focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                         focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                         transition-all duration-200 cursor-pointer"
            >
              <option value="0">0 % (non applicable)</option>
              <option value="5.5">5,5 % (rénovation logement de + 2 ans)</option>
              <option value="10">10 % (travaux d&apos;amélioration)</option>
              <option value="20">20 % (taux standard)</option>
            </select>
            <FieldHint>
              Ce taux sera pré-sélectionné sur vos nouveaux devis et factures. Vous pourrez toujours le modifier ligne par ligne.
            </FieldHint>
          </div>
        )}

        {/* Delai de paiement */}
        <div>
          <FieldLabel>Délai de paiement par défaut</FieldLabel>
          <select
            value={delaiPaiement}
            onChange={(e) => setDelaiPaiement(e.target.value)}
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                       focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                       focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                       transition-all duration-200 cursor-pointer"
          >
            <option value="0">À réception</option>
            <option value="15">15 jours</option>
            <option value="30">30 jours</option>
            <option value="45">45 jours</option>
          </select>
        </div>
      </div>

      {/* ============ MENTIONS LÉGALES PAR DÉFAUT ============ */}
      <GroupTitle>Mentions légales par défaut</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput label="Pénalités de retard" value={penalites} onChange={setPenalites} />
        <PremiumInput label="Indemnité forfaitaire" value={indemnite} onChange={setIndemnite} mono />
        <div className="md:col-span-2">
          <PremiumInput label="Escompte" value={escompte} onChange={setEscompte} />
        </div>
      </div>

      {/* ============ BOUTON ENREGISTRER — V4 Premium ============ */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="
            inline-flex items-center gap-2.5
            h-[52px] px-9 rounded-[14px]
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-extrabold text-[15px] tracking-[-0.01em]
            shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            active:translate-y-0
            transition-all duration-[250ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>

      <SuccessMessage message={success} />
      <ErrorMessage message={errorMsg} />
    </div>
  )
}

// Section "Apparence" : couleur sidebar + thème des devis/factures.
// Le DocumentThemePicker gère sa propre persistence via /api/parametres/document-theme.
// ============ ApparenceSection — V4 Light Premium ============
// 1 carte principale : Thème dashboard + ThemeSelector.
// Les composants externes ThemeSelector, LogoThemeProposals,
// LogoCustomization, DocumentThemePicker sont laissés tels quels (non touchés).
// Note : la sous-carte "Installer Nexartis comme application" (PWA) a été déplacée
// dans la nouvelle section "Application" — voir ApplicationSection plus bas.
function ApparenceSection() {
  return (
    <div className="space-y-6">
      {/* ============ Carte principale Apparence ============ */}
      <div
        className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                   shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
      >
        {/* Accent line orange */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
        />

        {/* Header iconique Palette */}
        <div className="flex items-start gap-4 mb-8">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                       bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                       shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
              Apparence
            </h2>
            <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
              Personnalisez votre tableau de bord et vos documents
            </p>
          </div>
        </div>

        {/* ============ Thème sidebar ============ */}
        <GroupTitle mt="mt-8">Thème du tableau de bord</GroupTitle>
        <ThemeSelector />
        <p className="mt-3 font-hanken text-xs text-gray-400 italic">
          Astuce : la couleur choisie s&apos;applique uniquement à la barre latérale et aux éléments actifs de votre tableau de bord.
        </p>
      </div>

      {/* V3.1 : Themes auto-generes a partir des couleurs du logo */}
      <LogoThemeProposals />
      {/* V3.1 : Personnalisation de l'incrustation du logo (style + tailles) */}
      <LogoCustomization />
      <DocumentThemePicker />
    </div>
  )
}

// ============ ApplicationSection — V4 Light Premium (V2 simplifiee 09/06/2026) ============
// Onglet dedie a la PWA installable.
// V2 : on a retire le bloc "Etat de l'application" (Statut/Version/Mode) car
// il pretait a confusion : l'etat est lie au navigateur courant, pas
// synchronise entre appareils. Un user installait sur son tel mais sur PC
// ca affichait "Non installee" — incomprehensible.
// On garde : rappel d'installation + bouton + 1 message clair sur le
// caractere "par appareil" + infos mises a jour auto.
function ApplicationSection() {
  return (
    <div className="space-y-6">
      <div
        className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] overflow-hidden
                   shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
      >
        {/* Accent line orange */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
        />

        <div className="p-6 sm:p-8">
          {/* Header iconique Smartphone */}
          <div className="flex items-start gap-4 mb-8">
            <div
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                         bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                         shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
            >
              <Smartphone size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
                Application Nexartis
              </h2>
              <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
                Installation et mises a jour
              </p>
            </div>
          </div>

          {/* Bloc Installation */}
          <GroupTitle mt="mt-2">Installer sur cet appareil</GroupTitle>
          <p className="font-hanken text-sm text-gray-600 leading-relaxed mb-4">
            Ajoutez Nexartis a votre ecran d&apos;accueil pour y acceder en un clic, sans passer par le navigateur. Devis, factures, planning, equipe — tout reste a portee de main, meme en chantier.
          </p>
          <InstallPrompt theme="dashboard" />
          <p className="mt-4 font-hanken text-xs text-gray-500 leading-relaxed">
            Si le bouton ne s&apos;affiche pas, votre navigateur a peut-etre deja propose l&apos;installation, ou la prend en charge differemment (ex&nbsp;: Safari iOS via «&nbsp;Partager &gt; Sur l&apos;ecran d&apos;accueil&nbsp;»).
          </p>

          {/* Bloc Installer sur un autre appareil — QR code (V3 09/06/2026)
              Permet a l'artisan sur PC de scanner avec son tel pour installer
              direct. Et inversement (sur tel, on scanne avec un autre tel). */}
          <GroupTitle mt="mt-10">Installer sur un autre appareil</GroupTitle>
          <p className="font-hanken text-sm text-gray-600 leading-relaxed mb-4">
            Scannez ce QR code avec un autre appareil (telephone, tablette ou ordinateur) pour ouvrir Nexartis directement et l&apos;installer la-bas aussi. Vos donnees suivent automatiquement (synchronisees via votre compte).
          </p>

          {/* Layout 2 colonnes : QR a gauche, instructions a droite */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
            {/* Carte QR code */}
            <div className="bg-white border-[1.5px] border-[#ff7a1a]/25 rounded-2xl p-4 mx-auto sm:mx-0 shadow-[0_4px_16px_rgba(255,122,26,0.08)]">
              <div className="bg-white">
                <QRCodeSVG
                  value="https://nexartis.fr?utm_source=qr&utm_medium=dashboard&utm_campaign=install_multi_device"
                  size={180}
                  level="M"
                  fgColor="#0f1a3a"
                  bgColor="#ffffff"
                />
              </div>
              <p className="text-center mt-3 font-spline-mono font-semibold text-[12px] text-[#0f1a3a] tracking-[0.5px]">
                nexartis.fr
              </p>
            </div>

            {/* Instructions etape par etape */}
            <ol className="space-y-3 text-sm font-hanken text-gray-600 leading-relaxed">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fff5ec] border border-[#ff7a1a]/30 flex items-center justify-center font-spline-mono font-bold text-[12px] text-[#ff7a1a]">1</span>
                <span>Ouvrez l&apos;appareil photo de votre autre appareil et pointez-le sur le QR code.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fff5ec] border border-[#ff7a1a]/30 flex items-center justify-center font-spline-mono font-bold text-[12px] text-[#ff7a1a]">2</span>
                <span>Touchez la notification qui apparait pour ouvrir Nexartis dans votre navigateur.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fff5ec] border border-[#ff7a1a]/30 flex items-center justify-center font-spline-mono font-bold text-[12px] text-[#ff7a1a]">3</span>
                <span>Touchez le bouton <span className="font-bold text-[#0f1a3a]">Installer l&apos;app</span> en haut a droite, ou via le menu Chrome <span className="font-bold text-[#0f1a3a]">«&nbsp;Ajouter a l&apos;ecran d&apos;accueil&nbsp;»</span>.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fff5ec] border border-[#ff7a1a]/30 flex items-center justify-center font-spline-mono font-bold text-[12px] text-[#ff7a1a]">4</span>
                <span>Connectez-vous avec votre compte habituel — toutes vos donnees sont la.</span>
              </li>
            </ol>
          </div>

          {/* Bloc Mises a jour */}
          <GroupTitle mt="mt-10">Mises a jour automatiques</GroupTitle>
          <p className="font-hanken text-sm text-gray-600 leading-relaxed">
            Nexartis se met a jour automatiquement a chaque ouverture. Une notification «&nbsp;Nouvelle version disponible&nbsp;» apparait en bas a droite des qu&apos;une mise a jour est prete.
          </p>
        </div>
      </div>
    </div>
  )
}

// NotificationsSection — refonte 28/05/2026.
// Avant : 6 toggles sans backend (UI fantôme, bouton sans onClick, aucune table prefs).
// Après : on garde uniquement le toggle qui correspond à un mécanisme réellement implémenté
// (envoi email à l'artisan quand un client signe son devis, géré dans api/public/signer).
// Les autres notifications seront réintroduites au fil des implémentations réelles.
function NotificationsSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [notifyDevisSigne, setNotifyDevisSigne] = useState(true)
  // V1 relances auto : envoi d'un email J+7/J+15/J+30 aux clients sur factures impayees.
  // Par defaut TRUE (NULL = TRUE cote DB).
  const [relancesAutoActives, setRelancesAutoActives] = useState(true)
  // V2.1 10/06/2026 : pause globale temporaire des relances auto.
  // Utile vacances / litige en cours / gros bug audit comptable.
  // Format YYYY-MM-DD. Si < today, la pause est expiree (= inactive).
  const [relancesPauseJusquAu, setRelancesPauseJusquAu] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (entreprise) {
      // Par défaut activé : on ne veut pas que l'artisan rate un devis signé.
      setNotifyDevisSigne(entreprise.notify_devis_signe !== false)
      // Relances auto factures : NULL ou TRUE => active, FALSE => desactive.
      setRelancesAutoActives(entreprise.relances_auto_actives !== false)
      // V2.1 : pause globale, on stocke en YYYY-MM-DD pour l'input date.
      const raw = entreprise.relances_pause_jusqu_au
      if (typeof raw === 'string' && raw) {
        setRelancesPauseJusquAu(raw.slice(0, 10))
      } else {
        setRelancesPauseJusquAu('')
      }
    }
  }, [entreprise])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(null)
    setErrorMsg(null)
    try {
      await update({
        notify_devis_signe: notifyDevisSigne,
        relances_auto_actives: relancesAutoActives,
        relances_pause_jusqu_au: relancesPauseJusquAu || null,
      })
      setSuccess('Préférences de notifications enregistrées.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    // ============ NotificationsSection — V4 Light Premium ============
    // Carte blanche, header iconique Bell, PremiumToggle pour l'unique notif
    // active, InfoBanner pour les notifs à venir.
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* Header iconique Bell */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Notifications
          </h2>
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
            Choisissez les alertes que vous recevez par email. Modifiables à tout moment.
          </p>
        </div>
      </div>

      {/* ============ Notifications actives ============ */}
      <GroupTitle mt="mt-8">Alertes email</GroupTitle>

      <div className="space-y-2">
        <PremiumToggle
          label="Devis signé par un client"
          checked={notifyDevisSigne}
          onChange={setNotifyDevisSigne}
        />
        <p className="font-hanken text-xs text-gray-500 ml-1">
          Vous recevez un email dès qu&apos;un client signe votre devis en ligne. Recommandé.
        </p>
      </div>

      {/* ============ Relances automatiques factures (V1) ============ */}
      <GroupTitle mt="mt-8">Relances automatiques</GroupTitle>

      <div className="space-y-2">
        <PremiumToggle
          label="Relances automatiques des factures impayées"
          checked={relancesAutoActives}
          onChange={setRelancesAutoActives}
        />
        <p className="font-hanken text-xs text-gray-500 ml-1 leading-relaxed">
          Quand une facture dépasse sa date d&apos;échéance, Nexartis envoie automatiquement un email à votre client :
          un <strong>rappel courtois à J+7</strong>, un <strong>rappel ferme à J+15</strong>, puis un <strong>dernier rappel à J+30</strong>.
          Un seul email est envoyé par palier. Vous pouvez désactiver à tout moment.
        </p>
      </div>

      {/* V2.1 10/06/2026 : pause globale temporaire des relances auto.
          Permet de suspendre tous les envois sans tout desactiver
          (vacances, litige en cours, audit comptable). */}
      {relancesAutoActives && (
        <div className="mt-5 p-4 rounded-xl border-[1.5px] border-amber-200 bg-amber-50/60">
          <p className="font-hanken font-bold text-[13px] text-amber-900 mb-1">
            Pause temporaire (optionnel)
          </p>
          <p className="font-hanken text-[12.5px] text-amber-800 mb-3 leading-snug">
            Suspendre les relances automatiques jusqu&apos;à une date donnée. Utile si vous êtes en vacances, en litige ou en audit. Aucun email ne sera envoyé pendant cette période.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <PremiumInput
                label="Reprendre les relances le"
                type="date"
                value={relancesPauseJusquAu}
                onChange={setRelancesPauseJusquAu}
              />
            </div>
            {relancesPauseJusquAu && (
              <button
                type="button"
                onClick={() => setRelancesPauseJusquAu('')}
                className="h-[44px] px-4 rounded-xl border border-amber-300 bg-white text-amber-800 font-hanken font-semibold text-xs hover:bg-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                aria-label="Annuler la pause des relances"
              >
                Annuler la pause
              </button>
            )}
          </div>
          {relancesPauseJusquAu && (() => {
            const target = new Date(`${relancesPauseJusquAu}T00:00:00`)
            if (Number.isNaN(target.getTime())) return null
            const today = new Date()
            const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
            const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
            const diff = Math.ceil((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))
            const text = diff > 0
              ? `Pause active : aucune relance envoyée pendant ${diff} jour${diff > 1 ? 's' : ''}.`
              : 'La date est passée — les relances reprendront dès le prochain cron.'
            return (
              <p className="mt-2 font-hanken text-[12px] text-amber-700 italic">
                {text}
              </p>
            )
          })()}
        </div>
      )}

      {/* ============ Notifications à venir ============ */}
      <div className="mt-8">
        <InfoBanner tone="info">
          <strong>D&apos;autres notifications arrivent prochainement</strong>
          <br />
          <span className="text-xs leading-relaxed block mt-1.5">
            On travaille sur : <strong>confirmation de paiement de facture</strong>, <strong>récapitulatif hebdomadaire</strong>, et <strong>alertes de modification de planning</strong>.
            On préfère vous les livrer quand elles fonctionneront vraiment plutôt que d&apos;afficher des cases qui ne font rien.
          </span>
        </InfoBanner>
      </div>

      {/* ============ BOUTON ENREGISTRER — V4 Premium ============ */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="
            inline-flex items-center gap-2.5
            h-[52px] px-9 rounded-[14px]
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-extrabold text-[15px] tracking-[-0.01em]
            shadow-[0_8px_24px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            active:translate-y-0
            transition-all duration-[250ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>

      <SuccessMessage message={success} />
      <ErrorMessage message={errorMsg} />
    </div>
  )
}

function CompteSection({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const { resetOnboarding, loading: onboardingLoading } = useOnboarding()
  const [replaying, setReplaying] = useState(false)

  async function handleReplayTour() {
    if (onboardingLoading || replaying) return
    setReplaying(true)
    await resetOnboarding()
    // On envoie l'utilisateur sur le dashboard d'accueil où le
    // premier spotlight (sur Paramètres) se déclenchera. Une fois
    // celui-ci fermé, le 2e tour se déclenchera quand l'utilisateur
    // ira sur la page de création de devis.
    router.push('/dashboard')
  }

  return (
    // ============ CompteSection — V4 Light Premium ============
    // Carte blanche, header iconique User, groupes Identité / Visite guidée /
    // Zone danger (suppression compte RGPD art. 17).
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* Header iconique User */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Compte
          </h2>
          <p className="font-hanken font-medium text-sm text-gray-500 mt-1.5">
            Email, mot de passe, visite guidée et suppression
          </p>
        </div>
      </div>

      {/* ============ Identité ============ */}
      <GroupTitle mt="mt-8">Identité</GroupTitle>
      <div className="space-y-5">
        {/* Email read-only — input direct, le composant PremiumInput local
            n'expose pas de prop readOnly (volontairement minimal). */}
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            value={userEmail}
            readOnly
            className="w-full py-2.5 px-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                       font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                       cursor-not-allowed opacity-90"
          />
          <FieldHint>L&apos;email de connexion ne peut pas être modifié ici.</FieldHint>
        </div>
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-hanken font-semibold text-sm text-[#0f1a3a]
                       bg-white border-[1.5px] border-gray-200
                       hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                       transition-all duration-200"
          >
            Modifier le mot de passe
          </button>
        </div>
      </div>

      {/* ============ Visite guidée ============ */}
      <GroupTitle>Visite guidée</GroupTitle>
      <p className="font-hanken text-sm text-gray-500 mb-3 leading-relaxed">
        Vous pouvez rejouer le tutoriel de découverte pour le revoir ou le montrer à un confrère.
        Vous serez redirigé sur le tableau de bord et le tutoriel se relancera automatiquement.
      </p>
      <button
        onClick={handleReplayTour}
        disabled={onboardingLoading || replaying}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-hanken font-semibold text-sm text-[#0f1a3a]
                   bg-white border-[1.5px] border-gray-200
                   hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                   transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlayCircle size={17} className="text-[#ff7a1a]" />
        {replaying ? 'Redirection…' : 'Revoir la visite guidée'}
      </button>

      {/* ============ Zone danger : Suppression compte (RGPD art. 17) ============ */}
      {/* Le bouton précédent était décoratif (aucun onClick). En attendant
          l'implémentation d'un workflow de suppression automatisé (cascade
          Supabase + confirmation forte + délai d'annulation 24h), on
          fournit dès maintenant un canal humain conforme RGPD : email avec
          accusé de réception, réponse sous 30 jours maximum (art. 12.3 RGPD). */}
      <div className="mt-10 pt-6 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-hanken font-bold text-[11.5px] uppercase tracking-[0.12em] text-red-600">
            Zone danger
          </span>
          <span className="flex-1 h-px bg-gradient-to-r from-red-200 to-transparent" />
        </div>
        <h3 className="font-hanken font-extrabold text-lg text-[#0f1a3a] mb-2">
          Supprimer mon compte
        </h3>
        <p className="font-hanken text-sm text-gray-600 leading-relaxed mb-4">
          Conformément à l&apos;article 17 du RGPD, vous pouvez demander la
          suppression définitive de votre compte et de toutes les données
          associées (clients, devis, factures, équipe, paramètres). Pour cela,
          envoyez un email depuis l&apos;adresse de votre compte à&nbsp;
          <a
            href="mailto:contact.nexartis@gmail.com?subject=Demande%20de%20suppression%20de%20mon%20compte%20Nexartis&body=Bonjour%2C%0A%0AJe%20souhaite%20supprimer%20d%C3%A9finitivement%20mon%20compte%20Nexartis%20ainsi%20que%20l%27ensemble%20des%20donn%C3%A9es%20associ%C3%A9es.%0A%0AMerci%20de%20me%20confirmer%20la%20bonne%20prise%20en%20compte%20de%20cette%20demande.%0A%0ACordialement"
            className="text-[#ff7a1a] hover:underline font-semibold"
          >
            contact.nexartis@gmail.com
          </a>.
          Votre demande sera traitée sous 30 jours maximum. Avant la suppression,
          pensez à exporter vos données (devis, factures) depuis vos pages
          respectives (boutons «&nbsp;Télécharger PDF&nbsp;»).
        </p>
        <a
          href="mailto:contact.nexartis@gmail.com?subject=Demande%20de%20suppression%20de%20mon%20compte%20Nexartis&body=Bonjour%2C%0A%0AJe%20souhaite%20supprimer%20d%C3%A9finitivement%20mon%20compte%20Nexartis%20ainsi%20que%20l%27ensemble%20des%20donn%C3%A9es%20associ%C3%A9es.%0A%0AMerci%20de%20me%20confirmer%20la%20bonne%20prise%20en%20compte%20de%20cette%20demande.%0A%0ACordialement"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-[1.5px] border-red-300 bg-white text-red-600 font-hanken font-semibold text-sm
                     hover:bg-red-50 hover:border-red-400
                     transition-all duration-200"
        >
          Demander la suppression par email
        </a>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Logo upload with background removal
// -------------------------------------------------------------------

function LogoUploadSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [processing, setProcessing] = useState(false)
  const [removedBgPreview, setRemovedBgPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentLogo = entreprise.logo_url as string | undefined

  const removeBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const w = canvas.width
        const h = canvas.height

        // ══════════════════════════════════════════════════════════
        // ÉTAPE 1 : Détecter la couleur de fond (échantillonnage des bords)
        // ══════════════════════════════════════════════════════════
        const borderPixels: number[][] = []
        const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 40))
        for (let x = 0; x < w; x += sampleStep) {
          borderPixels.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2], data[x * 4 + 3]])
          const bi = ((h - 1) * w + x) * 4
          borderPixels.push([data[bi], data[bi + 1], data[bi + 2], data[bi + 3]])
        }
        for (let yy = 0; yy < h; yy += sampleStep) {
          const li = yy * w * 4
          borderPixels.push([data[li], data[li + 1], data[li + 2], data[li + 3]])
          const ri = (yy * w + w - 1) * 4
          borderPixels.push([data[ri], data[ri + 1], data[ri + 2], data[ri + 3]])
        }
        // Filtrer les pixels déjà transparents (pour les PNG avec fond transparent)
        const opaquePixels = borderPixels.filter(p => p[3] > 128)
        if (opaquePixels.length === 0) {
          // Le fond est déjà transparent, juste recadrer
          const trimmed = trimTransparent(canvas)
          resolve(trimmed.toDataURL('image/png'))
          return
        }
        const bgR = Math.round(opaquePixels.reduce((s, c) => s + c[0], 0) / opaquePixels.length)
        const bgG = Math.round(opaquePixels.reduce((s, c) => s + c[1], 0) / opaquePixels.length)
        const bgB = Math.round(opaquePixels.reduce((s, c) => s + c[2], 0) / opaquePixels.length)

        // ══════════════════════════════════════════════════════════
        // ÉTAPE 2 : Flood fill depuis les bords
        // Seuls les pixels CONNECTÉS au bord et proches de la couleur de fond
        // seront supprimés. Les détails intérieurs du logo sont préservés.
        // ══════════════════════════════════════════════════════════
        const threshold = 75  // tolérance de couleur pour "c'est du fond" (V2 — plus agressive pour gérer les fonds blancs cassés type JPEG)
        const visited = new Uint8Array(w * h) // 0 = pas visité, 1 = visité
        const toRemove = new Uint8Array(w * h) // 1 = pixel à rendre transparent

        const isBackground = (idx: number): boolean => {
          if (data[idx + 3] < 10) return true // déjà transparent
          const r = data[idx], g = data[idx + 1], b = data[idx + 2]
          const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)
          return dist < threshold
        }

        // File d'attente pour le flood fill (BFS)
        const queue: number[] = []

        // Ajouter tous les pixels des 4 bords comme points de départ
        for (let x = 0; x < w; x++) {
          // Bord haut
          const topIdx = x
          if (!visited[topIdx] && isBackground(topIdx * 4)) {
            visited[topIdx] = 1; toRemove[topIdx] = 1; queue.push(topIdx)
          }
          // Bord bas
          const botIdx = (h - 1) * w + x
          if (!visited[botIdx] && isBackground(botIdx * 4)) {
            visited[botIdx] = 1; toRemove[botIdx] = 1; queue.push(botIdx)
          }
        }
        for (let yy = 0; yy < h; yy++) {
          // Bord gauche
          const leftIdx = yy * w
          if (!visited[leftIdx] && isBackground(leftIdx * 4)) {
            visited[leftIdx] = 1; toRemove[leftIdx] = 1; queue.push(leftIdx)
          }
          // Bord droit
          const rightIdx = yy * w + w - 1
          if (!visited[rightIdx] && isBackground(rightIdx * 4)) {
            visited[rightIdx] = 1; toRemove[rightIdx] = 1; queue.push(rightIdx)
          }
        }

        // BFS : propager depuis les bords
        while (queue.length > 0) {
          const pos = queue.shift()!
          const px = pos % w
          const py = Math.floor(pos / w)
          // 4 voisins (haut, bas, gauche, droite)
          const neighbors = [
            py > 0 ? pos - w : -1,       // haut
            py < h - 1 ? pos + w : -1,   // bas
            px > 0 ? pos - 1 : -1,       // gauche
            px < w - 1 ? pos + 1 : -1,   // droite
          ]
          for (const n of neighbors) {
            if (n >= 0 && !visited[n] && isBackground(n * 4)) {
              visited[n] = 1
              toRemove[n] = 1
              queue.push(n)
            }
          }
        }

        // ══════════════════════════════════════════════════════════
        // ÉTAPE 3 : Appliquer la suppression avec lissage des bords
        // Les pixels marqués → transparents
        // Les pixels voisins des marqués → semi-transparents (antialiasing)
        // ══════════════════════════════════════════════════════════
        // D'abord, calculer la distance au fond pour le lissage
        const softThreshold = 100 // seuil étendu pour le lissage progressif (V2 — meilleur antialiasing sur fonds variables)
        for (let i = 0; i < w * h; i++) {
          if (toRemove[i]) {
            data[i * 4 + 3] = 0 // complètement transparent
          } else if (!visited[i]) {
            // Vérifier si ce pixel est voisin d'un pixel supprimé (zone de transition)
            const px = i % w
            const py = Math.floor(i / w)
            let nearRemoved = false
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const nx = px + dx, ny = py + dy
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && toRemove[ny * w + nx]) {
                  nearRemoved = true; break
                }
              }
              if (nearRemoved) break
            }
            if (nearRemoved) {
              // Pixel en bordure du logo → lissage progressif
              const idx = i * 4
              const r = data[idx], g = data[idx + 1], b = data[idx + 2]
              const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)
              if (dist < softThreshold) {
                const alpha = Math.round((dist / softThreshold) * data[idx + 3])
                data[idx + 3] = Math.max(alpha, 0)
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0)

        // Recadrer le logo (supprimer les marges transparentes)
        const trimmed = trimTransparent(canvas)
        resolve(trimmed.toDataURL('image/png'))
      }
      img.src = dataUrl
    })
  }

  /** Recadre un canvas en supprimant les marges transparentes */
  const trimTransparent = (source: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = source.getContext('2d')!
    const w = source.width
    const h = source.height
    const data = ctx.getImageData(0, 0, w, h).data
    let top = h, left = w, right = 0, bottom = 0

    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const alpha = data[(yy * w + xx) * 4 + 3]
        if (alpha > 10) {
          if (yy < top) top = yy
          if (yy > bottom) bottom = yy
          if (xx < left) left = xx
          if (xx > right) right = xx
        }
      }
    }

    // Ajouter un petit padding (2%)
    const pad = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.02))
    top = Math.max(0, top - pad)
    left = Math.max(0, left - pad)
    right = Math.min(w - 1, right + pad)
    bottom = Math.min(h - 1, bottom + pad)

    const trimW = right - left + 1
    const trimH = bottom - top + 1
    const trimmed = document.createElement('canvas')
    trimmed.width = trimW
    trimmed.height = trimH
    const tCtx = trimmed.getContext('2d')!
    tCtx.drawImage(source, left, top, trimW, trimH, 0, 0, trimW, trimH)
    return trimmed
  }

  /**
   * DÉTOURAGE UNIQUEMENT (pas d'enlèvement de fond)
   * Recadre l'image en supprimant les marges périphériques uniformes
   * (pixels transparents OU couleur du fond détectée aux bords).
   * On NE TOUCHE PAS aux pixels intérieurs : zéro artefact, zéro pixel parasite.
   */
  const trimOnly = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas context')); return }
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        // Détecter la couleur du fond (échantillonner les 4 coins)
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ]
        let bgR = 0, bgG = 0, bgB = 0, bgA = 0
        corners.forEach(([x, y]) => {
          const i = (y * canvas.width + x) * 4
          bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]; bgA += data[i + 3]
        })
        bgR = Math.round(bgR / 4); bgG = Math.round(bgG / 4); bgB = Math.round(bgB / 4); bgA = Math.round(bgA / 4)

        const tolerance = 30
        const isBackground = (idx: number): boolean => {
          const a = data[idx + 3]
          if (a < 10) return true // transparent = background
          if (bgA < 10) return false // si bg est transparent et pixel pas, garder
          return Math.abs(data[idx] - bgR) < tolerance
              && Math.abs(data[idx + 1] - bgG) < tolerance
              && Math.abs(data[idx + 2] - bgB) < tolerance
        }

        // Calculer la bbox des pixels NON-fond
        let top = canvas.height, left = canvas.width, right = 0, bottom = 0
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4
            if (!isBackground(idx)) {
              if (y < top) top = y
              if (y > bottom) bottom = y
              if (x < left) left = x
              if (x > right) right = x
            }
          }
        }
        if (right < left || bottom < top) {
          // Image vide ou tout est fond — on retourne le dataUrl original
          resolve(dataUrl)
          return
        }
        const pad = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.02))
        top = Math.max(0, top - pad)
        left = Math.max(0, left - pad)
        right = Math.min(canvas.width - 1, right + pad)
        bottom = Math.min(canvas.height - 1, bottom + pad)

        const trimW = right - left + 1
        const trimH = bottom - top + 1
        const out = document.createElement('canvas')
        out.width = trimW
        out.height = trimH
        const oCtx = out.getContext('2d')!
        oCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH)
        resolve(out.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = dataUrl
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setRemovedBgPreview(null)
      setProcessing(true)
      try {
        // DÉTOURAGE UNIQUEMENT (recadrer marges) — pas d'enlèvement de fond
        const trimmed = await trimOnly(dataUrl)
        setRemovedBgPreview(trimmed)
      } catch {
        // Si le détourage échoue, on garde l'original
        setRemovedBgPreview(dataUrl)
      }
      setProcessing(false)
    }
    reader.readAsDataURL(file)
  }

  const saveLogo = async (dataUrl: string) => {
    setSaving(true)
    try {
      await update({ logo_url: dataUrl })
      setRemovedBgPreview(null)
      // Reload pour rafraîchir TOUS les endroits qui affichent le logo
      // (sidebar, devis, factures...) — sinon le cache React garde l'ancien.
      setTimeout(() => window.location.reload(), 400)
    } catch { /* ignored */ }
    setSaving(false)
  }

  return (
    <div className="mb-8">
      <label className="block font-manrope font-medium text-sm text-gray-700 mb-3">
        Logo de l&apos;entreprise
      </label>

      <div className="flex items-start gap-6">
        {/* Logo actuel */}
        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-white shrink-0">
          {currentLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentLogo} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Camera size={24} className="text-[#6b7280]" />
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="font-manrope text-sm text-[#5ab4e0] font-medium hover:underline"
          >
            {currentLogo ? 'Modifier le logo' : 'Ajouter un logo'}
          </button>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG ou WebP. Max 2 Mo.</p>
          <p className="text-xs text-gray-400 mt-0.5">Le logo est recadré automatiquement.</p>
          <div className="mt-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
            <p className="text-[11px] text-sky-800 font-manrope leading-relaxed">
              💡 <strong>Conseil :</strong> pour un fond transparent (rendu pro sur fonds colorés),
              préparez votre logo en <strong>PNG transparent</strong> via un outil gratuit :{' '}
              <a href="https://remove.bg" target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-900">remove.bg</a>
              {' · '}
              <a href="https://www.photoroom.com/fr/outils/supprimer-fond-image" target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-900">Photoroom</a>
              {' · '}
              <a href="https://pixlr.com/fr/remove-background/" target="_blank" rel="noopener noreferrer" className="underline hover:text-sky-900">Pixlr</a>
            </p>
          </div>
        </div>
      </div>

      {/* Détourage en cours */}
      {processing && (
        <div className="mt-4 bg-sky-50 border border-sky-200 rounded-lg px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#5ab4e0] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#5ab4e0] font-manrope font-medium">Recadrage en cours...</p>
          </div>
        </div>
      )}

      {/* Aperçu du logo recadré, prêt à enregistrer */}
      {removedBgPreview && !processing && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-manrope text-gray-500 mb-2">Aperçu (logo recadré)</p>
            <div className="h-32 w-40 rounded-lg border border-gray-200 flex items-center justify-center p-2" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'10\' height=\'10\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'10\' y=\'10\' width=\'10\' height=\'10\' fill=\'%23f0f0f0\'/%3E%3Crect x=\'10\' width=\'10\' height=\'10\' fill=\'%23ffffff\'/%3E%3Crect y=\'10\' width=\'10\' height=\'10\' fill=\'%23ffffff\'/%3E%3C/svg%3E")' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={removedBgPreview} alt="Logo détouré" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
          <button
            onClick={() => saveLogo(removedBgPreview)}
            disabled={saving}
            className="h-10 px-6 rounded-lg font-syne font-bold text-white bg-[#e87a2a] hover:bg-[#f09050] transition-colors text-sm disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer le logo'}
          </button>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Signature pad
// -------------------------------------------------------------------

function SignatureSection({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const currentSignature = entreprise.signature_base64 as string | undefined
  const currentTampon = entreprise.tampon_base64 as string | undefined
  // Mode actif : signature dessinée ou tampon uploadé
  const activeMode: 'signature' | 'tampon' | null = currentSignature ? 'signature' : currentTampon ? 'tampon' : null

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    // Ratio entre la taille interne du canvas et la taille CSS affichée
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasStrokes(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#0f1a3a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
    setSuccess(null)
    setErrorMsg(null)
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    setSuccess(null)
    setErrorMsg(null)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      // Si un tampon existe, on le supprime pour garder un seul des deux
      await update({ signature_base64: dataUrl, tampon_base64: null })
      setSuccess('Signature enregistrée. Elle apparaîtra sur vos devis.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  const removeSignature = async () => {
    setSaving(true)
    try {
      await update({ signature_base64: null })
      setSuccess('Signature supprimée.')
    } catch { /* ignored */ }
    setSaving(false)
  }

  return (
    // ============ SignatureSection — V4 Light Premium ============
    // Carte blanche, header iconique PenTool, badge configuré si signature ou
    // tampon actif, aperçu, 2 options (dessin + upload tampon).
    <div
      className="relative bg-white rounded-3xl border border-[#0f1a3a]/[0.06] p-6 sm:p-8 overflow-hidden
                 shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)]"
    >
      {/* Accent line orange */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90"
      />

      {/* Header iconique PenTool */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white
                     bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d]
                     shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-hanken font-extrabold text-2xl text-[#0f1a3a] tracking-[-0.025em] leading-tight">
            Ma signature
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <p className="font-hanken font-medium text-sm text-gray-500">
              Signature dessinée ou tampon photo pour vos devis et factures
            </p>
            {activeMode && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                           bg-gradient-to-br from-emerald-100/80 to-emerald-50
                           text-emerald-700 border border-emerald-200/60
                           text-[11.5px] font-hanken font-bold tracking-wider uppercase"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Configuré
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Explication */}
      <InfoBanner tone="info">
        <strong>Choisissez l&apos;un ou l&apos;autre</strong> : soit vous dessinez votre signature, soit vous uploadez une photo de votre tampon.
        L&apos;élément choisi apparaîtra automatiquement sur vos devis et factures dans le cadre «&nbsp;Signature artisan&nbsp;».
      </InfoBanner>

      {/* ============ Aperçu actif ============ */}
      {activeMode && (
        <div className="mt-6 p-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-emerald-50/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="font-hanken font-semibold text-sm text-emerald-800">
              {activeMode === 'signature' ? 'Signature dessinée active' : 'Tampon actif'}
            </p>
          </div>
          <div className="h-20 w-64 rounded-xl border border-gray-200 bg-white flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String((activeMode === 'signature' ? currentSignature : currentTampon) || '')}
              alt={activeMode === 'signature' ? 'Signature' : 'Tampon'}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <button
            onClick={activeMode === 'signature' ? removeSignature : async () => { setSaving(true); await update({ tampon_base64: null }); setSaving(false); setSuccess(activeMode === 'tampon' ? 'Tampon supprimé.' : '') }}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1 text-xs font-hanken font-semibold text-red-600 hover:text-red-700"
          >
            Supprimer {activeMode === 'signature' ? 'la signature' : 'le tampon'}
          </button>
        </div>
      )}

      {/* ============ OPTION 1 : Dessiner ============ */}
      <GroupTitle mt="mt-10">Option 1 — Dessiner ma signature</GroupTitle>
      <p className="font-hanken text-xs text-gray-500 mb-3">Utilisez votre souris ou votre doigt sur mobile.</p>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={250}
          className="w-full max-w-[600px] h-[250px] rounded-2xl border-2 border-dashed border-gray-300 bg-[#fafbfc] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none max-w-[600px]">
            <p className="font-hanken text-sm text-gray-400">Dessinez votre signature ici</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={saveSignature}
          disabled={!hasStrokes || saving}
          className="
            inline-flex items-center gap-2.5
            h-11 px-6 rounded-xl
            bg-gradient-to-b from-[#ff9d4d] to-[#ff7a1a]
            text-white font-hanken font-bold text-sm tracking-[-0.01em]
            shadow-[0_6px_18px_rgba(255,122,26,0.32),_inset_0_1px_0_rgba(255,255,255,0.3)]
            hover:-translate-y-0.5 hover:brightness-105
            active:translate-y-0
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
          "
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la signature'}
        </button>
        <button
          onClick={clearCanvas}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-hanken font-semibold text-sm text-[#0f1a3a]
                     bg-white border-[1.5px] border-gray-200
                     hover:border-[#ff7a1a] hover:bg-[#fafbfc]
                     transition-all duration-200"
        >
          Effacer
        </button>
      </div>

      {/* Séparateur OU */}
      <div className="flex items-center gap-4 my-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <span className="font-hanken font-bold text-[11.5px] uppercase tracking-[0.2em] text-gray-400">ou</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* ============ OPTION 2 : Uploader un tampon ============ */}
      <TamponUpload entreprise={entreprise} update={update} />

      <SuccessMessage message={success} />
      {errorMsg && <p className="mt-3 font-hanken text-sm font-semibold text-red-600">{errorMsg}</p>}
    </div>
  )
}

// -------------------------------------------------------------------
// Tampon upload
// -------------------------------------------------------------------

function TamponUpload({
  entreprise,
  update,
}: {
  entreprise: Record<string, unknown>
  update: (v: Record<string, unknown>) => Promise<unknown>
}) {
  const [processing, setProcessing] = useState(false)
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [removedBgPreview, setRemovedBgPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const removeBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imageData.data
        const w = canvas.width, h = canvas.height

        // Échantillonner les pixels en bordure pour détecter le fond
        const borderPixels: number[][] = []
        const step = Math.max(1, Math.floor(Math.min(w, h) / 20))
        for (let x = 0; x < w; x += step) {
          borderPixels.push([d[x * 4], d[x * 4 + 1], d[x * 4 + 2]])
          const bi = ((h - 1) * w + x) * 4
          borderPixels.push([d[bi], d[bi + 1], d[bi + 2]])
        }
        for (let yy = 0; yy < h; yy += step) {
          const li = yy * w * 4
          borderPixels.push([d[li], d[li + 1], d[li + 2]])
          const ri = (yy * w + w - 1) * 4
          borderPixels.push([d[ri], d[ri + 1], d[ri + 2]])
        }

        const bgR = Math.round(borderPixels.reduce((s, c) => s + c[0], 0) / borderPixels.length)
        const bgG = Math.round(borderPixels.reduce((s, c) => s + c[1], 0) / borderPixels.length)
        const bgB = Math.round(borderPixels.reduce((s, c) => s + c[2], 0) / borderPixels.length)

        const thresholdLow = 35, thresholdHigh = 65
        for (let i = 0; i < d.length; i += 4) {
          const dist = Math.sqrt((d[i] - bgR) ** 2 + (d[i + 1] - bgG) ** 2 + (d[i + 2] - bgB) ** 2)
          if (dist < thresholdLow) d[i + 3] = 0
          else if (dist < thresholdHigh) d[i + 3] = Math.round(((dist - thresholdLow) / (thresholdHigh - thresholdLow)) * d[i + 3])
        }

        ctx.putImageData(imageData, 0, 0)

        // Recadrer (supprimer les marges transparentes)
        const td = ctx.getImageData(0, 0, w, h).data
        let top = h, left = w, right = 0, bottom = 0
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            if (td[(yy * w + xx) * 4 + 3] > 10) {
              if (yy < top) top = yy; if (yy > bottom) bottom = yy
              if (xx < left) left = xx; if (xx > right) right = xx
            }
          }
        }
        const pad = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.02))
        top = Math.max(0, top - pad); left = Math.max(0, left - pad)
        right = Math.min(w - 1, right + pad); bottom = Math.min(h - 1, bottom + pad)
        const tw = right - left + 1, th = bottom - top + 1
        const trimmed = document.createElement('canvas')
        trimmed.width = tw; trimmed.height = th
        trimmed.getContext('2d')!.drawImage(canvas, left, top, tw, th, 0, 0, tw, th)

        resolve(trimmed.toDataURL('image/png'))
      }
      img.src = dataUrl
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setOriginalPreview(dataUrl)
      setRemovedBgPreview(null)
      setProcessing(true)
      try {
        const result = await removeBackground(dataUrl)
        setRemovedBgPreview(result)
      } catch { /* keep original */ }
      setProcessing(false)
    }
    reader.readAsDataURL(file)
  }

  const saveTampon = async (dataUrl: string) => {
    setSaving(true)
    try {
      // Si une signature existe, on la supprime pour garder un seul des deux
      await update({ tampon_base64: dataUrl, signature_base64: null })
      setOriginalPreview(null)
      setRemovedBgPreview(null)
    } catch { /* ignored */ }
    setSaving(false)
  }

  return (
    <div>
      <h3 className="font-syne font-bold text-base text-[#1a1a2e] mb-1">Option 2 — Photo de mon tampon</h3>
      <p className="text-xs font-manrope text-gray-400 mb-3">
        Uploadez une photo de votre tampon. Le fond sera supprimé automatiquement.
        Sur mobile, vous pouvez prendre une photo directement.
      </p>

      <div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-10 px-6 rounded-lg font-syne font-bold text-[#1a1a2e] border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm"
        >
          Choisir une photo du tampon
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Processing */}
      {processing && (
        <div className="mt-4 bg-sky-50 border border-sky-200 rounded-lg px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#5ab4e0] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#5ab4e0] font-manrope font-medium">Détourage IA en cours...</p>
          </div>
          <p className="text-xs text-gray-400 font-manrope mt-2 ml-8">Le modèle d&apos;intelligence artificielle analyse votre logo pour un détourage professionnel. Cela peut prendre 10 à 20 secondes.</p>
        </div>
      )}

      {/* Preview with choices */}
      {!processing && originalPreview && (
        <div className="mt-4 space-y-4">
          {removedBgPreview && (
            <div>
              <p className="text-xs font-manrope text-gray-500 mb-2">Fond supprimé (recommandé)</p>
              <div className="h-24 w-48 rounded-lg border border-gray-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4=')] flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={removedBgPreview} alt="Tampon sans fond" className="max-h-full max-w-full object-contain" />
              </div>
              <button
                onClick={() => saveTampon(removedBgPreview)}
                disabled={saving}
                className="mt-2 h-9 px-5 rounded-lg font-syne font-bold text-white bg-[#e87a2a] hover:bg-[#f09050] transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Utiliser cette version'}
              </button>
            </div>
          )}
          <div>
            <p className="text-xs font-manrope text-gray-500 mb-2">Photo originale</p>
            <div className="h-24 w-48 rounded-lg border border-gray-200 bg-white flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalPreview} alt="Tampon original" className="max-h-full max-w-full object-contain" />
            </div>
            <button
              onClick={() => saveTampon(originalPreview)}
              disabled={saving}
              className="mt-2 h-9 px-5 rounded-lg font-syne font-bold text-[#1a1a2e] border border-gray-200 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Garder l\'original'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// La section AbonnementSection a été déplacée vers la page dédiée
// /dashboard/abonnement (page principale plus complète avec checkout Stripe).

// -------------------------------------------------------------------
// Main page
// -------------------------------------------------------------------

export default function ParametresPage() {
  const [activeSection, setActiveSection] = useState<Section>('entreprise')
  const { entreprise, loading: loadingEntreprise, update } = useEntreprise()
  const { user, loading: loadingUser } = useUser()

  // Restaure l'onglet actif depuis l'URL (#apparence, #documents...) au montage,
  // pour qu'un rechargement (ex. apres application d'un theme) revienne au bon
  // onglet au lieu de retomber sur "Entreprise".
  useEffect(() => {
    if (typeof window === 'undefined') return
    const h = window.location.hash.replace('#', '')
    const valid = ['entreprise', 'documents', 'facturation', 'signature', 'apparence', 'application', 'notifications', 'compte']
    if (valid.includes(h)) setActiveSection(h as Section)
  }, [])

  if (loadingEntreprise || loadingUser) {
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-64 flex-shrink-0">
          <LoadingSkeleton rows={6} />
        </aside>
        <div className="flex-1 min-w-0">
          <LoadingSkeleton rows={8} />
        </div>
      </div>
    )
  }

  return (
    // Ancre pour le tutoriel onboarding (bulle 2/3 — voir
    // components/OnboardingTour.tsx, scénario Paramètres).
    <div data-tour="parametres-content" className="flex flex-col md:flex-row gap-6">
      {/* Sidebar navigation
          V1 Bonus (28/05/2026) : bord droit gris-300 visible en desktop
          pour mieux séparer visuellement la nav du panneau de contenu. */}
      <aside className="w-full md:w-64 flex-shrink-0 md:pr-6 md:border-r md:border-gray-300">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = activeSection === item.id
              // V3 onboarding (09/06/2026) : on accroche data-tour="param-documents"
              // sur l'onglet "Documents" — c'est la bulle "Habille tes documents
              // a tes couleurs" qui pointe vers la personnalisation du theme.
              // V3.0d.2 (09/06/2026) : ajout data-tour="param-apparence" sur l'onglet
              // "Apparence" pour la bulle "Habille ton dashboard a tes couleurs".
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id)
                    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${item.id}`)
                  }}
                  data-tour={item.id === 'documents' ? 'param-documents' : item.id === 'apparence' ? 'param-apparence' : undefined}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-hanken font-medium transition-colors whitespace-nowrap w-full text-left ${
                    active
                      ? 'bg-[#5ab4e0]/10 text-[#5ab4e0] border-l-0 md:border-l-[3px] border-b-[3px] md:border-b-0 border-[#5ab4e0]'
                      : 'text-[#6b7280] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {activeSection === 'entreprise' && entreprise && <EntrepriseSection entreprise={entreprise} update={update} />}
        {activeSection === 'documents' && entreprise && <DocumentsSection entreprise={entreprise} update={update} />}
        {activeSection === 'facturation' && entreprise && <FacturationSection entreprise={entreprise} update={update} />}
        {activeSection === 'signature' && entreprise && <SignatureSection entreprise={entreprise} update={update} />}
        {activeSection === 'apparence' && <ApparenceSection />}
        {activeSection === 'application' && <ApplicationSection />}
        {activeSection === 'notifications' && entreprise && <NotificationsSection entreprise={entreprise} update={update} />}
        {activeSection === 'compte' && <CompteSection userEmail={user?.email || ''} />}
      </div>
    </div>
  )
}
