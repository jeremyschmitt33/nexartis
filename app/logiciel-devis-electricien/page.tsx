import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis électricien — Nexartis dès 15€/mois",
  description:
    "Devis et factures électricien en 2 minutes. TVA 5,5/10/20% automatique, NF C 15-100, IRVE, photovoltaïque. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-electricien",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Électricien",
  nomPluriel: "Électriciens",
  icon: "⚡",
  h1: "Logiciel devis et factures pour électriciens",
  metaTitle: "Logiciel devis électricien — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures électricien en 2 minutes. TVA 5,5/10/20% automatique, NF C 15-100, IRVE, photovoltaïque. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis électricien",

  tvaNotes:
    "TVA 5,5% rénovation énergétique, 10% amélioration habitat >2 ans, 20% neuf",

  specificite:
    "Nexartis gère les 3 taux de TVA électricité, la mention NF C 15-100, l'attestation Consuel et permet de chiffrer une installation IRVE ou un tableau électrique depuis le terrain en moins de 2 minutes.",

  motsClesSecondaires: [
    "logiciel facture électricien",
    "application devis électricien",
    "logiciel électricien auto-entrepreneur",
    "logiciel chiffrage électricité",
    "logiciel gestion électricien",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis électricien** en 2026 ne se résume plus à éditer un PDF avec un total HT. Trois taux de TVA cohabitent en électricité : 5,5% pour la rénovation énergétique (photovoltaïque en autoconsommation, pompe à chaleur, isolation des circuits), 10% pour l'amélioration de l'habitat de plus de 2 ans (rénovation de tableau, mise aux normes NF C 15-100, pose de prises et VMC), 20% sur le neuf et les locaux professionnels. À cela s'ajoutent la mention décennale obligatoire, la fin de l'attestation TVA papier au 16 février 2025, l'attestation de conformité Consuel pour toute installation neuve, et l'arrivée de Factur-X qui imposera la facture électronique normalisée. Pour aller plus loin, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nLa réalité du métier en France : beaucoup d'électriciens exercent en TPE ou en solo, souvent sous statut auto-entrepreneur (source CAPEB). Vous intervenez sur des chantiers très variés dans la même semaine : un dépannage de tableau le lundi, une borne IRVE chez un particulier le mardi, un photovoltaïque en autoconsommation le mercredi, un câblage VDI le jeudi. Chaque chantier a son propre taux de TVA, ses propres mentions, ses propres pièces jointes (attestation RGE, qualification Qualifelec IRVE, Consuel). Un logiciel doit comprendre cette diversité, pas vous forcer à reprogrammer chaque devis comme si c'était le premier.\n\nNexartis a été conçu pour cette réalité : un logiciel français qui édite un devis conforme depuis votre téléphone, applique le bon taux de TVA en deux clics, injecte automatiquement votre numéro de décennale et la mention NF C 15-100, et vous prépare à la facturation électronique : réception des factures de vos fournisseurs (obligation au 1er septembre 2026) et émission des vôtres au format électronique (Factur-X, UBL ou CII) pour l'échéance qui vous concerne (à partir du 1er septembre 2027), via une plateforme agréée. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous êtes aussi chauffagiste ? [Notre logiciel chauffagiste](/logiciel-devis-chauffagiste) couvre les deux activités dans le même compte, et pour le second œuvre, voyez aussi [notre logiciel plaquiste](/logiciel-devis-plaquiste).",

  // ─── B — Cas d'usage narratif (80-120 mots) ────────────────────────────
  casUsage: {
    titre: "Mardi matin, devis pour installer une borne de recharge IRVE",
    scene:
      "Le client vient d'acheter une voiture électrique et vous appelle pour faire installer une borne chez lui. Vous passez le matin pour l'audit : tableau électrique vérifié, distance entre le tableau et le garage mesurée, type de raccordement noté, section de câble calculée. Pendant que vous remontez votre mètre, vous dictez le devis sur votre téléphone : audit installation existante, fourniture borne Schneider EVlink Smart 7 kW, ligne dédiée 32A, raccordement, mise en service, pose disjoncteur différentiel 30 mA type A. Vous précisez les références et les tarifs, le client signe avec son doigt sur l'écran. Votre mention « Installateur IRVE qualifié » s'affiche automatiquement en pied de devis. La facture suivra après la pose.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En électricité, vous jonglez avec trois taux de TVA selon le type de chantier. La TVA à 5,5% s'applique aux travaux de rénovation énergétique : pose de panneaux photovoltaïques en autoconsommation (≤ 36 kVA raccordés au réseau), installation de pompe à chaleur, raccordement électrique d'un système de chauffage renouvelable. Deux conditions doivent être réunies : être certifié RGE (QualiPV pour le photovoltaïque, QualiPAC si vous installez aussi la PAC), et intervenir dans un logement de plus de 2 ans. La TVA à 10% est votre taux le plus courant : rénovation de tableau électrique, mise aux normes NF C 15-100, pose de prises, interrupteurs, VMC, câblage RJ45, dépannage. La TVA à 20% reste obligatoire sur le neuf, les bureaux, les locaux commerciaux, et les fournitures vendues seules sans pose.\n\nDepuis le 16 février 2025, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis et à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs doivent être conservés cinq ans en cas de contrôle.\n\nDans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux est tracé dans l'historique pour vos archives. Côté Factur-X, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel à **15€ HT/mois** — vos factures sont alignées sur la réforme française dont le calendrier impose la réception le 1er septembre 2026 et l'émission le 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Rénovation tableau électrique, mise aux normes NF C 15-100",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Installation photovoltaïque autoconsommation ≤36 kVA",
      taux: "5,5%",
      conditions: "RGE QualiPV + logement >2 ans",
    },
    {
      type: "Pose borne de recharge IRVE chez particulier",
      taux: "5,5%",
      conditions: "Qualifelec IRVE + logement >2 ans (sinon 10%)",
    },
    {
      type: "Construction neuve, extension, locaux pro",
      taux: "20%",
      conditions: "Travaux neufs",
    },
    {
      type: "Dépannage, pose VMC, câblage RJ45",
      taux: "10%",
      conditions: "Logement >2 ans, amélioration habitat",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : assureur, n° de contrat, zone",
    "Qualifelec IRVE obligatoire pour toute borne de recharge >3,7 kW (décret du 12 janvier 2017)",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Préciser la marque et la référence du matériel (ex : « Tableau Legrand 13 modules ref. 401213 », « Borne Schneider EVlink Smart 7 kW »)",
    "Détailler la conformité NF C 15-100 quand elle s'applique : nombre de circuits, parafoudre, ETEL, GTL, DTI",
    "Pour une installation neuve, mentionner l'attestation Consuel obligatoire et son coût (souvent à charge du client)",
    "Sur une borne IRVE, indiquer la puissance (3,7 / 7 / 11 / 22 kW), le type de prise (Type 2), et votre qualification Qualifelec IRVE P1 ou P2",
    "Pour un photovoltaïque en autoconsommation, indiquer la puissance crête (en kWc), le nombre de panneaux, l'onduleur, et joindre votre attestation RGE QualiPV",
    "Séparer fourniture et main d'œuvre pour clarifier la facture et faciliter la lecture du client",
    "Indiquer les conditions de paiement : acompte à la signature (30% standard), échéance facture (30 jours), pénalités de retard",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualifelec",
    "Qualifelec IRVE (P1 / P2 / P3)",
    "RGE QualiPV",
    "Consuel (attestation conformité)",
    "Qualibat (mention RGE)",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Pose tableau électrique 13 modules avec parafoudre",
    "Mise en conformité NF C 15-100",
    "Installation borne de recharge IRVE 7 kW",
    "Pose éclairage LED encastré avec variateur",
    "Câblage VMC double flux",
    "Installation photovoltaïque autoconsommation 3 kWc",
    "Pose interphone vidéo couleur",
    "Mise à la terre complète d'un logement",
    "Tirage gaines RJ45 et coffret VDI",
    "Dépannage tableau électrique en urgence",
  ],

  // ─── H — FAQ étoffée (10 Q&R, ~700 mots cumulés) ──────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un électricien en 2026 ?",
      answer:
        "Le bon logiciel devis électricien doit gérer les trois taux de TVA (5,5%, 10%, 20%), injecter la mention décennale et NF C 15-100, être compatible Factur-X dès le 1er septembre 2026, et permettre de créer un devis depuis le terrain en moins de 2 minutes. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple et largement adopté, Obat (25-79€/mois) ajoute la signature électronique et BatiChiffrage — voir [notre avis Obat](/blog/obat-avis) —, Henrri est gratuit mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question: "Comment gérer les 3 taux TVA en électricité sans se tromper ?",
      answer:
        "Dans Nexartis, chaque ligne de devis a un menu déroulant pour choisir entre 5,5%, 10% et 20%, avec une info-bulle qui rappelle quel taux s'applique. Vous pouvez pré-configurer vos prestations récurrentes (pose tableau, IRVE, dépannage) avec leur taux par défaut depuis la bibliothèque. La case « conditions du taux réduit remplies » ajoute la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025. En cas de chantier mixte (par exemple photovoltaïque à 5,5% + rénovation tableau à 10%), le logiciel calcule séparément chaque sous-total TVA pour le récapitulatif en pied de devis. Vous évitez les erreurs de saisie qui peuvent vous coûter cher en cas de contrôle fiscal.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "La réception des factures électroniques de vos fournisseurs est déjà active dans Nexartis (obligation au 1er septembre 2026). L'émission de vos propres factures au format électronique (Factur-X) est prête pour l'échéance qui vous concerne, à partir du 1er septembre 2027. Nexartis passe par une plateforme agréée. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment chiffrer rapidement une borne IRVE depuis le terrain ?",
      answer:
        "Nexartis est une PWA installable sur iPhone et Android, sans passer par les stores. Depuis votre téléphone, vous créez le devis IRVE chez le client : sélection du client, ajout des prestations depuis votre bibliothèque (borne 7 kW, ligne dédiée, raccordement, mise en service), choix du taux de TVA (5,5% si logement de plus de 2 ans), validation. Le client signe à l'écran. Le PDF inclut automatiquement votre mention « Installateur Qualifelec IRVE » et votre numéro de qualification.",
    },
    {
      question:
        "Puis-je intégrer ma mention NF C 15-100 et ma décennale automatiquement ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : votre numéro de décennale, le nom de l'assureur (AXA, MAAF, SMABTP, etc.), votre zone géographique, et vos qualifications (Qualifelec, IRVE, RGE QualiPV). Ces informations apparaissent automatiquement sur 100% de vos devis et factures, dans le pavé légal en bas de document. Si vous renouvelez votre contrat ou ajoutez une nouvelle qualification, vous modifiez une seule fois et tous vos futurs documents se mettent à jour. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes ?",
      answer:
        "Oui. Dans Nexartis, vous pouvez exiger un acompte à la signature du devis (le standard en électricité est de 30%, mais vous fixez le pourcentage). Pour les gros chantiers (rénovation électrique complète, installation photovoltaïque), vous facturez ensuite par étapes en créant plusieurs factures rattachées au chantier d'origine, chacune pour la part déjà réalisée. Le solde restant à facturer est recalculé à chaque étape pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu.",
    },
    {
      question:
        "Comment gérer le photovoltaïque en autoconsommation et la TVA 5,5% ?",
      answer:
        "Pour un photovoltaïque en autoconsommation ≤ 36 kVA dans un logement de plus de 2 ans, le taux est de 5,5% si vous êtes certifié RGE QualiPV. Dans Nexartis, vous créez la prestation « Installation photovoltaïque 3 kWc » avec TVA 5,5% par défaut dans votre bibliothèque, vous joignez votre attestation RGE QualiPV au devis (depuis vos documents pré-enregistrés), et la mention obligatoire est ajoutée automatiquement en pied de document. Le client garde la pièce justificative pour ses propres archives et pour son dossier MaPrimeRenov' éventuel.",
    },
    {
      question: "Comment créer un devis depuis le chantier ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le devis se crée en quelques tapotements : client, prestations depuis votre bibliothèque (tableau, IRVE, dépannage), validation. Le client signe directement avec le doigt sur l'écran, et le PDF est envoyé par email avec votre numéro de décennale et la mention NF C 15-100 automatiquement intégrés. La commande vocale (offre Complet à 25€ HT/mois) vous permet de dicter le devis depuis le camion pour ne rien oublier sur le terrain — un brouillon rapide à compléter plus tard. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de prix matériel ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, et l'unité de vente (heure, mètre linéaire, pièce). L'offre Essentiel à 15€ HT/mois donne accès à des modèles génériques (pose tableau, dépannage, IRVE) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fournisseur, regroupement en « packs » réutilisables (par exemple : kit pose IRVE complet avec ligne dédiée, disjoncteur 30 mA type A, mise en service). Vous gagnez plusieurs heures par semaine sur les chantiers récurrents.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter chaque devis et chaque facture au format PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-chauffagiste", label: "Logiciel pour chauffagiste" },
    { href: "/logiciel-devis-plaquiste", label: "Logiciel pour plaquiste (second œuvre)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
