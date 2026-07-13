'use client'

// ============================================================================
// ImportReleveModal — import de relevé bancaire en 4 étapes (Lot 2a)
// ----------------------------------------------------------------------------
// Étapes (fidèles à la maquette validée) :
//   1. Fichier      : choix du compte + dépôt du CSV (aucun format imposé).
//                     Si les dates du fichier sont ambiguës (tous les jours
//                     ≤ 12), on DEMANDE à l'utilisateur JJ/MM ou MM/JJ —
//                     jamais de choix silencieux (SPEC §5).
//   2. Vérification : aperçu complet AVANT toute écriture — nb d'opérations,
//                     période, totaux Entrées/Sorties (repérer les signes
//                     inversés), doublons déjà en base pré-marqués.
//   3. Import       : POST /api/banque/import/execute (chunks de 500 côté
//                     serveur, doublons ignorés via hash_dedup). Lot 2c : les
//                     débits reconnus par une règle sont TRIÉS d'office.
//   4. Terminé      : rapport (ajoutées / triées automatiquement / à trier).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompteTresorerie } from './BanqueClient'
import {
  IMPORT_MAX_OCTETS,
  type ExecuteReponse,
  type ParseReponse,
} from '@/lib/banque/types'
import { X, Upload, Loader2, Check, Plus } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers locaux (pas d'import runtime depuis BanqueClient : import de type
// uniquement, pour éviter toute dépendance circulaire à l'exécution)
// ---------------------------------------------------------------------------

const formateurEuros = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function euros(valeur: number): string {
  return `${formateurEuros.format(valeur)} €`
}

function dateFr(iso: string | null): string {
  if (!iso) return ''
  return iso.split('-').reverse().join('/')
}

function jourMois(iso: string): string {
  const [, m, j] = iso.split('-')
  return `${j}/${m}`
}

type Etape = 1 | 2 | 3 | 4

const ETAPES: { n: Etape; label: string }[] = [
  { n: 1, label: 'Fichier' },
  { n: 2, label: 'Vérification' },
  { n: 3, label: 'Import' },
  { n: 4, label: 'Terminé' },
]

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function ImportReleveModal({
  comptes,
  onClose,
  onImported,
  onCreerCompte,
  onAide,
}: {
  /** Comptes BANCAIRES actifs de l'utilisateur (le parent filtre déjà). */
  comptes: CompteTresorerie[]
  onClose: () => void
  /** Appelé après un import réussi quand l'utilisateur ferme le rapport. */
  onImported: () => void
  onCreerCompte: () => void
  onAide: () => void
}) {
  const [etape, setEtape] = useState<Etape>(1)
  const [compteId, setCompteId] = useState<string>(comptes[0]?.id ?? '')
  const [fichier, setFichier] = useState<File | null>(null)
  const [analyse, setAnalyse] = useState<ParseReponse | null>(null)
  const [resultat, setResultat] = useState<ExecuteReponse | null>(null)
  const [datesAmbigues, setDatesAmbigues] = useState(false)
  const [enAnalyse, setEnAnalyse] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Si un compte vient d'être créé (via CompteModal), on le sélectionne.
  useEffect(() => {
    if (comptes.length > 0 && !comptes.some((c) => c.id === compteId)) {
      setCompteId(comptes[0].id)
    }
  }, [comptes, compteId])

  // Échap ferme la modale — sauf pendant l'import (étape 3), pour ne pas
  // laisser croire que l'import a été annulé alors qu'il continue au serveur.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && etape !== 3) onClose()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [onClose, etape])

  const compteChoisi = comptes.find((c) => c.id === compteId)

  // ── Étape 1 → 2 : analyse du fichier (aucune écriture en base) ──
  const analyser = useCallback(
    async (f: File, ordreDates?: 'jma' | 'mja') => {
      setErreur(null)

      if (!/\.csv$/i.test(f.name)) {
        setErreur(
          'Seuls les fichiers CSV sont acceptés pour le moment. Téléchargez la version CSV du relevé depuis votre banque.',
        )
        return
      }
      if (f.size > IMPORT_MAX_OCTETS) {
        setErreur('Fichier trop volumineux (4 Mo maximum). Découpez le relevé, par exemple un semestre à la fois.')
        return
      }
      if (!compteId) {
        setErreur('Choisissez d’abord le compte sur lequel ajouter ces opérations.')
        return
      }

      setEnAnalyse(true)
      setFichier(f)
      try {
        const form = new FormData()
        form.append('fichier', f)
        form.append('compteId', compteId)
        if (ordreDates) form.append('ordreDates', ordreDates)

        const res = await fetch('/api/banque/import/parse', { method: 'POST', body: form })
        const corps = (await res.json().catch(() => null)) as
          | ParseReponse
          | { error?: string }
          | null
        if (!res.ok || !corps || !('ok' in corps)) {
          setErreur(
            (corps && 'error' in corps && corps.error) ||
              "Erreur pendant l'analyse du fichier. Réessayez.",
          )
          setDatesAmbigues(false)
          return
        }

        if (corps.confirmationDatesRequise) {
          // Jamais de choix silencieux : on demande à l'utilisateur.
          setDatesAmbigues(true)
          return
        }

        setDatesAmbigues(false)
        setAnalyse(corps)
        setEtape(2)
      } catch (e) {
        console.error('Analyse du relevé impossible', e)
        setErreur('Connexion impossible. Vérifiez votre réseau et réessayez.')
      } finally {
        setEnAnalyse(false)
      }
    },
    [compteId],
  )

  // ── Étape 2 → 3 → 4 : import réel ──
  const importer = useCallback(async () => {
    if (!analyse) return
    setErreur(null)
    setEtape(3)
    try {
      const res = await fetch('/api/banque/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compteId,
          fichierNom: analyse.fichierNom,
          fichierHash: analyse.fichierHash,
          lignes: analyse.lignes.map((l) => ({
            date: l.date,
            libelle: l.libelle,
            montant: l.montant,
          })),
        }),
      })
      const corps = (await res.json().catch(() => null)) as
        | ExecuteReponse
        | { error?: string }
        | null
      if (!res.ok || !corps || !('ok' in corps)) {
        setErreur(
          (corps && 'error' in corps && corps.error) || "Erreur pendant l'import. Réessayez.",
        )
        setEtape(2)
        return
      }
      setResultat(corps)
      setEtape(4)
    } catch (e) {
      console.error('Import du relevé impossible', e)
      setErreur('Connexion impossible pendant l’import. Vérifiez votre réseau et réessayez.')
      setEtape(2)
    }
  }, [analyse, compteId])

  function recommencer() {
    setEtape(1)
    setFichier(null)
    setAnalyse(null)
    setResultat(null)
    setDatesAmbigues(false)
    setErreur(null)
  }

  const nbNouvelles = analyse ? analyse.lignes.length - analyse.nbDejaImportees : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy/40"
        onClick={etape === 3 ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        className="relative bg-white rounded-[20px] w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl p-5 sm:p-6 font-hanken"
        role="dialog"
        aria-modal="true"
        aria-label="Importer un relevé bancaire"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-hanken font-bold text-lg text-navy">Importer un relevé</h2>
          {etape !== 3 && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Fil d'étapes */}
        <div className="flex items-center gap-1.5 mb-5 flex-wrap" aria-hidden="true">
          {ETAPES.map((e, i) => (
            <span key={e.n} className="contents">
              <span
                className={`w-[26px] h-[26px] rounded-full border-[1.5px] font-spline-mono text-[12px] font-bold inline-flex items-center justify-center flex-shrink-0 ${
                  etape >= e.n ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-400'
                }`}
              >
                {e.n}
              </span>
              <span className="text-[11.5px] font-semibold text-gray-500">{e.label}</span>
              {i < ETAPES.length - 1 && <span className="flex-1 min-w-[12px] h-[1.5px] bg-gray-200" />}
            </span>
          ))}
        </div>

        {erreur && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 mb-4 text-[13px] text-red-800" role="alert">
            {erreur}
          </div>
        )}

        {/* ══════════ Étape 1 : fichier ══════════ */}
        {etape === 1 && (
          <div>
            {/* Choix du compte */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Ajouter les opérations à
            </p>
            {comptes.length === 0 ? (
              <div className="rounded-xl bg-cream border border-gold/50 px-4 py-3 mb-4 text-[13px] text-navy/80">
                <p className="mb-2.5">
                  Commencez par créer le compte qui recevra ces opérations (son nom suffit — jamais votre IBAN
                  complet).
                </p>
                <button
                  onClick={onCreerCompte}
                  className="h-10 px-4 rounded-xl bg-navy hover:bg-navy-mid text-white font-bold text-[13px] transition inline-flex items-center gap-1.5"
                >
                  <Plus size={15} aria-hidden="true" /> Créer mon compte bancaire
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                  value={compteId}
                  onChange={(e) => setCompteId(e.target.value)}
                  aria-label="Compte qui recevra les opérations"
                  className="h-10 px-3 rounded-xl border-[1.5px] border-gray-200 bg-white text-sm font-semibold text-navy focus:outline-none focus:border-sky transition max-w-full"
                >
                  {comptes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                      {c.iban_masque ? ` (${c.iban_masque})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onCreerCompte}
                  className="h-10 px-3 rounded-xl border-[1.5px] border-gray-200 bg-white font-semibold text-[13px] text-navy hover:border-sky transition inline-flex items-center gap-1"
                >
                  <Plus size={14} aria-hidden="true" /> Nouveau compte
                </button>
              </div>
            )}

            {datesAmbigues ? (
              /* ── Dates ambiguës : jamais de choix silencieux ── */
              <div className="rounded-2xl border-2 border-gold bg-cream/60 px-5 py-5 mb-4">
                <p className="font-hanken font-bold text-[15px] text-navy mb-1.5">
                  Une précision sur les dates de votre relevé
                </p>
                <p className="text-[13px] text-navy/80 mb-4">
                  Impossible de deviner tout seul dans quel sens votre banque écrit les dates (exemple&nbsp;:
                  «&nbsp;03/07&nbsp;» peut vouloir dire le 3 juillet ou le 7 mars). Dites-le-nous — on ne
                  décidera jamais à votre place&nbsp;:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => fichier && void analyser(fichier, 'jma')}
                    disabled={enAnalyse}
                    className="rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-orange px-4 py-3 text-left transition disabled:opacity-60"
                  >
                    <span className="block font-bold text-[14px] text-navy">Jour / Mois</span>
                    <span className="block text-[12.5px] text-gray-500 mt-0.5">
                      «&nbsp;03/07&nbsp;» = le 3 juillet — le plus courant en France
                    </span>
                  </button>
                  <button
                    onClick={() => fichier && void analyser(fichier, 'mja')}
                    disabled={enAnalyse}
                    className="rounded-xl border-[1.5px] border-gray-200 bg-white hover:border-orange px-4 py-3 text-left transition disabled:opacity-60"
                  >
                    <span className="block font-bold text-[14px] text-navy">Mois / Jour</span>
                    <span className="block text-[12.5px] text-gray-500 mt-0.5">
                      «&nbsp;03/07&nbsp;» = le 7 mars — format américain
                    </span>
                  </button>
                </div>
                <button
                  onClick={recommencer}
                  className="mt-3 text-[12.5px] text-gray-500 underline underline-offset-2 hover:text-navy transition"
                >
                  Choisir un autre fichier
                </button>
              </div>
            ) : (
              /* ── Zone de dépôt ── */
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setSurvol(true)
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setSurvol(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) void analyser(f)
                }}
              >
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={enAnalyse || comptes.length === 0}
                  className={`w-full rounded-2xl border-2 border-dashed transition px-5 py-10 text-center disabled:opacity-50 ${
                    survol
                      ? 'border-orange bg-orange/[0.06]'
                      : 'border-gray-300 hover:border-orange bg-gray-50 hover:bg-orange/[0.04]'
                  }`}
                >
                  {enAnalyse ? (
                    <span className="inline-flex items-center gap-2 text-navy font-bold text-[14px]" role="status" aria-live="polite">
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                      Lecture du fichier…
                    </span>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-gray-400 mb-3" aria-hidden="true" />
                      <span className="block font-bold text-[14px] text-navy mb-1">
                        Glissez le relevé téléchargé depuis votre banque
                      </span>
                      <span className="block text-[12.5px] text-gray-500">
                        Fichier CSV, tel quel. Pas besoin de le modifier&nbsp;: on se débrouille avec les colonnes
                        de votre banque.
                      </span>
                      <span className="inline-block mt-4 h-10 leading-10 px-5 rounded-xl bg-navy text-white font-bold text-[13px]">
                        Choisir un fichier
                      </span>
                    </>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  aria-label="Choisir le fichier CSV du relevé"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void analyser(f)
                  }}
                />
              </div>
            )}

            <div className="mt-4 space-y-1.5 text-[12.5px] text-gray-500">
              <p>✓ Jusqu’à 10&nbsp;000 lignes — un an de relevé passe en une seule fois.</p>
              <p>✓ Réimporter deux fois le même fichier ne crée jamais de doublon.</p>
              <p>✗ Les relevés PDF ne sont pas encore acceptés — téléchargez la version CSV.</p>
            </div>
            <button
              onClick={onAide}
              className="mt-4 text-[13px] font-semibold text-navy underline underline-offset-2 hover:text-orange transition"
            >
              Où trouver ce fichier dans ma banque&nbsp;?
            </button>
          </div>
        )}

        {/* ══════════ Étape 2 : vérification ══════════ */}
        {etape === 2 && analyse && (
          <div>
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-4">
              <p className="font-bold text-[14px] text-green-800 mb-1">On a reconnu votre fichier ✓</p>
              <p className="text-[12.5px] text-green-800/80 break-all">
                {analyse.fichierNom} · colonnes détectées&nbsp;: {analyse.colonnes.date} / {analyse.colonnes.libelle} /{' '}
                {analyse.colonnes.montant}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-[12.5px]">
              <div className="rounded-xl border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Opérations lues</p>
                <p className="font-bold text-navy">
                  {analyse.lignes.length}
                  {analyse.periodeDebut && analyse.periodeFin ? (
                    <>
                      {' · du '}
                      <span className="font-spline-mono">{dateFr(analyse.periodeDebut)}</span>
                      {' au '}
                      <span className="font-spline-mono">{dateFr(analyse.periodeFin)}</span>
                    </>
                  ) : (
                    ''
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Entrées / Sorties</p>
                <p className="font-spline-mono font-medium">
                  <span className="text-green-700">+ {euros(analyse.totalEntrees)}</span>{' '}
                  <span className="text-navy">· − {euros(analyse.totalSorties)}</span>
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Ajouté à</p>
                <p className="font-bold text-navy truncate">
                  {compteChoisi?.nom ?? 'Compte'}
                  {compteChoisi?.iban_masque ? ` (${compteChoisi.iban_masque})` : ''}
                </p>
              </div>
            </div>

            <p className="text-[12px] text-gray-500 mb-3">
              Un doute&nbsp;? Vérifiez que les Entrées/Sorties ci-dessus collent à votre relevé avant d’importer —
              si elles semblent inversées, le fichier de votre banque compte les débits en positif&nbsp;:
              écrivez-nous, on s’en occupe.
            </p>

            {analyse.nbTriablesAuto > 0 && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 mb-3 text-[12.5px] text-green-800">
                <strong>
                  {analyse.nbTriablesAuto} dépense{analyse.nbTriablesAuto > 1 ? 's seront triées' : ' sera triée'}{' '}
                  automatiquement
                </strong>{' '}
                (fournisseurs, URSSAF, assurances… reconnus). Vous gardez le dernier mot&nbsp;: tout se corrige
                en un clic.
              </div>
            )}
            {analyse.fichierDejaImporte && (
              <div className="rounded-xl bg-cream border border-gold/50 px-4 py-2.5 mb-3 text-[12.5px] text-navy/80">
                <strong>Ce fichier a déjà été importé sur ce compte.</strong> Vous pouvez continuer sans risque&nbsp;:
                aucune opération ne sera comptée deux fois.
              </div>
            )}
            {analyse.nbDejaImportees > 0 && (
              <div className="rounded-xl bg-cream border border-gold/50 px-4 py-2.5 mb-3 text-[12.5px] text-navy/80">
                <strong>
                  {analyse.nbDejaImportees} opération{analyse.nbDejaImportees > 1 ? 's sont' : ' est'} déjà dans
                  Nexartis
                </strong>{' '}
                (même date, même montant, même libellé)&nbsp;: on ne {analyse.nbDejaImportees > 1 ? 'les' : 'la'}{' '}
                réimportera pas.
              </div>
            )}
            {analyse.nbPairesFusionnees > 0 && (
              <p className="text-[12.5px] text-gray-500 mb-3">
                Votre fichier est en «&nbsp;écriture double&nbsp;» (chaque opération apparaît deux fois, en débit et
                en crédit)&nbsp;: on a fusionné {analyse.nbPairesFusionnees} paire
                {analyse.nbPairesFusionnees > 1 ? 's' : ''} pour ne garder que les vraies opérations.
              </p>
            )}
            {analyse.nbErreurs > 0 && (
              <p className="text-[12.5px] text-gray-500 mb-3">
                {analyse.nbErreurs} ligne{analyse.nbErreurs > 1 ? 's' : ''} du fichier ne ressemble
                {analyse.nbErreurs > 1 ? 'nt' : ''} pas à une opération (date ou montant illisible) et sera
                {analyse.nbErreurs > 1 ? 'ont' : ''} ignorée{analyse.nbErreurs > 1 ? 's' : ''}.
              </p>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Aperçu des {Math.min(5, analyse.lignes.length)} premières lignes — les lignes grisées sont déjà là
            </p>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden text-[12.5px] mb-5">
              {analyse.lignes.slice(0, 5).map((l, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2 ${l.dejaImporte ? 'opacity-45' : ''}`}
                >
                  <span className="font-spline-mono text-gray-400 w-12 flex-shrink-0">{jourMois(l.date)}</span>
                  <span className="flex-1 truncate text-navy">{l.libelle}</span>
                  {l.dejaImporte && (
                    <span className="inline-flex items-center px-2 py-px rounded-full bg-gray-100 text-gray-500 font-hanken text-[11px] font-semibold flex-shrink-0">
                      Déjà là
                    </span>
                  )}
                  <span
                    className={`font-spline-mono flex-shrink-0 ${l.montant > 0 ? 'text-green-700' : 'text-navy'}`}
                  >
                    {l.montant > 0 ? '+ ' : '− '}
                    {euros(Math.abs(l.montant))}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={recommencer}
                className="h-11 px-4 rounded-xl border-[1.5px] border-gray-200 font-semibold text-sm text-gray-500 hover:border-gray-300 transition"
              >
                ← Retour
              </button>
              {nbNouvelles > 0 ? (
                <button
                  onClick={() => void importer()}
                  className="flex-1 h-11 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-sm transition"
                >
                  Importer {nbNouvelles} opération{nbNouvelles > 1 ? 's' : ''} →
                </button>
              ) : (
                <p className="flex-1 flex items-center justify-center h-11 rounded-xl bg-gray-50 border border-gray-200 text-[13px] font-semibold text-gray-500 text-center px-3">
                  Tout est déjà dans Nexartis — rien de nouveau à importer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══════════ Étape 3 : import en cours ══════════ */}
        {etape === 3 && (
          <div className="py-10 text-center" role="status" aria-live="polite">
            <p className="font-hanken font-bold text-lg text-navy mb-1">Import en cours…</p>
            <p className="text-[12.5px] text-gray-500 mb-6">
              On range ce qu’on reconnaît (fournisseurs, URSSAF, assurances…) — vous garderez le dernier mot.
            </p>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden max-w-sm mx-auto">
              <div className="h-full w-1/2 rounded-full bg-orange animate-pulse" />
            </div>
            <p className="text-[11px] text-gray-400 mt-4">Ne fermez pas cette fenêtre, ça ne prend que quelques secondes.</p>
          </div>
        )}

        {/* ══════════ Étape 4 : rapport ══════════ */}
        {etape === 4 && resultat && (
          <div className="text-center pt-4 pb-2">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
              <Check size={28} aria-hidden="true" />
            </div>
            <p className="font-hanken font-bold text-xl text-navy mb-2">
              {resultat.nbImportees > 0
                ? `${resultat.nbImportees} opération${resultat.nbImportees > 1 ? 's' : ''} ajoutée${
                    resultat.nbImportees > 1 ? 's' : ''
                  }.`
                : 'Rien de nouveau à ajouter.'}
            </p>
            <div className="text-[13.5px] text-gray-600 max-w-sm mx-auto mb-6 space-y-1">
              {resultat.nbTriees > 0 && (
                <p>
                  <strong>{resultat.nbTriees}</strong> triée{resultat.nbTriees > 1 ? 's' : ''} automatiquement
                  (fournisseurs, URSSAF… reconnus) — vous pouvez corriger chacune en un clic.
                </p>
              )}
              {resultat.nbImportees - resultat.nbTriees > 0 && (
                <p>
                  <strong>{resultat.nbImportees - resultat.nbTriees}</strong> reste
                  {resultat.nbImportees - resultat.nbTriees > 1 ? 'nt' : ''} à trier&nbsp;: catégorie, chantier,
                  justificatif — quelques secondes par opération.
                </p>
              )}
              {resultat.nbDoublons > 0 && (
                <p>
                  {resultat.nbDoublons} opération{resultat.nbDoublons > 1 ? 's' : ''} déjà présente
                  {resultat.nbDoublons > 1 ? 's' : ''} {resultat.nbDoublons > 1 ? 'ont été ignorées' : 'a été ignorée'}{' '}
                  (aucun doublon créé).
                </p>
              )}
              {resultat.nbErreurs > 0 && (
                <p>
                  {resultat.nbErreurs} ligne{resultat.nbErreurs > 1 ? 's' : ''} n’{resultat.nbErreurs > 1 ? 'ont' : 'a'}{' '}
                  pas pu être enregistrée{resultat.nbErreurs > 1 ? 's' : ''} — réimportez le fichier pour
                  {resultat.nbErreurs > 1 ? ' les' : ' la'} récupérer (les autres ne seront pas dupliquées).
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                onClick={onImported}
                className="h-12 px-6 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold transition"
              >
                Voir mes opérations
              </button>
              <button
                onClick={recommencer}
                className="h-12 px-5 rounded-xl border-[1.5px] border-gray-200 font-semibold text-sm text-navy hover:border-gray-300 transition"
              >
                Importer un autre fichier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
