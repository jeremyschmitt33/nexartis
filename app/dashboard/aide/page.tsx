'use client'

/**
 * Page Aide & Tutoriels — centre d'aide intégré.
 *
 * 16 accordéons couvrant chaque onglet de la sidebar, regroupés
 * visuellement en 5 groupes via le champ optionnel `groupHeading`
 * (posé sur le premier item de chaque groupe).
 *
 * Les sections "profil-entreprise" et "devis" ont un bouton
 * "Rejouer cette visite guidée" qui réinitialise l'étape
 * d'onboarding correspondante puis redirige vers la page d'origine.
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
  Clock,
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
  // Titre de groupe affiché AU-DESSUS de cet accordéon (uniquement
  // pour le premier item de chaque groupe visuel).
  groupHeading?: string
  // Contenu structuré en blocs (paragraphes + listes)
  content: React.ReactNode
}

export default function AidePage() {
  const [openId, setOpenId] = useState<string | null>('profil-entreprise')
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
    // ============================================================
    // GROUPE 1 — DÉMARRER
    // ============================================================
    {
      id: 'profil-entreprise',
      icon: Building2,
      title: 'Profil entreprise — Compléter ses infos pour des PDFs pro',
      subtitle: 'La toute première chose à faire pour avoir des devis et factures conformes',
      replayStep: 'dashboard',
      replayHref: '/dashboard',
      groupHeading: 'Démarrer',
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

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Statut auto-entrepreneur
          </h4>
          <p className="mb-3">
            Si tu coches <strong>franchise de TVA</strong> (ou que ta forme juridique est micro / EI / auto),
            Nexartis bascule en mode auto-entrepreneur : la mention
            <em> « TVA non applicable, art. 293 B du CGI » </em>
            apparaît automatiquement sur tes devis et factures, et les mentions société
            (RCS, RM, capital) sont masquées.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-5">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>À noter :</strong> tant que les champs obligatoires ne sont pas remplis,
              Nexartis affiche un bandeau d&apos;alerte sur le tableau de bord et un bandeau
              orange sur la liste des devis. Tes documents <strong>ne seront pas pleinement
              conformes à la loi</strong> tant que ton profil est incomplet.
            </p>
          </div>
        </>
      ),
    },

    // ============================================================
    // GROUPE 2 — TES OUTILS MÉTIER
    // ============================================================
    {
      id: 'devis',
      icon: FileText,
      title: 'Devis — Le point de départ de chaque chantier',
      subtitle: 'Autocomplete client, bibliothèque de prestations, acompte, statuts',
      replayStep: 'devis',
      replayHref: '/dashboard/devis/nouveau',
      groupHeading: 'Tes outils métier',
      content: (
        <>
          <p className="mb-4">
            Le devis est le point de départ de tout dans Nexartis. Tout ce que tu y saisis
            (client, prestations, conditions) est <strong>réutilisable</strong>, et le devis accepté
            se transforme automatiquement en chantier puis en facture, sans recopier.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            L&apos;autocomplete client
          </h4>
          <p className="mb-3">
            Quand tu commences à taper le nom d&apos;un client, Nexartis cherche dans ta base
            et te propose les correspondances. Choisis-en un, et toutes les coordonnées
            (adresse, code postal, ville, téléphone, email) se remplissent toutes seules.
            Plus de double saisie.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            La bibliothèque de prestations
          </h4>
          <p className="mb-3">
            Chaque ligne que tu ajoutes à un devis (désignation, prix unitaire, unité) est
            sauvegardée dans ta bibliothèque. Tu la retrouves dans la sidebar via
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
            Les statuts du devis
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" /><span><strong>Brouillon</strong> — Pas encore envoyé au client</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" /><span><strong>Envoyé</strong> — Envoyé par email au client</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" /><span><strong>Accepté</strong> — Le client a signé en ligne via le lien unique. Nexartis te propose de créer le chantier</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /><span><strong>Refusé</strong> — Le client a refusé. Tu peux renégocier en duplicant le devis</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" /><span><strong>Expiré</strong> — Passé la date de validité sans réponse. À relancer ou archiver</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" /><span><strong>Facturé</strong> — Une facture a déjà été générée à partir de ce devis</span></li>
          </ul>
        </>
      ),
    },
    {
      id: 'factures',
      icon: Receipt,
      title: 'Factures — Reprendre un devis accepté en un clic',
      subtitle: 'Génération depuis le devis, acompte déduit, factures de situation',
      content: (
        <>
          <p className="mb-4">
            Une facture dans Nexartis n&apos;est <strong>presque jamais saisie à la main</strong>.
            Quand un devis est accepté, un bouton &laquo;&nbsp;Générer la facture&nbsp;&raquo;
            reprend toutes les lignes, le client, l&apos;acompte et les conditions. Tu peux
            ajuster avant d&apos;envoyer.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce qui est repris automatiquement
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Le client et toutes ses coordonnées</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Toutes les lignes de prestations du devis (avec sections)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>L&apos;acompte déjà versé, déduit automatiquement du total à payer</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Tes mentions légales (SIRET, assurance décennale, IBAN…)</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Auto-entrepreneur : mention TVA automatique
          </h4>
          <p className="mb-3">
            Si tu es en franchise de TVA, la mention
            <em> « TVA non applicable, art. 293 B du CGI » </em>
            est ajoutée toute seule sur la facture. Aucun calcul de TVA n&apos;apparaît, le total HT = total TTC.
            Tu n&apos;as rien à configurer à chaque fois.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Factures de situation (gros chantiers)
          </h4>
          <p className="mb-3">
            Pour un chantier qui dure plusieurs mois, tu peux émettre plusieurs factures
            intermédiaires (factures de situation) au fil de l&apos;avancement. Chacune
            mentionne le pourcentage déjà facturé et ce qu&apos;il reste à facturer.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les statuts de la facture
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" /><span><strong>Brouillon</strong> — Préparée mais pas envoyée</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" /><span><strong>Envoyée</strong> — Transmise au client par email</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" /><span><strong>Payée</strong> — Marquée comme encaissée, comptée dans ton CA</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /><span><strong>En retard</strong> — Date d&apos;échéance dépassée sans paiement</span></li>
          </ul>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Astuce :</strong> les factures en retard remontent automatiquement
              dans la liste &laquo;&nbsp;À faire&nbsp;&raquo; de ton tableau de bord, pour que
              tu n&apos;oublies pas de relancer ton client.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'planning',
      icon: CalendarDays,
      title: 'Planning — Organiser tes interventions sur la semaine',
      subtitle: 'Vue semaine glissante, créneaux personnalisables, alerte conflits',
      content: (
        <>
          <p className="mb-4">
            Le planning te permet de poser tes interventions sur les bons jours, à la bonne
            heure, sur le bon chantier. Il est <strong>lié automatiquement</strong> aux chantiers :
            quand tu crées une intervention, tu choisis un chantier existant, et tout reste connecté.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Mode Solo vs mode Société
          </h4>
          <p className="mb-3">
            Nexartis détecte automatiquement ton mode de travail à partir de ton profil
            entreprise&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Mode Solo</strong> (auto-entrepreneur, EI, micro) : tu ne vois que <em>tes</em> interventions. La colonne &laquo;&nbsp;intervenant&nbsp;&raquo; est masquée puisque c&apos;est toujours toi. Si tu ajoutes des sous-traitants, ils apparaissent à côté de toi.</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Mode Société</strong> : tu vois toute ton équipe (salariés + sous-traitants), groupée par métier. Tu planifies les interventions pour chacun.</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les créneaux disponibles
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><Clock size={15} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Journée entière</strong> (8h-17h) — pour une journée complète sur un chantier</span></li>
            <li className="flex gap-2"><Clock size={15} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Demi-journée matin</strong> (8h-12h)</span></li>
            <li className="flex gap-2"><Clock size={15} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Demi-journée après-midi</strong> (13h-17h)</span></li>
            <li className="flex gap-2"><Clock size={15} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Créneau personnalisé</strong> — tu choisis l&apos;heure de début et de fin</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Détection automatique des conflits
          </h4>
          <p className="mb-3">
            Si tu plannifies deux interventions sur le même intervenant aux mêmes heures,
            Nexartis affiche une <strong>alerte conflit</strong> (icône triangle orange). Tu peux
            filtrer le planning pour ne voir que les conflits et les régler avant d&apos;envoyer
            tes équipes au mauvais endroit.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les statuts d&apos;une intervention
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" /><span><strong>Planifié</strong> — Posé sur le planning, à venir</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" /><span><strong>En cours</strong> — L&apos;équipe est sur place</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" /><span><strong>Terminé</strong> — Intervention finie</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /><span><strong>Annulé</strong> — Le rendez-vous est tombé à l&apos;eau</span></li>
          </ul>
        </>
      ),
    },
    {
      id: 'chantiers',
      icon: HardHat,
      title: 'Chantiers — Tout regrouper en un seul endroit',
      subtitle: 'Devis lié, interventions, équipe, notes, matériel, récap PDF client',
      content: (
        <>
          <p className="mb-4">
            Le chantier est la <strong>fiche centrale</strong> qui regroupe tout ce qui touche
            à un projet&nbsp;: le devis signé, les interventions planifiées, l&apos;équipe assignée,
            les notes, les achats, les documents. À la fin, tu génères un récap PDF pour ton client
            en un clic.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu retrouves sur un chantier
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Devis lié</strong> — accepté ou en cours, avec le montant total</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Interventions planifiées</strong> — toutes les dates posées sur le planning</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Équipe assignée</strong> — qui intervient sur ce chantier (salariés et/ou sous-traitants)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Notes privées</strong> (artisan) — pour toi uniquement, jamais imprimées</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Notes client</strong> — visibles sur le récap remis au client</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Matériel utilisé</strong> et <strong>achats</strong> rattachés au chantier</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Déchets AGEC</strong> — traçabilité des déchets de chantier (obligation légale BTP)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Documents attachés</strong> — tu peux y joindre PDFs et photos (CCTP, plans, photos avant/après…)</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Le récap PDF en fin de chantier
          </h4>
          <p className="mb-3">
            Une fois le chantier terminé, le bouton <strong>Export PDF récap</strong> génère
            un document propre à remettre au client&nbsp;: rappel des prestations, photos avant/après
            si tu les as ajoutées, notes client. C&apos;est ton geste pro qui marque la fin du chantier.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les statuts du chantier
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" /><span><strong>En préparation</strong> — Créé, devis signé, mais pas encore démarré</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" /><span><strong>En cours</strong> — Les interventions sont en route</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" /><span><strong>Terminé / Clôturé</strong> — Tout est fait, facture envoyée</span></li>
            <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" /><span><strong>Archivé</strong> — Sorti de la vue principale, mais consultable à tout moment</span></li>
          </ul>
        </>
      ),
    },
    {
      id: 'achats',
      icon: ShoppingBag,
      title: 'Achats — Suivre les dépenses pour calculer la vraie marge',
      subtitle: 'Factures fournisseurs, lien au chantier, justificatif PDF',
      content: (
        <>
          <p className="mb-4">
            L&apos;onglet Achats te permet d&apos;enregistrer chaque dépense&nbsp;: matériaux,
            outillage, location, déchèterie… Tu sais en permanence combien tu as dépensé sur
            un chantier, et donc <strong>ce qu&apos;il te reste vraiment dans la poche</strong>.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu enregistres pour chaque achat
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Fournisseur</strong> (sélectionné depuis ta liste de fournisseurs)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Date</strong> et <strong>montant</strong> (HT, TVA, TTC)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Description</strong> rapide (ex&nbsp;: «&nbsp;Câbles + tableau électrique&nbsp;»)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Chantier associé</strong> (optionnel) — pour suivre le coût par chantier</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Justificatif PDF</strong> (la facture du fournisseur) attachable directement</span></li>
          </ul>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Le bénéfice :</strong> en rattachant chaque achat à un chantier, Nexartis
              peut calculer ta <strong>marge réelle</strong> (devis facturé moins achats matériaux).
              Tu sais quels chantiers te rapportent vraiment, et lesquels t&apos;ont fait perdre du temps.
            </p>
          </div>
        </>
      ),
    },

    // ============================================================
    // GROUPE 3 — TES DONNÉES RÉUTILISABLES
    // ============================================================
    {
      id: 'clients',
      icon: Users,
      title: 'Clients — Ta base centrale, réutilisable partout',
      subtitle: 'Particuliers ou professionnels, historique complet par client',
      groupHeading: 'Tes données réutilisables',
      content: (
        <>
          <p className="mb-4">
            Chaque client que tu enregistres devient <strong>réutilisable</strong> dans tous tes
            devis et factures via l&apos;autocomplete. Tu le saisis une seule fois, et tu le
            retrouves instantanément ensuite.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Deux types de clients
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Particulier</strong> — nom, prénom, adresse, email, téléphone</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Professionnel (B2B)</strong> — raison sociale, SIRET, contact, mêmes coordonnées</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Filtres et recherche
          </h4>
          <p className="mb-3">
            La page propose des filtres rapides&nbsp;: <strong>Tous</strong>, <strong>Particuliers</strong>,
            <strong> Professionnels</strong>, <strong>Archivés</strong>. La recherche par nom est instantanée.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Historique complet
          </h4>
          <p className="mb-3">
            En cliquant sur un client, tu retrouves <strong>tous ses devis et toutes ses factures</strong>
            au même endroit. Pratique pour relancer, renvoyer un duplicata, ou suivre un client fidèle.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>Notes internes :</strong> tu peux écrire des notes privées sur un client
              (préférences, anecdotes, alertes)&nbsp;: elles ne sont jamais imprimées sur un devis
              ou une facture, c&apos;est ta mémoire privée.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'fournisseurs',
      icon: Warehouse,
      title: 'Fournisseurs — Tes partenaires matériaux et déchèteries',
      subtitle: 'Pré-remplissage des achats, traçabilité déchets AGEC',
      content: (
        <>
          <p className="mb-4">
            La liste de tes fournisseurs habituels&nbsp;: négoces, déchèteries, loueurs de matériel.
            Une fois enregistré, un fournisseur est <strong>pré-rempli en un clic</strong> quand tu
            ajoutes un achat ou que tu déclares des déchets de chantier.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu enregistres
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Nom du fournisseur et personne de contact</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Adresse, code postal, ville</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Téléphone, email, SIRET</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Notes (horaires d&apos;ouverture, conditions de paiement, contact préféré…)</span></li>
          </ul>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Pour les déchets AGEC :</strong> les déchèteries que tu as enregistrées comme
              fournisseurs apparaissent automatiquement dans la liste de sélection quand tu déclares
              les déchets sortis d&apos;un chantier (obligation légale BTP).
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'equipe',
      icon: UserRound,
      title: 'Mon équipe — Salariés et sous-traitants',
      subtitle: 'Mode Solo automatique ou gestion multi-intervenants',
      content: (
        <>
          <p className="mb-4">
            L&apos;onglet Équipe te permet de gérer qui intervient pour ton entreprise. Le
            fonctionnement s&apos;adapte à ton profil&nbsp;:
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Mode Solo (auto-entrepreneur, EI, micro)
          </h4>
          <p className="mb-3">
            Nexartis détecte que tu travailles seul et te crée automatiquement en tant
            qu&apos;intervenant unique. Tu n&apos;as <strong>rien à ajouter</strong> pour commencer
            à utiliser le planning&nbsp;: le système sait que c&apos;est toi.
          </p>
          <p className="mb-3">
            Si tu fais ponctuellement appel à un <strong>sous-traitant</strong>, tu peux l&apos;ajouter
            ici&nbsp;: une colonne s&apos;affichera à côté de la tienne dans le planning.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Mode Société (SARL, EURL, SAS…)
          </h4>
          <p className="mb-3">
            Tu peux ajouter autant d&apos;intervenants que tu veux. Chacun a un <strong>type de contrat</strong>&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>CDI / CDD / Apprenti</strong> — salariés rattachés à ton entreprise</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Intérimaire</strong> — mission temporaire</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Sous-traitant</strong> — entité externe (autre entreprise), avec suivi des paiements ST séparé</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Métier et couleur
          </h4>
          <p className="mb-3">
            Chaque intervenant a un <strong>métier</strong> (électricien, plombier, maçon…)&nbsp;:
            cela sert à regrouper visuellement les intervenants dans le planning (toute la ligne
            des électriciens ensemble, etc.). La couleur de l&apos;avatar te permet de repérer
            l&apos;intervenant d&apos;un coup d&apos;œil.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Historique par intervenant
          </h4>
          <p className="mb-3">
            En cliquant sur un intervenant, tu vois <strong>tous les chantiers</strong> sur lesquels
            il a travaillé. Pour les sous-traitants, tu vois aussi l&apos;historique des paiements
            effectués (montant payé, statut).
          </p>
        </>
      ),
    },
    {
      id: 'materiel',
      icon: Wrench,
      title: 'Matériel — Ton inventaire pro suivi à la trace',
      subtitle: 'Outillage, échafaudage, véhicule, EPI — état, crédit, assurance',
      content: (
        <>
          <p className="mb-4">
            L&apos;onglet Matériel est ton inventaire professionnel&nbsp;: outillage électroportatif,
            échafaudage, véhicule, EPI… Tu sais ce que tu as, dans quel état, et combien ça te coûte
            réellement.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Catégories disponibles
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Électroportatif</strong> (perceuse, visseuse, scie…)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Échafaudage</strong></span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Véhicule</strong> (camionnette, fourgon…)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>EPI</strong> (équipements de protection individuelle)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Gros outillage</strong> et <strong>Autre</strong></span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Mode d&apos;acquisition + suivi financier
          </h4>
          <p className="mb-3">
            Pour chaque matériel, tu indiques comment tu l&apos;as financé&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Comptant</strong> — payé d&apos;un coup</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Crédit</strong> — Nexartis enregistre la mensualité, la durée, la banque, la date de fin</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Leasing / LLD</strong> — loyer mensuel</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Assurance, entretien, amortissement
          </h4>
          <p className="mb-3">
            Tu peux suivre l&apos;<strong>assurance</strong> (mensualité, compagnie, n° de police,
            échéance), la <strong>prochaine révision</strong>, le <strong>budget d&apos;entretien
            annuel</strong>, et la <strong>durée d&apos;amortissement</strong>. Quatre états sont
            possibles&nbsp;: Neuf / Bon / Usé / HS.
          </p>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Pourquoi c&apos;est utile :</strong> en gros chantier ou pour ta compta, tu peux
              justifier précisément ce que ton matériel te coûte, et arrêter d&apos;oublier les
              révisions et les renouvellements d&apos;assurance.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'prestations',
      icon: Library,
      title: 'Prestations — Ta bibliothèque réutilisable en un clic',
      subtitle: 'Toutes tes lignes de devis sauvegardées, prêtes à resservir',
      content: (
        <>
          <p className="mb-4">
            La bibliothèque de prestations est ton catalogue personnel. Chaque ligne ajoutée à
            un devis y est <strong>sauvegardée automatiquement</strong>. Et tu peux aussi créer
            tes prestations en avance directement depuis cet onglet.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce qu&apos;une prestation contient
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Désignation</strong> (ex&nbsp;: «&nbsp;Installation tableau électrique 13 modules&nbsp;»)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Unité</strong> (forfait, heure, m², ml, jour…)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Prix unitaire HT</strong> et <strong>taux de TVA</strong></span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Catégorie</strong> (Électricité, Plomberie, Maçonnerie…) pour t&apos;y retrouver</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Suggestions par métier
          </h4>
          <p className="mb-3">
            Nexartis te propose des <strong>suggestions de prestations</strong> selon ton métier
            (électricité, plomberie, maçonnerie, peinture, menuiserie, général). Tu peux en importer
            plusieurs d&apos;un coup pour démarrer ta bibliothèque sans tout retaper.
          </p>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>Astuce :</strong> dans un devis, tu peux ajouter une prestation de ta bibliothèque
              en quelques clics. Plus tu enrichis ta bibliothèque, plus tes prochains devis se
              construisent vite.
            </p>
          </div>
        </>
      ),
    },

    // ============================================================
    // GROUPE 4 — VUE D'ENSEMBLE
    // ============================================================
    {
      id: 'accueil',
      icon: Home,
      title: 'Accueil — Ton tableau de bord du jour',
      subtitle: 'CA, conversion, à faire, planning de la semaine',
      groupHeading: 'Vue d\'ensemble',
      content: (
        <>
          <p className="mb-4">
            L&apos;accueil est la première page que tu vois en te connectant. Il te montre
            <strong> l&apos;essentiel en un coup d&apos;œil</strong>&nbsp;: où tu en es, ce que tu dois
            faire aujourd&apos;hui, comment se porte ton activité.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Les chiffres clés
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>CA facturé</strong> — total des factures envoyées (en attente de paiement compris)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>CA encaissé</strong> — total réellement reçu sur ton compte (factures payées)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Taux de conversion</strong> — pourcentage de devis acceptés sur l&apos;ensemble envoyé</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            La liste «&nbsp;À faire&nbsp;»
          </h4>
          <p className="mb-3">
            Nexartis te liste automatiquement ce qui mérite ton attention&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /><span>Devis envoyés sans réponse depuis plusieurs jours (à relancer)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /><span>Factures en retard de paiement</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /><span>Conflits horaires détectés dans le planning</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /><span>Rappels privés que tu t&apos;es notés</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Planning de la semaine + activité récente
          </h4>
          <p className="mb-3">
            En bas du tableau de bord, tu retrouves un aperçu du planning de la semaine en cours
            et un fil d&apos;activité récente (dernier devis créé, dernière facture payée, etc.).
          </p>
        </>
      ),
    },
    {
      id: 'statistiques',
      icon: TrendingUp,
      title: 'Statistiques — Comprendre ton activité',
      subtitle: 'CA mensuel, conversion, comparaison annuelle',
      content: (
        <>
          <p className="mb-4">
            L&apos;onglet Statistiques te donne une vision <strong>plus large</strong> de ton activité&nbsp;:
            ton chiffre d&apos;affaires sur l&apos;année, ta conversion devis → accepté, ton évolution
            mois après mois.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu vois
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Graphique CA sur 12 mois</strong> avec deux séries&nbsp;: facturé vs encaissé</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Reste à encaisser</strong> — somme des factures envoyées mais pas encore payées</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Taux de conversion</strong> des devis</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span><strong>Valeur moyenne</strong> d&apos;un devis et d&apos;un chantier</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" /><span>Possibilité de <strong>changer d&apos;année</strong> pour comparer N vs N-1</span></li>
          </ul>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>À retenir :</strong> ces stats se mettent à jour <strong>en temps réel</strong>,
              dès qu&apos;une facture passe en «&nbsp;payée&nbsp;» ou qu&apos;un devis est accepté.
              Aucune saisie double pour avoir ton suivi à jour.
            </p>
          </div>
        </>
      ),
    },

    // ============================================================
    // GROUPE 5 — OUTILS ADMIN
    // ============================================================
    {
      id: 'importer',
      icon: ArrowDownToLine,
      title: 'Importer — Récupérer tes données existantes',
      subtitle: 'Depuis Obat, Tolteck, Batappli, Henrri ou un Excel',
      groupHeading: 'Outils & administration',
      content: (
        <>
          <p className="mb-4">
            Si tu viens d&apos;un autre logiciel ou que tu tiens encore tes clients dans un Excel,
            l&apos;onglet Importer te permet de <strong>tout récupérer d&apos;un coup</strong>, sans
            ressaisir une ligne.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Sources prises en charge
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Obat</strong>, <strong>Tolteck</strong>, <strong>Batappli</strong>, <strong>Henrri</strong> — exports natifs reconnus</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Excel / CSV générique</strong> — pour tout autre fichier</span></li>
          </ul>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu peux importer
          </h4>
          <p className="mb-3">
            Selon ton fichier source, Nexartis détecte automatiquement les catégories disponibles&nbsp;:
            clients, devis, factures, chantiers, prestations, fournisseurs, intervenants, planning,
            paiements, achats.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Gestion des doublons
          </h4>
          <p className="mb-3">
            Avant d&apos;importer, tu choisis comment Nexartis doit traiter les doublons&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Ignorer</strong> les doublons (garder la version existante)</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Écraser</strong> la version existante avec la nouvelle</span></li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-sky-600 flex-shrink-0 mt-0.5" /><span><strong>Créer en double</strong> (garder les deux)</span></li>
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>Conseil :</strong> commence toujours par un <strong>aperçu</strong>
              (Nexartis te montre ce qu&apos;il a lu sans rien importer). Tu valides ensuite ligne
              par ligne avant la bascule définitive.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'corbeille',
      icon: Trash2,
      title: 'Corbeille — 7 jours pour changer d\'avis',
      subtitle: 'Devis et factures supprimés restent récupérables une semaine',
      content: (
        <>
          <p className="mb-4">
            Quand tu supprimes un devis ou une facture, il ne disparaît pas tout de suite&nbsp;:
            il atterrit dans la <strong>corbeille</strong> où il reste <strong>7 jours</strong>.
            Le temps de réaliser que tu en avais besoin et de le restaurer en un clic.
          </p>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Ce que tu peux y faire
          </h4>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Restaurer</strong> un devis ou une facture — il revient à sa place comme s&apos;il n&apos;avait jamais été supprimé</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Supprimer définitivement</strong> un élément avant la fin des 7 jours</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Vider la corbeille</strong> en un clic si tu es sûr de ne plus en avoir besoin</span></li>
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>Au-delà de 7 jours :</strong> la suppression est <strong>définitive et
              irréversible</strong>. Plus aucune trace. Si tu hésites, restaure plutôt que de
              prendre le risque.
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'abonnement',
      icon: CreditCard,
      title: 'Abonnement — Essai gratuit et paiement sécurisé',
      subtitle: '14 jours d\'essai sans CB, puis 30 €/mois via Stripe, résiliation libre',
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
            Tu peux souscrire un abonnement mensuel à <strong>30&nbsp;€&nbsp;TTC/mois</strong> via
            <strong> Stripe</strong> (paiement sécurisé, sans engagement). Le bouton
            &laquo;&nbsp;Souscrire&nbsp;&raquo; est dans cet onglet.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-amber-900">
              <strong>Si tu ne souscris pas :</strong> tes données sont <strong>conservées en sécurité</strong>
              (jamais supprimées). Tu passes en mode <strong>lecture seule</strong>&nbsp;:
              tu peux consulter et exporter, mais plus créer ni modifier tant que l&apos;abonnement
              n&apos;est pas activé.
            </p>
          </div>

          <h4 className="font-syne font-bold text-[15px] text-navy mt-5 mb-2">
            Gérer ton abonnement
          </h4>
          <p className="mb-2">
            Depuis cet onglet, tu peux à tout moment&nbsp;:
          </p>
          <ul className="space-y-1.5 mb-4 pl-1">
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Voir ton statut actuel (essai, actif, suspendu, accès à vie)</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span>Consulter ton historique de paiements</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Mettre à jour ta carte bancaire</strong> via le portail Stripe</span></li>
            <li className="flex gap-2"><span className="text-orange-600 font-bold flex-shrink-0">→</span><span><strong>Résilier l&apos;abonnement</strong> en un clic depuis le portail Stripe (sans frais, l&apos;accès reste actif jusqu&apos;à la fin du mois payé, puis tu bascules en lecture seule)</span></li>
          </ul>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mt-3">
            <p className="text-[13px] font-manrope text-sky-900">
              <strong>À retenir :</strong> aucun engagement, aucune pénalité, aucune justification à
              donner. Tes données restent intactes même après résiliation — tu peux revenir 6 mois
              plus tard et reprendre exactement où tu en étais.
            </p>
          </div>
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

        {/* ============ ACCORDIONS GROUPÉS ============ */}
        <div className="space-y-3">
          {sections.map((section) => {
            const Icon = section.icon
            const isOpen = openId === section.id

            return (
              <div key={section.id}>
                {/* Titre de groupe au-dessus du premier item de chaque groupe */}
                {section.groupHeading && (
                  <h3
                    className="font-syne font-bold text-[11px] uppercase tracking-[0.12em] text-gray-500 mt-7 mb-3 first:mt-0 pl-1"
                    style={{letterSpacing: '0.12em'}}
                  >
                    {section.groupHeading}
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
