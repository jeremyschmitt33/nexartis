'use client'

/**
 * Page Aide & Tutoriels — centre d'aide intégré.
 *
 * 4 sections en accordéons :
 *   1. Bien démarrer — Compléter son profil entreprise
 *   2. Devis et factures — Les bases qui changent tout
 *   3. Le flux complet — Devis → Chantier → Planning → Facture
 *   4. Abonnement et paiement
 *
 * Les sections 1 et 2 ont un bouton "Rejouer cette visite guidée"
 * qui réinitialise l'étape d'onboarding correspondante puis
 * redirige vers la page d'origine du tutoriel.
 *
 * Accessible depuis la sidebar (entrée "Aide & Tutoriels", groupe
 * séparé en bas).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/hooks'
import {
  Building2,
  FileText,
  Workflow,
  CreditCard,
  ChevronDown,
  PlayCircle,
  LifeBuoy,
  CheckCircle2,
} from 'lucide-react'

type Section = {
  id: string
  icon: React.ElementType
  title: string
  subtitle: string
  replayStep?: 'dashboard' | 'devis'
  replayHref?: string
  // Contenu structuré en blocs (paragraphes + listes)
  content: React.ReactNode
}

export default function AidePage() {
  const [openId, setOpenId] = useState<string | null>('demarrer')
  const router = useRouter()
  const { replayStep, loading } = useOnboarding()

  // Replay d'une étape : on remet la base à zéro puis on redirige
  // vers la page où le tutoriel se déclenche automatiquement.
  async function handleReplay(step: 'dashboard' | 'devis', href: string) {
    if (loading) return
    await replayStep(step)
    router.push(href)
  }

  const sections: Section[] = [
    {
      id: 'demarrer',
      icon: Building2,
      title: 'Bien démarrer — Compléter son profil entreprise',
      subtitle: 'La toute première chose à faire pour avoir des devis et factures pro',
      replayStep: 'dashboard',
      replayHref: '/dashboard',
      content: (
        <>
          <p className="mb-4">
            Le profil entreprise est le <strong>cœur de Nexartis</strong>. Une fois rempli, toutes
            tes informations légales (SIRET, raison sociale, adresse, mentions, logo, IBAN…)
            sont <strong>automatiquement insérées</strong> dans chacun de tes devis et chacune de
            tes factures. Tu n&apos;as plus jamais à les retaper.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Champs obligatoires par la loi française
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Raison sociale et SIRET (visibles sur tous les documents)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Adresse complète du siège (numéro, rue, code postal, ville)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Forme juridique (SARL, EURL, micro-entreprise, etc.)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Téléphone et email professionnels</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Assurance décennale (nom de l&apos;assureur, n° de police, zone couverte) — obligatoire pour le BTP</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Champs très recommandés
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Logo</strong> : apparaît en haut de tes PDFs, donne une image professionnelle</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>IBAN/BIC</strong> : pour que le client puisse te virer le paiement directement</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Signature</strong> : signe une fois pour toutes, elle est ajoutée automatiquement aux PDFs</span></li>
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-5">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>À noter :</strong> tant que les champs obligatoires ne sont pas remplis,
              Nexartis affiche un bandeau d&apos;alerte sur le tableau de bord et un badge
              &laquo;&nbsp;Devis incomplet&nbsp;&raquo; sur les devis concernés.
              Tes documents <strong>ne seront pas pleinement conformes à la loi</strong> tant que
              ton profil est incomplet.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'devis',
      icon: FileText,
      title: 'Devis et factures — Les bases qui changent tout',
      subtitle: 'Autocomplete client, bibliothèque de prestations, acompte, statuts',
      replayStep: 'devis',
      replayHref: '/dashboard/devis/nouveau',
      content: (
        <>
          <p className="mb-4">
            Les devis et factures partagent le même fonctionnement. Tout ce que tu saisis
            est <strong>réutilisable</strong> et la majorité des données sont reprises
            automatiquement quand tu passes d&apos;un devis à une facture.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            L&apos;autocomplete client
          </h4>
          <p className="mb-3">
            Quand tu commences à taper le nom d&apos;un client dans un devis,
            Nexartis cherche dans ta base et te propose les correspondances. Choisis-en un,
            et toutes les coordonnées (adresse, code postal, ville, téléphone, email) se
            remplissent toutes seules. Plus de double saisie.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            La bibliothèque de prestations
          </h4>
          <p className="mb-3">
            Chaque ligne que tu ajoutes à un devis (désignation, prix unitaire, unité) est
            enregistrée. Tu retrouves toute ta bibliothèque dans la sidebar via
            <strong> Prestations</strong>. La prochaine fois, tu pourras réutiliser une
            prestation existante en quelques clics au lieu de tout retaper.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Sections, acompte, marges
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Sections</strong> : structure ton devis (Démolition, Plomberie, Finitions…) pour plus de lisibilité côté client</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Acompte</strong> : demande un acompte en % ou en € directement dans le devis. Mention automatique sur le PDF</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Marges</strong> : visibles uniquement pour toi, jamais imprimées sur le PDF client. Permet de suivre ta rentabilité</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les statuts (devis)
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" /><span><strong>Brouillon</strong> — Pas encore envoyé au client</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" /><span><strong>Envoyé</strong> — Envoyé par email au client</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" /><span><strong>Accepté</strong> — Le client a signé en ligne via le lien unique. Nexartis te propose de créer le chantier</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /><span><strong>Refusé</strong> — Le client a refusé. Tu peux renégocier en duplicant le devis</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" /><span><strong>Expiré</strong> — Passé la date de validité sans réponse. À relancer ou archiver</span></li>
          </ul>
        </>
      ),
    },
    {
      id: 'flux',
      icon: Workflow,
      title: 'Le flux complet — Devis → Chantier → Planning → Facture',
      subtitle: 'Comment tout se lie automatiquement dans Nexartis',
      content: (
        <>
          <p className="mb-4">
            Nexartis n&apos;est pas qu&apos;un outil de devis. C&apos;est un <strong>flux complet</strong>
            qui te suit du premier contact client jusqu&apos;au paiement final, en évitant les
            doubles saisies à chaque étape.
          </p>

          <ol className="space-y-4 mt-5">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-navy text-white font-syne font-bold text-sm flex items-center justify-center" style={{background: '#0f1a3a'}}>1</span>
              <div>
                <p className="font-syne font-bold text-[14px] text-navy mb-1">Tu crées un devis</p>
                <p className="text-[13px] text-gray-600">Tu remplis le client, les prestations, l&apos;acompte éventuel. Tu envoies par email au client (Nexartis génère le PDF + un lien de signature en ligne).</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full text-white font-syne font-bold text-sm flex items-center justify-center" style={{background: '#0f1a3a'}}>2</span>
              <div>
                <p className="font-syne font-bold text-[14px] text-navy mb-1">Le client signe en ligne</p>
                <p className="text-[13px] text-gray-600">Le devis passe en <strong>Accepté</strong>. Tu reçois une notification. Nexartis te propose de créer le chantier associé en un clic.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full text-white font-syne font-bold text-sm flex items-center justify-center" style={{background: '#0f1a3a'}}>3</span>
              <div>
                <p className="font-syne font-bold text-[14px] text-navy mb-1">Tu crées le chantier</p>
                <p className="text-[13px] text-gray-600">Le devis est rattaché. Depuis le chantier, tu peux planifier les interventions dans le planning, assigner des intervenants, ajouter des notes privées ou des notes client.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full text-white font-syne font-bold text-sm flex items-center justify-center" style={{background: '#0f1a3a'}}>4</span>
              <div>
                <p className="font-syne font-bold text-[14px] text-navy mb-1">Tu génères la facture</p>
                <p className="text-[13px] text-gray-600">Une fois le chantier terminé, un bouton &laquo;&nbsp;Générer la facture&nbsp;&raquo; reprend automatiquement toutes les lignes du devis. Tu peux ajuster (heures réelles, matériel ajouté) avant d&apos;envoyer.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full text-white font-syne font-bold text-sm flex items-center justify-center" style={{background: '#0f1a3a'}}>5</span>
              <div>
                <p className="font-syne font-bold text-[14px] text-navy mb-1">Le client paie</p>
                <p className="text-[13px] text-gray-600">Tu marques la facture comme payée. Le chantier passe en <strong>Clôturé</strong>. Ton tableau de bord se met à jour automatiquement (CA encaissé, taux de conversion).</p>
              </div>
            </li>
          </ol>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-6">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Le bénéfice :</strong> tu saisis chaque information <strong>une seule fois</strong>.
              Le client n&apos;est créé qu&apos;une fois, les prestations sont réutilisables, et tout
              le flux devis → facture se fait sans recopier.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'abonnement',
      icon: CreditCard,
      title: 'Abonnement et paiement',
      subtitle: 'Essai gratuit, abonnement mensuel, gestion via Stripe',
      content: (
        <>
          <p className="mb-4">
            Nexartis te laisse <strong>14 jours d&apos;essai gratuit complet</strong>, sans carte
            bancaire. Tu as accès à toutes les fonctionnalités, sans limite.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Pendant l&apos;essai
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-green-600 font-bold flex-shrink-0">✓</span><span>Création illimitée de devis, factures, chantiers, clients</span></li>
            <li className="flex gap-2"><span className="text-green-600 font-bold flex-shrink-0">✓</span><span>Accès à tout le planning, à la bibliothèque, aux statistiques</span></li>
            <li className="flex gap-2"><span className="text-green-600 font-bold flex-shrink-0">✓</span><span>Bandeau orange à l&apos;approche de la fin d&apos;essai (J-7)</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            À la fin de l&apos;essai
          </h4>
          <p className="mb-3">
            Tu peux souscrire un abonnement mensuel via <strong>Stripe</strong>
            (paiement sécurisé, possibilité de résilier à tout moment). Tu retrouves
            le bouton &laquo;&nbsp;Souscrire&nbsp;&raquo; dans l&apos;onglet <strong>Abonnement</strong>
            de la sidebar.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>Si tu ne souscris pas :</strong> tes données sont <strong>conservées en sécurité</strong>
              (jamais supprimées). Tu peux te reconnecter à tout moment pour consulter et exporter.
              Seules la création et la modification sont mises en pause tant que l&apos;abonnement
              n&apos;est pas activé.
            </p>
          </div>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Gérer ton abonnement
          </h4>
          <p className="mb-2">
            Depuis l&apos;onglet <strong>Abonnement</strong> tu peux à tout moment :
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Voir ton statut actuel (essai, actif, suspendu)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Consulter ton historique de paiements</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Mettre à jour ta carte bancaire via le portail Stripe</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Résilier l&apos;abonnement (sans frais, prend effet à la fin du mois en cours)</span></li>
          </ul>
        </>
      ),
    },
  ]

  return (
    <div className="min-h-screen" style={{background: '#f6f8fb'}}>
      <div className="max-w-[960px] mx-auto px-4 py-6 sm:px-6 sm:py-10">

        {/* ============ HEADER ============ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="font-syne font-extrabold text-2xl sm:text-3xl text-navy leading-tight" style={{color: '#0f1a3a', letterSpacing: '-0.02em'}}>
                Aide &amp; Tutoriels
              </h1>
              <p className="font-manrope text-sm text-gray-500 mt-0.5">
                Tout ce qu&apos;il faut savoir pour tirer le meilleur de Nexartis
              </p>
            </div>
          </div>
        </div>

        {/* ============ ACCORDIONS ============ */}
        <div className="space-y-3">
          {sections.map((section) => {
            const Icon = section.icon
            const isOpen = openId === section.id

            return (
              <div
                key={section.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-shadow duration-200"
                style={{boxShadow: isOpen ? '0 4px 16px rgba(15,26,58,0.06)' : '0 1px 2px rgba(15,26,58,0.02), 0 4px 16px rgba(15,26,58,0.045)'}}
              >
                {/* ── Header cliquable ── */}
                <button
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                  className="w-full px-5 sm:px-7 py-5 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors duration-150"
                  aria-expanded={isOpen}
                  aria-controls={`section-${section.id}-content`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200"
                    style={{
                      background: isOpen ? '#0f1a3a' : '#f1f5f9',
                      color: isOpen ? '#fff' : '#445068',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-syne font-bold text-[16px] sm:text-[17px] leading-tight" style={{color: '#0f1a3a'}}>
                      {section.title}
                    </h2>
                    <p className="font-manrope text-[13px] text-gray-500 mt-1 hidden sm:block">
                      {section.subtitle}
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className="text-gray-400 flex-shrink-0 transition-transform duration-300"
                    style={{transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}
                    aria-hidden="true"
                  />
                </button>

                {/* ── Contenu déroulant ── */}
                {isOpen && (
                  <div
                    id={`section-${section.id}-content`}
                    className="px-5 sm:px-7 pb-6 border-t border-gray-100 pt-5"
                  >
                    <div className="font-manrope text-[14px] leading-[1.65]" style={{color: '#374151'}}>
                      {section.content}
                    </div>

                    {/* Bouton de relance du tutoriel guidé */}
                    {section.replayStep && section.replayHref && (
                      <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => handleReplay(section.replayStep!, section.replayHref!)}
                          disabled={loading}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-sm text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{background: '#e87a2a'}}
                        >
                          <PlayCircle size={17} />
                          Rejouer cette visite guidée
                        </button>
                        <p className="text-xs font-manrope text-gray-500">
                          Tu seras redirigé vers la bonne page, et le tutoriel se relancera automatiquement.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ============ FOOTER : CONTACT ============ */}
        <div className="mt-10 p-6 rounded-2xl border border-gray-200 bg-white text-center">
          <p className="font-syne font-bold text-[15px] mb-2" style={{color: '#0f1a3a'}}>
            Tu ne trouves pas ce que tu cherches ?
          </p>
          <p className="font-manrope text-sm text-gray-600 mb-3">
            Écris-nous directement, on te répond généralement sous 24h.
          </p>
          <a
            href="mailto:contact.nexartis@gmail.com"
            className="inline-flex items-center gap-2 font-syne font-bold text-sm text-sky-600 hover:text-sky-700 transition-colors"
          >
            contact.nexartis@gmail.com
          </a>
        </div>

        {/* Spacer bottom (mobile) */}
        <div className="h-10" />
      </div>
    </div>
  )
}
