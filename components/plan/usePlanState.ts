'use client'

/**
 * usePlanState — État de l'éditeur de plan (Push 2, 03/07/2026).
 *
 * Source de vérité : un PlanData (JSON pur, mm entiers). Undo/redo par
 * snapshots sérialisés (max 50). `version` s'incrémente à CHAQUE modification
 * du document : c'est le déclencheur de l'autosave (useAutosave).
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Cloture, Niveau, Ouverture, Piece, PlanData, PointMm, Symbole } from '@/lib/plan/types'
import { genId, niveauVide, nomAvecSuffixe } from '@/lib/plan/defaults'
import {
  recalerOuvertures,
  redimensionnerParCote,
  translaterPiece,
} from '@/lib/plan/edition'

const UNDO_MAX = 50

/**
 * Résultat d'une édition de cote. Le booléen d'avant ne pouvait dire que
 * « non » : impossible de distinguer une dimension hors bornes d'un mur qui
 * porte une porte trop large — et donc impossible de NOMMER le coupable à
 * l'artisan. Une modification refusée doit toujours s'expliquer.
 */
export type ResultatCote =
  | { ok: true; info?: string }
  | { ok: false; message: string; description?: string }

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
  selectedSymbolId: string | null
  selectSymbol: (id: string | null) => void
  symboleSelectionne: Symbole | null
  selectedFenceId: string | null
  selectFence: (id: string | null) => void
  clotureSelectionnee: Cloture | null
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
  redimensionner: (roomId: string, dim: 'w' | 'h', mm: number) => ResultatCote
  supprimerPiece: (roomId: string) => Piece | null
  dupliquerPiece: (roomId: string) => void
  ajouterOuverture: (roomId: string, ouverture: Ouverture) => void
  supprimerOuverture: (roomId: string, ouvertureId: string) => void
  ajouterSymbole: (symbole: Symbole) => void
  supprimerSymbole: (symboleId: string) => void
  ajouterCloture: (cloture: Cloture) => void
  supprimerCloture: (clotureId: string) => void
  /** Mutation SANS cran d'undo (frames de drag, après debutGeste). */
  deplacerSymboleSansUndo: (symboleId: string, dx: number, dy: number) => void
  /** Patch SANS cran d'undo (fin de drag : réaffectation de pièce). */
  majSymboleSansUndo: (symboleId: string, patch: Partial<Symbole>) => void
  /** Tourne un symbole de deltaDeg degrés (un cran d'undo, normalisé 0..360). */
  tournerSymbole: (symboleId: string, deltaDeg: number) => void
  ajouterNiveau: () => void
  renommerNiveau: (niveauId: string, name: string) => void
  /** Copie profonde d'un niveau (nouveaux ids partout). Retourne le nom créé, ou null. */
  dupliquerNiveau: (niveauId: string) => string | null
}

