'use client'

/**
 * PlanEditor — Orchestrateur de l'éditeur de plan 2D (Push 2 → 3b).
 * Topbar (+ vue métier + CTA devis) + palette filtrée par profil + canvas +
 * panneau pièce (RoomSheet + MetresPanel) / symbole (SymboleSheet) / clôture
 * (ClotureSheet) + modale d'ajout + tiroir devis (DevisDrawer) + surcouches
 * (PlanOverlays) + raccourcis.
 *
 * Push 3b : injection devis (tiroir append-only), groupe Extérieur (zones
 * cat 'ext', clôture polyligne ouverte, portail projeté sur la clôture),
 * m1 (un symbole hérite du CALQUE DE LA PIÈCE cliquée, plus du toggle de
 * vue), mode de déduction peinture + chutes remontés ici (panneau et tiroir
 * appliquent les mêmes règles).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ModeDeduction, PlanData, PointMm, TypeOuverture } from '@/lib/plan/types'
import { aireMm2, estDansPolygone, fmtNombreFr, fmtSurfaceM2 } from '@/lib/plan/geometry'
import { OUVERTURE_DEFAUTS, creerCloture, creerPieceL, creerPiecePoly, creerPieceRect, nomAvecSuffixe } from '@/lib/plan/defaults'
import { positionNouvellePiece, preparerOuverture, projeterSurClotures } from '@/lib/plan/edition'
import { clotureMl } from '@/lib/plan/metrics'
import { CHUTES_DEFAUT_PCT, profilDe, type MetierId } from '@/lib/plan/profils'
import { creerSymbole } from '@/lib/plan/symboles'
import { toast } from '@/lib/toast'
import { usePlanState } from './usePlanState'
import { useAutosave } from './useAutosave'
import { usePlanShortcuts } from './usePlanShortcuts'
import PlanTopbar from './PlanTopbar'
import PlanCanvas, { type Outil, type PolygoneEnCours } from './PlanCanvas'
import PlanPalette from './PlanPalette'
import PlanOverlays from './PlanOverlays'
import RoomSheet from './RoomSheet'
import MetresPanel from './MetresPanel'
import SymboleSheet from './SymboleSheet'
import ClotureSheet from './ClotureSheet'
import DevisDrawer, { type PreSelection } from './DevisDrawer'
import AddRoomModal, { type DemandePiece } from './AddRoomModal'
import type { VueCalque } from './PlanRender'

export interface PlanEditorProps {
  planId: string
  nomInitial: string
  dataInitiale: PlanData
  /** Vue métier mémorisée du plan (plans.metier_defaut, 'tce' si null). */
  metierInitial: MetierId
  /** Chantier de rattachement (devis cibles du tiroir d'injection). */
  chantierId: string | null
  retourHref: string
}

