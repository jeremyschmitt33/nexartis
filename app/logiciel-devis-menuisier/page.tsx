import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis menuisier — Nexartis dès 15€/mois",
  description:
    "Devis et factures menuiserie en 2 minutes. TVA 5,5/10/20%, fourniture/pose séparées, RGE Qualibat. Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-menuisier",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Menuisier",
  nomPluriel: "Menuisiers",
  icon: "🪚",
  h1: "Logiciel devis et factures pour menuisiers",
  metaTitle: "Logiciel devis menuisier — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures menuiserie en 2 minutes. TVA 5,5/10/20%, fourniture/pose séparées, RGE Qualibat. Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis menuisier",

  tvaNotes:
    "TVA 5,5% menuiseries extérieures RGE, 10% rénovation intérieure, 20% neuf ou fourniture seule",

  specificite:
    "Nexartis sépare automatiquement la fourniture et la pose sur chaque ligne de devis menuisier, applique le bon taux de TVA, et injecte vos certifications RGE Qualibat ainsi que votre mention décennale conformément à la loi Spinetta sur l'étanchéité des menuiseries extérieures.",

  motsClesSecondaires: [
    "logiciel facture menuiserie",
    "application devis menuisier",
    "logiciel menuisier auto-entrepreneur",
    "logiciel chiffrage menuiserie",
    "logiciel gestion menuisier",
  ],

  // ─── A — Introduction longue (260-320 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis menuisier** en 2026 n'a rien d'un détail. La menuiserie est l'un des métiers du bâtiment où la facturation est la plus piégeuse : trois taux de TVA cohabitent (5,5% sur les menuiseries extérieures à performance énergétique en rénovation, 10% sur les menuiseries intérieures rénovées dans un logement de plus de 2 ans, 20% sur le neuf et la fourniture seule), la séparation fourniture/pose doit apparaître clairement sur chaque ligne, et la mention décennale au titre de la loi Spinetta est obligatoire sur tout devis et toute facture portant sur l'étanchéité d'une menuiserie extérieure. À cela s'ajoute la fin de l'attestation TVA papier au 16 février 2025 et l'arrivée prochaine de Factur-X. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr, dans le métier, beaucoup de menuisiers exercent en TPE ou en auto-entrepreneur, en posant chez le particulier ou en atelier. Le rendez-vous chez le client dure une heure : prise de cotes, choix du matériau (PVC, bois, alu), du vitrage, du classement AEV, des coloris. Le devis doit suivre immédiatement, car la concurrence chiffre vite, et un dossier MaPrimeRenov' dépend souvent de la rapidité. La dernière chose dont vous avez envie en rentrant à l'atelier, c'est de devoir ressaisir vos notes papier sur un ordinateur. Le métier se joue sur le terrain, sur le téléphone — pas le lendemain au bureau, comme le supposent les solutions PME.\n\n**Nexartis** a été conçu pour cette réalité d'artisan : un logiciel français pensé pour les menuisiers, qui édite un devis conforme depuis votre téléphone, sépare fourniture et pose sur chaque ligne, applique le bon taux de TVA en deux clics, injecte automatiquement votre numéro de décennale et votre RGE Qualibat 3713, et vous prépare à la facturation électronique : réception des factures de vos fournisseurs (obligation au 1er septembre 2026) et émission des vôtres au format électronique (Factur-X, UBL ou CII) pour l'échéance qui vous concerne (à partir du 1er septembre 2027), via une plateforme agréée sans manipulation. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez aussi avec un vitrier ou un serrurier (portes d'entrée blindées) ? Consultez [notre logiciel vitrier](/logiciel-devis-vitrier) et [notre logiciel serrurier](/logiciel-devis-serrurier).",

  // ─── B — Cas d'usage narratif (100-130 mots) ───────────────────────────
  casUsage: {
    titre: "Mardi 10h, remplacement de 6 fenêtres avec MaPrimeRenov'",
    scene:
      "Le client a une maison de 1985, fenêtres simple vitrage qui sifflent l'hiver. Vous arrivez sur place avec le mètre laser et l'iPhone. En une heure, vous prenez les 6 cotes, vous photographiez les ouvertures existantes, vous discutez du choix PVC blanc Tryba avec vitrage Uw 1,3 W/m²K et classement AEV A4 E9 VA3. Vous dictez vocalement chaque ligne : dépose ancienne menuiserie incluse, fourniture du chassis, pose, raccord plâtre intérieur, finition silicone extérieur. Le logiciel applique la TVA 5,5% car vous êtes RGE Qualibat 3713 et le logement a plus de 2 ans, puis ajoute la mention attestation depuis le 16 février 2025. Le devis part avant que vous soyez rentré à l'atelier, prêt pour le dossier MaPrimeRenov' de votre cliente.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En menuiserie, vous jonglez avec trois taux de TVA selon le type de chantier et la nature du produit posé. La TVA à 5,5% s'applique aux menuiseries extérieures à performance énergétique renforcée installées en rénovation : fenêtres, portes-fenêtres, baies vitrées avec coefficient Uw ≤ 1,3 W/m²K en PVC, Uw ≤ 1,5 en bois ou alu. Trois conditions doivent être réunies : être certifié RGE Qualibat 3713 (PVC), 3712 (bois) ou 3714 (alu) selon le matériau posé, intervenir dans un logement de plus de 2 ans, et fournir la mention attestation sur le devis. La TVA à 10% couvre les menuiseries intérieures en rénovation : placards intégrés, escaliers bois, portes intérieures, parquet, lambris, plinthes, dressings, dans un logement de plus de 2 ans. La TVA à 20% reste obligatoire sur le neuf, les extensions, le mobilier sur mesure isolé, et toute fourniture vendue sans pose intégrée.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour le taux intermédiaire et le taux réduit) a été officiellement supprimée. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients, attestation RGE en cours de validité au jour de la facturation) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Côté **Factur-X**, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel — vos factures sont alignées sur la réforme française dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Pose fenêtre PVC double vitrage Uw 1,3",
      taux: "5,5%",
      conditions: "RGE Qualibat 3713 + logement >2 ans",
    },
    {
      type: "Pose porte intérieure, placard sur mesure",
      taux: "10%",
      conditions: "Logement >2 ans, rénovation",
    },
    {
      type: "Pose parquet massif chêne en rénovation",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Construction neuve, extension, baie en agrandissement",
      taux: "20%",
      conditions: "Travaux neufs ou surface créée",
    },
    {
      type: "Fenêtre vendue seule sans pose, mobilier livré",
      taux: "20%",
      conditions: "Fourniture sans pose intégrée",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) pour l'étanchéité des menuiseries extérieures",
    "Auto-entrepreneur menuisier : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (7) ────────────────────────────────────
  conseilsRedaction: [
    "Préciser le coefficient Uw (W/m²K) du vitrage et le matériau exact du dormant (PVC, bois exotique, alu rupture pont thermique) pour justifier le taux 5,5%",
    "Indiquer la marque et la référence du chassis posé (Tryba, K-Line, Schüco, Internorm, Bieber, Velux pour les fenêtres de toit) afin de sécuriser le SAV à 10 ans",
    "Mentionner le classement AEV (Air-Eau-Vent), au minimum A4 E9 VA3 sur les fenêtres extérieures, et l'avis technique CSTB quand le produit en dispose",
    "Préciser le type de vitrage : double vitrage 4/16/4 argon, triple vitrage, vitrage de sécurité 44.2, vitrage acoustique, vitrage retardateur d'effraction",
    "Donner les dimensions exactes (largeur × hauteur tableau) de chaque ouverture, et préciser si vous prenez les cotes finies ou tableau",
    "Indiquer explicitement si la dépose de l'ancienne menuiserie est incluse, et à quel coût, en distinguant évacuation déchetterie et reprise pose seule",
    "Détailler les raccords plâtre, les rejingots, les bavettes alu, les habillages bois et la finition silicone, qui sont les sources de litiges les plus fréquentes en menuiserie",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat — Menuiseries extérieures bois",
    "Qualibat — Menuiseries extérieures PVC",
    "Qualibat — Menuiseries extérieures aluminium",
    "RGE Qualibat (mention RGE pour TVA 5,5% et MaPrimeRenov')",
    "FFB Union des Métiers du Bois (adhésion professionnelle)",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Pose fenêtre PVC double vitrage Uw 1,3 avec dépose ancienne",
    "Fabrication escalier bois massif chêne sur mesure 14 marches",
    "Pose porte d'entrée blindée 3 points avec serrure A2P",
    "Pose baie vitrée alu coulissante 4 vantaux 4m linéaires",
    "Aménagement placard sur mesure portes coulissantes miroir",
    "Pose parquet massif chêne 21mm collé sur ragréage existant",
    "Pose porte intérieure prépeinte avec habillage 90×210",
    "Pose volet roulant motorisé filaire ou radio Somfy",
    "Pose fenêtre de toit Velux solaire avec raccordement couverture",
    "Pose pergola bioclimatique alu 4×3m avec lames orientables",
  ],

  // ─── H — FAQ étoffée (12 Q&R, 80-150 mots chacune) ────────────────────
  faqCustom: [
    {
      question: "Quel est le bon logiciel devis pour un menuisier en 2026 ?",
      answer:
        "Un bon logiciel devis menuisier doit gérer les trois taux de TVA (5,5%, 10%, 20%), séparer fourniture et pose sur chaque ligne, injecter automatiquement la mention décennale et votre RGE Qualibat, être compatible Factur-X dès l'échéance du 1er septembre 2026, et permettre de créer un devis depuis le terrain en moins de 2 minutes. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple et largement adopté, Obat (25-79€/mois) ajoute la signature électronique et BatiChiffrage, Henrri reste gratuit — voir [notre avis Henrri](/blog/henrri-avis) — mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel, conçu spécifiquement pour les artisans menuisiers solo et auto-entrepreneurs.",
    },
    {
      question: "Comment séparer fourniture et pose sur mon devis menuiserie ?",
      answer:
        "Dans Nexartis, chaque ligne de devis dispose de deux sous-lignes optionnelles : la fourniture (matière première, chassis, quincaillerie) et la pose (main d'œuvre, dépose, raccords). Vous saisissez le prix HT de chaque sous-ligne, vous choisissez le taux de TVA applicable à chacune, et le total se calcule automatiquement. Cette séparation est essentielle en menuiserie pour deux raisons : justifier le taux 5,5% sur la pose RGE sans le voir requalifié sur la fourniture vendue seule, et permettre à votre client de monter son dossier MaPrimeRenov' qui exige le détail des coûts. Vous pouvez aussi pré-configurer vos prestations récurrentes avec leur séparation déjà prête depuis votre bibliothèque, pour ne pas refaire la saisie à chaque chantier.",
    },
    {
      question: "Comment gérer la TVA 5,5% sur les fenêtres RGE sans risque ?",
      answer:
        "Pour appliquer la TVA 5,5% sur une pose de fenêtre, trois conditions doivent être réunies : votre certification RGE Qualibat doit être valide au jour de la facturation, le logement doit avoir plus de 2 ans, et la fenêtre posée doit respecter les coefficients de performance énergétique (Uw ≤ 1,3 pour PVC, Uw ≤ 1,5 pour bois et alu). Dans Nexartis, vous renseignez une fois votre numéro RGE Qualibat dans les paramètres, il apparaît automatiquement sur tous vos devis et factures. La case attestation ajoute la mention obligatoire qui a remplacé l'attestation papier depuis le 16 février 2025. Vous conservez ensuite cinq ans les justificatifs : attestation client signée, copie certificat RGE en cours, fiche technique produit avec Uw mesuré.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les **mentions légales** exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois, immédiatement utilisable face aux donneurs d'ordre, syndics de copropriété et collectivités locales.",
    },
    {
      question: "Comment créer un devis depuis le rendez-vous client ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android, sans passer par les stores. Depuis votre téléphone, vous créez le devis pendant le rendez-vous en 5 à 10 minutes : sélection du client (ou création rapide), photos des ouvertures existantes, saisie ligne à ligne ou commande vocale (offre Complet à 25€ HT/mois) pour dicter dépose, fourniture, pose et raccords, validation. Le client signe directement avec le doigt sur l'écran avant que vous soyez parti, et le PDF signé est envoyé par email avec votre numéro de décennale et votre RGE Qualibat automatiquement intégrés. L'ensemble fonctionne même avec une connexion 4G faible et synchronise dès le retour en zone couverte. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Comment intégrer ma mention décennale et ma RGE automatiquement ?",
      answer:
        "Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), le numéro de contrat décennale, la zone géographique de couverture, vos numéros Qualibat 3712, 3713 ou 3714 selon les matériaux que vous posez, et votre numéro RGE en cours. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta sur l'étanchéité des menuiseries extérieures. Si vous renouvelez votre Qualibat ou votre contrat d'assurance, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes ?",
      answer:
        "Oui. Dans Nexartis, vous pouvez exiger un acompte à la signature du devis (le standard en menuiserie est de 30 à 40%, justifié par la commande chassis chez le fabricant). Pour les gros chantiers (remplacement de toutes les ouvertures, pergola, escalier sur mesure), vous facturez ensuite par étapes en créant plusieurs factures rattachées au chantier d'origine, chacune pour la part déjà réalisée. Le solde restant à facturer est recalculé à chaque étape pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu pour éviter le franchissement non anticipé en cours d'année.",
    },
    {
      question:
        "Comment gérer ma bibliothèque de prix matériel et fournisseurs ?",
      answer:
        "Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, et l'unité de vente (pièce, mètre carré, mètre linéaire, heure). L'offre Essentiel à 15€ HT/mois vous donne accès à des modèles génériques pré-remplis (pose fenêtre PVC, pose porte intérieure, pose volet) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fabricant (Tryba, K-Line, Bieber, Velux), regroupement de prestations en packs réutilisables (par exemple pack remplacement fenêtre RGE complet avec TVA 5,5% appliquée automatiquement). Vous gagnez plusieurs heures par semaine sur les chantiers récurrents.",
    },
    {
      question: "Comment chiffrer une menuiserie sur mesure avec précision ?",
      answer:
        "Pour une menuiserie sur mesure (escalier bois, dressing, baie vitrée non standard, pergola), Nexartis vous permet de décomposer le chiffrage en sous-lignes : matière première par essence et débit, quincaillerie, finition (lasure, vernis, peinture), main d'œuvre atelier en heures et tarif horaire HT, transport et pose sur site. Vous appliquez le bon taux de TVA à chaque sous-ligne (10% sur la pose en rénovation, 20% sur la fourniture seule si vous facturez séparément). Vous pouvez aussi joindre au devis un plan ou un croquis en pièce jointe, et préciser les délais de fabrication atelier avant pose. Cette granularité protège votre marge sur les ouvrages où le devis forfaitaire peut vous faire perdre de l'argent en cas d'imprévu.",
    },
    {
      question: "Le logiciel gère-t-il le SAV et la garantie 10 ans ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, factures émises, photos prises sur le terrain avant et après pose, notes datées par intervention, fiche technique du chassis posé. En cas d'appel SAV trois ans plus tard pour une infiltration sur une fenêtre, vous retrouvez en deux clics la date de pose, la marque, le modèle exact, le numéro de lot fabricant, et l'historique complet. La décennale au titre de la loi Spinetta couvre l'étanchéité de la menuiserie extérieure pendant 10 ans à partir de la réception, et la traçabilité comptable est conservée pour vos archives fiscales (durée légale 5 ans).",
    },
    {
      question:
        "Comment monter un dossier MaPrimeRenov' avec mon devis menuisier ?",
      answer:
        "Le dossier MaPrimeRenov' (ou les aides CEE) exige un devis détaillé avec la mention RGE Qualibat de l'artisan, les caractéristiques techniques précises du produit posé (Uw, coefficient Sw pour fenêtres, classement AEV, type de vitrage), le détail fourniture/pose, et la date prévisionnelle de pose. Dans Nexartis, votre numéro RGE est ajouté automatiquement, et vous renseignez les caractéristiques techniques dans le descriptif de prestation pré-configuré. Vous pouvez aussi générer en complément un récapitulatif client orienté financement, avec la TVA 5,5% bien identifiée et le reste à charge estimatif après aide. Votre cliente dépose ensuite son dossier MaPrimeRenov' sur le portail officiel en joignant votre devis signé.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (notre plan le plus accessible, qui couvre devis, factures, signature électronique, Factur-X, mention décennale et RGE automatiques) ou Complet à 25€ HT/mois (planning chantier, commande vocale, gestion d'équipe, bibliothèque illimitée, suivi des situations). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter chaque devis et chaque facture au format PDF à tout moment. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-vitrier", label: "Logiciel pour vitrier" },
    { href: "/logiciel-devis-serrurier", label: "Logiciel pour serrurier (portes blindées)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
