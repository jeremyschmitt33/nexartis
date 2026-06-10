import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis serrurier — Nexartis dès 15€/mois",
  description:
    "Devis et factures serrurerie en 2 minutes, depuis le terrain en astreinte. TVA 10/20% automatique, mention décennale, Factur-X. Essai 14 jours sans CB.",
  alternates: {
    canonical: "/logiciel-devis-serrurier",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Serrurier",
  nomPluriel: "Serruriers",
  icon: "🔐",
  h1: "Logiciel devis et factures pour serruriers",
  metaTitle: "Logiciel devis serrurier — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures serrurerie en 2 minutes, depuis le terrain en astreinte. TVA 10/20% automatique, mention décennale, Factur-X. Essai 14 jours sans CB.",
  keywordPrincipal: "logiciel devis serrurier",

  tvaNotes:
    "TVA 10% rénovation logement >2 ans (remplacement serrure, blindage), 20% neuf et fourniture seule sans pose",

  specificite:
    "Nexartis gère automatiquement les majorations nuit, dimanche et jours fériés propres à l'astreinte serrurerie, applique la mention décennale obligatoire, et permet de chiffrer un dépannage urgence depuis votre téléphone en moins de 2 minutes — devant la porte du client.",

  motsClesSecondaires: [
    "logiciel facture serrurier",
    "application devis serrurier",
    "logiciel serrurier astreinte",
    "logiciel devis dépannage serrurerie",
    "logiciel gestion serrurier",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis serrurier** en 2026 n'a rien d'un sujet annexe. Le métier vit au rythme des astreintes : un appel le dimanche à 22h pour une serrure cassée, un cambriolage à reconstituer le lundi matin, un blindage de porte à chiffrer le mardi sur rendez-vous. Deux taux de TVA cohabitent : 10% pour la rénovation d'un logement de plus de 2 ans (remplacement de cylindre, pose de blindage, ajout de verrou), 20% pour le neuf et la fourniture vendue seule. À cela s'ajoute la mention décennale obligatoire sur tout devis et facture, la fin de l'attestation TVA papier au 16 février 2025, et l'arrivée de Factur-X qui imposera la facture électronique normalisée à toutes les entreprises. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr dans la serrurerie, une part importante des professionnels exercent en solo ou en TPE, beaucoup en auto-entrepreneur. Dans la nuit, devant une porte fermée à clé avec un client paniqué à côté de vous, vous n'allez pas sortir un ordinateur portable pour saisir un devis. La dernière chose dont vous avez envie en remontant dans le camion, c'est de retaper l'intervention au bureau le lendemain. Le dépannage se joue sur le téléphone, dans l'instant, en quelques tapotements — pas la semaine d'après sur un logiciel pensé pour des PME de 20 salariés.\n\n**Nexartis** a été conçu pour cette réalité : un logiciel français pensé par et pour les artisans, qui édite un devis conforme depuis votre téléphone, applique le bon taux de TVA en deux clics, injecte automatiquement votre numéro de décennale, et intègre les mentions légales Factur-X 2026 sur vos factures sans manipulation. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous intervenez aussi en vitrerie ou en menuiserie ? [Notre logiciel vitrier](/logiciel-devis-vitrier) et [notre logiciel menuisier](/logiciel-devis-menuisier) couvrent les activités connexes dans un seul compte.",

  // ─── B — Cas d'usage narratif ──────────────────────────────────────────
  casUsage: {
    titre: "Dimanche 22h, serrure cassée — vous êtes d'astreinte",
    scene:
      "Il est 22h ce dimanche soir, un client vous appelle paniqué : sa serrure s'est cassée en rentrant, il est dehors avec sa famille. Vous arrivez en trente minutes, votre véhicule de tournée d'astreinte sur le coffre. Pendant que vous évaluez la situation (cylindre à crocheter, porte blindée 3 points), vous dictez le devis sur votre téléphone pour ne rien oublier dans l'urgence : crochetage urgence nuit, remplacement cylindre haute sécurité 5 goupilles + 3 clés brevet, déplacement majoré nuit dimanche. Vous relisez le brouillon vingt secondes, vous validez. Le client signe sur son écran avant que vous attaquiez le démontage. Avant de remonter dans le camion, la facture est partie par email, paiement réglé en CB depuis son téléphone. Lundi matin, vous reprenez tranquillement, déjà payé.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En serrurerie, vous jonglez avec deux taux de TVA selon la nature de l'intervention. La TVA à 10% s'applique aux travaux d'amélioration, de transformation et d'entretien dans un logement achevé depuis plus de 2 ans : remplacement d'un cylindre haute sécurité, pose d'un blindage de porte, ajout d'un verrou supplémentaire, réparation d'une gâche électrique d'interphone, ouverture d'urgence après bris de clé. La TVA à 20% reste obligatoire sur les constructions neuves, les extensions, certains chantiers tertiaires de construction, et la fourniture vendue seule sans pose (vente d'une serrure A2P à un particulier qui pose lui-même, par exemple).\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour le taux intermédiaire et le taux réduit) a été officiellement supprimée. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Pour les interventions d'astreinte, vos majorations nuit et dimanche sont pré-configurées dans la bibliothèque de prestations et appliquées en un seul clic. Côté Factur-X, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures sont alignées sur la réforme française dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Remplacement cylindre haute sécurité",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Pose blindage porte 3 points",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Ouverture urgence + crochetage dépannage",
      taux: "10%",
      conditions: "Travaux d'amélioration habitat",
    },
    {
      type: "Pose serrure sur construction neuve",
      taux: "20%",
      conditions: "Travaux neufs",
    },
    {
      type: "Fourniture serrure A2P sans pose",
      taux: "20%",
      conditions: "Vente seule au particulier",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : nom de l'assureur, n° de contrat, zone géographique",
    "Auto-entrepreneur serrurier : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Préciser la marque, le modèle et le niveau A2P du cylindre installé (ex : « Cylindre Vachette V5 A2P 2 étoiles, 5 goupilles brevet, 3 clés numérotées »)",
    "Détailler séparément la main d'œuvre, le déplacement, et la majoration nuit/dimanche (un client doit comprendre pourquoi un dépannage à 23h coûte 50 à 100% plus cher qu'en journée)",
    "Indiquer la durée de garantie de bon fonctionnement de la serrure posée, distincte de la décennale : généralement 1 an main d'œuvre, 2 ans matériel selon le fabricant",
    "Pour une ouverture sans bris, le préciser explicitement (crochetage propre) afin que le client puisse se retourner contre son assurance habitation",
    "Joindre une photo du devis chiffré sur place dès la fin de l'intervention, surtout en astreinte de nuit — la trace écrite vaut mille fois mieux qu'un accord oral",
    "Préciser les conditions de paiement immédiat sur dépannage (CB sur le téléphone, virement instantané) — encaisser sur place évite 95% des impayés",
    "Pour un blindage ou une serrure A2P 3 étoiles, joindre la fiche technique et préciser que le devis est compatible avec une déclaration assurance habitation",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 4411",
    "Qualibat 4412",
    "A2P (CNPP)",
    "RGE QualiBat",
    "Adhésion CAPEB serrurerie",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Ouverture urgence crochetage sans bris de porte",
    "Remplacement cylindre haute sécurité 5 goupilles + 3 clés brevet",
    "Pose blindage porte 3 points avec cornière anti-pince",
    "Pose serrure A2P 2 étoiles certifiée assurance",
    "Ouverture coffre-fort suite perte combinaison",
    "Remplacement gâche électrique interphone",
    "Dépannage volet roulant motorisé bloqué",
    "Pose verrou antivol supplémentaire haute sécurité",
    "Intervention déclaration assurance post-cambriolage",
    "Reproduction clé brevet sécurisée sur carte propriétaire",
  ],

  // ─── H — FAQ étoffée (8 Q&R, ~600 mots cumulés) ───────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un serrurier en 2026 ?",
      answer:
        "Le bon logiciel devis serrurier doit fonctionner depuis le téléphone (les interventions ont lieu sur le terrain, souvent en astreinte), gérer les majorations nuit et dimanche pré-configurées, injecter automatiquement la mention décennale, et être compatible Factur-X dès l'échéance du 1er septembre 2026. Plusieurs options existent : Tolteck (19-25€/mois) reste simple et largement adopté, Obat (25-79€/mois) ajoute la signature électronique — voir [notre avis Obat](/blog/obat-avis) —, Henrri reste gratuit mais n'est pas spécifique BTP, et Sage Batigest cible les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, pensé pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question: "Comment gérer les majorations nuit, dimanche et jours fériés ?",
      answer:
        "Dans Nexartis, vous pré-configurez vos taux de majoration une seule fois dans votre bibliothèque de prestations : par exemple +50% nuit (entre 20h et 7h), +75% dimanche, +100% nuit dimanche, +50% jour férié. Lors d'une intervention d'astreinte, vous sélectionnez la ligne « Déplacement majoré nuit » ou « Crochetage urgence dimanche » et le tarif s'applique automatiquement. Vous évitez ainsi les calculs à la main sous la pression, et vous laissez une trace claire au client : il sait exactement pourquoi un dépannage à 23h un dimanche coûte plus cher qu'une intervention le mercredi à 15h. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les mentions légales Factur-X 2026 exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment facturer un dépannage urgence depuis le terrain ?",
      answer:
        "Nexartis est une PWA installable sur iPhone et Android, sans passer par les stores. Devant la porte du client, vous créez le devis en 1 à 2 minutes : sélection du client (ou création express avec son téléphone), saisie des prestations depuis votre bibliothèque (crochetage urgence, remplacement cylindre, majoration nuit), signature directe au doigt sur l'écran du téléphone du client. La facture part par email immédiatement avec un lien de paiement Stripe. Le client règle en CB depuis son téléphone avant même que vous remontiez dans le camion.",
    },
    {
      question:
        "Puis-je intégrer ma mention décennale automatiquement sur mes documents ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), le numéro de contrat décennale, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta. Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question:
        "Le logiciel gère-t-il les interventions sous garantie habitation ?",
      answer:
        "Oui. Sur l'offre Complet à 25€ HT/mois, vous pouvez créer un dossier d'intervention typé « Sinistre assurance » avec un champ dédié au numéro de dossier sinistre de la compagnie. Chaque devis et chaque facture rattachés à ce dossier comportent automatiquement la référence à transmettre à l'assureur du client, et l'historique complet (photos avant/après, devis signé, facture, mode opératoire) est conservé pendant 10 ans pour la décennale. Pour les sinistres MAIF, MAAF, MACIF ou Allianz, vous gagnez un temps précieux : le dossier complet se télécharge en un clic au format PDF.",
    },
    {
      question: "Comment chiffrer rapidement un blindage de porte ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le logiciel devis serrurier crée un chiffrage de blindage en quelques tapotements : client (recherche par nom ou téléphone), prestations depuis votre bibliothèque (cornière anti-pince, plaque de blindage, cylindre A2P 2 étoiles, main d'œuvre 4h), validation. Le client signe directement avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré. La commande vocale (offre Complet à 25€ HT/mois) vous permet même de dicter le devis depuis le camion entre deux interventions. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de matériel A2P ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, et l'unité de vente (heure, pièce, mètre linéaire). L'offre Essentiel à 15€ HT/mois donne accès à des modèles génériques pré-remplis (crochetage urgence, remplacement cylindre, pose blindage) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées par marque (Vachette, Bricard, Picard, Pollux, Mottura), import de votre tarif fournisseur, regroupement de prestations en « packs » réutilisables (par exemple : kit pose blindage complet avec cornière + plaque + cylindre A2P 2 étoiles). Vous gagnez plusieurs heures par semaine de saisie sur les dépannages récurrents.",
    },
    {
      question: "Comment gérer le SAV après une intervention d'astreinte ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque intervention conserve son historique complet : devis signé sur place, facture émise dans la foulée, photos prises sur le terrain (porte avant/après crochetage, cylindre déposé), notes datées par intervention. En cas d'appel SAV six mois plus tard pour une clé qui force, vous retrouvez en deux clics : la date d'installation, la marque et le modèle du cylindre posé, le niveau A2P, et l'historique des interventions précédentes. La mention décennale reste tracée sur 10 ans côté assureur. Pour les interventions SAV, vous créez un nouveau devis rattaché à l'intervention d'origine, et la traçabilité comptable est conservée pour vos archives fiscales (durée légale 5 ans).",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à **15€ HT/mois** (notre plan le plus accessible) ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-vitrier", label: "Logiciel pour vitrier" },
    { href: "/logiciel-devis-menuisier", label: "Logiciel pour menuisier" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
