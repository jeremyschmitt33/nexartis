import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis maçon — Nexartis dès 15€/mois",
  description:
    "Devis et factures maçonnerie en 2 minutes. TVA 5,5/10/20%, situations de travaux, extension, ITE. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-maconnerie",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Maçon",
  nomPluriel: "Maçons",
  icon: "🧱",
  h1: "Logiciel devis et factures pour maçons",
  metaTitle: "Logiciel devis maçon — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures maçonnerie en 2 minutes. TVA 5,5/10/20%, situations de travaux, extension, ITE. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis maçon",

  tvaNotes:
    "TVA 5,5% ITE et rénovation énergétique, 10% rénovation logement >2 ans, 20% neuf et extension",

  specificite:
    "Nexartis gère les chantiers longs avec acompte et situations de travaux, injecte votre qualification Qualibat et votre décennale, et permet de chiffrer une extension ou une ouverture de mur porteur depuis le terrain.",

  motsClesSecondaires: [
    "logiciel facture maçon",
    "application devis maçonnerie",
    "logiciel maçon auto-entrepreneur",
    "logiciel chiffrage gros œuvre",
    "logiciel gestion maçonnerie",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis maçon** en 2026 a un impact direct sur la trésorerie. Vos chantiers durent rarement deux jours : une extension, c'est 3 à 6 mois ; une rénovation de fondations, plusieurs semaines ; même une terrasse béton demande un calendrier précis. Sur ces durées, l'acompte à la signature et les situations de travaux intermédiaires (fondations, élévation, charpente, finitions) font la différence entre un chantier rentable et un trou de trésorerie. Côté TVA, trois taux cohabitent : 5,5% pour l'ITE et la rénovation énergétique, 10% pour la rénovation classique d'un logement de plus de 2 ans, 20% pour le neuf et les extensions considérées comme construction neuve. À cela s'ajoutent la mention décennale obligatoire (le gros œuvre relève par nature de la garantie décennale Spinetta), la fin de l'attestation TVA papier au 16 février 2025, et l'arrivée de Factur-X. Pour aller plus loin, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nLa réalité du métier en France : beaucoup de maçons exercent en TPE ou en solo, souvent sous statut auto-entrepreneur (source CAPEB). Vous gérez en parallèle plusieurs corps de métier sur un même chantier (terrassement, ferraillage, BET pour les ouvertures porteuses, charpentier, couvreur). Vos devis sont longs, structurés en lots (gros œuvre, second œuvre, finitions), avec des dizaines de lignes : parpaings, sacs de ciment, ferraille, banches, planelles, linteaux. Un logiciel doit pouvoir gérer cette complexité sans vous obliger à utiliser un tableur en parallèle.\n\nNexartis a été conçu pour cette réalité : un logiciel français qui édite un devis structuré en sections, applique le bon taux de TVA en deux clics par ligne, injecte automatiquement votre qualification Qualibat et votre numéro de décennale, et prépare vos factures au format Factur-X. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe, situations de travaux). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez avec un couvreur ou un carreleur ? [Notre logiciel couvreur](/logiciel-devis-couvreur) et [notre logiciel carreleur](/logiciel-devis-carreleur) couvrent les corps de métier connexes (chape, sol) dans le même compte.",

  // ─── B — Cas d'usage narratif (80-120 mots) ────────────────────────────
  casUsage: {
    titre: "Janvier, devis pour une extension de 30 m² plain-pied",
    scene:
      "Le couple veut agrandir leur maison de 1990 avec une extension de 30 m² côté jardin. Vous passez sur place pour le métré : photos de la zone, distances aux limites de propriété mesurées au télémètre, raccordement à l'existant relevé, accès chantier vérifié. Vous dictez le devis sur votre téléphone, structuré en sections : terrassement, fondations semelle filante, dalle béton armé, murs parpaing 20 cm, charpente bois, couverture tuile, menuiseries, finitions extérieures, raccordements évacuations. Le chantier durera 4 mois. Vous configurez les situations : 30% à la signature, 30% après gros œuvre, 30% après hors d'eau hors d'air, 10% à la réception. Le couple signe, vous démarrez dans 3 semaines.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En maçonnerie, vous jonglez avec trois taux de TVA selon la nature du chantier. La TVA à 5,5% s'applique aux travaux de rénovation énergétique : isolation thermique par l'extérieur (ITE) avec enduit sur isolant ou bardage rapporté, isolation thermique par l'intérieur dans le cadre d'une rénovation globale. Deux conditions cumulatives : être certifié RGE (Qualibat avec mention RGE sur la qualification ITE) et intervenir dans un logement de plus de 2 ans. La TVA à 10% est votre taux le plus courant : ouverture de mur porteur avec pose IPN, dalle béton dans un logement existant, ravalement classique, chape, fondations sur agrandissement non considéré comme construction neuve, terrasse, muret de clôture, escalier béton. La TVA à 20% s'impose sur la construction neuve : maison individuelle neuve, extension considérée comme construction neuve (généralement au-delà de 9 m² SHON, ou en cas de surélévation), locaux commerciaux, fourniture seule.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis et à la facture, indiquant que les conditions du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs doivent être conservés cinq ans en cas de contrôle fiscal.\n\nDans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique. Votre qualification Qualibat (maçonnerie générale, ITE) et votre numéro de décennale apparaissent aussi sur le devis et la facture. Côté Factur-X, le format européen EN 16931 est activé par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures partent conformes à la réforme française dont le calendrier impose la réception le 1er septembre 2026 et l'émission le 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Isolation thermique extérieure (ITE) enduit ou bardage",
      taux: "5,5%",
      conditions: "RGE + logement >2 ans",
    },
    {
      type: "Ouverture mur porteur + IPN, dalle, chape (rénovation)",
      taux: "10%",
      conditions: "Logement >2 ans, amélioration habitat",
    },
    {
      type: "Ravalement façade, terrasse béton, muret",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Extension >9 m² SHON, surélévation, maison neuve",
      taux: "20%",
      conditions: "Considérée construction neuve",
    },
    {
      type: "Locaux commerciaux, fourniture seule",
      taux: "20%",
      conditions: "Travaux neufs ou hors particulier",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : assureur, n° de contrat, zone",
    "Étude de structure obligatoire par un bureau d'études pour toute ouverture de mur porteur",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Structurer le devis en lots clairs (terrassement, fondations, élévation, charpente, finitions) pour faciliter la lecture du client",
    "Détailler les quantités exactes en m², m³, mètres linéaires (parpaing, béton, ferraillage)",
    "Préciser les références matériaux (ex : « Parpaing creux 20×20×50 NF B40 », « Béton C25/30 XC1 dosé à 350 kg/m³ »)",
    "Pour une ouverture de mur porteur, mentionner l'étude de structure du BET (à charge du client ou intégrée) et joindre le rapport en annexe",
    "Pour une ITE en TVA 5,5%, indiquer la résistance thermique R atteinte (exigée pour le contrôle fiscal et MaPrimeRenov')",
    "Préciser l'évacuation des déchets (gravats, ferraille, terre excavée), la location de benne et les rotations",
    "Configurer dès le devis les situations de travaux : acompte 30% à la signature, situations intermédiaires aux étapes clés, solde à la réception",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat maçonnerie et gros œuvre",
    "Qualibat ITE (mention RGE possible)",
    "Qualibat ravalement",
    "RGE Eco-Artisan",
    "Qualibat patrimoine ancien (rénovation pierre)",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Montage mur parpaings 20×20×50 enduit ciment",
    "Coulage dalle béton armé sur terre-plein",
    "Ouverture mur porteur avec pose IPN et étude BET",
    "Construction extension plain-pied 30 m²",
    "Coulage terrasse béton désactivé sur dalle",
    "Chape liquide anhydrite 6 cm",
    "Fondations semelle filante béton armé",
    "Construction muret de clôture parpaing enduit",
    "Coulage escalier béton 14 marches",
    "Application enduit monocouche façade",
  ],

  // ─── H — FAQ étoffée (10 Q&R) ─────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un maçon en 2026 ?",
      answer:
        "Le bon logiciel devis maçon doit gérer les trois taux de TVA (5,5%, 10%, 20%), permettre de structurer les devis longs en sections (gros œuvre, second œuvre, finitions), gérer les situations de travaux pour les chantiers longs, injecter la mention décennale et vos qualifications Qualibat, et être compatible Factur-X dès le 1er septembre 2026. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple et largement adopté — voir [notre comparatif Tolteck](/blog/tolteck-avis) —, Obat (25-79€/mois) ajoute la signature électronique et BatiChiffrage, Henrri est gratuit mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question:
        "Comment facturer les situations de travaux sur un long chantier d'extension ?",
      answer:
        "Sur une extension de 3 à 6 mois, l'offre Complet de Nexartis (25€ HT/mois) gère un acompte à la signature (le standard en maçonnerie est 30%, parfois 40% sur gros chantiers), puis des situations de paiement aux étapes clés : fondations terminées, gros œuvre achevé, hors d'eau hors d'air, finitions. Le solde est calculé automatiquement à la réception. Chaque situation est rattachée au chantier d'origine pour conserver la traçabilité comptable. Vous gardez la vision globale (montant facturé / restant à facturer) directement depuis le tableau de bord du chantier.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis sont générées au format Factur-X (un PDF lisible avec un fichier XML structuré embarqué), conformes au standard européen EN 16931. Vous n'avez aucune manipulation à faire : le format s'applique par défaut dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment gérer un devis d'ouverture de mur porteur ?",
      answer:
        "L'ouverture d'un mur porteur nécessite une étude de structure préalable par un bureau d'études (BET) qui dimensionne l'IPN (matériau, hauteur, longueur, charges reprises) et définit la procédure d'étaiement. Dans Nexartis, vous créez une section dédiée « Étude structure + ouverture mur porteur + pose IPN » avec : étude BET, fourniture IPN, étaiement, démolition contrôlée, pose IPN, scellement, reprise de maçonnerie. Vous joignez le rapport BET au devis en pièce annexe. La TVA est généralement à 10% (logement de plus de 2 ans). Vos qualifications Qualibat apparaissent automatiquement en pied de devis pour rassurer le client.",
    },
    {
      question: "Quelle TVA pour une extension de maison ?",
      answer:
        "Une extension de moins de 9 m² SHON relève généralement de la TVA 10% (assimilée à un agrandissement d'amélioration de l'habitat). Au-delà de 9 m² SHON, ou si l'extension constitue une surélévation, elle est considérée comme construction neuve et passe en TVA 20%. La règle est appréciée chantier par chantier (selon les surfaces ajoutées, la nature des fondations, le raccordement aux réseaux). En cas de doute, mieux vaut consulter votre comptable. Dans Nexartis, vous appliquez le taux par ligne ou par section, et la mention TVA est tracée dans l'historique du devis.",
    },
    {
      question: "Comment chiffrer une ITE à 5,5% de TVA ?",
      answer:
        "Pour une isolation thermique par l'extérieur (ITE), le taux est de 5,5% à deux conditions cumulatives : être certifié RGE sur la qualification ITE concernée (par exemple Qualibat avec mention RGE) et intervenir dans un logement de plus de 2 ans. Vous renseignez la résistance thermique R atteinte dans la description (exigée pour le dossier MaPrimeRenov' du client). Dans Nexartis, vous cochez la case « conditions du taux réduit remplies » et la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025 est ajoutée automatiquement au pied du devis et de la facture.",
    },
    {
      question:
        "Comment intégrer la sous-traitance (BET, terrassier, ferrailleur) ?",
      answer:
        "Dans Nexartis, vous créez des lignes sous-traitance distinctes avec leur propre prix, leur propre taux de TVA et la mention du sous-traitant. Vous gardez une trace de chaque sous-traitant pour votre comptabilité, ce qui facilite ensuite le suivi des paiements croisés. Pour les gros chantiers, vous pouvez aussi rattacher chaque sous-traitant à l'historique du chantier (offre Complet à 25€ HT/mois) — utile en cas de SAV pour retrouver qui est intervenu sur quoi.",
    },
    {
      question: "Comment créer un devis structuré directement depuis le terrain ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil, sans navigateur. Le devis se crée en quelques tapotements, organisé en sections (gros œuvre, second œuvre, finitions), avec prestations depuis votre bibliothèque (parpaing, dalle, IPN, terrasse). Le client signe à l'écran, et le PDF est envoyé par email avec votre numéro de décennale et vos qualifications Qualibat automatiquement intégrés. La commande vocale (offre Complet à 25€ HT/mois) permet de dicter le métré depuis le chantier pour ne rien oublier sur le terrain — un brouillon rapide à compléter ensuite. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question:
        "Le logiciel intègre-t-il ma mention décennale et mes qualifications Qualibat ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (SMABTP, AXA, MAAF, MAF, etc.), votre numéro de contrat décennale, votre zone géographique de couverture, et vos qualifications Qualibat (maçonnerie générale, ITE, ravalement, patrimoine). Ces informations apparaissent automatiquement sur 100% de vos devis et factures, dans le pavé légal en pied de document, conformément à la loi Spinetta. Si vous renouvelez votre contrat ou ajoutez une nouvelle qualification, vous modifiez une seule fois et tous vos futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois ou Complet à 25€ HT/mois (planning, commande vocale, gestion d'équipe et situations de travaux inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-couvreur", label: "Logiciel pour couvreur" },
    { href: "/logiciel-devis-carreleur", label: "Logiciel pour carreleur (chape/sol)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
