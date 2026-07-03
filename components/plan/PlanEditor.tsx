'use client'

/**
 * PlanEditor — Orchestrateur de l'éditeur de plan 2D (Push 2, 03/07/2026).
 * Topbar + palette à libellés (V2.1) + canvas + panneau pièce + modale
 * d'ajout + barre polygone + suppression avec « Annuler » 8 s + raccourcis.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanData, PointMm, TypeOuverture } from '@/lib/plan/types'
import { aireMm2, fmtSurfaceM2 } from '@/lib/plan/geometry'
import {
  OUVERTURE_DEFAUTS,
  creerPieceL,
  creerPiecePoly,
  creerPieceRect,
  nomAvecSuffixe,
} from '@/lib/plan/defaults'
import { positionNouvellePiece, preparerOuverture } from '@/lib/plan/edition'
import { toast } from '@/lib/toast'
import { usePlanState } from './usePlanState'
import { useAutosave } from './useAutosave'
import PlanTopbar from './PlanTopbar'
import PlanCanvas, { type Outil, type PolygoneEnCours } from './PlanCanvas'
import RoomSheet from './RoomSheet'
import AddRoomModal, { type DemandePiece } from './AddRoomModal'
import type { VueCalque } from './PlanRender'

export interface PlanEditorProps {
  planId: string
  nomInitial: string
  dataInitiale: PlanData
  retourHref: string
}

const OUTILS_OUVERTURE: { key: TypeOuverture; label: string }[] = [
  { key: 'porte', label: 'Porte' },
  { key: 'fenetre', label: 'Fenêtre' },
  { key: 'porte_fenetre', label: 'Porte-fenêtre' },
  { key: 'baie', label: 'Baie vitrée' },
]

function IconeOutil({ type }: { type: Outil }) {
  const common = { className: 'h-4 w-4 flex-shrink-0', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, 'aria-hidden': true }
  if (type === 'select')
    return (
      <svg {...common}>
        <path d="M5 3l14 8-6 2-3 6-5-16z" strokeLinejoin="round" />
      </svg>
    )
  if (type === 'porte')
    return (
      <svg {...common}>
        <path d="M3 21h18M5 21V4h9" />
        <path d="M14 4a9 9 0 017 9" strokeDasharray="3 3" />
        <path d="M21 13v8" />
      </svg>
    )
  if (type === 'fenetre')
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <path d="M4 12h16M12 6v12" />
      </svg>
    )
  if (type === 'porte_fenetre')
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="1" />
        <path d="M12 3v18M5 12h14" />
      </svg>
    )
  return (
    <svg {...common}>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M8 6v12M16 6v12" />
    </svg>
  )
}

export default function PlanEditor({ planId, nomInitial, dataInitiale, retourHref }: PlanEditorProps) {
  const etat = usePlanState(dataInitiale)
  const [nom, setNom] = useState(nomInitial)
  const { statut } = useAutosave(planId, nom, etat.data, etat.version)
  const [vue, setVue] = useState<VueCalque>('tout')
  const [outil, setOutil] = useState<Outil>('select')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [polygone, setPolygone] = useState<PolygoneEnCours | null>(null)
  const [annulation, setAnnulation] = useState<{ nom: string; baseVersion: number } | null>(null)
  const annulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Barre « Annuler » 8 s après suppression ───────────────────────────────
  useEffect(() => {
    if (annulation && etat.version > annulation.baseVersion + 1) setAnnulation(null)
  }, [etat.version, annulation])

  useEffect(() => {
    return () => {
      if (annulationTimer.current) clearTimeout(annulationTimer.current)
    }
  }, [])

  const supprimerSelection = useCallback(() => {
    if (!etat.pieceSelectionnee) return
    const base = etat.version
    const piece = etat.supprimerPiece(etat.pieceSelectionnee.id)
    if (!piece) return
    setAnnulation({ nom: piece.name, baseVersion: base })
    if (annulationTimer.current) clearTimeout(annulationTimer.current)
    annulationTimer.current = setTimeout(() => setAnnulation(null), 8000)
  }, [etat])

  // ── Raccourcis clavier ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) etat.redo()
        else etat.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        etat.redo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && etat.pieceSelectionnee) {
        e.preventDefault()
        supprimerSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [etat, supprimerSelection])

  // ── Ajout de pièce (modale) ───────────────────────────────────────────────
  const validerAjout = (demande: DemandePiece) => {
    setModalOuverte(false)
    const noms = etat.niveau.rooms.map((r) => r.name)
    const nomPiece = nomAvecSuffixe(demande.nom, noms)
    if (demande.forme === 'poly') {
      setOutil('select')
      etat.selectRoom(null)
      setPolygone({ nom: nomPiece, calque: demande.calque })
      toast.info('Dessinez la pièce sur le plan', {
        description: 'Cliquez chaque angle — double-clic ou clic sur le premier point pour fermer.',
      })
      return
    }
    const [x, y] = positionNouvellePiece(etat.niveau)
    const hsp = etat.niveau.heightDefault
    const piece =
      demande.forme === 'L'
        ? creerPieceL(nomPiece, demande.calque, x, y, demande.largeurMm ?? 3500, demande.hauteurMm ?? 3000, hsp)
        : creerPieceRect(nomPiece, demande.calque, x, y, demande.largeurMm ?? 3500, demande.hauteurMm ?? 3000, hsp)
    etat.ajouterPiece(piece)
    toast.success(`${nomPiece} ajoutée — ${fmtSurfaceM2(aireMm2(piece.vertices))}`, {
      description: 'Glissez-la sur le plan pour la positionner.',
    })
  }

  const terminerPolygone = (points: PointMm[]) => {
    const p = polygone
    setPolygone(null)
    if (!p) return
    if (points.length < 3) {
      toast.warning('Il faut au moins 3 points pour fermer la forme.')
      return
    }
    const xs = points.map((pt) => pt[0])
    const ys = points.map((pt) => pt[1])
    if (Math.max(...xs) - Math.min(...xs) < 300 || Math.max(...ys) - Math.min(...ys) < 300) {
      toast.warning('La forme est trop petite — dessinez-la plus grande.')
      return
    }
    const piece = creerPiecePoly(p.nom, p.calque, points, etat.niveau.heightDefault)
    etat.ajouterPiece(piece)
    toast.success(`${p.nom} ajoutée — ${fmtSurfaceM2(aireMm2(piece.vertices))}`, {
      description: 'Surface calculée sur la forme réelle.',
    })
  }

  // ── Cotes + ouvertures ────────────────────────────────────────────────────
  const editerCote = (roomId: string, dim: 'w' | 'h', mm: number) => {
    if (!etat.redimensionner(roomId, dim, mm)) {
      toast.warning('Dimension invalide', { description: 'Saisissez entre 0,5 et 30 m.' })
    }
  }

  const poserOuverture = (roomId: string, point: PointMm, type: TypeOuverture) => {
    const piece = etat.niveau.rooms.find((r) => r.id === roomId)
    if (!piece) return
    const resultat = preparerOuverture(piece, point, type)
    if ('erreur' in resultat) {
      toast.warning(resultat.erreur)
      return
    }
    etat.ajouterOuverture(roomId, resultat.ouverture)
    toast.success(`${OUVERTURE_DEFAUTS[type].label} posée sur ${piece.name}`)
  }

  const boutonOutil = (key: Outil, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setOutil(key)}
      aria-pressed={outil === key}
      className={`flex w-full items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left font-hanken text-[12.5px] font-semibold transition-colors ${
        outil === key ? 'border-orange bg-orange/5 text-orange' : 'border-transparent text-navy hover:bg-gray-50'
      }`}
    >
      <IconeOutil type={key} />
      <span className="truncate">{label}</span>
    </button>
  )

  const niveauVide = etat.niveau.rooms.length === 0

  return (
    <div className="flex h-full flex-col bg-white">
      <PlanTopbar
        nom={nom}
        onRenommer={setNom}
        statut={statut}
        retourHref={retourHref}
        niveaux={etat.data.levels}
        niveauId={etat.niveauId}
        onNiveau={etat.setNiveauId}
        onAjouterNiveau={etat.ajouterNiveau}
        onRenommerNiveau={etat.renommerNiveau}
        vue={vue}
        onVue={setVue}
        canUndo={etat.canUndo}
        canRedo={etat.canRedo}
        onUndo={etat.undo}
        onRedo={etat.redo}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Palette gauche à libellés (desktop) */}
        <aside className="hidden w-44 flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-white p-2 sm:flex" aria-label="Outils du plan">
          <span className="px-2 pt-1 font-hanken text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Dessin</span>
          <button
            type="button"
            onClick={() => setModalOuverte(true)}
            className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-2.5 py-2 text-left font-hanken text-[12.5px] font-bold text-white shadow-[0_4px_12px_rgba(255,122,26,0.3)] transition-all hover:brightness-105"
          >
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ajouter une pièce
          </button>
          {boutonOutil('select', 'Sélection')}
          <span className="px-2 pt-2 font-hanken text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Ouvertures</span>
          {OUTILS_OUVERTURE.map((o) => boutonOutil(o.key, o.label))}
          {outil !== 'select' && (
            <p className="mx-1 mt-1 rounded-lg bg-sky/10 px-2 py-1.5 font-hanken text-[11px] leading-snug text-navy">
              Cliquez dans une pièce, près du mur qui recevra l&apos;ouverture.
            </p>
          )}
        </aside>

        {/* Canvas + surcouches */}
        <div className="relative min-w-0 flex-1">
          <PlanCanvas
            niveau={etat.niveau}
            vue={vue}
            outil={outil}
            selectedRoomId={etat.selectedRoomId}
            polygone={polygone}
            onSelectRoom={etat.selectRoom}
            onDebutGeste={etat.debutGeste}
            onDeplacerPiece={etat.deplacerPieceSansUndo}
            onCote={editerCote}
            onPoserOuverture={poserOuverture}
            onPolygoneTermine={terminerPolygone}
            onPolygoneAnnule={() => setPolygone(null)}
          />

          {/* Outils (mobile) */}
          <div className="absolute left-2 right-2 top-2 flex gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-sm backdrop-blur sm:hidden" aria-label="Outils du plan">
            {[{ key: 'select' as Outil, label: 'Sélection' }, ...OUTILS_OUVERTURE].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setOutil(o.key)}
                aria-pressed={outil === o.key}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-hanken text-xs font-bold transition-colors ${
                  outil === o.key ? 'bg-orange/10 text-orange' : 'text-navy'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Barre polygone en cours */}
          {polygone && (
            <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-lg sm:top-3">
              <span className="font-hanken text-[13px] font-semibold text-navy">
                {polygone.nom} — cliquez chaque angle, double-clic pour fermer
              </span>
              <button
                type="button"
                onClick={() => setPolygone(null)}
                className="rounded-lg border-[1.5px] border-gray-200 px-2.5 py-1 font-hanken text-xs font-bold text-navy transition-colors hover:border-red-300 hover:text-red-600"
              >
                Annuler
              </button>
            </div>
          )}

          {/* État vide */}
          {niveauVide && !polygone && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto rounded-2xl border border-gray-200 bg-white px-6 py-6 text-center shadow-lg">
                <p className="font-hanken text-[15px] font-extrabold text-navy">Ce niveau est vide</p>
                <p className="mt-1 font-hanken text-[13px] text-gray-500">Ajoutez votre première pièce pour commencer le plan.</p>
                <button
                  type="button"
                  onClick={() => setModalOuverte(true)}
                  className="mt-4 rounded-xl bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-2.5 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.35)] transition-all hover:brightness-105"
                >
                  Ajouter une pièce
                </button>
              </div>
            </div>
          )}

          {/* FAB ajout (au-dessus du tiroir mobile) */}
          {!polygone && !niveauVide && (
            <button
              type="button"
              onClick={() => setModalOuverte(true)}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] px-5 py-3 font-hanken text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(255,122,26,0.4)] transition-all hover:brightness-105"
            >
              + Ajouter une pièce
            </button>
          )}

          {/* Suppression : « Annuler » 8 s */}
          {annulation && (
            <div className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-navy px-4 py-2.5 shadow-xl">
              <span className="font-hanken text-[13px] font-semibold text-white">{annulation.nom} supprimée</span>
              <button
                type="button"
                onClick={() => {
                  setAnnulation(null)
                  etat.undo()
                }}
                className="rounded-lg bg-white/10 px-3 py-1 font-hanken text-xs font-bold text-white transition-colors hover:bg-white/20"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Panneau pièce : colonne desktop, tiroir bas mobile */}
        {etat.pieceSelectionnee && (
          <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[48%] overflow-hidden rounded-t-2xl border-t border-gray-200 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:flex-shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
            <RoomSheet
              piece={etat.pieceSelectionnee}
              onMaj={(patch) => etat.majPiece(etat.pieceSelectionnee!.id, patch)}
              onDupliquer={() => etat.dupliquerPiece(etat.pieceSelectionnee!.id)}
              onSupprimer={supprimerSelection}
              onSupprimerOuverture={(oid) => etat.supprimerOuverture(etat.pieceSelectionnee!.id, oid)}
              onFermer={() => etat.selectRoom(null)}
            />
          </aside>
        )}
      </div>

      <AddRoomModal
        open={modalOuverte}
        calqueParDefaut={vue === 'projet' ? 'projet' : 'existant'}
        onValider={validerAjout}
        onFermer={() => setModalOuverte(false)}
      />
    </div>
  )
}
