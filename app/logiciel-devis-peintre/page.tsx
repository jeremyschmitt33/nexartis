import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis peintre — Nexartis dès 15€/mois",
  description:
    "Devis peinture au m² en 2 minutes. TVA 5,5/10/20% automatique, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-peintre",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Peintre",
  nomPluriel: "Peintres",
  icon: "🎨",
  h1: "Logiciel devis et factures pour peintres en bâtiment",
  metaTitle: "Logiciel devis peintre — Nexartis dès 15€/mois",
  metaDescription:
    "Devis peinture au m² en 2 minutes. TVA 5,5/10/20% automatique, mention décennale, Factur-X. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis peintre",

  tvaNotes:
    "TVA 5,5% ravalement avec ITE (RGE QualiBat 7131), 10% peinture intérieure et entretien logement >2 ans, 20% neuf",

  specificite:
    "Nexartis chiffre vos prestations au m² mur et plafond, applique le bon taux TVA peinture en deux clics, et intègre la mention décennale obligatoire sur tout ravalement avec étanchéité. Un devis ravalement complet prêt en moins de 2 minutes depuis le pied de l'échafaudage.",

  motsClesSecondaires: [
    "logiciel facture peinture",
    "application devis peintre bâtiment",
    "logiciel peintre auto-entrepreneur",
    "logiciel chiffrage peinture m2",
    "logiciel gestion peintre façade",
  ],

  // ─── A — Introduction longue (260-320 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis peintre** en 2026 demande de comprendre la réalité du métier. Vous chiffrez au mètre carré : mur, plafond, boiseries, façade. Vous différenciez une couche d'impression d'une couche de finition, vous intégrez le lessivage, la protection des sols, le rebouchage. Vous appliquez trois taux de TVA selon la nature des travaux : 5,5% sur le ravalement avec isolation thermique extérieure si vous êtes RGE QualiBat 7131, 10% sur la peinture intérieure en logement de plus de 2 ans, 20% sur le neuf. À cela s'ajoute la mention décennale obligatoire sur tout ravalement avec étanchéité (loi Spinetta), et l'arrivée de Factur-X qui impose le format électronique normalisé. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nDans le métier, beaucoup de peintres exercent en solo ou en TPE, souvent sous statut auto-entrepreneur. Vous passez de la rénovation intérieure d'un appartement le matin à un ravalement de copropriété l'après-midi, avec deux taux de TVA différents et deux types de garanties à mentionner. Vous gérez aussi la marque et la référence exacte de la peinture (Tollens, Zolpan, Sigma, Seigneurie) parce que les clients exigeants et les syndics demandent la traçabilité. La dernière chose dont vous avez besoin, c'est d'un outil pensé pour les grosses PME.\n\n**Nexartis** est conçu pour cette réalité d'artisan peintre : un logiciel français qui édite un devis conforme depuis le téléphone, calcule les m² intérieurs et extérieurs, applique automatiquement le bon taux TVA, injecte votre numéro de décennale, et intègre les mentions légales Factur-X 2026 sur vos factures. Nexartis démarre à **15€ HT/mois** Essentiel et 25€ HT/mois Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai 14 jours](/register) sans carte bancaire. Vous travaillez aussi avec un plaquiste sur les chantiers de rénovation lourde ? [Notre logiciel plaquiste](/logiciel-devis-plaquiste) couvre l'autre corps de métier dans le même esprit, et pour les chantiers de salle de bains, voyez aussi [notre logiciel carreleur](/logiciel-devis-carreleur).",

  // ─── B — Cas d'usage narratif (100-130 mots) ───────────────────────────
  casUsage: {
    titre: "Mardi 9h, pied d'immeuble, ravalement copropriété voté en AG",
    scene:
      "Le syndic vous a contacté la semaine dernière : la résolution de ravalement a été votée à l'AG du 14 mars, l'enveloppe est cadrée, le démarrage est prévu en juin. Vous arrivez au pied du bâtiment R+4 avec votre carnet et votre téléphone. Vous mesurez les façades, vous notez les zones avec armature fibre nécessaires, vous repérez les fissures de structure. Sur l'écran, vous saisissez : démontage volets, lavage haute pression 380 m², traitement anti-mousse, ravalement hydrofuge en deux couches, reprise des fissures à l'armature, échafaudage 3 mois. Vous appliquez 10% TVA sur l'entretien, vous découpez en trois tranches de facturation (acompte 30%, situation 40%, solde 30%), vous intégrez la mention décennale Spinetta. Le devis part au syndic par email l'après-midi, prêt à signer par le conseil syndical.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En peinture bâtiment, vous jonglez avec trois taux de TVA selon le type de chantier. La TVA à 5,5% s'applique au ravalement de façade qui inclut une isolation thermique par l'extérieur (ITE), à condition d'être certifié RGE QualiBat 7131 et d'intervenir dans un logement de plus de 2 ans. Sans ITE, le ravalement classique reste à 10%. La TVA à 10% couvre la majorité de votre activité : peinture intérieure d'un appartement, pose de papier peint intissé, laquage de boiseries existantes, ravalement de façade sans amélioration énergétique, traitement anti-humidité, lasure des boiseries extérieures. La condition reste la même : logement de plus de 2 ans. La TVA à 20% reste obligatoire sur le neuf, les locaux professionnels, les fournitures vendues seules sans pose (pots de peinture, papiers peints au mètre), et tout chantier d'extension ou de surélévation.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour les taux intermédiaire et réduit) a été supprimée. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, attestant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients, certificat RGE) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique pour vos archives. Côté **Factur-X**, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel — vos factures sont alignées sur la réforme française dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Peinture intérieure 2 couches, pose papier peint",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Ravalement de façade hydrofuge sans ITE",
      taux: "10%",
      conditions: "Logement >2 ans, travaux d'entretien",
    },
    {
      type: "Ravalement avec ITE (Isolation Thermique Extérieure)",
      taux: "5,5%",
      conditions: "RGE QualiBat 7131 + logement >2 ans",
    },
    {
      type: "Peinture sur construction neuve, local pro, extension",
      taux: "20%",
      conditions: "Travaux neufs ou non résidentiels",
    },
    {
      type: "Vente seule de peinture, papier peint, lasure",
      taux: "20%",
      conditions: "Fourniture sans pose associée",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout ravalement avec étanchéité (loi Spinetta) : nom assureur, n° contrat, zone géographique",
    "Auto-entrepreneur peintre : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (7) ────────────────────────────────────
  conseilsRedaction: [
    "Préciser la marque, la gamme et la référence exacte de la peinture (ex : « Tollens Pro Mat acrylique blanc cassé référence T1620 »)",
    "Différencier clairement nombre de couches : impression, couche intermédiaire, finition — au m² avec le rendement annoncé par le fabricant",
    "Détailler les préparations incluses : lessivage, rebouchage des trous, ponçage, dépose des plinthes, protection sol et mobilier en bâche",
    "Indiquer m² mur et m² plafond séparément, avec hauteur sous plafond, et signaler les m² supérieurs à 2,50 m qui imposent un échafaudage roulant",
    "Sur ravalement, mentionner l'échafaudage (location, montage, démontage) en ligne séparée, et préciser la durée prévue en mois",
    "Pour les boiseries et menuiseries, distinguer simple lasure, peinture glycéro, laque polyuréthane, et préciser le nombre de faces traitées",
    "Sur un chantier ITE, joindre l'attestation RGE QualiBat 7131 et préciser la résistance thermique R du complexe d'isolation posé",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 6111 — Peinture intérieure",
    "Qualibat 6112 — Revêtements muraux et papiers peints",
    "Qualibat 6121 — Peinture extérieure et ravalement",
    "Qualibat 7131 — Isolation thermique par l'extérieur (enduit mince sur isolant)",
    "RGE QualiBat (mention environnementale pour aides MaPrimeRenov')",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Peinture intérieure 2 couches acrylique au m² mur",
    "Ravalement de façade hydrofuge en deux couches",
    "Pose papier peint intissé au rouleau, raccord motif",
    "Laquage boiseries portes et plinthes polyuréthane",
    "ITE polystyrène expansé 14 cm avec enduit minéral",
    "Traitement anti-humidité murs intérieurs par injection",
    "Lasure boiseries extérieures (volets, bardage)",
    "Peinture sol garage époxy bi-composant",
    "Rénovation toile de verre maillage fin, mise en peinture",
    "Ravalement avec armature fibre sur fissures structurelles",
  ],

  // ─── H — FAQ étoffée (10 Q/R, ~80-150 mots chacune) ───────────────────
  faqCustom: [
    {
      question: "Quel est le bon logiciel devis pour un peintre en 2026 ?",
      answer:
        "Un logiciel devis peintre doit chiffrer au m² mur et plafond, gérer les trois taux de TVA peinture (5,5%, 10%, 20%), injecter la mention décennale obligatoire sur les ravalements avec étanchéité, et être compatible Factur-X dès l'échéance du 1er septembre 2026. Le marché propose plusieurs outils : Tolteck reste un choix simple et largement adopté, Obat ajoute la signature électronique — voir [notre avis Obat](/blog/obat-avis) —, Henrri reste gratuit mais n'est pas spécialisé BTP, et Sage Batigest cible plutôt les structures de plus de 10 salariés. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu pour les peintres solo et TPE.",
    },
    {
      question: "Comment chiffrer une prestation peinture au m² dans Nexartis ?",
      answer:
        "Dans Nexartis, chaque prestation de votre bibliothèque dispose d'une unité de vente paramétrable : m² mur, m² plafond, mètre linéaire de plinthe, pièce de menuiserie. Vous renseignez la surface depuis votre relevé chantier, le prix unitaire HT, le taux TVA par défaut, et le total se calcule automatiquement. Pour différencier couche d'impression et couche de finition, vous créez deux lignes distinctes. La hauteur sous plafond peut être notée en commentaire de ligne. Sur l'offre Complet à 25€ HT/mois, vous regroupez vos lignes en « packs » réutilisables — par exemple un pack « préparation mur intérieur » qui inclut lessivage, rebouchage, ponçage avec leurs m² respectifs.",
    },
    {
      question: "Comment gérer les 3 taux TVA peinture sans me tromper ?",
      answer:
        "Dans Nexartis, chaque ligne de devis dispose d'un menu déroulant pour choisir entre 5,5%, 10% et 20%, avec une info-bulle qui rappelle quel taux s'applique. Vous pouvez pré-configurer vos prestations récurrentes (peinture intérieure 2 couches, ravalement hydrofuge, ITE polystyrène) avec leur taux par défaut depuis la bibliothèque. La case « conditions du taux réduit remplies » ajoute la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025. Sur un chantier mixte (par exemple ITE à 5,5% + peinture intérieure connexe à 10%), le logiciel calcule séparément chaque sous-total TVA pour le récapitulatif en pied de devis. Cette gestion multi-taux est incluse dès l'offre Essentiel.",
    },
    {
      question: "Le logiciel est-il conforme à Factur-X 2026 ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les mentions légales Factur-X 2026 exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment chiffrer un ravalement de façade en copropriété ?",
      answer:
        "Dans Nexartis, vous créez un chantier dédié et vous y rattachez plusieurs documents : un devis initial pour le vote en assemblée générale, puis des factures de situation au fur et à mesure de l'avancement (montage échafaudage, lavage haute pression, première couche, finition). Vous appliquez 10% TVA si le ravalement est en entretien classique, 5,5% si vous intégrez une ITE avec votre certification RGE QualiBat 7131. La mention décennale Spinetta est injectée automatiquement sur la partie étanchéité de façade. La traçabilité est conservée chantier par chantier pour répondre aux demandes du syndic et du conseil syndical sur plusieurs années.",
    },
    {
      question: "Comment intégrer ma mention décennale automatiquement ?",
      answer:
        "Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (SMABTP, MAAF, AXA, Groupama, etc.), le numéro de contrat décennale, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta (étanchéité de façade, traitement structurel, ITE). Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois et reste figée sur les documents déjà émis.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes ?",
      answer:
        "Oui. Sur un ravalement de copropriété ou une rénovation complète d'appartement, vous facturez en plusieurs tranches : par exemple 30% à la signature du devis, 30% au démarrage des travaux, 30% à la fin de la première couche, 10% à la réception. Dans Nexartis, vous exigez un acompte à la signature du devis (vous fixez le pourcentage), puis vous créez plusieurs factures rattachées au chantier d'origine au fil de l'avancement, chacune pour la part déjà réalisée. La traçabilité comptable est conservée pour vos archives. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu.",
    },
    {
      question: "Comment créer un devis depuis le pied de l'échafaudage ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android, sans passer par les stores. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le logiciel devis peintre se crée en quelques tapotements : sélection du client (recherche par nom ou création rapide), saisie des prestations depuis votre bibliothèque (peinture m², ravalement, lessivage), validation. Le client signe avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré. L'ensemble fonctionne avec une connexion 4G faible et synchronise dès le retour en zone couverte. La commande vocale (offre Complet à 25€ HT/mois) permet de dicter le devis depuis la camionnette. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Comment gérer ma bibliothèque de prestations et marques de peinture ?",
      answer:
        "Nexartis intègre une bibliothèque de prestations personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, l'unité de vente (m², ml, pièce) et la marque-référence du produit (Tollens, Zolpan, Sigma, Seigneurie, Astral). L'offre Essentiel à 15€ HT/mois vous donne accès à des modèles génériques pré-remplis (peinture intérieure 2 couches, ravalement hydrofuge, pose papier peint) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fournisseur, regroupement en « packs » réutilisables (par exemple kit ITE complet avec RGE QualiBat 7131 appliqué automatiquement à 5,5%). Vous gagnez plusieurs heures par semaine sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer le SAV et la garantie après livraison ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, factures émises, photos avant-après prises sur le terrain, notes datées par intervention, marque et référence des produits posés. En cas de réclamation un an plus tard sur un voile bleu ou un cloquage de peinture, vous retrouvez en deux clics la date de pose, le lot de peinture utilisé, les conditions météo du jour (notées en commentaire si humidité ou froid), et l'historique des interventions. Vous créez ensuite un devis SAV rattaché au chantier d'origine pour conserver la traçabilité comptable (durée légale 5 ans). La décennale Spinetta sur étanchéité de façade reste tracée 10 ans côté assureur.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (devis et factures illimités, multi-TVA, mention décennale, Factur-X) ou Complet à 25€ HT/mois (planning, commande vocale, gestion équipe, chantiers). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter chaque devis et chaque facture au format PDF à tout moment. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
    {
      question: "Le logiciel convient-il à un peintre auto-entrepreneur ?",
      answer:
        "Oui, Nexartis est conçu pour les auto-entrepreneurs peintres dès l'offre Essentiel à 15€ HT/mois. La mention obligatoire de l'art. 293 B du CGI (« TVA non applicable, art. 293 B du CGI ») est ajoutée automatiquement sur vos devis et factures tant que vous êtes sous franchise, tolérance prolongée jusqu'au 31 décembre 2027. Les seuils 2026 sont surveillés en continu : 37 500€ pour les services (votre main d'œuvre peinture) et 85 000€ pour les ventes (fournitures que vous revendez). Vous êtes alerté à l'approche du seuil pour anticiper le passage à la TVA.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-plaquiste", label: "Logiciel pour plaquiste (second œuvre)" },
    { href: "/logiciel-devis-carreleur", label: "Logiciel pour carreleur (salle de bains)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
