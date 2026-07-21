/**
 * Module Plan 2D — Proposition d'injection au devis (Push 3b, 06/07/2026)
 *
 * Fonctions PURES, zéro dépendance React : construisent la liste des métrés
 * proposés dans le tiroir « Envoyer au devis » à partir d'un niveau et de la
 * vue métier courante. Le moteur (lib/plan/metrics) calcule, ici on assemble.
 *
 * RÈGLES (spec V2 §3 + garde-fous §7) :
 * - Append-only : ces lignes sont INSÉRÉES dans le devis, jamais fusionnées.
 * - Chaque ligne porte un couple STABLE (roomId, metric) : c'est la clé
 *   d'anti-doublon (même pièce + même métré = doublon) et la base du lien
 *   vivant `source_plan`. Ne JAMAIS renommer un metric existant.
 * - Quantités arrondies à 2 décimales, prix laissés à 0 : l'artisan chiffre
 *   dans le devis (montants toujours éditables, jamais imposés).
 */

import type { ModeDeduction, Niveau, Piece, Symbole, TypeOuverture } from './types'
import {
  appliquerChutes,
  clotureMl,
  kindDe,
  perimetreMl,
  plinthesMl,
  surfaceMursM2,
  surfacePlafondM2,
  surfaceSolM2,
  volumeExtM3,
  volumeTrancheeM3,
} from './metrics'
import { compteursElec, compteursPlomberie, type MetierId } from './profils'

/** Libellés des lots (groupes du tiroir = futurs intitulés de sections devis). */
export const LOT_PEINTURE = 'Peinture'
export const LOT_CARRELAGE = 'Carrelage / sols'
export const LOT_PLATRERIE = 'Plâtrerie'
export const LOT_ELECTRICITE = 'Électricité'
export const LOT_PLOMBERIE = 'Plomberie'
export const LOT_MENUISERIE = 'Menuiserie'
export const LOT_MACONNERIE = 'Maçonnerie'
export const LOT_CHAUFFAGE = 'Chauffage'
export const LOT_EXTERIEUR = 'Extérieur / Paysagisme'

/** Une ligne de métré proposée dans le tiroir devis. */
export interface LigneProposee {
  /** Clé UI stable : `${metric}:${roomId ?? 'niveau'}`. */
  cle: string
  lot: string
  /** Désignation de la future ligne de devis, ex. « Peinture des murs — Salon ». */
  designation: string
  /** Quantité en unités finales, 2 décimales max. */
  quantite: number
  unite: 'm²' | 'ml' | 'u' | 'm³'
  /** Règle de calcul affichée en sous-texte gris (jamais « conforme »). */
  regle?: string
  /** true si le métré provient du calque Projet (bandeau orange). */
  projet: boolean
  /** Pièce ou clôture source (null = total du niveau, ex. portails). */
  roomId: string | null
  /** Identifiant du métré (source_plan.metric) — STABLE, cf. en-tête. */
  metric: string
}

export interface OptionsProposition {
  /** Mode de déduction murale choisi dans le panneau Peinture. */
  modePeinture: ModeDeduction
  /** Coefficient de chutes carrelage en % (toujours visible/éditable). */
  chutesPct: number
}

const DESC_MODE: Record<ModeDeduction, string> = {
  brute: 'aucune ouverture déduite',
  totale: 'toutes les ouvertures déduites',
  sup05: 'ouvertures > 0,5 m² déduites',
  sup25: 'ouvertures > 2,5 m² déduites',
}

const arrondi2 = (v: number) => Math.round(v * 100) / 100

function ligne(
  lot: string,
  metric: string,
  roomId: string | null,
  designation: string,
  quantite: number,
  unite: LigneProposee['unite'],
  projet: boolean,
  regle?: string
): LigneProposee {
  return {
    cle: `${metric}:${roomId ?? 'niveau'}`,
    lot,
    designation,
    quantite: arrondi2(quantite),
    unite,
    projet,
    roomId,
    metric,
    ...(regle ? { regle } : {}),
  }
}

/* ── Lots intérieurs (une ligne par pièce et par métré non nul) ───────────── */

