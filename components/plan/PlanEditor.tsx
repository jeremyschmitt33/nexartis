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
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { EtatAvancement, KindLineaire, ModeDeduction, NatureZone, PlanData, PointMm, TypeOuverture } from '@/lib/plan/types'
import { aireMm2, estDansPolygone, fmtNombreFr, fmtSurfaceM2 } from '@/lib/plan/geometry'
import { OUVERTURE_DEFAUTS, creerCloture, creerPieceL, creerPiecePoly, creerPieceRect, nomAvecSuffixe } from '@/lib/plan/defaults'
import { positionNouvellePiece, preparerOuverture, projeterSurClotures } from '@/lib/plan/edition'
import { clotureMl, kindDe } from '@/lib/plan/metrics'
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
import PlanRecapAvancement from './PlanRecapAvancement'
import type { VueCalque } from './PlanRender'

/**
 * Vraie 3D interactive (Étape 1, 21/07/2026) : chargée dynamiquement SANS SSR —
 * three.js/WebGL n'existe pas côté serveur, un rendu serveur planterait. Elle
 * remplace la vue iso figée derrière le même bouton 3D ; Iso3dView.tsx reste sur
 * le disque comme référence/repli tant que la parité n'est pas validée en prod.
 */
const Scene3dView = dynamic(() => import('./Scene3dView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: '#f6f8fb' }}>
      <p className="font-hanken text-[13px] font-semibold text-gray-500">Chargement de la vue 3D…</p>
    </div>
  ),
})

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
  const { statut, flush, horsLigne } = useAutosave(planId, nom, etat.data, etat.version)
  const [vue, setVue] = useState<VueCalque>('tout')
  const [metier, setMetier] = useState<MetierId>(profilDe(metierInitial).id)
  const [outil, setOutil] = useState<Outil>('select')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [natureModale, setNatureModale] = useState<NatureZone>({ kind: 'piece' })
  const [polygone, setPolygone] = useState<PolygoneEnCours | null>(null)
  const [annulation, setAnnulation] = useState<{ nom: string; baseVersion: number } | null>(null)
  const annulationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Push 3b — réglages de métré partagés panneau/tiroir + tiroir devis.
  const [modePeinture, setModePeinture] = useState<ModeDeduction>(profilDe('peintre').deductionDefaut)
  const [chutes, setChutes] = useState<string>(String(CHUTES_DEFAUT_PCT))
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  const [preSelection, setPreSelection] = useState<PreSelection | null>(null)
  // Push 6 — vue 3D de présentation : surcouche lecture seule au-dessus du
  // canvas (qui reste monté : viewport 2D intact au retour). Palette, panneau,
  // FAB et outils sont masqués ; l'autosave continue (aucune mutation en 3D).
  const [mode3d, setMode3d] = useState(false)

  // Push 7B — auteur du dernier changement d'avancement (indicatif). Id stable
  // (source d'autorité) + nom affiché (cache), récupérés une fois au montage.
  const [utilisateur, setUtilisateur] = useState('')
  const [utilisateurId, setUtilisateurId] = useState('')
  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const u = data.user
        if (!u) return
        const m = u.user_metadata || {}
        const parts = [m.prenom, m.nom].filter((x) => typeof x === 'string' && x.trim())
        const entreprise = typeof m.entreprise === 'string' ? m.entreprise : ''
        setUtilisateur(parts.join(' ').trim() || entreprise || u.email || '')
        setUtilisateurId(u.id)
      })
      .catch(() => console.error('[plan] compte non résolu — avancement marqué sans auteur'))
  }, [])

  /** Coefficient de chutes numérique sûr (même garde-fou que le panneau). */
  const chutesBrut = Number(chutes.replace(',', '.').trim())
  const chutesPct = Number.isFinite(chutesBrut) && chutesBrut >= 0 && chutesBrut <= 100 ? chutesBrut : CHUTES_DEFAUT_PCT

  const ouvrirTiroir = useCallback((sel: PreSelection | null) => {
    flush() // le snapshot 'devis_envoye' doit refléter le plan sauvegardé
    setPreSelection(sel)
    setTiroirOuvert(true)
  }, [flush])

  // ── Push 6 : bascule 2D / 3D ──────────────────────────────────────────────
  const changerMode3d = (v: boolean) => {
    setMode3d(v)
    if (v) {
      // Entrée en 3D : on neutralise tout geste 2D en cours.
      setOutil('select')
      setPolygone(null)
      etat.selectRoom(null)
    }
  }

  // Échap en 3D : retour à la 2D (seul raccourci actif dans ce mode).
  useEffect(() => {
    if (!mode3d) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tiroirOuvert && !modalOuverte) setMode3d(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode3d, tiroirOuvert, modalOuverte])

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

  // ── Push 5 : duplication du niveau actif (copie profonde + toast) ─────────
  const dupliquerNiveau = useCallback(
    (id: string) => {
      const nomCree = etat.dupliquerNiveau(id)
      if (nomCree) {
        toast.success(`Niveau dupliqué — « ${nomCree} »`, { description: 'Ctrl+Z pour annuler.' })
      }
    },
    [etat]
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
  // Push 6 : inactifs en 3D (sauf Échap, géré au-dessus — aucune mutation en 3D).
  usePlanShortcuts({
    actif: !tiroirOuvert && !modalOuverte && !mode3d,
    outilActif: outil !== 'select',
    traceEnCours: polygone !== null,
    peutSupprimer: Boolean(etat.pieceSelectionnee || etat.symboleSelectionne || etat.clotureSelectionnee),
    onUndo: etat.undo,
    onRedo: etat.redo,
    onOutilSelect: useCallback(() => setOutil('select'), []),
    onSupprimer: supprimerSelection,
  })

  // ── Ajout de pièce / zone extérieure (modale) ─────────────────────────────
  const ouvrirModal = (nature: NatureZone) => {
    setNatureModale(nature)
    setModalOuverte(true)
  }

  const validerAjout = (demande: DemandePiece) => {
    // « Ajouter et continuer » : la modale reste ouverte pour enchaîner la
    // pièce suivante au rythme du télémètre.
    if (!demande.continuer) setModalOuverte(false)
    const noms = etat.niveau.rooms.map((r) => r.name)
    const nomPiece = nomAvecSuffixe(demande.nom, noms)
    if (demande.forme === 'poly') {
      setOutil('select')
      etat.selectRoom(null)
      setPolygone({ nom: nomPiece, calque: demande.calque, mode: 'piece', nature: demande.nature })
      toast.info('Dessinez la pièce sur le plan', {
        description: 'Cliquez chaque angle — double-clic ou clic sur le premier point pour fermer.',
      })
      return
    }
    const [x, y] = positionNouvellePiece(etat.niveau)
    const hsp = etat.niveau.heightDefault
    const piece =
      demande.forme === 'L'
        ? creerPieceL(demande.nature, nomPiece, demande.calque, x, y, demande.largeurMm ?? 3500, demande.hauteurMm ?? 3000, hsp)
        : creerPieceRect(demande.nature, nomPiece, demande.calque, x, y, demande.largeurMm ?? 3500, demande.hauteurMm ?? 3000, hsp)
    etat.ajouterPiece(piece)
    toast.success(`${nomPiece} ajoutée — ${fmtSurfaceM2(aireMm2(piece.vertices))}`, {
      description: 'Glissez-la sur le plan pour la positionner.',
    })
  }

  // ── Clôture : polyligne OUVERTE (réutilise le mécanisme polygone) ─────────
  const demarrerLineaire = (kind: KindLineaire) => {
    setOutil('select')
    etat.selectRoom(null)
    const nom = kind === 'bordure' ? 'Bordure' : kind === 'tranchee' ? 'Tranchée' : 'Clôture'
    const article = kind === 'bordure' ? 'la bordure' : kind === 'tranchee' ? 'la tranchée' : 'la clôture'
    setPolygone({ nom, calque: vue === 'projet' ? 'projet' : 'existant', mode: 'cloture', kindLineaire: kind })
    toast.info(`Tracez ${article} sur le plan`, {
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
      const kind = p.kindLineaire ?? 'cloture'
      const cloture = creerCloture(p.calque, points, kind)
      etat.ajouterCloture(cloture)
      const nomK = kind === 'bordure' ? 'Bordure' : kind === 'tranchee' ? 'Tranchée' : 'Clôture'
      toast.success(`${nomK} tracée — ${fmtNombreFr(clotureMl(cloture))} ml calculés sur la polyligne.`)
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
    const piece = creerPiecePoly(p.nature ?? { kind: 'piece' }, p.nom, p.calque, points, etat.niveau.heightDefault)
    etat.ajouterPiece(piece)
    toast.success(`${p.nom} ajoutée — ${fmtSurfaceM2(aireMm2(piece.vertices))}`, {
      description: 'Surface calculée sur la forme réelle.',
    })
  }

  // ── Cotes + ouvertures + symboles ─────────────────────────────────────────
  const editerCote = (roomId: string, dim: 'w' | 'h', mm: number) => {
    // Le refus est TOUJOURS expliqué : le message vient du moteur, qui sait
    // nommer le coupable (ex. « ce mur porte une porte de 83 cm »).
    const r = etat.redimensionner(roomId, dim, mm)
    if (!r.ok) toast.warning(r.message, { description: r.description })
    else if (r.info) toast.info(r.info)
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

  // Push 7B — marque l'état + horodatage indicatif + auteur. 'a_faire' efface la
  // date/auteur (jamais de date fantôme sur une pièce non commencée).
  const marquerAvancement = useCallback(
    (av: EtatAvancement) => {
      const p = etat.pieceSelectionnee
      if (!p) return
      if (av === 'a_faire') {
        etat.majPiece(p.id, {
          avancement: 'a_faire',
          avancementLe: undefined,
          avancementPar: undefined,
          avancementParId: undefined,
        })
        return
      }
      etat.majPiece(p.id, {
        avancement: av,
        avancementLe: new Date().toISOString(),
        avancementPar: utilisateur || undefined,
        avancementParId: utilisateurId || undefined,
      })
    },
    [etat, utilisateur, utilisateurId]
  )

  return (
    <div className="flex h-full flex-col bg-white">
      <PlanTopbar
        nom={nom}
        onRenommer={setNom}
        statut={statut}
        horsLigne={horsLigne}
        retourHref={retourHref}
        onRetour={flush}
        niveaux={etat.data.levels}
        niveauId={etat.niveauId}
        onNiveau={etat.setNiveauId}
        onAjouterNiveau={etat.ajouterNiveau}
        onRenommerNiveau={etat.renommerNiveau}
        onDupliquerNiveau={dupliquerNiveau}
        vue={vue}
        onVue={setVue}
        mode3d={mode3d}
        onMode3d={changerMode3d}
        metier={metier}
        onMetier={changerMetier}
        canUndo={etat.canUndo && !mode3d}
        canRedo={etat.canRedo && !mode3d}
        onUndo={etat.undo}
        onRedo={etat.redo}
        onEnvoyerDevis={() => ouvrirTiroir(null)}
      />

      {/* Push 4 — hors-ligne honnête : bannière discrète sous la topbar.
          Pas de localStorage/Service Worker dans ce push : les modifications
          vivent en mémoire, d'où la consigne de ne pas fermer l'onglet. */}
      {horsLigne && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center font-hanken text-xs font-semibold text-amber-800">
          Hors connexion — vos modifications seront enregistrées au retour du réseau. Ne fermez pas l&apos;onglet.
        </div>
      )}

      {/* Push 9 — bandeau récap d'avancement du niveau courant (lecture seule,
          additif). Masqué s'il n'y a aucune pièce intérieure (géré dans le
          composant). Reflète le même code couleur que le plan (2D et 3D). */}
      <PlanRecapAvancement rooms={etat.niveau.rooms} />

      <div className="relative flex min-h-0 flex-1">
        {/* Palette gauche à libellés, filtrée par la vue métier (desktop).
            Push 6 : masquée en 3D (vue de présentation, aucun outil actif). */}
        {!mode3d && (
          <PlanPalette
            metier={metier}
            outil={outil}
            onOutil={setOutil}
            onAjouterPiece={() => ouvrirModal({ kind: 'piece' })}
            onZoneExt={(extType) => ouvrirModal({ kind: 'surface', extType })}
            onCloture={() => demarrerLineaire('cloture')}
            onBordure={() => demarrerLineaire('bordure')}
            onTranchee={() => demarrerLineaire('tranchee')}
          />
        )}

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

          {!mode3d && (
            <PlanOverlays
              metier={metier}
              outil={outil}
              onOutil={setOutil}
              onCloture={() => demarrerLineaire('cloture')}
              polygone={polygone}
              onAnnulerPolygone={() => setPolygone(null)}
              niveauVide={niveauVide}
              onAjouterPiece={() => ouvrirModal({ kind: 'piece' })}
              annulation={annulation}
              onAnnulerSuppression={() => {
                setAnnulation(null)
                etat.undo()
              }}
            />
          )}

          {/* Push 6 — vue 3D : surcouche opaque au-dessus du canvas 2D */}
          {mode3d && <Scene3dView niveau={etat.niveau} nomPlan={nom} />}
        </div>

        {/* Panneau droit : pièce (RoomSheet + métrés), symbole ou clôture.
            Push 6 : masqué en 3D (la sélection est vidée à l'entrée en 3D). */}
        {!mode3d && (etat.pieceSelectionnee || etat.symboleSelectionne || etat.clotureSelectionnee) && (
          <aside className="absolute inset-x-0 bottom-0 z-30 max-h-[48%] overflow-hidden rounded-t-2xl border-t border-gray-200 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:flex-shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
            {etat.pieceSelectionnee ? (
              <RoomSheet
                piece={etat.pieceSelectionnee}
                onMaj={(patch) => etat.majPiece(etat.pieceSelectionnee!.id, patch)}
                onNature={(nature) => etat.changerNaturePiece(etat.pieceSelectionnee!.id, nature)}
                onRedimensionner={(dim, mm) => etat.redimensionner(etat.pieceSelectionnee!.id, dim, mm)}
                onAvancement={marquerAvancement}
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
                // HSP résolue comme iso.ts:271 (`height > 0 ? height : défaut`)
                // et NON `piece.height ?? défaut` : `height` vaut 0 sur des
                // données anciennes, et `??` ne se déclenche pas sur 0 → l'alerte
                // « au-dessus du plafond (0,00 m) » se serait affichée sur TOUTE
                // hauteur, pendant que la 3D dessinait correctement à 2,50 m.
                hspMm={
                  pieceDuSymbole && pieceDuSymbole.height > 0
                    ? pieceDuSymbole.height
                    : etat.niveau.heightDefault
                }
                onTourner={(delta) => etat.tournerSymbole(etat.symboleSelectionne!.id, delta)}
                onReglerHauteur={(mm) => etat.reglerHauteurSymbole(etat.symboleSelectionne!.id, mm)}
                onSupprimer={supprimerSelection}
                onFermer={() => etat.selectSymbol(null)}
              />
            ) : etat.clotureSelectionnee ? (
              <ClotureSheet
                cloture={etat.clotureSelectionnee}
                onMaj={(patch) => etat.majCloture(etat.clotureSelectionnee!.id, patch)}
                onEnvoyerDevis={() => {
                  const cl = etat.clotureSelectionnee!
                  const k = kindDe(cl)
                  const metric = k === 'bordure' ? 'bordure_ml' : k === 'tranchee' ? 'tranchee_ml' : 'cloture_ml'
                  ouvrirTiroir({ metric, roomId: cl.id })
                }}
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
        natureInitiale={natureModale}
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
