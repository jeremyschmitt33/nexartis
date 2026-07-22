'use client'

// ============================================================================
// app/dashboard/reseau/page.tsx — "Mon réseau" (Phase 1 des invitations).
// ----------------------------------------------------------------------------
// 3 onglets : Contacts (relations acceptées) / Demandes reçues / Invitations
// envoyées. + "Ajouter un confrère" par email (avec lien partageable).
// 100% entre artisans Nexartis. Sécurité assurée en base (RLS + RPC).
// ============================================================================

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContacts, ouvrirChatDirect, type Contact } from '@/lib/hooks-messagerie'
import {
  useDemandesRecues, useInvitationsEnvoyees,
  envoyerInvitation, repondreInvitation, supprimerRelation,
  type ResultatEnvoi,
} from '@/lib/hooks-reseau'
import {
  Users, UserPlus, Search, Check, X, Clock, MessageCircle,
  Loader2, Copy, Ban, Mail, CheckCircle2,
} from 'lucide-react'

function initiales(nom: string | null | undefined): string {
  if (!nom) return '?'
  const m = nom.trim().split(/\s+/)
  if (m.length === 1) return m[0].slice(0, 2).toUpperCase()
  return (m[0][0] + m[m.length - 1][0]).toUpperCase()
}

type Onglet = 'contacts' | 'demandes' | 'envoyees'

