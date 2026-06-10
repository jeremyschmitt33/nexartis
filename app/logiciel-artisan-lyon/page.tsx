import { Metadata } from "next";
import Link from "next/link";
import LocalPageTemplate from "@/components/LocalPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Artisan Lyon — Nexartis | Métropole de Lyon | dès 15€/mois",
  description:
    "Nexartis, le logiciel artisan pour les BTP de Lyon et de la Métropole. Devis, factures, planning de chantier. Vieux Lyon UNESCO, Confluence, Croix-Rousse. Dès 15€ HT/mois.",
  alternates: {
    canonical: '/logiciel-artisan-lyon',
  },
};

const data = {
  ville: "Lyon",
  region: "Rhône",
  codePostal: "69",
  h1: "Logiciel artisan à Lyon — Nexartis, pour la Métropole",
  metaTitle: "Logiciel Artisan Lyon — Nexartis | Métropole de Lyon | dès 15€/mois",
  metaDescription:
    "Nexartis, le logiciel artisan pour les BTP de Lyon et de la Métropole. Devis, factures, planning de chantier. Vieux Lyon UNESCO, Confluence, Croix-Rousse. Dès 15€ HT/mois.",
  specificite:
    "Nexartis accompagne les artisans du BTP de la Métropole de Lyon avec un logiciel pensé pour leurs spécificités : ravalement façades en pierre de Lyon dans le Vieux Lyon classé UNESCO, immeubles canuts de la Croix-Rousse à plafonds hauts, chantiers BBC de l'éco-quartier Confluence, et pic de demande en pompes à chaleur après les canicules récurrentes. Devis, factures et planning de chantier pour plombiers, électriciens, maçons, ravaleurs et couvreurs lyonnais.",
  temoignage: {
    quote:
      "Je gère 3 chantiers en parallèle dans la métropole lyonnaise. Avec le planning de Nexartis, je ne me trompe plus jamais d'affectation entre la Croix-Rousse, Villeurbanne et Saint-Priest.",
    nom: "Sylvain D.",
    metier: "Maçon",
    ville: "Lyon (69)",
  },
};

