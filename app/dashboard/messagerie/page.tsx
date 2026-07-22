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

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@/lib/hooks'
import {
  useConversations,
  useContacts,
  useMessages,
  useMembresConversation,
  envoyerMessage,
  marquerLue,
  ouvrirChatDirect,
  nomConversation,
  type ConversationListItem,
  type Contact,
} from '@/lib/hooks-messagerie'
import {
  Search, Plus, ArrowLeft, Send, MessageCircle, Users, X, Loader2, Pin, UserPlus,
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

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      nomConversation(c).toLowerCase().includes(q) ||
      (c.autre_metier || '').toLowerCase().includes(q),
    )
  }, [conversations, recherche])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

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
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

      {/* ── Colonne liste ─────────────────────────────────────────── */}
      <aside
        className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-gray-100 bg-white`}
      >
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-navy font-manrope tracking-tight">Messagerie</h1>
            <button
              onClick={() => setShowContacts(true)}
              className="h-9 pl-2.5 pr-3.5 rounded-xl bg-orange text-white flex items-center gap-1.5 text-sm font-semibold hover:bg-orange-hover transition-colors shadow-sm shadow-orange/30"
            >
              <Plus className="w-4 h-4" /> Nouveau
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un confrère…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl" />
              ))}
            </div>
          ) : filtrees.length === 0 ? (
            <EmptyList recherche={!!recherche} onStart={() => setShowContacts(true)} />
          ) : (
            <ul>
              {filtrees.map((c) => {
                const actif = c.id === selectedId
                const nom = nomConversation(c)
                const deMoi = c.apercu_expediteur && c.apercu_expediteur === user?.id
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${actif ? 'bg-sky/10' : ''}`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-bold text-sm flex-shrink-0 shadow-sm">
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
              })}
            </ul>
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

      {/* ── Modale contacts ───────────────────────────────────────── */}
      {showContacts && (
        <ContactsModal onClose={() => setShowContacts(false)} onPick={demarrerChat} />
      )}
    </div>
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
  const { messages, loading, ajouterLocal } = useMessages(conversationId)
  const { membres } = useMembresConversation(conversationId)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const filRef = useRef<HTMLDivElement>(null)

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
          <div className="font-bold text-[15px] truncate font-manrope">{titre}</div>
          {sousTitre && <div className="text-[11px] text-white/60 truncate">{sousTitre}</div>}
        </div>
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
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-[14px] leading-snug break-words shadow-sm ${
                        mien
                          ? 'bg-navy text-white rounded-br-md'
                          : 'bg-white text-navy border border-gray-100 rounded-bl-md'
                      }`}
                    >
                      {m.contenu}
                    </div>
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

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-navy font-manrope">Nouvelle discussion</h2>
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
            <ul>
              {filtres.map((c) => (
                <li key={c.user_id}>
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
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