function lotPeinture(piece: Piece, mode: ModeDeduction): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const out: LigneProposee[] = []
  const murs = surfaceMursM2(piece, mode)
  if (murs > 0) out.push(ligne(LOT_PEINTURE, 'murs', piece.id, `Peinture des murs — ${piece.name}`, murs, 'm²', projet, DESC_MODE[mode]))
  const plafond = surfacePlafondM2(piece)
  if (plafond > 0) out.push(ligne(LOT_PEINTURE, 'plafond', piece.id, `Peinture du plafond — ${piece.name}`, plafond, 'm²', projet))
  const plinthes = plinthesMl(piece)
  if (plinthes > 0) out.push(ligne(LOT_PEINTURE, 'plinthes', piece.id, `Peinture des plinthes — ${piece.name}`, plinthes, 'ml', projet, 'périmètre − ouvertures au sol'))
  return out
}

function lotCarrelage(piece: Piece, chutesPct: number): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const out: LigneProposee[] = []
  const sol = surfaceSolM2(piece)
  if (sol > 0) {
    out.push(
      ligne(LOT_CARRELAGE, 'sol_chutes', piece.id, `Carrelage sol — ${piece.name}`, appliquerChutes(sol, chutesPct), 'm²', projet, `sol ${sol.toFixed(2).replace('.', ',')} m² + ${chutesPct.toFixed(0)} % de chutes`)
    )
  }
  const plinthes = plinthesMl(piece)
  if (plinthes > 0) out.push(ligne(LOT_CARRELAGE, 'plinthes_carrelage', piece.id, `Plinthes carrelées — ${piece.name}`, plinthes, 'ml', projet))
  return out
}

function lotPlatrerie(piece: Piece): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const out: LigneProposee[] = []
  const murs = surfaceMursM2(piece, 'sup25')
  if (murs > 0) out.push(ligne(LOT_PLATRERIE, 'murs_sup25', piece.id, `Doublage des murs — ${piece.name}`, murs, 'm²', projet, DESC_MODE.sup25))
  const plafond = surfacePlafondM2(piece)
  if (plafond > 0) out.push(ligne(LOT_PLATRERIE, 'plafond_plaque', piece.id, `Plafond plaque — ${piece.name}`, plafond, 'm²', projet))
  return out
}

function lotElectricite(piece: Piece, symbolesPiece: Symbole[]): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const c = compteursElec(symbolesPiece)
  const out: LigneProposee[] = []
  if (c.prises > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_prises', piece.id, `Prises courant fort — ${piece.name}`, c.prises, 'u', projet, '16 A, doubles, 32 A'))
  if (c.commandes > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_commandes', piece.id, `Commandes d'éclairage — ${piece.name}`, c.commandes, 'u', projet, 'interrupteurs + va-et-vient'))
  if (c.lumieres > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_lumieres', piece.id, `Points lumineux — ${piece.name}`, c.lumieres, 'u', projet, 'DCL + appliques'))
  if (c.courantFaible > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_cf', piece.id, `Prises courant faible — ${piece.name}`, c.courantFaible, 'u', projet, 'RJ45 + TV'))
  if (c.autres > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_autres', piece.id, `Autres équipements — ${piece.name}`, c.autres, 'u', projet, 'VMC + sorties de câble'))
  if (c.tableaux > 0) out.push(ligne(LOT_ELECTRICITE, 'elec_tableau', piece.id, `Tableau électrique — ${piece.name}`, c.tableaux, 'u', projet))
  return out
}

function lotPlomberie(piece: Piece, symbolesPiece: Symbole[]): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const c = compteursPlomberie(symbolesPiece)
  if (c.pointsEau === 0) return []
  return [
    ligne(LOT_PLOMBERIE, 'eau_points', piece.id, `Alimentation point d'eau — ${piece.name}`, c.pointsEau, 'u', projet, 'WC, lavabo, douche, baignoire…'),
  ]
}

/* ── Lot Chauffage : radiateurs posés (u) + plancher chauffant (m²) ────────── */

function lotChauffage(piece: Piece, symbolesPiece: Symbole[]): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const out: LigneProposee[] = []
  const radiateurs = symbolesPiece.filter((s) => s.type === 'radiateur').length
  if (radiateurs > 0) out.push(ligne(LOT_CHAUFFAGE, 'chauffage_radiateurs', piece.id, `Radiateurs — ${piece.name}`, radiateurs, 'u', projet))
  const sol = surfaceSolM2(piece)
  if (sol > 0) out.push(ligne(LOT_CHAUFFAGE, 'plancher_chauffant', piece.id, `Plancher chauffant — ${piece.name}`, sol, 'm²', projet, 'surface au sol'))
  return out
}

