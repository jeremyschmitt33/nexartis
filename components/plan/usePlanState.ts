'use client'

/**
 * usePlanState — État de l'éditeur de plan (Push 2, 03/07/2026).
 *
 * Source de vérité : un PlanData (JSON pur, mm entiers). Undo/redo par
 * snapshots sérialisés (max 50). `version` s'incrémente à CHAQUE modification
 * du document : c'est le déclencheur de l'autosave (useAutosave).
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Niveau, Ouverture, Piece, PlanData } from '@/lib/plan/types'
import { genId, niveauVide, nomAvecSuffixe } from '@/lib/plan/defaults'
import {
  purgerOuverturesInvalides,
  redimensionnerParCote,
  translaterPiece,
} from '@/lib/plan/edition'

const UNDO_MAX = 50

function clone(data: PlanData): PlanData {
  return JSON.parse(JSON.stringify(data)) as PlanData
}

export interface PlanStateApi {
  data: PlanData
  /** Compteur de modifications (déclencheur autosave). */
  version: number
  niveau: Niveau
  niveauId: string
  setNiveauId: (id: string) => void
  selectedRoomId: string | null
  selectRoom: (id: string | null) => void
  pieceSelectionnee: Piece | null
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** À appeler UNE fois au début d'un drag (un seul cran d'undo par drag). */
  debutGeste: () => void
  /** Mutation SANS cran d'undo (frames de drag, après debutGeste). */
  deplacerPieceSansUndo: (roomId: string, dx: number, dy: number) => void
  ajouterPiece: (piece: Piece) => void
  majPiece: (roomId: string, patch: Partial<Piece>) => void
  redimensionner: (roomId: string, dim: 'w' | 'h', mm: number) => boolean
  supprimerPiece: (roomId: string) => Piece | null
  dupliquerPiece: (roomId: string) => void
  ajouterOuverture: (roomId: string, ouverture: Ouverture) => void
  supprimerOuverture: (roomId: string, ouvertureId: string) => void
  ajouterNiveau: () => void
  renommerNiveau: (niveauId: string, name: string) => void
}

