import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel devis plaquiste — Nexartis dès 15€/mois",
  description:
    "Devis et factures plaquiste en 2 minutes. TVA 5,5/10/20% automatique, factures de situation, métrés au m². Essai 14 jours sans CB. Dès 15€/mois.",
  alternates: {
    canonical: "/logiciel-devis-plaquiste",
  },
};

const data = {
  // ─── Identité métier ───────────────────────────────────────────────────
  nom: "Plaquiste",
  nomPluriel: "Plaquistes",
  icon: "🧱",
  h1: "Logiciel devis et factures pour plaquistes",
  metaTitle: "Logiciel devis plaquiste — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures plaquiste en 2 minutes. TVA 5,5/10/20% automatique, factures de situation, métrés au m². Essai 14 jours sans CB. Dès 15€/mois.",
  keywordPrincipal: "logiciel devis plaquiste",

  tvaNotes:
    "TVA 5,5% rénovation énergétique (ITE intérieure, doublage isolant), 10% rénovation logement >2 ans, 20% neuf",

  specificite:
    "Nexartis gère les 3 taux de TVA plaquiste, automatise les métrés au m² (cloisons, plafonds, doublages), permet de structurer un devis en lots et tranches, et facilite la facturation de situation propre aux gros chantiers neuf.",

  motsClesSecondaires: [
    "logiciel facture placoplatre",
    "logiciel artisan plaquiste",
    "logiciel plâtrerie sèche",
    "logiciel chiffrage cloisons",
    "logiciel devis plâtrier",
  ],

  // ─── A — Introduction longue (200-280 mots) ────────────────────────────
  longueIntro:
    "Choisir un **logiciel devis plaquiste** en 2026 n'a rien d'un détail. Trois taux de TVA cohabitent en plâtrerie sèche : 5,5% pour la rénovation énergétique (isolation thermique par l'intérieur, doublage avec laine de roche ou de verre), 10% pour la rénovation classique d'un logement de plus de 2 ans (cloisons, plafonds, jointoiement), 20% pour le neuf. À cela s'ajoutent les contraintes propres au métier : métrés précis au m² pour chaque pièce, structuration en lots (rez-de-chaussée / étage), tranches de paiement sur les gros chantiers, et l'arrivée de Factur-X qui imposera la facture électronique normalisée à toutes les entreprises. Pour aller plus loin sur la facturation, consultez [notre guide logiciel devis factures BTP](/logiciel-devis-factures).\n\nOr en plâtrerie, le volume de chantier est rarement petit. Une maison neuve de 180 m² peut représenter un devis structuré en 3 lots, 4 tranches de paiement, et plusieurs taux de TVA mélangés. La majorité des plaquistes français exercent en TPE ou en société à effectif réduit, souvent en sous-traitance d'un maître d'œuvre ou d'une entreprise générale. La marge est serrée, l'erreur de métré coûte cher, et la facturation de situation doit être impeccable pour préserver la trésorerie. La théorie des process pensés pour les PME ou les gros ERP du marché n'est pas adaptée à un plaquiste qui veut chiffrer sa cloison à 19h dans son camion.\n\n**Nexartis** a été conçu pour cette réalité d'artisan : un logiciel français pensé pour le terrain, pas pour les bureaux, qui édite un devis conforme depuis votre téléphone ou votre tablette, applique le bon taux de TVA en deux clics, génère les factures de situation automatiquement, et prépare vos documents au format Factur-X sans manipulation. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous travaillez aussi avec un peintre ? [Notre logiciel peintre](/logiciel-devis-peintre) couvre le métier connexe dans le même compte, et pour les chantiers de second œuvre complet, voyez aussi [notre logiciel électricien](/logiciel-devis-electricien).",

  // ─── B — Cas d'usage narratif ──────────────────────────────────────────
  casUsage: {
    titre: "Lundi matin, devis cloisons + plafonds chantier neuf 180 m²",
    scene:
      "Vous arrivez sur un chantier neuf maison individuelle de 180 m². Le maçon a fini le gros œuvre, l'électricien passe demain. Vous mesurez chaque pièce, comptez les angles, repérez les passages techniques. Vous dictez le devis sur tablette : ossatures métalliques cloisons, isolation laine de roche 100mm, plaques BA13 hydrofuge salles d'eau, plafonds suspendus avec laine 200mm, jointoiement complet, mise à jour finale au peintre. Vous structurez en 3 lots par étage, 4 tranches de paiement (acompte 30%, après cloisons étage rez 25%, après cloisons étage 1 25%, solde 20%). Le maître d'œuvre signe, vous démarrez vendredi.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ──────────────────
  paragrapheTva:
    "En plâtrerie sèche, vous jonglez avec trois taux de TVA selon la nature du chantier. La TVA à 5,5% s'applique aux travaux d'amélioration de la performance énergétique : isolation thermique par l'intérieur (ITE intérieure) avec laine minérale, doublage thermique de murs froids, isolation de combles aménagés par plaques de plâtre + isolant. Deux conditions doivent être réunies : le matériau d'isolation doit respecter les seuils de résistance thermique du Crédit d'impôt (R ≥ 3,7 m².K/W pour les murs intérieurs), et le logement doit avoir plus de 2 ans. La TVA à 10% couvre tous les travaux d'amélioration, transformation, aménagement et entretien dans un logement de plus de 2 ans : pose de cloisons sèches BA13, plafonds suspendus, doublage acoustique sans performance énergétique, jointoiement, ponçage. La TVA à 20% reste obligatoire sur le neuf, les extensions, et certaines fournitures vendues seules sans pose.\n\nDepuis le **16 février 2025**, l'attestation TVA papier (anciennement formulaires 1300-SD et 1301-SD pour le taux intermédiaire et le taux réduit) a été officiellement supprimée. Elle est remplacée par une simple mention à intégrer au devis ou à la facture, indiquant que les conditions d'application du taux réduit sont remplies. La responsabilité, en cas d'erreur de taux, repose désormais entièrement sur l'artisan, et les justificatifs (factures, attestations clients) doivent être conservés cinq ans en cas de contrôle fiscal.\n\nConcrètement, dans Nexartis, vous cochez la case correspondante au moment de créer votre devis : la mention est ajoutée automatiquement en pied de document, et le taux choisi est tracé dans l'historique du devis pour vos archives. Sur un chantier mixte (par exemple ITE intérieure à 5,5% + cloison sèche connexe à 10%), le logiciel calcule séparément chaque sous-total TVA pour le récapitulatif en pied de devis. Côté Factur-X, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel à 15€ HT/mois — vos factures sont alignées sur la réforme française dont le calendrier impose la réception au 1er septembre 2026 et l'émission au 1er septembre 2027 pour les TPE.",

  tableauTva: [
    {
      type: "Cloison sèche BA13 standard pose",
      taux: "10%",
      conditions: "Logement >2 ans",
    },
    {
      type: "Doublage thermique laine minérale R ≥ 3,7",
      taux: "5,5%",
      conditions: "Rénovation énergétique + logement >2 ans",
    },
    {
      type: "Plafond suspendu avec isolation 200mm",
      taux: "5,5%",
      conditions: "Performance énergétique + logement >2 ans",
    },
    {
      type: "Construction neuve ou extension",
      taux: "20%",
      conditions: "Travaux neufs",
    },
    {
      type: "Fourniture plaques de plâtre sans pose",
      taux: "20%",
      conditions: "Vente seule",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis",
    "Mention décennale obligatoire sur tout devis et facture (loi Spinetta) : nom de l'assureur, n° de contrat, zone géographique",
    "Auto-entrepreneur plaquiste : seuils TVA 37 500€ pour les services, 85 000€ pour les ventes",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 pour les micro-entrepreneurs",
  ],

  // ─── E — Conseils de rédaction (5-7) ──────────────────────────────────
  conseilsRedaction: [
    "Détailler chaque pièce séparément en m² (sol, murs, plafond) plutôt qu'un total global — un client comprend mieux 25 m² séjour + 18 m² cuisine que 43 m² « rez-de-chaussée »",
    "Préciser la marque ET la référence des plaques (BA13 Placoplatre, Knauf Pregybel, Siniat Pregybel, BA13 Hydrofuge Marine pour les zones humides)",
    "Indiquer la performance acoustique attendue pour les cloisons séparatives (Rw + C en dB) — c'est un argument différenciant face à un concurrent moins-disant",
    "Pour les doublages thermiques à 5,5%, mentionner la résistance thermique R en m².K/W et la marque de l'isolant (Isover, Rockwool, Knauf Insulation)",
    "Sur un gros chantier, structurer le devis en lots (gros œuvre / second œuvre / finition) et en tranches de paiement (30% acompte / 30% après cloisons / 30% après plafonds / 10% solde livraison)",
    "Préciser le niveau de finition livré (Q1 sommaire, Q2 standard, Q3 soigné, Q4 décoratif) — le standard plaquiste-peintre est Q3 mais le client doit savoir s'il paie pour du Q2 ou du Q4",
    "Pour un chantier en sous-traitance maître d'œuvre, joindre votre attestation Qualibat et le détail de votre assurance décennale au devis — les architectes l'exigent systématiquement",
  ],

  // ─── F — Certifications ────────────────────────────────────────────────
  certifications: [
    "Qualibat 4131",
    "Qualibat 4132",
    "Qualibat 4133",
    "Qualibat 6611",
    "RGE Eco-Artisan",
  ],

  // ─── G — Prestations typiques (10 lignes) ─────────────────────────────
  prestationsExemples: [
    "Cloison sèche BA13 standard sur ossature métallique 48mm",
    "Cloison sèche BA13 hydrofuge salles d'eau marine",
    "Doublage thermique laine de roche 100mm + BA13",
    "Plafond suspendu démontable acoustique 600x600",
    "Plafond Knauf laine de verre 200mm rénovation combles",
    "ITE intérieure polystyrène + BA13 hydrofuge",
    "Gainage technique chauffage + ventilation",
    "Faux plafond cuisine professionnelle hydrofuge",
    "Jointoiement complet enduit 3 passes niveau Q3",
    "Ponçage finition niveau Q4 décoratif",
  ],

  // ─── H — FAQ étoffée (8 Q&R, ~600 mots cumulés) ───────────────────────
  faqCustom: [
    {
      question: "Quel est le meilleur logiciel devis pour un plaquiste en 2026 ?",
      answer:
        "Le bon logiciel devis plaquiste doit gérer les trois taux de TVA (5,5%, 10%, 20%), automatiser les métrés au m², permettre la structuration en lots et tranches, générer les factures de situation, et être compatible Factur-X dès l'échéance du 1er septembre 2026. Plusieurs options existent : Tolteck (19-25€/mois) reste simple et largement adopté, Obat (25-79€/mois) ajoute la signature électronique et BatiChiffrage, Henrri reste gratuit — voir [notre avis Henrri](/blog/henrri-avis) — mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés et plus. Nexartis se positionne à 15€ HT/mois pour Essentiel et 25€ HT/mois pour Complet, conçu spécifiquement pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question: "Comment gérer les métrés au m² sans se tromper ?",
      answer:
        "Dans Nexartis, chaque ligne de devis dispose d'un champ « Quantité » et « Unité » (m², ml, pièce, heure) avec calcul automatique HT × TVA. Pour un chantier multi-pièces, vous créez une ligne par pièce avec ses dimensions précises (séjour 5,2 × 4,8 m = 24,96 m²), et le total se met à jour en temps réel. L'offre Complet à 25€ HT/mois ajoute une bibliothèque de pièces récurrentes (chambre standard 12 m², salle de bains 5 m², séjour 20 m²) que vous adaptez en deux clics au plan du chantier réel. Pour les chantiers complexes, vous pouvez joindre les plans au format PDF directement au devis.",
    },
    {
      question:
        "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les mentions légales exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre **Essentiel à 15€ HT/mois**.",
    },
    {
      question: "Comment gérer les factures de situation sur un gros chantier ?",
      answer:
        "Sur un chantier neuf de 180 m² ou une rénovation lourde, vous facturez rarement en une seule fois. Dans Nexartis, vous définissez à la création du devis le calendrier de paiement : acompte 30% à la signature, situation 1 (30% à la pose des cloisons rez-de-chaussée), situation 2 (30% à la pose plafonds étage), solde 10% à la livraison. Chaque situation est éditée en deux clics, le solde restant dû est recalculé automatiquement, et chaque facture est rattachée au chantier d'origine pour conserver la traçabilité comptable. Le récapitulatif client cumulé est généré à la demande pour transmission au maître d'œuvre ou au comptable.",
    },
    {
      question: "Puis-je intégrer ma mention décennale automatiquement ?",
      answer:
        "Oui. Dans Nexartis, vous renseignez une seule fois dans les paramètres : le nom de votre assureur (AXA, MAAF, SMABTP, Groupama, etc.), le numéro de contrat décennale, et la zone géographique de couverture. Ces informations apparaissent ensuite sur 100% de vos devis et factures, dans le pavé légal en bas de document, conformément aux exigences de la loi Spinetta. Si vous changez d'assureur ou renouvelez votre contrat, vous modifiez l'information à un seul endroit et tous les futurs documents s'actualisent. Cette automatisation est incluse dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Le logiciel gère-t-il les chantiers en sous-traitance ?",
      answer:
        "Oui. Sur l'offre Complet à 25€ HT/mois, vous créez un type de chantier « Sous-traitance » avec champ dédié au donneur d'ordre (entreprise générale, maître d'œuvre, architecte). La facture émise au donneur d'ordre intègre automatiquement la référence du marché principal et la mention « sous-traitance loi 75-1334 » obligatoire. Vous gérez en parallèle vos chantiers en propre (clients particuliers) et vos chantiers de sous-traitance dans la même interface, avec un filtre de tri pour la TVA, le chiffre d'affaires et les déclarations URSSAF.",
    },
    {
      question: "Comment créer un devis depuis le chantier ?",
      answer:
        "L'application Nexartis est installable comme une vraie app sur iOS et Android. Vous l'ouvrez depuis l'icône sur l'écran d'accueil de votre téléphone ou de votre tablette, sans navigateur. Le logiciel devis plaquiste se crée en quelques tapotements : client (recherche par nom), prestations depuis votre bibliothèque (cloison BA13, plafond suspendu, doublage), saisie des m² par pièce, validation. Le client signe directement avec le doigt sur l'écran, et le PDF signé est envoyé par email avec votre numéro de décennale automatiquement intégré. L'ensemble fonctionne même avec une connexion 4G faible et synchronise automatiquement dès le retour en zone couverte. La commande vocale (offre Complet à 25€ HT/mois) vous permet même de dicter le devis depuis votre véhicule. Si vous exercez sous statut auto-entrepreneur, voyez aussi [notre logiciel artisan auto-entrepreneur](/logiciel-artisan-auto-entrepreneur).",
    },
    {
      question: "Le logiciel gère-t-il ma bibliothèque de prestations ?",
      answer:
        "Oui. Nexartis intègre une bibliothèque de prestations et de matériel personnalisable où vous enregistrez vos tarifs HT au m², le taux de TVA par défaut, et l'unité de vente. L'offre Essentiel à 15€ HT/mois donne accès à des modèles génériques pré-remplis (cloison BA13, plafond suspendu, doublage thermique) que vous adaptez à votre marge. L'offre Complet à 25€ HT/mois ajoute la personnalisation avancée : catégories illimitées par marque (Placoplatre, Knauf, Siniat, Isover, Rockwool), import de votre tarif fournisseur, regroupement de prestations en « packs » réutilisables (par exemple : kit cloison BA13 hydrofuge complète avec ossature + isolant + plaque + jointoiement). Vous gagnez plusieurs heures par semaine de saisie sur les chantiers récurrents.",
    },
    {
      question: "Comment gérer le SAV et la garantie de parfait achèvement ?",
      answer:
        "Sur l'offre Complet de Nexartis à 25€ HT/mois, chaque chantier conserve son historique complet : devis signé, factures de situation émises, photos prises sur le terrain (avant cloisonnement, après plâtrage, finition Q3), notes datées par intervention. En cas d'appel SAV pour fissure ou désordre dans l'année qui suit la livraison (garantie de parfait achèvement), vous retrouvez en deux clics : la date de réception du chantier, le détail technique des matériaux posés, et l'historique des interventions. La mention décennale reste tracée sur 10 ans côté assureur. Pour les interventions SAV, vous créez un nouveau devis (ou un avoir si réparation gratuite) rattaché au chantier d'origine, et la traçabilité comptable est conservée pour vos archives fiscales.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois (notre plan le plus accessible) ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ─────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-peintre", label: "Logiciel pour peintre" },
    { href: "/logiciel-devis-electricien", label: "Logiciel pour électricien (second œuvre)" },
    { href: "/logiciel-artisan-auto-entrepreneur", label: "Logiciel artisan auto-entrepreneur" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