/* ── Lot Maçonnerie : dalle + chape (surface au sol, jamais partagée) ──────── */

/**
 * Dalle et chape, une ligne CHACUNE par pièce intérieure, en m² de surface au
 * sol. On reste en m² (et non m³) TANT qu'aucune épaisseur n'est saisie : le
 * maçon chiffre au m² pour une épaisseur donnée, ou on ajoutera un volume le
 * jour où l'épaisseur sera saisie — jamais une épaisseur devinée.
 *
 * Pas de murs ni de semelles ici : par pièce, un mur mitoyen serait compté deux
 * fois. Ces métrés-là exigent le CONTOUR du bâtiment (à venir).
 */
function lotMaconnerie(piece: Piece): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const sol = surfaceSolM2(piece)
  if (sol <= 0) return []
  return [
    ligne(LOT_MACONNERIE, 'dalle_beton', piece.id, `Dalle béton — ${piece.name}`, sol, 'm²', projet, 'surface au sol'),
    ligne(LOT_MACONNERIE, 'chape', piece.id, `Chape — ${piece.name}`, sol, 'm²', projet, 'surface au sol'),
  ]
}

/* ── Lot Menuiserie : portes / fenêtres déjà dessinées, une ligne par ouvrant ─ */

/** Libellés des ouvrants (mêmes termes que la palette d'outils). */
const LABELS_OUV: Record<TypeOuverture, string> = {
  porte: 'Porte',
  fenetre: 'Fenêtre',
  porte_fenetre: 'Porte-fenêtre',
  baie: 'Baie vitrée',
}

/**
 * Une ligne PAR ouvrant, avec ses dimensions RÉELLES (largeur × hauteur saisies,
 * jamais devinées) : le menuisier chiffre chaque menuiserie à sa taille. Le
 * comptage suit le modèle des ouvertures — une mitoyenne est déclarée UNE fois
 * (portée par une seule pièce), donc jamais comptée deux fois. `metric` inclut
 * l'id de l'ouverture -> clé anti-doublon unique même si deux ouvrants
 * identiques sont dans la même pièce.
 */
function lotMenuiserie(piece: Piece): LigneProposee[] {
  const projet = piece.layer === 'projet'
  const out: LigneProposee[] = []
  for (const o of piece.openings) {
    if (o.width <= 0 || o.height <= 0) continue
    const dims = `${Math.round(o.width)} × ${Math.round(o.height)} mm`
    out.push(
      ligne(
        LOT_MENUISERIE,
        `menuiserie_${o.id}`,
        piece.id,
        `${LABELS_OUV[o.type]} ${dims} — ${piece.name}`,
        1,
        'u',
        projet,
        o.sharedWith ? 'ouverture mitoyenne (comptée une fois)' : dims,
      ),
    )
  }
  return out
}

/* ── Lot Extérieur (toutes vues) : zones, clôtures, portails ──────────────── */

