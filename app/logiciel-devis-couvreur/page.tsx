import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis couvreur — Nexartis dès 15€/mois",
  description:
    "Devis et factures couvreur en 2 minutes. TVA 5,5% isolation, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-couvreur",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Couvreur",
  nomPluriel: "Couvreurs",
  icon: "🏠",
  h1: "Logiciel devis et factures pour couvreurs",
  metaTitle: "Logiciel devis couvreur — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures couvreur en 2 minutes. TVA 5,5% isolation, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis couvreur",

  tvaNotes:
    "TVA 5,5% isolation combles et toiture, 10% rénovation toiture >2 ans, 20% neuf",

  specificite:
    "Nexartis gère les chantiers longs avec acompte et situations, applique la TVA 5,5% sur l'isolation des combles, injecte votre qualification Qualibat et votre décennale, et permet de chiffrer une réfection de toiture depuis le terrain.",

  motsClesSecondaires: [
    "logiciel facture couvreur",
    "application devis toiture",
    "logiciel couvreur auto-entrepreneur",
    "logiciel chiffrage couverture",
    "logiciel gestion couvreur zingueur",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis couvreur** en 2026 demande de regarder les vraies réalités du métier. Vous chiffrez à la fois des chantiers très courts (démoussage annuel, remplacement de quelques tuiles cassées après un orage) et des chantiers très longs (réfection complète d'une toiture de 3 à 6 mois avec charpente, couverture, isolation, zinguerie et finitions). Côté TVA, trois taux cohabitent : 5,5% pour l'isolation des combles et de la toiture éligible MaPrimeRenov' (résistance thermique minimale requise), 10% pour la rénovation classique d'une toiture dans un logement de plus de 2 ans, 20% sur le neuf. À cela s'ajoutent la mention décennale obligatoire (toute couverture entre dans le périmètre de la garantie décennale Spinetta), la fin de l'attestation TVA papier au 16 février 2025, et l'arrivée de Factur-X. Pour aller plus loin, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nLa réalité du métier en France : beaucoup de couvreurs exercent en TPE ou en solo, souvent sous statut auto-entrepreneur (source CAPEB). Vous travaillez en hauteur, sur l'échelle ou le toit, dans des conditions où sortir un ordinateur n'a aucun sens. Vous chiffrez sur place après avoir mesuré au télémètre laser, photographié les tuiles déplacées, vérifié l'état de la charpente, et noté la longueur des gouttières à remplacer. Le devis doit pouvoir être créé directement sur le téléphone, validé par le client dans la foulée, et transformé en facture après la fin du chantier — avec des situations intermédiaires sur les gros chantiers.\n\n[Nexartis](/register) a été conçu pour cette réalité : un logiciel français qui édite un devis conforme depuis votre téléphone, applique le bon taux de TVA en deux clics, injecte automatiquement votre qualification Qualibat et votre numéro de décennale, et prépare vos factures au format Factur-X. Vous comparez avec [notre comparatif Tolteck](/blog/tolteck-avis) ou [notre avis Obat](/blog/obat-avis) ? Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe, situations de travaux). Voir [nos tarifs détaillés](/tarifs) ou [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez avec un maçon ? [Notre logiciel maçon](/logiciel-devis-maconnerie) couvre les deux activités dans le même compte.",

  // ─── B — Cas d'usage narratif (80-120 mots) ────────────────────────────
  casUsage: {
    titre: "Septembre, démoussage et inspection annuelle de toiture",
    scene:
      "Le client a un contrat d'entretien annuel avec vous depuis trois ans. Vous arrivez à 9h, vous montez sur l'échelle, vous prenez quelques photos de l'état général : tapis de mousse côté nord, deux tuiles plates déplacées, gouttière encrassée. Pendant que vous redescendez, vous dictez le devis sur votre téléphone : démoussage haute pression de la toiture, traitement hydrofuge en deux passes, remplacement de 8 tuiles plates terre cuite, nettoyage des gouttières. La cliente signe sur l'écran depuis le jardin, sans attendre que vous ranges l'échelle. Le contrat reconductible est rattaché à son historique chantier. La facture est envoyée le soir même, payée par virement avant la fin de la semaine.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En couverture, vous jonglez avec trois taux de TVA selon la nature du chantier. La TVA à 5,5% s'applique aux travaux d'isolation thermique de la toiture et des combles éligibles à MaPrimeRenov' : isolation des combles perdus par soufflage (résistance thermique R ≥ 7 m².K/W exigée), isolation des rampants sous toiture (R ≥ 6 m².K/W exigée), sarking en rénovation. Deux conditions cumulatives : être certifié RGE (Eco-Artisan, QualiBat avec mention RGE, ou équivalent) et intervenir dans un logement de plus de 2 ans. La TVA à 10% est votre taux le plus courant : réfection de couverture tuile, ardoise, zinc ou bac acier sans isolation associée, démoussage, traitement hydrofuge, remplacement de gouttières, pose de Velux, charpente traditionnelle. La TVA à 20% reste obligatoire sur la construction neuve, les extensions, et les locaux commerciaux.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis et à la facture, indiquant que les conditions du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs doivent être conservés cinq ans en cas de contrôle fiscal.\n\nDans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique. Votre qualification Qualibat (couverture en matériaux régionaux, étanchéité, patrimoine) et votre numéro de décennale apparaissent aussi sur le devis et la facture — éléments incontournables sur ce type de chantier. Côté Factur-X, le format européen EN 16931 est activé par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures partent conformes à la réforme française dont le calendrier impose la réception le 1er septembre 2026 et l'émission le 1er septembre 2027 pour les TPE. Voir [nos tarifs détaillés](/tarifs).",

  tableauTva: [
    {
      type: "Isolation combles perdus (R ≥ 7 m².K/W)",
      taux: "5,5%",
      conditions: "RGE + logement >2 ans",
    },
    {
      type: "Isolation rampants sous toiture (R ≥ 6 m².K/W)",
      taux: "5,5%",
      conditions: "RGE + logement >2 ans",
    },
    {
      type: "Réfection toiture tuiles, ardoise, zinc",
      taux: "10%",
      conditions: "Logement >2 ans, sans isolation associée",
    },
    {
      type: "Démoussage, traitement hydrofuge, gouttières",
      taux: "10%",
      conditions: "Travaux d'entretien habitat",
    },
    {
      type: "Construction neuve, extension, locaux pro",
      taux: "20%",
      conditions: "Travaux neufs",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : assureur, n° de contrat, zone",
    "TVA 5,5% subordonnée à la qualification RGE et aux résistances thermiques minimales MaPrimeRenov'",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Détailler le métrage exact en m² ou en mètres linéaires (toiture, rampants, faîtage, gouttière)",
    "Préciser la marque et la référence des matériaux (ex : « Tuile plate terre cuite Imerys Beauvoise rouge nuancé »)",
    "Pour une isolation, indiquer obligatoirement la résistance thermique R atteinte (exigée pour la TVA 5,5% et MaPrimeRenov')",
    "Mentionner la mise en sécurité du chantier : échafaudage (location + montage/démontage), filets de protection, lignes de vie",
    "Pour un chantier long, structurer le devis en lots clairs (charpente, couverture, zinguerie, isolation, finitions) et configurer les situations de travaux",
    "Préciser la gestion des déchets : évacuation, location de benne, tri sélectif tuiles/bois/zinc",
    "Indiquer les conditions de paiement : acompte 30% à la signature, situations intermédiaires, solde à la réception, pénalités de retard",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat couverture en matériaux régionaux",
    "Qualibat étanchéité (toitures-terrasses)",
    "Qualibat patrimoine ancien",
    "RGE Eco-Artisan",
    "RGE QualiPV (photovoltaïque intégré toiture)",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Réfection complète toiture tuiles plates terre cuite",
    "Isolation combles perdus par soufflage ouate cellulose",
    "Pose couverture ardoise naturelle",
    "Pose zinc joint debout",
    "Démoussage haute pression et traitement hydrofuge",
    "Pose gouttières aluminium laquées",
    "Installation fenêtre de toit Velux double vitrage",
    "Étanchéité toiture-terrasse bicouche",
    "Réfection charpente bois traditionnelle",
    "Pose photovoltaïque intégré à la toiture",
  ],

  // ─── H — FAQ étoffée (10 Q&R) ─────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un couvreur en 2026 ?",
      answer:
        "Le bon logiciel devis couvreur doit gérer les trois taux de TVA (5,5%, 10%, 20%), permettre de structurer les chantiers longs en situations de travaux, injecter la mention décennale et vos qualifications Qualibat, et être compatible Factur-X dès le 1er septembre 2026. Le marché propose plusieurs options : [notre comparatif Tolteck](/blog/tolteck-avis) (19-25€/mois) reste simple et largement adopté, [notre avis Obat](/blog/obat-avis) (25-79€/mois) ajoute la signature électronique et BatiChiffrage, [Henrri est gratuit](/blog/henrri-avis) mais n'est pas spécifique BTP, et [Sage Batigest pour PME](/blog/batigest-avis) cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu pour les artisans solo et auto-entrepreneurs. Voir [nos tarifs détaillés](/tarifs).",
    },
    {
      question: "Comment facturer une isolation des combles à 5,5% de TVA ?",
      answer:
        "Dans Nexartis, vous sélectionnez le taux 5,5% sur la ligne « Isolation combles » à condition que la résistance thermique atteinte soit ≥ 7 m².K/W (combles perdus) ou ≥ 6 m².K/W (rampants), que le logement ait plus de 2 ans, et que vous soyez certifié RGE. Vous renseignez la valeur R atteinte directement dans la description de la prestation (exigée pour le contrôle fiscal et pour le dossier MaPrimeRenov' du client). La case « conditions du taux réduit remplies » ajoute la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis sont générées au format Factur-X (un PDF lisible avec un fichier XML structuré embarqué), conformes au standard européen EN 16931. Vous n'avez aucune manipulation à faire : le format s'applique par défaut dès l'offre Essentiel à 15€ HT/mois. Plus de détails sur [notre guide logiciel devis factures BTP](/logiciel-devis-factures).",
    },
    {
      question:
        "Comment gérer un chantier de réfection de toiture sur plusieurs mois ?",
      answer:
        "Sur une réfection de 3 à 6 mois (charpente + couverture + zinguerie + isolation), l'offre Complet de Nexartis (25€ HT/mois) gère un acompte à la signature, des situations de travaux aux étapes clés (démontage, charpente, couverture, zinguerie, finitions), et un solde calculé automatiquement à la réception. Chaque situation est rattachée au chantier d'origine pour conserver la traçabilité comptable. Vous gardez la vision globale (montant facturé / restant à facturer) directement depuis le tableau de bord du chantier, et chaque facture émise reprend les mentions légales obligatoires (décennale, qualifications, conditions de paiement).",
    },
    {
      question: "Comment facturer un démoussage annuel avec contrat reconductible ?",
      answer:
        "Le démoussage et traitement hydrofuge bénéficient de la TVA à 10% en rénovation logement de plus de 2 ans. Sur l'offre Complet de Nexartis (25€ HT/mois), vous créez une prestation type « Démoussage toiture + traitement hydrofuge » avec un contrat récurrent (annuel ou trisannuel selon les recommandations), et le logiciel génère automatiquement le devis et la facture chaque année à l'échéance, avec rappel client par email. Vous gardez l'historique complet de chaque intervention dans le dossier client.",
    },
    {
      question: "Puis-je intégrer du photovoltaïque dans mes devis couvreur ?",
      answer:
        "Oui. Pour un photovoltaïque intégré à la toiture (remplacement de couverture par des modules PV en toiture), vous créez une ligne dédiée avec votre qualification RGE QualiPV et le taux de TVA approprié (5,5% pour autoconsommation ≤ 36 kVA dans un logement de plus de 2 ans). Dans Nexartis, votre attestation RGE QualiPV est jointe automatiquement au devis depuis vos documents pré-enregistrés. Le client garde cette pièce justificative pour son dossier MaPrimeRenov' et la prime à l'autoconsommation.",
    },
    {
      question: "Comment chiffrer une toiture depuis l'échelle, sur le terrain ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil, sans navigateur. Le devis se crée en quelques tapotements : client, prestations depuis votre bibliothèque (démoussage, réfection partielle, isolation), saisie du métrage relevé, validation. Le client signe à l'écran avec le doigt, et le PDF est envoyé par email avec votre numéro de décennale et vos qualifications automatiquement intégrés. La commande vocale (offre Complet à 25€ HT/mois) permet de dicter le devis pour ne rien oublier sur le terrain — un brouillon rapide à compléter ensuite. Voir aussi [notre logiciel maçon](/logiciel-devis-maconnerie) ou [notre logiciel chauffagiste](/logiciel-devis-chauffagiste).",
    },
    {
      question:
        "Le logiciel intègre-t-il ma mention décennale et mes qualifications Qualibat ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, MAF, etc.), votre numéro de contrat décennale, votre zone géographique, et vos qualifications Qualibat (couverture en matériaux régionaux, étanchéité, patrimoine ancien) avec leurs dates de validité. Ces informations apparaissent automatiquement sur 100% de vos devis et factures, dans le pavé légal en pied de document. Si vous renouvelez votre contrat ou ajoutez une nouvelle qualification, vous modifiez une seule fois et tous vos futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question:
        "Le logiciel gère-t-il les chantiers en intempéries et les retards justifiés ?",
      answer:
        "Sur l'offre Complet de Nexartis (25€ HT/mois), chaque chantier conserve un journal avec ses interventions datées (vous notez « chantier arrêté pour pluie » ou « reprise après gel ») et les photos prises depuis le terrain. Si un litige naît plus tard sur les délais, vous retrouvez en deux clics le journal du chantier, prouvant le motif des retards. Le planning intègre les jours d'intempéries pour décaler automatiquement les interventions suivantes, et le client est notifié si la date de fin évolue. Cette traçabilité est utile pour le SAV et pour vos archives.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois ou Complet à 25€ HT/mois (planning, commande vocale, gestion d'équipe et situations de travaux inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [démarrer l'essai gratuit](/register) en moins de 2 minutes ou consulter [nos tarifs détaillés](/tarifs) avant de vous décider.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-maconnerie", label: "Logiciel pour maçon" },
    { href: "/logiciel-devis-chauffagiste", label: "Logiciel pour chauffagiste" },
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
