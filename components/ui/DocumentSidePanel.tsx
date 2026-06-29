'use client'

/**
 * DocumentSidePanel — Afficher un document a cote du formulaire.
 * ------------------------------------------------------------------
 * L'artisan glisse un document (Kbis, RIB, scan...) ; il s'affiche dans un
 * petit panneau flottant qu'il peut DEPLACER (desktop) ou ouvrir en plein
 * ecran (mobile), pour recopier les infos dans le formulaire sans jongler
 * entre dix onglets.
 *
 * Choix techniques :
 *   - AUCUNE dependance : image via <img>, PDF via <iframe> NATIF (le navigateur
 *     sait afficher un PDF tout seul — meme pattern que "Factures recues").
 *   - AUCUN stockage : le fichier reste EN MEMOIRE (URL.createObjectURL),
 *     revoque a la fermeture. Rien n'est televerse (bon pour le RGPD : un Kbis
 *     ou un RIB ne quitte jamais le navigateur).
 *   - Pas d'OCR : on AFFICHE, l'artisan recopie et garde le controle.
 *
 * Composant autonome : il rend son propre bouton declencheur + le panneau.
 */

import type React from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, X, UploadCloud, Move } from 'lucide-react'

const MAX_BYTES = 20 * 1024 * 1024 // 20 Mo

export default function DocumentSidePanel() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [kind, setKind] = useState<'image' | 'pdf' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [pos, setPos] = useState({ x: 24, y: 96 })

  const urlRef = useRef<string | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Nettoyage de l'URL objet au demontage.
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  // Detection desktop (pour le mode flottant) + recalage si la fenetre change.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 640)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const setFile = useCallback((file: File) => {
    setErreur(null)
    const isPdf = file.type === 'application/pdf'
    const isImg = file.type.startsWith('image/')
    if (!isPdf && !isImg) { setErreur('Format non géré. Choisissez une image (photo/scan) ou un PDF.'); return }
    if (file.size > MAX_BYTES) { setErreur('Fichier trop volumineux (20 Mo maximum).'); return }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const u = URL.createObjectURL(file)
    urlRef.current = u
    setUrl(u)
    setKind(isPdf ? 'pdf' : 'image')
  }, [])

  const handleFiles = useCallback((files: FileList | null) => {
    if (files && files[0]) setFile(files[0])
  }, [setFile])

  function openPanel() {
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      setPos({ x: Math.max(8, window.innerWidth - 452), y: 96 })
    }
    setOpen(true)
  }

  const closePanel = useCallback(() => {
    setOpen(false)
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setUrl(null); setKind(null); setErreur(null)
  }, [])

  // Fermeture au clavier (Echap) quand le panneau est ouvert.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  // --- Deplacement du panneau (desktop only) ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isDesktop) return
    // Ne pas demarrer le deplacement quand on clique un bouton de l'en-tete
    // (Changer / Fermer) : sinon la capture du pointeur "avale" le clic.
    if ((e.target as HTMLElement).closest('button')) return
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const x = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 140)
    const y = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 56)
    setPos({ x, y })
  }
  const onPointerUp = () => { dragRef.current = null }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-gray-200 bg-white px-4 py-2.5 font-hanken text-sm font-semibold text-[#0f1a3a] hover:border-[#ff7a1a] hover:bg-[#fff8f2] transition-colors"
      >
        <FileText size={16} className="text-[#ff7a1a]" aria-hidden />
        Afficher un document à côté
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Document affiché à côté du formulaire"
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl
                     inset-x-2 bottom-2 top-16 sm:inset-auto"
          style={isDesktop ? { left: pos.x, top: pos.y, width: 436, height: 580 } : undefined}
        >
          {/* En-tete (poignee de deplacement sur desktop) */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 ${isDesktop ? 'cursor-move' : ''}`}
          >
            {isDesktop && <Move size={14} className="text-gray-300" aria-hidden />}
            <span className="flex-1 truncate font-hanken text-sm font-bold text-[#0f1a3a]">Document</span>
            {url && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg px-2 py-1 font-hanken text-xs font-semibold text-gray-500 hover:bg-gray-100"
              >
                Changer
              </button>
            )}
            <button
              type="button"
              onClick={closePanel}
              aria-label="Fermer le panneau"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0f1a3a]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Corps */}
          <div className="min-h-0 flex-1 bg-[#f6f8fb]">
            {!url ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <UploadCloud size={32} className="text-[#ff7a1a]" />
                <span className="font-hanken text-sm font-semibold text-[#0f1a3a]">
                  Glissez un document ici, ou cliquez
                </span>
                <span className="font-manrope text-xs text-gray-400">
                  Kbis, RIB, scan... &mdash; image ou PDF, 20 Mo max. Rien n&apos;est enregistré.
                </span>
                {erreur && <span className="font-hanken text-xs text-red-600">{erreur}</span>}
              </button>
            ) : kind === 'image' ? (
              <div className="h-full w-full overflow-auto p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Document affiche" className="mx-auto h-auto max-w-full" />
              </div>
            ) : (
              <iframe src={url} title="Document affiche" className="h-full w-full border-0" />
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  )
}
