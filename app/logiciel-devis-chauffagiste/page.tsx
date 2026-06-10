import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis chauffagiste — Nexartis dès 15€/mois",
  description:
    "Devis et factures chauffagiste en 2 minutes. TVA 5,5% PAC, mention RGE QualiPAC, MaPrimeRenov'. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-chauffagiste",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Chauffagiste",
  nomPluriel: "Chauffagistes",
  icon: "🔥",
  h1: "Logiciel devis et factures pour chauffagistes",
  metaTitle: "Logiciel devis chauffagiste — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures chauffagiste en 2 minutes. TVA 5,5% PAC, mention RGE QualiPAC, MaPrimeRenov'. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis chauffagiste",

  tvaNotes:
    "TVA 5,5% rénovation énergétique (PAC, chaudière condensation, granulés), 10% entretien, 20% neuf",

  specificite:
    "Nexartis applique la TVA 5,5% automatiquement sur les équipements RGE, injecte votre qualification QualiPAC ou QualiBois sur le devis, et joint l'attestation indispensable au dossier MaPrimeRenov' du client.",

  motsClesSecondaires: [
    "logiciel facture chauffagiste",
    "application devis chauffage",
    "logiciel chauffagiste auto-entrepreneur",
    "devis pompe à chaleur logiciel",
    "logiciel gestion chauffage RGE",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis chauffagiste** en 2026 prend une importance particulière. Le marché bascule massivement vers la rénovation énergétique : pompes à chaleur air-eau qui remplacent les chaudières fioul, chaudières à granulés bois, chauffe-eau thermodynamiques, le tout porté par MaPrimeRenov' et les CEE. Chaque chantier subventionné impose des règles précises : TVA 5,5%, qualification RGE QualiPAC ou QualiBois en cours de validité, équipement éligible (COP, ETAS, rendement), logement de plus de 2 ans, et une attestation à joindre au devis pour le dossier d'aide du client. Une erreur sur une de ces lignes, et c'est tout le dossier qui est rejeté. Pour aller plus loin, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nLa réalité du métier : beaucoup de chauffagistes exercent en TPE ou en solo, souvent sous statut auto-entrepreneur (source CAPEB). Vous gérez des chantiers très différents dans la même semaine : un dépannage de chaudière le lundi, un entretien annuel le mardi, un devis PAC pour MaPrimeRenov' le mercredi, une intervention gaz le jeudi. Chacun a son propre taux de TVA, sa propre qualification à présenter, ses propres mentions. Vous intervenez aussi en astreinte l'hiver, le soir, le week-end, sur des pannes urgentes. Un logiciel doit suivre ce rythme — pas vous obliger à rentrer le saisir le lendemain au bureau.\n\nNexartis a été conçu pour cette réalité : un logiciel français qui édite un devis conforme depuis votre téléphone, applique le bon taux de TVA en deux clics, injecte automatiquement votre qualification RGE et votre numéro de décennale, et intègre les mentions légales Factur-X 2026 sur vos factures. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe, contrats d'entretien récurrents). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous êtes aussi plombier ? [Notre logiciel plombier](/logiciel-devis-plombier) couvre les deux activités dans le même compte, et pour les chantiers de toiture-zinguerie, voyez [notre logiciel couvreur](/logiciel-devis-couvreur).",

  // ─── B — Cas d'usage narratif (80-120 mots) ────────────────────────────
  casUsage: {
    titre: "Octobre, pose pompe à chaleur avec MaPrimeRenov'",
    scene:
      "Le client veut remplacer sa chaudière fioul vieillissante par une pompe à chaleur air-eau. Vous passez sur place pour le diagnostic : pièce technique mesurée, niveau d'isolation observé, tableau électrique vérifié, longueur du circuit de chauffage relevée. Pendant que vous remontez la voiture, vous dictez le devis sur votre téléphone : dépose de la chaudière fioul, fourniture et pose d'une PAC Atlantic Alféa Excellia 11 kW, dépose cuve fioul, raccordements hydrauliques, mise en service, attestation RGE QualiPAC. La TVA à 5,5% s'applique automatiquement. Le client signe sur l'écran depuis son salon, reçoit le PDF avec l'attestation RGE en pièce jointe — indispensable pour son dossier MaPrimeRenov'.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En chauffage, vous jonglez avec trois taux de TVA selon la nature du chantier. La TVA à 5,5% s'applique aux équipements de rénovation énergétique éligibles : pompe à chaleur air-eau ou géothermique respectant les critères MaPrimeRenov' (COP minimum requis), chaudière à condensation très haute performance (ETAS ≥ 92%), chaudière à granulés bois, chauffe-eau thermodynamique, chauffe-eau solaire individuel, poêle à granulés conforme (rendement ≥ 87%, émissions CO ≤ 0,12%). Deux conditions cumulatives : être certifié RGE (QualiPAC pour les pompes à chaleur, QualiBois Eau ou QualiBois Air pour le bois, Chauffage+ pour les chaudières) et intervenir dans un logement de plus de 2 ans. La TVA à 10% s'applique à l'entretien annuel, au dépannage, à la rénovation classique non éligible. La TVA à 20% reste obligatoire sur le neuf, les locaux commerciaux et la fourniture seule.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis et à la facture, indiquant que les conditions du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs doivent être conservés cinq ans en cas de contrôle fiscal.\n\nDans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux est tracé dans l'historique. Votre qualification RGE et sa date de validité apparaissent aussi sur le devis et la facture — éléments indispensables au client pour monter son dossier MaPrimeRenov' ou CEE. Côté Factur-X, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures sont alignées sur la réforme française dont le calendrier impose la réception le 1er septembre 2026 et l'émission le 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "PAC air-eau, géothermique, chaudière granulés",
      taux: "5,5%",
      conditions: "RGE QualiPAC / QualiBois + logement >2 ans",
    },
    {
      type: "Chaudière gaz à condensation haute performance (ETAS ≥92%)",
      taux: "5,5%",
      conditions: "RGE Chauffage+ + logement >2 ans",
    },
    {
      type: "Entretien annuel chaudière, dépannage",
      taux: "10%",
      conditions: "Travaux d'entretien habitat",
    },
    {
      type: "Climatisation simple (non réversible éligible)",
      taux: "10%",
      conditions: "Logement >2 ans, rénovation classique",
    },
    {
      type: "Installation neuve, locaux pro, fourniture seule",
      taux: "20%",
      conditions: "Travaux neufs",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "RGE QualiPAC obligatoire pour la TVA 5,5% sur PAC et pour l'éligibilité MaPrimeRenov'",
    "Qualification PG (Professionnel Gaz) obligatoire pour intervenir sur installations gaz domestiques",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Préciser la marque, le modèle ET la référence de l'équipement (ex : « PAC Atlantic Alféa Excellia A.I. 11 kW référence 526163 »)",
    "Indiquer les caractéristiques techniques utiles à MaPrimeRenov' : COP, ETAS, classe énergétique, rendement",
    "Mentionner explicitement votre qualification RGE en cours de validité (numéro + date d'expiration) sur le devis",
    "Joindre l'attestation RGE au PDF du devis — c'est ce que le client transmet à son dossier MaPrimeRenov'",
    "Préciser si la dépose de l'ancien équipement (chaudière fioul, cuve) est incluse, et le coût d'évacuation",
    "Détailler les conditions de paiement : acompte 30% à la signature, échéance 30 jours après facturation, taux de pénalités",
    "Pour un contrat d'entretien, indiquer la fréquence (annuelle), les prestations incluses, le préavis de résiliation",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "RGE QualiPAC",
    "RGE QualiBois (Eau / Air)",
    "RGE Chauffage+",
    "PG (Professionnel Gaz : PGI / PGM / PGIM)",
    "Qualibat (mention RGE)",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Installation pompe à chaleur air-eau 11 kW",
    "Remplacement chaudière gaz à condensation",
    "Pose chaudière à granulés bois",
    "Installation climatisation split réversible",
    "Entretien annuel chaudière gaz",
    "Désembouage réseau plancher chauffant",
    "Pose poêle à granulés étanche",
    "Installation plancher chauffant basse température",
    "Diagnostic et mise en service PAC",
    "Mise en sécurité gaz",
  ],

  // ─── H — FAQ étoffée (10 Q&R) ─────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un chauffagiste en 2026 ?",
      answer:
        "Le bon logiciel devis chauffagiste doit gérer la TVA 5,5% automatiquement sur les équipements RGE, injecter votre qualification QualiPAC ou QualiBois, joindre l'attestation au devis pour le dossier MaPrimeRenov' du client, et être compatible Factur-X dès le 1er septembre 2026. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple et largement adopté, Obat (25-79€/mois) ajoute la signature électronique et BatiChiffrage, Henrri est gratuit — voir [notre avis Henrri](/blog/henrri-avis) — mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question: "Comment facturer une pompe à chaleur à 5,5% de TVA sans risque ?",
      answer:
        "Dans Nexartis, vous sélectionnez le taux 5,5% sur la ligne PAC, à condition que l'équipement respecte les critères MaPrimeRenov' (COP minimum) et que le logement ait plus de 2 ans. La case « conditions du taux réduit remplies » ajoute la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025. Votre numéro RGE QualiPAC apparaît automatiquement en pied de devis. En cas de chantier mixte (PAC à 5,5% + travaux connexes à 10%), le logiciel calcule séparément chaque sous-total TVA pour le récapitulatif.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les mentions légales Factur-X 2026 exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment gérer les contrats d'entretien annuel de chaudière ?",
      answer:
        "Sur l'offre Complet de Nexartis (25€ HT/mois), vous créez un devis-contrat annuel une seule fois (entretien chaudière + visite obligatoire), puis le logiciel génère automatiquement la facture chaque année à l'échéance, envoie un rappel au client par email, et trace l'historique des interventions. Vous gardez la traçabilité comptable nécessaire en cas de contrôle, et le client conserve la preuve de son entretien annuel obligatoire (depuis le décret du 9 juin 2009 pour les chaudières de 4 à 400 kW).",
    },
    {
      question:
        "Comment facturer une intervention de dépannage chaudière en astreinte le week-end ?",
      answer:
        "Vous créez une intervention express dans Nexartis avec des majorations pré-configurées dans votre bibliothèque : par exemple +50% le week-end, +100% la nuit, +20% jours fériés. Le devis est signé sur place avec le doigt sur l'écran et transformé en facture immédiatement, avec un lien de paiement Stripe envoyé par email. Le client règle en CB depuis son téléphone avant que vous soyez rentré chez vous.",
    },
    {
      question: "Quelle TVA pour un poêle à granulés bois ?",
      answer:
        "Le poêle à granulés bénéficie de la TVA à 5,5% en rénovation énergétique, à deux conditions cumulatives : l'équipement respecte les critères techniques (rendement ≥ 87%, émissions CO ≤ 0,12%, taux de poussières ≤ 30 mg/Nm³) et le logement a plus de 2 ans, et vous êtes certifié RGE QualiBois Air. Si une de ces conditions manque (logement neuf, qualification absente), c'est 10% en rénovation classique ou 20% en neuf. Dans Nexartis, vous pré-enregistrez le poêle avec son taux par défaut dans votre bibliothèque pour ne plus avoir à y penser.",
    },
    {
      question:
        "Le logiciel intègre-t-il ma qualification RGE QualiPAC automatiquement ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : votre numéro RGE QualiPAC, QualiBois ou Chauffage+, votre date de validité, et l'organisme certificateur (Qualit'EnR, Qualibat). Ces informations apparaissent automatiquement sur 100% de vos devis et factures, dans le pavé légal en pied de document. Si votre certification est renouvelée, vous modifiez une seule fois la date et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois, et c'est ce que le client transmet à son dossier MaPrimeRenov'.",
    },
    {
      question: "Comment créer un devis PAC depuis le terrain en quelques minutes ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil, sans navigateur. Le devis PAC se crée en quelques tapotements : client (recherche par nom), prestations depuis votre bibliothèque (dépose chaudière fioul, fourniture PAC, raccordements, mise en service), validation. Le client signe à l'écran avec le doigt, et le PDF est envoyé par email avec votre attestation RGE QualiPAC en pièce jointe. La commande vocale (offre Complet à 25€ HT/mois) permet de dicter le devis depuis le camion pour ne rien oublier sur le terrain — un brouillon rapide à compléter ensuite. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Le logiciel gère-t-il les acomptes ?",
      answer:
        "Oui. Dans Nexartis, vous pouvez exiger un acompte à la signature du devis (le standard en chauffage est de 30%, parfois 40% pour une PAC, mais vous fixez le pourcentage). Pour les gros chantiers (PAC + ECS, chaudière granulés avec silo), vous facturez ensuite par étapes en créant plusieurs factures rattachées au chantier d'origine, chacune pour la part déjà réalisée. Le solde restant à facturer est recalculé à chaque étape pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois ou Complet à 25€ HT/mois (planning, commande vocale, gestion d'équipe et contrats d'entretien récurrents inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter chaque devis et chaque facture au format PDF à tout moment. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-plombier", label: "Logiciel pour plombier" },
    { href: "/logiciel-devis-couvreur", label: "Logiciel pour couvreur" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
