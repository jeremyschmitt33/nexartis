import { Metadata } from "next";
import Link from "next/link";
import LocalPageTemplate from "@/components/LocalPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Artisan Bordeaux — Nexartis | Fait en Gironde | dès 15€/mois",
  description:
    "Nexartis, le logiciel artisan créé à Bordeaux. Devis, factures, planning pour les artisans BTP de Gironde et de la Métropole. Dès 15€ HT/mois.",
  alternates: {
    canonical: '/logiciel-artisan-bordeaux',
  },
};

const data = {
  ville: "Bordeaux",
  region: "Gironde",
  codePostal: "33",
  h1: "Logiciel artisan à Bordeaux — Nexartis, fait en Gironde",
  metaTitle:
    "Logiciel Artisan Bordeaux — Nexartis | Fait en Gironde | dès 15€/mois",
  metaDescription:
    "Nexartis, le logiciel artisan créé à Bordeaux. Devis, factures, planning pour les artisans BTP de Gironde et de la Métropole. Dès 15€ HT/mois.",
  specificite:
    "Nexartis est né à Bordeaux, au cœur de la Gironde. Conçu pour les artisans du BTP de la Métropole, le logiciel gère les devis, factures et planning de chantier avec les spécificités locales : rénovation des échoppes bordelaises, chantiers en Secteur Sauvegardé UNESCO, et la forte demande en rénovation énergétique depuis 2020. Une réponse aux besoins quotidiens des plombiers, maçons, électriciens, charpentiers et couvreurs girondins.",
  temoignage: {
    quote:
      "Je suis plombier-chauffagiste à Mérignac, je tourne sur une vingtaine de chantiers par mois entre Bordeaux et la rocade. Avant Nexartis, je perdais facilement 6 heures par semaine sur les devis et les factures le dimanche soir. Aujourd'hui, je fais mes devis depuis ma camionnette, le client signe sur son téléphone, et la facture part toute seule.",
    nom: "Pierre M.",
    metier: "Plombier-chauffagiste",
    ville: "Mérignac (33)",
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
            Nexartis et les artisans bordelais
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              La <strong>Gironde</strong> compte plusieurs milliers d&apos;artisans du BTP
              répartis sur les 28 communes de Bordeaux Métropole et au-delà. Le tissu
              local est dense, soudé, et marqué par une activité soutenue depuis le
              regain démographique des années 2010. Plombiers, électriciens, maçons,
              charpentiers, couvreurs, peintres et carreleurs y font face à une
              demande structurelle en rénovation, alimentée par un parc immobilier
              ancien (échoppes, maisons de pierre, immeubles haussmanniens) et par
              l&apos;arrivée continue de nouveaux propriétaires.
            </p>

            <p>
              Cette dynamique s&apos;accompagne d&apos;une saisonnalité bien connue :
              le climat océanique de la métropole concentre les chantiers
              extérieurs au printemps (mars à juin) et à l&apos;automne (septembre
              à novembre). Les pluies d&apos;hiver compliquent ravalement, toiture
              et VRD ; les canicules estivales depuis 2022 ont fait exploser la
              demande en pompes à chaleur et climatisation. Résultat : un artisan
              girondin doit jongler avec un planning serré aux intersaisons et
              une trésorerie qui suit ces pics.
            </p>

            <p>
              La transition énergétique a, depuis 2020, transformé le quotidien des
              artisans bordelais. MaPrimeRénov&apos;, les CEE et les aides régionales
              Nouvelle-Aquitaine ont multiplié les chantiers d&apos;isolation, de
              changement de chaudière et d&apos;installation de PAC. Ces dispositifs
              imposent une rigueur administrative nouvelle : devis détaillés,
              mention de certification TVA à 5,5%, traçabilité des matériaux. Nexartis a
              été pensé pour absorber cette charge sans alourdir le terrain. Avec
              une offre dès <strong>15€ HT/mois</strong>, l&apos;outil reste accessible
              au plus petit artisan tout en couvrant l&apos;essentiel administratif.
              <Link href="/register" className="text-orange underline-offset-2 hover:underline"> Essai gratuit 14 jours</Link>, sans carte bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* ── Cas d'usage local ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Un cas concret : plombier-chauffagiste à Mérignac
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Imaginez la semaine type d&apos;un plombier-chauffagiste basé à Mérignac.
              Lundi matin, dépannage chaudière chez un client de Caudéran. L&apos;après-midi,
              installation d&apos;une pompe à chaleur dans un pavillon de Talence — devis
              déjà signé via la signature électronique. Mardi, retour sur une échoppe
              bordelaise dans les Chartrons où l&apos;humidité ascensionnelle a abîmé les
              canalisations. Mercredi, intervention urgente à Pessac, puis chiffrage
              d&apos;une rénovation complète de salle de bains à Bègles. Jeudi et
              vendredi, gros chantier de copropriété au Bouscat.
            </p>

            <p>
              Sans logiciel adapté, ce rythme se traduit par un dimanche soir entier à
              rattraper les devis et factures. Avec Nexartis, chaque intervention
              est saisie depuis la camionnette : un devis créé en 3 minutes, envoyé
              par SMS, signé sur le téléphone du client. La facture est générée
              dans la foulée, <strong>prête pour la facturation électronique</strong>, et
              un bouton « Relancer » en un clic en cas d&apos;impayé. Le planning
              visuel évite les doubles affectations entre la rocade A630 et le centre.
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
              Nexartis accompagne les artisans sur l&apos;ensemble de la Métropole et
              de la périphérie girondine. Du centre historique aux communes
              limitrophes, le logiciel s&apos;adapte à votre zone d&apos;activité
              quotidienne et permet de classer vos chantiers par secteur géographique
              dans le planning.
            </p>

            <p>
              Les artisans utilisateurs interviennent typiquement sur :
              Bordeaux Centre, Caudéran, Chartrons, Bastide, Saint-Augustin,
              Saint-Pierre, Mérignac, Pessac, Talence, Bègles, Le Bouscat, Bruges,
              Bassens, Le Haillan, Cestas, Gradignan, Villenave-d&apos;Ornon, Eysines,
              Saint-Médard-en-Jalles et Floirac. Les zones d&apos;activité comme la
              ZI de Bruges, la ZA Bordeaux-Nord ou le pôle de Mérignac-aéroport
              concentrent une grande partie des chantiers tertiaires et industriels,
              tandis que les vignobles de Gironde génèrent une activité de gros
              œuvre spécifique (bâtiments d&apos;exploitation, chais, restauration
              de domaines viticoles).
            </p>

            <p>
              Que vous soyez basé au Haillan ou que vous interveniez jusqu&apos;à
              Libourne, votre <Link href="/tarifs" className="text-orange underline-offset-2 hover:underline">abonnement Nexartis</Link> reste le même —
              pas de surcoût lié à la distance ou au nombre de communes desservies.
            </p>
          </div>
        </div>
      </section>

      {/* ── Spécificités métier ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Spécificités métier à Bordeaux
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              <strong>L&apos;humidité girondine</strong> est une réalité quotidienne pour
              les plombiers VRD et les charpentiers. Remontées capillaires dans les
              caves bordelaises, traitement préventif des bois en charpente,
              ventilation des combles : ce sont des prestations récurrentes, à
              chiffrer précisément dans chaque devis. Nexartis permet de
              capitaliser sur vos modèles : un descriptif type, des lignes
              récurrentes, et un devis prêt en quelques minutes au lieu d&apos;une
              heure passée à rédiger.
            </p>

            <p>
              La <strong>pierre bordelaise</strong> impose sa logique aux maçons et
              ravaleurs. Le Secteur Sauvegardé classé UNESCO couvre une grande partie
              du centre historique — environ 150 hectares autour du Port de la Lune.
              Tout chantier de ravalement, percement de façade ou modification visible
              y est soumis à l&apos;avis de l&apos;Architecte des Bâtiments de France
              (ABF). Les délais administratifs y sont longs, ce qui complique la
              gestion du planning. Nexartis permet d&apos;enregistrer ces contraintes
              directement dans la fiche chantier et d&apos;anticiper les périodes
              d&apos;attente. Pour les <Link href="/logiciel-devis-maconnerie" className="text-orange underline-offset-2 hover:underline">maçons</Link>, c&apos;est un gain de visibilité crucial.
            </p>

            <p>
              La <strong>rénovation d&apos;échoppes</strong> reste l&apos;un des
              chantiers types de l&apos;agglomération. Ces maisons étroites et
              profondes, typiques des quartiers Caudéran, Saint-Augustin ou
              Saint-Pierre, posent des défis spécifiques : planchers à reprendre,
              poutres à traiter, humidité ascensionnelle à juguler, agrandissement
              vertical fréquent. Maçons, plombiers et électriciens se croisent sur
              ces chantiers — un planning d&apos;équipe partagé devient vite
              indispensable pour synchroniser les corps d&apos;état.
            </p>

            <p>
              Enfin, la <strong>climatisation et la pompe à chaleur</strong> explosent
              depuis les canicules de 2022 à 2024. Les <Link href="/logiciel-devis-plombier" className="text-orange underline-offset-2 hover:underline">plombiers-chauffagistes</Link> bordelais voient leur carnet de commandes saturé
              de mars à octobre. Anticiper, prioriser, ne pas oublier un client : voilà
              ce qu&apos;un outil de gestion bien conçu doit permettre.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ locales enrichies ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Questions spécifiques aux artisans de Bordeaux
          </h2>

          <div className="mt-10 space-y-6">
            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Nexartis fonctionne-t-il en Secteur Sauvegardé UNESCO de Bordeaux ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Vous pouvez indiquer dans chaque fiche chantier si l&apos;adresse
                est située en Secteur Sauvegardé ou en zone classée ABF (Architectes
                des Bâtiments de France). Le planning prend en compte les délais
                administratifs de validation, et vous pouvez joindre les autorisations
                ABF aux devis et factures pour conserver une traçabilité complète. Une
                fonctionnalité utile sur les chantiers de Saint-Pierre, Saint-Michel,
                Chartrons ou Triangle d&apos;Or.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Puis-je gérer mes chantiers dans toute la Métropole de Bordeaux ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui, sans aucune limite. Que vous interveniez à Bordeaux centre, à
                Mérignac, à Pessac, à Talence ou jusqu&apos;à Cestas et Saint-Médard,
                Nexartis fonctionne sur mobile depuis n&apos;importe quel chantier.
                L&apos;application est conçue pour le terrain : vous créez un devis
                depuis votre véhicule, vous prenez une photo du chantier, vous
                l&apos;envoyez par SMS au client. Le tout en couvrant les 28 communes
                de Bordeaux Métropole.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Le logiciel gère-t-il la TVA à 5,5% pour les chantiers MaPrimeRénov&apos; en Gironde ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Nexartis applique automatiquement les trois taux de TVA en
                vigueur (5,5% pour la rénovation énergétique éligible, 10% pour les
                travaux d&apos;amélioration de logements de plus de deux ans, 20% en
                taux normal). La mention de certification TVA réduite est ajoutée
                automatiquement à vos devis et factures (l&apos;attestation papier
                a été supprimée en 2025, elle est désormais remplacée par cette
                mention). Un point particulièrement utile pour les artisans RGE de
                Gironde qui réalisent de nombreux chantiers aidés.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Comment Nexartis aide les artisans face au pic d&apos;activité du printemps girondin ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Le planning visuel détecte automatiquement les conflits
                d&apos;affectation et alerte en cas de surcharge. De mars à juin, quand
                le carnet déborde, le tableau de bord donne une vision claire des
                chantiers à venir, des devis en attente de signature et des factures
                impayées. Les relances clients partent automatiquement, ce qui évite
                de courir après les paiements pendant la haute saison. Comparez avec
                d&apos;autres solutions du marché sur notre <Link href="/blog/tolteck-avis" className="text-orange underline-offset-2 hover:underline">page d&apos;avis Tolteck</Link>.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── Fondateur ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Conçu en Gironde, pour les artisans de Bordeaux
          </h2>

          <div className="mt-8 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Nexartis est développé au Haillan, en périphérie de Bordeaux. Le
              fondateur de Nexartis, à l&apos;écoute des artisans du BTP, partage le
              quotidien des plombiers, maçons et électriciens girondins depuis le
              début du projet. Chaque fonctionnalité est testée et validée avec des
              artisans bordelais avant d&apos;être déployée — une approche locale qui
              explique la simplicité d&apos;usage du logiciel sur le terrain.
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
