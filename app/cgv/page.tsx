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
        <p className="mt-3 text-sm text-navy/60">Dernière mise à jour : 8 juin 2026</p>
      </header>

      <div className="prose prose-slate max-w-none font-manrope text-[15px] leading-relaxed text-navy">
        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">Article 1 — Objet</h2>
          <p>
            Les présentes conditions générales de vente (ci-après « CGV ») ont pour objet de définir les modalités
            de mise à disposition par l&apos;entreprise individuelle <strong>Nexartis</strong>, exploitée par
            Jérémy SCHMITT, dont le siège est situé 144 avenue Pasteur, 33185 Le Haillan, immatriculée sous le
            numéro SIRET 840 059 687 00029 (ci-après l&apos;« Éditeur ») du logiciel <strong>Nexartis</strong>{' '}
            (ci-après le « Service ») au profit de tout utilisateur (ci-après le « Client ») souscrivant à un
            abonnement. Une version complète de l&apos;identification de l&apos;Éditeur figure sur la page{' '}
            <Link href="/mentions-legales" className="text-sky underline-offset-4 hover:underline">
              mentions légales
            </Link>
            .
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
            suspendu et les données conservées pendant une durée de <strong>90 jours</strong>, durant laquelle
            le Client peut réactiver son compte ou exporter ses données. Au-delà de ce délai, les données sont
            supprimées définitivement, sauf obligation légale de conservation plus longue.
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
            . L&apos;Éditeur bénéficie de la franchise en base de TVA (article 293 B du Code général des impôts) :
            les prix affichés sont exprimés en euros toutes taxes comprises (TTC) et correspondent au montant
            effectivement prélevé, aucune TVA n&apos;étant facturée. La mention « TVA non applicable, art. 293 B du
            CGI » figure sur l&apos;ensemble des factures émises par l&apos;Éditeur.
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
            <strong>contact.nexartis@gmail.com</strong>.
          </p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6 mb-2">
            9 bis.3 — Hébergement et portabilité des données
          </h3>
          <p>
            Les données applicatives du Client (devis, factures, clients, chantiers, équipe, prestations)
            sont hébergées au sein de l&apos;Union européenne, dans la région européenne de notre
            sous-traitant Supabase (centres de données situés en Allemagne). Le frontal applicatif est servi
            via le réseau global de Vercel Inc. (États-Unis), dans le cadre des Clauses Contractuelles Types
            adoptées par la Commission européenne pour les transferts hors UE. Aucune donnée du Client
            n&apos;est transmise, vendue ou commercialisée à des tiers, sauf obligation légale. Le Client
            peut à tout moment exporter l&apos;intégralité de ses données depuis son espace personnel
            (formats CSV et PDF), ou sur simple demande adressée à <strong>contact.nexartis@gmail.com</strong>.
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
            <strong>Médiateur de la consommation</strong> : adhésion en cours auprès du <strong>CM2C (Centre
            de la Médiation de la Consommation des Conciliateurs)</strong>. Les coordonnées complètes du
            médiateur (adresse postale et plateforme en ligne) seront mises à jour dans la présente clause
            dès finalisation de l&apos;adhésion. Dans l&apos;intervalle, tout Client consommateur souhaitant
            engager une procédure de médiation est invité à contacter l&apos;Éditeur à l&apos;adresse
            <strong> contact.nexartis@gmail.com</strong> qui lui transmettra les coordonnées du médiateur
            sous 48 heures ouvrées.
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
            Les présentes CGV sont soumises au droit français.
          </p>
          <p>
            <strong>Pour les Clients professionnels (B2B)</strong> : tout litige relatif à leur
            interprétation ou à leur exécution sera soumis à la compétence exclusive des tribunaux
            français du ressort du siège social de l&apos;Éditeur.
          </p>
          <p>
            <strong>Pour les Clients consommateurs (B2C)</strong> : conformément aux articles R.631-3
            du Code de la consommation et 46 du Code de procédure civile, le Client consommateur peut
            saisir, à son choix, soit la juridiction du lieu où il demeurait au moment de la conclusion
            du contrat, soit la juridiction du lieu où le fait dommageable s&apos;est produit, soit la
            juridiction du siège de l&apos;Éditeur.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 11 bis — Garantie légale de conformité et garantie des vices cachés
          </h2>
          <p>
            Conformément aux articles L.224-25-12 et suivants du Code de la consommation, le Service
            bénéficie pour les Clients consommateurs de la garantie légale de conformité.
            L&apos;Éditeur s&apos;engage à fournir un Service conforme au contrat et exempt de défaut
            de conformité dès sa mise à disposition et tout au long de la durée de l&apos;abonnement.
          </p>
          <p>
            En cas de défaut de conformité, le Client consommateur peut demander la mise en conformité
            du Service, gratuitement et dans un délai raisonnable, sans inconvénient majeur pour lui.
            À défaut, il peut obtenir une réduction du prix ou la résolution du contrat dans les
            conditions prévues aux articles L.224-25-19 et suivants du Code de la consommation.
          </p>
          <p>
            Le Client bénéficie également de la garantie des vices cachés au titre des articles
            1641 et suivants du Code civil. Dans ce cadre, il peut choisir entre la résolution
            de la vente ou la réduction du prix conformément à l&apos;article 1644 du Code civil.
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