export function usePlanState(initial: PlanData): PlanStateApi {
  const [data, setData] = useState<PlanData>(initial)
  const [version, setVersion] = useState(0)
  const [niveauId, setNiveauId] = useState<string>(initial.levels[0]?.id ?? '')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null)
  const [selectedFenceId, setSelectedFenceId] = useState<string | null>(null)
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

  const symboleSelectionne = useMemo<Symbole | null>(() => {
    if (!selectedSymbolId) return null
    return niveau.symbols.find((s) => s.id === selectedSymbolId) ?? null
  }, [niveau, selectedSymbolId])

  const clotureSelectionnee = useMemo<Cloture | null>(() => {
    if (!selectedFenceId) return null
    return niveau.clotures.find((c) => c.id === selectedFenceId) ?? null
  }, [niveau, selectedFenceId])

  /** Sélections exclusives : une pièce OU un symbole OU une clôture. */
  const selectRoom = useCallback((id: string | null) => {
    setSelectedRoomId(id)
    setSelectedSymbolId(null)
    setSelectedFenceId(null)
  }, [])

  const selectSymbol = useCallback((id: string | null) => {
    setSelectedSymbolId(id)
    if (id) {
      setSelectedRoomId(null)
      setSelectedFenceId(null)
    }
  }, [])

  const selectFence = useCallback((id: string | null) => {
    setSelectedFenceId(id)
    if (id) {
      setSelectedRoomId(null)
      setSelectedSymbolId(null)
    }
  }, [])

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
    [muter, surNiveau, selectRoom]
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
    (roomId: string, dim: 'w' | 'h', mm: number): ResultatCote => {
      const nivActuel = dataRef.current.levels.find((n) => n.id === niveauId)
      const piece = nivActuel?.rooms.find((r) => r.id === roomId)
      if (!piece) return { ok: false, message: 'Pièce introuvable' }
      const nouvelle = redimensionnerParCote(piece, dim, mm)
      if (!nouvelle) {
        return {
          ok: false,
          message: 'Dimension invalide',
          description: 'Saisissez entre 0,5 et 30 m.',
        }
      }
      // Les ouvertures sont RECALÉES, jamais effacées : si le mur devient plus
      // court que la porte qu'il porte, on refuse et on le dit (avant, la porte
      // disparaissait en silence).
      const recale = recalerOuvertures(nouvelle)
      if ('erreur' in recale) {
        return { ok: false, message: 'Mur trop court', description: recale.erreur }
      }
      muter((copie) => {
        const niv = surNiveau(copie)
        if (!niv) return
        const i = niv.rooms.findIndex((r) => r.id === roomId)
        if (i >= 0) niv.rooms[i] = recale.piece
      })
      // Une ouverture qui a glissé, on le DIT. Sinon on remplacerait une
      // suppression silencieuse par un déplacement silencieux : même famille.
      if (recale.recalees > 0) {
        return {
          ok: true,
          info:
            recale.recalees === 1
              ? 'Une ouverture a été recalée pour rester sur son mur.'
              : `${recale.recalees} ouvertures ont été recalées pour rester sur leur mur.`,
        }
      }
      return { ok: true }
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
        // Les symboles de la pièce restent posés mais perdent leur rattachement.
        for (const s of niv.symbols) {
          if (s.roomId === roomId) s.roomId = null
        }
      })
      selectRoom(null)
      return piece
    },
    [muter, surNiveau, niveauId, selectRoom]
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
        // Push 7 : une pièce dupliquée est du travail NEUF — l'avancement repart à zéro.
        avancement: undefined,
        avancementLe: undefined,
        avancementPar: undefined,
        avancementParId: undefined,
      }
      muter((c) => {
        const niv = surNiveau(c)
        if (niv) niv.rooms.push(copie)
      })
      selectRoom(copie.id)
    },
    [muter, surNiveau, niveauId, selectRoom]
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
    [muter, surNiveau, selectRoom]
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

  const ajouterSymbole = useCallback(
    (symbole: Symbole) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (niv) niv.symbols.push(symbole)
      })
    },
    [muter, surNiveau]
  )

  const supprimerSymbole = useCallback(
    (symboleId: string) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (niv) niv.symbols = niv.symbols.filter((s) => s.id !== symboleId)
      })
      setSelectedSymbolId((id) => (id === symboleId ? null : id))
    },
    [muter, surNiveau]
  )

  const ajouterCloture = useCallback(
    (cloture: Cloture) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (niv) niv.clotures.push(cloture)
      })
      selectFence(cloture.id)
    },
    [muter, surNiveau, selectFence]
  )

  const supprimerCloture = useCallback(
    (clotureId: string) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        if (niv) niv.clotures = niv.clotures.filter((c) => c.id !== clotureId)
      })
      setSelectedFenceId((id) => (id === clotureId ? null : id))
    },
    [muter, surNiveau]
  )

  const deplacerSymboleSansUndo = useCallback(
    (symboleId: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return
      const copie = clone(dataRef.current)
      const niv = surNiveau(copie)
      const s = niv?.symbols.find((x) => x.id === symboleId)
      if (!s) return
      s.position = [Math.round(s.position[0] + dx), Math.round(s.position[1] + dy)]
      commit(copie)
    },
    [surNiveau, commit]
  )

  const majSymboleSansUndo = useCallback(
    (symboleId: string, patch: Partial<Symbole>) => {
      const copie = clone(dataRef.current)
      const niv = surNiveau(copie)
      const i = niv ? niv.symbols.findIndex((x) => x.id === symboleId) : -1
      if (!niv || i < 0) return
      niv.symbols[i] = { ...niv.symbols[i], ...patch }
      commit(copie)
    },
    [surNiveau, commit]
  )

  // Push 8 — rotation d'un symbole (orientation sur le plan), un cran d'undo.
  // Normalisé dans [0, 360). La rotation est déjà appliquée en 2D (SymboleSvg)
  // et en 3D pour les symboles de sol (iso.ts).
  const tournerSymbole = useCallback(
    (symboleId: string, deltaDeg: number) => {
      muter((copie) => {
        const niv = surNiveau(copie)
        const s = niv?.symbols.find((x) => x.id === symboleId)
        if (!s) return
        s.rotation = (((Math.round((s.rotation || 0) + deltaDeg)) % 360) + 360) % 360
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

  /**
   * Push 5 — Duplication d'un niveau : copie PROFONDE (rooms, ouvertures,
   * clôtures, symboles) avec de NOUVEAUX ids partout et remappage des
   * références internes :
   *  - `sharedWith` d'une ouverture -> id de la pièce COPIÉE ; si la référence
   *    pointe hors du niveau copié (pièce inconnue), elle est nettoyée (null) ;
   *  - `roomId` d'un symbole -> id de la pièce copiée (null si inconnue).
   * Un seul cran d'undo (muter), le niveau copié devient actif.
   */
  const dupliquerNiveau = useCallback(
    (id: string): string | null => {
      const src = dataRef.current.levels.find((n) => n.id === id)
      if (!src) return null
      const noms = dataRef.current.levels.map((n) => n.name)
      const nouveauNom = nomAvecSuffixe(src.name + ' (copie)', noms)
      const idsPieces = new Map<string, string>()
      for (const r of src.rooms) idsPieces.set(r.id, genId())
      const rooms: Piece[] = src.rooms.map((r) => ({
        ...r,
        id: idsPieces.get(r.id) as string,
        vertices: r.vertices.map((p): PointMm => [p[0], p[1]]),
        openings: r.openings.map((o) => ({
          ...o,
          id: genId(),
          sharedWith: o.sharedWith ? idsPieces.get(o.sharedWith) ?? null : null,
        })),
        // Push 7 : niveau dupliqué = nouveau chantier → avancement remis à zéro.
        avancement: undefined,
        avancementLe: undefined,
        avancementPar: undefined,
        avancementParId: undefined,
      }))
      const clotures: Cloture[] = src.clotures.map((c) => ({
        ...c,
        id: genId(),
        points: c.points.map((p): PointMm => [p[0], p[1]]),
      }))
      const symbols: Symbole[] = src.symbols.map((s) => ({
        ...s,
        id: genId(),
        position: [s.position[0], s.position[1]] as PointMm,
        roomId: s.roomId ? idsPieces.get(s.roomId) ?? null : null,
      }))
      const ordreMax = dataRef.current.levels.reduce((m, n) => Math.max(m, n.order), -1)
      const nouveau: Niveau = {
        id: genId(),
        name: nouveauNom,
        order: ordreMax + 1,
        heightDefault: src.heightDefault,
        rooms,
        clotures,
        symbols,
      }
      muter((copie) => {
        copie.levels.push(nouveau)
      })
      setNiveauId(nouveau.id)
      selectRoom(null)
      return nouveauNom
    },
    [muter, selectRoom]
  )

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

  const changerNiveau = useCallback(
    (id: string) => {
      setNiveauId(id)
      selectRoom(null)
    },
    [selectRoom]
  )

  return {
    data,
    version,
    niveau,
    niveauId: niveau.id,
    setNiveauId: changerNiveau,
    selectedRoomId,
    selectRoom,
    pieceSelectionnee,
    selectedSymbolId,
    selectSymbol,
    symboleSelectionne,
    selectedFenceId,
    selectFence,
    clotureSelectionnee,
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
    ajouterSymbole,
    supprimerSymbole,
    ajouterCloture,
    supprimerCloture,
    deplacerSymboleSansUndo,
    majSymboleSansUndo,
    tournerSymbole,
    ajouterNiveau,
    renommerNiveau,
    dupliquerNiveau,
  }
}
