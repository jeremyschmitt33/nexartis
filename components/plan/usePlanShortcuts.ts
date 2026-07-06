'use client'

/**
 * usePlanShortcuts — Raccourcis clavier de l'éditeur de plan (Push 3b).
 * Extrait de PlanEditor (limite 450 lignes), comportement inchangé :
 * Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (undo/redo), Échap (retour sélection quand
 * un outil est actif hors tracé), Suppr/Retour (supprime la sélection).
 * Inactif quand le tiroir devis ou la modale d'ajout sont ouverts.
 */

import { useEffect } from 'react'

export interface PlanShortcutsOptions {
  /** false = tiroir/modale ouverts : aucun raccourci ne s'applique. */
  actif: boolean
  outilActif: boolean
  traceEnCours: boolean
  peutSupprimer: boolean
  onUndo: () => void
  onRedo: () => void
  onOutilSelect: () => void
  onSupprimer: () => void
}

export function usePlanShortcuts({
  actif,
  outilActif,
  traceEnCours,
  peutSupprimer,
  onUndo,
  onRedo,
  onOutilSelect,
  onSupprimer,
}: PlanShortcutsOptions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!actif) return
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        onRedo()
        return
      }
      if (e.key === 'Escape' && outilActif && !traceEnCours) {
        onOutilSelect()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && peutSupprimer) {
        e.preventDefault()
        onSupprimer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actif, outilActif, traceEnCours, peutSupprimer, onUndo, onRedo, onOutilSelect, onSupprimer])
}
