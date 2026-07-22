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
import { preparerFichierMessage, cheminFichierMessage } from '@/lib/messagerie-fichiers'

export type TypeMessage =
  | 'texte' | 'vocal' | 'photo' | 'document' | 'devis' | 'facture' | 'chantier' | 'systeme'

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

/** Pièce jointe d'un message (photo / document / devis / facture / vocal). */
export interface PieceJointe {
  id: string
  message_id: string
  type_pj: 'photo' | 'document' | 'vocal' | 'devis' | 'facture'
  fichier_path: string | null
  nom: string | null
  mime_type: string | null
  taille_octets: number | null
  devis_id: string | null
  facture_id: string | null
  transcription: string | null
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
  /** Pièces jointes chargées avec le message (embed PostgREST). */
  pieces?: PieceJointe[]
}

export interface Contact {
  user_id: string
  nom: string | null
  metier: string | null
  email: string | null
  type_relation: string
}

/** Un devis/facture proposé au partage dans le sélecteur « carte vivante ». */
export interface DocPartageable {
  id: string
  numero: string | null
  client_nom: string | null
  objet: string | null
  montant_ttc: number | null
  statut: string | null
  date_emission: string | null
}

/** Snapshot figé d'un document partagé (stocké dans messages.contenu, JSON). */
export interface SnapshotDoc {
  type: 'devis' | 'facture'
  numero: string | null
  client: string | null
  objet: string | null
  montant_ttc: number | null
  statut: string | null
}

/** Parse le snapshot JSON d'un message de type devis/facture. Null si illisible. */
export function parseSnapshotDoc(contenu: string | null): SnapshotDoc | null {
  if (!contenu) return null
  try {
    const o = JSON.parse(contenu)
    if (o && (o.type === 'devis' || o.type === 'facture')) return o as SnapshotDoc
  } catch { /* contenu non-JSON : pas un snapshot */ }
  return null
}

/** Un chantier proposé au partage (fiche « carte vivante »). */
export interface ChantierPartageable {
  id: string
  titre: string | null
  adresse_chantier: string | null
  ville_chantier: string | null
  statut: string | null
  date_debut: string | null
}

/** Snapshot figé d'une fiche chantier partagée (dans messages.contenu, JSON).
 *  Décision produit : infos de travail + identité client, JAMAIS de financier. */
export interface SnapshotChantier {
  type: 'chantier'
  chantier_id: string | null
  titre: string | null
  description: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  statut: string | null
  client: string | null
  client_tel: string | null
}

/** Parse le snapshot JSON d'un message de type chantier. Null si illisible. */
export function parseSnapshotChantier(contenu: string | null): SnapshotChantier | null {
  if (!contenu) return null
  try {
    const o = JSON.parse(contenu)
    if (o && o.type === 'chantier') return o as SnapshotChantier
  } catch { /* contenu non-JSON */ }
  return null
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
// useDocumentsPartageables — mes devis + factures récents (sélecteur « carte
// vivante »). La RLS ne me renvoie que les miens. Chargé au montage, donc à
// l'ouverture du sélecteur.
// ----------------------------------------------------------------------------
export function useDocumentsPartageables(): {
  devis: DocPartageable[]
  factures: DocPartageable[]
  loading: boolean
} {
  const [devis, setDevis] = useState<DocPartageable[]>([])
  const [factures, setFactures] = useState<DocPartageable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function run() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancel) setLoading(false); return }
      // On ne propose QUE mes propres documents (user_id = moi) : c'est ce que
      // la RPC de partage accepte (elle vérifie la propriété par user_id). Évite
      // qu'un membre voie un devis d'un collègue puis échoue au partage.
      const cols = 'id, numero, client_nom, objet, montant_ttc, statut, date_emission'
      const [d, f] = await Promise.all([
        supabase.from('devis').select(cols).eq('user_id', user.id).is('deleted_at', null).order('date_emission', { ascending: false }).limit(40),
        supabase.from('factures').select(cols).eq('user_id', user.id).is('deleted_at', null).order('date_emission', { ascending: false }).limit(40),
      ])
      if (cancel) return
      setDevis((d.data ?? []) as DocPartageable[])
      setFactures((f.data ?? []) as DocPartageable[])
      setLoading(false)
    }
    run()
    return () => { cancel = true }
  }, [])

  return { devis, factures, loading }
}

// ----------------------------------------------------------------------------
// useChantiersPartageables — mes chantiers récents (sélecteur « fiche chantier »).
// ----------------------------------------------------------------------------
export function useChantiersPartageables(): {
  chantiers: ChantierPartageable[]
  loading: boolean
} {
  const [chantiers, setChantiers] = useState<ChantierPartageable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function run() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancel) setLoading(false); return }
      const { data } = await supabase
        .from('chantiers')
        .select('id, titre, adresse_chantier, ville_chantier, statut, date_debut')
        .eq('user_id', user.id)
        .order('date_debut', { ascending: false, nullsFirst: false })
        .limit(40)
      if (cancel) return
      setChantiers((data ?? []) as ChantierPartageable[])
      setLoading(false)
    }
    run()
    return () => { cancel = true }
  }, [])

  return { chantiers, loading }
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
      .select('*, pieces:message_pieces_jointes(*)')
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
          // Le payload temps réel ne contient QUE la ligne `messages` (pas ses
          // pièces jointes). Pour un message porteur d'une PJ (photo/document/
          // devis/facture), on va chercher la PJ avant d'afficher, pour ne pas
          // montrer une bulle vide en attendant un rafraîchissement.
          const avecPj = m.type_message !== 'texte' && m.type_message !== 'systeme'
          if (avecPj) {
            supabase
              .from('message_pieces_jointes')
              .select('*')
              .eq('message_id', m.id)
              .then(({ data }) => {
                setMessages((prev) =>
                  prev.some((x) => x.id === m.id)
                    ? prev
                    : [...prev, { ...m, pieces: (data ?? []) as PieceJointe[] }],
                )
              })
          } else {
            setMessages((prev) => [...prev, m])
          }
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

