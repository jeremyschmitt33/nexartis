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

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Search, Plus, ArrowLeft, Send, MessageCircle, Users, X, Loader2,
} from 'lucide-react'

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
  const memeJour = d.toDateString() === now.toDateString()
  if (memeJour) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const hier = new Date(now); hier.setDate(now.getDate() - 1)
  if (d.toDateString() === hier.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
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
            <h1 className="text-xl font-bold text-navy font-manrope">Messagerie</h1>
            <button
              onClick={() => setShowContacts(true)}
              className="w-9 h-9 rounded-xl bg-orange text-white grid place-items-center hover:bg-orange-hover transition-colors"
              aria-label="Nouvelle conversation"
            >
              <Plus className="w-5 h-5" />
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
            <div className="p-8 text-center text-gray-400">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {recherche ? 'Aucun résultat.' : 'Aucune conversation pour le moment.'}
              </p>
              {!recherche && (
                <button
                  onClick={() => setShowContacts(true)}
                  className="mt-3 text-sm font-semibold text-orange hover:underline"
                >
                  Démarrer une discussion
                </button>
              )}
            </div>
          ) : (
            <ul>
              {filtrees.map((c) => {
                const actif = c.id === selectedId
                const nom = nomConversation(c)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${actif ? 'bg-sky/5' : ''}`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-bold text-sm flex-shrink-0">
                        {c.type === 'groupe' ? <Users className="w-5 h-5" /> : initiales(nom)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-navy text-sm truncate">{nom}</span>
                          {c.autre_metier && (
                            <span className="text-[11px] text-gray-400 truncate hidden sm:inline">
                              {c.autre_metier}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{apercuTexte(c)}</p>
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
            meId={user?.id ?? null}
            onBack={() => setSelectedId(null)}
            onActivity={refetch}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-center text-gray-400 p-8">
            <div>
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez une conversation<br />ou démarrez-en une nouvelle.</p>
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

// ─── Vue conversation ────────────────────────────────────────────────────────

function ConversationView({
  conversationId, meId, onBack, onActivity,
}: {
  conversationId: string
  meId: string | null
  onBack: () => void
  onActivity: () => void
}) {
  const { messages, loading, ajouterLocal } = useMessages(conversationId)
  const { membres } = useMembresConversation(conversationId)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const filRef = useRef<HTMLDivElement>(null)

  // Titre + consigne : on récupère la ligne de conversation depuis la liste
  // via les membres (nom de l'autre) — suffisant en V1 pour l'en-tête.
  const autres = membres.filter((m) => m.user_id !== meId)
  const titre = autres.length === 1
    ? (autres[0].nom || 'Artisan Nexartis')
    : `Groupe · ${membres.length} artisans`
  const sousTitre = autres.length === 1
    ? (autres[0].metier || '')
    : membres.map((m) => m.nom || 'Artisan').join(', ')

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

  async function envoyer() {
    const contenu = texte.trim()
    if (!contenu || envoi) return
    setEnvoi(true)
    try {
      const row = await envoyerMessage(conversationId, contenu)
      setTexte('')
      ajouterLocal(row)
      onActivity()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* En-tête */}
      <header className="flex items-center gap-3 px-3 py-3 bg-navy text-white flex-shrink-0">
        <button onClick={onBack} className="md:hidden w-8 h-8 grid place-items-center -ml-1" aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center font-bold text-sm flex-shrink-0">
          {autres.length === 1 ? initiales(autres[0].nom) : <Users className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate font-manrope">{titre}</div>
          {sousTitre && <div className="text-[11px] text-white/60 truncate">{sousTitre}</div>}
        </div>
      </header>

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
              <MessageCircle className="w-9 h-9 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Écrivez le premier message.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mien = m.expediteur_id === meId
            const systeme = m.type_message === 'systeme'
            if (systeme) {
              return (
                <div key={m.id} className="text-center my-2">
                  <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                    {m.contenu}
                  </span>
                </div>
              )
            }
            return (
              <div key={m.id} className={`flex ${mien ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] ${mien ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mien && autres.length > 1 && (
                    <span className="text-[11px] font-semibold text-orange mb-0.5 ml-1">
                      {m.expediteur_id ? (nomsParUser[m.expediteur_id] || 'Artisan') : 'Utilisateur supprimé'}
                    </span>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-[14px] leading-snug break-words ${
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
            )
          })
        )}
      </div>

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
          className="w-11 h-11 rounded-full bg-orange text-white grid place-items-center disabled:opacity-40 hover:bg-orange-hover transition-colors flex-shrink-0"
          aria-label="Envoyer"
        >
          {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
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
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400" aria-label="Fermer">
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
            <div className="p-8 text-center text-gray-400 text-sm">
              {contacts.length === 0
                ? "Vous n'avez pas encore de contact dans votre réseau. La gestion des invitations arrive bientôt."
                : 'Aucun contact ne correspond.'}
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
