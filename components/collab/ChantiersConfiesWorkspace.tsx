'use client'

// ============================================================================
// components/collab/ChantiersConfiesWorkspace.tsx — Vue SOUS-TRAITANT.
// ----------------------------------------------------------------------------
// Les chantiers qu'un confrère (donneur d'ordre) m'a confiés. J'accepte ou je
// refuse ; une fois accepté, je vois le lot (infos travail + client, JAMAIS de
// financier), j'ajoute des photos (3.2) et je publie l'avancement (3.3).
//
// Affiché comme ONGLET « Chantiers confiés » DANS la messagerie (plus dans le
// menu principal). Toute la sécurité est en base (RLS + RPC).
// ============================================================================

import { useRef, useState } from 'react'
import { HardHat, MapPin, Loader2, Check, X, UserCheck, Camera, ImagePlus, Activity, Send, Clock } from 'lucide-react'
import {
  useMesChantiersConfies,
  repondrePartageChantier,
  televerserPhotoConfie,
  ajouterAvancement,
  usePointsAvancement,
  AVANCEMENT_LABELS,
  type ChantierConfie,
  type AvancementStatut,
} from '@/lib/hooks-collab'

/** Photos uniquement (les PDF ne sont pas des photos de chantier). */
const PHOTO_ACCEPT = 'image/*,.heic,.heif'
const ALBUMS: { cle: 'avant' | 'pendant' | 'apres'; label: string }[] = [
  { cle: 'avant', label: 'Avant' },
  { cle: 'pendant', label: 'Pendant' },
  { cle: 'apres', label: 'Après' },
]

/** Ordre d'affichage + couleurs des stades d'avancement. */
const STADES: { cle: AvancementStatut; label: string; badge: string }[] = [
  { cle: 'a_faire', label: 'À faire', badge: 'bg-gray-100 text-gray-600' },
  { cle: 'en_cours', label: 'En cours', badge: 'bg-sky/10 text-sky' },
  { cle: 'en_pause', label: 'En attente', badge: 'bg-orange/10 text-orange' },
  { cle: 'termine', label: 'Terminé', badge: 'bg-emerald-50 text-emerald-600' },
]

