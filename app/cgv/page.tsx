import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions générales de vente — Nexartis',
  description:
    'Conditions générales de vente du logiciel Nexartis, service réservé aux professionnels : abonnement, prix, paiement, garanties, résiliation.',
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
        <p className="mt-3 text-sm text-navy/60">Dernière mise à jour : 24 juin 2026</p>
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
            Le Service est <strong>réservé aux professionnels</strong>. Est un Client tout professionnel, personne
            physique ou morale, agissant à des fins qui entrent dans le cadre de son activité commerciale,
            artisanale, industrielle, libérale ou agricole (notamment les artisans, auto-entrepreneurs et
            entreprises du bâtiment et du service). Le Service n&apos;est destiné ni aux consommateurs ni aux
            non-professionnels au sens de l&apos;article liminaire du Code de la consommation.
          </p>
          <p>
            En souscrivant, le Client déclare et garantit agir pour les besoins de son activité professionnelle,
            en avoir le pouvoir, et fournir un numéro SIRET valide et à jour. Cette déclaration constitue une
            condition essentielle et déterminante du contrat. Toute souscription effectuée en dehors de cette
            qualité est susceptible d&apos;être refusée ou résiliée de plein droit par l&apos;Éditeur, sans préjudice
            des sommes dues au titre de la période d&apos;utilisation. La souscription au Service implique
            l&apos;acceptation sans réserve des présentes CGV.
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
            Article 6 — Absence de droit de rétractation
          </h2>
          <p>
            Le droit de rétractation prévu par le Code de la consommation (articles L.221-18 et suivants) bénéficie
            aux seuls consommateurs. Le Service étant réservé aux professionnels et le Client agissant en qualité
            de professionnel pour les besoins de son activité, ce droit ne lui est pas applicable. La période
            d&apos;essai gratuit de 14 jours prévue à l&apos;article 3 permet néanmoins au Client d&apos;évaluer
            le Service sans engagement avant toute souscription payante.
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
            Article 10 — Réclamation et médiation
          </h2>
          <p>
            Pour toute réclamation, le Client est invité à contacter préalablement l&apos;Éditeur à l&apos;adresse{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            , afin qu&apos;une solution amiable soit recherchée.
          </p>
          <p>
            Le Service s&apos;adressant exclusivement à des professionnels, le dispositif de médiation de la
            consommation n&apos;a pas vocation à régir les relations contractuelles de l&apos;Éditeur. À titre de
            simple précaution et de manière volontaire, l&apos;Éditeur a néanmoins adhéré à un médiateur de la
            consommation. En conséquence, dans la seule hypothèse résiduelle où un Client serait amené à agir en
            qualité de consommateur ou de non-professionnel au sens du Code de la consommation, et après avoir
            saisi l&apos;Éditeur d&apos;une réclamation écrite restée sans réponse satisfaisante, celui-ci pourrait
            recourir gratuitement à une procédure de médiation de la consommation auprès de :
          </p>
          <p>
            <strong>CM2C</strong>
            <br />
            49 rue de Ponthieu, 75008 Paris
            <br />
            Tél. : 01 89 47 00 14
            <br />
            Site internet :{' '}
            <a
              href="https://www.cm2c.net/declarer-un-litige.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky underline-offset-4 hover:underline"
            >
              www.cm2c.net/declarer-un-litige.php
            </a>
            <br />
            Email : <a href="mailto:litiges@cm2c.net" className="text-sky underline-offset-4 hover:underline">litiges@cm2c.net</a>
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
            Le Client agissant en qualité de professionnel, tout litige relatif à l&apos;interprétation ou à
            l&apos;exécution des présentes CGV sera soumis à la compétence exclusive des tribunaux français du
            ressort du siège de l&apos;Éditeur, à défaut de résolution amiable.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            Article 11 bis — Conformité du Service et garantie contractuelle
          </h2>
          <p>
            L&apos;Éditeur s&apos;engage à fournir un Service conforme à sa description en vigueur au jour de la
            souscription et à mettre en œuvre les moyens raisonnables pour en assurer la disponibilité et le bon
            fonctionnement. En cas de non-conformité signalée par le Client, l&apos;Éditeur s&apos;efforcera d&apos;y
            remédier dans un délai raisonnable, par correction ou contournement.
          </p>
          <p>
            Cette garantie est de nature contractuelle. Le Client agissant en qualité de professionnel, les
            garanties légales prévues par le Code de la consommation au bénéfice des consommateurs ou des
            non-professionnels ne s&apos;appliquent pas à la présente relation.
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
