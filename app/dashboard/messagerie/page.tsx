'use client'

// ============================================================================
// app/dashboard/messagerie/page.tsx — Onglet Messagerie (V1).
// ----------------------------------------------------------------------------
// Chat entre artisans Nexartis. V1 = conversations 1-à-1 (confrères / partenaires
// / équipe). Le client final ne participe jamais. La sécurité (isolation) est
// garantie en base par la RLS (migration ...-messagerie-01-fondation).
//
// V1 volontairement centrée sur le texte. À VENIR (fichiers suivants) : pièces
// jointes (photos/docs), vocal transcrit, partage de devis/facture dans le fil,
// création de groupes de chantier, consigne épinglée éditable, invitations.
// ============================================================================

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useUser } from '@/lib/hooks'
import {
  useConversations,
  useContacts,
  useMessages,
  useMembresConversation,
  useDocumentsPartageables,
  useChantiersPartageables,
  envoyerMessage,
  envoyerPieceJointe,
  urlSigneeMessagerie,
  partagerDocument,
  partagerChantier,
  parseSnapshotDoc,
  parseSnapshotChantier,
  marquerLue,
  ouvrirChatDirect,
  nomConversation,
  type ConversationListItem,
  type Contact,
  type MessageRow,
  type PieceJointe,
  type SnapshotDoc,
  type SnapshotChantier,
  type DocPartageable,
} from '@/lib/hooks-messagerie'
import { MESSAGERIE_FICHIER_ACCEPT, JustificatifError } from '@/lib/messagerie-fichiers'
import { confierLot, useMesChantiersConfies } from '@/lib/hooks-collab'
import MesArtisansPanel from '@/components/reseau/MesArtisansPanel'
import ChantiersConfiesWorkspace from '@/components/collab/ChantiersConfiesWorkspace'
import {
  Search, Plus, ArrowLeft, Send, MessageCircle, Users, Network, X, Loader2, Pin, UserPlus,
  Paperclip, FileText, Maximize2, Receipt, HardHat, MapPin, Phone,
} from 'lucide-react'

const REPONSES_RAPIDES = ['👍 Bien reçu', '🚚 En route', '⏱ Retard 30 min', "📍 J'arrive"]

// ─── Helpers d'affichage ────────────────────────────────────────────────────

