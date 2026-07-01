import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis paysagiste — Nexartis dès 15€/mois",
  description:
    "Devis et contrats d'entretien paysagistes en 2 minutes. TVA, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-paysagiste",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Paysagiste",
  nomPluriel: "Paysagistes",
  icon: "🌿",
  h1: "Logiciel devis et factures pour paysagistes",
  metaTitle: "Logiciel devis paysagiste — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et contrats d'entretien paysagistes en 2 minutes. TVA, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis paysagiste",

  tvaNotes:
    "TVA 20% par défaut sur aménagement et entretien, 10% pour les travaux liés à l'habitation, 5,5% sur certains travaux énergétiques.",

  specificite:
    "Nexartis gère les contrats d'entretien périodiques (tonte mensuelle, taille saisonnière), génère automatiquement vos factures récurrentes, et permet de signer un devis chez le client en moins de 2 minutes — y compris en plein chantier de plantation.",

  motsClesSecondaires: [
    "logiciel facture paysagiste",
    "application devis paysagiste",
    "logiciel paysagiste auto-entrepreneur",
    "logiciel entretien espaces verts",
    "logiciel gestion paysagiste",
  ],

  // ─── A — Introduction longue ───────────────────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis paysagiste** en 2026 demande de la précision. Le métier mélange création (jardins paysagers, terrassement, plantations neuves), entretien périodique (tonte mensuelle, taille saisonnière, désherbage) et urgence ponctuelle (élagage après tempête). À cela s'ajoute la mention décennale obligatoire dès lors que vos travaux touchent au gros œuvre ou à la structure, la fin de l'attestation TVA papier au **16 février 2025**, et l'arrivée de Factur-X qui imposera la facture électronique normalisée à toutes les entreprises. L'outil que vous utilisez doit suivre cette réalité. Pour un panorama plus large, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nDans le métier, beaucoup de paysagistes exercent en TPE ou sous statut auto-entrepreneur. La saison haute concentre 70% de l'activité entre mars et octobre, avec des journées qui démarrent à 7h sur un chantier et finissent à 19h sur un autre. La dernière chose dont vous avez besoin, en rentrant le soir avec l'odeur du gazon coupé sur les chaussures, c'est de devoir taper trois devis sur l'ordinateur. Le suivi des contrats d'entretien récurrents, lui, doit tourner tout seul : facturation mensuelle automatique, relances, rendez-vous saisonniers planifiés. Pas la peine d'avoir un outil de PME taillé pour des structures de 15 salariés.\n\nNexartis a été conçu pour cette réalité d'artisan : un logiciel français pensé par et pour les artisans, qui édite un devis conforme depuis votre téléphone, gère les contrats d'entretien récurrents avec facturation automatique, applique le bon taux de TVA, et prépare vos factures au format **Factur-X**. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez aussi le bois pour des terrasses ou pergolas ? [Notre logiciel menuisier](/logiciel-devis-menuisier) couvre les deux activités dans un seul compte, et pour les chantiers de dallage ou de muret, voyez aussi [notre logiciel maçon](/logiciel-devis-maconnerie).",

  // ─── B — Cas d'usage narratif ─────────────────────────────────────────
  casUsage: {
    titre: "Lundi 8h, premier passage d'entretien chez un client annuel",
    scene:
      "Le client a signé un contrat d'entretien annuel en janvier : tonte mensuelle d'avril à octobre, deux tailles de haies de laurier dans l'année, désherbage thermique deux fois. Vous arrivez avec le matériel, vous attaquez la tonte. Pendant la pause, vous ouvrez Nexartis sur le téléphone et vous validez l'intervention du jour. Le contrat récurrent était déjà programmé : la facture mensuelle part automatiquement le 5 du mois prochain, lissée sur l'année pour étaler la trésorerie du client. Vous notez en deux phrases les observations du jour : haie de laurier-cerise à tailler en juin, massif de vivaces à scarifier au prochain passage. Tout est tracé dans l'historique du chantier. Le client reçoit son récapitulatif d'intervention par email avant que vous quittiez le jardin.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En paysagisme, la règle de TVA est plus simple qu'en plomberie, mais elle est piégeuse. Le taux par défaut est 20% sur l'aménagement paysager et l'entretien : création de jardin, plantation neuve, terrassement, pose de clôture, tonte récurrente, taille saisonnière, élagage. Le taux à 10% s'applique uniquement quand les travaux sont liés à l'habitation et réalisés sur un logement de plus de 2 ans : terrasse attenante à la maison, allée d'accès pavée, marches reliant la maison au jardin, mur de soutènement adossé à la construction. Le taux à 5,5% reste rare et ne concerne que certains travaux d'amélioration énergétique éligibles, comme une toiture végétalisée sur un logement existant. Attention : l'entretien régulier (tonte mensuelle, taille de haie, désherbage) reste à 20%, même chez un particulier dans un logement ancien.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis ou à la facture, indiquant que les conditions du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan paysagiste. Les justificatifs (devis client, descriptif des travaux liés à l'habitation) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Pour les contrats d'entretien récurrents, le taux est mémorisé une seule fois et appliqué sur chaque facture mensuelle générée. Côté **Factur-X**, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures sont alignées sur la réforme dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Création de jardin, plantation neuve, terrassement",
      taux: "20%",
      conditions: "Aménagement paysager",
    },
    {
      type: "Tonte mensuelle, taille de haie, désherbage",
      taux: "20%",
      conditions: "Entretien périodique",
    },
    {
      type: "Terrasse attenante à la maison, allée d'accès",
      taux: "10%",
      conditions: "Travaux liés à l'habitation >2 ans",
    },
    {
      type: "Mur de soutènement adossé à la construction",
      taux: "10%",
      conditions: "Travaux liés à l'habitation >2 ans",
    },
    {
      type: "Toiture végétalisée (amélioration énergétique)",
      taux: "5,5%",
      conditions: "Logement >2 ans, cas spécifique",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Entretien de jardin chez un particulier : crédit d'impôt services à la personne de 50% pour le client (plafond 5 000 € de dépenses/an) si l'entreprise est déclarée ou agréée SAP — la création et l'aménagement n'y sont pas éligibles",
    "Certiphyto obligatoire pour tout paysagiste utilisant des produits phytosanitaires à titre professionnel",
    "Loi Labbé en vigueur depuis 2019 : interdiction des phytos pour les particuliers, ZNT à respecter près des points d'eau",
    "Auto-entrepreneur paysagiste : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
  ],

  // ─── E — Conseils de rédaction ────────────────────────────────────────
  conseilsRedaction: [
    "Préciser les essences exactes des plantations (ex : « 12 laurier-cerise Prunus laurocerasus Rotundifolia, conteneur 3L, hauteur 60-80 cm »)",
    "Détailler chaque passage du contrat d'entretien : nombre de tontes annuelles, mois des deux tailles de haie, fréquence du désherbage thermique",
    "Mentionner l'évacuation des déchets verts en déchèterie professionnelle ou par compostage sur place, avec coût associé",
    "Pour un élagage en hauteur, préciser la méthode (nacelle, rappel sur corde), la classe d'arbre et joindre l'attestation d'élagueur grimpeur si requise",
    "Indiquer la garantie de reprise sur les végétaux plantés (souvent 1 an, sous conditions d'arrosage par le client) et la liste des essences non garanties",
    "Préciser les conditions de paiement : acompte à la signature (souvent 30% sur un chantier de création), facturation mensuelle ou trimestrielle pour les contrats d'entretien",
    "Pour un système d'arrosage automatique enterré, indiquer le nombre de zones, la marque des programmateurs et électrovannes, et la garantie fabricant du matériel posé",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualipaysage E1 — Entretien des aménagements paysagers",
    "Qualipaysage P1 — Plantations et engazonnements",
    "Qualipaysage C1 — Constructions paysagères (terrasses, clôtures, allées)",
    "Certiphyto (obligatoire si utilisation de produits phytosanitaires pro)",
    "Plante Bleue (label environnemental des entreprises du paysage)",
  ],

  // ─── G — Prestations typiques ─────────────────────────────────────────
  prestationsExemples: [
    "Création complète d'un jardin paysager 300 m²",
    "Pose d'un système d'arrosage automatique enterré",
    "Élagage arbres hauteur sur cordes",
    "Taille de haie laurier-cerise sur 40 mètres linéaires",
    "Tonte mensuelle avec tracteur autoportée",
    "Pose clôture rigide soubassement béton",
    "Plantation massif de vivaces et paillage minéral",
    "Désherbage thermique annuel des allées",
    "Scarification et regarnissage gazon de printemps",
    "Pose dallage extérieur sur lit de sable stabilisé",
  ],

  // ─── H — FAQ étoffée ──────────────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le bon logiciel devis pour un paysagiste en 2026 ?",
      answer:
        "Le bon logiciel devis paysagiste doit gérer les contrats d'entretien récurrents avec facturation mensuelle ou trimestrielle, appliquer la TVA à 20% par défaut sur l'aménagement et l'entretien, être compatible Factur-X dès l'échéance du 1er septembre 2026, et permettre de créer un devis depuis le jardin du client en moins de 2 minutes. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple — voir [notre comparatif Tolteck](/blog/tolteck-avis) —, Obat (25-79€/mois) ajoute la signature électronique, Henrri reste gratuit mais n'est pas spécifique BTP, et Vertuoza cible plutôt les structures plus grandes. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, pensé pour les paysagistes solo et auto-entrepreneurs.",
    },
    {
      question: "Comment gérer un contrat d'entretien récurrent dans le logiciel ?",
      answer:
        "Dans Nexartis, vous créez un contrat d'entretien type avec les prestations annuelles (par exemple : 7 tontes d'avril à octobre, 2 tailles de haie, 2 désherbages), le montant total HT, le taux de TVA et la fréquence de facturation souhaitée. Le logiciel génère automatiquement chaque facture mensuelle ou trimestrielle à la date programmée, l'envoie au client et la rattache au chantier d'origine. Pour le client, c'est une trésorerie lissée sur l'année ; pour vous, c'est zéro saisie après la mise en place initiale. Chaque intervention sur le terrain est notée dans l'historique du chantier avec date, durée et observations.",
    },
    {
      question: "Mes clients peuvent-ils bénéficier d'un crédit d'impôt pour l'entretien de leur jardin ?",
      answer:
        "Oui, et c'est un argument commercial à mettre en avant sur vos devis. Les petits travaux de jardinage d'entretien courant (tonte de pelouse, taille de haie, débroussaillage, désherbage) réalisés chez un particulier ouvrent droit, pour votre client, à un **crédit d'impôt de 50%** au titre des services à la personne, dans la limite de 5 000 € de dépenses par an et par foyer. Deux conditions : votre entreprise doit être déclarée ou agréée « services à la personne », et seul l'entretien courant est concerné — la création et l'aménagement paysager n'y sont pas éligibles. Concrètement, un contrat d'entretien annuel de 2 000 € ne revient qu'à 1 000 € pour votre client après crédit d'impôt : le préciser sur le devis lève une grande partie des objections de prix. Avec Nexartis, vous mémorisez cette mention et votre contrat d'entretien récurrent une seule fois, et la facture se génère automatiquement à chaque échéance.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les **mentions légales** exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois, y compris sur les factures récurrentes générées par vos contrats d'entretien.",
    },
    {
      question: "Comment facturer un chantier saisonnier de création de jardin ?",
      answer:
        "Sur un chantier de création (terrassement, plantation, pose dallage), vous éditez un devis détaillé avec acompte à la signature (souvent 30%). Une fois validé, le chantier est créé dans Nexartis avec son planning. Vous pouvez ensuite facturer par situations intermédiaires : par exemple 30% à la signature, 40% à la fin du terrassement, 30% à la réception après plantation. Le solde est calculé automatiquement à chaque étape et chaque facture est rattachée au chantier pour la traçabilité comptable.",
    },
    {
      question:
        "Puis-je intégrer ma mention décennale automatiquement sur mes documents ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (MAAF Pro, Groupama, SMABTP, Allianz, etc.), le numéro de contrat décennale, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta dès que vos travaux relèvent du gros œuvre ou touchent à la structure (terrassement de soutènement, dallage extérieur, pose de mur). Si vous changez d'assureur, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes et factures de situation ?",
      answer:
        "Oui. Dans Nexartis, vous pouvez exiger un acompte à la signature du devis (le standard en paysagisme est de 30% sur les chantiers de création). Pour les gros chantiers de plusieurs semaines, vous facturez ensuite des situations intermédiaires liées à l'avancement réel : terrassement réceptionné, plantations posées, mise en route de l'arrosage. Le solde est calculé automatiquement à chaque étape, et chaque facture est rattachée au chantier d'origine pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu pour vous alerter avant le franchissement.",
    },
    {
      question: "Comment créer un devis depuis le jardin du client ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android, sans passer par les stores. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le logiciel devis paysagiste se crée en quelques tapotements : client (recherche par nom), prestations depuis votre bibliothèque (tonte, plantation, élagage), validation. Le client signe directement avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré si pertinent. L'ensemble fonctionne même avec une connexion 4G faible et synchronise dès le retour en zone couverte. La commande vocale (offre Complet à 25€ HT/mois) vous permet même de dicter le devis depuis la cabine du tracteur. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de prix matériel végétal ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, et l'unité de vente (heure, mètre linéaire, m², pièce). L'offre Essentiel à 15€ HT/mois vous donne accès à des modèles génériques pré-remplis (tonte, taille, plantation, désherbage) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fournisseur (jardinerie pro, pépinière), regroupement de prestations en « packs » réutilisables (par exemple : kit massif vivaces 10 m² avec terre de bruyère, paillage et arrosage compris). Vous gagnez plusieurs heures de saisie par semaine sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer la saisonnalité de l'activité paysagiste ?",
      answer:
        "La saison haute concentre la majorité de votre chiffre d'affaires entre mars et octobre. Pour lisser votre trésorerie, Nexartis vous permet de facturer mensuellement vos contrats d'entretien sur 12 mois (au lieu de 7 mois actifs), pratique courante chez les paysagistes pour stabiliser les rentrées. Côté planning, l'offre Complet à 25€ HT/mois affiche votre activité semaine par semaine, identifie les semaines surchargées en avril-mai (rush printemps) et libère les créneaux d'automne pour les chantiers de plantation à racines nues. Vous anticipez vos achats de végétaux et vos commandes de matériaux plusieurs semaines à l'avance.",
    },
    {
      question: "Comment gérer le SAV et la garantie de reprise des végétaux ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, factures émises, photos prises sur le terrain, notes datées par intervention. La garantie de reprise (souvent 1 an, sous conditions d'arrosage par le client) court à partir de la date de plantation tracée dans le devis. En cas d'appel client six mois plus tard pour un végétal qui n'a pas repris, vous retrouvez en deux clics : la date de plantation, l'essence et le calibre, le fournisseur, et l'historique des passages d'entretien. Vous créez ensuite un avenant ou un devis de remplacement rattaché au chantier d'origine. Pour les archives fiscales, la durée légale de conservation reste de cinq ans.",
    },
    {
      question: "Le logiciel prend-il en compte les obligations Certiphyto ?",
      answer:
        "Nexartis ne remplace pas votre Certiphyto, mais il vous aide à le valoriser. Vous pouvez ajouter votre numéro Certiphyto dans les paramètres de votre entreprise pour qu'il apparaisse sur les devis concernant des traitements phytosanitaires professionnels. Depuis la loi Labbé de 2019, l'usage de phytos par les particuliers est interdit : vos clients particuliers ne peuvent plus traiter eux-mêmes leurs jardins, ce qui vous positionne comme l'intervenant légalement autorisé. Pour les zones non traitées (ZNT) près des points d'eau, vous documentez la prestation dans les notes du chantier pour conserver la traçabilité réglementaire. Le contrat d'entretien type peut intégrer une ligne « traitement phyto pro » avec votre numéro Certiphyto en pied de document.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (notre plan le plus accessible) ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-maconnerie", label: "Logiciel pour maçon (dallage, muret)" },
    { href: "/logiciel-devis-menuisier", label: "Logiciel pour menuisier (terrasses bois)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