/**
 * Envoie une pièce jointe (photo/document). Upload dans le bucket privé
 * 'messagerie' (RLS = membre de la conversation), puis crée le message et sa
 * ligne message_pieces_jointes. Renvoie le message AVEC sa PJ (affichage
 * optimiste). Nettoyage best-effort du fichier orphelin en cas d'échec.
 */
export async function envoyerPieceJointe(
  conversationId: string,
  file: File,
  clientMessageId?: string,
): Promise<MessageRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')

  // Peut lever JustificatifError (message français prêt à afficher).
  const pret = await preparerFichierMessage(file)
  const chemin = cheminFichierMessage(conversationId, pret.nom)

  const { error: upErr } = await supabase.storage
    .from('messagerie')
    .upload(chemin, pret.blob, { contentType: pret.contentType, upsert: false })
  if (upErr) {
    console.error('Upload pièce jointe impossible', upErr)
    throw new Error("Impossible d'envoyer ce fichier. Vérifiez votre connexion et réessayez.")
  }

  // Message + pièce jointe en UNE transaction (RPC atomique) : le temps réel
  // ne diffuse qu'au commit, donc la PJ existe toujours quand le destinataire
  // la relit (corrige la course « bulle pièce jointe figée »).
  const { data: msgId, error: rpcErr } = await supabase.rpc('envoyer_message_piece_jointe', {
    p_conversation_id: conversationId,
    p_type_pj: pret.typePj,
    p_fichier_path: chemin,
    p_nom: pret.nom,
    p_mime: pret.contentType,
    p_taille: pret.blob.size,
    p_client_message_id: clientMessageId ?? null,
  })
  if (rpcErr || !msgId) {
    // La transaction a été annulée (aucun message diffusé) : on nettoie le fichier.
    try { await supabase.storage.from('messagerie').remove([chemin]) } catch { /* best-effort */ }
    throw new Error(rpcErr?.message || "L'envoi a échoué.")
  }

  // Relecture du message complet (avec sa PJ) pour l'affichage optimiste immédiat.
  const { data: row } = await supabase
    .from('messages')
    .select('*, pieces:message_pieces_jointes(*)')
    .eq('id', msgId as string)
    .single()
  if (row) return row as MessageRow

  // Repli si la relecture échoue : ligne minimale cohérente (le temps réel /
  // un refetch corrigeront si besoin).
  return {
    id: msgId as string,
    conversation_id: conversationId,
    expediteur_id: user.id,
    contenu: null,
    type_message: pret.typePj,
    reply_to_id: null,
    client_message_id: clientMessageId ?? null,
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
    pieces: [{
      id: `local-${msgId}`,
      message_id: msgId as string,
      type_pj: pret.typePj,
      fichier_path: chemin,
      nom: pret.nom,
      mime_type: pret.contentType,
      taille_octets: pret.blob.size,
      devis_id: null,
      facture_id: null,
      transcription: null,
    }],
  }
}

/** URL signée temporaire (1 h) pour afficher/télécharger une pièce jointe. */
export async function urlSigneeMessagerie(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from('messagerie').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) {
    console.error('URL signée messagerie impossible', error)
    return null
  }
  return data.signedUrl
}

/**
 * Partage un devis/facture dans la conversation (« carte vivante »). Le snapshot
 * (numéro, client, montant, statut) est figé CÔTÉ SERVEUR par la RPC à partir du
 * document que je possède — le destinataire n'y a pas accès via RLS. Le message
 * s'affiche ensuite via le temps réel + le refetch déclenché par l'appelant.
 */
export async function partagerDocument(
  conversationId: string,
  type: 'devis' | 'facture',
  refId: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('partager_document', {
    p_conversation_id: conversationId,
    p_type: type,
    p_ref_id: refId,
    p_client_message_id: null,
  })
  if (error) throw new Error(error.message || "Le partage a échoué.")
}

/**
 * Partage une FICHE CHANTIER (« carte vivante »). Le snapshot (infos travail +
 * identité client, SANS financier) est figé côté serveur par la RPC à partir du
 * chantier que je possède. Rien n'est copié dans l'onglet chantier du confrère.
 */
export async function partagerChantier(
  conversationId: string,
  chantierId: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('partager_chantier', {
    p_conversation_id: conversationId,
    p_chantier_id: chantierId,
    p_client_message_id: null,
  })
  if (error) throw new Error(error.message || "Le partage a échoué.")
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