function formatDateHeure(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function ChantiersConfiesWorkspace() {
  const { chantiers, loading, refetch } = useMesChantiersConfies()
  const [action, setAction] = useState<string | null>(null)

  const invitations = chantiers.filter((c) => c.statut === 'invite')
  const actifs = chantiers.filter((c) => c.statut === 'actif')

  async function repondre(partageId: string, rep: 'accepter' | 'refuser') {
    setAction(partageId)
    try {
      await repondrePartageChantier(partageId, rep)
      refetch()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="font-hanken max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#0f1a3a] font-hanken tracking-[-0.02em]">Chantiers qu'on m'a confiés</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les lots que des confrères vous confient en sous-traitance. Vous n'avez accès qu'aux
          informations de travail — jamais à leurs devis, factures ou finances.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : chantiers.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-navy/5 grid place-items-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-navy/40" />
          </div>
          <p className="text-sm font-semibold text-navy">Aucun chantier confié pour le moment</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Quand un confrère vous confie un lot d'un de ses chantiers, il apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {invitations.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-orange mb-2">
                Invitations en attente
              </h2>
              <div className="space-y-3">
                {invitations.map((c) => (
                  <ChantierConfieCarte key={c.partage_id} c={c}>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => repondre(c.partage_id, 'accepter')}
                        disabled={action === c.partage_id}
                        className="flex-1 h-10 rounded-xl bg-navy text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-navy-mid transition-colors disabled:opacity-50"
                      >
                        {action === c.partage_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accepter
                      </button>
                      <button
                        onClick={() => repondre(c.partage_id, 'refuser')}
                        disabled={action === c.partage_id}
                        className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Refuser
                      </button>
                    </div>
                  </ChantierConfieCarte>
                ))}
              </div>
            </section>
          )}

          {actifs.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-sky mb-2">
                Chantiers en cours
              </h2>
              <div className="space-y-3">
                {actifs.map((c) => (
                  <ChantierConfieCarte key={c.partage_id} c={c}>
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-emerald-600 font-semibold">
                      <UserCheck className="w-3.5 h-3.5" /> Chantier accepté
                    </div>
                    {c.peut_photos ? (
                      <UploadPhotosConfie chantierId={c.chantier_id} proprietaire={c.proprietaire_nom} />
                    ) : (
                      <p className="mt-3 text-[12px] text-gray-400">
                        Le donneur d'ordre ne vous a pas autorisé à ajouter des photos sur ce chantier.
                      </p>
                    )}
                    {c.peut_avancement && (
                      <AvancementConfie partageId={c.partage_id} proprietaire={c.proprietaire_nom} />
                    )}
                  </ChantierConfieCarte>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ChantierConfieCarte({ c, children }: { c: ChantierConfie; children?: React.ReactNode }) {
  const lieu = [c.chantier_adresse, c.chantier_ville].filter(Boolean).join(', ')
  const dd = formatDate(c.date_debut)
  const df = formatDate(c.date_fin_prevue)
  const periode = (dd || df) ? `${dd || '—'} → ${df || '—'}` : null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-navy/10 text-navy grid place-items-center flex-shrink-0">
          <HardHat className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-navy leading-snug">{c.chantier_titre || 'Chantier'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Confié par <span className="font-semibold text-navy">{c.proprietaire_nom || 'Un confrère'}</span>
          </p>
        </div>
      </div>
      {c.lot && (
        <div className="mt-3 rounded-lg bg-orange/[0.06] border border-orange/15 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange">Votre lot</p>
          <p className="text-[13px] text-navy mt-0.5">{c.lot}</p>
        </div>
      )}
      <div className="mt-2.5 space-y-1.5 text-[12.5px]">
        {lieu && (
          <div className="flex items-start gap-1.5 text-gray-600">
            <MapPin className="w-3.5 h-3.5 text-orange flex-shrink-0 mt-0.5" />
            <span>{lieu}</span>
          </div>
        )}
        {periode && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <span aria-hidden="true">📅</span><span>{periode}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * Bloc « Ajouter des photos » affiché sur un chantier confié accepté (si le
 * donneur d'ordre a coché le droit photos). Les photos partent directement dans
 * la galerie du propriétaire — le sous-traitant ne les revoit pas ici (elles ne
 * sont jamais copiées dans son compte). On donne donc un retour clair : combien
 * ont été envoyées, et les éventuelles erreurs.
 */
function UploadPhotosConfie({ chantierId, proprietaire }: { chantierId: string; proprietaire: string | null }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [album, setAlbum] = useState<'avant' | 'pendant' | 'apres'>('pendant')
  const [envoi, setEnvoi] = useState(false)
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null)
  const [resultat, setResultat] = useState<{ envoyees: number; erreurs: string[] } | null>(null)

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = '' // permet de re-sélectionner les mêmes fichiers
    if (files.length === 0) return

    setEnvoi(true)
    setResultat(null)
    setProgression({ fait: 0, total: files.length })

    let envoyees = 0
    const erreurs: string[] = []
    for (let i = 0; i < files.length; i++) {
      try {
        await televerserPhotoConfie(chantierId, files[i], { album })
        envoyees++
      } catch (err) {
        erreurs.push(`${files[i].name} : ${(err as Error).message}`)
      }
      setProgression({ fait: i + 1, total: files.length })
    }

    setEnvoi(false)
    setProgression(null)
    setResultat({ envoyees, erreurs })
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Camera className="w-3.5 h-3.5 text-navy/60" />
        <p className="text-[12px] font-semibold text-navy">Ajouter des photos du chantier</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="text-[11px] text-gray-400 mr-0.5">Étape :</span>
        {ALBUMS.map((a) => (
          <button
            key={a.cle}
            type="button"
            onClick={() => setAlbum(a.cle)}
            disabled={envoi}
            className={`h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              album === a.cle ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={onFiles}
        disabled={envoi}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={envoi}
        className="w-full h-10 rounded-xl bg-orange text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-orange/90 transition-colors disabled:opacity-60"
      >
        {envoi ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Envoi {progression ? `${progression.fait}/${progression.total}` : '…'}
          </>
        ) : (
          <>
            <ImagePlus className="w-4 h-4" /> Choisir des photos
          </>
        )}
      </button>

      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
        Les photos sont ajoutées directement au chantier de{' '}
        <span className="font-semibold text-gray-500">{proprietaire || 'votre confrère'}</span>. Vous ne les
        reverrez pas ici.
      </p>

      {resultat && (
        <div className="mt-2 space-y-1">
          {resultat.envoyees > 0 && (
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-semibold">
              <Check className="w-3.5 h-3.5" />
              {resultat.envoyees} photo{resultat.envoyees > 1 ? 's' : ''} envoyée{resultat.envoyees > 1 ? 's' : ''}
            </div>
          )}
          {resultat.erreurs.map((msg, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-500">
              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Bloc « Avancement du lot » (côté sous-traitant). Il choisit un stade (À faire,
 * En cours, En attente, Terminé), ajoute une note courte facultative, et publie
 * un point. Le donneur d'ordre le voit sur sa fiche chantier. L'historique des
 * points est affiché en dessous (du plus récent au plus ancien).
 */
function AvancementConfie({ partageId, proprietaire }: { partageId: string; proprietaire: string | null }) {
  const { points, loading, refetch } = usePointsAvancement(partageId)
  const [stade, setStade] = useState<AvancementStatut>('en_cours')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function publier() {
    setEnvoi(true)
    setErreur(null)
    try {
      await ajouterAvancement(partageId, stade, note)
      setNote('')
      refetch()
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3.5 h-3.5 text-navy/60" />
        <p className="text-[12px] font-semibold text-navy">Avancement du lot</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="text-[11px] text-gray-400 mr-0.5">Où en êtes-vous ?</span>
        {STADES.map((s) => (
          <button
            key={s.cle}
            type="button"
            onClick={() => setStade(s.cle)}
            disabled={envoi}
            className={`h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              stade === s.cle ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={envoi}
        rows={2}
        maxLength={1000}
        placeholder="Une note pour le donneur d'ordre (facultatif) : ce qui est fait, ce qui reste…"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-navy placeholder:text-gray-400 focus:outline-none focus:border-navy/40 resize-none disabled:opacity-50"
      />

      <button
        type="button"
        onClick={publier}
        disabled={envoi}
        className="mt-2 w-full h-10 rounded-xl bg-navy text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-navy-mid transition-colors disabled:opacity-60"
      >
        {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Publier le point d'avancement
      </button>

      {proprietaire && (
        <p className="text-[11px] text-gray-400 mt-2">
          Visible par <span className="font-semibold text-gray-500">{proprietaire}</span> sur sa fiche chantier.
        </p>
      )}

      {erreur && <p className="text-[11px] text-red-500 mt-2">{erreur}</p>}

      {/* Historique des points */}
      {!loading && points.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {points.map((p) => {
            const st = STADES.find((s) => s.cle === p.statut)
            return (
              <div key={p.id} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold flex-shrink-0 ${st?.badge || 'bg-gray-100 text-gray-600'}`}>
                  {st?.label || AVANCEMENT_LABELS[p.statut] || p.statut}
                </span>
                <div className="min-w-0 flex-1">
                  {p.note && <p className="text-[12.5px] text-navy leading-snug">{p.note}</p>}
                  <p className="text-[10.5px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {formatDateHeure(p.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
