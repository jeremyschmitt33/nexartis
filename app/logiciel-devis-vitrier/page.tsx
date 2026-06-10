import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis vitrier — Nexartis dès 15€/mois",
  description:
    "Devis et factures vitrerie en 2 minutes. TVA 5,5/10/20% automatique, bris de glace assurance, mesures laser. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-vitrier",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Vitrier",
  nomPluriel: "Vitriers",
  icon: "🪟",
  h1: "Logiciel devis et factures pour vitriers",
  metaTitle: "Logiciel devis vitrier — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures vitrerie en 2 minutes. TVA 5,5/10/20% automatique, bris de glace assurance, mesures laser. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis vitrier",

  tvaNotes:
    "TVA 5,5% rénovation énergétique (double vitrage Uw ≤ 1,3), 10% rénovation logement >2 ans, 20% neuf et fourniture seule",

  specificite:
    "Nexartis gère les 3 taux de TVA vitrerie, automatise les devis de bris de glace pour assurance habitation, permet de chiffrer un vitrage sur mesure à partir de cotes laser, et facilite la traçabilité des sinistres déclarés en compagnie.",

  motsClesSecondaires: [
    "logiciel facture vitrier",
    "application devis miroiterie",
    "logiciel vitrier urgence",
    "logiciel chiffrage vitrage",
    "logiciel devis miroitier",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis vitrier** en 2026 n'a rien d'un sujet annexe. Trois taux de TVA cohabitent en vitrerie-miroiterie : 5,5% pour la rénovation énergétique (remplacement par un double vitrage haute performance Uw ≤ 1,3 W/m².K), 10% pour la rénovation classique d'un logement de plus de 2 ans (vitrage simple cassé, miroir sur mesure, baie vitrée), 20% pour le neuf et la fourniture vendue seule. À cela s'ajoutent la mention décennale obligatoire sur tout devis et facture, la fin de l'attestation TVA papier au 16 février 2025, et l'arrivée de Factur-X qui imposera la facture électronique normalisée à toutes les entreprises. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr en vitrerie, le métier mélange deux logiques opposées. D'un côté la rénovation programmée : pose d'une verrière atelier, remplacement de la baie coulissante, fabrication d'un miroir salle de bains sur cotes laser, chantier prévu à l'agenda quinze jours à l'avance. De l'autre, l'urgence bris de glace : un cambriolage la nuit, une vitrine commerciale brisée le matin de l'ouverture, un sinistre à reconstituer immédiatement pour l'assurance habitation. Les compagnies (AXA, MAIF, MACIF, Allianz, GMF, Matmut) exigent un devis détaillé et signé dans la journée. La théorie des process pensés par [Sage Batigest pour PME](/blog/batigest-avis) n'est pas adaptée à un vitrier qui doit dégainer son téléphone devant une vitrine brisée à 11h du matin.\n\n**Nexartis** a été conçu pour cette double réalité : un logiciel français pensé par et pour les artisans, qui édite un devis conforme depuis votre téléphone ou votre tablette, applique le bon taux de TVA en deux clics, intègre votre numéro de décennale automatiquement, gère le numéro de dossier sinistre côté assureur, et prépare vos factures au format Factur-X sans manipulation. Vous comparez avec [notre avis Tolteck](/blog/tolteck-avis) ou [notre avis Obat](/blog/obat-avis) ? Sachez que Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Voir [nos tarifs détaillés](/tarifs) ou [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez aussi en serrurerie ? [Notre logiciel serrurier](/logiciel-devis-serrurier) couvre la double activité dans un seul compte.",

  // ─── B — Cas d'usage narratif ──────────────────────────────────────────
  casUsage: {
    titre: "Mardi 11h, bris de glace urgence après cambriolage",
    scene:
      "Une cliente vous appelle, panique : sa vitrine de boutique a été brisée la nuit dernière, ses clients arrivent à 14h. Vous arrivez avec votre camion équipé, vous prenez les cotes exactes au laser, photographiez la zone. Vous dictez sur place : protection temporaire OSB pendant fabrication, fourniture vitrage feuilleté 44.2 anti-effraction, dépose ancien vitrage cassé, repose joint silicone neutre, mise en place définitive. Vous précisez le délai (fabrication 48h, pose immédiate à réception). La cliente signe, vous envoyez la facture le jour même, paiement réglé sous 7 jours pour les frais d'assurance.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En vitrerie-miroiterie, vous jonglez avec trois taux de TVA selon la nature de la prestation. La TVA à 5,5% s'applique aux travaux d'amélioration de la performance énergétique : remplacement d'un simple vitrage par un double vitrage haute performance (coefficient Uw ≤ 1,3 W/m².K), pose d'un triple vitrage isolant, ou intégration d'un vitrage à isolation renforcée (VIR). Deux conditions doivent être réunies : le vitrage doit respecter le seuil thermique réglementaire, et le logement doit avoir plus de 2 ans. La TVA à 10% couvre tous les travaux d'amélioration, transformation, aménagement et entretien dans un logement de plus de 2 ans : remplacement d'un simple vitrage cassé en restant en simple vitrage, pose d'un miroir sur mesure, installation d'une verrière atelier, pare-douche italienne, baie vitrée coulissante. La TVA à 20% reste obligatoire sur le neuf, les extensions, les vitrines commerciales en construction, et la fourniture vendue seule sans pose.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour le taux intermédiaire et le taux réduit) a été officiellement supprimée. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Pour un dossier de bris de glace à transmettre à l'assurance habitation, le devis est généré au format PDF avec votre tampon, signé par le client, et incluant le numéro de sinistre fourni par la compagnie. Côté Factur-X, le format européen EN 16931 est activé par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures partent déjà conformes à la réforme française dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE. Voir aussi [nos tarifs détaillés](/tarifs).",

  tableauTva: [
    {
      type: "Double vitrage haute performance Uw ≤ 1,3",
      taux: "5,5%",
      conditions: "Rénovation énergétique + logement >2 ans",
    },
    {
      type: "Remplacement simple vitrage cassé",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Pose miroir sur mesure salle de bains",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Vitrine commerciale construction neuve",
      taux: "20%",
      conditions: "Travaux neufs",
    },
    {
      type: "Fourniture vitrage sans pose",
      taux: "20%",
      conditions: "Vente seule",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : nom de l'assureur, n° de contrat, zone géographique",
    "Auto-entrepreneur vitrier : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Préciser systématiquement les cotes exactes du vitrage (longueur × hauteur × épaisseur) — un vitrage 4/16/4 argon n'est pas un 4/12/4 air, et le client doit voir la performance qu'il paie",
    "Indiquer la composition complète pour un vitrage isolant : épaisseurs des verres, type de gaz dans la lame (argon, krypton), traitement intercalaire (Warm Edge), coefficient Uw final en W/m².K",
    "Pour un vitrage feuilleté de sécurité, mentionner la classification (44.2, 44.4, P1A, P2A, P5A) selon la norme EN 356 — c'est l'élément différenciant pour une assurance habitation",
    "Détailler explicitement la dépose de l'ancien vitrage et l'enlèvement des gravats — le client doit savoir s'ils sont inclus ou facturés en supplément",
    "Pour un bris de glace à déclarer à l'assurance, ajouter en pied de devis le numéro de sinistre, le nom de la compagnie, et la mention « devis pour transmission compagnie d'assurance »",
    "Sur un chantier de verrière atelier, joindre un schéma coté avec emplacement des pannes, traverses et meneaux — cela évite les contestations de mesures à la livraison",
    "Préciser la durée de garantie de bon fonctionnement du joint silicone (5 à 10 ans selon le fabricant) et la garantie produit du vitrage (généralement 10 ans pour les double vitrages CEKAL)",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 4711",
    "Qualibat 4712",
    "CEKAL (vitrages isolants)",
    "RGE QualiBat",
    "Adhésion CAPEB vitrerie",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Remplacement simple vitrage cassé urgence",
    "Fourniture pose double vitrage 4/16/4 argon Uw 1,1",
    "Vitrage feuilleté anti-effraction 44.2 sécurité",
    "Miroir sur mesure salle de bains avec biseau",
    "Verrière atelier acier 4 sections sur mesure",
    "Pare-douche italienne verre trempé 8mm",
    "Vitrine commerce mesurée au laser",
    "Baie vitrée coulissante aluminium 3 vantaux",
    "Vitrage retardateur d'effraction P1A norme EN 356",
    "Dépannage urgence post-cambriolage + protection OSB",
  ],

  // ─── H — FAQ étoffée (8 Q&R, ~600 mots cumulés) ───────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un vitrier en 2026 ?",
      answer:
        "Le bon logiciel devis vitrier doit gérer les trois taux de TVA (5,5%, 10%, 20%), automatiser les devis de bris de glace pour transmission assurance, intégrer la mention décennale, et être compatible Factur-X dès l'échéance du 1er septembre 2026. Plusieurs options existent : [notre comparatif Tolteck](/blog/tolteck-avis) (19-25€/mois) reste simple et largement adopté, [notre avis Obat](/blog/obat-avis) (25-79€/mois) ajoute la signature électronique, [Henrri reste gratuit](/blog/henrri-avis) mais n'est pas spécifique BTP, et [Sage Batigest pour PME](/blog/batigest-avis) cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu spécifiquement pour les artisans solo et auto-entrepreneurs. Voir [nos tarifs détaillés](/tarifs).",
    },
    {
      question: "Comment gérer un dossier bris de glace pour l'assurance ?",
      answer:
        "Dans Nexartis, vous créez le devis directement sur place avec les cotes laser, vous photographiez la zone (essentiel pour le dossier assurance), et vous générez un PDF signé par le client. Sur l'offre Complet à 25€ HT/mois, vous renseignez un champ dédié « N° sinistre » et « Compagnie d'assurance » (AXA, MAIF, MACIF, Allianz, GMF, Matmut) qui apparaissent en en-tête du devis. Le PDF se transmet en un clic à la compagnie par email avec les photos en pièce jointe. Le client est remboursé sous 7 à 15 jours selon les compagnies, et vous gardez la trace du sinistre dans l'historique du chantier pendant 10 ans.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis sont générées au format Factur-X (un PDF lisible avec un fichier XML structuré embarqué), conformes au standard européen EN 16931. Vous n'avez aucune manipulation à faire : le format s'applique par défaut dès l'offre Essentiel à 15€ HT/mois. Plus de détails sur [notre guide logiciel devis factures BTP](/logiciel-devis-factures).",
    },
    {
      question: "Comment facturer rapidement une intervention urgence ?",
      answer:
        "Nexartis est une PWA installable sur iPhone et Android, sans passer par les stores. Devant la vitrine brisée du client, vous créez le devis en 2 à 3 minutes : sélection du client (ou création express), saisie des cotes mesurées au laser, prestations depuis votre bibliothèque (protection OSB temporaire, fourniture vitrage feuilleté 44.2, pose joint silicone neutre), validation. La facture part par email avec un lien de paiement Stripe le jour même. Pour un sinistre assurance, vous envoyez le devis signé à la compagnie le matin et le client est remboursé sous 7 jours. Voir les offres et [nos tarifs détaillés](/tarifs).",
    },
    {
      question:
        "Puis-je intégrer ma mention décennale automatiquement sur mes documents ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), le numéro de contrat décennale, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta. Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question:
        "Le logiciel gère-t-il les vitrages sur mesure avec cotes précises ?",
      answer:
        "Oui. Dans Nexartis, chaque ligne de devis dispose d'un champ « Description » libre où vous saisissez les cotes exactes (par exemple : « Vitrage feuilleté 44.2 — 1820 × 940 mm — épaisseur 8,76 mm — joint silicone neutre noir »). L'offre Complet à 25€ HT/mois ajoute la possibilité de joindre un schéma coté en PDF directement au devis pour les verrières atelier ou les baies coulissantes complexes. La cotation laser est saisie en deux clics, et le tarif au m² s'applique automatiquement selon la surface calculée. Vous évitez les erreurs de saisie sous la pression d'une urgence.",
    },
    {
      question: "Comment créer un devis depuis le chantier ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le logiciel devis vitrier se crée en quelques tapotements : client (recherche par nom ou téléphone), prestations depuis votre bibliothèque (vitrage isolant, miroir sur mesure, dépose ancien vitrage), saisie des cotes, validation. Le client signe directement avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré. L'ensemble fonctionne même avec une connexion 4G faible et synchronise dès le retour en zone couverte. La commande vocale (offre Complet à 25€ HT/mois) vous permet même de dicter le devis depuis le camion. Voir aussi [notre logiciel serrurier](/logiciel-devis-serrurier) si vous cumulez les deux activités, ou pour un autre corps de métier, [menuisier BTP](/logiciel-devis-menuisier).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de vitrages et matériel ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT au m², le taux de TVA par défaut, et l'unité de vente (m², pièce, mètre linéaire). L'offre Essentiel à 15€ HT/mois donne accès à des modèles génériques pré-remplis (double vitrage 4/16/4, vitrage feuilleté 44.2, miroir sur mesure) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées par fournisseur (Saint-Gobain Glass, AGC, Pilkington, Riou Glass), import de votre tarif fournisseur, regroupement de prestations en « packs » réutilisables (par exemple : kit double vitrage complet avec dépose + pose joint silicone + nettoyage). Vous gagnez plusieurs heures par semaine de saisie sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer le SAV et la garantie sur un vitrage isolant ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, facture émise, photos prises sur le terrain, notes datées par intervention. En cas d'appel SAV plusieurs années plus tard pour un vitrage qui s'embue entre les feuilles (signe d'un joint défaillant), vous retrouvez en deux clics : la date de pose, la marque du vitrage (certifié CEKAL généralement garanti 10 ans), le n° de lot fabricant, et l'historique des interventions. La mention décennale reste tracée sur 10 ans côté assureur, et la garantie produit CEKAL prend le relais pour le remplacement du vitrage défectueux. Pour les interventions SAV, vous créez un nouveau devis rattaché au chantier d'origine, et la traçabilité comptable est conservée pour vos archives fiscales (durée légale 5 ans). Voir [tous nos articles](/blog) pour aller plus loin.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (notre plan le plus accessible) ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [démarrer l'essai gratuit](/register) en moins de 2 minutes ou consulter [nos tarifs détaillés](/tarifs) avant de vous décider.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-serrurier", label: "Logiciel pour serrurier" },
    { href: "/logiciel-devis-menuisier", label: "Logiciel pour menuisier" },
    { href: "/logiciel-devis-plombier", label: "Logiciel pour plombier" },
    { href: "/blog/tolteck-avis", label: "Tolteck : notre avis" },
    { href: "/blog/obat-avis", label: "Obat : notre avis" },
    { href: "/tarifs", label: "Voir les tarifs Nexartis" },
    { href: "/blog", label: "Tous nos articles" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
