import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis plombier — Nexartis dès 15€/mois",
  description:
    "Devis et factures plomberie en 2 minutes. TVA 5,5/10/20% automatique, mention décennale. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-plombier",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Plombier",
  nomPluriel: "Plombiers",
  icon: "🔧",
  h1: "Logiciel devis et factures pour plombiers",
  metaTitle: "Logiciel devis plombier — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures plomberie en 2 minutes. TVA 5,5/10/20% automatique, mention décennale. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis plombier",

  tvaNotes:
    "TVA 5,5% rénovation énergétique, 10% amélioration habitat >2 ans, 20% neuf",

  specificite:
    "Nexartis gère automatiquement les 3 taux de TVA plomberie, la mention décennale obligatoire, et permet de créer un devis depuis le chantier en moins de 2 minutes — y compris en astreinte la nuit.",

  motsClesSecondaires: [
    "logiciel facture plomberie",
    "application devis plombier",
    "logiciel plombier auto-entrepreneur",
    "logiciel chiffrage plomberie",
    "logiciel gestion plombier",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis plombier** en 2026 n'a rien d'un détail. Trois taux de **TVA** cohabitent en plomberie : **5,5%** pour la rénovation énergétique, **10%** pour l'amélioration de l'habitat, **20%** pour le neuf. À cela s'ajoute la mention **décennale** obligatoire sur tout devis et toute facture, la fin de l'attestation TVA papier au **16 février 2025**, et l'arrivée de **Factur-X** qui imposera la facture électronique normalisée à toutes les entreprises. L'outil que vous utilisez doit donc suivre la réglementation à la lettre. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr, dans le métier, une part importante des plombiers exercent en TPE ou en solo, souvent sous statut **auto-entrepreneur** (source CAPEB). Beaucoup interviennent en astreinte, le dimanche à 22h, sur une fuite qui inonde une cuisine. La dernière chose dont vous avez envie, en remontant dans le camion, c'est de devoir taper un devis sur un ordinateur en rentrant. Le **dépannage** se joue sur le terrain, sur le téléphone, dans l'instant — pas le lendemain au bureau. C'est cette réalité-là qu'un **logiciel devis plombier** doit comprendre, pas la théorie des process des grosses PME que visent [Sage Batigest pour PME](/blog/batigest-avis).\n\n**Nexartis** a été conçu pour cette réalité d'artisan : un logiciel français pensé par et pour les artisans, qui édite un devis conforme depuis votre téléphone, applique le bon taux de TVA en deux clics, injecte automatiquement votre numéro de **décennale**, et prépare vos factures au format **Factur-X** sans que vous ayez à comprendre ce que cela signifie. Vous comparez avec [notre comparatif Tolteck](/blog/tolteck-avis) ou [notre avis Obat](/blog/obat-avis) ? Sachez que **Nexartis** démarre à **15€ HT/mois** pour Essentiel et **25€ HT/mois** pour Complet (planning, vocal, équipe). Voir [nos tarifs détaillés](/tarifs). Vous êtes aussi chauffagiste ? [Notre logiciel chauffagiste](/logiciel-devis-chauffagiste) couvre les deux métiers dans le même compte.",

  // ─── B — Cas d'usage narratif (80-120 mots) ────────────────────────────
  casUsage: {
    titre: "Vendredi 15h, chauffe-eau en panne chez un client",
    scene:
      "La cliente a découvert ce matin que l'eau chaude ne montait plus. Vous arrivez, vous diagnostiquez en cinq minutes : la résistance est morte, le ballon a douze ans, autant le remplacer. Pendant que vous mesurez l'angle disponible, vous **dictez vocalement** sur votre téléphone pour ne rien oublier : dépose de l'ancien 200 litres, fourniture et pose d'un chauffe-eau 200L, raccordements eau et électrique, mise en service. Vous relisez le brouillon en deux minutes, vous précisez la marque et le tarif horaire, c'est prêt. La cliente **signe sur son écran** avant que vous ayez rangé l'outillage. Vous commandez le matériel, et **mardi** vous repassez pour la pose. La **facture** part dans la foulée, déjà acceptée.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En plomberie, vous jonglez avec trois taux de TVA selon le type de chantier. La TVA à **5,5%** s'applique aux travaux de rénovation énergétique : pose de pompe à chaleur eau/eau, installation de chaudière biomasse, isolation des circuits d'eau chaude sanitaire. Deux conditions doivent être réunies : être certifié **RGE QualiPAC** ou RGE QualiBois selon l'équipement posé, et intervenir dans un logement de plus de 2 ans. La TVA à **10%** couvre tous les travaux d'amélioration, de transformation, d'aménagement et d'entretien dans un logement de plus de 2 ans : remplacement d'un chauffe-eau électrique classique, pose d'une douche italienne, débouchage d'une canalisation, mise aux normes d'une installation existante, remplacement de robinetterie. La TVA à **20%** reste obligatoire sur le neuf, les extensions, les piscines, et certaines fournitures vendues seules sans pose. Détails officiels sur [service-public.fr](https://entreprendre.service-public.gouv.fr/vosdroits/F23568).\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour le taux intermédiaire et le taux réduit) a été officiellement **supprimée**. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans **Nexartis**, vous cochez la case correspondante au moment de créer le **logiciel devis plombier** : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Côté **Factur-X**, le format européen EN 16931 est activé par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures partent déjà conformes à la réforme française dont le calendrier (réception **1er septembre 2026**, émission **1er septembre 2027** pour les TPE) est détaillé sur [economie.gouv.fr](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises). Voir aussi [nos tarifs détaillés](/tarifs).",

  tableauTva: [
    {
      type: "Installation chauffe-eau électrique classique",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Pose pompe à chaleur eau/eau",
      taux: "5,5%",
      conditions: "RGE QualiPAC + logement >2 ans",
    },
    {
      type: "Réparation fuite, débouchage canalisation",
      taux: "10%",
      conditions: "Travaux d'amélioration habitat",
    },
    {
      type: "Construction neuve, extension, piscine",
      taux: "20%",
      conditions: "Travaux neufs",
    },
    {
      type: "Isolation circuit eau chaude sanitaire",
      taux: "5,5%",
      conditions: "Logement >2 ans",
    },
  ],

  reglementation2026: [
    "**Factur-X** obligatoire en réception le **1er septembre 2026** (toutes entreprises)",
    "**Factur-X** obligatoire en émission le **1er septembre 2027** pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le **16 février 2025** — remplacée par une mention sur le devis",
    "Mention **décennale** obligatoire sur tout devis et facture (loi Spinetta) : nom de l'assureur, n° de contrat, zone géographique",
    "Auto-entrepreneur plombier : seuils TVA **37 500€** pour les services, **85 000€** pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au **31 décembre 2027** pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Préciser **la marque ET le modèle** du matériel installé (ex : « Chauffe-eau Atlantic Calypso 200L référence 154516 »)",
    "Mentionner la **garantie de bon fonctionnement**, en plus de la décennale : 1 an pour la main d'œuvre, 1 à 2 ans pour le matériel selon le fabricant",
    "Détailler la main d'œuvre en **heures et tarif horaire HT**, séparément du déplacement",
    "Préciser explicitement si **l'enlèvement des anciens équipements** est inclus, et si oui, à quel coût",
    "Indiquer les conditions de paiement : **acompte à la signature** (souvent 30%), échéance facture (30 jours par défaut), taux de pénalités de retard",
    "Sur un dépannage d'urgence, joindre une **photo du devis chiffré** sur place et envoyer le double par email avant de partir",
    "Pour une pompe à chaleur ou un équipement éligible aux aides, indiquer le modèle exact, le **COP (coefficient de performance)**, et joindre l'attestation RGE en pièce jointe",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 5111",
    "Qualibat 5112",
    "PG (Professionnel Gaz)",
    "RGE QualiPAC",
    "RGE QualiBois",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Installation chauffe-eau thermodynamique 200L",
    "Remplacement chaudière gaz à condensation",
    "Pose douche à l'italienne complète",
    "Débouchage canalisation haute pression",
    "Réparation fuite d'urgence en astreinte",
    "Pose adoucisseur d'eau résine",
    "Installation pompe à chaleur air/eau monobloc",
    "Rénovation complète salle de bains",
    "Mise en conformité PMR (douche à seuil zéro)",
    "Dépannage robinetterie thermostatique",
  ],

  // ─── H — FAQ étoffée (8 Q&R, ~600 mots cumulés) ───────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un plombier en 2026 ?",
      answer:
        "Le bon **logiciel devis plombier** doit gérer les **trois taux de TVA** (**5,5%**, **10%**, **20%**), injecter automatiquement la mention **décennale**, être compatible **Factur-X** dès l'échéance du **1er septembre 2026**, et permettre de créer un devis depuis le terrain en moins de 2 minutes. Le marché propose plusieurs options : [notre comparatif Tolteck](/blog/tolteck-avis) (19-25€/mois) reste simple et largement adopté, [notre avis Obat](/blog/obat-avis) (25-79€/mois) ajoute la signature électronique et BatiChiffrage, [Henrri reste gratuit](/blog/henrri-avis) mais n'est pas spécifique BTP, et [Sage Batigest pour PME](/blog/batigest-avis) cible plutôt les structures de 10 salariés et plus. **Nexartis** se positionne à **15€ HT/mois** pour Essentiel et **25€ HT/mois** pour Complet, conçu spécifiquement pour les artisans solo et auto-entrepreneurs. Voir [nos tarifs détaillés](/tarifs).",
    },
    {
      question: "Comment gérer les 3 taux TVA en plomberie sans se tromper ?",
      answer:
        "Dans **Nexartis**, chaque ligne de devis dispose d'un menu déroulant pour choisir entre **5,5%**, **10%** et **20%**, avec une info-bulle qui rappelle quel taux s'applique à quel type de travaux. Vous pouvez également pré-configurer vos prestations récurrentes (pose chauffe-eau, débouchage, dépannage) avec leur taux par défaut depuis la bibliothèque de prestations. La case « conditions du taux réduit remplies » ajoute automatiquement la mention obligatoire qui a remplacé l'attestation TVA papier depuis le **16 février 2025**. En cas de chantier mixte (par exemple PAC à **5,5%** + plomberie connexe à **10%**), le logiciel calcule séparément chaque sous-total TVA pour le récapitulatif en pied de devis.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose **Factur-X** en réception au **1er septembre 2026** pour toutes les entreprises, et en émission au **1er septembre 2027** pour les TPE et auto-entrepreneurs. Toutes les factures **Nexartis** sont générées au format **Factur-X** (un PDF lisible avec un fichier XML structuré embarqué), conformes au **standard européen EN 16931**. Vous n'avez aucune manipulation à faire : le format s'applique par défaut dès l'offre Essentiel à **15€ HT/mois**. Plus de détails sur [notre guide logiciel devis factures BTP](/logiciel-devis-factures).",
    },
    {
      question: "Comment facturer rapidement un dépannage d'urgence ?",
      answer:
        "**Nexartis** est une **PWA installable sur iPhone et Android**, sans passer par les stores. Depuis votre téléphone, vous créez la facture chez le client en 1 à 2 minutes : sélection du client (ou création rapide), saisie des prestations avec les **majorations nuit ou week-end** pré-configurées dans votre bibliothèque, validation. La facture part par email avec un **lien de paiement Stripe**. Le client règle en CB depuis son téléphone avant même que vous soyez rentré au camion. Voir les offres et [nos tarifs détaillés](/tarifs).",
    },
    {
      question:
        "Puis-je intégrer ma mention décennale automatiquement sur mes documents ?",
      answer:
        "Oui. Dans **Nexartis**, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), le numéro de contrat **décennale**, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta. Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à **15€ HT/mois**.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes et factures de situation ?",
      answer:
        "Oui. Dans **Nexartis**, vous pouvez exiger un acompte à la signature du devis (le standard en plomberie est de 30%, mais vous fixez le pourcentage). Pour les gros chantiers (rénovation complète de salle de bains, installation d'une PAC), vous facturez ensuite des situations intermédiaires : par exemple 30% à la signature, 40% à la pose, 30% à la mise en service. Le solde est calculé automatiquement à chaque étape, et chaque facture est rattachée au chantier d'origine pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (**37 500€** services, **85 000€** ventes) sont surveillés en continu.",
    },
    {
      question: "Comment créer un devis depuis le chantier ?",
      answer:
        "L'application **Nexartis** est **installable comme une vraie app** sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le **logiciel devis plombier** se crée en quelques tapotements : client (recherche par nom), prestations depuis votre bibliothèque (chauffe-eau, débouchage, déplacement nuit), validation. Le client **signe directement avec le doigt** sur l'écran, et le PDF signé est envoyé par email avec votre numéro de **décennale** automatiquement intégré. L'ensemble fonctionne même avec une **connexion 4G faible** et synchronise automatiquement dès le retour en zone couverte. La **commande vocale** (offre Complet à **25€ HT/mois**) vous permet même de dicter le devis depuis le camion. Voir aussi [notre logiciel chauffagiste](/logiciel-devis-chauffagiste) si vous cumulez les deux activités, ou pour un autre corps de métier, [électricien BTP](/logiciel-devis-electricien).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de prix matériel ?",
      answer:
        "Oui. **Nexartis** intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de **TVA** par défaut, et l'unité de vente (heure, mètre linéaire, pièce). L'offre Essentiel à **15€ HT/mois** vous donne accès à des modèles génériques pré-remplis (pose chauffe-eau, débouchage, dépannage robinetterie) que vous adaptez à votre marge. L'offre Complet à **25€ HT/mois** ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fournisseur, regroupement de prestations en « packs » réutilisables (par exemple : kit pose PAC complet avec **RGE QualiPAC** appliqué automatiquement à **5,5%**). Vous gagnez plusieurs heures par semaine de saisie sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer le SAV et la garantie de bon fonctionnement ?",
      answer:
        "Sur l'offre Complet de **Nexartis** à **25€ HT/mois**, chaque chantier conserve son historique complet : devis signé, factures émises, photos prises sur le terrain, notes datées par intervention. En cas d'appel SAV un an plus tard pour une chaudière qui dysfonctionne, vous retrouvez en deux clics : la date d'installation, la marque et le modèle posé, la date de mise en service (point de départ de la garantie de bon fonctionnement de 1 à 2 ans selon le fabricant), et l'historique des interventions. La mention **décennale** reste tracée sur 10 ans côté assureur. Pour les interventions SAV, vous créez un nouveau devis rattaché au chantier d'origine, et la traçabilité comptable est conservée pour vos archives fiscales (durée légale 5 ans). Voir [tous nos articles](/blog) pour aller plus loin.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : **Nexartis** **ne demande pas de carte bancaire** à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à **15€ HT/mois** (notre plan le plus accessible) ou Complet à **25€ HT/mois** (planning, **commande vocale** et gestion d'équipe inclus). **Aucun engagement**, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Détails sur [nos tarifs détaillés](/tarifs).",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-chauffagiste", label: "Logiciel pour chauffagiste" },
    { href: "/logiciel-devis-couvreur", label: "Logiciel pour couvreur" },
    { href: "/logiciel-devis-electricien", label: "Logiciel pour électricien" },
    { href: "/blog/tolteck-avis", label: "Tolteck : notre avis" },
    { href: "/blog/obat-avis", label: "Obat : notre avis" },
    { href: "/tarifs", label: "Voir les tarifs Nexartis" },
    { href: "/blog", label: "Tous nos articles" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
