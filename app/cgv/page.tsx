import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions générales de vente — Nexartis',
  description:
    'Conditions générales de vente du logiciel Nexartis : abonnement, prix, paiement, rétractation, résiliation.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/cgv',
  },
}

export default function CgvPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <header className="mb-10">
        <p className="font-manrope text-sm font-semibold uppercase tracking-wider text-orange">
          Informations légales
        </p>
        <h1 className="mt-2 font-syne text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Conditions Générales de Vente
        </h1>
        <p className="mt-3 text-sm text-navy/60">Dernière mise à jour : 20 mai 2026</p>
      </header>

      <div className="prose prose-slate max-w-none font-manrope text-[15px] leading-relaxed text-navy">
        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 1 — Objet</h2>
          <p>
            Les présentes conditions générales de vente (ci-après « CGV ») ont pour objet de définir les modalités
            de mise à disposition par <strong>[Nexartis — éditeur à compléter]</strong> (ci-après l&apos;« Éditeur »)
            du logiciel <strong>Nexartis</strong> (ci-après le « Service ») au profit de tout utilisateur (ci-après
            le « Client ») souscrivant à un abonnement.
          </p>
          <p>
            Le Service est destiné à un usage professionnel par les artisans, les auto-entrepreneurs et les
            entreprises du bâtiment et du service. La souscription au Service implique l&apos;acceptation sans
            réserve des présentes CGV.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 2 — Description du Service</h2>
          <p>
            Nexartis est un logiciel en ligne (SaaS — Software as a Service) qui permet la gestion de devis,
            de factures, de chantiers, de plannings, de clients et de paiements pour les professionnels
            artisans en France.
          </p>
          <p>
            Le Service est accessible 7 jours sur 7, 24 heures sur 24, sous réserve des interruptions
            programmées pour maintenance et des cas de force majeure. L&apos;Éditeur s&apos;engage à informer les
            Clients des interruptions programmées et à les limiter dans le temps.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 3 — Période d&apos;essai gratuit
          </h2>
          <p>
            Le Service est proposé avec une période d&apos;essai gratuit de <strong>14 jours</strong> sans
            engagement et sans saisie de carte bancaire. À l&apos;issue de cette période, le Client peut souscrire
            à un abonnement payant pour continuer à utiliser le Service. À défaut, l&apos;accès au compte sera
            suspendu, sans perte des données pendant une durée de [À COMPLÉTER — ex : 90 jours].
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 4 — Tarifs et modalités de paiement
          </h2>
          <p>
            Les tarifs en vigueur sont indiqués sur la page{' '}
            <Link href="/tarifs" className="text-sky underline-offset-4 hover:underline">
              Tarifs
            </Link>
            . L&apos;abonnement standard est facturé <strong>25 € HT par mois</strong>, soit{' '}
            <strong>30 € TTC</strong> (TVA française 20 % applicable).
          </p>
          <p>
            Le paiement est effectué par prélèvement automatique mensuel via notre prestataire de paiement
            Stripe (Stripe Payments Europe Ltd.). Les moyens de paiement acceptés sont : cartes bancaires
            Visa, Mastercard, American Express, ainsi que SEPA Direct Debit selon disponibilité.
          </p>
          <p>
            En cas d&apos;échec de prélèvement, le Client en sera informé par email. Une seconde tentative aura
            lieu sous 3 jours. Si l&apos;échec persiste, l&apos;accès au Service pourra être suspendu jusqu&apos;à
            régularisation.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 5 — Durée et résiliation
          </h2>
          <p>
            L&apos;abonnement est conclu pour une durée indéterminée. Le Client peut résilier à tout moment depuis
            son espace personnel, dans la section <strong>« Abonnement »</strong>. La résiliation prend effet
            à la fin de la période d&apos;abonnement en cours. Aucun remboursement n&apos;est dû pour la période
            entamée.
          </p>
          <p>
            L&apos;Éditeur se réserve le droit de résilier l&apos;abonnement, après notification préalable du Client,
            en cas de manquement grave aux présentes CGV (utilisation frauduleuse, atteinte à la sécurité du
            Service, défaut de paiement).
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 6 — Droit de rétractation
          </h2>
          <p>
            <strong>Clients professionnels (B2B)</strong> : conformément à l&apos;article L.221-3 du Code de la
            consommation, le droit de rétractation ne s&apos;applique pas aux contrats conclus à des fins
            professionnelles entre professionnels.
          </p>
          <p>
            <strong>Clients particuliers (B2C)</strong> : en cas de souscription à titre privé, le Client
            dispose d&apos;un délai de 14 jours à compter de la souscription pour exercer son droit de
            rétractation, sans avoir à se justifier. Ce droit s&apos;exerce par email à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            . Toutefois, conformément à l&apos;article L.221-28 du Code de la consommation, le droit de
            rétractation ne peut être exercé pour les contrats de fourniture de contenu numérique non
            fourni sur support matériel dont l&apos;exécution a commencé après accord préalable exprès du
            consommateur et renoncement exprès à son droit de rétractation.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 7 — Données du Client</h2>
          <p>
            Le Client reste propriétaire de l&apos;ensemble des données qu&apos;il saisit ou importe dans le Service
            (clients, devis, factures, chantiers, etc.). L&apos;Éditeur ne peut en aucun cas les exploiter à
            d&apos;autres fins que la fourniture du Service.
          </p>
          <p>
            En cas de résiliation, le Client dispose d&apos;un délai de 90 jours pour exporter ses données. Au-delà,
            les données seront supprimées définitivement. Une fonction d&apos;export au format CSV/Excel est
            disponible à tout moment depuis l&apos;espace personnel.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 8 — Obligations du Client</h2>
          <p>Le Client s&apos;engage à :</p>
          <ul className="list-disc pl-6">
            <li>fournir des informations exactes lors de son inscription ;</li>
            <li>maintenir la confidentialité de ses identifiants ;</li>
            <li>utiliser le Service conformément à sa destination ;</li>
            <li>ne pas tenter d&apos;accéder à des comptes autres que le sien ;</li>
            <li>ne pas porter atteinte au fonctionnement ou à la sécurité du Service ;</li>
            <li>respecter les lois et règlements en vigueur en France.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 9 — Responsabilité</h2>
          <p>
            L&apos;Éditeur s&apos;engage à mettre en œuvre tous les moyens raisonnables pour assurer la disponibilité
            et la sécurité du Service. Toutefois, l&apos;Éditeur ne saurait être tenu responsable des dommages
            indirects, pertes de données, pertes d&apos;exploitation ou préjudices commerciaux résultant de
            l&apos;utilisation ou de l&apos;indisponibilité du Service.
          </p>
          <p>
            La responsabilité totale de l&apos;Éditeur est limitée au montant des sommes effectivement versées
            par le Client au cours des 12 derniers mois précédant l&apos;événement ayant causé le dommage.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 9 bis — Engagements qualité de l&apos;Éditeur
          </h2>
          <p>
            En complément de l&apos;article 9 ci-dessus, l&apos;Éditeur prend les trois engagements
            qualité suivants à l&apos;égard du Client, qui constituent des obligations contractuelles
            pleinement opposables.
          </p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6 mb-2">
            9 bis.1 — Préavis tarifaire
          </h3>
          <p>
            L&apos;Éditeur s&apos;engage à notifier toute modification du tarif d&apos;abonnement
            au Client par email officiel adressé à l&apos;adresse de contact renseignée dans son
            compte, avec un préavis minimum de <strong>soixante (60) jours calendaires</strong> avant
            la prise d&apos;effet de ladite modification. Le Client conserve la faculté de résilier
            son abonnement, sans frais ni pénalité, avant l&apos;entrée en vigueur du nouveau tarif.
          </p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6 mb-2">
            9 bis.2 — Engagement de disponibilité
          </h3>
          <p>
            L&apos;Éditeur s&apos;engage sur un taux de disponibilité minimum du Service de{' '}
            <strong>quatre-vingt-dix-neuf pour cent (99 %)</strong>, calculé sur le mois calendaire,
            hors interruptions programmées pour maintenance préalablement annoncées et hors cas de
            force majeure. En cas de non-respect de cet engagement, le Client a droit au remboursement
            intégral de la mensualité du mois concerné, sur simple demande adressée à{' '}
            <strong>contact@nexartis.fr</strong>.
          </p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6 mb-2">
            9 bis.3 — Hébergement et portabilité des données
          </h3>
          <p>
            Les données du Client sont hébergées sur des serveurs situés en <strong>France</strong>{' '}
            et ne sont en aucun cas transmises, vendues ou commercialisées à des tiers, sauf
            obligation légale. Le Client peut à tout moment exporter l&apos;intégralité de ses
            données aux formats CSV ou PDF depuis son espace personnel, ou sur simple demande
            adressée à <strong>contact@nexartis.fr</strong>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 10 — Médiation de la consommation (B2C)
          </h2>
          <p>
            Conformément à l&apos;article L.616-1 du Code de la consommation, en cas de litige entre un Client
            consommateur et l&apos;Éditeur n&apos;ayant pas pu être résolu à l&apos;amiable, le Client peut recourir
            gratuitement au médiateur de la consommation :
          </p>
          <p>
            <strong>[À COMPLÉTER — Nom du médiateur, adresse, lien plateforme. Ex : MEDIATION-NET CONSOMMATION, 10 rue de la Bourse, 75002 Paris, www.mediation-net-consommation.com]</strong>
          </p>
          <p>
            Le Client peut également recourir à la plateforme européenne de règlement en ligne des litiges :{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky underline-offset-4 hover:underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 11 — Droit applicable et juridiction
          </h2>
          <p>
            Les présentes CGV sont soumises au droit français. Tout litige relatif à leur interprétation
            ou à leur exécution sera soumis à la compétence exclusive des tribunaux français du ressort
            du siège social de l&apos;Éditeur, sauf disposition légale impérative contraire.
          </p>
        </section>

        <section>
          <h2 className="font-syne text-2xl font-bold text-navy">Article 12 — Modification des CGV</h2>
          <p>
            L&apos;Éditeur se réserve le droit de modifier à tout moment les présentes CGV. Le Client sera informé
            par email de toute modification substantielle au moins 30 jours avant son entrée en vigueur.
            En cas de désaccord, le Client peut résilier son abonnement.
          </p>
        </section>
      </div>
    </article>
  )
}
