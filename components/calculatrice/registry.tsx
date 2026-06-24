'use client'

// ---------------------------------------------------------------------------
// Registre des calculatrices : id, libelle, icone, metiers concernes, composant.
// Sert a (1) afficher la grille, (2) pre-cocher selon le metier de l'artisan.
// ---------------------------------------------------------------------------

import React from 'react'
import { Percent, Clock, Layers, Grid3x3, Home, Paintbrush, Cable, Flame, Sprout } from 'lucide-react'
import { CalcTva, CalcTauxHoraire } from './CalcUniversel'
import { CalcBeton, CalcCarrelage, CalcToiture } from './CalcGrosOeuvre'
import { CalcPeinture, CalcCable, CalcChauffage } from './CalcSecondOeuvre'
import { CalcSableGazon } from './CalcPaysagiste'

export interface CalcDef {
  id: string
  label: string
  icon: React.ElementType
  universal: boolean
  /** Mots-cles metier (en minuscule, sans accent) qui pre-cochent la calculatrice. */
  metiers: string[]
  Component: React.FC
}

export const CALCULATRICES: CalcDef[] = [
  { id: 'tva', label: 'TVA travaux', icon: Percent, universal: true, metiers: [], Component: CalcTva },
  { id: 'taux-horaire', label: 'Taux horaire', icon: Clock, universal: true, metiers: [], Component: CalcTauxHoraire },
  { id: 'beton', label: 'Beton & ciment', icon: Layers, universal: false, metiers: ['macon', 'maconnerie', 'terrassier', 'paysagiste'], Component: CalcBeton },
  { id: 'carrelage', label: 'Carrelage', icon: Grid3x3, universal: false, metiers: ['carreleur'], Component: CalcCarrelage },
  { id: 'toiture', label: 'Toiture (pente)', icon: Home, universal: false, metiers: ['couvreur', 'charpentier'], Component: CalcToiture },
  { id: 'peinture', label: 'Peinture', icon: Paintbrush, universal: false, metiers: ['peintre', 'plaquiste'], Component: CalcPeinture },
  { id: 'cable', label: 'Section de cable', icon: Cable, universal: false, metiers: ['electricien'], Component: CalcCable },
  { id: 'chauffage', label: 'Puissance chauffage', icon: Flame, universal: false, metiers: ['chauffagiste', 'plombier'], Component: CalcChauffage },
  { id: 'sable-gazon', label: 'Sable gazon synthetique', icon: Sprout, universal: false, metiers: ['paysagiste'], Component: CalcSableGazon },
]

// Regex de suppression des accents (diacritiques U+0300..U+036F) ecrite en pur
// ASCII via le constructeur RegExp -> aucun caractere non-ASCII dans le source.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Normalise une chaine metier (minuscule, sans accent) pour la comparaison. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '')
}

/**
 * Selection par defaut : les universelles + celles qui correspondent au metier.
 * Si le metier est inconnu, on ne propose que les universelles.
 */
export function defaultSelection(metier: string | null | undefined): string[] {
  const m = metier ? normalize(metier) : ''
  return CALCULATRICES.filter(
    (c) => c.universal || (m && c.metiers.some((k) => m.includes(k))),
  ).map((c) => c.id)
}
