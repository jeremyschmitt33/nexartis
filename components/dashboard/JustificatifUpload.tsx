'use client'

// ============================================================================
// JustificatifUpload — champ de justificatif partagé (Lot 2b)
// ----------------------------------------------------------------------------
// Utilisé par : le panneau de pointage (banque_mouvements.justificatif_path)
// et la modale Achats (achats.justificatif_url — qui stocke le PATH du bucket).
// Deux modes :
//  - IMMÉDIAT (entiteId fourni) : le fichier est converti/compressé puis
//    téléversé dès la sélection ; onPathChange(path) est appelé pour que le
//    parent écrive le path en base. Idem à la suppression (onPathChange(null)).
//  - DIFFÉRÉ (entiteId null) : l'entité n'existe pas encore (nouvel achat) ;
//    le fichier est gardé en mémoire et remonté via onFileSelected — le parent
//    appelle uploaderJustificatif() après l'INSERT, avec le vrai id.
// Affichage : bouton « Voir » → URL signée temporaire (bucket privé).
// ============================================================================

import { useRef, useState } from 'react'
import { Loader2, Paperclip, Trash2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  JUSTIFICATIF_ACCEPT,
  JustificatifError,
  supprimerJustificatif,
  uploaderJustificatif,
  urlSigneeJustificatif,
  type EntiteJustificatif,
} from '@/lib/banque/justificatifs'

export default function JustificatifUpload({
  path,
  entite,
  entiteId,
  onPathChange,
  onFileSelected,
  libelle = '📎 Ajouter le ticket ou la facture',
}: {
  /** Path actuellement stocké en base (null = aucun justificatif). */
  path: string | null
  entite: EntiteJustificatif
  /** id de l'entité — null = mode différé (upload au moment de l'enregistrement). */
  entiteId: string | null
  /** Mode immédiat : appelé après upload / suppression pour écrire le path en base. */
  onPathChange?: (path: string | null) => void | Promise<void>
  /** Mode différé : le fichier sélectionné (null quand retiré). */
  onFileSelected?: (file: File | null) => void
  libelle?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fichierEnAttente, setFichierEnAttente] = useState<string | null>(null)

  async function surSelection(file: File | null) {
    setErreur(null)
    if (!file) return

    // ── Mode différé : on garde le fichier, l'upload viendra à l'enregistrement ──
    if (!entiteId) {
      setFichierEnAttente(file.name)
      onFileSelected?.(file)
      return
    }

    // ── Mode immédiat : conversion + compression + upload tout de suite ──
    setOccupe(true)
    try {
      const supabase = createClient()
      const ancien = path
      const nouveau = await uploaderJustificatif(supabase, { file, entite, entiteId })
      await onPathChange?.(nouveau)
      // L'ancien fichier ne sert plus : nettoyage silencieux.
      if (ancien) void supprimerJustificatif(supabase, ancien)
    } catch (e) {
      setErreur(
        e instanceof JustificatifError
          ? e.message
          : 'Impossible d’envoyer le justificatif. Réessayez.',
      )
    } finally {
      setOccupe(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function voir() {
    if (!path) return
    setErreur(null)
    const supabase = createClient()
    const url = await urlSigneeJustificatif(supabase, path)
    if (!url) {
      setErreur('Impossible d’ouvrir le justificatif. Réessayez.')
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  async function supprimer() {
    setErreur(null)
    if (!entiteId) {
      setFichierEnAttente(null)
      onFileSelected?.(null)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (!path) return
    setOccupe(true)
    try {
      const supabase = createClient()
      await onPathChange?.(null)
      void supprimerJustificatif(supabase, path)
    } catch {
      setErreur('Impossible de retirer le justificatif. Réessayez.')
    } finally {
      setOccupe(false)
    }
  }

  const aQuelqueChose = Boolean(path || fichierEnAttente)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={JUSTIFICATIF_ACCEPT}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void surSelection(e.target.files?.[0] ?? null)}
      />

      {!aQuelqueChose ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={occupe}
          className="w-full min-h-[48px] rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold text-[13px] hover:border-sky hover:text-navy disabled:opacity-60 transition inline-flex items-center justify-center gap-2 px-3"
        >
          {occupe ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Envoi du justificatif…
            </>
          ) : (
            libelle
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-gray-200 bg-gray-50 px-3 py-2.5">
          <Paperclip size={15} className="text-orange flex-shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-navy truncate flex-1">
            {fichierEnAttente ?? 'Justificatif joint'}
          </span>
          {occupe ? (
            <Loader2 size={15} className="animate-spin text-gray-400" aria-hidden="true" />
          ) : (
            <>
              {path && (
                <button
                  type="button"
                  onClick={() => void voir()}
                  className="w-9 h-9 rounded-lg hover:bg-white flex items-center justify-center text-navy transition"
                  aria-label="Voir le justificatif"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[12px] font-bold text-navy underline underline-offset-2 hover:text-orange transition"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={() => void supprimer()}
                className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600 transition"
                aria-label="Supprimer le justificatif"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}

      {erreur && (
        <p className="text-[12px] text-red-700 mt-1.5" role="alert">
          {erreur}
        </p>
      )}
      {!aQuelqueChose && !erreur && (
        <p className="text-[11.5px] text-gray-400 mt-1.5">
          PDF, JPG, PNG — photos iPhone converties automatiquement, 5&nbsp;Mo max après compression.
        </p>
      )}
    </div>
  )
}