function initiales(nom: string | null | undefined): string {
  if (!nom) return '?'
  const mots = nom.trim().split(/\s+/)
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

function heureCourte(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  const hier = new Date(now); hier.setDate(now.getDate() - 1)
  if (d.toDateString() === hier.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function jourLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  const hier = new Date(now); hier.setDate(now.getDate() - 1)
  if (d.toDateString() === hier.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function apercuTexte(c: ConversationListItem): string {
  if (!c.apercu && !c.apercu_type) return 'Nouvelle conversation'
  switch (c.apercu_type) {
    case 'photo': return '📷 Photo'
    case 'document': return '📎 Document'
    case 'vocal': return '🎤 Message vocal'
    case 'devis': return '🧾 Devis'
    case 'facture': return '🧾 Facture'
    case 'chantier': return '🏗️ Fiche chantier'
    default: return c.apercu || ''
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MessageriePage() {
  const { user } = useUser()
  const { conversations, loading, refetch } = useConversations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [showContacts, setShowContacts] = useState(false)
  const { contacts, loading: contactsLoading } = useContacts()

  // Onglet du haut (Messagerie / Chantiers confiés) + vue du panneau gauche.
  const [ongletHaut, setOngletHaut] = useState<'messagerie' | 'chantiers'>('messagerie')
  const [vueGauche, setVueGauche] = useState<'discussions' | 'artisans'>('discussions')

  // Pastille « invitations de collaboration en attente » sur l'onglet Chantiers.
  const { chantiers: chantiersConfies } = useMesChantiersConfies()
  const invitesConfies = chantiersConfies.filter((c) => c.statut === 'invite').length

  // Ouvre (ou crée) le fil avec un artisan depuis la vue « Mes artisans »,
  // puis bascule sur « Discussions » pour afficher la conversation.
  async function ouvrirDepuisArtisan(userId: string) {
    const convId = await ouvrirChatDirect(userId)
    setSelectedId(convId)
    setVueGauche('discussions')
    refetch()
  }

  // Deep-link : ouvrir directement une conversation au chargement.
  //   ?c=<convId> -> ouvre la conversation existante.
  //   ?u=<userId> -> ouvre (ou cree) le fil direct avec cet utilisateur
  //                  (ex : bouton « Message » depuis la page Equipe).
  // On nettoie l'URL ensuite pour qu'un rafraichissement ne rejoue pas l'action.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cid = params.get('c')
    const uid = params.get('u')
    if (!cid && !uid) return
    window.history.replaceState(null, '', '/dashboard/messagerie')
    if (cid) { setSelectedId(cid); return }
    if (uid) {
      ouvrirChatDirect(uid)
        .then((convId) => { setSelectedId(convId); refetch() })
        .catch((e) => {
          console.error('Ouverture chat direct echouee:', e)
          alert("Impossible d'ouvrir cette conversation.")
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      nomConversation(c).toLowerCase().includes(q) ||
      (c.autre_metier || '').toLowerCase().includes(q),
    )
  }, [conversations, recherche])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  // Index des user_id d'equipe (meme entreprise) : le RPC mes_contacts tague
  // ces contacts type_relation='equipe'. Sert a ranger les conversations en
  // 2 sections « Mon equipe » / « Mes confreres ».
  const equipeIds = useMemo(() => {
    const s = new Set<string>()
    contacts.forEach((c) => { if (c.type_relation === 'equipe') s.add(c.user_id) })
    return s
  }, [contacts])

  const sections = useMemo(() => {
    const equipe: ConversationListItem[] = []
    const confreres: ConversationListItem[] = []
    const groupes: ConversationListItem[] = []
    filtrees.forEach((c) => {
      if (c.type === 'groupe') groupes.push(c)
      else if (c.autre_user_id && equipeIds.has(c.autre_user_id)) equipe.push(c)
      else confreres.push(c)
    })
    return { equipe, confreres, groupes }
  }, [filtrees, equipeIds])

  async function demarrerChat(contact: Contact) {
    try {
      const convId = await ouvrirChatDirect(contact.user_id)
      setShowContacts(false)
      setSelectedId(convId)
      refetch()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

      {/* ── Barre d'onglets : Messagerie / Chantiers confiés ──────────── */}
      <div className="flex items-center gap-1 px-3 pt-2 flex-shrink-0 border-b border-gray-100">
        <OngletHaut actif={ongletHaut === 'messagerie'} onClick={() => setOngletHaut('messagerie')} icon={<MessageCircle className="w-4 h-4" />} label="Messagerie" />
        <OngletHaut actif={ongletHaut === 'chantiers'} onClick={() => setOngletHaut('chantiers')} icon={<HardHat className="w-4 h-4" />} label="Chantiers confiés" badge={invitesConfies} />
      </div>

      {ongletHaut === 'chantiers' ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          <ChantiersConfiesWorkspace />
        </div>
      ) : (
      <div className="flex flex-1 min-h-0">

      {/* ── Colonne liste ─────────────────────────────────────────── */}
      <aside
        className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-gray-100 bg-white`}
      >
        <div className="p-4 border-b border-gray-100">
          {/* Bascule Discussions / Mes artisans */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setVueGauche('discussions')}
              className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors ${
                vueGauche === 'discussions' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Discussions
            </button>
            <button
              onClick={() => setVueGauche('artisans')}
              className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors ${
                vueGauche === 'artisans' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Mes artisans
            </button>
          </div>
          {vueGauche === 'discussions' && (
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une conversation…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {vueGauche === 'artisans' ? (
            <MesArtisansPanel onOuvrirChat={ouvrirDepuisArtisan} />
          ) : loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl" />
              ))}
            </div>
          ) : filtrees.length === 0 ? (
            <EmptyList recherche={!!recherche} onStart={() => setShowContacts(true)} />
          ) : contactsLoading ? (
            // Liste a plat tant que l'appartenance equipe/confreres n'est pas
            // encore connue : evite un reclassement clignotant au chargement.
            <ul>
              {filtrees.map((c) => (
                <ConvRow key={c.id} c={c} actif={c.id === selectedId} meId={user?.id ?? null} onSelect={() => setSelectedId(c.id)} />
              ))}
            </ul>
          ) : (
            <>
              {sections.equipe.length > 0 && (
                <ListeSection titre="Mon équipe" variant="equipe" count={sections.equipe.length}>
                  {sections.equipe.map((c) => (
                    <ConvRow key={c.id} c={c} variant="equipe" actif={c.id === selectedId} meId={user?.id ?? null} onSelect={() => setSelectedId(c.id)} />
                  ))}
                </ListeSection>
              )}
              {sections.confreres.length > 0 && (
                <ListeSection titre="Mes confrères" variant="confreres" count={sections.confreres.length}>
                  {sections.confreres.map((c) => (
                    <ConvRow key={c.id} c={c} variant="confreres" actif={c.id === selectedId} meId={user?.id ?? null} onSelect={() => setSelectedId(c.id)} />
                  ))}
                </ListeSection>
              )}
              {sections.groupes.length > 0 && (
                <ListeSection titre="Groupes" variant="groupe" count={sections.groupes.length}>
                  {sections.groupes.map((c) => (
                    <ConvRow key={c.id} c={c} actif={c.id === selectedId} meId={user?.id ?? null} onSelect={() => setSelectedId(c.id)} />
                  ))}
                </ListeSection>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Colonne conversation ──────────────────────────────────── */}
      <section className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-gray-50`}>
        {selectedId ? (
          <ConversationView
            key={selectedId}
            conversationId={selectedId}
            conversation={selected}
            meId={user?.id ?? null}
            onBack={() => setSelectedId(null)}
            onActivity={refetch}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-center text-gray-400 p-8">
            <div>
              <div className="w-16 h-16 rounded-3xl bg-sky/10 grid place-items-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-sky" />
              </div>
              <p className="text-sm text-gray-500">Sélectionnez une conversation<br />ou démarrez-en une nouvelle.</p>
            </div>
          </div>
        )}
      </section>
      </div>
      )}

      {/* ── Modale contacts ───────────────────────────────────────── */}
      {showContacts && (
        <ContactsModal onClose={() => setShowContacts(false)} onPick={demarrerChat} />
      )}
    </div>
  )
}

// ─── Onglet du haut (Messagerie / Chantiers confiés) ─────────────────────────

function OngletHaut({ actif, onClick, icon, label, badge }: {
  actif: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-[13.5px] font-hanken font-bold rounded-t-lg transition-colors ${
        actif ? 'text-navy' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold rounded-full bg-orange text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {actif && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-orange rounded-full" />}
    </button>
  )
}

// ─── Section (en-tête « Mon équipe » / « Mes confrères ») ────────────────────

function ListeSection({ titre, variant, count, children }: {
  titre: string
  variant?: 'equipe' | 'confreres' | 'groupe'
  count?: number
  children: ReactNode
}) {
  // Équipe = monde interne (sky, icône Users) ; confrères = réseau externe
  // (orange, icône Network) ; groupes = neutre (gris). L'en-tête reste collé
  // en haut au scroll pour qu'on « sente » le passage d'un monde à l'autre.
  const Icon = variant === 'confreres' ? Network : Users
  const tint = variant === 'equipe' ? 'text-sky' : variant === 'confreres' ? 'text-orange' : 'text-gray-400'
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 pt-3 pb-1.5 bg-white/95 backdrop-blur-sm border-b border-gray-50">
        {variant && <Icon className={`w-3.5 h-3.5 ${tint}`} aria-hidden="true" />}
        <span className="text-[11px] font-bold uppercase tracking-wider text-navy">{titre}</span>
        {count != null && <span className="text-[11px] font-semibold text-gray-300 tabular-nums">{count}</span>}
      </div>
      <ul>{children}</ul>
    </div>
  )
}

// ─── Ligne de conversation (liste de gauche) ─────────────────────────────────

function ConvRow({ c, actif, meId, onSelect, variant }: {
  c: ConversationListItem
  actif: boolean
  meId: string | null
  onSelect: () => void
  variant?: 'equipe' | 'confreres'
}) {
  const nom = nomConversation(c)
  const deMoi = c.apercu_expediteur && c.apercu_expediteur === meId
  // Anneau d'avatar coloré = rappel du « monde » même quand l'en-tête de
  // section a défilé hors écran (sky = équipe, orange = confrère).
  const ring = variant === 'equipe' ? 'ring-2 ring-sky/30' : variant === 'confreres' ? 'ring-2 ring-orange/25' : ''
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${actif ? 'bg-sky/10' : ''}`}
      >
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-bold text-sm flex-shrink-0 shadow-sm ${ring}`}>
          {c.type === 'groupe' ? <Users className="w-5 h-5" /> : initiales(nom)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-navy text-sm truncate">{nom}</span>
            {c.autre_metier && (
              <span className="text-[11px] text-gray-400 truncate hidden sm:inline">{c.autre_metier}</span>
            )}
          </div>
          <p className={`text-xs truncate mt-0.5 ${c.non_lus > 0 ? 'text-navy font-medium' : 'text-gray-400'}`}>
            {deMoi && <span className="text-gray-400">Vous : </span>}{apercuTexte(c)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[11px] text-gray-400">{heureCourte(c.dernier_message_at)}</span>
          {c.non_lus > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange text-white text-[11px] font-bold grid place-items-center">
              {c.non_lus}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

// ─── Carte vivante d'un devis / facture partagé ──────────────────────────────

// Libellés/couleurs des statuts. Doit couvrir les valeurs RÉELLES de la base
// (devis : brouillon, finalise, envoye, signe/accepte, refuse, expire, facture ;
// factures : brouillon, envoyee, payee, partiellement_payee, en_retard, annulee).
const STATUT_DOC: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  finalise: { label: 'Finalisé', cls: 'bg-sky/15 text-sky' },
  envoye: { label: 'Envoyé', cls: 'bg-sky/15 text-sky' },
  envoyee: { label: 'Envoyée', cls: 'bg-sky/15 text-sky' },
  signe: { label: 'Signé', cls: 'bg-emerald-100 text-emerald-700' },
  accepte: { label: 'Accepté', cls: 'bg-emerald-100 text-emerald-700' },
  facture: { label: 'Facturé', cls: 'bg-emerald-100 text-emerald-700' },
  paye: { label: 'Payée', cls: 'bg-emerald-100 text-emerald-700' },
  payee: { label: 'Payée', cls: 'bg-emerald-100 text-emerald-700' },
  partiel: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' },
  partiellement_payee: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
  refuse: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
  annulee: { label: 'Annulée', cls: 'bg-gray-100 text-gray-500' },
  expire: { label: 'Expiré', cls: 'bg-amber-100 text-amber-700' },
}

function euros(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function DocumentCarteVivante({ snap, type, pj, mien }: {
  snap: SnapshotDoc | null
  type: 'devis' | 'facture'
  pj: PieceJointe | null
  mien: boolean
}) {
  const estDevis = type === 'devis'
  const titreType = estDevis ? 'Devis' : 'Facture'
  const statut = snap?.statut
    ? (STATUT_DOC[snap.statut] || { label: snap.statut, cls: 'bg-gray-100 text-gray-600' })
    : null
  const refId = pj?.devis_id || pj?.facture_id || null
  const href = refId ? `/dashboard/${estDevis ? 'devis' : 'factures'}/${refId}` : null

  return (
    <div className={`w-[262px] rounded-2xl overflow-hidden shadow-sm bg-white border border-gray-100 ${mien ? 'rounded-br-md' : 'rounded-bl-md'}`}>
      <div className={`px-3.5 py-2 flex items-center gap-2 ${estDevis ? 'bg-sky/10' : 'bg-orange/10'}`}>
        <span className={`w-6 h-6 rounded-md grid place-items-center flex-shrink-0 ${estDevis ? 'bg-sky/20 text-sky' : 'bg-orange/20 text-orange'}`}>
          <Receipt className="w-3.5 h-3.5" />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-navy">{titreType}</span>
        {snap?.numero && <span className="text-[11px] text-gray-400 font-mono ml-auto truncate max-w-[110px]">{snap.numero}</span>}
      </div>
      <div className="px-3.5 py-3">
        {snap ? (
          <>
            {snap.client && <p className="text-[13px] font-semibold text-navy truncate">{snap.client}</p>}
            {snap.objet && <p className="text-[12px] text-gray-500 truncate mt-0.5">{snap.objet}</p>}
            <div className="flex items-end justify-between mt-2.5 gap-2">
              <span className="text-[17px] font-bold text-navy tabular-nums leading-none">
                {euros(snap.montant_ttc)}<span className="text-[10px] text-gray-400 font-normal ml-1">TTC</span>
              </span>
              {statut && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statut.cls}`}>{statut.label}</span>}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-gray-500">{titreType} partagé</p>
        )}
        {mien && href && (
          <a href={href} className="mt-3 flex items-center justify-center h-9 rounded-lg bg-navy text-white text-[13px] font-semibold hover:bg-navy-mid transition-colors">
            Voir {estDevis ? 'le devis' : 'la facture'}
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Carte vivante d'une fiche chantier partagée ─────────────────────────────

function formatDateCourte(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function ChantierCarteVivante({ snap, mien }: { snap: SnapshotChantier | null; mien: boolean }) {
  const href = snap?.chantier_id ? `/dashboard/chantiers/${snap.chantier_id}` : null
  const lieu = snap
    ? [snap.adresse, [snap.code_postal, snap.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : ''
  const dd = formatDateCourte(snap?.date_debut)
  const df = formatDateCourte(snap?.date_fin_prevue)
  const periode = (dd || df) ? `${dd || '—'} → ${df || '—'}` : null

  return (
    <div className={`w-[268px] rounded-2xl overflow-hidden shadow-sm bg-white border border-gray-100 ${mien ? 'rounded-br-md' : 'rounded-bl-md'}`}>
      <div className="px-3.5 py-2 flex items-center gap-2 bg-navy/[0.06]">
        <span className="w-6 h-6 rounded-md grid place-items-center flex-shrink-0 bg-navy/10 text-navy">
          <HardHat className="w-3.5 h-3.5" />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-navy">Chantier</span>
        {snap?.statut && <span className="text-[11px] font-semibold text-gray-500 ml-auto capitalize truncate max-w-[110px]">{snap.statut.replace(/_/g, ' ')}</span>}
      </div>
      <div className="px-3.5 py-3">
        {snap ? (
          <>
            <p className="text-[14px] font-bold text-navy leading-snug">{snap.titre || 'Chantier'}</p>
            {snap.description && <p className="text-[12px] text-gray-500 mt-0.5 truncate">{snap.description}</p>}
            <div className="mt-2.5 space-y-1.5 text-[12px]">
              {lieu && (
                <div className="flex items-start gap-1.5 text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-orange flex-shrink-0 mt-0.5" />
                  <span className="min-w-0">{lieu}</span>
                </div>
              )}
              {periode && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <span aria-hidden="true">📅</span>
                  <span>{periode}</span>
                </div>
              )}
              {snap.client && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-sky flex-shrink-0" />
                  <span className="truncate">{snap.client}{snap.client_tel ? ` · ${snap.client_tel}` : ''}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-gray-500">Fiche chantier partagée</p>
        )}
        {mien && href && (
          <a href={href} className="mt-3 flex items-center justify-center h-9 rounded-lg bg-navy text-white text-[13px] font-semibold hover:bg-navy-mid transition-colors">
            Voir le chantier
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Modale : choisir un devis / facture / chantier à partager ───────────────

function PartageDocModal({ onClose, onPick }: {
  onClose: () => void
  onPick: (kind: 'devis' | 'facture' | 'chantier', id: string) => void
}) {
  const { devis, factures, loading: loadingDocs } = useDocumentsPartageables()
  const { chantiers, loading: loadingChantiers } = useChantiersPartageables()
  const [onglet, setOnglet] = useState<'devis' | 'factures' | 'chantiers'>('devis')

  const ONGLETS = [
    { k: 'devis' as const, label: 'Devis' },
    { k: 'factures' as const, label: 'Factures' },
    { k: 'chantiers' as const, label: 'Chantiers' },
  ]
  const loading = onglet === 'chantiers' ? loadingChantiers : loadingDocs
  const docs: DocPartageable[] = onglet === 'devis' ? devis : onglet === 'factures' ? factures : []
  const vide = onglet === 'chantiers' ? chantiers.length === 0 : docs.length === 0

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-navy font-hanken">Partager</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400 hover:text-navy transition-colors" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-1 p-2 border-b border-gray-100">
          {ONGLETS.map((t) => (
            <button
              key={t.k}
              onClick={() => setOnglet(t.k)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${onglet === t.k ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
            </div>
          ) : vide ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {onglet === 'chantiers'
                ? 'Aucun chantier à partager pour le moment.'
                : `Aucun ${onglet === 'devis' ? 'devis' : 'facture'} à partager pour le moment.`}
            </div>
          ) : onglet === 'chantiers' ? (
            <ul>
              {chantiers.map((ch) => (
                <li key={ch.id}>
                  <button
                    onClick={() => onPick('chantier', ch.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 bg-navy/10 text-navy">
                      <HardHat className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-navy text-sm truncate">{ch.titre || 'Chantier'}</span>
                      <span className="block text-xs text-gray-400 truncate">{[ch.adresse_chantier, ch.ville_chantier].filter(Boolean).join(', ') || '—'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => onPick(onglet === 'devis' ? 'devis' : 'facture', d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${onglet === 'devis' ? 'bg-sky/10 text-sky' : 'bg-orange/10 text-orange'}`}>
                      <Receipt className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-navy text-sm truncate">{d.client_nom || 'Client'}</span>
                        {d.numero && <span className="text-[11px] text-gray-400 font-mono truncate flex-shrink-0">{d.numero}</span>}
                      </span>
                      <span className="block text-xs text-gray-400 truncate">{d.objet || '—'}</span>
                    </span>
                    <span className="text-sm font-bold text-navy tabular-nums flex-shrink-0">{euros(d.montant_ttc)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modale : confier un lot de chantier à ce confrère (collaboration) ───────

function ConfierLotModal({ onClose, onConfier }: {
  onClose: () => void
  onConfier: (chantierId: string, lot: string) => void
}) {
  const { chantiers, loading } = useChantiersPartageables()
  const [chantierId, setChantierId] = useState<string>('')
  const [lot, setLot] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function submit() {
    if (!chantierId || envoi) return
    setEnvoi(true)
    await onConfier(chantierId, lot)
    setEnvoi(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-navy font-hanken">Confier un lot</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400 hover:text-navy transition-colors" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Votre confrère verra les infos de travail du chantier (et le client), mais jamais vos
            devis, factures ou finances.
          </p>
          <div>
            <label className="block text-[13px] font-semibold text-navy mb-1.5">Chantier</label>
            {loading ? (
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
            ) : chantiers.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun chantier disponible.</p>
            ) : (
              <select
                value={chantierId}
                onChange={(e) => setChantierId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sky/40"
              >
                <option value="">— Choisir un chantier —</option>
                {chantiers.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.titre || 'Chantier'}{ch.ville_chantier ? ` — ${ch.ville_chantier}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-navy mb-1.5">
              Le lot confié <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="Ex : Plâtrerie étage 1, Peinture façade…"
              maxLength={200}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
            />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={submit}
            disabled={!chantierId || envoi}
            className="w-full h-11 rounded-xl bg-orange text-white font-semibold flex items-center justify-center gap-2 hover:bg-orange-hover transition-colors disabled:opacity-40"
          >
            {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <HardHat className="w-5 h-5" />}
            Confier ce lot
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne de contact (modale « nouvelle discussion ») ───────────────────────

function PickerRow({ c, onPick }: { c: Contact; onPick: (c: Contact) => void }) {
  return (
    <li>
      <button
        onClick={() => onPick(c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-bold text-sm flex-shrink-0">
          {initiales(c.nom)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-navy text-sm truncate">{c.nom || c.email || 'Artisan Nexartis'}</div>
          <div className="text-xs text-gray-400 truncate">
            {c.metier || (c.type_relation === 'equipe' ? 'Mon équipe' : 'Confrère')}
          </div>
        </div>
      </button>
    </li>
  )
}

// ─── État vide de la liste ───────────────────────────────────────────────────

function EmptyList({ recherche, onStart }: { recherche: boolean; onStart: () => void }) {
  if (recherche) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Aucun résultat.</p>
      </div>
    )
  }
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 rounded-3xl bg-orange/10 grid place-items-center mx-auto mb-4">
        <MessageCircle className="w-8 h-8 text-orange" />
      </div>
      <p className="text-sm font-semibold text-navy">Votre messagerie est prête</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
        Discutez et partagez des documents avec les autres artisans de votre réseau, en toute confidentialité.
      </p>
      <button
        onClick={onStart}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange text-white text-sm font-semibold hover:bg-orange-hover transition-colors shadow-sm shadow-orange/30"
      >
        <UserPlus className="w-4 h-4" /> Démarrer une discussion
      </button>
    </div>
  )
}

// ─── Vue conversation ────────────────────────────────────────────────────────

function ConversationView({
  conversationId, conversation, meId, onBack, onActivity,
}: {
  conversationId: string
  conversation: ConversationListItem | null
  meId: string | null
  onBack: () => void
  onActivity: () => void
}) {
  const { messages, loading, ajouterLocal, refetch } = useMessages(conversationId)
  const { membres } = useMembresConversation(conversationId)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [envoiFichier, setEnvoiFichier] = useState(false)
  const [showPartage, setShowPartage] = useState(false)
  const [showConfier, setShowConfier] = useState(false)
  const filRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const autres = membres.filter((m) => m.user_id !== meId)
  const estGroupe = conversation?.type === 'groupe'
  const titre = estGroupe
    ? (conversation?.titre || 'Groupe de chantier')
    : (conversation?.autre_nom || autres[0]?.nom || 'Artisan Nexartis')
  const sousTitre = estGroupe
    ? membres.map((m) => m.nom || 'Artisan').join(', ')
    : (conversation?.autre_metier || autres[0]?.metier || '')

  const nomsParUser = useMemo(() => {
    const map: Record<string, string> = {}
    membres.forEach((m) => { map[m.user_id] = m.nom || 'Artisan' })
    return map
  }, [membres])

  // Marquer lu à l'ouverture et à chaque nouveau message.
  useEffect(() => {
    if (!conversationId) return
    marquerLue(conversationId).then(onActivity).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length])

  // Défilement automatique en bas.
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight })
  }, [messages.length])

  async function envoyerContenu(contenu: string) {
    const txt = contenu.trim()
    if (!txt || envoi) return
    setEnvoi(true)
    try {
      const row = await envoyerMessage(conversationId, txt)
      ajouterLocal(row)
      onActivity()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnvoi(false)
    }
  }

  async function envoyer() {
    const txt = texte.trim()
    if (!txt) return
    setTexte('')
    await envoyerContenu(txt)
  }

  async function envoyerFichier(file: File | null | undefined) {
    if (!file || envoiFichier) return
    setEnvoiFichier(true)
    try {
      const row = await envoyerPieceJointe(conversationId, file)
      ajouterLocal(row)
      onActivity()
    } catch (e) {
      // JustificatifError porte un message français prêt à afficher ; sinon fallback.
      alert(e instanceof JustificatifError ? e.message : "Impossible d'envoyer ce fichier.")
    } finally {
      setEnvoiFichier(false)
    }
  }

  async function partager(kind: 'devis' | 'facture' | 'chantier', id: string) {
    try {
      if (kind === 'chantier') await partagerChantier(conversationId, id)
      else await partagerDocument(conversationId, kind, id)
      setShowPartage(false)
      // Le message (snapshot serveur) apparaît via un rechargement du fil ;
      // le temps réel le livre aussi au destinataire.
      refetch()
      onActivity()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function confier(chantierId: string, lot: string) {
    const autre = conversation?.autre_user_id
    if (!autre) return
    try {
      await confierLot(chantierId, autre, lot)
      setShowConfier(false)
      alert('Lot confié. Votre confrère le retrouvera dans « Chantiers qu\'on m\'a confiés » pour accepter.')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  let dernierJour = ''

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* En-tête */}
      <header className="flex items-center gap-3 px-3 py-3 bg-gradient-to-r from-navy to-navy-mid text-white flex-shrink-0">
        <button onClick={onBack} className="md:hidden w-8 h-8 grid place-items-center -ml-1" aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center font-bold text-sm flex-shrink-0">
          {estGroupe ? <Users className="w-4 h-4" /> : initiales(titre)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate font-hanken">{titre}</div>
          {sousTitre && <div className="text-[11px] text-white/60 truncate">{sousTitre}</div>}
        </div>
        {/* Confier un lot de chantier (collaboration) — 1-à-1 seulement. */}
        {!estGroupe && conversation?.autre_user_id && (
          <button
            onClick={() => setShowConfier(true)}
            className="flex-shrink-0 h-8 pl-2 pr-2.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center gap-1.5 text-[12px] font-semibold"
            title="Confier un lot de chantier à ce confrère"
          >
            <HardHat className="w-4 h-4" />
            <span className="hidden sm:inline">Confier un lot</span>
          </button>
        )}
      </header>

      {/* Consigne épinglée (lecture seule en V1) */}
      {conversation?.consigne && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 bg-gold/10 border-b border-gold/30 flex-shrink-0">
          <Pin className="w-3.5 h-3.5 text-orange mt-0.5 flex-shrink-0" />
          <p className="text-xs text-navy/80 leading-relaxed">{conversation.consigne}</p>
        </div>
      )}

      {/* Fil */}
      <div ref={filRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-10 w-1/2 bg-gray-200 rounded-2xl ${i % 2 ? 'ml-auto' : ''}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-gray-400">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-sky/10 grid place-items-center mx-auto mb-3">
                <MessageCircle className="w-7 h-7 text-sky" />
              </div>
              <p className="text-sm">Écrivez le premier message.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mien = m.expediteur_id === meId
            const jour = jourLabel(m.created_at)
            const nouveauJour = jour !== dernierJour
            dernierJour = jour

            if (m.type_message === 'systeme') {
              return (
                <Fragment key={m.id}>
                  {nouveauJour && <DaySeparator label={jour} />}
                  <div className="text-center my-1.5">
                    <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">{m.contenu}</span>
                  </div>
                </Fragment>
              )
            }

            return (
              <Fragment key={m.id}>
                {nouveauJour && <DaySeparator label={jour} />}
                <div className={`flex ${mien ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] flex flex-col ${mien ? 'items-end' : 'items-start'}`}>
                    {!mien && estGroupe && (
                      <span className="text-[11px] font-semibold text-orange mb-0.5 ml-1">
                        {m.expediteur_id ? (nomsParUser[m.expediteur_id] || 'Artisan') : 'Utilisateur supprimé'}
                      </span>
                    )}
                    <MessageContenu m={m} mien={mien} />
                    <span className="text-[10px] text-gray-400 mt-0.5 px-1">{heureCourte(m.created_at)}</span>
                  </div>
                </div>
              </Fragment>
            )
          })
        )}
      </div>

      {/* Réponses rapides (chantier) — visibles quand le champ est vide */}
      {!texte && !loading && (
        <div className="flex gap-2 px-3 pt-2 overflow-x-auto flex-shrink-0">
          {REPONSES_RAPIDES.map((r) => (
            <button
              key={r}
              onClick={() => envoyerContenu(r)}
              disabled={envoi}
              className="whitespace-nowrap text-[12.5px] font-semibold text-orange bg-orange/10 border border-orange/20 rounded-full px-3 py-1.5 hover:bg-orange/15 transition-colors disabled:opacity-40"
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 p-3 bg-white border-t border-gray-100 flex-shrink-0">
        {/* Pièce jointe : photo (compressée / HEIC converti) ou PDF. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={MESSAGERIE_FICHIER_ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; envoyerFichier(f) }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={envoiFichier}
          className="w-11 h-11 rounded-full bg-sky/10 text-navy grid place-items-center hover:bg-sky/20 active:scale-95 transition flex-shrink-0 disabled:opacity-40"
          aria-label="Joindre une photo ou un PDF"
          title="Joindre une photo ou un PDF"
        >
          {envoiFichier ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </button>
        {/* Partager un devis / facture en « carte vivante ». */}
        <button
          type="button"
          onClick={() => setShowPartage(true)}
          className="w-11 h-11 rounded-full bg-sky/10 text-navy grid place-items-center hover:bg-sky/20 active:scale-95 transition flex-shrink-0"
          aria-label="Partager un devis, une facture ou un chantier"
          title="Partager un devis, une facture ou un chantier"
        >
          <Receipt className="w-5 h-5" />
        </button>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() } }}
          placeholder="Votre message…"
          className="flex-1 h-11 px-4 rounded-full bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
        />
        <button
          onClick={envoyer}
          disabled={!texte.trim() || envoi}
          className="w-11 h-11 rounded-full bg-orange text-white grid place-items-center disabled:opacity-40 hover:bg-orange-hover transition-colors flex-shrink-0 shadow-sm shadow-orange/30"
          aria-label="Envoyer"
        >
          {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>

      {showPartage && <PartageDocModal onClose={() => setShowPartage(false)} onPick={partager} />}
      {showConfier && <ConfierLotModal onClose={() => setShowConfier(false)} onConfier={confier} />}
    </div>
  )
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="text-[11px] font-semibold text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1 capitalize shadow-sm">
        {label}
      </span>
    </div>
  )
}

// ─── Contenu d'un message (texte, photo ou document) ─────────────────────────

function MessageContenu({ m, mien }: { m: MessageRow; mien: boolean }) {
  const pj = m.pieces && m.pieces.length > 0 ? m.pieces[0] : null

  // Message de type pièce jointe mais PJ non encore résolue (ex : échec du
  // chargement des PJ après un message temps réel) : placeholder, jamais de
  // bulle vide.
  if ((m.type_message === 'photo' || m.type_message === 'document') && !pj) {
    return (
      <div className="px-3.5 py-2 text-[13px] text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-sm">
        📎 Pièce jointe
      </div>
    )
  }

  if (m.type_message === 'devis' || m.type_message === 'facture') {
    return <DocumentCarteVivante snap={parseSnapshotDoc(m.contenu)} type={m.type_message} pj={pj} mien={mien} />
  }

  if (m.type_message === 'chantier') {
    return <ChantierCarteVivante snap={parseSnapshotChantier(m.contenu)} mien={mien} />
  }

  if (m.type_message === 'photo' && pj) {
    return (
      <div className={`overflow-hidden rounded-2xl shadow-sm max-w-[240px] ${mien ? 'rounded-br-md' : 'rounded-bl-md border border-gray-100'}`}>
        <PhotoJointe piece={pj} />
      </div>
    )
  }
  if (m.type_message === 'document' && pj) {
    return <DocumentJointe piece={pj} mien={mien} />
  }
  // Message texte (ou type sans pièce jointe résolue) : bulle classique.
  return (
    <div
      className={`px-3.5 py-2 rounded-2xl text-[14px] leading-snug break-words shadow-sm ${
        mien
          ? 'bg-navy text-white rounded-br-md'
          : 'bg-white text-navy border border-gray-100 rounded-bl-md'
      }`}
    >
      {m.contenu}
    </div>
  )
}

/** Taille lisible : « 42 Ko » ou « 3,4 Mo ». */
function tailleLisible(octets: number | null): string | null {
  if (!octets || octets <= 0) return null
  const ko = octets / 1024
  if (ko < 1024) return `${Math.max(1, Math.round(ko))} Ko`
  return `${(ko / 1024).toFixed(1).replace('.', ',')} Mo`
}

// URL signée (bucket privé) chargée à l'affichage ; expire au bout d'1 h. Le
// composant se remonte à chaque ouverture de conversation, et un bouton
// « Réessayer » régénère l'URL si elle a expiré pendant une longue session.
function PhotoJointe({ piece }: { piece: PieceJointe }) {
  const [url, setUrl] = useState<string | null>(null)
  const [erreur, setErreur] = useState(false)
  const [charge, setCharge] = useState(false)
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    let cancel = false
    if (!piece.fichier_path) { setErreur(true); return }
    setErreur(false); setUrl(null); setCharge(false)
    urlSigneeMessagerie(piece.fichier_path).then((u) => {
      if (cancel) return
      if (u) setUrl(u); else setErreur(true)
    })
    return () => { cancel = true }
  }, [piece.fichier_path, essai])

  if (erreur) {
    return (
      <div className="px-3.5 py-3 text-[13px] text-gray-500 bg-white grid gap-1.5 place-items-start">
        <span>📷 Photo indisponible</span>
        <button onClick={() => setEssai((n) => n + 1)} className="text-[12.5px] text-orange font-semibold hover:underline underline-offset-2">
          Réessayer
        </button>
      </div>
    )
  }
  return (
    <a href={url ?? undefined} target={url ? '_blank' : undefined} rel="noreferrer" className="relative block group cursor-zoom-in">
      {!charge && (
        <div className="w-[240px] h-[240px] bg-gray-100 grid place-items-center">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      )}
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={piece.nom || 'Photo'}
            onLoad={() => setCharge(true)}
            onError={() => setErreur(true)}
            className={`block w-full h-auto max-h-[320px] object-contain bg-navy/5 transition-opacity duration-300 ${charge ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
          />
          {charge && (
            <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-navy/55 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </span>
          )}
        </>
      )}
    </a>
  )
}

function DocumentJointe({ piece, mien }: { piece: PieceJointe; mien: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancel = false
    if (piece.fichier_path) {
      urlSigneeMessagerie(piece.fichier_path).then((u) => { if (!cancel) setUrl(u) })
    }
    return () => { cancel = true }
  }, [piece.fichier_path])

  const taille = tailleLisible(piece.taille_octets)
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl shadow-sm max-w-[260px] ${
        mien ? 'bg-navy text-white rounded-br-md' : 'bg-white text-navy border border-gray-100 rounded-bl-md'
      } ${url ? '' : 'opacity-70 pointer-events-none'}`}
    >
      <span className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${mien ? 'bg-white/15' : 'bg-orange/10 text-orange'}`}>
        {url ? <FileText size={18} /> : <Loader2 size={16} className="animate-spin" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold truncate">{piece.nom || 'Document.pdf'}</span>
        <span className={`block text-[11px] ${mien ? 'text-white/60' : 'text-gray-400'}`}>
          PDF{taille ? ` · ${taille}` : ''}
        </span>
      </span>
    </a>
  )
}

// ─── Modale de sélection d'un contact ────────────────────────────────────────

function ContactsModal({
  onClose, onPick,
}: {
  onClose: () => void
  onPick: (c: Contact) => void
}) {
  const { contacts, loading } = useContacts()
  const [q, setQ] = useState('')

  const filtres = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return contacts
    return contacts.filter((c) =>
      (c.nom || '').toLowerCase().includes(s) ||
      (c.metier || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s),
    )
  }, [contacts, q])

  const groupes = useMemo(() => {
    const equipe: Contact[] = []
    const confreres: Contact[] = []
    filtres.forEach((c) => { (c.type_relation === 'equipe' ? equipe : confreres).push(c) })
    return { equipe, confreres }
  }, [filtres])

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-navy font-hanken">Nouvelle discussion</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400 hover:text-navy transition-colors" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un contact…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          ) : filtres.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 grid place-items-center mx-auto mb-3">
                <UserPlus className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">
                {contacts.length === 0
                  ? 'Aucun contact dans votre réseau'
                  : 'Aucun contact ne correspond.'}
              </p>
              {contacts.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  La possibilité d'inviter des confrères arrive très bientôt.
                </p>
              )}
            </div>
          ) : (
            <>
              {groupes.equipe.length > 0 && (
                <ListeSection titre="Mon équipe" variant="equipe" count={groupes.equipe.length}>
                  {groupes.equipe.map((c) => <PickerRow key={c.user_id} c={c} onPick={onPick} />)}
                </ListeSection>
              )}
              {groupes.confreres.length > 0 && (
                <ListeSection titre="Mes confrères" variant="confreres" count={groupes.confreres.length}>
                  {groupes.confreres.map((c) => <PickerRow key={c.user_id} c={c} onPick={onPick} />)}
                </ListeSection>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