export default function ReseauPage() {
  const router = useRouter()
  const { contacts, loading: loadingContacts, refetch: refetchContacts } = useContacts()
  const { demandes, loading: loadingDemandes, refetch: refetchDemandes } = useDemandesRecues()
  const { invitations, loading: loadingInv, refetch: refetchInv } = useInvitationsEnvoyees()

  const [onglet, setOnglet] = useState<Onglet>('contacts')
  const [recherche, setRecherche] = useState('')
  const [showAjout, setShowAjout] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const contactsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      (c.nom || '').toLowerCase().includes(q) ||
      (c.metier || '').toLowerCase().includes(q),
    )
  }, [contacts, recherche])

  async function discuter(contact: Contact) {
    setBusy(contact.user_id)
    try {
      await ouvrirChatDirect(contact.user_id)
      router.push('/dashboard/messagerie')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function repondre(relationId: string, action: 'accepter' | 'refuser' | 'bloquer') {
    setBusy(relationId)
    try {
      await repondreInvitation(relationId, action)
      refetchDemandes(); refetchContacts()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function annuler(relationId: string) {
    setBusy(relationId)
    try {
      await supprimerRelation(relationId)
      refetchInv()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const tabBtn = (id: Onglet, label: string, count: number, badge = false) => (
    <button
      onClick={() => setOnglet(id)}
      className={`relative pb-2.5 px-1 text-sm font-semibold transition-colors ${
        onglet === id ? 'text-navy' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
          badge ? 'bg-orange text-white' : 'bg-gray-100 text-gray-500'
        }`}>{count}</span>
      )}
      {onglet === id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-orange rounded-full" />}
    </button>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">Échangez avec les autres artisans de votre réseau.</p>
        <button
          onClick={() => setShowAjout(true)}
          className="h-10 pl-3 pr-4 rounded-xl bg-orange text-white flex items-center gap-2 text-sm font-semibold hover:bg-orange-hover transition-colors shadow-sm shadow-orange/30"
        >
          <UserPlus className="w-4 h-4" /> Ajouter un confrère
        </button>
      </div>

      <div className="flex gap-6 border-b border-gray-100 mb-5">
        {tabBtn('contacts', 'Contacts', contacts.length)}
        {tabBtn('demandes', 'Demandes', demandes.length, true)}
        {tabBtn('envoyees', 'Envoyées', invitations.length)}
      </div>

      {/* ── Contacts ─────────────────────────────────────────────── */}
      {onglet === 'contacts' && (
        <div>
          {contacts.length > 3 && (
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un contact…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
              />
            </div>
          )}
          {loadingContacts ? (
            <SkeletonList />
          ) : contactsFiltres.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-sky" />}
              titre={recherche ? 'Aucun résultat.' : 'Aucun contact pour le moment'}
              texte={recherche ? '' : 'Ajoutez un confrère pour commencer à échanger, en toute confidentialité.'}
              action={!recherche ? { label: 'Ajouter un confrère', onClick: () => setShowAjout(true) } : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {contactsFiltres.map((c) => (
                <li key={c.user_id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <Avatar nom={c.nom} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy text-sm truncate">{c.nom || c.email || 'Artisan Nexartis'}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {c.metier || (c.type_relation === 'equipe' ? 'Mon équipe' : 'Confrère')}
                    </div>
                  </div>
                  <button
                    onClick={() => discuter(c)}
                    disabled={busy === c.user_id}
                    className="h-9 px-3 rounded-lg bg-navy text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-navy-mid transition-colors disabled:opacity-40"
                  >
                    {busy === c.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    Discuter
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Demandes reçues ──────────────────────────────────────── */}
      {onglet === 'demandes' && (
        <div>
          {loadingDemandes ? (
            <SkeletonList />
          ) : demandes.length === 0 ? (
            <EmptyState icon={<Clock className="w-8 h-8 text-sky" />} titre="Aucune demande en attente" texte="Les invitations que vous recevez apparaîtront ici." />
          ) : (
            <ul className="space-y-2">
              {demandes.map((d) => (
                <li key={d.relation_id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar nom={d.nom} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-navy text-sm truncate">{d.nom || 'Artisan Nexartis'}</div>
                      <div className="text-xs text-gray-400 truncate">{d.metier || 'Confrère'}</div>
                    </div>
                  </div>
                  {d.mot && <p className="text-[13px] text-gray-500 italic mt-2 pl-1 border-l-2 border-gray-100 ml-1 py-0.5 px-2">« {d.mot} »</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => repondre(d.relation_id, 'accepter')}
                      disabled={busy === d.relation_id}
                      className="flex-1 h-9 rounded-lg bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors disabled:opacity-40"
                    >
                      <Check className="w-4 h-4" /> Accepter
                    </button>
                    <button
                      onClick={() => repondre(d.relation_id, 'refuser')}
                      disabled={busy === d.relation_id}
                      className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-40"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => repondre(d.relation_id, 'bloquer')}
                      disabled={busy === d.relation_id}
                      title="Bloquer"
                      className="h-9 w-9 grid place-items-center rounded-lg bg-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Invitations envoyées ─────────────────────────────────── */}
      {onglet === 'envoyees' && (
        <div>
          {loadingInv ? (
            <SkeletonList />
          ) : invitations.length === 0 ? (
            <EmptyState icon={<Mail className="w-8 h-8 text-sky" />} titre="Aucune invitation en attente" texte="Les confrères que vous invitez apparaîtront ici tant qu'ils n'ont pas répondu." />
          ) : (
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li key={inv.relation_id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 grid place-items-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy text-sm truncate">{inv.destinataire_nom || inv.destinataire_email || 'Invitation'}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {inv.deja_inscrit ? 'Membre Nexartis · en attente de réponse' : 'Invité par email · en attente'}
                    </div>
                  </div>
                  <CopierLien token={inv.lien_token} />
                  <button
                    onClick={() => annuler(inv.relation_id)}
                    disabled={busy === inv.relation_id}
                    title="Annuler"
                    className="h-9 w-9 grid place-items-center rounded-lg bg-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAjout && (
        <AjoutModal
          onClose={() => setShowAjout(false)}
          onDone={() => { refetchInv() }}
        />
      )}
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Avatar({ nom }: { nom: string | null }) {
  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky to-navy text-white grid place-items-center font-bold text-sm flex-shrink-0">
      {initiales(nom)}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
    </div>
  )
}

function EmptyState({ icon, titre, texte, action }: {
  icon: React.ReactNode; titre: string; texte: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="text-center py-14">
      <div className="w-16 h-16 rounded-3xl bg-sky/10 grid place-items-center mx-auto mb-4">{icon}</div>
      <p className="text-sm font-semibold text-navy">{titre}</p>
      {texte && <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">{texte}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange text-white text-sm font-semibold hover:bg-orange-hover transition-colors">
          <UserPlus className="w-4 h-4" /> {action.label}
        </button>
      )}
    </div>
  )
}

function CopierLien({ token }: { token: string }) {
  const [copie, setCopie] = useState(false)
  function copier() {
    const url = `${window.location.origin}/invitation/${token}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1800) }).catch(() => {})
    }
  }
  return (
    <button onClick={copier} title="Copier le lien d'invitation" className="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-200 transition-colors">
      {copie ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      {copie ? 'Copié' : 'Lien'}
    </button>
  )
}

function AjoutModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [mot, setMot] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState<ResultatEnvoi | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [copie, setCopie] = useState(false)

  async function envoyer() {
    const e = email.trim()
    if (!e || envoi) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErreur('Adresse email invalide.'); return }
    setEnvoi(true); setErreur(null)
    try {
      const res = await envoyerInvitation(e, mot)
      setResultat(res)
      onDone()
    } catch (err) {
      setErreur((err as Error).message)
    } finally {
      setEnvoi(false)
    }
  }

  function copierLien() {
    if (!resultat) return
    const url = `${window.location.origin}/invitation/${resultat.lien_token}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1800) }).catch(() => {})
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-navy font-manrope">Ajouter un confrère</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center text-gray-400 hover:text-navy transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {resultat ? (
          <div className="p-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 grid place-items-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="font-semibold text-navy">
              {resultat.deja_relie ? 'Vous êtes déjà en relation'
                : resultat.destinataire_existe ? 'Demande envoyée'
                : resultat.email_envoye ? 'Invitation envoyée' : 'Invitation créée'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {resultat.deja_relie
                ? 'Ce confrère fait déjà partie de votre réseau.'
                : resultat.destinataire_existe
                  ? 'Ce confrère est déjà sur Nexartis : il recevra votre demande dans son espace.'
                  : resultat.email_envoye
                    ? 'Un email vient de partir. Vous pouvez aussi lui envoyer le lien vous-même :'
                    : "L'email n'a pas pu être envoyé automatiquement. Copiez le lien ci-dessous et envoyez-le-lui :"}
            </p>
            {!resultat.destinataire_existe && !resultat.deja_relie && (
              <button onClick={copierLien} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-navy text-sm font-semibold hover:bg-gray-200 transition-colors">
                {copie ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copie ? 'Lien copié' : "Copier le lien d'invitation"}
              </button>
            )}
            <button onClick={onClose} className="block w-full mt-4 h-11 rounded-xl bg-navy text-white font-semibold hover:bg-navy-mid transition-colors">Terminé</button>
          </div>
        ) : (
          <div className="p-5">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email du confrère</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="confrere@exemple.fr"
              className="w-full h-11 px-4 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40"
            />
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 mt-4">Petit mot (optionnel)</label>
            <textarea
              value={mot}
              onChange={(e) => setMot(e.target.value)}
              rows={2}
              placeholder="On a bossé ensemble sur le chantier des Lilas…"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky/40 resize-none"
            />
            {erreur && <p className="text-sm text-red-500 mt-3">{erreur}</p>}
            <button
              onClick={envoyer}
              disabled={!email.trim() || envoi}
              className="w-full mt-4 h-11 rounded-xl bg-orange text-white font-semibold flex items-center justify-center gap-2 hover:bg-orange-hover transition-colors disabled:opacity-40"
            >
              {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              Envoyer l'invitation
            </button>
            <p className="text-[11px] text-gray-400 mt-3 text-center leading-relaxed">
              S'il est déjà sur Nexartis, il recevra la demande dans son espace. Sinon, il recevra un email l'invitant à vous rejoindre.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