export default function Page() {
  return (
    <>
      <LocalPageTemplate {...data} />

      {/* ── Sections SEO local enrichies ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Nexartis et les artisans lyonnais
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              La <strong>Métropole de Lyon</strong> regroupe plusieurs milliers
              d&apos;artisans du BTP répartis sur 59 communes, des 9 arrondissements
              de la ville-centre jusqu&apos;à Villeurbanne, Vénissieux, Bron ou
              Saint-Priest. Le tissu local est dense, structuré, et porté par une
              activité de rénovation soutenue. Plombiers, électriciens, maçons,
              ravaleurs, couvreurs, plaquistes et carreleurs y composent avec un
              parc immobilier d&apos;une grande diversité : immeubles bourgeois de
              la Presqu&apos;île, ateliers canuts de la Croix-Rousse, pavillons des
              communes périphériques et logements neufs Passivhaus de Confluence.
            </p>

            <p>
              La saisonnalité lyonnaise suit le climat continental de la vallée du
              Rhône. Les chantiers extérieurs — ravalement, toiture, VRD — se
              concentrent au printemps (mars à juin) et à l&apos;automne (septembre
              à novembre). L&apos;hiver froid maintient la demande sur le second
              œuvre : VMC double flux, isolation toiture, remplacement de chaudière.
              Les canicules de juillet, récurrentes depuis 2022, ont fait exploser
              les installations de pompes à chaleur, de climatisation et
              d&apos;isolation extérieure. Un artisan lyonnais doit anticiper ces
              pics et ne plus rater un devis envoyé tardivement.
            </p>

            <p>
              La transition énergétique structure désormais le carnet de commandes.
              MaPrimeRénov&apos;, les CEE et les aides régionales d&apos;Auvergne-Rhône-Alpes
              ont multiplié les chantiers d&apos;isolation, de PAC et de
              changement de menuiseries. Les obligations administratives qui les
              accompagnent — devis détaillés, attestations de TVA à 5,5%, traçabilité
              — imposent une rigueur que Nexartis prend en charge. Avec une offre
              dès <strong>15€ HT/mois</strong>, le logiciel reste accessible au
              plus petit artisan tout en couvrant l&apos;essentiel administratif.
              <Link href="/register" className="text-orange underline-offset-2 hover:underline"> Essai gratuit 14 jours</Link>, sans carte bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* ── Cas d'usage local ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Un cas concret : électricien à Villeurbanne
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Imaginez la semaine type d&apos;un électricien basé à Villeurbanne.
              Lundi matin, mise aux normes NF C 15-100 dans un appartement canut de
              la Croix-Rousse — plafond à 3,80 m, câblage apparent à dissimuler avec
              soin. L&apos;après-midi, pose d&apos;une borne IRVE chez un client de
              Caluire-et-Cuire, devis signé la veille via la signature électronique.
              Mardi, dépannage urgent à Bron, puis chiffrage d&apos;une rénovation
              électrique complète à Vénissieux. Mercredi et jeudi, gros chantier
              tertiaire sur Techlid à Limonest. Vendredi, retour sur un pavillon
              à Saint-Priest.
            </p>

            <p>
              Sans outil adapté, ces journées finissent en soirées de paperasse à
              rattraper devis et factures. Avec Nexartis, chaque intervention est
              saisie depuis le véhicule : devis créé en 3 minutes, envoyé par SMS,
              signé sur le téléphone du client. La facture est générée dans la
              foulée, avec les <strong>mentions Factur-X 2026</strong>, et un bouton
              « Relancer » en un clic en cas d&apos;impayé. Le planning visuel évite
              les doubles affectations entre le périphérique Laurent-Bonnevay et les
              communes de la première couronne.
            </p>
          </div>
        </div>
      </section>

      {/* ── Zones d'intervention ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Zones d&apos;intervention couvertes
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Nexartis accompagne les artisans sur l&apos;ensemble de la Métropole
              de Lyon et de sa périphérie. Du centre historique aux communes de
              l&apos;Est lyonnais, le logiciel s&apos;adapte à votre zone
              d&apos;activité quotidienne et permet de classer vos chantiers par
              secteur géographique directement dans le planning.
            </p>

            <p>
              Les artisans utilisateurs interviennent typiquement sur les 9
              arrondissements : Lyon 1er (Terreaux), 2e (Confluence et Bellecour),
              3e (Part-Dieu), 4e (Croix-Rousse), 5e (Vieux Lyon), 6e (Brotteaux),
              7e (Guillotière), 8e (Monplaisir) et 9e (Vaise). Côté communes,
              Villeurbanne, Vénissieux, Bron, Caluire-et-Cuire, Saint-Priest,
              Vaulx-en-Velin, Décines-Charpieu, Meyzieu, Rillieux-la-Pape, Oullins,
              Sainte-Foy-lès-Lyon, Tassin-la-Demi-Lune, Écully, Saint-Genis-Laval
              et Pierre-Bénite concentrent l&apos;essentiel des chantiers
              résidentiels. Les zones d&apos;activité comme la ZI Vaise, Techlid
              (Limonest-Dardilly) ou Mi-Plaine à Saint-Priest accueillent une
              activité tertiaire et industrielle soutenue.
            </p>

            <p>
              Que vous soyez basé dans le 3e arrondissement ou que vous interveniez
              jusqu&apos;à Givors, votre <Link href="/tarifs" className="text-orange underline-offset-2 hover:underline">abonnement Nexartis</Link> reste le même —
              pas de surcoût lié à la distance ni au nombre de communes desservies.
            </p>
          </div>
        </div>
      </section>

      {/* ── Spécificités métier ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Spécificités métier à Lyon
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Le <strong>Vieux Lyon classé UNESCO</strong> (5e arrondissement,
              424 hectares classés depuis 1998) impose sa logique aux maçons,
              ravaleurs et couvreurs. Tout chantier visible depuis l&apos;espace
              public — ravalement, percement de façade, modification de menuiseries,
              reprise de toiture — passe par l&apos;avis de l&apos;Architecte des
              Bâtiments de France (ABF). Les délais administratifs y sont longs,
              parfois plusieurs mois, ce qui complique la projection du planning.
              Nexartis permet d&apos;enregistrer ces contraintes directement dans
              la fiche chantier et d&apos;anticiper les périodes d&apos;attente
              ABF.
            </p>

            <p>
              La <strong>pierre de Lyon</strong>, ce calcaire jaune doré qui
              caractérise les immeubles de la Presqu&apos;île, demande des
              techniques de ravalement spécifiques : nettoyage doux,
              rejointoiement à la chaux, traitement des encrassements urbains.
              Les ravaleurs lyonnais accumulent un savoir-faire que les devis
              doivent refléter avec précision. Les modèles enregistrables de
              Nexartis permettent de capitaliser sur vos chiffrages récurrents
              au lieu de tout réécrire à chaque chantier.
            </p>

            <p>
              Les <strong>immeubles canuts de la Croix-Rousse</strong> — hauteurs
              sous plafond de 3,60 à 4 mètres, héritage du tissage de la soie au
              XIXe — sont un terrain de jeu quotidien pour les plaquistes,
              électriciens et plombiers. Échafaudages intérieurs, dépose de
              plafonds anciens, mise aux normes électriques en site occupé :
              ces chantiers réclament un planning d&apos;équipe partagé entre
              corps d&apos;état pour synchroniser les interventions. Pour les
              <Link href="/logiciel-devis-electricien" className="text-orange underline-offset-2 hover:underline"> électriciens</Link>, c&apos;est un gain de visibilité crucial.
            </p>

            <p>
              L&apos;éco-quartier <strong>Confluence</strong> (2e arrondissement)
              et la construction neuve BBC/Passivhaus génèrent une demande forte
              en VMC double flux, étanchéité à l&apos;air et menuiseries
              performantes. Côté rénovation, les canicules estivales saturent les
              carnets des <Link href="/logiciel-devis-plombier" className="text-orange underline-offset-2 hover:underline">plombiers-chauffagistes</Link> lyonnais sur les pompes à chaleur et la
              climatisation de mars à octobre. Anticiper, prioriser, ne pas oublier
              un client : voilà ce qu&apos;un outil de gestion bien conçu doit
              permettre.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ locales enrichies ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Questions spécifiques aux artisans de Lyon
          </h2>

          <div className="mt-10 space-y-6">
            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Nexartis fonctionne-t-il en Secteur Sauvegardé du Vieux Lyon ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Vous pouvez indiquer dans chaque fiche chantier si
                l&apos;adresse se situe dans le périmètre UNESCO du Vieux Lyon ou
                en zone classée ABF (Architectes des Bâtiments de France). Le
                planning prend en compte les délais administratifs de validation,
                souvent longs sur les chantiers du 5e arrondissement. Vous pouvez
                joindre les autorisations ABF aux devis et factures pour
                conserver une traçabilité complète. Utile aussi sur les rues
                pentues de la Croix-Rousse et les abords de Fourvière.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Puis-je gérer mes chantiers dans toute la Métropole de Lyon ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui, sans aucune limite. Que vous interveniez dans les 9
                arrondissements de Lyon, à Villeurbanne, Vénissieux, Bron,
                Saint-Priest, Caluire-et-Cuire, Tassin-la-Demi-Lune ou jusqu&apos;à
                Meyzieu et Rillieux-la-Pape, Nexartis fonctionne sur mobile depuis
                n&apos;importe quel chantier. L&apos;application est pensée pour
                le terrain : devis créé depuis votre véhicule, photo du chantier,
                envoi par SMS au client. Les 59 communes de la Métropole sont
                couvertes sans surcoût.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Le logiciel gère-t-il la TVA à 5,5% pour les chantiers BBC de Confluence ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Nexartis applique automatiquement les trois taux de TVA en
                vigueur (5,5% pour la rénovation énergétique éligible, 10% pour
                les travaux d&apos;amélioration de logements de plus de deux ans,
                20% en taux normal). L&apos;attestation de TVA simplifiée —
                obligatoire pour vos clients particuliers — est générée
                automatiquement et jointe au devis. Pratique pour les artisans
                RGE de la Métropole qui enchaînent les chantiers MaPrimeRénov&apos;,
                qu&apos;il s&apos;agisse d&apos;isolation à Vaise ou de PAC dans
                un pavillon d&apos;Écully.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Comment Nexartis aide les artisans face aux canicules lyonnaises ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Le planning visuel détecte automatiquement les conflits
                d&apos;affectation et alerte en cas de surcharge. Quand les
                températures montent et que les demandes de pompes à chaleur, de
                climatisation et de bornes IRVE saturent le carnet, le tableau
                de bord donne une vision claire des chantiers à venir, des devis
                en attente de signature et des factures impayées. Les relances
                clients partent automatiquement, ce qui évite de courir après
                les paiements pendant la haute saison. Comparez avec
                d&apos;autres solutions du marché sur notre <Link href="/blog/obat-avis" className="text-orange underline-offset-2 hover:underline">page d&apos;avis Obat</Link>.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── Fondateur ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Pensé pour les artisans de la Métropole de Lyon
          </h2>

          <div className="mt-8 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Nexartis est développé au Haillan, en périphérie de Bordeaux, mais
              le logiciel est construit en lien direct avec des artisans de
              plusieurs régions, y compris lyonnais. Le fondateur de Nexartis,
              à l&apos;écoute des artisans du BTP, recueille les retours des
              plombiers, électriciens et maçons qui interviennent dans la
              Métropole de Lyon — du Vieux Lyon aux communes de l&apos;Est. Chaque
              fonctionnalité est testée et validée avec des artisans avant
              d&apos;être déployée, ce qui explique la simplicité d&apos;usage du
              logiciel sur le terrain.
            </p>

            <p className="mt-5">
              Pour découvrir les offres et démarrer, rendez-vous sur la
              <Link href="/tarifs" className="text-orange underline-offset-2 hover:underline"> page tarifs</Link> ou
              <Link href="/register" className="text-orange underline-offset-2 hover:underline"> créez votre compte</Link> en
              quelques secondes. L&apos;essai de 14 jours est complet, sans carte
              bancaire et sans engagement.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
