import { Metadata } from "next";
import MetierPageTemplate from "@/components/MetierPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel auto-entrepreneur bâtiment — Nexartis dès 15€/mois",
  description:
    "Devis et factures auto-entrepreneur BTP. Mention 293 B CGI automatique, suivi des seuils 37 500/85 000€, décennale. Essai 14 jours sans CB.",
  alternates: {
    canonical: "/logiciel-artisan-auto-entrepreneur",
  },
};

const data = {
  // ─── Identité ───────────────────────────────────────────────────────────
  nom: "Auto-entrepreneur",
  nomPluriel: "Auto-entrepreneurs",
  icon: "👷",
  h1: "Logiciel devis et factures pour auto-entrepreneurs du bâtiment",
  metaTitle: "Logiciel auto-entrepreneur bâtiment — Nexartis dès 15€/mois",
  metaDescription:
    "Devis et factures auto-entrepreneur BTP. Mention 293 B CGI automatique, suivi des seuils 37 500/85 000€, décennale. Essai 14 jours sans CB.",
  keywordPrincipal: "logiciel auto-entrepreneur bâtiment",

  tvaNotes:
    "Franchise en base de TVA tant que CA < 37 500€ HT services / 85 000€ HT ventes. Mention art. 293 B du CGI obligatoire sur tous les documents.",

  specificite:
    "Nexartis ajoute la mention de franchise sur 100% de vos devis et factures, suit en temps réel vos seuils de chiffre d'affaires, vous alerte avant le basculement TVA, et conserve la mention décennale obligatoire — même en franchise, la garantie reste due en BTP.",

  motsClesSecondaires: [
    "logiciel facture auto-entrepreneur",
    "application devis micro-entreprise BTP",
    "logiciel devis auto-entrepreneur",
    "logiciel facture micro-entrepreneur",
    "application AE artisan",
  ],

  // ─── A — Introduction longue ──────────────────────────────────────────
  longueIntro:
    "Choisir un **logiciel auto-entrepreneur bâtiment** en 2026 n'a rien d'un détail administratif. Le statut de micro-entreprise impose des règles très précises : franchise en base de TVA tant que vous restez sous les seuils de chiffre d'affaires (37 500€ HT pour les prestations de services BIC, 85 000€ HT pour les ventes de fournitures), mention obligatoire « TVA non applicable, art. 293 B du CGI » sur chaque devis et chaque facture, numérotation continue et chronologique des documents, conservation pendant six ans, et — fait souvent oublié — garantie décennale obligatoire en BTP même pour les auto-entrepreneurs (loi Spinetta). Pour comprendre l'ensemble de la facturation BTP, consultez [notre guide logiciel devis factures](/logiciel-devis-factures).\n\nDans la réalité du terrain, l'auto-entrepreneur BTP travaille souvent en multi-métiers : petits travaux, dépannage, second œuvre, pose, entretien. Il démarre seul, jongle entre les rendez-vous et l'administratif, et n'a ni la trésorerie pour un logiciel à 80€ par mois ni le temps de devenir comptable. Beaucoup utilisent encore Word et Excel, perdent du temps sur des modèles bricolés, oublient une mention légale, ratent un seuil de basculement TVA, ou découvrent trop tard qu'ils auraient dû passer en EI ou EURL. Les solutions du marché pour PME sont surdimensionnées et hors budget pour un AE qui démarre.\n\n**Nexartis** a été pensé pour cette réalité : un logiciel français qui édite un devis ou une facture conforme depuis votre téléphone, ajoute la mention 293 B automatiquement, surveille vos seuils en temps réel et vous alerte avant le basculement, conserve votre numéro de décennale sur chaque document, et vous prépare à la facturation électronique : réception des factures de vos fournisseurs (obligation au 1er septembre 2026) et émission des vôtres au format électronique (Factur-X, UBL ou CII) pour l'échéance qui vous concerne (à partir du 1er septembre 2027), via une plateforme agréée sans manipulation de votre part. Nexartis démarre à **15€ HT/mois** pour Essentiel et 25€ HT/mois pour Complet (planning, vocal, équipe). Vous pouvez [démarrer l'essai gratuit 14 jours](/register), sans carte bancaire. Vous êtes électricien ou plombier en AE ? [Notre logiciel plombier](/logiciel-devis-plombier) et [notre logiciel électricien](/logiciel-devis-electricien) couvrent les spécificités métier dans le même compte.",

  // ─── B — Cas d'usage narratif ─────────────────────────────────────────
  casUsage: {
    titre: "Octobre, vous approchez les seuils de franchise TVA",
    scene:
      "Vous avez démarré votre micro-entreprise en janvier. Petits travaux, dépannage, un peu de pose. Le bouche-à-oreille a fonctionné, le carnet s'est rempli, et en éditant la facture du chantier de Mme Dupont, Nexartis vous affiche un bandeau orange : « Cumul services 36 200€ HT, vous approchez le seuil de 37 500€ ». Vous comprenez tout de suite l'enjeu. Vous regardez le tableau de bord, vous voyez les chantiers signés à venir, vous estimez le dépassement à 2 000€ sur novembre. Vous prenez rendez-vous avec un comptable, vous anticipez la bascule TVA au 1er jour du mois de dépassement, vous prévenez vos clients pros qui vont récupérer la TVA, et vous ajustez vos prochains devis. Pas de mauvaise surprise au contrôle, pas d'amende, pas de panique fin décembre.",
  },

  // ─── C — TVA : paragraphe + tableau + réglementation ────────────────
  paragrapheTva:
    "En tant qu'auto-entrepreneur du BTP, vous bénéficiez de la franchise en base de TVA tant que votre chiffre d'affaires reste sous les seuils. Pour les prestations de services BIC (la majorité des activités BTP : main d'œuvre, dépannage, pose), le seuil est de 37 500€ HT par an. Pour les ventes de fournitures (matériel facturé séparément), le seuil est de 85 000€ HT. Tant que vous êtes sous ces seuils, vous facturez en HT = TTC, sans TVA, et chaque document doit porter la mention « TVA non applicable, **art. 293 B CGI** ». Cette mention reste tolérée jusqu'au 31 décembre 2027, date à laquelle le dispositif évoluera selon les nouvelles règles européennes.\n\nLe basculement à la TVA intervient dès le premier jour du mois au cours duquel vous dépassez le seuil de franchise. Une tolérance d'un an existe avec les seuils majorés (41 250€ pour les services, 93 500€ pour les ventes) : si vous restez entre le seuil de base et le seuil majoré, vous gardez la franchise l'année du dépassement et basculez l'année suivante. Au-delà du seuil majoré, la bascule est immédiate. À partir de ce moment, vous facturez la TVA à 5,5%, 10% ou 20% selon le chantier, et vous la reversez à l'administration fiscale. Vous récupérez aussi la TVA sur vos achats, ce qui peut devenir un avantage si vous achetez beaucoup de matériel.\n\nCôté **Factur-X**, les mentions légales exigées par la réforme sont intégrées par défaut dès l'offre Essentiel : vos factures sont alignées sur la réforme française dont le calendrier impose la réception au 1er septembre 2026 pour toutes les entreprises, et l'émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Nexartis surveille en continu votre cumul de CA mensuel, affiche un compteur dans le tableau de bord, et vous alerte par email dès que vous franchissez 80% du seuil. Vous gardez la maîtrise de votre statut.",

  tableauTva: [
    {
      type: "Prestations de services BIC (main d'œuvre, dépannage, pose)",
      taux: "0% (franchise)",
      conditions: "CA < 37 500€ HT — mention 293 B CGI",
    },
    {
      type: "Ventes de fournitures (matériel facturé séparément)",
      taux: "0% (franchise)",
      conditions: "CA < 85 000€ HT — mention 293 B CGI",
    },
    {
      type: "Dépassement seuil services (entre 37 500€ et 41 250€)",
      taux: "0% l'année en cours",
      conditions: "Tolérance 1 an — bascule au 1er janvier suivant",
    },
    {
      type: "Dépassement seuil majoré (au-delà 41 250€ ou 93 500€)",
      taux: "5,5% / 10% / 20%",
      conditions: "Bascule TVA au 1er jour du mois de dépassement",
    },
    {
      type: "Après basculement TVA — chantiers BTP standards",
      taux: "10% (rénovation >2 ans) / 20% (neuf)",
      conditions: "Selon nature des travaux et ancienneté du logement",
    },
  ],

  reglementation2026: [
    "Factur-X obligatoire en réception le 1er septembre 2026 (toutes entreprises, AE inclus)",
    "Factur-X obligatoire en émission le 1er septembre 2027 pour les TPE et auto-entrepreneurs",
    "Seuils franchise TVA 2026 : 37 500€ HT services / 85 000€ HT ventes (majorés tolérance : 41 250€ / 93 500€)",
    "Mention art. 293 B du CGI tolérée jusqu'au 31 décembre 2027 sur tout document AE",
    "Garantie décennale obligatoire pour tout artisan BTP, y compris auto-entrepreneur (loi Spinetta)",
    "Attestation TVA papier supprimée le 16 février 2025 — remplacée par une mention sur le devis (utile après bascule TVA)",
  ],

  // ─── E — Conseils de rédaction ───────────────────────────────────────
  conseilsRedaction: [
    "Ajouter la mention exacte « TVA non applicable, art. 293 B du CGI » en pied de devis et de facture tant que vous êtes en franchise",
    "Tenir une numérotation continue et chronologique des factures, sans rupture ni doublon : 2026-001, 2026-002, etc. (obligation comptable)",
    "Mentionner votre numéro de garantie décennale sur 100% des documents : nom de l'assureur, n° de contrat, zone géographique (loi Spinetta, valable aussi pour AE)",
    "Indiquer votre IBAN ou les modes de paiement acceptés dans le pavé conditions de paiement, ainsi que vos coordonnées de médiateur de la consommation pour les particuliers",
    "Préciser la date d'échéance, le taux de pénalités de retard (trois fois le taux d'intérêt légal par défaut), et l'indemnité forfaitaire de 40€ pour frais de recouvrement entre professionnels",
    "Tenir à jour le livre des recettes (obligatoire pour tout AE) et le registre des achats (uniquement si vous facturez des fournitures à part de la main d'œuvre)",
    "Conserver factures et devis pendant 6 ans (durée légale), 10 ans recommandés en BTP pour couvrir la garantie décennale en cas de sinistre",
  ],

  // ─── F — Certifications ───────────────────────────────────────────────
  certifications: [
    "RGE QualiBat (rénovation énergétique)",
    "Qualibat (selon spécialité métier)",
    "Qualifelec (électricien AE)",
    "PG (Professionnel Gaz pour plombier-chauffagiste AE)",
    "Eco Artisan",
  ],

  // ─── G — Prestations typiques (10 lignes transversales) ──────────────
  prestationsExemples: [
    "Petits travaux de rénovation tous corps d'état",
    "Dépannage urgence (plomberie, électricité, serrurerie)",
    "Pose et installation d'équipements ménagers",
    "Entretien copropriétés et petits chantiers récurrents",
    "Peinture et rafraîchissement intérieur",
    "Second œuvre menuiserie intérieure (pose porte, plinthes)",
    "Montage de meubles chez le particulier",
    "Débarras et nettoyage de chantier en fin de travaux",
    "Dépannage multi-métiers selon spécialité déclarée",
    "Prestations forfaitaires multi-services à la journée",
  ],

  // ─── H — FAQ étoffée (12 Q&R) ────────────────────────────────────────
  faqCustom: [
    {
      question: "Quel est le bon logiciel devis pour un auto-entrepreneur BTP en 2026 ?",
      answer:
        "Le bon logiciel auto-entrepreneur bâtiment doit ajouter automatiquement la mention « TVA non applicable, art. 293 B du CGI », surveiller vos seuils de chiffre d'affaires en continu, conserver votre numéro de décennale sur chaque document, et rester compatible Factur-X dès l'échéance du 1er septembre 2026. Le marché propose plusieurs options : Tolteck (19-25€/mois) reste simple et largement adopté — voir [notre comparatif Tolteck](/blog/tolteck-avis) —, Obat (25-79€/mois) ajoute la signature électronique, Henrri reste gratuit mais n'est pas spécifique BTP, et Sage Batigest cible plutôt les structures de 10 salariés. Nexartis se positionne à 15€ HT/mois pour Essentiel, conçu spécifiquement pour les artisans solo et auto-entrepreneurs.",
    },
    {
      question: "Quand dois-je basculer à la TVA en tant qu'AE BTP ?",
      answer:
        "Vous basculez à la TVA dès le premier jour du mois au cours duquel vous dépassez le seuil de franchise (37 500€ HT pour les services BIC, 85 000€ HT pour les ventes). Une tolérance d'un an existe avec les seuils majorés : si vous restez entre 37 500€ et 41 250€ sur les services (ou entre 85 000€ et 93 500€ sur les ventes), vous gardez la franchise l'année du dépassement et basculez au 1er janvier suivant. Au-delà des seuils majorés, la bascule est immédiate. Nexartis affiche en permanence votre cumul de CA et vous alerte par email dès 80% du seuil pour vous laisser le temps d'anticiper.",
    },
    {
      question: "Suis-je obligé d'avoir une garantie décennale en auto-entrepreneur ?",
      answer:
        "Oui, sans exception. La loi Spinetta impose à tout artisan du bâtiment, quel que soit son statut juridique (auto-entrepreneur, entreprise individuelle, EURL, SASU), de souscrire une garantie décennale avant le démarrage du premier chantier. La franchise de TVA ne dispense en rien de cette obligation. Le coût varie de 600€ à 2 500€ par an selon le métier et le chiffre d'affaires. Le numéro de contrat et le nom de l'assureur doivent figurer sur 100% de vos devis et factures. Dans Nexartis, vous renseignez ces informations une seule fois dans les paramètres et elles s'ajoutent automatiquement à tous vos documents, dès l'offre Essentiel à 15€ HT/mois.",
    },
    {
      question: "Comment numéroter mes factures en tant qu'AE ?",
      answer:
        "La numérotation des factures doit être continue, chronologique et sans rupture, sur toute la durée de votre activité. Le format est libre, mais le standard recommandé en micro-entreprise BTP est l'année suivie d'un compteur à trois ou quatre chiffres : 2026-001, 2026-002, 2026-003, etc. Vous pouvez aussi inclure un préfixe par série si vous distinguez factures et avoirs (F-2026-001, AV-2026-001). Une fois une facture émise, elle ne peut plus être supprimée : si vous faites une erreur, vous devez créer un avoir. Nexartis applique cette numérotation continue par défaut et bloque toute suppression d'une facture validée, conformément à l'obligation comptable.",
    },
    {
      question: "Qu'est-ce que la mention « art. 293 B du CGI » et où la mettre ?",
      answer:
        "C'est la mention légale obligatoire qui informe vos clients que vous n'appliquez pas la TVA car vous êtes en franchise en base. Le libellé exact à reporter est « TVA non applicable, art. 293 B du CGI ». Elle doit figurer en pied de chaque devis et de chaque facture, de manière visible. Sans cette mention, votre document peut être considéré comme non conforme en cas de contrôle, et la franchise peut vous être contestée. Nexartis ajoute cette mention automatiquement sur 100% de vos documents tant que votre cumul de CA reste sous le seuil. Dès que vous basculez à la TVA, la mention disparaît et le calcul des taux 5,5/10/20% s'active.",
    },
    {
      question: "Quelles cotisations URSSAF dois-je payer en AE BTP ?",
      answer:
        "Les cotisations URSSAF auto-entrepreneur sont calculées par prélèvement libératoire sur votre chiffre d'affaires encaissé, déclaré chaque mois ou chaque trimestre selon votre choix. Pour les prestations de services artisanales BIC (la majorité des activités BTP), le taux est d'environ 21% du CA en 2026 selon la catégorie déclarée — il convient de vérifier votre taux exact sur votre espace personnel URSSAF, car les taux peuvent évoluer chaque année. La première année, vous pouvez bénéficier de l'ACRE (Aide à la Création et à la Reprise d'Entreprise) qui réduit votre cotisation de moitié sous conditions. Nexartis affiche votre CA encaissé mensuel pour faciliter votre déclaration URSSAF.",
    },
    {
      question: "Le logiciel est-il conforme à la facturation électronique 2026 (Factur-X) ?",
      answer:
        "Oui. La réforme française impose Factur-X en réception au 1er septembre 2026 pour toutes les entreprises, et en émission au 1er septembre 2027 pour les TPE et auto-entrepreneurs. Toutes les factures Nexartis intègrent déjà les mentions légales exigées par la réforme (numéros d'identification, références TVA, conditions de règlement, pénalités), et Nexartis évolue avec le calendrier officiel pour rester aligné avant l'échéance qui vous concerne. Inclus par défaut dès l'offre Essentiel à 15€ HT/mois, même en franchise de TVA.",
    },
    {
      question: "Quand passer de l'auto-entreprise à l'entreprise individuelle ou EURL ?",
      answer:
        "Trois signaux indiquent qu'il est temps d'envisager le passage en EI au régime réel ou en EURL. Premier signal : vous dépassez régulièrement les seuils de franchise et basculez à la TVA — l'avantage administratif du statut AE s'efface, autant choisir un cadre plus complet. Deuxième signal : vous achetez beaucoup de matériel et de fournitures, et la non-récupération de TVA sur les achats vous coûte cher. Troisième signal : vous souhaitez investir dans un véhicule utilitaire, un local, ou recruter — l'AE ne permet ni l'amortissement comptable, ni l'embauche dans des conditions souples. Un comptable peut chiffrer la bascule en une heure. Nexartis vous accompagne sur la transition sans changer d'outil : vos historiques sont conservés et le calcul TVA s'active automatiquement.",
    },
    {
      question: "Comment tenir mon livre des recettes obligatoire ?",
      answer:
        "Le livre des recettes est une obligation comptable pour tout auto-entrepreneur. Il doit lister chronologiquement chaque encaissement : date, montant, mode de paiement (espèces, chèque, virement, CB), identité du client, référence de la facture. Vous pouvez le tenir sur papier ou en numérique, mais il doit être présentable en cas de contrôle URSSAF ou fiscal. Si vous facturez aussi des fournitures séparément, vous devez tenir en plus un registre des achats. Nexartis génère automatiquement un export du livre des recettes au format Excel ou PDF depuis votre espace, à partir des paiements enregistrés. Vous gagnez plusieurs heures par mois sur la saisie manuelle.",
    },
    {
      question: "Comment encaisser rapidement mes factures de chantier ?",
      answer:
        "Nexartis est une PWA installable sur iPhone et Android, sans passer par les stores. Depuis votre téléphone, vous créez la facture en 1 à 2 minutes sur le chantier : sélection du client, saisie des prestations depuis votre bibliothèque, validation. La facture part par email avec un lien de paiement Stripe qui permet au client de régler en CB depuis son téléphone. L'encaissement est enregistré automatiquement dans votre livre des recettes. Vous pouvez aussi proposer le virement avec votre IBAN imprimé sur la facture.",
    },
    {
      question: "Que se passe-t-il si je dépasse les seuils sans m'en rendre compte ?",
      answer:
        "Si vous franchissez le seuil majoré (41 250€ services ou 93 500€ ventes), vous basculez automatiquement à la TVA à compter du 1er jour du mois de dépassement. Toutes les factures émises ce mois-là doivent porter la TVA. Si vous oubliez, l'administration peut vous réclamer la TVA collectée sur le rétroactif, avec pénalités et intérêts de retard. En BTP, c'est un risque important car les chantiers signés en fin d'année gonflent vite le compteur. Nexartis surveille votre cumul en permanence et vous envoie une alerte par email dès 80% du seuil, puis une alerte rouge en cas de franchissement, pour que vous puissiez ajuster immédiatement vos prochains documents.",
    },
    {
      question: "Que se passe-t-il après les 14 jours d'essai gratuit ?",
      answer:
        "Aucun prélèvement automatique : Nexartis ne demande pas de carte bancaire à l'inscription. À l'issue des 14 jours, vous choisissez entre l'offre Essentiel à 15€ HT/mois ou Complet à 25€ HT/mois (planning, commande vocale et gestion d'équipe inclus). Aucun engagement, vous résiliez quand vous voulez depuis votre espace personnel. Vos données restent les vôtres et vous pouvez les exporter à tout moment au format CSV ou PDF. Vous pouvez [commencer l'essai gratuit](/register) en moins de 2 minutes.",
    },
  ],

  // ─── I — Maillage interne ────────────────────────────────────────────
  ancresMaillage: [
    { href: "/logiciel-devis-plombier", label: "Logiciel pour plombier" },
    { href: "/logiciel-devis-electricien", label: "Logiciel pour électricien" },
    { href: "/logiciel-devis-peintre", label: "Logiciel pour peintre" },
    { href: "/logiciel-devis-factures", label: "Guide complet devis & factures BTP" },
    { href: "/tarifs", label: "Voir la grille tarifaire" },
  ],
};

export default function Page() {
  return <MetierPageTemplate {...data} />;
}