export function usePlanState(initial: PlanData): PlanStateApi {
  const [data, setData] = useState<PlanData>(initial)
  const [version, setVersion] = useState(0)
  const [niveauId, setNiveauId] = useState<string>(initial.levels[0]?.id ?? '')
  const [selectedRoomId, selectRoom] = useState<string | null>(null)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const dataRef = useRef(data)
  dataRef.current = data

  const niveau = useMemo<Niveau>(() => {
    return data.levels.find((n) => n.id === niveauId) ?? data.levels[0] ?? niveauVide('RDC', 0)
  }, [data, niveauId])

  const pieceSelectionnee = useMemo<Piece | null>(() => {
    if (!selectedRoomId) return null
    return niveau.rooms.find((r) => r.id === selectedRoomId) ?? null
  }, [niveau, selectedRoomId])

  const pushUndo = useCallback(() => {
    undoStack.current.push(JSON.stringify(dataRef.current))
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift()
    redoStack.current = []
    setUndoCount(undoStack.current.length)
    setRedoCount(0)
  }, [])

  const commit = useCallback((suivant: PlanData) => {
    setData(suivant)
    setVersion((v) => v + 1)
  }, [])

  /** Mutation standard : snapshot d'undo puis application sur une copie. */
  const muter = useCallback(
    (fn: (copie: PlanData) => void) => {
      pushUndo()
      const copie = clone(dataRef.current)
      fn(copie)
      commit(copie)
    },
    [pushUndo, commit]
  )

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (prev === undefined) return
    redoStack.current.push(JSON.stringify(dataRef.current))
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    commit(JSON.parse(prev) as PlanData)
  }, [commit])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (next === undefined) return
    undoStack.current.push(JSON.stringify(dataRef.current))
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    commit(JSON.parse(next) as PlanData)
  }, [commit])

  // ── Helpers internes ──────────────────────────────────────────────

  const surNiveau = useCallback(
    (copie: PlanData): Niveau | null => copie.levels.find((n) => n.id === niveauId) ?? null,
    [niveauId]
  )

  // ── Mutations exposées ────────────────────────────────────────────

  const debutGeste = useCallback(() => {
    pushUndo()
  }, [pushUndo])

  const deplacerPieceSansUndo = useCallback(
    (roomId: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return
      const copie = clone(dataRef.current)
      const niv = surNiveau(copie)
      if (!niv) return
      const i = niv.rooms.findIndex((r) => r.id === roomId)
      if (i < 0) return
      niv.rooms[i] = translaterPiece(niv.rooms[i], dx, dy)
      commit(copie)
    },
    [surNiveau, commit]
  )

  const ajouterPiece = useCallback(
    (piece: Piece) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (niv) niv.rooms.push(piece)
      })
      selectRoom(piece.id)
    },
    [muter, surNiveau]
  )

  const majPiece = useCallback(
    (roomId: string, patch: Partial<Piece>) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (!niv) return
        const i = niv.rooms.findIndex((r) => r.id === roomId)
        if (i >= 0) niv.rooms[i] = { ...niv.rooms[i], ...patch }
      })
    },
    [muter, surNiveau]
  )

  const redimensionner = useCallback(
    (roomId: string, dim: 'w' | 'h', mm: number): boolean => {
      const nivActuel = dataRef.current.levels.find((n) => n.id === niveauId)
      const piece = nivActuel?.rooms.find((r) => r.id === roomId)
      if (!piece) return false
      const nouvelle = redimensionnerParCote(piece, dim, mm)
      if (!nouvelle) return false
      muter((copie) => {
        const niv = surNiveau(copie)
        if (!niv) return
        const i = niv.rooms.findIndex((r) => r.id === roomId)
        if (i >= 0) niv.rooms[i] = purgerOuverturesInvalides(nouvelle)
      })
      return true
    },
    [muter, surNiveau, niveauId]
  )

  const supprimerPiece = useCallback(
    (roomId: string): Piece | null => {
      const nivActuel = dataRef.current.levels.find((n) => n.id === niveauId)
      const piece = nivActuel?.rooms.find((r) => r.id === roomId) ?? null
      if (!piece) return null
      muter((copie) => {
        const niv = surNiveau(copie)
        if (!niv) return
        niv.rooms = niv.rooms.filter((r) => r.id !== roomId)
        // Nettoie les références mitoyennes éventuelles vers la pièce supprimée.
        for (const r of niv.rooms) {
          for (const o of r.openings) {
            if (o.sharedWith === roomId) o.sharedWith = null
          }
        }
      })
      selectRoom(null)
      return piece
    },
    [muter, surNiveau, niveauId]
  )

  const dupliquerPiece = useCallback(
    (roomId: string) => {
      const nivActuel = dataRef.current.levels.find((n) => n.id === niveauId)
      const piece = nivActuel?.rooms.find((r) => r.id === roomId)
      if (!piece || !nivActuel) return
      const noms = nivActuel.rooms.map((r) => r.name)
      const copie: Piece = {
        ...translaterPiece(piece, 600, 600),
        id: genId(),
        name: nomAvecSuffixe(piece.name, noms),
        openings: piece.openings.map((o) => ({ ...o, id: genId(), sharedWith: null })),
      }
      muter((c) => {
        const niv = surNiveau(c)
        if (niv) niv.rooms.push(copie)
      })
      selectRoom(copie.id)
    },
    [muter, surNiveau, niveauId]
  )

  const ajouterOuverture = useCallback(
    (roomId: string, ouverture: Ouverture) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        const piece = niv?.rooms.find((r) => r.id === roomId)
        if (piece) piece.openings.push(ouverture)
      })
      selectRoom(roomId)
    },
    [muter, surNiveau]
  )

  const supprimerOuverture = useCallback(
    (roomId: string, ouvertureId: string) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        const piece = niv?.rooms.find((r) => r.id === roomId)
        if (piece) piece.openings = piece.openings.filter((o) => o.id !== ouvertureId)
      })
    },
    [muter, surNiveau]
  )

  const ajouterNiveau = useCallback(() => {
    const noms = dataRef.current.levels.map((n) => n.name)
    let num = 1
    while (noms.includes('Étage ' + num)) num++
    const nouveau = niveauVide('Étage ' + num, dataRef.current.levels.length)
    muter((copie) => {
      copie.levels.push(nouveau)
    })
    setNiveauId(nouveau.id)
    selectRoom(null)
  }, [muter])

  const renommerNiveau = useCallback(
    (id: string, name: string) => {
      const propre = name.trim()
      if (!propre) return
      muter((copie) => {
        const niv = copie.levels.find((n) => n.id === id)
        if (niv) niv.name = propre
      })
    },
    [muter]
  )

  const changerNiveau = useCallback((id: string) => {
    setNiveauId(id)
    selectRoom(null)
  }, [])

  return {
    data,
    version,
    niveau,
    niveauId: niveau.id,
    setNiveauId: changerNiveau,
    selectedRoomId,
    selectRoom,
    pieceSelectionnee,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undo,
    redo,
    debutGeste,
    deplacerPieceSansUndo,
    ajouterPiece,
    majPiece,
    redimensionner,
    supprimerPiece,
    dupliquerPiece,
    ajouterOuverture,
    supprimerOuverture,
    ajouterNiveau,
    renommerNiveau,
  }
}
