'use client'

/**
 * Page Aide & Tutoriels — centre d'aide intégré (V3).
 *
 * 44 fiches (dont le Quickstart "Premiers pas" et le Glossaire),
 * regroupées visuellement via le champ optionnel `groupHeading`
 * (posé sur le premier item de chaque groupe) : Premiers pas,
 * Démarrer, Ton quotidien, Tes données, Finances, Outils,
 * Documents & personnalisation, Réglementation, Outils malins &
 * admin, Glossaire.
 *
 * Les sections "profil-entreprise" et "devis" ont un bouton
 * "Rejouer cette visite guidée" qui réinitialise l'étape
 * d'onboarding correspondante puis redirige vers la page d'origine.
 *
 * La barre de recherche filtre en direct la liste des accordéons
 * (sectionMatchesQuery, cherche titre + sous-titre + contenu) ET
 * propose un menu d'autocomplétion (7 suggestions max, titre
 * prioritaire sur contenu) permettant de sauter directement à une
 * fiche et de l'ouvrir.
 *
 * Accessible depuis la sidebar (entrée "Aide & Tutoriels", groupe
 * séparé en bas).
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/hooks'
import { sectionMatchesQuery, normalize } from '@/lib/aide-search'
import {
  Building2,
  FileText,
  Receipt,
  CalendarDays,
  HardHat,
  ShoppingBag,
  Users,
  Warehouse,
  UserRound,
  Wrench,
  Library,
  Home,
  TrendingUp,
  ArrowDownToLine,
  Trash2,
  CreditCard,
  ChevronDown,
  PlayCircle,
  LifeBuoy,
  CheckCircle2,
  MessageCircle,
  Mic,
  Smartphone,
  Palette,
  LayoutDashboard,
  Sparkles,
  AlertTriangle,
  Scale,
  FileCheck2,
  Search,
  SearchX,
  Rocket,
  Ban,
  Compass,
  Layers,
  Undo2,
  ClipboardList,
  Landmark,
  Calculator,
  BookOpen,
  FolderLock,
  ShieldCheck,
  Lock,
  Percent,
  ArrowLeftRight,
  FileSignature,
  Banknote,
  CalendarClock,
  Gift,
  BookA,
  CircleHelp,
  Lightbulb,
  X as XIcon,
  Handshake,
} from 'lucide-react'
import ContactModal from '@/components/dashboard/ContactModal'

// ────────────────────────────────────────────────────────────────
// Composants utilitaires (blocs réutilisés dans le contenu des fiches)
// ────────────────────────────────────────────────────────────────

/** Petit badge doré « Complet », pour les fiches réservées à l'offre Complet. */
function BadgeComplet() {
  return (
    <span
      className="ml-2 inline-block align-middle bg-gradient-to-br from-[#fdf0d5] to-[#f2d495] text-[#8a5a00] text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-[3px] rounded-full border border-[#eccf8a]"
    >
      Complet
    </span>
  )
}

