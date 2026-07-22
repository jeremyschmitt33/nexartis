'use client'

// ============================================================================
// lib/hooks-messagerie.ts — Couche de données de la messagerie entre artisans.
// ----------------------------------------------------------------------------
// Fichier compact et SÉPARÉ de lib/hooks.tsx (suit le style de hooks-equipe.ts) :
//   - 'use client'
//   - createClient depuis '@/lib/supabase/client'
//   - supabase.auth.getUser()
//
// La sécurité réelle est assurée par la RLS Supabase (migration
// 2026-07-22-messagerie-01-fondation). Les noms/métiers des autres artisans
// (invisibles en lecture directe à cause de la RLS de `entreprises`) sont
// résolus par les fonctions SECURITY DEFINER mes_conversations() /
// mes_contacts() / membres_conversation() (migration ...-02-rpc-lecture).
// ============================================================================

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type TypeMessage =
  | 'texte' | 'vocal' | 'photo' | 'document' | 'devis' | 'facture' | 'systeme'

/** Une ligne de la liste d'accueil (renvoyée par la fonction mes_conversations). */
export interface ConversationListItem {
  id: string
  type: 'direct' | 'groupe'
  titre: string | null
  chantier_id: string | null
  consigne: string | null
  dernier_message_at: string | null
  mon_dernier_lu_at: string | null
  role_conv: 'admin' | 'membre'
  autre_user_id: string | null
  autre_nom: string | null
  autre_metier: string | null
  apercu: string | null
  apercu_type: TypeMessage | null
  apercu_expediteur: string | null
  apercu_at: string | null
  non_lus: number
}

export interface MessageRow {
  id: string
  conversation_id: string
  expediteur_id: string | null
  contenu: string | null
  type_message: TypeMessage
  reply_to_id: string | null
  client_message_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

export interface Contact {
  user_id: string
  nom: string | null
  metier: string | null
  email: string | null
  type_relation: string
}

export interface MembreConversation {
  user_id: string
  nom: string | null
  metier: string | null
  role_conv: string
}

/** Nom affichable d'une conversation (1-à-1 : nom de l'autre ; groupe : titre). */
export function nomConversation(c: ConversationListItem): string {
  if (c.type === 'direct') return c.autre_nom || 'Artisan Nexartis'
  return c.titre || 'Groupe de chantier'
}

// ----------------------------------------------------------------------------
// useConversations — la liste d'accueil (via la fonction mes_conversations()).
// ----------------------------------------------------------------------------
export function useConversations(): {
  conversations: ConversationListItem[]
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non connecté'); setLoading(false); return }
    const { data, error: err } = await supabase.rpc('mes_conversations')
    if (err) { setError(err.message); setLoading(false); return }
    setConversations((data ?? []) as ConversationListItem[])
    setLoading(false)
  }, [])

  // Rafraîchissement léger : la liste n'a pas d'abonnement temps réel dédié
  // (seul le fil ouvert en a un). On la resynchronise périodiquement, en pause
  // quand l'onglet est masqué, pour voir arriver les messages des AUTRES fils.
  useEffect(() => {
    fetch()
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      fetch()
    }, 15000)
    return () => clearInterval(iv)
  }, [fetch])

  return { conversations, loading, error, refetch: fetch }
}

// ----------------------------------------------------------------------------
// useContacts — avec qui je peux démarrer un chat (réseau accepté + équipe).
// ----------------------------------------------------------------------------
export function useContacts(): {
  contacts: Contact[]
  loading: boolean
  refetch: () => void
} {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setContacts([]); setLoading(false); return }
    const { data } = await supabase.rpc('mes_contacts')
    setContacts((data ?? []) as Contact[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { contacts, loading, refetch: fetch }
}

// ----------------------------------------------------------------------------
// useMessages — le fil d'une conversation + réception temps réel.
// ----------------------------------------------------------------------------
export function useMessages(conversationId: string | null): {
  messages: MessageRow[]
  loading: boolean
  error: string | null
  refetch: () => void
  ajouterLocal: (m: MessageRow) => void
} {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Garde une réf pour éviter les doublons à la réception temps réel.
  const idsRef = useRef<Set<string>>(new Set())

  const fetch = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return }
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    const rows = (data ?? []) as MessageRow[]
    idsRef.current = new Set(rows.map((m) => m.id))
    setMessages(rows)
    setLoading(false)
  }, [conversationId])

  useEffect(() => { fetch() }, [fetch])

  // Réception temps réel des nouveaux messages de CETTE conversation.
  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as MessageRow
          if (!m || idsRef.current.has(m.id)) return
          if (m.deleted_at) return
          idsRef.current.add(m.id)
          setMessages((prev) => [...prev, m])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Ajout local immédiat (affichage optimiste d'un message qu'on vient d'envoyer).
  // La dédup par idsRef évite le doublon quand le temps réel relivre le même id.
  const ajouterLocal = useCallback((m: MessageRow) => {
    if (idsRef.current.has(m.id)) return
    idsRef.current.add(m.id)
    setMessages((prev) => [...prev, m])
  }, [])

  return { messages, loading, error, refetch: fetch, ajouterLocal }
}

// ----------------------------------------------------------------------------
// useMembresConversation — participants (via membres_conversation()).
// ----------------------------------------------------------------------------
export function useMembresConversation(conversationId: string | null): {
  membres: MembreConversation[]
  loading: boolean
} {
  const [membres, setMembres] = useState<MembreConversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!conversationId) { setMembres([]); setLoading(false); return }
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('membres_conversation', {
        p_conversation_id: conversationId,
      })
      if (!cancelled) {
        setMembres((data ?? []) as MembreConversation[])
        setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [conversationId])

  return { membres, loading }
}

// ----------------------------------------------------------------------------
// Actions (fonctions simples, pas des hooks).
// ----------------------------------------------------------------------------

/** Envoie un message texte. Renvoie la ligne insérée. */
export async function envoyerMessage(
  conversationId: string,
  contenu: string,
  clientMessageId?: string,
): Promise<MessageRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      expediteur_id: user.id,
      contenu,
      type_message: 'texte',
      ...(clientMessageId ? { client_message_id: clientMessageId } : {}),
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as MessageRow
}

/** Marque la conversation comme lue jusqu'à maintenant. */
export async function marquerLue(conversationId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('conversation_membres')
    .update({ dernier_lu_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
}

/** Ouvre (ou retrouve) le chat 1-à-1 avec un contact. Renvoie l'id de conversation. */
export async function ouvrirChatDirect(autreUserId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('trouver_ou_creer_direct', {
    p_autre: autreUserId,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Renomme une conversation (réservé admin/créateur par la RLS). */
export async function renommerConversation(
  conversationId: string,
  titre: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ titre })
    .eq('id', conversationId)
  if (error) throw new Error(error.message)
}

/** Met à jour la consigne épinglée (note d'en-tête). */
export async function definirConsigne(
  conversationId: string,
  consigne: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { error } = await supabase
    .from('conversations')
    .update({
      consigne,
      consigne_par: user.id,
      consigne_maj_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
  if (error) throw new Error(error.message)
}