function lotExterieur(niveau: Niveau): LigneProposee[] {
  const out: LigneProposee[] = []
  for (const p of niveau.rooms) {
    if (p.cat !== 'ext') continue
    const projet = p.layer === 'projet'
    const s = surfaceSolM2(p)
    if (s > 0) {
      if (p.extType === 'terrasse') {
        out.push(ligne(LOT_EXTERIEUR, 'ext_terrasse', p.id, `Terrasse — ${p.name}`, s, 'm²', projet))
      } else if (p.extType === 'piscine') {
        out.push(ligne(LOT_EXTERIEUR, 'ext_piscine', p.id, `Piscine — ${p.name}`, s, 'm²', projet, `périmètre ${perimetreMl(p).toFixed(2).replace('.', ',')} ml (margelles)`))
      } else if (p.extType === 'pelouse') {
        out.push(ligne(LOT_EXTERIEUR, 'ext_pelouse', p.id, `Engazonnement / pelouse — ${p.name}`, s, 'm²', projet))
      } else if (p.extType === 'allee') {
        out.push(ligne(LOT_EXTERIEUR, 'ext_allee', p.id, `Allée — ${p.name}`, s, 'm²', projet, 'surface à revêtir (enrobé / béton / pavés — à qualifier)'))
      } else {
        out.push(ligne(LOT_EXTERIEUR, 'ext_autre', p.id, `Zone extérieure — ${p.name}`, s, 'm²', projet))
      }
    }
    // Volume (profondeur saisie) : UNE ligne, l'artisan la qualifie (déblai/béton)
    // et ajuste sur le devis. Jamais deux lignes couplées au même volume.
    const vol = volumeExtM3(p)
    if (vol > 0) {
      const prof = ((p.profondeurMm ?? 0) / 1000).toFixed(2).replace('.', ',')
      out.push(ligne(LOT_EXTERIEUR, 'ext_volume', p.id, `Volume — ${p.name}`, vol, 'm³', projet, `${s.toFixed(2).replace('.', ',')} m² × ${prof} m — à qualifier (déblai / évacuation / grave / béton)`))
    }
  }
  for (const cl of niveau.clotures) {
    const projet = cl.layer === 'projet'
    const ml = clotureMl(cl)
    if (ml <= 0) continue
    const k = kindDe(cl)
    if (k === 'bordure') {
      out.push(ligne(LOT_EXTERIEUR, 'bordure_ml', cl.id, 'Bordure', ml, 'ml', projet, 'longueur de la polyligne tracée'))
    } else if (k === 'tranchee') {
      out.push(ligne(LOT_EXTERIEUR, 'tranchee_ml', cl.id, 'Tranchée', ml, 'ml', projet, 'longueur de la polyligne tracée'))
      const vol = volumeTrancheeM3(cl)
      if (vol > 0) {
        const la = ((cl.largeurMm ?? 0) / 1000).toFixed(2).replace('.', ',')
        const pr = ((cl.profondeurMm ?? 0) / 1000).toFixed(2).replace('.', ',')
        out.push(ligne(LOT_EXTERIEUR, 'tranchee_volume', cl.id, 'Tranchée — volume', vol, 'm³', projet, `${ml.toFixed(2).replace('.', ',')} ml × ${la} × ${pr} m — à qualifier (déblai / béton)`))
      }
    } else {
      out.push(ligne(LOT_EXTERIEUR, 'cloture_ml', cl.id, 'Clôture / grillage', ml, 'ml', projet, 'longueur de la polyligne tracée'))
    }
  }
  const portails = niveau.symbols.filter((s) => s.type === 'portail').length
  if (portails > 0) out.push(ligne(LOT_EXTERIEUR, 'portail_u', null, 'Portail — fourniture et pose', portails, 'u', false))
  return out
}

/* ── Construction complète, filtrée par la vue métier ─────────────────────── */

/**
 * Construit la proposition du tiroir : lots de la vue métier courante
 * (tous les lots en vue « Tous les métrés ») + lot Extérieur (toutes vues).
 * Les symboles orphelins (roomId null) ne sont rattachés à aucune pièce et
 * ne produisent pas de ligne (sauf portails, comptés au niveau).
 */
export function construireProposition(
  niveau: Niveau,
  metier: MetierId,
  opts: OptionsProposition
): LigneProposee[] {
  const interieures = niveau.rooms.filter((r) => r.cat === 'int')
  const symbolesDe = (roomId: string) => niveau.symbols.filter((s) => s.roomId === roomId)
  const tous = metier === 'tce'
  const out: LigneProposee[] = []
  for (const p of interieures) {
    if (tous || metier === 'peintre') out.push(...lotPeinture(p, opts.modePeinture))
    if (tous || metier === 'carreleur_solier') out.push(...lotCarrelage(p, opts.chutesPct))
    if (tous || metier === 'plaquiste') out.push(...lotPlatrerie(p))
    if (tous || metier === 'electricien') out.push(...lotElectricite(p, symbolesDe(p.id)))
    if (tous || metier === 'plombier') out.push(...lotPlomberie(p, symbolesDe(p.id)))
    if (tous || metier === 'menuiserie') out.push(...lotMenuiserie(p))
    if (tous || metier === 'maconnerie') out.push(...lotMaconnerie(p))
    if (tous || metier === 'chauffagiste') out.push(...lotChauffage(p, symbolesDe(p.id)))
  }
  out.push(...lotExterieur(niveau))
  return out
}

/** Clé d'anti-doublon d'une ligne (même pièce + même métré = doublon). */
export function cleDoublon(roomId: string | null, metric: string): string {
  return `${roomId ?? ''}|${metric}`
}
