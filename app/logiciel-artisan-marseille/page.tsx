import { Metadata } from "next";
import Link from "next/link";
import LocalPageTemplate from "@/components/LocalPageTemplate";

export const metadata: Metadata = {
  title: "Logiciel Artisan Marseille — Nexartis | Métropole Aix-Marseille | dès 15€/mois",
  description:
    "Nexartis pour les artisans BTP de Marseille et de la Métropole Aix-Marseille-Provence. Devis, factures, planning adaptés au climat méditerranéen. Dès 15€ HT/mois.",
  alternates: {
    canonical: '/logiciel-artisan-marseille',
  },
};

const data = {
  ville: "Marseille",
  region: "Bouches-du-Rhône",
  codePostal: "13",
  h1: "Logiciel artisan à Marseille — Nexartis, pensé pour le climat méditerranéen",
  metaTitle: "Logiciel Artisan Marseille — Nexartis | Métropole Aix-Marseille | dès 15€/mois",
  metaDescription:
    "Nexartis pour les artisans BTP de Marseille et de la Métropole Aix-Marseille-Provence. Devis, factures, planning adaptés au climat méditerranéen. Dès 15€ HT/mois.",
  specificite:
    "Nexartis accompagne les artisans du BTP de la Métropole Aix-Marseille-Provence, des 16 arrondissements de Marseille aux 92 communes alentour. Devis, factures et planning de chantier sont pensés pour les spécificités locales : opération Euroméditerranée, étés brûlants, Mistral hivernal, étanchéité de toits-terrasses, tuiles romaines, enduits à la chaux du centre historique et boom de la climatisation depuis les canicules.",
  temoignage: {
    quote:
      "Je suis couvreur-zingueur à Aubagne, je tourne entre le Vieux-Port, les calanques et la vallée de l'Huveaune. Après un coup de Mistral, je peux avoir cinq dépannages dans la même journée. Avec Nexartis, je fais un devis depuis la camionnette, le client signe sur son téléphone, et la facture part toute seule le soir.",
    nom: "Karim B.",
    metier: "Couvreur-zingueur",
    ville: "Aubagne (13)",
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
            Nexartis et les artisans marseillais
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              La <strong>Métropole Aix-Marseille-Provence</strong> regroupe 92 communes
              et près de 1,9 million d&apos;habitants. Le tissu BTP local y est dense :
              plusieurs milliers d&apos;artisans, des plombiers-chauffagistes aux
              couvreurs en passant par les maçons, ravaleurs, électriciens et
              menuisiers. Au cœur de cette métropole, l&apos;opération
              Euroméditerranée — l&apos;un des plus grands projets de rénovation
              urbaine d&apos;Europe sur 480 hectares — continue d&apos;alimenter un
              carnet de commandes nourri entre la Joliette, Arenc et la rue de la
              République.
            </p>

            <p>
              La saisonnalité méditerranéenne impose un rythme particulier. Les étés
              caniculaires, de plus en plus précoces depuis 2022, déclenchent une
              vague continue d&apos;installations de pompes à chaleur et de
              climatiseurs. Les épisodes de Mistral, fréquents en hiver et au
              printemps, abîment les toitures, arrachent des tuiles romaines,
              décollent des étanchéités sur les toits-terrasses du Prado ou de
              Sainte-Marguerite. Résultat : un artisan marseillais doit composer
              avec un planning très réactif, des dépannages d&apos;urgence et des
              pics d&apos;activité qui ne suivent pas toujours les saisons classiques.
            </p>

            <p>
              La transition énergétique a, ces dernières années, transformé le
              quotidien des artisans des Bouches-du-Rhône. MaPrimeRénov&apos;, les
              certificats d&apos;économie d&apos;énergie et les aides régionales
              Sud-PACA ont multiplié les chantiers d&apos;isolation et de
              rafraîchissement de l&apos;habitat. Ces dispositifs imposent une
              rigueur administrative nouvelle : devis détaillés, mention de
              certification TVA à 5,5%, mentions RGE, traçabilité. Nexartis a été pensé pour
              absorber cette charge sans alourdir le terrain. Avec une offre dès
              <strong> 15€ HT/mois</strong>, l&apos;outil reste accessible au plus
              petit artisan tout en couvrant l&apos;essentiel administratif.
              <Link href="/register" className="text-orange underline-offset-2 hover:underline"> Essai gratuit 14 jours</Link>, sans carte bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* ── Cas d'usage local ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Un cas concret : couvreur-zingueur à Aubagne
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Imaginez la semaine type d&apos;un couvreur-zingueur installé à
              Aubagne. Lundi matin, le Mistral a soufflé tout le week-end :
              première intervention chez un particulier de La Ciotat qui a perdu
              trois rangs de tuiles romaines. L&apos;après-midi, un rendez-vous
              devis sur une terrasse étanche du Prado (8e arrondissement). Mardi,
              reprise d&apos;une zinguerie dans un immeuble haussmannien du Vieux-Port
              — où l&apos;humidité du centre historique a fini par avoir raison du
              chéneau. Mercredi, gros chantier de réfection complète d&apos;une
              toiture sur une bastide à Cassis. Jeudi et vendredi, dépannage en
              urgence dans le 15e arrondissement et chiffrage d&apos;une étanchéité
              à Marignane.
            </p>

            <p>
              Sans logiciel adapté, ce rythme rime avec dimanche soir entier à
              rattraper devis et factures. Avec Nexartis, chaque intervention est
              saisie depuis la camionnette : un devis créé en quelques minutes,
              envoyé par SMS, signé sur le téléphone du client. La facture est
              générée dans la foulée, prête pour la facturation électronique, et un bouton
              « Relancer » en un clic en cas d&apos;impayé. Le planning visuel évite
              les doubles affectations entre la côte bleue, les calanques et la
              vallée de l&apos;Huveaune.
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
              Aix-Marseille-Provence et de la périphérie. Du centre historique
              jusqu&apos;à l&apos;étang de Berre, le logiciel s&apos;adapte à votre
              zone d&apos;activité quotidienne et permet de classer vos chantiers
              par secteur géographique dans le planning.
            </p>

            <p>
              Les artisans utilisateurs interviennent typiquement sur les
              arrondissements marseillais : le 1er (Belsunce, centre), le 2e
              (Joliette, Vieux-Port), le 6e (Préfecture), le 7e (Endoume, Pharo),
              le 8e (Périer, Prado), le 9e (Mazargues, Sainte-Marguerite), le 10e
              (Saint-Loup), le 11e (La Valentine), le 13e (Saint-Just,
              Château-Gombert), le 14e (Saint-Antoine), le 15e et le 16e
              (L&apos;Estaque). Côté Métropole, ils desservent Aix-en-Provence,
              Aubagne, Salon-de-Provence, Martigues, La Ciotat, Marignane,
              Vitrolles, Allauch, Plan-de-Cuques, Cassis, Carry-le-Rouet,
              Sausset-les-Pins, Châteauneuf-les-Martigues et Septèmes-les-Vallons.
              Les zones d&apos;activité de Vitrolles, des Milles à Aix, d&apos;Aubagne
              et de Marignane concentrent une grande partie des chantiers
              tertiaires et industriels.
            </p>

            <p>
              Que vous soyez basé à Aubagne ou que vous interveniez jusqu&apos;à
              Salon-de-Provence, votre <Link href="/tarifs" className="text-orange underline-offset-2 hover:underline">abonnement Nexartis</Link> reste le
              même — pas de surcoût lié à la distance ou au nombre de communes
              desservies.
            </p>
          </div>
        </div>
      </section>

      {/* ── Spécificités métier ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Spécificités métier à Marseille
          </h2>

          <div className="mt-8 space-y-5 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Les <strong>toitures en tuiles romaines</strong> — dites
              canal méditerranéennes — façonnent une grande partie du paysage bâti
              marseillais. Les couvreurs locaux sont régulièrement appelés après
              chaque épisode de Mistral pour reposer des rangs entiers, refaire
              des solins ou reprendre une zinguerie. Les <Link href="/logiciel-devis-couvreur" className="text-orange underline-offset-2 hover:underline">couvreurs marseillais</Link> ont besoin d&apos;un outil capable d&apos;enregistrer
              des chantiers urgents sans casser le planning de la semaine. Nexartis
              permet de glisser une intervention prioritaire dans la journée et
              d&apos;avertir automatiquement le client.
            </p>

            <p>
              Le centre historique — du Vieux-Port au Panier, en passant par Le
              Camas et Belsunce — est marqué par des immeubles des XVIIIe et
              XIXe siècles et une humidité ascensionnelle tenace. Les ravalements
              s&apos;y font à la chaux selon les techniques méditerranéennes
              traditionnelles, et un grand nombre de chantiers passent par l&apos;avis
              de l&apos;Architecte des Bâtiments de France, en particulier dans les
              quartiers protégés. Nexartis permet d&apos;enregistrer ces contraintes
              directement dans la fiche chantier et d&apos;anticiper les délais
              administratifs propres à ces zones. Une logique identique s&apos;applique
              autour du Parc National des Calanques, où chaque intervention en zone
              protégée doit être préparée avec précision.
            </p>

            <p>
              L&apos;<strong>étanchéité des toits-terrasses</strong> est une autre
              constante marseillaise. Du Prado à Sainte-Marguerite, en passant
              par les résidences des années 1970 du Roucas-Blanc ou les
              logements sociaux des 15e et 16e arrondissements, les étanchéités
              vieillissent vite sous l&apos;effet conjugué du soleil méditerranéen
              et du Mistral. Étancheurs, couvreurs et maçons se croisent
              régulièrement sur ces chantiers — un planning d&apos;équipe partagé
              devient vite indispensable pour synchroniser les corps d&apos;état.
            </p>

            <p>
              Enfin, la <strong>climatisation et la pompe à chaleur</strong> sont
              devenues le marché dominant des <Link href="/logiciel-devis-chauffagiste" className="text-orange underline-offset-2 hover:underline">plombiers-chauffagistes</Link> marseillais depuis les canicules de
              2022 à 2024. Les carnets de commandes sont saturés du printemps à
              l&apos;automne, avec un pic dès les premières chaleurs de mai.
              Anticiper, prioriser, ne pas oublier un client : voilà ce qu&apos;un
              outil de gestion bien conçu doit permettre, particulièrement dans
              une métropole où la demande dépasse souvent la capacité des artisans
              disponibles.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ locales enrichies ── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Questions spécifiques aux artisans de Marseille
          </h2>

          <div className="mt-10 space-y-6">
            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Nexartis fonctionne-t-il en zone protégée Calanques ou Vieux-Port ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Vous pouvez indiquer dans chaque fiche chantier si
                l&apos;adresse est située dans une zone soumise à l&apos;avis de
                l&apos;Architecte des Bâtiments de France — Vieux-Port, Panier,
                Belsunce, Roucas-Blanc ou périmètre du Parc National des
                Calanques. La mention apparaît automatiquement sur le devis et la
                facture, et le planning prend en compte les délais administratifs
                de validation. Vous pouvez joindre les autorisations aux documents
                pour conserver une traçabilité complète.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Puis-je gérer mes chantiers dans toute la Métropole Aix-Marseille-Provence ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui, sans aucune limite. Que vous interveniez à Marseille centre,
                à Aix-en-Provence, à Aubagne, à Martigues ou jusqu&apos;à
                Salon-de-Provence, Nexartis fonctionne sur mobile depuis
                n&apos;importe quel chantier. L&apos;application est conçue pour
                le terrain : vous créez un devis depuis votre véhicule, vous
                prenez une photo du chantier, vous l&apos;envoyez par SMS au client.
                Le tout en couvrant l&apos;ensemble des 92 communes de la Métropole.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Le logiciel gère-t-il la TVA à 5,5% pour la pose de pompes à chaleur et de climatiseurs ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Oui. Nexartis applique automatiquement les trois taux de TVA en
                vigueur (5,5% pour la rénovation énergétique éligible, 10% pour
                les travaux d&apos;amélioration de logements de plus de deux ans,
                20% en taux normal). La mention de certification TVA réduite est
                ajoutée automatiquement à vos devis et factures (l&apos;attestation
                papier a été supprimée en 2025, elle est désormais remplacée par
                cette mention). Un point particulièrement
                utile pour les artisans RGE QualiPAC des Bouches-du-Rhône qui
                installent beaucoup de PAC air-eau et de climatisations depuis
                les dernières canicules.
              </p>
            </details>

            <details className="group border-b border-navy/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-syne text-lg font-bold text-navy [&::-webkit-details-marker]:hidden">
                <span>Comment Nexartis aide après un coup de Mistral ?</span>
                <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-navy transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 font-manrope text-base leading-relaxed text-gray-600">
                Le planning visuel permet d&apos;insérer rapidement des
                interventions d&apos;urgence — toiture envolée, étanchéité
                arrachée, chéneau descellé — sans perdre la vue d&apos;ensemble
                de la semaine. La dictée vocale incluse dans l&apos;offre Complet
                permet de chiffrer un devis depuis le pied du chantier en quelques
                phrases. Les factures partent dans la foulée, ce qui évite de
                courir après la trésorerie après un pic d&apos;activité. Comparez
                avec d&apos;autres solutions du marché sur notre <Link href="/blog/obat-avis" className="text-orange underline-offset-2 hover:underline">page d&apos;avis Obat</Link>.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── Fondateur ── */}
      <section className="bg-cream py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-syne text-2xl font-extrabold text-navy md:text-3xl">
            Pensé pour les artisans de Marseille et de la Provence
          </h2>

          <div className="mt-8 font-manrope text-base leading-relaxed text-navy/75">
            <p>
              Le fondateur de Nexartis, à l&apos;écoute des artisans du BTP,
              partage le quotidien des couvreurs, plombiers-chauffagistes,
              ravaleurs et électriciens des Bouches-du-Rhône depuis le début du
              projet. Chaque fonctionnalité est testée et validée avec des
              artisans de terrain — y compris marseillais — avant d&apos;être
              déployée. C&apos;est cette approche qui explique la simplicité
              d&apos;usage du logiciel sur les chantiers, qu&apos;il s&apos;agisse
              d&apos;une intervention au Panier ou d&apos;une installation de PAC
              à Vitrolles.
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
