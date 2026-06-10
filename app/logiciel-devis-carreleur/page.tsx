import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis carreleur — Nexartis dès 15€/mois",
  description:
    "Devis et factures carrelage en 2 minutes. TVA 5,5/10/20% automatique, fournitures et pose séparées, mention décennale. Essai 14 jours sans CB.",
  alternates: {
    canonical: "/logiciel-devis-carreleur",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Carreleur",
  nomPluriel: "Carreleurs",
  icon: "🔲",
  h1: "Logiciel devis et factures pour carreleurs",
  metaTitle: "Logiciel devis carreleur — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures carrelage en 2 minutes. TVA 5,5/10/20% automatique, fournitures et pose séparées, mention décennale. Essai 14 jours sans CB.",
  keywordPrincipal: "logiciel devis carreleur",

  tvaNotes:
    "TVA 10% sur la pose en rénovation, 20% sur les fournitures seules, 5,5% en adaptation PMR",

  specificite:
    "Nexartis sépare automatiquement fournitures et pose, calcule le métré au m² sol et mur, applique le bon taux de TVA selon le chantier (rénovation, neuf, adaptation PMR), et injecte la décennale étanchéité — essentielle dès qu'il y a une douche italienne SPEC.",

  motsClesSecondaires: [
    "logiciel facture carrelage",
    "application devis carreleur",
    "logiciel carreleur auto-entrepreneur",
    "logiciel chiffrage carrelage au m2",
    "logiciel gestion carreleur",
  ],

  // ─── A — Introduction longue (260-320 mots) ────────────────────────────
  longueIntro:
    "Choisir un logiciel devis carreleur en 2026 n'a rien d'un détail. Le métier mélange trois taux de TVA sur un même chantier : 5,5% pour l'adaptation d'un logement au handicap ou à la perte d'autonomie (douche à l'italienne PMR avec aide ANAH), 10% pour la pose en rénovation dans un logement de plus de 2 ans, 20% pour les fournitures vendues seules sans pose ou pour le neuf. À cela s'ajoute la mention décennale obligatoire dès qu'il y a une étanchéité sous carrelage (douche italienne, terrasse extérieure), la fin de l'attestation TVA papier au 16 février 2025, et l'arrivée de Factur-X qui imposera la facture électronique normalisée. Pour aller plus loin, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr, dans le métier, une part importante des carreleurs exercent en TPE ou en solo, souvent sous statut auto-entrepreneur (source CAPEB). Le devis carrelage est piégeux : il faut métrer le sol et les murs séparément, distinguer la fourniture du carrelage (souvent variable selon la marque choisie par le client) du coût de pose au m², prévoir le ragréage, les plinthes, la dépose de l'ancien revêtement, les joints, et anticiper la perte de coupe de 10 à 15% selon le format. Une ligne oubliée et la marge fond. C'est cette réalité-là qu'un logiciel devis carreleur doit comprendre, pas la théorie des process des grosses PME que visent [Sage Batigest pour PME](/blog/batigest-avis).\n\nNexartis a été conçu pour cette réalité d'artisan : un logiciel français pensé par et pour les carreleurs, qui édite un devis conforme depuis votre téléphone, sépare automatiquement fournitures et pose, applique le bon taux de TVA en deux clics, injecte votre numéro de décennale, et prépare vos factures au format **Factur-X** sans que vous ayez à comprendre ce que cela signifie. Vous comparez avec [notre comparatif Tolteck](/blog/tolteck-avis) ou [notre avis Obat](/blog/obat-avis) ? Sachez que Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Voir [nos tarifs détaillés](/tarifs) ou [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez en binôme avec un plombier ? [Notre logiciel plombier](/logiciel-devis-plombier) couvre les deux métiers dans le même compte.",

  // ─── B — Cas d'usage narratif (100-130 mots) ────────────────────────────
  casUsage: {
    titre: "Mardi 10h, métré d'une douche à l'italienne PMR chez un client âgé",
    scene:
      "La cliente a 78 ans et veut remplacer sa baignoire par une douche à l'italienne accessible. Vous mesurez : 1,40 m × 0,90 m au sol, hauteur sous plafond 2,30 m. Vous notez la pente d'écoulement à prévoir (1,5%), le siphon de sol extra-plat, le receveur intégré, le système SPEC (Système de Protection à l'Eau sous Carrelage) sous le grès cérame antidérapant R11, la faïence murale 20x20 sur 2 m². Vous dictez tout sur votre téléphone, depuis le couloir : dépose baignoire, ragréage, primaire d'accrochage, SPEC, pose grès cérame 60x60, joints souples époxy, barres d'appui inox. Le logiciel applique 5,5% adaptation PMR sur le devis, ajoute la mention décennale étanchéité. La cliente signe sur l'écran avant midi.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En carrelage, vous jonglez avec trois taux de TVA selon le type de chantier et la nature du client. La TVA à 5,5% s'applique à l'adaptation d'un logement au handicap ou à la perte d'autonomie : pose d'une douche italienne avec seuil zéro et siphon de sol, pose de carrelage antidérapant R11 dans une salle de bains PMR, mise en accessibilité d'une cuisine pour une personne âgée. Conditions : logement de plus de 2 ans, attestation du client signée, et éligibilité possible aux aides ANAH ou MaPrimeAdapt'. La TVA à 10% couvre l'essentiel de votre activité quotidienne : pose de carrelage sol et mur en rénovation, pose de faïence en salle de bains, ragréage de chape, dépose de l'ancien revêtement, pose de plinthes carrelage, joints époxy, pose de mosaïque, pose de carrelage extérieur sur terrasse existante. Conditions : logement de plus de 2 ans et facture mentionnant clairement la prestation de pose. La TVA à 20% reste obligatoire sur la fourniture de carrelage vendue seule sans pose, le neuf, les locaux professionnels et les piscines.\n\nDepuis le 16 février 2025, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD) a été officiellement supprimée. Elle est remplacée par une mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité en cas d'erreur repose entièrement sur l'artisan, et les justificatifs doivent être conservés cinq ans en cas de contrôle fiscal. C'est un point critique en carrelage car beaucoup de chantiers mêlent fourniture seule (20%) et pose (10%) sur le même devis.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et chaque ligne porte son propre taux. Côté Factur-X, le format européen EN 16931 est activé par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures partent déjà conformes à la réforme française dont le calendrier impose la réception au **1er septembre 2026** et l'émission au 1er septembre 2027 pour les TPE. Voir aussi [nos tarifs détaillés](/tarifs).",

  tableauTva: [
    {
      type: "Pose carrelage sol grès cérame en rénovation",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Pose douche italienne PMR avec SPEC",
      taux: "5,5%",
      conditions: "Adaptation handicap, attestation client",
    },
    {
      type: "Pose faïence murale salle de bain",
      taux: "10%",
      conditions: "Logement >2 ans, travaux d'amélioration",
    },
    {
      type: "Fourniture carrelage vendue seule sans pose",
      taux: "20%",
      conditions: "Sans prestation de pose facturée",
    },
    {
      type: "Pose carrelage en construction neuve",
      taux: "20%",
      conditions: "Logement <2 ans ou construction neuve",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout chantier d'étanchéité (douche italienne, terrasse) : loi Spinetta",
    "Auto-entrepreneur carreleur : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (7) ────────────────────────────────────
  conseilsRedaction: [
    "Séparer toujours le métré sol et le métré mur sur deux lignes distinctes du devis, en m², avec leur prix de pose au m² respectif",
    "Préciser la marque et la référence exacte du carrelage choisi par le client (ex : « Grès cérame Casalgrande Padana Cemento 60x60 antidérapant R10 »)",
    "Indiquer le classement UPEC du carrelage (résistance Usure, Poinçonnement, Eau, Chimique) et le classement antidérapance (R9 à R13 pieds chaussés, A-B-C pieds nus)",
    "Mentionner explicitement si le ragréage de la chape, le primaire d'accrochage et la dépose de l'ancien revêtement sont inclus ou en option chiffrée",
    "Préciser le type de joints utilisés (joint ciment standard, joint souple, joint époxy étanche) car le prix au ml varie du simple au triple",
    "Prévoir et chiffrer la perte de coupe (10% format classique, 15% format XXL ou pose en diagonale) directement dans la quantité de carrelage commandée",
    "Indiquer les conditions de paiement : acompte à la signature (30 à 40% en carrelage car la fourniture est commandée en amont), échéance facture, taux de pénalités de retard",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 6311 — Carrelage-revêtements (technicité courante)",
    "Qualibat 6312 — Carrelage-revêtements (technicité confirmée)",
    "Qualibat 6313 — Carrelage-revêtements-mosaïque (technicité supérieure)",
    "Qualibat 6261 — Chapes liquides (pour ragréage et chape de mise à niveau)",
    "RGE QualiBat (mention environnementale, utile pour MaPrimeAdapt')",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Pose carrelage sol grès cérame 60x60 antidérapant R10",
    "Pose faïence murale salle de bain 20x20",
    "Chape de ragréage autolissante avant pose",
    "Pose mosaïque douche italienne avec SPEC",
    "Dépose carrelage ancien + évacuation déchets",
    "Pose carrelage extérieur antidérapant R11 terrasse",
    "Pose plinthes carrelage assorties au sol",
    "Joints époxy étanches salle d'eau",
    "Pose carrelage sur plancher chauffant basse température",
    "Finition douche italienne PMR avec barres d'appui",
  ],

  // ─── H — FAQ étoffée (10 Q&R) ─────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le bon logiciel devis pour un carreleur en 2026 ?",
      answer:
        "Le bon logiciel devis carreleur doit gérer les trois taux de TVA (5,5% adaptation PMR, 10% rénovation, 20% neuf ou fourniture seule), séparer fournitures et pose sur des lignes distinctes, injecter automatiquement la mention décennale pour l'étanchéité, être compatible Factur-X dès l'échéance du 1er septembre 2026, et permettre un métré rapide depuis le chantier. Le marché propose plusieurs options : [notre comparatif Tolteck](/blog/tolteck-avis) (19-25€/mois) reste simple et largement adopté, [notre avis Obat](/blog/obat-avis) (25-79€/mois) ajoute la signature électronique, [Henrri reste gratuit](/blog/henrri-avis) mais n'est pas spécifique BTP, et [Sage Batigest pour PME](/blog/batigest-avis) cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu spécifiquement pour les artisans solo et auto-entrepreneurs. Voir [nos tarifs détaillés](/tarifs).",
    },
    {
      question: "Comment séparer fournitures et pose sur un devis carrelage ?",
      answer:
        "Dans Nexartis, chaque ligne de devis dispose d'un champ « type » : fourniture, pose ou prestation mixte. Vous saisissez par exemple « Grès cérame Marazzi 60x60 » avec la quantité en m², le prix unitaire et le taux TVA correspondant, puis sur la ligne suivante « Pose grès cérame au m² » avec votre prix de pose et le bon taux. Le récapitulatif en pied de devis ventile automatiquement les sous-totaux par taux de TVA, ce qui évite tout risque d'erreur lors d'un contrôle. Vous pouvez aussi créer des « packs » réutilisables dans votre bibliothèque (par exemple : pack « salle de bain complète 8 m² » avec fourniture + pose + joints + plinthes) que vous appliquez en un clic sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer la TVA à 5,5% sur une douche italienne PMR ?",
      answer:
        "La TVA à 5,5% s'applique aux travaux d'adaptation d'un logement au handicap ou à la perte d'autonomie. Pour une douche italienne PMR (seuil zéro, siphon de sol, receveur extra-plat, barres d'appui, carrelage antidérapant R11 minimum), vous devez réunir trois conditions : logement de plus de 2 ans, attestation du client précisant le besoin d'adaptation, et facturation distincte des éléments adaptés. Dans Nexartis, vous cochez « taux 5,5% adaptation PMR » sur chaque ligne concernée, et la mention obligatoire qui a remplacé l'attestation TVA papier depuis le 16 février 2025 s'ajoute en pied de devis. Le client peut ensuite déposer une demande d'aide ANAH ou MaPrimeAdapt' avec votre devis comme justificatif.",
    },
    {
      question: "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis sont générées au format Factur-X (un PDF lisible avec un fichier XML structuré embarqué), conformes au standard européen EN 16931. Vous n'avez aucune manipulation à faire : le format s'applique par défaut dès l'offre Essentiel à 15€ HT/mois. Plus de détails sur [notre guide logiciel devis factures BTP](/logiciel-devis-factures).",
    },
    {
      question: "Comment chiffrer la perte de coupe sur un carrelage XXL ?",
      answer:
        "La perte de coupe est un piège classique du devis carrelage. Pour un format standard 30x30 ou 45x45 posé droit, comptez 10% de pertes. Pour un format XXL (60x60, 80x80, 120x60) ou une pose en diagonale, comptez 15%. Pour une mosaïque ou un carrelage avec décor à raccorder, montez à 20%. Dans Nexartis, vous saisissez la surface utile à carreler (par exemple 12 m²) et le logiciel multiplie automatiquement par votre coefficient de perte préconfiguré dans la fiche prestation, pour afficher la quantité réelle à commander (13,2 m² avec 10% de perte). Le client voit la perte indiquée et la justification au m², ce qui évite tout litige.",
    },
    {
      question: "Comment intégrer ma mention décennale automatiquement sur mes documents ?",
      answer:
        "Pour un carreleur, la décennale est obligatoire dès qu'il y a une étanchéité : douche italienne SPEC, terrasse extérieure, salle d'eau collective. Dans Nexartis, vous renseignez une seule fois dans les paramètres : nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), numéro de contrat décennale, zone géographique de couverture, garantie étanchéité. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément à la loi Spinetta. Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Le logiciel gère-t-il les acomptes et factures de situation ?",
      answer:
        "Oui. Dans Nexartis, vous pouvez exiger un acompte à la signature du devis (le standard en carrelage est de 30 à 40%, car la fourniture du carrelage est commandée en amont chez le fournisseur). Pour les gros chantiers (rénovation complète d'un appartement, carrelage d'une maison neuve), vous facturez ensuite des situations intermédiaires : par exemple 30% à la signature pour commander la fourniture, 40% au démarrage de la pose, 30% à la réception du chantier. Le solde est calculé automatiquement à chaque étape, et chaque facture est rattachée au chantier d'origine pour conserver la traçabilité comptable. Les seuils auto-entrepreneur (37 500€ services, 85 000€ ventes) sont surveillés en continu.",
    },
    {
      question: "Comment créer un devis carrelage depuis le chantier en métré ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone, sans navigateur. Le logiciel devis carreleur se crée en quelques tapotements : client (recherche par nom), prestations depuis votre bibliothèque (pose grès cérame, pose faïence, ragréage, dépose), saisie des m² mesurés, choix du taux de TVA selon le chantier, validation. Le client signe directement avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré. La commande vocale (offre Complet à 25€ HT/mois) vous permet même de dicter le métré depuis le couloir, mains libres. Voir aussi [notre logiciel peintre](/logiciel-devis-peintre) si vous cumulez les deux corps de métier, ou [notre logiciel plaquiste](/logiciel-devis-plaquiste) pour les chantiers de second œuvre complet.",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de prix matériel ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT, le taux de TVA par défaut, et l'unité de vente (m², ml, pièce, heure). L'offre Essentiel à 15€ HT/mois vous donne accès à des modèles génériques pré-remplis (pose grès cérame au m², pose faïence au m², ragréage, dépose) que vous adaptez à votre marge et à votre secteur. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées, import de votre tarif fournisseur (Point P, Cedeo, Gedimat), regroupement de prestations en « packs » réutilisables (par exemple : kit douche italienne SPEC complet avec fourniture + pose + étanchéité + joints époxy + plinthes). Vous gagnez plusieurs heures par semaine de saisie sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer le SAV et la garantie sur une étanchéité carrelage ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, factures émises, photos prises sur le terrain à chaque étape clé (ragréage, primaire d'accrochage, système SPEC posé, joints terminés), notes datées par intervention. En cas d'appel SAV trois ans plus tard pour une infiltration de douche italienne, vous retrouvez en deux clics : la date de pose, la marque et la référence du carrelage, le type de SPEC posé, les photos d'avancement et le détail technique. La décennale étanchéité couvre les sinistres pendant 10 ans côté assureur. Pour les interventions SAV, vous créez un nouveau devis rattaché au chantier d'origine et la traçabilité comptable est conservée pour vos archives fiscales. Voir [tous nos articles](/blog) pour aller plus loin.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (notre plan le plus accessible) ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [démarrer l'essai gratuit](/register) en moins de 2 minutes ou consulter [nos tarifs détaillés](/tarifs) avant de vous décider.",
    },
    {
      question: "Puis-je faire signer mes devis carrelage à distance ?",
      answer:
        "Oui. Chaque devis Nexartis est envoyé par email avec un lien sécurisé de signature en ligne. Le client ouvre le PDF, le relit, signe avec le doigt sur son téléphone ou la souris sur son ordinateur, et vous recevez immédiatement une notification avec le devis signé horodaté. Cette signature électronique a la même valeur juridique qu'une signature manuscrite (règlement eIDAS), et le devis signé est archivé dans votre espace pour la durée légale de conservation. Pour une douche italienne PMR avec aide ANAH, le client peut transmettre directement ce devis signé à l'instructeur de son dossier. La fonctionnalité est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-plombier", label: "Logiciel pour plombier" },
    { href: "/logiciel-devis-peintre", label: "Logiciel pour peintre" },
    { href: "/logiciel-devis-plaquiste", label: "Logiciel pour plaquiste" },
    { href: "/blog/tolteck-avis", label: "Tolteck : notre avis" },
    { href: "/blog/obat-avis", label: "Obat : notre avis" },
    { href: "/tarifs", label: "Voir les tarifs Nexartis" },
    { href: "/blog", label: "Tous nos articles" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