/** Callout bleu (astuce) ou ambre (attention / à savoir). */
function Callout({ type, children }: { type: 'tip' | 'warn'; children: React.ReactNode }) {
  const isTip = type === 'tip'
  return (
    <div
      className={`flex gap-2.5 rounded-lg border p-4 mt-3 mb-2 ${
        isTip ? 'bg-sky-50 border-sky-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      {isTip ? (
        <Lightbulb size={16} className="text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <p className={`text-[13px] font-hanken leading-relaxed ${isTip ? 'text-sky-900' : 'text-amber-900'}`}>
        {children}
      </p>
    </div>
  )
}

/** Liste à puces vertes (coche) — pour les listes "ce que tu obtiens / ce qui est repris". */
function CheckList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mb-4 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Liste à puces flèches oranges — pour les listes descriptives génériques. */
function ArrowList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mb-4 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-orange-600 font-bold flex-shrink-0" aria-hidden="true">→</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Liste numérotée — pour les parcours en étapes (ex. connecter la réception e-facture). */
function StepsList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mb-4 pl-5 list-decimal space-y-1.5 text-[14.5px]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

/** Bloc gris « Fonctions cachées & astuces ». */
function HiddenFunctionsBlock({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4 mb-2">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles size={14} className="text-orange-600 flex-shrink-0" aria-hidden="true" />
        <p className="font-hanken font-bold text-navy text-[13.5px]">Fonctions cachées &amp; astuces</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13.5px] text-gray-700 leading-relaxed">
            <span className="text-orange-600 flex-shrink-0" aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Bloc bleu « Conseils de pro ». */
function ProTipsBlock({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mt-4 mb-2">
      <div className="flex items-center gap-2 mb-2.5">
        <Lightbulb size={14} className="text-sky-700 flex-shrink-0" aria-hidden="true" />
        <p className="font-hanken font-bold text-sky-900 text-[13.5px]">Conseils de pro</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[13.5px] text-sky-900 leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Bloc « Ce que Nexartis ne fait pas (encore) » — honnêteté d'abord. */
function NotYetBlock({ items }: { items: { bold: string; text: React.ReactNode }[] }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 pt-1 pb-1 mt-2 mb-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex gap-2.5 py-2.5 ${i < items.length - 1 ? 'border-b border-dashed border-gray-200' : ''}`}
        >
          <XIcon size={14} className="text-orange-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13.5px] text-gray-700 leading-relaxed">
            <strong className="text-navy">{item.bold}</strong> {item.text}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Liens « Voir aussi » en fin de fiche : ouvrent une autre fiche et y font défiler. */
function SeeAlso({ items, onGo }: { items: { id: string; label: string }[]; onGo: (id: string) => void }) {
  return (
    <div className="mt-5 pt-4 border-t border-dashed border-gray-200 flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
      <span className="font-bold text-navy">Voir aussi :</span>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onGo(it.id)}
          className="text-orange-600 font-bold text-[12.5px] bg-orange-50 hover:bg-orange-100 rounded-full px-3 py-1 transition-colors"
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

/** Enveloppe « Questions fréquentes » — contient des <FaqItem>. */
function FaqBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 mb-2 bg-orange-50/40 border-l-[3px] border-orange-400 rounded-r-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1">
        <CircleHelp size={15} className="text-orange-600 flex-shrink-0" aria-hidden="true" />
        <p className="font-hanken font-bold text-navy text-[13.5px]">Questions fréquentes</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

/** Une question/réponse d'accordéon FAQ, repliable indépendamment. */
function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-dashed border-orange-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
      >
        <span className="font-hanken font-bold text-navy text-[13.5px] leading-snug">{q}</span>
        <ChevronDown
          size={14}
          className="text-orange-600 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="pb-3 pr-2">
          <p className="text-[13.5px] text-gray-700 leading-relaxed">{children}</p>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type Section = {
  id: string
  icon: React.ElementType
  title: string
  subtitle: string
  replayStep?: 'dashboard' | 'devis'
  replayHref?: string
  // Titre de groupe affiché AU-DESSUS de cet accordéon (uniquement
  // pour le premier item de chaque groupe visuel).
  groupHeading?: string
  // Contenu structuré en blocs (paragraphes + listes)
  content: React.ReactNode
}

export default function AidePage() {
  const [openId, setOpenId] = useState<string | null>('premiers-pas')
  const [query, setQuery] = useState('')
  const [showContactModal, setShowContactModal] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { replayStep, loading } = useOnboarding()

  // Replay d'une étape : on remet la base à zéro puis on redirige
  // vers la page où le tutoriel se déclenche automatiquement.
  async function handleReplay(step: 'dashboard' | 'devis', href: string) {
    if (loading) return
    await replayStep(step)
    router.push(href)
  }

  // Ouvre une fiche par son id et fait défiler jusqu'à elle. Utilisé
  // par les boutons "Voir aussi" et par le menu d'autocomplétion.
  function goToSection(id: string) {
    setOpenId(id)
    setShowSuggestions(false)
    setActiveSuggestion(-1)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`section-${id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const sections: Section[] = [
    // ============================================================
    // QUICKSTART — PREMIERS PAS EN 5 MINUTES (ouvert par défaut)
    // ============================================================
    {
      id: 'premiers-pas',
      icon: Rocket,
      title: 'Premiers pas en 5 minutes',
      subtitle: 'Le parcours le plus rapide pour être opérationnel dès aujourd’hui',
      groupHeading: 'Premiers pas',
      content: (
        <>
          <p className="mb-5">Le parcours le plus rapide pour être opérationnel dès aujourd&apos;hui.</p>
          <div className="flex flex-col">
            {[
              {
                n: 1,
                h: 'Complète ton Profil entreprise',
                p: (
                  <>
                    <strong>Paramètres &gt; Entreprise</strong> — SIRET, adresse, assurance décennale, logo,
                    IBAN, signature. C&apos;est la fiche la plus importante : tout le reste en dépend.
                  </>
                ),
              },
              {
                n: 2,
                h: 'Crée ton premier client',
                p: (
                  <>
                    Onglet <strong>Clients</strong>, ou saisis-le directement depuis un devis — les deux
                    fonctionnent.
                  </>
                ),
              },
              {
                n: 3,
                h: 'Fais ton premier devis',
                p: (
                  <>
                    Onglet <strong>Devis</strong> — ajoute tes lignes, elles se sauvegardent automatiquement
                    dans ta bibliothèque de prestations pour la prochaine fois.
                  </>
                ),
              },
              {
                n: 4,
                h: 'Envoie-le pour signature',
                p: (
                  <>
                    Le client signe en ligne via un lien sécurisé, valable{' '}
                    <span className="font-spline-mono">30 jours</span>, à usage unique.
                  </>
                ),
              },
              {
                n: 5,
                h: 'Transforme-le en facture, puis encaisse',
                p: (
                  <>
                    Devis signé → facture en 1 clic. Le client règle par virement ou chèque (QR SEPA sur la
                    facture si ton IBAN est renseigné).
                  </>
                ),
              },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex gap-4 relative pb-5 last:pb-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-spline-mono font-bold text-[13px] shadow-md shadow-orange-500/30">
                    {step.n}
                  </div>
                  {i < arr.length - 1 && (
                    <div
                      className="w-0.5 flex-1 mt-1"
                      style={{
                        background:
                          'repeating-linear-gradient(180deg, #f3d3ae 0, #f3d3ae 4px, transparent 4px, transparent 8px)',
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <h4 className="font-hanken font-bold text-[15px] text-navy mb-1">{step.h}</h4>
                  <p className="text-[14px] text-gray-600 leading-relaxed">{step.p}</p>
                </div>
              </div>
            ))}
          </div>
          <Callout type="tip">
            Installe Nexartis sur ton téléphone (voir la fiche dédiée dans « Outils malins &amp; admin ») pour
            tout gérer directement depuis tes chantiers.
          </Callout>
        </>
      ),
    },

    // ============================================================
    // GROUPE — DÉMARRER
    // ============================================================
    {
      id: 'accueil',
      icon: Home,
      title: 'Accueil / Ton tableau de bord — La première page que tu vois',
      subtitle: 'Chiffres clés, widget « À faire », checklist de démarrage, bandeaux d’alerte',
      groupHeading: 'Démarrer',
      content: (
        <>
          <p className="mb-4">
            C&apos;est la toute première page qui s&apos;affiche quand tu te connectes à Nexartis. Le but :
            que tu saches en 5 secondes où tu en es, et ce qui t&apos;attend aujourd&apos;hui.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Tes chiffres clés</h4>
          <CheckList
            items={[
              'Le chiffre d’affaires (CA) du mois en cours',
              'Le montant « à encaisser » (ce que tes clients te doivent encore)',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Le widget « À faire »</h4>
          <p className="mb-3">Un résumé de ce qui mérite ton attention aujourd&apos;hui :</p>
          <ArrowList
            items={[
              'Les devis envoyés sans réponse depuis plusieurs jours (à relancer)',
              'Les factures en retard de paiement',
              'Les rappels et tâches de chantier prévus aujourd’hui (voir Notes & rappels sur la fiche Chantier)',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">La checklist de démarrage</h4>
          <p className="mb-3">
            Un petit parcours (profil, premier client, premier devis...) qui t&apos;aide à ne rien oublier au
            lancement. Tu peux la masquer une fois que tu es à l&apos;aise.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Les bandeaux d&apos;alerte</h4>
          <ArrowList
            items={[
              'Profil entreprise incomplet (un champ obligatoire manque)',
              'Ton assurance décennale (ou une certification) arrive à échéance',
              'Une proposition d’installer l’application sur ton téléphone (PWA)',
            ]}
          />
          <Callout type="tip">
            Le contenu financier de l&apos;accueil (CA, à encaisser) est masqué pour les comptes salariés
            selon leur rôle. Un ouvrier, par exemple, ne voit pas ces chiffres.
          </Callout>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'factures', label: 'Factures' },
              { id: 'devis', label: 'Devis' },
              { id: 'equipe', label: 'Mon équipe' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'pas-encore',
      icon: Ban,
      title: 'Ce que Nexartis ne fait pas (encore) — honnêteté d’abord',
      subtitle: 'Les limites actuelles, et comment faire en attendant',
      content: (
        <>
          <p className="mb-4">
            On préfère être honnête plutôt que de te laisser chercher une fonction qui n&apos;existe pas
            encore. Voici ce que Nexartis ne fait pas aujourd&apos;hui, et comment t&apos;en sortir en
            attendant.
          </p>
          <NotYetBlock
            items={[
              {
                bold: 'Pas de connexion bancaire automatique.',
                text: 'En attendant : tu importes ton relevé au format CSV (voir la fiche Banque).',
              },
              {
                bold: 'Pas d’affichage du solde bancaire.',
                text: 'Nexartis suit les mouvements, pas le solde. Seul le solde de ta caisse (espèces) est affiché.',
              },
              {
                bold: 'Pas de paiement par carte en ligne pour ton client.',
                text: 'Il te paie par virement ou chèque ; un QR-code de virement SEPA sur la facture l’aide à préparer son virement.',
              },
              {
                bold: 'Pas de lecture automatique (OCR) de tes factures fournisseurs.',
                text: 'Tu saisis les montants toi-même dans Achats ; le justificatif (PDF/photo) est simplement stocké à côté.',
              },
              {
                bold: 'Pas de remise globale automatique',
                text: 'sur un devis. En attendant : ajuste tes prix unitaires, ou ajoute une ligne dédiée.',
              },
              {
                bold: 'Pas de fusion automatique des doublons clients.',
                text: 'L’accueil te les signale ; tu corriges à la main (tu supprimes ou modifies la fiche en trop).',
              },
            ]}
          />
          <Callout type="tip">
            Nexartis évolue régulièrement. Si une de ces fonctions te bloque vraiment au quotidien, écris-nous
            à contact.nexartis@gmail.com — c&apos;est comme ça qu&apos;on priorise.
          </Callout>
        </>
      ),
    },
    {
      id: 'profil-entreprise',
      icon: Building2,
      title: 'Profil entreprise — Le cœur de Nexartis, rempli une fois, utilisé partout',
      subtitle: 'SIRET, adresse, décennale, logo, IBAN, signature : tout part de là',
      replayStep: 'dashboard',
      replayHref: '/dashboard',
      content: (
        <>
          <p className="mb-4">
            C&apos;est la fiche la plus importante de Nexartis. Une fois que tu l&apos;as remplie, toutes tes
            informations légales (SIRET, raison sociale, adresse, mentions obligatoires, logo, IBAN,
            signature) sont insérées <strong>automatiquement</strong> dans chaque devis et chaque facture. Tu
            ne les retapes jamais.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Champs obligatoires (imposés par la loi française)
          </h4>
          <CheckList
            items={[
              'Raison sociale',
              'SIRET (numéro d’identification de ton entreprise)',
              'Forme juridique (auto-entrepreneur, EI, SARL, EURL, SAS...)',
              'Adresse complète (numéro, rue, code postal, ville)',
              'Téléphone et email professionnels',
              'Assurance décennale (assureur, numéro de police, zone géographique) — obligatoire dans le BTP',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Champs très recommandés (pas obligatoires, mais utiles)
          </h4>
          <ArrowList
            items={[
              'Logo : affiché en haut de tous tes PDF',
              (
                <>
                  IBAN/BIC (coordonnées bancaires) : le client peut te virer directement. Sur tes{' '}
                  <strong>factures</strong>, un QR-code de virement SEPA (un code que le client scanne avec
                  son téléphone pour préparer le virement) est ajouté automatiquement au PDF. Les{' '}
                  <strong>devis</strong>, eux, n&apos;affichent pas de coordonnées bancaires ni de QR — on ne
                  demande le paiement qu&apos;au stade de la facture.
                </>
              ),
              'Signature : tu la dessines une fois, elle est ajoutée automatiquement sur tes documents',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Franchise de TVA (auto-entrepreneurs)
          </h4>
          <p className="mb-3">
            Si tu es en franchise de TVA (tu ne factures pas de TVA), la mention légale « TVA non applicable,
            art. <span className="font-spline-mono">293 B</span> du CGI » apparaît automatiquement sur tes
            devis et factures. En pratique, cette mention se déclenche selon les{' '}
            <strong>taux de TVA que tu saisis sur tes lignes</strong> : si toutes tes lignes sont à{' '}
            <span className="font-spline-mono">0 %</span>, la mention s&apos;affiche.
          </p>
          <p className="mb-3">
            Les seuils <strong>en vigueur</strong> de la franchise (art. 293 B du CGI) :{' '}
            <span className="font-spline-mono">37 500 €</span> de chiffre d&apos;affaires pour les prestations
            de services (tolérance jusqu&apos;à <span className="font-spline-mono">41 250 €</span>), et{' '}
            <span className="font-spline-mono">85 000 €</span> pour les ventes de marchandises (tolérance
            jusqu&apos;à <span className="font-spline-mono">93 500 €</span>). Tant que tu es sous ces seuils,
            tu ne factures pas de TVA. Le jour où tu les dépasses, tu deviens redevable de la TVA et tu
            commences à la facturer — la mention disparaît alors toute seule sur tes documents, tu n&apos;as
            rien à changer à la main. Voir aussi la fiche « Franchise de TVA » dans Réglementation.
          </p>
          <Callout type="warn">
            Tant qu&apos;un champ obligatoire manque, un bandeau d&apos;alerte s&apos;affiche sur ton tableau
            de bord et un bandeau orange apparaît sur la liste de tes devis. Tes documents ne sont pas
            pleinement conformes tant que ce n&apos;est pas complété.
          </Callout>
          <ProTipsBlock
            items={[
              'Complète ton profil à 100 % dès le premier jour : c’est ce qui garantit des PDF conformes, sans y repenser à chaque devis.',
            ]}
          />
          <p className="mt-4 mb-2">
            <strong>Où :</strong> Paramètres &gt; onglet Entreprise.
          </p>
          <FaqBlock>
            <FaqItem q="Pourquoi un bandeau orange « non conforme » sur mes devis ?">
              Il manque un champ obligatoire (raison sociale, SIRET, forme juridique, ou adresse). Complète
              Paramètres &gt; Entreprise et il disparaît.
            </FaqItem>
            <FaqItem q="Je suis auto-entrepreneur, comment ne pas facturer de TVA ?">
              Mets tes lignes à <span className="font-spline-mono">0 %</span> (ou active la franchise) : la
              mention « TVA non applicable, art. <span className="font-spline-mono">293 B</span> du CGI »
              s&apos;ajoute toute seule.
            </FaqItem>
            <FaqItem q="Quel est le seuil de la franchise de TVA en 2026 ?">
              <span className="font-spline-mono">37 500 €</span> pour les prestations de services (tolérance{' '}
              <span className="font-spline-mono">41 250 €</span>), <span className="font-spline-mono">85 000 €</span>{' '}
              pour les ventes (tolérance <span className="font-spline-mono">93 500 €</span>). Détails dans la
              fiche « Franchise de TVA » (groupe Réglementation).
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'rcs-assurance',
      icon: Scale,
      title: 'Où trouver mon numéro RCS/RM et mon n° de police d’assurance',
      subtitle: 'Retrouve les bons numéros sans te perdre',
      content: (
        <>
          <p className="mb-4">Ces numéros sont parfois difficiles à retrouver. Voici où chercher.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Ton identifiant principal : le SIREN/SIRET
          </h4>
          <p className="mb-3">
            Tu l&apos;as reçu au moment de ton immatriculation (création d&apos;entreprise). C&apos;est la
            base de tous les autres numéros.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">RCS ou RM</h4>
          <ArrowList
            items={[
              'RCS (Registre du Commerce et des Sociétés) = ton SIREN précédé de « RCS + ville » — pour les commerçants',
              'RM (Répertoire des Métiers) = ton SIREN précédé de « RM + département » — pour les artisans',
              'Tu le trouves sur ton extrait d’immatriculation (gratuit sur data.inpi.fr ou monidenum.fr) ou sur ton avis de situation SIRENE (INSEE)',
            ]}
          />
          <Callout type="tip">
            Si tu es auto-entrepreneur en prestation de services, tu peux ne pas avoir de RCS/RM du tout —
            seul ton SIRET s&apos;affiche. C&apos;est normal, ne t&apos;inquiète pas.
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Numéro de police d&apos;assurance
          </h4>
          <p className="mb-3">
            C&apos;est le numéro de ton contrat (décennale et/ou responsabilité civile professionnelle). Il
            figure sur ton attestation annuelle ou ton contrat, à côté de « N° de contrat » ou « N° de police
            ». Si tu ne le trouves pas, appelle directement ton assureur.
          </p>
          <HiddenFunctionsBlock
            items={[
              'Le SIRET saisi dans ton Profil entreprise sert aussi à vérifier automatiquement si tes clients professionnels (SIRET) sont éligibles à la facture électronique B2B.',
              'Un SIRET mal formaté (pas 14 chiffres) est refusé à la saisie — ça évite une erreur qui bloquerait un envoi en facturation électronique plus tard.',
            ]}
          />
        </>
      ),
    },
    {
      id: 'navigation',
      icon: Compass,
      title: 'Comment est rangé ton espace — la navigation',
      subtitle: 'Le menu de gauche, organisé pour aller vite',
      content: (
        <>
          <p className="mb-4">
            Le menu de gauche (la barre latérale) est organisé pour que tu retrouves plus vite ce que tu
            utilises tous les jours.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            En haut : tes accès directs (jamais repliés)
          </h4>
          <CheckList items={['Accueil, Devis, Factures, Planning, Chantiers']} />
          <ArrowList
            items={[
              'Un teaser « Plans 2D/3D » avec une pastille « Bientôt » : ce module est en construction, il n’est pas encore cliquable',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            En dessous : des catégories que tu peux ouvrir/fermer
          </h4>
          <ArrowList
            items={[
              (
                <>
                  <strong>Base de données</strong> : Clients, Fournisseurs, Prestations, Matériel, Mon équipe
                </>
              ),
              (
                <>
                  <strong>Documents</strong> : Documents, Rapports
                </>
              ),
              (
                <>
                  <strong>Finances</strong> : Banque, Achats, Statistiques
                </>
              ),
              (
                <>
                  <strong>Outils</strong> : Calculatrices, Normes
                </>
              ),
            ]}
          />
          <p className="mb-3">Ton choix (ouvert/fermé) est mémorisé d&apos;une visite à l&apos;autre.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Tout en bas</h4>
          <p className="mb-3">
            « Mon compte » (repliable) : Abonnement, Paramètres, Importer, Corbeille. Et « Aide &amp;
            Tutoriels ».
          </p>
          <Callout type="tip">
            Un petit encart « À traiter » résume ce qui t&apos;attend (devis à relancer, factures en retard,
            opérations bancaires à pointer). S&apos;il n&apos;y a rien à faire, tu verras « ✓ Tout est à
            jour ».
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Si tu as des membres d&apos;équipe avec un compte
          </h4>
          <ArrowList
            items={[
              (
                <>
                  Le <strong>Dirigeant</strong> voit tout
                </>
              ),
              (
                <>
                  Un <strong>Commercial / Chef de chantier</strong> voit les devis, chantiers, planning,
                  clients... mais pas les finances (factures, banque, achats, statistiques)
                </>
              ),
              (
                <>
                  Un <strong>Ouvrier</strong> voit surtout le Planning et les Chantiers
                </>
              ),
              'Les outils (Calculatrices, Normes) et l’Aide restent ouverts à tout le monde',
            ]}
          />
          <Callout type="warn">
            Si tu es en offre Essentiel, certains onglets (Planning, Mon équipe, Rapports) portent une étoile
            : en cliquant dessus, Nexartis te propose de passer à l&apos;offre Complet. Ce n&apos;est pas un
            bug.
          </Callout>
        </>
      ),
    },

    // ============================================================
    // GROUPE — TON QUOTIDIEN
    // ============================================================
    {
      id: 'devis',
      icon: FileText,
      title: 'Devis — Le point de départ de tout, de la signature à la facture',
      subtitle: 'Autocomplete client, numérotation hiérarchique, options, signature en ligne',
      replayStep: 'devis',
      replayHref: '/dashboard/devis/nouveau',
      groupHeading: 'Ton quotidien',
      content: (
        <>
          <p className="mb-4">
            Le devis est le point de départ de tout dans Nexartis : ce que tu saisis (client, prestations,
            conditions) est réutilisable, et un devis accepté devient un chantier puis une facture, sans rien
            recopier.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Saisie rapide</h4>
          <CheckList
            items={[
              'Autocomplete client : tape le nom, choisis dans ta base, toutes les coordonnées se remplissent seules',
              (
                <>
                  Numérotation hiérarchique des lignes : tu organises ton devis en sections / sous-sections /
                  prestations, numérotées automatiquement (<span className="font-spline-mono">1</span>,{' '}
                  <span className="font-spline-mono">1.1</span>, <span className="font-spline-mono">1.1.1</span>
                  ...) pour la lisibilité du client
                </>
              ),
              'Types de ligne disponibles : section, sous-section, prestation, commentaire, saut de page',
              'Bibliothèque de prestations : chaque ligne que tu ajoutes est sauvegardée et réutilisable (onglet Prestations), avec autocomplete sur la désignation',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Lignes optionnelles et taux de TVA
          </h4>
          <p className="mb-3">
            Une ligne peut être marquée en <strong>option</strong> : le client pourra l&apos;inclure ou
            l&apos;exclure au moment de signer, et le total se recalcule automatiquement. Le{' '}
            <strong>taux de TVA se choisit ligne par ligne</strong> : rien n&apos;empêche d&apos;avoir
            plusieurs taux différents sur un même devis (par exemple{' '}
            <span className="font-spline-mono">10 %</span> sur la rénovation et{' '}
            <span className="font-spline-mono">20 %</span> sur un aménagement neuf).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Acompte et conditions</h4>
          <p className="mb-3">
            Une case « Acompte de <span className="font-spline-mono">X %</span> » ajoute une mention sur le
            devis (« Acompte à verser (X %) »).
          </p>
          <Callout type="warn">
            Sur le devis, l&apos;acompte n&apos;est qu&apos;une mention affichée — ce n&apos;est pas une
            facture. La vraie facture d&apos;acompte se crée ensuite côté Factures.
          </Callout>
          <ArrowList
            items={[
              (
                <>
                  Conditions de paiement : des puces à sélectionner, dont les pénalités de retard et des
                  paliers d&apos;acompte (<span className="font-spline-mono">30 %</span>/
                  <span className="font-spline-mono">50 %</span>)
                </>
              ),
              'Ta signature est apposée sur l’aperçu si tu l’as enregistrée dans ton profil entreprise',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Gestion des déchets (obligation BTP)
          </h4>
          <p className="mb-3">
            Un bloc optionnel sur le devis te permet de renseigner la nature, la quantité, le responsable, le
            tri, le point de collecte et le coût d&apos;élimination des déchets de chantier. C&apos;est une
            mention réglementaire (loi AGEC), disponible directement sur le devis. Quand tu remplis ce bloc,
            Nexartis te suggère automatiquement des déchèteries proches (à partir de ton code postal).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Statuts d&apos;un devis</h4>
          <ArrowList
            items={[
              (
                <>
                  <strong>Brouillon</strong> : pas encore envoyé
                </>
              ),
              (
                <>
                  <strong>Envoyé</strong> : transmis au client
                </>
              ),
              (
                <>
                  <strong>Accepté</strong> : le client a signé en ligne
                </>
              ),
              (
                <>
                  <strong>Contre-proposition</strong> : le client a répondu avec une modification — tu peux
                  l&apos;écarter, le devis revient en Envoyé
                </>
              ),
              (
                <>
                  <strong>Refusé</strong> / <strong>Expiré</strong> (validité dépassée) /{' '}
                  <strong>Facturé</strong> (déjà transformé en facture)
                </>
              ),
            ]}
          />
          <p className="mb-3">
            La <strong>duplication</strong> recopie un devis (numéro suffixé « -copie ») et le remet en
            brouillon — pratique pour renégocier.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Signature en ligne</h4>
          <p className="mb-3">
            À l&apos;envoi, un lien unique est généré (valable{' '}
            <span className="font-spline-mono">30 jours</span>, à usage unique). Le client ouvre le devis,
            peut cocher/décocher les lignes optionnelles — le montant est recalculé côté serveur, il ne peut
            jamais forcer un prix — puis signe (signature dessinée ou approbation électronique). Tu reçois un
            email dès que c&apos;est signé, et le devis passe « Accepté » : Nexartis te propose alors de créer
            le chantier. Un badge « modifié » apparaît si le client a ajusté les options du devis avant de
            signer.
          </p>
          <Callout type="tip">
            Tu peux aussi créer un devis à la voix (dictée vocale), réservé à l&apos;offre Complet — voir la
            section « Devis &amp; facture vocaux ».
          </Callout>
          <HiddenFunctionsBlock
            items={[
              (
                <>
                  Numérotation hiérarchique <span className="font-spline-mono">1</span> /{' '}
                  <span className="font-spline-mono">1.1</span> / <span className="font-spline-mono">1.1.1</span>{' '}
                  : sections et sous-sections rendent un gros devis beaucoup plus lisible pour le client.
                </>
              ),
              'Les lignes « commentaire » et « saut de page » servent à aérer un long devis (introduire un lot, séparer les pages du PDF).',
              'La duplication d’un devis (numéro suffixé « -copie ») permet de renégocier sans repartir de zéro.',
              'Les lignes optionnelles peuvent être cochées/décochées par le client au moment de la signature, avec un badge « modifié » si le client a changé le périmètre initial.',
              'Les cartes de statistiques (en haut de la liste des devis) sont des filtres cliquables : clique « Envoyés » pour ne voir que ceux-là.',
              'La recherche porte aussi sur l’objet du devis et sur tes notes, pas seulement sur le nom du client.',
              'Sélection multiple + suppression groupée : coche plusieurs devis pour les envoyer à la corbeille d’un coup.',
              'Renvoyer un devis depuis sa fiche vaut relance : l’accueil te signale d’ailleurs les devis sans réponse depuis plusieurs jours.',
            ]}
          />
          <ProTipsBlock
            items={[
              'Enrichis ta bibliothèque de prestations au fil de l’eau : chaque devis suivant se fait plus vite.',
              'Utilise les lignes optionnelles pour proposer une variante « avec » et « sans » sans faire deux devis.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Le client peut-il changer mon prix en signant ?">
              Non. Il peut seulement inclure/exclure les lignes que tu as marquées optionnelles ; le montant
              est recalculé côté serveur, il ne peut jamais forcer un prix.
            </FaqItem>
            <FaqItem q="Combien de temps le lien de signature est-il valable ?">
              <span className="font-spline-mono">30 jours</span>, et il ne sert qu&apos;une fois.
            </FaqItem>
            <FaqItem q="Où est-ce que je mets ma marge ?">
              Pas dans le devis. Ta marge se voit au niveau du Chantier (montant facturé − dépenses).
            </FaqItem>
            <FaqItem q="Comment rendre une ligne optionnelle ?">
              Marque la ligne en option lors de la saisie ; le client pourra l&apos;inclure ou l&apos;exclure
              au moment de signer, et le total se recalcule.
            </FaqItem>
            <FaqItem q="Puis-je mettre plusieurs taux de TVA sur un même devis ?">
              Oui : le taux se choisit ligne par ligne.
            </FaqItem>
            <FaqItem q="Comment faire une remise ?">
              Il n&apos;y a pas de champ « remise globale » automatique ; ajuste tes prix unitaires ou ajoute
              une ligne dédiée.
            </FaqItem>
            <FaqItem q="Puis-je modifier un devis déjà signé ?">
              Non, un devis accepté t&apos;engage. Pour changer quelque chose, duplique-le (il repart en
              brouillon) et renvoie-le.
            </FaqItem>
            <FaqItem q="Comment joindre un plan ou des images ?">
              Les plans que tu réalises dans le module Plan 2D (onglet Plan 2D d&apos;un chantier)
              s&apos;ajoutent au PDF du devis quand tu injectes leurs métrés dans tes lignes (jusqu&apos;à 4
              images, avec la mention « plan indicatif, non contractuel »). Il n&apos;y a pas d&apos;ajout
              libre de photos dans l&apos;éditeur de devis lui-même.
            </FaqItem>
            <FaqItem q="Comment relancer un devis envoyé sans réponse ?">
              Depuis le devis, renvoie-le. L&apos;accueil te signale aussi les devis sans réponse depuis
              plusieurs jours.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'factures', label: 'Factures' },
              { id: 'chantiers', label: 'Chantier' },
              { id: 'retractation', label: 'Rétractation 14 jours' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'factures',
      icon: Receipt,
      title: 'Factures — Générées depuis un devis, presque jamais saisies à la main',
      subtitle: '4 types de facture, numérotation automatique, relances, QR SEPA',
      content: (
        <>
          <p className="mb-4">
            Une facture n&apos;est presque jamais saisie à la main : depuis un devis accepté, le bouton «
            Convertir en facture » reprend les lignes, le client et les conditions. Tu peux aussi créer une
            facture directe (« Nouvelle facture »), sans devis.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">4 types de facture</h4>
          <ArrowList
            items={[
              (
                <>
                  <strong>Standard</strong>
                </>
              ),
              (
                <>
                  <strong>Acompte</strong> : une vraie facture d&apos;acompte
                </>
              ),
              (
                <>
                  <strong>Situation</strong> : facture d&apos;avancement <BadgeComplet />
                </>
              ),
              (
                <>
                  <strong>Avoir</strong> : note de crédit
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Pour une facture d&apos;acompte : un interrupteur + un pourcentage (
            <span className="font-spline-mono">30 %</span> par défaut) ou un montant en euros. Le net à
            payer = total TTC − acompte − avoir imputé (jamais négatif).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Ce qui est repris automatiquement du devis
          </h4>
          <CheckList
            items={[
              'Le client et ses coordonnées',
              'Toutes les lignes retenues (le périmètre signé — les options non prises ne sont pas reprises)',
              'Tes mentions légales',
            ]}
          />
          <p className="mb-3">
            Pour un auto-entrepreneur : la mention « TVA non applicable, art.{' '}
            <span className="font-spline-mono">293 B</span> du CGI » est ajoutée seule si tes lignes sont à{' '}
            <span className="font-spline-mono">0 %</span> ; le total HT est alors égal au total TTC.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Numérotation</h4>
          <p className="mb-3">
            La numérotation de tes factures est <strong>automatique</strong>, continue et sans trou —
            c&apos;est une obligation légale. Tu ne la gères jamais à la main.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Statuts d&apos;une facture</h4>
          <p className="mb-3">
            Brouillon / Envoyée / Payée (comptée dans le CA) / Partielle (payée en partie) / En retard
            (échéance dépassée) / Archivée / Annulée. La date d&apos;échéance se choisit à la création ;
            passée cette date sans paiement, la facture passe automatiquement « En retard » et remonte dans
            ton « À faire ».
          </p>
          <Callout type="warn">
            Garde-fou anti-double-facturation : un devis se facture une seule fois, d&apos;une seule manière —
            soit une facture complète, soit des factures de situation, jamais les deux, jamais deux fois.
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Paiement et encaissement</h4>
          <p className="mb-3">
            Le client paie par virement ou par chèque. Si ton IBAN est renseigné, un QR-code de virement SEPA
            est dessiné sur le PDF : le client le scanne pour préparer son virement.
          </p>
          <p className="mb-3">
            Tu enregistres ensuite chaque paiement reçu — la facture passe « Partielle » puis « Payée » au fil
            des encaissements, et le reste dû se met à jour automatiquement. Les factures en retard remontent
            dans le « À faire » du tableau de bord.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Relances</h4>
          <ArrowList
            items={[
              (
                <>
                  Relance manuelle en 1 clic, qui choisit le bon palier selon le retard (
                  <span className="font-spline-mono">J+7</span> / <span className="font-spline-mono">J+15</span>{' '}
                  / <span className="font-spline-mono">J+30</span>)
                </>
              ),
              (
                <>
                  Relance automatique par email (une fois par jour) : envoie{' '}
                  <span className="font-spline-mono">J7</span>/<span className="font-spline-mono">J15</span>/
                  <span className="font-spline-mono">J30</span> aux factures en retard, tant que la dette
                  n&apos;est pas éteinte
                </>
              ),
              'Tu peux exclure un client des relances automatiques depuis sa fiche',
            ]}
          />
          <Callout type="warn">
            Verrouillage : une facture n&apos;est plus modifiable une fois envoyée par email, pour la sécurité
            et la traçabilité.
          </Callout>
          <HiddenFunctionsBlock
            items={[
              'La case « un acompte a déjà été versé » affiche sous-total → acompte → reste à payer directement sur la facture finale.',
              'Les factures en retard remontent automatiquement dans le « À faire » de l’accueil, pas besoin d’aller les chercher.',
              'Un QR de virement SEPA est dessiné sur le PDF dès que ton IBAN est renseigné dans ton Profil entreprise.',
              'Les cartes de statistiques (Payées, En retard...) sont des filtres cliquables sur la liste des factures.',
              'Duplique une facture existante pour repartir d’un modèle sans tout ressaisir.',
              'La recherche porte aussi sur l’objet et les notes, pas seulement le nom du client.',
            ]}
          />
          <ProTipsBlock
            items={[
              'Utilise les situations plutôt que d’attendre la fin d’un gros chantier : ta trésorerie encaisse au fil de l’eau.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Puis-je faire plusieurs factures d’acompte ?">
              Oui, autant que nécessaire. Certains logiciels n&apos;autorisent qu&apos;une seule facture
              d&apos;acompte ; Nexartis ne te limite pas. La seule règle : un devis se facture d&apos;une
              seule manière — soit une facture complète, soit des factures de situation, jamais les deux.
            </FaqItem>
            <FaqItem q="Comment facturer un gros chantier en plusieurs fois ?">
              Avec les factures de situation (offre Complet) : n°1, n°2, n°3... Chacune facture ce qui a été
              réalisé depuis la précédente, et le cumul est calculé automatiquement pour ne jamais facturer
              deux fois.
            </FaqItem>
            <FaqItem q="Différence entre acompte et facture de situation ?">
              L&apos;acompte est une avance versée au démarrage. La facture de situation facture un
              avancement réel de travaux, avec cumul automatique.
            </FaqItem>
            <FaqItem q="Le client peut-il payer par carte en ligne ?">
              Non : le paiement se fait par virement ou chèque. Si ton IBAN est renseigné, un QR-code SEPA sur
              la facture aide le client à préparer son virement.
            </FaqItem>
            <FaqItem q="Ma facture est partie avec une erreur, je fais quoi ?">
              Une facture envoyée est verrouillée (sécurité). Corrige avec une facture d&apos;avoir.
            </FaqItem>
            <FaqItem q="Puis-je faire une facture sans devis ?">
              Oui, crée une facture directe (Nouvelle facture).
            </FaqItem>
            <FaqItem q="Comment enregistrer un paiement partiel ou plusieurs paiements ?">
              Tu enregistres chaque encaissement ; la facture passe « Partielle » puis « Payée », le reste dû
              se met à jour.
            </FaqItem>
            <FaqItem q="La numérotation est-elle automatique ?">
              Oui, continue et sans trou (obligation légale) ; tu ne la gères pas à la main.
            </FaqItem>
            <FaqItem q="Comment régler la date d’échéance ?">
              Tu la choisis à la création. Passée cette date sans paiement, la facture passe « En retard » et
              remonte dans ton « À faire ».
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'devis', label: 'Devis' },
              { id: 'devis', label: 'Signature' },
              { id: 'facture-situation', label: 'Situation' },
              { id: 'facture-avoir', label: 'Avoir' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'facture-situation',
      icon: Layers,
      title: 'Factures de situation (gros chantiers) — facture ton chantier au fil de l’avancement',
      subtitle: 'Cumul automatique, garde-fous anti trop-perçu, décompte final',
      content: (
        <>
          <p className="mb-4">
            Pour un chantier long, tu peux émettre plusieurs factures intermédiaires au fil de
            l&apos;avancement (situation n°1, n°2, n°3...), chacune facturant la part réalisée depuis la
            précédente.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Comment ça marche</h4>
          <ArrowList
            items={[
              'Tu pars du devis lié : Nexartis retrouve toutes les situations déjà émises, te suggère le numéro suivant, et affiche le cumul déjà facturé et le reste à facturer',
              (
                <>
                  Tu indiques l&apos;avancement en <span className="font-spline-mono">%</span> —
                  globalement, ou ligne par ligne si un plan d&apos;avancement existe (les lignes Terminé
                  passent à <span className="font-spline-mono">100 %</span>, En cours à{' '}
                  <span className="font-spline-mono">50 %</span>, etc., tu peux ajuster)
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Le calcul se fait sur la valeur réelle (montant marché × % atteint − déjà facturé sur la ligne),
            arrondi au centime. À <span className="font-spline-mono">100 %</span>, la dernière situation
            facture exactement le solde restant : tout boucle au centime près, c&apos;est ton décompte final.
          </p>
          <Callout type="warn">
            Si tu demandes un avancement inférieur à ce qui est déjà facturé (trop-perçu), Nexartis bloque
            l&apos;émission — il faut ajuster le pourcentage ou passer par un avoir. Un numéro de situation ne
            peut jamais être émis deux fois, et si quelqu&apos;un d&apos;autre enregistre une situation en
            même temps, c&apos;est détecté et bloqué.
          </Callout>
          <FaqBlock>
            <FaqItem q="Nexartis bloque ma situation (« trop-perçu ») ?">
              Tu as saisi un avancement inférieur à ce qui est déjà facturé. Ajuste le pourcentage, ou passe
              par une facture d&apos;avoir.
            </FaqItem>
            <FaqItem q="Puis-je faire une facture complète ET des situations sur le même devis ?">
              Non : un devis se facture d&apos;une seule façon. C&apos;est un garde-fou pour ne jamais
              facturer deux fois.
            </FaqItem>
            <FaqItem q="Comment gérer la retenue de garantie (5 %) ?">
              Sur une facture de situation, coche « Appliquer une retenue de garantie » (plafond légal
              <span className="font-spline-mono"> 5 %</span>). Le montant est déduit du net à payer et apparaît
              sur la facture — à l&apos;écran comme sur le PDF. Tu la libéreras au décompte final, à la réception du chantier.
            </FaqItem>
            <FaqItem q="La dernière situation, c’est mon décompte final ?">
              Oui : à <span className="font-spline-mono">100 %</span> d&apos;avancement, la dernière situation
              facture exactement le solde restant, tout boucle au centime.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'factures', label: 'Factures' },
              { id: 'chantiers', label: 'Chantier' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'facture-avoir',
      icon: Undo2,
      title: 'Facture d’avoir — rembourser ou annuler tout ou partie d’une facture',
      subtitle: 'Note de crédit, numérotée, garde-fous, déduite du chiffre d’affaires',
      content: (
        <>
          <p className="mb-4">
            Une facture d&apos;avoir est une note de crédit, créée depuis une facture déjà émise, quand tu dois
            rembourser ou annuler tout ou partie de cette facture.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Création</h4>
          <p className="mb-3">
            En % ou en montant € TTC de la facture d&apos;origine. La TVA est ventilée par taux
            automatiquement, de façon identique sur tous les rendus. Chaque avoir reçoit un numéro dédié au
            format <span className="font-spline-mono">AV-AAAA-NNNN</span>.
          </p>
          <Callout type="warn">
            Pas d&apos;avoir sur un avoir, pas d&apos;avoir sur un brouillon ou une facture annulée. Le total
            des avoirs ne peut jamais dépasser le montant de la facture d&apos;origine.
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Effet</h4>
          <ArrowList
            items={[
              'L’avoir vient en déduction de ton chiffre d’affaires (CA = factures − avoirs)',
              'Un avoir ne reçoit pas de paiement et n’affiche pas de pénalités',
              'Selon que la facture était déjà payée ou non, l’avoir est marqué « à rembourser » ou « non dû »',
            ]}
          />
          <FaqBlock>
            <FaqItem q="L’avoir rembourse-t-il automatiquement mon client ?">
              Non : l&apos;avoir est le document (note de crédit). Le remboursement, tu le fais par tes moyens
              (virement/chèque), ou l&apos;avoir reste « à valoir » (déduit d&apos;une prochaine facture).
            </FaqItem>
            <FaqItem q="Comment annuler complètement une facture ?">
              Fais un avoir de <span className="font-spline-mono">100 %</span>.
            </FaqItem>
          </FaqBlock>
          <SeeAlso onGo={goToSection} items={[{ id: 'factures', label: 'Factures' }]} />
        </>
      ),
    },
    {
      id: 'planning',
      icon: CalendarDays,
      title: 'Planning — Pose tes interventions sur les bons jours',
      subtitle: 'Fenêtre glissante 5 semaines, Solo/Société, absences, conflits, exports',
      content: (
        <>
          <p className="mb-4">
            Le planning sert à poser tes interventions sur les bons jours, aux bons créneaux, sur le bon
            chantier. Il est lié automatiquement aux chantiers.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Affichage</h4>
          <p className="mb-3">
            Ce n&apos;est ni une simple semaine ni un simple mois : c&apos;est une fenêtre glissante de{' '}
            <span className="font-spline-mono">5 semaines</span>, plus une vue <strong>annuelle</strong> (
            <span className="font-spline-mono">12</span> prochains mois, en aperçu). Trois modes
            d&apos;affichage : Complète, 5 semaines, Annuel. Tu peux afficher ou masquer le week-end (ce choix
            est mémorisé), et régler la densité Compact/Confort.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Mode Solo vs Société</h4>
          <p className="mb-3">Détecté automatiquement selon ta forme juridique :</p>
          <ArrowList
            items={[
              (
                <>
                  <strong>Solo</strong> (auto-entrepreneur, EI, micro) : vue « agenda » simple, tes
                  interventions triées par heure. Si tu ajoutes des sous-traitants ou salariés, ils
                  apparaissent en colonnes
                </>
              ),
              (
                <>
                  <strong>Société</strong> (SARL, EURL, SAS...) : vue « matrice » intervenants × jours
                </>
              ),
            ]}
          />
          <p className="mb-3">
            La liste des intervenants est à plat : « Vous » en premier, puis par ordre alphabétique. Le métier
            de chacun reste juste affiché en petit à côté du nom.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Créneaux et couleurs</h4>
          <CheckList
            items={[
              (
                <>
                  Journée entière (<span className="font-spline-mono">8h-17h</span>), Demi-journée matin (
                  <span className="font-spline-mono">8h-12h</span>), Demi-journée après-midi (
                  <span className="font-spline-mono">13h-17h</span>), ou Créneau personnalisé (heure de
                  début/fin) — les horaires par défaut suivent ceux de ton entreprise
                </>
              ),
              'Chaque intervenant a sa propre couleur, reprise sur ses interventions',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Détection de conflits</h4>
          <p className="mb-3">
            Si deux interventions se chevauchent pour le même intervenant, une alerte de conflit apparaît. Un
            filtre permet de n&apos;afficher que les conflits pour les régler rapidement.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Créer une intervention</h4>
          <p className="mb-3">
            Clique sur une case vide (ou le bouton +) pour créer une intervention à cette date, pour cet
            intervenant. Tu peux aussi glisser-déposer une intervention d&apos;une case à l&apos;autre, ou
            glisser directement l&apos;étiquette (le « chip ») d&apos;un intervenant sur une case pour
            l&apos;affecter en un geste.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Absences</h4>
          <p className="mb-3">
            Bouton « Absence » pour poser une indisponibilité. Types : Congé, Maladie, Vacances, Formation,
            Autre (les jours fériés sont gérés à part). La personne concernée peut être un membre de
            l&apos;équipe ou un nom libre. Tu renseignes une plage Du/Au, la durée (journée/matin/après-midi
            si un seul jour), un motif et une note.
          </p>
          <p className="mb-3">
            Un encart « Qui est absent » au-dessus de la grille liste les absences de la période
            (modifiable/supprimable). Si tu planifies quelqu&apos;un qui est absent, Nexartis t&apos;avertit.
          </p>
          <Callout type="warn">
            Une absence saisie en « nom libre » apparaît dans l&apos;encart « Qui est absent » mais pas dans
            les lignes de la grille (réservées aux membres enregistrés).
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Exports</h4>
          <p className="mb-3">
            Bouton Exporter → choix Période (Semaine / Mois / An) × Format : PDF imprimable, CSV (Excel), ou
            Agenda .ics (à importer dans Google/Apple Agenda).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Statuts d&apos;intervention</h4>
          <p className="mb-3">Planifié (à venir) / En cours / Terminé / Annulé.</p>
          <p className="mb-3">
            Autres fonctions utiles : recherche, masquer un intervenant, page Historique des interventions
            passées, et création à la voix (bandeau vocal).
          </p>
          <FaqBlock>
            <FaqItem q="Où est la vue « mois » ?">
              Le planning fonctionne en fenêtre de <span className="font-spline-mono">5 semaines</span> qui
              glisse, plus une vue annuelle (<span className="font-spline-mono">12</span> mois) en aperçu.
            </FaqItem>
            <FaqItem q="Le planning ne me propose personne à assigner ?">
              En mode Société, crée d&apos;abord ton équipe (onglet Mon équipe).
            </FaqItem>
            <FaqItem q="J’ai mis une absence en « nom libre », elle n’apparaît pas dans la grille ?">
              Normal : seules les absences des membres enregistrés s&apos;affichent en ligne ; elle reste
              visible dans l&apos;encart « Qui est absent ».
            </FaqItem>
            <FaqItem q="Puis-je envoyer mon planning dans Google/Apple Agenda ?">
              Oui : Exporter → format Agenda (.ics).
            </FaqItem>
            <FaqItem q="Mon salarié voit-il son planning ?">
              Oui, s&apos;il a un compte (offre Complet) : il est dirigé vers le planning en se connectant.
            </FaqItem>
            <FaqItem q="Comment affecter quelqu’un rapidement ?">
              Glisse son étiquette (chip) sur une case, ou clique une case vide.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'equipe', label: 'Mon équipe' },
              { id: 'chantiers', label: 'Chantiers' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'chantiers',
      icon: HardHat,
      title: 'Chantiers — La fiche centrale de tes projets',
      subtitle: 'Équipe, notes & rappels, sous-traitants, avancement, marge, export PDF',
      content: (
        <>
          <p className="mb-4">
            La fiche chantier est le centre de pilotage d&apos;un projet. Elle regroupe plusieurs onglets :
            Vue générale, Devis, Factures, Photos, Plan 2D. Tu peux aussi créer un chantier directement, sans
            devis.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Sur la Vue générale</h4>
          <ArrowList
            items={[
              (
                <>
                  <strong>Équipe du chantier</strong> : ajoute un intervenant + une date → l&apos;intervention
                  est créée automatiquement dans le planning. À l&apos;inverse, tout intervenant planifié sur
                  le chantier apparaît ici avec un badge « Via planning »
                </>
              ),
              (
                <>
                  <strong>Notes &amp; rappels</strong> : une liste de tâches/rappels avec catégories (Urgent,
                  À faire, Matériel, Appel/Contact, Note) et une case « fait » (avec date « Fait le »)
                </>
              ),
              (
                <>
                  <strong>Sous-traitants</strong> : suivi des paiements (Prévu / Payé / statut
                  À payer-Partiel-Payé) avec un bouton « Payer »
                </>
              ),
              (
                <>
                  <strong>Avancement</strong> : Nexartis calcule des indicateurs (% d&apos;avancement,
                  encaissé, reste, dépenses = sous-traitants + achats, marge et marge %). C&apos;est ici, au
                  niveau du chantier, que tu vois la marge (devis facturé − dépenses) — pas dans le devis
                </>
              ),
              (
                <>
                  <strong>Facturation</strong> : récap des situations émises + bouton « Émettre une facture
                  de situation » (pré-remplit le % suggéré)
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Les achats se rattachent au chantier et comptent dans les dépenses et la marge. Le matériel, lui,
            est un inventaire : il n&apos;entre pas dans la marge d&apos;un chantier.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Statuts du chantier</h4>
          <p className="mb-3">En cours / Terminé (Livré ou Clôturé) / Archivé.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Export PDF</h4>
          <p className="mb-3">
            Un bouton d&apos;export du PDF chantier propose une option pour inclure un « Pacte de chantier »
            (voir plus bas) et un « Récap pour client » — c&apos;est notamment via ce récap que tu partages
            tes photos de chantier avec ton client.
          </p>
          <p className="mb-3">
            Un onglet Plan 2D est disponible sur la fiche chantier ; le module complet dédié (Plan 2D/3D) est
            en préparation.
          </p>
          <HiddenFunctionsBlock
            items={[
              'Ajouter un intervenant + une date sur le chantier crée automatiquement l’intervention dans le planning (et inversement, badge « Via planning »).',
              'Rattacher un achat à un chantier le fait remonter directement dans le calcul de marge — sans ce rattachement, la marge affichée est optimiste.',
              'Ajouter un achat pré-rempli directement depuis le chantier fait gagner du temps par rapport à repartir de l’onglet Achats.',
            ]}
          />
          <ProTipsBlock
            items={[
              'Rattache toujours tes achats à un chantier pour avoir une marge fiable — sinon le chiffre reste optimiste.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Où est la marge de mon chantier ?">
              Fiche chantier &gt; Vue générale &gt; Avancement : montant facturé − dépenses (sous-traitants +
              achats).
            </FaqItem>
            <FaqItem q="Comment obtenir le Pacte de chantier ?">
              À l&apos;export PDF du chantier, coche l&apos;option « Pacte de chantier ».
            </FaqItem>
            <FaqItem q="Puis-je créer un chantier sans devis ?">Oui.</FaqItem>
            <FaqItem q="Plan 2D : c’est disponible ?">
              Un onglet Plan 2D est présent sur la fiche chantier ; le module complet dédié (2D/3D) est en
              préparation.
            </FaqItem>
            <FaqItem q="Comment partager les photos au client ?">Via le récap PDF de fin de chantier.</FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'devis', label: 'Devis' },
              { id: 'planning', label: 'Planning' },
              { id: 'achats', label: 'Achats' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'rapport-intervention',
      icon: ClipboardList,
      title: 'Rapport d’intervention — un compte-rendu illustré à remettre au client',
      subtitle: 'Pages modulaires photos/texte/constatations, upload robuste',
      content: (
        <>
          <p className="mb-4">
            <BadgeComplet /> Un rapport d&apos;intervention est un compte-rendu illustré (photos,
            constatations, texte) que tu remets à ton client après une intervention.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Création</h4>
          <p className="mb-3">
            « Nouveau rapport » → tu peux le lier à un devis (reprend client, adresse, objet) ou saisir
            librement. Tu renseignes l&apos;objet, la date d&apos;intervention et la date de fin.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">L&apos;éditeur</h4>
          <p className="mb-3">
            L&apos;en-tête est éditable (client avec autocomplétion, adresse, dates, objet) et se sauvegarde
            automatiquement. Tu empiles des pages modulaires de 4 types :
          </p>
          <ArrowList
            items={[
              (
                <>
                  <strong>Photos</strong> (1 à 4 photos avec légende et rotation)
                </>
              ),
              (
                <>
                  <strong>Texte libre</strong>
                </>
              ),
              (
                <>
                  <strong>Constatations</strong> (liste)
                </>
              ),
              (
                <>
                  <strong>Page de fin</strong> (contrôles/observations/conclusion)
                </>
              ),
            ]}
          />
          <p className="mb-3">Tu peux réordonner ou supprimer les pages à tout moment.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Photos</h4>
          <p className="mb-3">
            Upload slot par slot, ou « plusieurs d&apos;un coup » (jusqu&apos;à{' '}
            <span className="font-spline-mono">30</span> photos, une page créée par photo). C&apos;est
            robuste : une file d&apos;attente reprend l&apos;envoi même en cas de coupure réseau, et
            l&apos;application t&apos;avertit si un envoi est en cours.
          </p>
          <p className="mb-3">La dictée vocale est possible pour remplir les champs texte.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Statuts et génération</h4>
          <p className="mb-3">
            Brouillon / Finalisé / Envoyé. Tu peux prévisualiser en PDF, télécharger, ou « Envoyer au client »
            (email + message, passe en « Envoyé »). Le PDF reprend tes couleurs d&apos;entreprise.
          </p>
          <Callout type="tip">
            Attends la fin de l&apos;upload des photos avant d&apos;envoyer. Sur mobile avec beaucoup de
            photos, la génération peut être un peu lourde — patiente quelques instants.
          </Callout>
          <SeeAlso onGo={goToSection} items={[{ id: 'chantiers', label: 'Chantiers' }]} />
        </>
      ),
    },

    // ============================================================
    // PLAN 2D/3D — dessine ton chantier, le métré part au devis
    // (fiche complète V2 optimisée — module Complet, Bêta)
    // ============================================================
    {
      id: 'plan-2d-3d',
      icon: Layers,
      title: 'Plan 2D/3D — Dessine ton chantier, le métré part au devis',
      subtitle: 'Dessine à la cote, vérifie en 3D, récupère tes quantités par métier dans le devis — sans ressaisie',
      content: (
        <>
          <p className="mb-4">
            <BadgeComplet />
            <span className="ml-2 inline-block align-middle bg-sky-100 text-sky-800 text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-[3px] rounded-full border border-sky-200">
              Bêta
            </span>
          </p>
          <p className="mb-4">
            Avec le Plan 2D/3D, tu dessines ton chantier à la cote exacte : pièces, murs, ouvertures.
            Tu le vérifies en vraie 3D, d&apos;un coup d&apos;œil. Puis tu envoies les <strong>métrés par
            métier directement dans ton devis</strong>, sans rien retaper. C&apos;est un outil de métré et de
            plan qui alimente ton devis — <strong>pas un logiciel d&apos;architecture</strong>.
          </p>
          <Callout type="tip">
            Disponible dans l&apos;offre <strong>Complet</strong>, et testable pendant l&apos;essai gratuit.
          </Callout>

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Où le trouver</h4>
          <ArrowList
            items={[
              <>Dans le menu, l&apos;onglet <strong>Plans 2D/3D</strong> (pastille « Bêta ») : la liste de tous tes plans, tous chantiers confondus.</>,
              <>Depuis une <strong>fiche chantier</strong>, onglet <strong>Plan</strong> : un plan reste toujours rattaché à un chantier.</>,
            ]}
          />

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Comment ça marche, en 4 étapes</h4>
          <StepsList
            items={[
              <><strong>Crée ton plan.</strong> Bouton « Nouveau plan », choisis le chantier, puis ton métier.</>,
              <><strong>Dessine à plat.</strong> Pose tes pièces, murs et ouvertures. Chaque cote est éditable : clique-la, ou tape <span className="font-spline-mono">Longueur × Largeur</span> dans le panneau de droite.</>,
              <><strong>Bascule en 3D.</strong> Le bouton <span className="font-spline-mono">À plat / Vue 3D</span> relève ton plan : murs épais, ouvertures découpées, ombres portées. Tourne à la souris pour tout vérifier.</>,
              <><strong>Envoie le métré au devis.</strong> Les quantités calculées partent dans le devis du chantier, prêtes à chiffrer.</>,
            ]}
          />
          <Callout type="tip">
            La règle d&apos;or : <strong>à plat pour dessiner précis, en 3D pour vérifier</strong>. La saisie fine
            des cotes se fait toujours à plat.
          </Callout>

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Un exemple concret</h4>
          <Callout type="tip">
            Tu dessines une pièce de <span className="font-spline-mono">4,20 × 3,10 m</span> : Nexartis envoie{' '}
            <span className="font-spline-mono">13,02 m²</span> de dalle dans ton devis maçonnerie — ta cote
            n&apos;est pas arrondie. Tu saisis une épaisseur de <span className="font-spline-mono">0,15 m</span> :
            tu obtiens en plus <span className="font-spline-mono">1,953 m³</span> de béton. Tu poses une porte :{' '}
            <span className="font-spline-mono">1 u</span> apparaît en menuiserie. Tu traces{' '}
            <span className="font-spline-mono">8 ml</span> de façade sur <span className="font-spline-mono">2,50 m</span>{' '}
            de haut : <span className="font-spline-mono">20 m²</span> et <span className="font-spline-mono">8 ml</span>{' '}
            partent au devis. Aucune ressaisie.
          </Callout>

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Ce que tu dessines, ce qui part au devis</h4>
          <CheckList
            items={[
              <><strong>Maçonnerie</strong> — pièces et dalle → dalle béton et chape en <span className="font-spline-mono">m²</span> ; si tu saisis une épaisseur, le volume en <span className="font-spline-mono">m³</span> en plus.</>,
              <><strong>Menuiserie</strong> — chaque ouvrant dessiné (porte, fenêtre) → une ligne en <span className="font-spline-mono">u</span>.</>,
              <><strong>Chauffage</strong> — radiateur → <span className="font-spline-mono">u</span> ; plancher chauffant → <span className="font-spline-mono">m²</span>.</>,
              <><strong>Terrassement</strong> — allée → surface <span className="font-spline-mono">m²</span> + décaissement <span className="font-spline-mono">m³</span> (profondeur saisie) ; tranchée de semelle → <span className="font-spline-mono">ml</span> et <span className="font-spline-mono">m³</span>.</>,
              <><strong>Mur extérieur / façade</strong> — que tu traces toi-même (hauteur saisie) → surface <span className="font-spline-mono">m²</span> (linéaire × hauteur) + linéaire de base <span className="font-spline-mono">ml</span>.</>,
            ]}
          />

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Nos garanties sur tes métrés</h4>
          <CheckList
            items={[
              <><strong>Ta cote saisie n&apos;est jamais arrondie.</strong> Ce que tu tapes est ce qui est calculé.</>,
              <><strong>Une surface extérieure ne donne jamais un chiffre d&apos;intérieur</strong>, et inversement.</>,
              <><strong>Aucun double compte</strong> des murs mitoyens.</>,
              <><strong>Rien n&apos;est deviné.</strong> Tout se saisit ou se choisit : aucune hauteur ni épaisseur inventée.</>,
            ]}
          />

          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Ce que le Plan 2D/3D ne fait pas (encore)</h4>
          <NotYetBlock
            items={[
              { bold: 'Ce n’est pas un logiciel d’architecture.', text: <>Pas de rendu photoréaliste, de décoration d&apos;intérieur ni de visite virtuelle. L&apos;objectif est le métré juste, pas l&apos;image.</> },
              { bold: 'Le contour du bâtiment n’est pas calculé tout seul.', text: <>Pour une façade ou un mur extérieur, tu traces toi-même le mur : c&apos;est plus fiable qu&apos;un périmètre déduit automatiquement.</> },
            ]}
          />
          <Callout type="warn">
            Le module est en <strong>Bêta</strong> : il évolue vite. Si un métré te semble à revoir, dis-le-nous
            depuis le bouton de contact — c&apos;est comme ça qu&apos;on l&apos;améliore.
          </Callout>

          <FaqBlock>
            <FaqItem q="Ça remplace un logiciel d’architecte ?">
              Non. C&apos;est un outil de métré et de plan qui alimente ton devis. Il ne fait pas de conception
              architecturale ni de rendu 3D professionnel.
            </FaqItem>
            <FaqItem q="Mes cotes sont-elles arrondies ?">
              Jamais. La cote que tu saisis est celle qui est utilisée, au millimètre près.
            </FaqItem>
            <FaqItem q="Le contour de mon bâtiment est-il calculé automatiquement ?">
              Non. Tu traces toi-même ton mur extérieur ou ta façade : c&apos;est plus fiable qu&apos;un périmètre
              déduit tout seul.
            </FaqItem>
          </FaqBlock>

          <SeeAlso
            items={[
              { id: 'chantiers', label: 'Chantiers' },
              { id: 'devis', label: 'Devis' },
              { id: 'calculatrices', label: 'Calculatrices métier' },
            ]}
            onGo={goToSection}
          />
        </>
      ),
    },

    // ============================================================
    // GROUPE — TES DONNÉES (BASE DE DONNÉES)
    // ============================================================
    {
      id: 'clients',
      icon: Users,
      title: 'Clients — Saisis une fois, retrouve partout',
      subtitle: 'Particuliers ou professionnels, historique complet, notes internes',
      groupHeading: 'Tes données',
      content: (
        <>
          <p className="mb-4">
            Chaque client enregistré est réutilisable partout grâce à l&apos;autocomplete : saisi une fois,
            retrouvé instantanément dans tes devis et factures.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Deux types de client</h4>
          <ArrowList
            items={[
              (
                <>
                  <strong>Particulier</strong> : nom, prénom, adresse, email, téléphone
                </>
              ),
              (
                <>
                  <strong>Professionnel</strong> : en plus, raison sociale + SIRET (
                  <span className="font-spline-mono">14</span> chiffres)
                </>
              ),
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Fonctions utiles</h4>
          <CheckList
            items={[
              'Filtres : Tous / Particuliers / Professionnels / Archivés',
              'Recherche instantanée (nom, email, téléphone)',
              'Notes internes : un champ privé, jamais imprimé sur un document',
              'Case « Exclure des relances auto » sur la fiche client, utile pour un gros compte ou en cas de litige',
            ]}
          />
          <p className="mb-3">
            La fiche client regroupe ses coordonnées, ses chiffres clés (CA total, nombre de chantiers, nombre
            de devis) et tous ses chantiers/devis/factures. Des actions rapides permettent de créer un devis,
            d&apos;appeler ou d&apos;envoyer un email directement.
          </p>
          <Callout type="tip">
            L&apos;accueil te signale automatiquement les doublons probables de clients (même nom/même
            email). Il n&apos;y a pas de fusion automatique : tu corriges à la main, en supprimant ou
            modifiant la fiche en trop.
          </Callout>
          <FaqBlock>
            <FaqItem q="J’ai supprimé un client, il est dans la corbeille ?">
              Non : la corbeille ne garde que les devis et factures (
              <span className="font-spline-mono">7 jours</span>). Réfléchis avant de supprimer un client.
            </FaqItem>
            <FaqItem q="J’ai un doublon de client, je le fusionne ?">
              Il n&apos;y a pas de fusion automatique ; l&apos;accueil te signale les doublons, supprime/édite
              la fiche en trop.
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'fournisseurs',
      icon: Warehouse,
      title: 'Fournisseurs — Ton carnet de fournisseurs habituels',
      subtitle: 'Négoces, loueurs, déchèteries : pré-remplissage en un clic',
      content: (
        <>
          <p className="mb-4">
            Ton carnet de fournisseurs habituels : négoces, loueurs, déchèteries... Champs disponibles : nom,
            contact, email, téléphone, adresse, code postal, ville, SIRET, notes.
          </p>
          <p className="mb-3">
            Une fois enregistré, un fournisseur est proposé en un clic quand tu ajoutes un achat. Il est même
            détecté automatiquement quand son nom apparaît dans un libellé bancaire, lors du tri de tes
            opérations dans l&apos;onglet Banque.
          </p>
          <FaqBlock>
            <FaqItem q="Puis-je importer mes fournisseurs ?">
              Oui, via l&apos;onglet Importer (catégorie Fournisseurs).
            </FaqItem>
            <FaqItem q="Supprimer un fournisseur ?">
              La suppression est définitive (pas de corbeille pour les fournisseurs).
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'prestations',
      icon: Library,
      title: 'Prestations — Ta bibliothèque + un catalogue métier de 700+ prestations',
      subtitle: '« Mes prestations » (perso) et « Catalogue » (700+ prêtes à copier)',
      content: (
        <>
          <p className="mb-4">
            Deux modes disponibles : « Mes prestations » (ton catalogue personnel, enregistré) et «
            Catalogue » (une bibliothèque toute prête par métier, en consultation, avec un bouton « +
            Ajouter » pour la copier dans tes prestations).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Chaque prestation contient
          </h4>
          <CheckList items={['Désignation', 'Unité (forfait, heure, m², ml, jour...)', 'Prix unitaire HT', 'Taux de TVA', 'Catégorie']} />
          <p className="mb-3">
            Le catalogue par métier réunit plus de <span className="font-spline-mono">700</span> prestations
            réparties par métier (électricien, plombier, chauffagiste, maçon, carreleur, plaquiste, peintre,
            menuisier, couvreur, charpentier, serrurier, vitrier, terrassier, paysagiste, + prestations
            communes), pré-filtré selon ton métier.
          </p>
          <p className="mb-3">Chaque ligne ajoutée à un devis est aussi sauvegardée automatiquement ici.</p>
          <Callout type="warn">
            Limite selon ton offre : Essentiel = <span className="font-spline-mono">50</span> prestations
            personnelles maximum ; Complet = illimité.
          </Callout>
          <ProTipsBlock
            items={[
              'Enrichis régulièrement ta bibliothèque de prestations : plus elle est fournie, plus tes prochains devis se font vite.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Différence entre « Mes prestations » et « Catalogue » ?">
              « Mes prestations » = ta bibliothèque perso enregistrée. « Catalogue » = une bibliothèque toute
              prête par métier (<span className="font-spline-mono">700+</span>), à copier en un clic.
            </FaqItem>
            <FaqItem q="Y a-t-il une limite ?">
              En Essentiel, <span className="font-spline-mono">50</span> prestations perso ; illimité en
              Complet.
            </FaqItem>
            <FaqItem q="J’ai atteint 50 prestations (Essentiel), je fais quoi ?">
              Passe à l&apos;offre Complet pour une bibliothèque illimitée, ou fais le ménage dans tes
              prestations existantes.
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'materiel',
      icon: Wrench,
      title: 'Matériel — Ton inventaire pro : outillage, véhicule, EPI...',
      subtitle: 'Catégories, mode d’acquisition, assurance, alertes de révision',
      content: (
        <>
          <p className="mb-4">
            Gère ton inventaire professionnel : outillage, échafaudage, véhicule, équipements de protection
            individuelle (EPI)...
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Catégories et états</h4>
          <ArrowList
            items={[
              'Catégories : Électroportatif, Échafaudage, Véhicule, EPI, Gros outillage, Autre',
              'États : Neuf / Bon / Usé / HS',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Mode d&apos;acquisition et suivi financier
          </h4>
          <p className="mb-3">
            Comptant, Crédit, Leasing, LLD (location longue durée). Pour crédit/leasing/LLD, tu renseignes :
            montant total, mensualité, durée, banque, date de fin. Tu peux aussi indiquer une durée
            d&apos;amortissement (recommandé : <span className="font-spline-mono">5 ans</span> pour
            l&apos;outillage).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Assurance &amp; entretien</h4>
          <p className="mb-3">
            Mensualité d&apos;assurance, compagnie, n° de police, échéance, prochaine révision, budget
            d&apos;entretien annuel.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">En tête de page</h4>
          <p className="mb-3">
            Total équipements, valeur du parc, coût mensuel récurrent (calculé : mensualités crédit +
            assurance + entretien/12), et le nombre d&apos;alertes.
          </p>
          <Callout type="warn">
            Une révision ou une assurance arrivant à échéance dans moins de{' '}
            <span className="font-spline-mono">30 jours</span> passe en rouge, et en ambre en dessous de{' '}
            <span className="font-spline-mono">60 jours</span>. Ces alertes s&apos;affichent dans l&apos;app
            (pas d&apos;email pour le matériel).
          </Callout>
          <FaqBlock>
            <FaqItem q="Le « coût mensuel » je le saisis ?">
              Non, il est calculé (mensualités crédit/leasing + assurance + budget entretien ÷ 12).
            </FaqItem>
            <FaqItem q="Le matériel compte-t-il dans la marge d’un chantier ?">
              Non : c&apos;est ton inventaire. Ce sont les Achats rattachés au chantier qui entrent dans la
              marge.
            </FaqItem>
            <FaqItem q="Les alertes de révision sont-elles envoyées par email ?">
              Non, elles s&apos;affichent dans l&apos;app. Pour les assurances/certifications en revanche, tu
              reçois un email à J-30 et J-15 (voir la fiche Certifications &amp; assurances).
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'equipe',
      icon: UserRound,
      title: 'Mon équipe — Gère qui intervient pour ton entreprise',
      subtitle: 'Mode Solo auto-détecté ou gestion multi-intervenants + comptes',
      content: (
        <>
          <p className="mb-4">
            <BadgeComplet /> Gère qui intervient pour ton entreprise. Cette page s&apos;adapte à ton profil :
          </p>
          <ArrowList
            items={[
              (
                <>
                  <strong>Solo</strong> (auto-entrepreneur, EI, micro) : tu es créé automatiquement comme
                  intervenant unique, rien à faire pour utiliser le planning. Tu peux ajouter un sous-traitant
                  ponctuel
                </>
              ),
              (
                <>
                  <strong>Société</strong> (SARL, EURL, SAS...) : ajoute autant d&apos;intervenants que tu
                  veux
                </>
              ),
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Type de contrat</h4>
          <p className="mb-3">
            CDI, CDD, Apprenti, Intérimaire, Sous-traitant (entité externe, avec suivi des paiements séparé).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Deux notions à ne pas confondre
          </h4>
          <ArrowList
            items={[
              (
                <>
                  Le <strong>rôle métier</strong> (Apprenti, Ouvrier, Compagnon, Chef d&apos;équipe, Dirigeant)
                  — purement descriptif
                </>
              ),
              (
                <>
                  Le <strong>niveau d&apos;accès</strong> si tu donnes un compte au membre
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Le métier et la couleur de chaque intervenant permettent de le repérer d&apos;un coup d&apos;œil
            dans le planning. Toi, le dirigeant, tu apparais avec un badge « Vous ».
          </p>
          <p className="mb-3">
            Un historique par membre affiche ses chantiers, et pour un sous-traitant, l&apos;historique des
            paiements (montant payé).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Comptes &amp; accès (multi-utilisateurs)
          </h4>
          <p className="mb-3">
            Le dirigeant peut inviter des membres à avoir leur propre compte (par email d&apos;invitation)
            avec des droits limités (Commercial / Chef de chantier, ou Ouvrier). Réservé à l&apos;offre
            Complet. Un ouvrier ne voit pas les finances (prix, marges, factures, banque).
          </p>
          <Callout type="tip">
            Pré-requis planning en Société : crée ton équipe ici d&apos;abord, sinon le planning n&apos;a
            personne à assigner.
          </Callout>
          <FaqBlock>
            <FaqItem q="Je travaille seul, dois-je créer une équipe ?">
              Non : en mode Solo tu es créé automatiquement, le planning sait que c&apos;est toi.
            </FaqItem>
            <FaqItem q="Comment donner un accès à un salarié ?">
              Comptes &amp; accès : invitation par email, avec droits limités (offre Complet).
            </FaqItem>
            <FaqItem q="Combien d’utilisateurs puis-je créer ?">
              <span className="font-spline-mono">1</span> en Essentiel ; illimité en Complet.
            </FaqItem>
            <FaqItem q="Un salarié voit-il mes prix et mes marges ?">
              Non : les accès sont limités selon le rôle ; un ouvrier ne voit pas les finances.
            </FaqItem>
            <FaqItem q="Comment retirer un accès ?">
              Depuis Comptes &amp; accès, tu peux révoquer un membre.
            </FaqItem>
          </FaqBlock>
          <SeeAlso onGo={goToSection} items={[{ id: 'planning', label: 'Planning' }]} />
        </>
      ),
    },

    // ============================================================
    // GROUPE — FINANCES
    // ============================================================
    {
      id: 'banque',
      icon: Landmark,
      title: 'Banque — Suis l’argent qui bouge et trie tes opérations sans effort',
      subtitle: 'Import CSV, tri automatique, pointage, caisse, registres, bandeau URSSAF',
      groupHeading: 'Finances',
      content: (
        <>
          <p className="mb-4">
            L&apos;onglet Banque sert à suivre « l&apos;argent qui bouge » (banque + caisse) et à trier
            facilement tes opérations.
          </p>
          <Callout type="warn">
            Nexartis n&apos;affiche pas le solde de ton compte bancaire — c&apos;est un choix assumé : on suit
            les mouvements, pas le solde. Seule exception : le solde de la caisse (espèces) est affiché. Il
            n&apos;y a pas non plus de connexion bancaire automatique : tu importes ton relevé en CSV.
          </Callout>
          <p className="mb-3">Sous-onglets disponibles : Opérations · À classer · Caisse · Par chantier · Registres.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Importer un relevé</h4>
          <p className="mb-3">
            Format CSV uniquement (pas de PDF, pas d&apos;OFX/QIF, pas d&apos;Excel). Maximum{' '}
            <span className="font-spline-mono">4 Mo</span> / <span className="font-spline-mono">10 000</span>{' '}
            lignes. Le parcours se fait en 4 étapes : Fichier → Vérification → Import → Terminé. Nexartis
            détecte tout seul les colonnes (date, libellé, montant, ou débit/crédit séparés), comprend les
            montants « à la française » (virgule, €), et si une date est ambiguë, il te demande plutôt que de
            deviner. Les doublons déjà présents sont repérés (« Déjà là »). Un écran de « victoire » récapitule
            ce qui a été classé en fin d&apos;import. Une modale d&apos;aide t&apos;indique où télécharger ton
            relevé selon ta banque, et tu peux « importer la suite » depuis la dernière date déjà présente.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Le tri automatique (le cœur de l&apos;onglet)
          </h4>
          <p className="mb-3">Nexartis reconnaît tes commerçants habituels et range tes dépenses :</p>
          <CheckList
            items={[
              'Reconnaissance certaine (fournisseur BTP, URSSAF, carburant...) : la dépense est classée ET pointée toute seule → « déjà classée »',
            ]}
          />
          <ArrowList
            items={[
              'Reconnaissance ambiguë (supermarché, Amazon...) : la dépense est juste reconnue mais reste « à confirmer » — tu dis « plutôt pro / plutôt perso » ou tu valides la catégorie suggérée. Rien n’est pointé sans toi',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Deux garde-fous à bien comprendre
          </h4>
          <p className="mb-3">
            <strong>1. Un crédit (argent qui entre) n&apos;est jamais classé automatiquement en recette.</strong>{' '}
            Pourquoi : tes cotisations URSSAF se calculent sur ce que tu encaisses. Si la machine décidait
            qu&apos;un virement entrant est une « recette », elle pourrait compter comme chiffre
            d&apos;affaires de l&apos;argent qui n&apos;en est pas (un virement de ton compte perso, un
            remboursement d&apos;assurance) — et tu paierais des cotisations en trop. Tout crédit se rapproche
            donc à la main d&apos;une facture.
          </p>
          <p className="mb-3">
            <strong>2. Une dépense perso n&apos;est jamais pointée automatiquement</strong> : c&apos;est à toi
            de confirmer qu&apos;une opération est « perso » — elle sort alors de tes chiffres professionnels.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Onglet « À classer »</h4>
          <p className="mb-3">
            Les opérations sont regroupées par commerçant, jamais 60 lignes une par une : « À confirmer », «
            À trier », « Déjà classées » (tu vois toujours pourquoi c&apos;est classé, et tu peux corriger en
            cliquant « Changer » — c&apos;est réversible).
          </p>
          <Callout type="tip">
            Validation en masse : un bouton « Valider les N suggestions sûres (annulable) » te fait gagner du
            temps. Par sécurité, il ignore toujours le perso, les crédits, les cas ambigus et les gros
            montants (≥ <span className="font-spline-mono">300 €</span>) — ceux-là se confirment toujours à la
            main.
          </Callout>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Pointage manuel</h4>
          <p className="mb-3">
            Un panneau qui enchaîne les opérations (bouton « Passer » pour reporter une opération à plus
            tard) : pour une dépense, tu choisis une catégorie et éventuellement un chantier (ça crée
            l&apos;achat lié). Pour un crédit, tu rapproches une facture non soldée (un même virement peut
            couvrir 2 factures). Cas particuliers gérés : remboursement/avoir, virement entre tes comptes, «
            c&apos;est perso ». Avec « retenir pour les prochaines fois », tu crées une règle qui
            s&apos;appliquera automatiquement aux opérations similaires.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Caisse</h4>
          <p className="mb-3">
            Gère tes espèces (fond de caisse + entrées/sorties). Le solde de caisse est affiché.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Plusieurs comptes</h4>
          <p className="mb-3">Tu peux gérer plusieurs comptes bancaires et filtrer l&apos;affichage par compte.</p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Par chantier</h4>
          <p className="mb-3">
            La rentabilité de chaque chantier (Facturé vs Dépensé), avec un message d&apos;honnêteté si des
            dépenses ne sont pas encore rattachées (le chiffre est alors « optimiste »).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Registres</h4>
          <p className="mb-3">
            Génère deux PDF légaux du micro-entrepreneur — le Livre des recettes (obligatoire) et le Registre
            des achats — calculés depuis tes pointages. À conserver{' '}
            <span className="font-spline-mono">10 ans</span>. Ça ne remplace pas un expert-comptable.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Bandeau URSSAF</h4>
          <p className="mb-3">
            En haut de l&apos;onglet Banque, il t&apos;indique ce qu&apos;il faut mettre de côté pour tes
            cotisations, à partir de ton CA encaissé de l&apos;année. Taux prudent par défaut (prestation de
            services), jauge de plafond micro (alerte à <span className="font-spline-mono">80 %</span>) et
            alerte TVA au conditionnel. C&apos;est une aide à l&apos;épargne, pas une télédéclaration.
          </p>
          <HiddenFunctionsBlock
            items={[
              'Un fournisseur enregistré est détecté automatiquement quand son nom apparaît dans un libellé bancaire — pas besoin de le sélectionner à la main.',
              'La règle « retenir pour les prochaines fois » s’applique ensuite toute seule aux opérations similaires, ça évite de retrier le même commerçant chaque mois.',
              'Un même virement peut être rapproché de 2 factures si le montant couvre les deux.',
              'La file de tri s’enchaîne toute seule avec le bouton « Passer » pour reporter un cas difficile sans bloquer les autres.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Pourquoi mon solde bancaire ne s’affiche pas ?">
              Choix assumé : Nexartis suit les mouvements, pas le solde. Seul le solde de la caisse (espèces)
              est affiché.
            </FaqItem>
            <FaqItem q="Pourquoi un virement reçu reste « à trier » ?">
              Un crédit n&apos;est jamais classé automatiquement, pour ne pas gonfler ta base URSSAF par
              erreur. Rapproche-le d&apos;une facture à la main.
            </FaqItem>
            <FaqItem q="Mon relevé est un PDF, comment l’importer ?">
              Seul le CSV est accepté. Exporte ton relevé en CSV depuis ton espace bancaire.
            </FaqItem>
            <FaqItem q="Dois-je tout trier une opération à la fois ?">
              Non : le tri automatique reconnaît tes commerçants, regroupe par marchand, et un bouton valide
              d&apos;un coup les suggestions sûres.
            </FaqItem>
            <FaqItem q="Puis-je connecter ma banque automatiquement ?">
              Non, pas de connexion bancaire automatique : tu importes ton relevé en CSV (les doublons sont
              détectés).
            </FaqItem>
            <FaqItem q="J’ai plusieurs comptes ?">Oui, tu peux en gérer plusieurs et filtrer par compte.</FaqItem>
            <FaqItem q="J’ai mal classé une opération ?">
              Va dans « Déjà classées » et clique « Changer », c&apos;est réversible.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'achats', label: 'Achats' },
              { id: 'calculatrices', label: 'URSSAF' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'achats',
      icon: ShoppingBag,
      title: 'Achats — Enregistre chaque dépense fournisseur',
      subtitle: 'Justificatif, lien chantier, export comptable, factures reçues',
      content: (
        <>
          <p className="mb-4">
            Enregistre chaque dépense fournisseur (matériaux, outillage, location, déchèterie...). Colonnes
            disponibles : date, fournisseur, description, Montant HT, TVA (
            <span className="font-spline-mono">5,5</span> / <span className="font-spline-mono">10</span> /{' '}
            <span className="font-spline-mono">20 %</span>), Montant TTC (calculé), chantier associé,
            justificatif.
          </p>
          <CheckList
            items={[
              'Justificatif : tu attaches la facture fournisseur (PDF ou photo)',
              'Lien chantier : rattache l’achat à un chantier → il compte dans la marge (visible dans Banque > Par chantier et dans l’avancement du chantier)',
              'Filtres par période + recherche',
              'Export CSV comptable ou PDF',
            ]}
          />
          <p className="mb-3">
            Un deuxième onglet, « Factures reçues », rassemble la réception de tes e-factures (voir la
            section Facture électronique dans Réglementation).
          </p>
          <FaqBlock>
            <FaqItem q="Nexartis lit-il ma facture fournisseur tout seul (OCR) ?">
              Non : tu saisis les montants ; le justificatif (PDF/photo) est stocké tel quel.
            </FaqItem>
            <FaqItem q="Comment voir ma marge par chantier ?">
              Rattache tes achats à un chantier, puis va dans Banque &gt; Par chantier.
            </FaqItem>
            <FaqItem q="Nexartis récupère-t-il la TVA pour moi ?">
              Non : il enregistre HT/TVA/TTC ; pour la déduction de TVA, vois avec ton comptable.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'banque', label: 'Banque' },
              { id: 'chantiers', label: 'Chantiers' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'statistiques',
      icon: TrendingUp,
      title: 'Statistiques — Une vision large de ton activité',
      subtitle: 'CA facturé vs encaissé, conversion devis, reste à encaisser',
      content: (
        <>
          <p className="mb-4">
            La page Statistiques te donne une vision large de ton activité : CA facturé (factures émises −
            avoirs) vs CA encaissé (factures payées), et le reste à encaisser (facturé − encaissé).
          </p>
          <CheckList
            items={[
              'Graphique annuel en barres (facturé vs encaissé par mois), avec un sélecteur d’année (pas de futur)',
              'Devis : taux de transformation (signés/total), montant moyen',
              'Factures : reste à encaisser, factures en retard, taux d’encaissement',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Puis-je voir une autre année ?">Oui, avec le sélecteur d&apos;année.</FaqItem>
          </FaqBlock>
        </>
      ),
    },

    // ============================================================
    // GROUPE — OUTILS
    // ============================================================
    {
      id: 'calculatrices',
      icon: Calculator,
      title: 'Calculatrices (dont l’aide URSSAF) — 10 calculatrices métier',
      subtitle: '100 % dans ton navigateur, favorites mémorisées par appareil',
      groupHeading: 'Outils',
      content: (
        <>
          <p className="mb-4">
            Des calculatrices métier, 100 % dans ton navigateur. Tu choisis « tes » calculatrices (mémorisées
            sur ton appareil), pré-cochées selon ton métier.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">10 calculatrices disponibles</h4>
          <ArrowList
            items={[
              'Universelles : URSSAF (à déclarer), TVA travaux, Taux horaire',
              'Par métier : Béton & ciment, Carrelage, Toiture (pente), Peinture, Section de câble, Puissance chauffage, Sable/gazon synthétique',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Aide URSSAF</h4>
          <p className="mb-3">
            Calcule le montant à déclarer = ton CA encaissé sur une période (mois/trimestre/année), à
            recopier sur le portail URSSAF. Un résultat copiable en un clic, plus une estimation facultative
            de cotisations si tu saisis ton taux.
          </p>
          <Callout type="warn">Ce n&apos;est pas un conseil fiscal, et ça ne télédéclare pas à ta place.</Callout>
          <p className="mb-3">L&apos;ancien onglet « URSSAF » renvoie désormais ici.</p>
          <HiddenFunctionsBlock
            items={[
              'Tes calculatrices favorites sont mémorisées par appareil : elles peuvent être différentes sur ton téléphone et sur ton ordinateur.',
            ]}
          />
          <FaqBlock>
            <FaqItem q="Où est passé l’onglet URSSAF ?">
              Il est désormais dans les Calculatrices (aide URSSAF).
            </FaqItem>
            <FaqItem q="Quel montant je déclare à l’URSSAF ?">
              Ton chiffre d&apos;affaires ENCAISSÉ sur la période (ce que tu as réellement reçu), pas le
              facturé. L&apos;aide URSSAF te le calcule et te le rend copiable.
            </FaqItem>
          </FaqBlock>
          <SeeAlso onGo={goToSection} items={[{ id: 'banque', label: 'Banque' }]} />
        </>
      ),
    },
    {
      id: 'normes',
      icon: BookOpen,
      title: 'Normes — Un référentiel de normes BTP / DTU par métier',
      subtitle: 'NF C 15-100, garde-corps... recherche transverse',
      content: (
        <>
          <p className="mb-4">
            Un référentiel de normes BTP / DTU (Documents Techniques Unifiés) par métier — par exemple la NF C
            15-100 pour l&apos;électricité, les garde-corps... Une recherche transverse te permet de
            retrouver une norme rapidement.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Chaque fiche contient</h4>
          <CheckList
            items={[
              'La référence et l’intitulé',
              'À qui ça s’applique',
              'Les points clés, chiffres & seuils',
              'Neuf vs rénovation',
              'Un lien source et un badge de confiance (« Vérifié » / « À vérifier »)',
            ]}
          />
          <p className="mb-3">
            Un bloc « Obligations transverses » (assurances, garanties, certifications) est disponible par
            métier.
          </p>
          <Callout type="warn">
            Informations indicatives : ça ne certifie rien, vérifie toujours la source officielle.
          </Callout>
        </>
      ),
    },

    // ============================================================
    // GROUPE — DOCUMENTS & PERSONNALISATION
    // ============================================================
    {
      id: 'coffre-fort',
      icon: FolderLock,
      title: 'Documents types & Coffre-fort — modèles prêts + espace sécurisé',
      subtitle: 'CGV, PV de réception, courrier libre + RIB, décennale, Kbis...',
      groupHeading: 'Documents & personnalisation',
      content: (
        <>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-1 mb-2">Documents types</h4>
          <p className="mb-3">
            Des modèles générés, pré-remplis depuis ton profil, éditables, avec export PDF et envoi par email
            : CGV (Conditions Générales de Vente), PV de réception de chantier, Courrier libre. Bonus pour les
            serruriers : un Contrat d&apos;ouverture de porte.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Le Coffre-fort (« Mes documents »)</h4>
          <p className="mb-3">
            Range tes documents importants : RIB, attestation décennale, RC pro, Kbis... Fonctionne en
            glisser-déposer, jusqu&apos;à <span className="font-spline-mono">10 Mo</span> par fichier.
            Formats très larges acceptés (PDF, Word, Excel, CSV, images, ZIP...).
          </p>
          <p className="mb-3">
            Catégories : RIB, Assurance décennale, RC pro, Ouverture d&apos;entreprise, Document généré,
            Autre.
          </p>
          <Callout type="warn">
            Supprimer un document du coffre-fort est définitif. Il ne passe pas par la corbeille, contrairement
            aux devis et factures.
          </Callout>
          <FaqBlock>
            <FaqItem q="J’ai supprimé un document du coffre-fort par erreur, je le récupère ?">
              Non : la suppression du coffre-fort est définitive (pas de corbeille). Réfléchis avant de
              supprimer.
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'personnaliser-couleurs-documents',
      icon: Palette,
      title: 'Personnalise les couleurs de tes documents — aligne devis/factures sur ta marque',
      subtitle: 'Modèles prêts ou réglage zone par zone, aperçu live sur les 4 rendus',
      content: (
        <>
          <p className="mb-4">
            Aligne tes devis et factures sur tes couleurs d&apos;entreprise. Où : Paramètres &gt; onglet
            Apparence.
          </p>
          <p className="mb-3">
            Tu peux choisir parmi une galerie de modèles prêts (templates), ou régler les couleurs zone par
            zone : bandeau d&apos;en-tête gauche et droite, accent, carte Émetteur, carte « Adressé à »,
            encadré Net à payer, bandeau de pied.
          </p>
          <p className="mb-3">
            Un aperçu en direct s&apos;affiche pendant que tu règles les couleurs. Tes choix s&apos;appliquent
            aux 4 rendus : devis HTML, devis PDF, facture HTML, facture PDF.
          </p>
          <Callout type="tip">
            Reprends 2 couleurs maximum (celles de ton logo ou de ta camionnette) pour rester pro.
          </Callout>
        </>
      ),
    },
    {
      id: 'personnaliser-dashboard',
      icon: LayoutDashboard,
      title: 'Personnalise la couleur de ton dashboard — 14 couleurs pour ta barre latérale',
      subtitle: 'Réglage stocké par appareil, contraste du texte automatique',
      content: (
        <>
          <p className="mb-4">
            La barre latérale (le menu de gauche) prend la couleur de ton choix. Où : Paramètres &gt; onglet
            Apparence.
          </p>
          <p className="mb-3">
            <span className="font-spline-mono">14</span> couleurs disponibles : Orange (défaut), Bleu, Ciel,
            Turquoise, Vert, Jaune, Rouge, Rose, Fuchsia, Violet, Indigo, Marron, Gris, Noir.
          </p>
          <p className="mb-3">
            Le texte s&apos;adapte tout seul (clair ou foncé) pour rester lisible quelle que soit la couleur
            choisie.
          </p>
          <Callout type="tip">
            Ce réglage est stocké sur ton appareil (par navigateur). Tu peux donc avoir une couleur différente
            sur ton téléphone et sur ton ordinateur.
          </Callout>
        </>
      ),
    },
    {
      id: 'edition-signature',
      icon: Sparkles,
      title: 'Édition Signature — le rendu premium par défaut',
      subtitle: 'Aucun réglage à faire, identique sur les 4 affichages',
      content: (
        <>
          <p className="mb-4">
            C&apos;est le rendu par défaut de tous tes documents : une mise en page dense et claire, avec le
            pavé légal complet en pied de page, un tableau de lignes structuré, les totaux mis en valeur, et
            les mentions auto-entrepreneur ajoutées automatiquement si besoin. Aucun réglage à faire de ton
            côté.
          </p>
          <p className="mb-3">
            Ce rendu est strictement identique sur les 4 affichages : HTML dashboard, PDF téléchargé, PDF
            email, et page de signature du client.
          </p>
          <Callout type="tip">
            Pour tes anciens documents : régénère le PDF depuis la liste pour leur appliquer ce rendu.
          </Callout>
        </>
      ),
    },
    {
      id: 'penalites-retard',
      icon: AlertTriangle,
      title: 'Pénalités de retard — les mentions légales obligatoires sur toute facture pro',
      subtitle: 'Taux légal + indemnité forfaitaire de 40 €',
      content: (
        <>
          <p className="mb-4">
            Ces mentions sont obligatoires sur toute facture professionnelle en France. Où activer :
            Paramètres &gt; onglet Facturation.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Ce qui est ajouté</h4>
          <CheckList
            items={[
              (
                <>
                  La mention « Pénalités de retard : <span className="font-spline-mono">3</span> fois le taux
                  d&apos;intérêt légal en vigueur (art. <span className="font-spline-mono">L.441-10</span> C.
                  com.) »
                </>
              ),
              (
                <>
                  Pour les factures entre professionnels (B2B) : l&apos;indemnité forfaitaire de{' '}
                  <span className="font-spline-mono">40 €</span> pour frais de recouvrement
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Ces mentions apparaissent sur le HTML de la facture, le PDF téléchargé et le PDF envoyé par email.
          </p>
        </>
      ),
    },
    {
      id: 'certifications-assurances',
      icon: ShieldCheck,
      title: 'Certifications & assurances — ne laisse plus jamais une assurance expirer',
      subtitle: 'Décennale, RC pro, vigilance URSSAF, qualifications RGE/Qualibat/Qualifelec',
      content: (
        <>
          <p className="mb-4">
            Où : Paramètres &gt; onglet Certifications &amp; assurances. Suis ta décennale, ta RC pro
            (responsabilité civile professionnelle), ta vigilance URSSAF, et tes qualifications (RGE,
            Qualibat, Qualifelec...).
          </p>
          <p className="mb-3">
            Des alertes email t&apos;avertissent <span className="font-spline-mono">30</span> et{' '}
            <span className="font-spline-mono">15 jours</span> avant expiration, pour ne jamais laisser une
            assurance ou une certification expirer.
          </p>
        </>
      ),
    },
    {
      id: 'pacte-chantier',
      icon: Handshake,
      title: 'Pacte de chantier — formalise les engagements de chacun avant de démarrer',
      subtitle: 'Un document optionnel qui limite les malentendus',
      content: (
        <>
          <p className="mb-4">
            Un document optionnel signé en début de chantier, qui formalise les engagements des deux côtés et
            limite les malentendus.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Contenu du modèle</h4>
          <ArrowList
            items={[
              (
                <>
                  Engagements de l&apos;artisan : démarrage aux dates convenues, information/photos, propreté
                  &amp; sécurité, prévenir <span className="font-spline-mono">48h</span> à l&apos;avance,
                  livraison
                </>
              ),
              'Engagements du client : accès au chantier, préparation des lieux, présence, règlement du solde',
              'Une clause en cas d’imprévu',
            ]}
          />
          <p className="mb-3">
            Pour l&apos;obtenir : depuis la fiche d&apos;un chantier, à l&apos;export PDF, coche l&apos;option
            « Pacte de chantier » — une page de garde est alors ajoutée au PDF.
          </p>
        </>
      ),
    },
    {
      id: 'documents-legaux',
      icon: Lock,
      title: 'Tes documents légaux & tes données (RGPD)',
      subtitle: 'Mentions légales, CGV, confidentialité, cookies — hébergement Europe',
      content: (
        <>
          <p className="mb-4">
            Nexartis met à ta disposition ses documents légaux : Mentions légales, CGV, Politique de
            confidentialité (RGPD — règlement européen sur la protection des données), Politique cookies. Ils
            sont accessibles depuis le pied de page de nexartis.fr.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Tes données</h4>
          <CheckList
            items={['Hébergées en Europe', 'Jamais revendues', 'Cloisonnées : chaque artisan ne voit que ses propres données']}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Supprimer ton compte</h4>
          <p className="mb-3">
            Paramètres &gt; onglet Compte → ouvre un email vers contact.nexartis@gmail.com. Après résiliation
            d&apos;abonnement, tes données sont conservées <span className="font-spline-mono">90 jours</span>.
          </p>
        </>
      ),
    },

    // ============================================================
    // GROUPE — RÉGLEMENTATION (à jour juillet 2026)
    // ============================================================
    {
      id: 'taux-tva',
      icon: Percent,
      title: 'Quel taux de TVA appliquer ? 20 %, 10 % ou 5,5 %',
      subtitle: 'Les règles simples pour ne pas se tromper de taux',
      groupHeading: 'Réglementation — à jour juillet 2026',
      content: (
        <>
          <p className="mb-4">
            En BTP, trois taux de TVA existent selon la nature des travaux. Voici comment t&apos;y retrouver.
          </p>
          <ArrowList
            items={[
              (
                <>
                  <strong className="font-spline-mono">20 %</strong> : construction neuve, logement achevé
                  depuis moins de <span className="font-spline-mono">2 ans</span>, agrandissement
                  (surélévation, extension)
                </>
              ),
              (
                <>
                  <strong className="font-spline-mono">10 %</strong> : travaux d&apos;amélioration,
                  transformation ou entretien d&apos;un logement achevé depuis plus de{' '}
                  <span className="font-spline-mono">2 ans</span>
                </>
              ),
              (
                <>
                  <strong className="font-spline-mono">5,5 %</strong> : travaux de rénovation{' '}
                  <strong>énergétique</strong> (isolation thermique, pompe à chaleur, chaudière biomasse,
                  ventilation performante...)
                </>
              ),
            ]}
          />
          <Callout type="warn">
            Attention, piège fréquent : la fourniture et l&apos;installation d&apos;une{' '}
            <strong>chaudière à gaz</strong> n&apos;est <strong>plus</strong> éligible au taux réduit — elle
            est au taux normal de <span className="font-spline-mono">20 %</span> depuis 2026. Ne dis pas «
            chauffage = 5,5 % » : seule la rénovation réellement énergétique (isolation, PAC, biomasse...)
            ouvre droit au taux réduit.
          </Callout>
          <p className="mb-3">
            Dans Nexartis, le <strong>taux de TVA se choisit ligne par ligne</strong> sur ton devis ou ta
            facture — tu peux donc mixer plusieurs taux sur un même document si le chantier mélange plusieurs
            natures de travaux.
          </p>
          <Callout type="tip">
            En cas de doute : vérifie les conditions précises du chantier (nature exacte des travaux, âge du
            logement) ou demande confirmation à ton comptable avant d&apos;appliquer un taux réduit. Une
            erreur de taux peut être redressée par l&apos;administration fiscale.
          </Callout>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'attestation-tva', label: 'Attestation TVA' },
              { id: 'autoliquidation-tva', label: 'Autoliquidation' },
              { id: 'devis', label: 'Devis' },
            ]}
          />
        </>
      ),
    },
    {
      id: 'autoliquidation-tva',
      icon: ArrowLeftRight,
      title: 'Autoliquidation TVA (sous-traitance BTP)',
      subtitle: 'Quand c’est le donneur d’ordre qui déclare la TVA à ta place',
      content: (
        <>
          <p className="mb-4">
            Quand tu travailles comme <strong>sous-traitant</strong> pour une autre entreprise du BTP,
            c&apos;est elle (l&apos;entreprise principale, appelée le donneur d&apos;ordre) qui déclare la
            TVA, pas toi : c&apos;est l&apos;autoliquidation.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Comment l&apos;activer</h4>
          <p className="mb-3">
            Sur ton devis ou ta facture, active l&apos;option « Autoliquidation BTP » : les montants passent
            hors taxes et la mention légale « Autoliquidation — TVA due par le preneur (art.{' '}
            <span className="font-spline-mono">283-2 nonies</span> du CGI) » est ajoutée automatiquement.
          </p>
          <Callout type="warn">
            À n&apos;utiliser que si : tu es effectivement sous-traitant d&apos;un donneur d&apos;ordre
            assujetti à la TVA. Ne coche pas cette case pour un client final (particulier ou maître
            d&apos;ouvrage direct).
          </Callout>
        </>
      ),
    },
    {
      id: 'attestation-tva',
      icon: FileSignature,
      title: 'Attestation TVA à taux réduit — la mention qui a remplacé le Cerfa',
      subtitle: 'Depuis le 16 février 2025, plus de papier séparé',
      content: (
        <>
          <p className="mb-4">
            Jusqu&apos;en 2025, un taux réduit de TVA (<span className="font-spline-mono">10 %</span> ou{' '}
            <span className="font-spline-mono">5,5 %</span>) obligeait à faire signer au client une
            attestation papier séparée (un formulaire Cerfa). <strong>Ce n&apos;est plus le cas.</strong>
          </p>
          <Callout type="warn">
            Depuis le 16 février 2025 : l&apos;attestation papier (Cerfa) est supprimée. Elle est remplacée
            par une <strong>mention</strong> portée directement sur le devis ou la facture, que le client
            valide simplement en signant le document.
          </Callout>
          <p className="mb-3">
            Dès que tu utilises un taux réduit (<span className="font-spline-mono">10 %</span> ou{' '}
            <span className="font-spline-mono">5,5 %</span>) sur une ligne, Nexartis ajoute automatiquement
            cette mention sur le devis et la facture, selon le taux concerné. Tu n&apos;as rien à rédiger ni à
            faire signer à part.
          </p>
          <Callout type="tip">
            Conserve simplement les devis et factures signés — ils servent de justificatif en cas de contrôle.
            Il n&apos;y a plus besoin d&apos;un document séparé.
          </Callout>
          <SeeAlso onGo={goToSection} items={[{ id: 'taux-tva', label: 'Quel taux de TVA appliquer ?' }]} />
        </>
      ),
    },
    {
      id: 'franchise-tva',
      icon: Banknote,
      title: 'Franchise de TVA (art. 293 B) — les seuils en vigueur',
      subtitle: 'Pour les auto-entrepreneurs et micro-entreprises',
      content: (
        <>
          <p className="mb-4">
            En franchise de TVA, tu ne factures pas de TVA à tes clients : la mention « TVA non applicable,
            art. <span className="font-spline-mono">293 B</span> du CGI » s&apos;ajoute automatiquement sur
            tes devis et factures dès que tes lignes sont à <span className="font-spline-mono">0 %</span>.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Les seuils en vigueur</h4>
          <CheckList
            items={[
              (
                <>
                  Prestations de services : <span className="font-spline-mono">37 500 €</span> de chiffre
                  d&apos;affaires (tolérance jusqu&apos;à <span className="font-spline-mono">41 250 €</span>)
                </>
              ),
              (
                <>
                  Ventes de marchandises : <span className="font-spline-mono">85 000 €</span> (tolérance
                  jusqu&apos;à <span className="font-spline-mono">93 500 €</span>)
                </>
              ),
            ]}
          />
          <Callout type="warn">
            Attention aux chiffres qui circulent : un seuil spécifique de{' '}
            <span className="font-spline-mono">25 000 €</span> pour le BTP a été envisagé fin 2025, mais cette
            mesure a été <strong>rejetée</strong> — elle ne s&apos;applique pas. Ce sont bien les seuils
            généraux ci-dessus qui sont en vigueur.
          </Callout>
          <p className="mb-3">
            Tant que tu restes sous ton seuil, tu ne factures pas de TVA. Le jour où tu le dépasses, tu
            deviens redevable de la TVA et tu commences à la facturer — la mention 293 B disparaît alors toute
            seule de tes documents, tu n&apos;as rien à changer à la main.
          </p>
          <SeeAlso onGo={goToSection} items={[{ id: 'profil-entreprise', label: 'Profil entreprise' }]} />
        </>
      ),
    },
    {
      id: 'retractation',
      icon: CalendarClock,
      title: 'Le délai de rétractation de 14 jours',
      subtitle: 'Quand un devis est signé au domicile du client',
      content: (
        <>
          <p className="mb-4">
            Quand tu fais signer un devis <strong>au domicile</strong> d&apos;un particulier (ce qu&apos;on
            appelle le démarchage à domicile), la loi lui donne{' '}
            <span className="font-spline-mono">14 jours</span> pour changer d&apos;avis et se rétracter.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Ce que ça implique</h4>
          <ArrowList
            items={[
              'Tu dois informer le client de ce droit de rétractation',
              'Tu dois lui remettre un bordereau de rétractation',
              (
                <>
                  Les travaux ne peuvent pas commencer avant la fin des{' '}
                  <span className="font-spline-mono">14 jours</span>, sauf si le client en fait la demande
                  écrite expresse (il veut que ça démarre plus tôt)
                </>
              ),
            ]}
          />
          <Callout type="tip">
            Ça ne s&apos;applique pas si : le devis est signé dans tes locaux professionnels (atelier, bureau)
            — le délai de rétractation ne concerne que la signature au domicile du client.
          </Callout>
          <p className="mb-3">
            Nexartis ajoute automatiquement la mention légale de rétractation sur les devis destinés à des
            clients particuliers.
          </p>
          <SeeAlso onGo={goToSection} items={[{ id: 'devis', label: 'Devis' }]} />
        </>
      ),
    },
    {
      id: 'facture-electronique',
      icon: FileCheck2,
      title: 'Facture électronique (Factur-X) & réception des e-factures',
      subtitle: 'La réforme 2026-2027 expliquée simplement',
      content: (
        <>
          <p className="mb-4">Calendrier confirmé de la réforme :</p>
          <ArrowList
            items={[
              (
                <>
                  <strong className="font-spline-mono">1er septembre 2026</strong> : toutes les entreprises, y
                  compris les artisans, doivent pouvoir <strong>recevoir</strong> une facture électronique.
                  Les grandes entreprises et les ETI doivent, elles, déjà pouvoir <strong>émettre</strong> à
                  cette date
                </>
              ),
              (
                <>
                  <strong className="font-spline-mono">1er septembre 2027</strong> : les PME, TPE et
                  micro-entreprises — donc la plupart des artisans — doivent à leur tour pouvoir{' '}
                  <strong>émettre</strong> leurs factures au format électronique
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Le Factur-X, c&apos;est exactement la même facture (même mise en page, même logo), avec en plus
            des données cachées dans le PDF que les logiciels de compta lisent tout seuls. Rien ne change
            visuellement pour toi ou ton client.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Télécharger un Factur-X</h4>
          <p className="mb-3">
            Ouvre une facture, clique sur le bouton « Facture électronique » (à côté de Télécharger PDF). Ce
            bouton est masqué pour les avoirs.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Envoyer en électronique (émission)</h4>
          <p className="mb-3">
            Le bouton « Envoyer en électronique » passe par la plateforme SUPER PDP (Plateforme de
            Dématérialisation Partenaire). Il est réservé aux clients professionnels avec SIRET (B2B). Nexartis
            valide la conformité avant l&apos;envoi (et bloque si ce n&apos;est pas conforme), puis suit le
            statut (accepté/rejeté par la plateforme).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Recevoir tes factures fournisseurs en électronique
          </h4>
          <StepsList
            items={[
              (
                <>
                  Va dans Paramètres &gt; section « Facturation électronique », clique « Connecter ma
                  facturation électronique »
                </>
              ),
              (
                <>
                  Suis la connexion sécurisée (OAuth, un protocole d&apos;autorisation) et donne ton accord. Le
                  statut affiche « ✓ Compte connecté »
                </>
              ),
              (
                <>
                  Nexartis récupère ensuite automatiquement (une fois par jour) tes factures entrantes et les
                  dépose dans Achats &gt; onglet « Factures reçues ». Tu reçois un email quand il y a du
                  nouveau
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Dans l&apos;onglet « Factures reçues » : statuts Nouvelle / Consultée / Refusée. Tu peux
            prévisualiser, télécharger l&apos;original, et refuser avec un motif obligatoire (transmis
            officiellement au fournisseur).
          </p>
          <Callout type="tip">
            Si après connexion tu ne reçois rien, écris-nous — ta réception dépend de l&apos;inscription de
            ton entreprise comme « récepteur » côté plateforme.
          </Callout>
          <FaqBlock>
            <FaqItem q="Comment recevoir mes factures fournisseurs en électronique ?">
              Paramètres &gt; Facturation électronique &gt; Connecter. Ensuite elles arrivent automatiquement
              dans Achats &gt; Factures reçues (relève quotidienne).
            </FaqItem>
            <FaqItem q="J’ai connecté mais je ne reçois rien ?">
              Ta réception dépend de l&apos;inscription de ton entreprise comme « récepteur » côté plateforme
              : si rien n&apos;arrive, écris-nous.
            </FaqItem>
            <FaqItem q="Je ne facture que des particuliers, suis-je concerné ?">
              Oui, pour l&apos;e-reporting (la transmission des données de tes ventes à l&apos;administration)
              à partir de 2027. L&apos;essentiel à retenir : sois prêt à <strong>recevoir</strong> des
              factures électroniques dès 2026, et à <strong>émettre</strong> les tiennes dès 2027, même si tes
              clients sont surtout des particuliers.
            </FaqItem>
          </FaqBlock>
          <SeeAlso
            onGo={goToSection}
            items={[
              { id: 'factures', label: 'Factures' },
              { id: 'achats', label: 'Achats' },
            ]}
          />
        </>
      ),
    },

    // ============================================================
    // GROUPE — OUTILS MALINS & ADMIN
    // ============================================================
    {
      id: 'devis-factures-vocaux',
      icon: Mic,
      title: 'Devis & facture vocaux — Dicte au lieu de taper',
      subtitle: 'Parle, Nexartis écrit. Idéal entre deux chantiers, dans la camionnette',
      groupHeading: 'Outils malins & admin',
      content: (
        <>
          <p className="mb-4">
            <BadgeComplet /> Dicte au lieu de taper. Ouvre « Nouveau devis » (ou nouvelle facture), clique «
            Dicter », autorise le micro (une fois par appareil), parle, puis reclique pour arrêter.
          </p>
          <p className="mb-3">
            <strong>Exemple qui marche :</strong> « Crée un devis pour Jean Dupont, 23 rue de la Mairie à
            Bordeaux, 5 heures de pose électrique à 45 euros de l&apos;heure. »
          </p>
          <p className="mb-3">
            Nexartis extrait le client (et le crée s&apos;il n&apos;existe pas encore), chaque ligne
            (désignation, quantité, unité, prix), et calcule les totaux selon ton régime de TVA.
          </p>
          <Callout type="warn">
            Limites : parle d&apos;une traite (un silence long coupe la dictée), évite le bruit ambiant et les
            acronymes rares (dis « mètres carrés » plutôt que « m² »).
          </Callout>
          <p className="mb-3">Réservé à l&apos;offre Complet.</p>
        </>
      ),
    },
    {
      id: 'installer-nexartis-pwa',
      icon: Smartphone,
      title: 'Installe Nexartis sur ton téléphone — une vraie appli, sans store',
      subtitle: 'iPhone, Android, ordinateur : 3 façons de l’installer',
      content: (
        <>
          <p className="mb-4">
            Nexartis s&apos;installe comme une vraie application, sans passer par l&apos;App Store ou le Play
            Store (on appelle ça une « PWA », une application web installable).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">3 façons de l&apos;installer</h4>
          <ArrowList
            items={[
              'Le bandeau orange « Installer Nexartis » en haut du dashboard',
              'Le QR code affiché sur nexartis.fr',
              'Paramètres > onglet Application (le QR code y est disponible à tout moment)',
            ]}
          />
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Selon ton appareil</h4>
          <CheckList
            items={[
              (
                <>
                  <strong>iPhone (Safari)</strong> : bouton Partager → « Sur l&apos;écran d&apos;accueil »
                </>
              ),
              (
                <>
                  <strong>Android (Chrome)</strong> : menu ⋮ → « Ajouter à l&apos;écran d&apos;accueil »
                </>
              ),
              (
                <>
                  <strong>Ordinateur (Chrome/Edge)</strong> : petite icône d&apos;installation à droite de la
                  barre d&apos;adresse
                </>
              ),
            ]}
          />
          <p className="mb-3">
            Bénéfices : une icône sur ton écran d&apos;accueil, une ouverture instantanée, et la consultation
            hors-ligne partielle des pages déjà visitées.
          </p>
        </>
      ),
    },
    {
      id: 'importer',
      icon: ArrowDownToLine,
      title: 'Importer tes données — récupère un autre logiciel sans tout retaper',
      subtitle: 'Obat, Tolteck, Batappli, Henrri, Excel/CSV — assistant en 4 étapes',
      content: (
        <>
          <p className="mb-4">
            Récupère tes données d&apos;un autre logiciel sans tout retaper. Cette fonction se trouve dans «
            Mon compte » et est réservée au dirigeant.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Sources reconnues</h4>
          <p className="mb-3">
            Obat, Obat (export comptable), Tolteck, Batappli, Henrri, et Excel/CSV générique. Chaque source
            dispose de son propre guide d&apos;export.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">Ce que tu peux importer</h4>
          <p className="mb-3">
            Clients, devis, factures, lignes de devis/factures, chantiers, prestations, fournisseurs,
            intervenants, planning, paiements, achats.
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">L&apos;assistant d&apos;import</h4>
          <p className="mb-3">
            4 étapes : Source → Fichiers → Vérification → Import, avec un aperçu avant de valider. Pour les
            doublons, tu choisis : Ignorer / Écraser / Créer un nouveau.
          </p>
        </>
      ),
    },
    {
      id: 'corbeille',
      icon: Trash2,
      title: 'Corbeille — 7 jours pour changer d’avis',
      subtitle: 'Devis et factures supprimés restent récupérables une semaine',
      content: (
        <>
          <p className="mb-4">
            Quand tu supprimes un devis ou une facture, il part en corbeille pendant{' '}
            <span className="font-spline-mono">7 jours</span> (récupérable), puis c&apos;est définitif.
          </p>
          <CheckList items={['Restaurer un document', 'Supprimer définitivement avant les 7 jours', 'Vider la corbeille']} />
          <Callout type="warn">
            La corbeille ne concerne que les devis et factures — pas les documents du coffre-fort, ni le
            matériel, ni les clients, ni les fournisseurs.
          </Callout>
          <FaqBlock>
            <FaqItem q="J’ai supprimé un client, il est dans la corbeille ?">
              Non : la corbeille ne garde que les devis et factures (
              <span className="font-spline-mono">7 jours</span>).
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },
    {
      id: 'parrainage',
      icon: Gift,
      title: 'Parrainage — 1 mois offert pour chaque artisan parrainé',
      subtitle: 'Un lien personnel à partager par SMS, email ou réseaux',
      content: (
        <>
          <p className="mb-4">
            Dans <strong>Paramètres &gt; onglet Parrainage</strong>, tu obtiens ton lien de parrainage
            personnel.
          </p>
          <p className="mb-3">
            Pour chaque artisan que tu parraines et qui s&apos;abonne, tu gagnes{' '}
            <span className="font-spline-mono">1 mois offert</span>. À partager par SMS, email ou sur les
            réseaux.
          </p>
        </>
      ),
    },
    {
      id: 'abonnement',
      icon: CreditCard,
      title: 'Abonnement & offres — 14 jours d’essai gratuit, sans carte bancaire',
      subtitle: 'Essentiel 15 €/mois ou Complet 25 €/mois, résiliation libre',
      content: (
        <>
          <p className="mb-4">
            <span className="font-spline-mono">14 jours</span> d&apos;essai gratuit, sans carte bancaire, avec
            accès à toutes les fonctions (comme l&apos;offre Complet).
          </p>
          <h4 className="font-hanken font-bold text-[15px] text-navy mt-5 mb-2">
            Deux offres, sans engagement, résiliation à tout moment
          </h4>
          <p className="mb-3">
            <strong>Essentiel — <span className="font-spline-mono">15 € HT</span>/mois</strong> (soit{' '}
            <span className="font-spline-mono">18 € TTC</span>, 1 utilisateur) : devis &amp; factures
            illimités, signature électronique, mentions BTP + TVA (
            <span className="font-spline-mono">5,5</span>/<span className="font-spline-mono">10</span>/
            <span className="font-spline-mono">20 %</span>) automatiques, acomptes &amp; attestations TVA
            rénovation, factures d&apos;avoir, suivi des impayés &amp; relances email, e-facture (réception
            2026 + émission prête 2027), QR de virement SEPA, tableau de bord du CA, 10 calculatrices + aide
            URSSAF, catalogue +700 prestations + bibliothèque perso (
            <span className="font-spline-mono">50</span> max), rappels décennale, clients &amp; chantiers
            illimités.
          </p>
          <p className="mb-3">
            <strong>Complet — <span className="font-spline-mono">25 € HT</span>/mois</strong> (soit{' '}
            <span className="font-spline-mono">30 € TTC</span>) : tout l&apos;Essentiel, plus Planning
            chantier + alertes de conflit, Gestion d&apos;équipe &amp; comptes, Devis vocal par IA, Factures de
            situation, Export comptable (Sage/EBP/FEC), Rapport d&apos;intervention, Bibliothèque de
            prestations illimitée.
          </p>
          <p className="mb-3">
            Le paiement est sécurisé via Stripe. Tu peux mettre à jour ta carte, voir tes factures
            d&apos;abonnement (pour ta compta) et résilier depuis le portail Stripe « Gérer mon abonnement ».
            En cas de résiliation, l&apos;accès reste actif jusqu&apos;à la fin du mois payé.
          </p>
          <Callout type="tip">
            Si tu ne prends pas d&apos;abonnement à la fin de l&apos;essai, tes données sont conservées en
            sécurité (jamais supprimées). Après résiliation, elles sont gardées{' '}
            <span className="font-spline-mono">90 jours</span>.
          </Callout>
          <p className="mb-3">Statuts possibles de ton compte : essai, actif, suspendu, accès à vie.</p>
          <FaqBlock>
            <FaqItem q="Que se passe-t-il si je ne paie pas après l’essai ?">
              Tes données sont conservées en sécurité (jamais supprimées) ; ton accès devient restreint tant
              que tu n&apos;as pas souscrit.
            </FaqItem>
            <FaqItem q="Puis-je changer d’offre ?">Oui, à tout moment.</FaqItem>
            <FaqItem q="Après résiliation, mes données restent combien de temps ?">
              <span className="font-spline-mono">90 jours</span>.
            </FaqItem>
            <FaqItem q="Où trouver la facture de mon abonnement (pour ma compta) ?">
              Dans le portail Stripe « Gérer mon abonnement ».
            </FaqItem>
            <FaqItem q="15 €/25 € HT, ça fait combien TTC ?">
              +20 % de TVA, soit <span className="font-spline-mono">18 €</span> /{' '}
              <span className="font-spline-mono">30 €</span> TTC.
            </FaqItem>
            <FaqItem q="Si je repasse de Complet à Essentiel, je perds quoi ?">
              L&apos;accès au planning, à l&apos;équipe, aux factures de situation, au vocal et aux rapports
              d&apos;intervention ; tes données restent conservées.
            </FaqItem>
          </FaqBlock>
        </>
      ),
    },

    // ============================================================
    // GLOSSAIRE — les mots expliqués simplement
    // ============================================================
    {
      id: 'glossaire',
      icon: BookA,
      title: 'Glossaire — les mots expliqués simplement',
      subtitle: 'Tous les termes techniques et juridiques de Nexartis, en clair',
      groupHeading: 'Glossaire',
      content: (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            {
              t: 'HT / TTC / TVA',
              d: 'HT = hors taxes (le prix sans la TVA) ; TTC = toutes taxes comprises (ce que le client paie) ; TVA = taxe ajoutée (0 %, 5,5 %, 10 % ou 20 % selon les travaux).',
            },
            { t: 'Devis', d: 'Proposition de prix envoyée au client avant les travaux.' },
            { t: 'Facture', d: 'Document de demande de paiement après (ou pendant) les travaux.' },
            { t: 'Acompte', d: 'Somme versée d’avance par le client pour lancer le chantier.' },
            {
              t: 'Facture de situation',
              d: 'Facture intermédiaire d’un gros chantier, qui facture la part déjà réalisée (n°1, n°2, n°3...).',
            },
            { t: 'Facture d’avoir', d: '« Facture négative » qui rembourse/annule tout ou partie d’une facture.' },
            {
              t: 'Avoir « à valoir »',
              d: 'Un avoir non remboursé qui reste disponible pour être déduit d’une prochaine facture du même client.',
            },
            {
              t: 'Facture électronique (Factur-X)',
              d: 'Ta facture habituelle, avec en plus des données lisibles par les logiciels de compta, au format imposé par la réforme 2026-2027.',
            },
            {
              t: 'E-reporting',
              d: 'La transmission à l’administration des données de tes ventes (notamment à des particuliers), en complément de la facture électronique entre professionnels.',
            },
            {
              t: 'PDP (Plateforme de Dématérialisation Partenaire)',
              d: 'Une plateforme agréée par l’État qui transmet tes factures électroniques (c’est via une PDP, comme SUPER PDP, que Nexartis envoie et reçoit tes e-factures).',
            },
            {
              t: 'DGD (Décompte Général Définitif)',
              d: 'Le document qui arrête définitivement les comptes d’un chantier en fin de travaux (souvent utilisé dans les marchés publics/importants) ; dans Nexartis, la dernière facture de situation joue ce rôle pour tes chantiers.',
            },
            {
              t: 'Retenue de garantie',
              d: 'Une somme (souvent 5 %) que le client conserve jusqu’à la fin du chantier pour se couvrir en cas de malfaçon. Nexartis la gère sur les factures de situation : coche l’option (plafond 5 %), le montant est déduit du net à payer et figure sur la facture.',
            },
            {
              t: 'Échéance',
              d: 'La date limite de paiement d’une facture, choisie à sa création. Passée cette date sans paiement, la facture passe « En retard ».',
            },
            {
              t: 'Franchise de TVA (art. 293 B)',
              d: 'Régime où tu ne factures pas de TVA (typique auto-entrepreneur) tant que tu restes sous un seuil de chiffre d’affaires ; mention légale automatique.',
            },
            {
              t: 'Autoliquidation BTP',
              d: 'Cas de sous-traitance où c’est le client (l’entreprise principale) qui déclare la TVA, pas toi.',
            },
            {
              t: 'Délai de rétractation',
              d: '14 jours dont dispose un particulier pour se rétracter après avoir signé un devis à son domicile (démarchage).',
            },
            { t: 'Assurance décennale', d: 'Assurance obligatoire dans le BTP couvrant 10 ans les gros dommages.' },
            { t: 'RC pro', d: 'Responsabilité civile professionnelle (dommages causés pendant le chantier).' },
            { t: 'SIREN / SIRET', d: 'Numéros d’identification de ton entreprise (SIRET = SIREN + établissement).' },
            { t: 'RCS / RM', d: 'Registre où ton entreprise est inscrite (Commerce, ou Métiers pour les artisans).' },
            { t: 'IBAN / BIC', d: 'Tes coordonnées bancaires pour recevoir un virement.' },
            { t: 'QR SEPA', d: 'Petit carré à scanner qui prépare le virement du client (sur tes factures).' },
            { t: 'PWA', d: '« Progressive Web App » = installer le site comme une appli sur ton téléphone.' },
            { t: 'Pointer une opération', d: 'Dire à quoi correspond une ligne de ton relevé (catégorie, chantier).' },
            { t: 'Rapprocher une facture', d: 'Relier un virement reçu à la facture qu’il paie.' },
            { t: 'Relance', d: 'Rappel envoyé au client qui n’a pas payé à temps.' },
            { t: 'AGEC', d: 'Loi sur la gestion/traçabilité des déchets de chantier.' },
            { t: 'CGV', d: 'Conditions générales de vente.' },
            { t: 'PV de réception', d: 'Document signé à la fin qui atteste que le chantier est reçu.' },
            {
              t: 'Corbeille (soft delete)',
              d: 'Suppression réversible pendant 7 jours (devis/factures uniquement).',
            },
          ].map((item) => (
            <div key={item.t} className="pb-3 border-b border-dashed border-gray-200">
              <dt className="font-hanken font-bold text-navy text-[14.5px] mb-1">{item.t}</dt>
              <dd className="text-[13.8px] text-gray-600 leading-relaxed">{item.d}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ]

  // ── Groupe de chaque fiche (pour l'affichage sous les suggestions) ──
  const sectionGroupMap = useMemo(() => {
    const map: Record<string, string> = {}
    let currentGroup = ''
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      if (s.groupHeading) currentGroup = s.groupHeading
      map[s.id] = currentGroup
    }
    return map
  }, [sections])

  // ── Recherche : filtrage des fiches + recalcul des titres de groupe ──
  // Chaque section appartient au groupe défini par le dernier
  // `groupHeading` rencontré dans l'ordre du tableau. Après filtrage,
  // on réaffiche le titre de groupe sur le 1er item visible du groupe.
  const visibleSections = useMemo(() => {
    let currentGroup: string | undefined
    const seenGroups = new Set<string>()

    return sections
      .map((section) => {
        if (section.groupHeading) currentGroup = section.groupHeading
        return { section, group: currentGroup }
      })
      .filter(({ section }) => sectionMatchesQuery(section, query))
      .map(({ section, group }) => {
        // Premier item visible de son groupe → on lui pose le titre de groupe.
        let displayGroupHeading: string | undefined
        if (group && !seenGroups.has(group)) {
          seenGroups.add(group)
          displayGroupHeading = group
        }
        return { section, displayGroupHeading }
      })
  }, [sections, query])

  const hasResults = visibleSections.length > 0

  // ── Autocomplétion : jusqu'à 7 suggestions, titre prioritaire sur contenu ──
  const suggestions = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return [] as Section[]
    const normalizedQuery = normalize(trimmed)
    const titleMatches: Section[] = []
    const contentMatches: Section[] = []
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!sectionMatchesQuery(section, trimmed)) continue
      if (normalize(section.title).indexOf(normalizedQuery) !== -1) {
        titleMatches.push(section)
      } else {
        contentMatches.push(section)
      }
    }
    return titleMatches.concat(contentMatches).slice(0, 7)
  }, [sections, query])

  const dropdownVisible = showSuggestions && query.trim().length >= 2 && suggestions.length > 0

  // Ferme le menu de suggestions au clic en dehors de la barre de recherche.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && e.target instanceof Node && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false)
        setActiveSuggestion(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestion(-1)
      return
    }
    if (!dropdownVisible) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        e.preventDefault()
        goToSection(suggestions[activeSuggestion].id)
      }
    }
  }

  return (
    <div className="min-h-screen" style={{background: '#f6f8fb'}}>
      <div className="max-w-[960px] mx-auto px-4 py-6 sm:px-6 sm:py-10">

        {/* ============ HEADER ============ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-hanken font-extrabold text-2xl sm:text-3xl text-navy leading-tight" style={{color: '#0f1a3a', letterSpacing: '-0.02em'}}>
                Aide &amp; Tutoriels
              </h1>
              <p className="font-hanken text-sm text-gray-500 mt-0.5">
                Tout ce qu&apos;il faut savoir pour tirer le meilleur de Nexartis
              </p>
            </div>
          </div>
        </div>

        {/* ============ BLOC NOUS CONTACTER ============ */}
        <section className="mb-8 bg-white border border-gray-200 shadow-sm rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 rounded-full bg-orange/10 items-center justify-center flex-shrink-0">
              <MessageCircle size={22} className="text-orange" />
            </div>
            <div className="flex-1">
              <h2 className="font-hanken font-bold text-xl sm:text-2xl text-navy mb-1.5">
                Vous n&apos;avez pas trouvé votre réponse&nbsp;?
              </h2>
              <p className="font-hanken text-sm text-navy/70 mb-4">
                Signalez un bug, suggérez une amélioration ou posez une question. Une réponse personnelle vous sera envoyée par email.
              </p>
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="bg-orange hover:bg-orange-hover text-cream font-semibold rounded-lg py-2.5 px-5 transition inline-flex items-center gap-2 text-sm"
              >
                <MessageCircle size={16} />
                Envoyer un message
              </button>
            </div>
          </div>
        </section>

        {/* ============ BARRE DE RECHERCHE + AUTOCOMPLÉTION ============ */}
        <div className="mb-6 relative" ref={searchWrapRef}>
          <label htmlFor="aide-search" className="sr-only">
            Rechercher dans l&apos;aide
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="aide-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
                setActiveSuggestion(-1)
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Rechercher une réponse (ex. RCS, acompte, planning…)"
              aria-label="Rechercher dans l'aide"
              role="combobox"
              aria-expanded={dropdownVisible}
              aria-controls="aide-search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestion >= 0 && suggestions[activeSuggestion]
                  ? `aide-suggestion-${suggestions[activeSuggestion].id}`
                  : undefined
              }
              autoComplete="off"
              className="w-full py-3 pl-10 pr-4 rounded-xl border-[1.5px] border-gray-200 bg-[#fafbfc]
                         font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]
                         placeholder:text-gray-400
                         focus:outline-none focus:border-[#ff7a1a] focus:bg-white
                         focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]
                         transition-all duration-200"
            />
          </div>

          {dropdownVisible && (
            <ul
              id="aide-search-suggestions"
              role="listbox"
              aria-label="Suggestions de fiches d'aide"
              className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30 max-h-[360px] overflow-y-auto"
            >
              {suggestions.map((s, i) => {
                const Icon = s.icon
                const isActive = i === activeSuggestion
                return (
                  <li key={s.id} role="option" id={`aide-suggestion-${s.id}`} aria-selected={isActive}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      onClick={() => goToSection(s.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-orange-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-hanken font-semibold text-[13.5px] text-navy truncate">
                          {s.title}
                        </span>
                        {sectionGroupMap[s.id] && (
                          <span className="block font-hanken text-[11px] text-gray-400 truncate">
                            {sectionGroupMap[s.id]}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ============ ÉTAT VIDE (aucun résultat) ============ */}
        {!hasResults && (
          <div className="p-8 rounded-2xl border border-gray-200 bg-white text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <SearchX size={22} className="text-gray-400" aria-hidden="true" />
            </div>
            <p className="font-hanken font-bold text-[15px] mb-1" style={{color: '#0f1a3a'}}>
              Aucune réponse trouvée pour «&nbsp;{query.trim()}&nbsp;»
            </p>
            <p className="font-hanken text-sm text-gray-500 mb-4">
              Essayez l&apos;un de ces sujets courants, ou écrivez-nous directement.
            </p>
            {/* Suggestions populaires : on ne laisse jamais l'utilisateur sur un cul-de-sac. */}
            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {['acompte', 'signature', 'décennale', 'planning', 'facture'].map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setQuery(sugg)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full border border-gray-200 bg-[#fafbfc] hover:border-[#ff7a1a] hover:bg-orange/5 font-hanken text-sm font-medium text-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] focus-visible:ring-offset-2"
                >
                  {sugg}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="bg-orange hover:bg-orange-hover text-cream font-semibold rounded-lg py-2.5 px-5 transition inline-flex items-center gap-2 text-sm"
            >
              <MessageCircle size={16} />
              Nous écrire
            </button>
          </div>
        )}

        {/* ============ ACCORDIONS GROUPÉS ============ */}
        <div className="space-y-3">
          {visibleSections.map(({ section, displayGroupHeading }) => {
            const Icon = section.icon
            const isOpen = openId === section.id

            return (
              <div key={section.id} id={`section-${section.id}`}>
                {/* Titre de groupe au-dessus du premier item visible de chaque groupe */}
                {displayGroupHeading && (
                  <h3
                    className="font-hanken font-semibold text-[11px] uppercase tracking-[0.12em] text-gray-500 mt-7 mb-3 first:mt-0 pl-1"
                    style={{letterSpacing: '0.12em'}}
                  >
                    {displayGroupHeading}
                  </h3>
                )}

                <div
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
                      <Icon size={20} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-hanken font-bold text-[16px] sm:text-[17px] leading-tight" style={{color: '#0f1a3a'}}>
                        {section.title}
                      </h2>
                      <p className="font-hanken text-[13px] text-gray-500 mt-1 hidden sm:block">
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
                      <div className="font-hanken text-[14px] leading-[1.65]" style={{color: '#374151'}}>
                        {section.content}
                      </div>

                      {/* Bouton de relance du tutoriel guidé */}
                      {section.replayStep && section.replayHref && (
                        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleReplay(section.replayStep!, section.replayHref!)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-hanken font-bold text-sm text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{background: '#e87a2a'}}
                          >
                            <PlayCircle size={17} />
                            Rejouer cette visite guidée
                          </button>
                          <p className="text-xs font-hanken text-gray-500">
                            Tu seras redirigé vers la bonne page, et le tutoriel se relancera automatiquement.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ============ FOOTER : CONTACT ============ */}
        <div className="mt-10 p-6 rounded-2xl border border-gray-200 bg-white text-center">
          <p className="font-hanken font-bold text-[15px] mb-2" style={{color: '#0f1a3a'}}>
            Tu ne trouves pas ce que tu cherches ?
          </p>
          <p className="font-hanken text-sm text-gray-600 mb-3">
            Écris-nous directement, on te répond généralement sous 24h.
          </p>
          <a
            href="mailto:contact.nexartis@gmail.com"
            className="inline-flex items-center gap-2 font-hanken font-bold text-sm text-[#ff7a1a] hover:text-[#0f1a3a] transition-colors"
          >
            contact.nexartis@gmail.com
          </a>
        </div>

        {/* Spacer bottom (mobile) */}
        <div className="h-10" />
      </div>

      {/* Modal de contact (bug / suggestion / question) */}
      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  )
}