export default function PlanEditor({ planId, nomInitial, dataInitiale, metierInitial, chantierId, retourHref }: PlanEditorProps) {
  const etat = usePlanState(dataInitiale)
  const [nom, setNom] = useState(nomInitial)
  const { statut, flush } = useAutosave(planId, nom, etat.data, etat.version)
  const [vue, setVue] = useState<VueCalque>('tout')
  const [metier, setMetier] = useState<MetierId>(profilDe(metierInitial).id)
  const [outil, setOutil] = useState<Outil>('select')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [typeInitial, setTypeInitial] = useState<string | null>(null)
  const [polygone, setPolygone] = useState<PolygoneEnCours | null>(null)
  const [annulation, setAnnulation] = useState<{ nom: string; baseVersion: number } | null>(null)
  const annulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Push 3b — réglages de métré partagés panneau/tiroir + tiroir devis.
  const [modePeinture, setModePeinture] = useState<ModeDeduction>(profilDe('peintre').deductionDefaut)
  const [chutes, setChutes] = useState<string>(String(CHUTES_DEFAUT_PCT))
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  const [preSelection, setPreSelection] = useState<PreSelection | null>(null)

  /** Coefficient de chutes numérique sûr (même garde-fou que le panneau). */
  const chutesBrut = Number(chutes.replace(',', '.').trim())
  const chutesPct = Number.isFinite(chutesBrut) && chutesBrut >= 0 && chutesBrut <= 100 ? chutesBrut : CHUTES_DEFAUT_PCT

  const ouvrirTiroir = useCallback((sel: PreSelection | null) => {
    flush() // le snapshot 'devis_envoye' doit refléter le plan sauvegardé
    setPreSelection(sel)
    setTiroirOuvert(true)
  }, [flush])

  // ── Vue métier : refiltre palette + panneau, mémorisée PAR PLAN ───────────
  const changerMetier = useCallback(
    (m: MetierId) => {
      setMetier(m)
      // L'outil symbole actif peut ne plus exister dans la nouvelle vue
      // (le portail, groupe Extérieur, reste disponible pour tous les profils).
      setOutil((o) =>
        o.startsWith('sym:') && o !== 'sym:portail' && !profilDe(m).symboles.includes(o.slice(4)) ? 'select' : o
      )
      // Persistance best effort (RLS user_id = auth.uid() côté Supabase).
      const persister = async () => {
        try {
          const supabase = createClient()
          const { data: auth } = await supabase.auth.getUser()
          if (!auth.user) return
          const { error } = await supabase
            .from('plans')
            .update({ metier_defaut: m })
            .eq('id', planId)
            .eq('user_id', auth.user.id)
          if (error) throw new Error(error.message)
        } catch (_e) {
          console.error('[plan] vue métier non enregistrée')
        }
      }
      void persister()
    },
    [planId]
  )

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
    if (etat.symboleSelectionne) {
      etat.supprimerSymbole(etat.symboleSelectionne.id)
      return
    }
    if (etat.clotureSelectionnee) {
      etat.supprimerCloture(etat.clotureSelectionnee.id)
      toast.success('Clôture supprimée', { description: 'Ctrl+Z pour annuler.' })
      return
    }
    if (!etat.pieceSelectionnee) return
    const base = etat.version
    const piece = etat.supprimerPiece(etat.pieceSelectionnee.id)
    if (!piece) return
    setAnnulation({ nom: piece.name, baseVersion: base })
    if (annulationTimer.current) clearTimeout(annulationTimer.current)
    annulationTimer.current = setTimeout(() => setAnnulation(null), 8000)
  }, [etat])

  // ── Raccourcis clavier (hook extrait, comportement inchangé) ──────────────
  usePlanShortcuts({
    actif: !tiroirOuvert && !modalOuverte,
    outilActif: outil !== 'select',
    traceEnCours: polygone !== null,
    peutSupprimer: Boolean(etat.pieceSelectionnee || etat.symboleSelectionne || etat.clotureSelectionnee),
    onUndo: etat.undo,
    onRedo: etat.redo,
    onOutilSelect: useCallback(() => setOutil('select'), []),
    onSupprimer: supprimerSelection,
  })

  // ── Ajout de pièce / zone extérieure (modale) ─────────────────────────────
  const ouvrirModal = (type: string | null) => {
    setTypeInitial(type)
    setModalOuverte(true)
  }

  const validerAjout = (demande: DemandePiece) => {
    setModalOuverte(false)
    const noms = etat.niveau.rooms.map((r) => r.name)
    const nomPiece = nomAvecSuffixe(demande.nom, noms)
    if (demande.forme === 'poly') {
      setOutil('select')
      etat.selectRoom(null)
      setPolygone({ nom: nomPiece, calque: demande.calque, mode: 'piece' })
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

  // ── Clôture : polyligne OUVERTE (réutilise le mécanisme polygone) ─────────
  const demarrerCloture = () => {
    setOutil('select')
    etat.selectRoom(null)
    setPolygone({ nom: 'Clôture', calque: vue === 'projet' ? 'projet' : 'existant', mode: 'cloture' })
    toast.info('Tracez la clôture sur le plan', {
      description: 'Cliquez les points le long de la parcelle — double-clic pour terminer.',
    })
  }

  const terminerPolygone = (points: PointMm[]) => {
    const p = polygone
    setPolygone(null)
    if (!p) return
    if (p.mode === 'cloture') {
      if (points.length < 2) {
        toast.warning('Il faut au moins 2 points pour tracer une clôture.')
        return
      }
      const cloture = creerCloture(p.calque, points)
      etat.ajouterCloture(cloture)
      toast.success(`Clôture tracée — ${fmtNombreFr(clotureMl(cloture))} ml calculés sur la polyligne.`)
      return
    }
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

  // ── Cotes + ouvertures + symboles ─────────────────────────────────────────
  const editerCote = (roomId: string, dim: 'w' | 'h', mm: number) => {
    if (!etat.redimensionner(roomId, dim, mm)) {
      toast.warning('Dimension invalide', { description: 'Saisissez entre 0,5 et 30 m.' })
    }
  }

  const poserOuverture = (roomId: string, point: PointMm, type: TypeOuverture) => {
    const piece = etat.niveau.rooms.find((r) => r.id === roomId)
    if (!piece) return
    if (piece.cat === 'ext') {
      toast.warning('Pas d’ouverture sur une zone extérieure', { description: 'Terrasses, piscines et pelouses n’ont pas de murs.' })
      return
    }
    const resultat = preparerOuverture(piece, point, type)
    if ('erreur' in resultat) {
      toast.warning(resultat.erreur)
      return
    }
    etat.ajouterOuverture(roomId, resultat.ouverture)
    toast.success(`${OUVERTURE_DEFAUTS[type].label} posée sur ${piece.name}`)
  }

  /**
   * Pose en série (l'outil RESTE actif, Échap pour revenir à la sélection).
   * m1 (audit 3a) : le symbole hérite du CALQUE DE LA PIÈCE cliquée, plus du
   * toggle de vue. Portail : projeté sur la clôture la plus proche, hérite du
   * calque de la clôture, tourné le long du segment.
   */
  const poserSymbole = (type: string, point: PointMm, roomId: string | null) => {
    if (type === 'portail') {
      if (etat.niveau.clotures.length === 0) {
        toast.warning('Tracez d’abord une clôture', { description: 'Le portail se pose sur une clôture (palette Extérieur).' })
        return
      }
      const proj = projeterSurClotures(etat.niveau.clotures, point)
      if (!proj) {
        toast.warning('Cliquez plus près d’une clôture pour poser le portail.')
        return
      }
      etat.ajouterSymbole({ ...creerSymbole('portail', proj.layer, proj.position, null), rotation: proj.rotation })
      return
    }
    if (!roomId) {
      toast.warning("Cliquez à l'intérieur d'une pièce pour poser le symbole.")
      return
    }
    const piece = etat.niveau.rooms.find((r) => r.id === roomId)
    if (piece?.cat === 'ext') {
      toast.warning('Les symboles se posent dans les pièces intérieures.')
      return
    }
    etat.ajouterSymbole(creerSymbole(type, piece?.layer ?? 'existant', point, roomId))
  }

  /** Fin de drag : réaffecte le symbole à la pièce qui le contient. */
  const finDeplacerSymbole = (symboleId: string) => {
    const s = etat.niveau.symbols.find((x) => x.id === symboleId)
    if (!s) return
    let roomId: string | null = null
    const rooms = etat.niveau.rooms
    for (let i = rooms.length - 1; i >= 0; i--) {
      if (estDansPolygone(s.position, rooms[i].vertices)) {
        roomId = rooms[i].id
        break
      }
    }
    if ((s.roomId ?? null) !== roomId) etat.majSymboleSansUndo(symboleId, { roomId })
  }

  const niveauVide = etat.niveau.rooms.length === 0
  const symbolesPiece = etat.pieceSelectionnee
    ? etat.niveau.symbols.filter((s) => s.roomId === etat.pieceSelectionnee!.id)
    : []
  const pieceDuSymbole = etat.symboleSelectionne?.roomId
    ? etat.niveau.rooms.find((r) => r.id === etat.symboleSelectionne!.roomId) ?? null
    : null

  return (
    <div className="flex h-full flex-col bg-white">
      <PlanTopbar
        nom={nom}
        onRenommer={setNom}
        statut={statut}
        retourHref={retourHref}
        onRetour={flush}
        niveaux={etat.data.levels}
        niveauId={etat.niveauId}
        onNiveau={etat.setNiveauId}
        onAjouterNiveau={etat.ajouterNiveau}
        onRenommerNiveau={etat.renommerNiveau}
        vue={vue}
        onVue={setVue}
        metier={metier}
        onMetier={changerMetier}
        canUndo={etat.canUndo}
        canRedo={etat.canRedo}
        onUndo={etat.undo}
        onRedo={etat.redo}
        onEnvoyerDevis={() => ouvrirTiroir(null)}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Palette gauche à libellés, filtrée par la vue métier (desktop) */}
        <PlanPalette
          metier={metier}
          outil={outil}
          onOutil={setOutil}
          onAjouterPiece={() => ouvrirModal(null)}
          onZoneExt={(nomZone) => ouvrirModal(nomZone)}
          onCloture={demarrerCloture}
        />

        {/* Canvas + surcouches */}
        <div className="relative min-w-0 flex-1">
          <PlanCanvas
            niveau={etat.niveau}
            vue={vue}
            outil={outil}
            selectedRoomId={etat.selectedRoomId}
            selectedSymbolId={etat.selectedSymbolId}
            selectedFenceId={etat.selectedFenceId}
            polygone={polygone}
            onSelectRoom={etat.selectRoom}
            onSelectSymbol={etat.selectSymbol}
            onSelectFence={etat.selectFence}
            onDebutGeste={etat.debutGeste}
            onDeplacerPiece={etat.deplacerPieceSansUndo}
            onCote={editerCote}
            onPoserOuverture={poserOuverture}
            onPoserSymbole={poserSymbole}
            onDeplacerSymbole={etat.deplacerSymboleSansUndo}
            onFinDeplacerSymbole={finDeplacerSymbole}
            onPolygoneTermine={terminerPolygone}
            onPolygoneAnnule={() => setPolygone(null)}
          />

          <PlanOverlays
            metier={metier}
            outil={outil}
            onOutil={setOutil}
            onCloture={demarrerCloture}
            polygone={polygone}
            onAnnulerPolygone={() => setPolygone(null)}
            niveauVide={niveauVide}
            onAjouterPiece={() => ouvrirModal(null)}
            annulation={annulation}
            onAnnulerSuppression={() => {
              setAnnulation(null)
              etat.undo()
            }}
          />
        </div>

        {/* Panneau droit : pièce (RoomSheet + métrés), symbole ou clôture */}
        {(etat.pieceSelectionnee || etat.symboleSelectionne || etat.clotureSelectionnee) && (
          <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[48%] overflow-hidden rounded-t-2xl border-t border-gray-200 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:flex-shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
            {etat.pieceSelectionnee ? (
              <RoomSheet
                piece={etat.pieceSelectionnee}
                onMaj={(patch) => etat.majPiece(etat.pieceSelectionnee!.id, patch)}
                onDupliquer={() => etat.dupliquerPiece(etat.pieceSelectionnee!.id)}
                onSupprimer={supprimerSelection}
                onSupprimerOuverture={(oid) => etat.supprimerOuverture(etat.pieceSelectionnee!.id, oid)}
                onFermer={() => etat.selectRoom(null)}
              >
                <MetresPanel
                  piece={etat.pieceSelectionnee}
                  symboles={symbolesPiece}
                  metier={metier}
                  niveau={etat.niveau}
                  modePeinture={modePeinture}
                  onModePeinture={setModePeinture}
                  chutes={chutes}
                  onChutes={setChutes}
                  onEnvoyer={(sel) => ouvrirTiroir(sel)}
                />
              </RoomSheet>
            ) : etat.symboleSelectionne ? (
              <SymboleSheet
                symbole={etat.symboleSelectionne}
                piece={pieceDuSymbole}
                onSupprimer={supprimerSelection}
                onFermer={() => etat.selectSymbol(null)}
              />
            ) : etat.clotureSelectionnee ? (
              <ClotureSheet
                cloture={etat.clotureSelectionnee}
                onEnvoyerDevis={() => ouvrirTiroir({ metric: 'cloture_ml', roomId: etat.clotureSelectionnee!.id })}
                onSupprimer={supprimerSelection}
                onFermer={() => etat.selectFence(null)}
              />
            ) : null}
          </aside>
        )}
      </div>

      <AddRoomModal
        open={modalOuverte}
        calqueParDefaut={vue === 'projet' ? 'projet' : 'existant'}
        typeInitial={typeInitial}
        onValider={validerAjout}
        onFermer={() => setModalOuverte(false)}
      />

      <DevisDrawer
        open={tiroirOuvert}
        onClose={() => setTiroirOuvert(false)}
        planId={planId}
        chantierId={chantierId}
        niveau={etat.niveau}
        data={etat.data}
        metier={metier}
        modePeinture={modePeinture}
        chutesPct={chutesPct}
        preSelection={preSelection}
      />
    </div>
  )
}
