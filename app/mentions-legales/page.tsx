import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions légales — Nexartis',
  description:
    'Mentions légales du site nexartis.fr : éditeur, hébergeur, propriété intellectuelle.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/mentions-legales',
  },
}

export default function MentionsLegalesPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <header className="mb-10">
        <p className="font-manrope text-sm font-semibold uppercase tracking-wider text-orange">
          Informations légales
        </p>
        <h1 className="mt-2 font-syne text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Mentions légales
        </h1>
        <p className="mt-3 text-sm text-navy/60">
          Dernière mise à jour : 8 juin 2026
        </p>
      </header>

      <div className="prose prose-slate max-w-none font-manrope text-[15px] leading-relaxed text-navy">
        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">1. Éditeur du site</h2>
          <p>
            Le site <strong>nexartis.fr</strong> est édité par :
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Nom commercial</strong> : Nexartis
            </li>
            <li>
              <strong>Exploitant</strong> : Jérémy SCHMITT, entrepreneur individuel
            </li>
            <li>
              <strong>Forme juridique</strong> : Entreprise individuelle (micro-entreprise / auto-entrepreneur), régime de la franchise en base de TVA (article 293 B du Code général des impôts)
            </li>
            <li>
              <strong>Siège social</strong> : 144 avenue Pasteur, 33185 Le Haillan, France
            </li>
            <li>
              <strong>SIRET</strong> : 840 059 687 00029
            </li>
            <li>
              <strong>Code APE / NAF</strong> : 7022Z (Conseil pour les affaires et autres conseils de gestion)
            </li>
            <li>
              <strong>RCS</strong> : Non applicable (entreprise individuelle non immatriculée au Registre du commerce)
            </li>
            <li>
              <strong>Numéro de TVA intracommunautaire</strong> : Non applicable — Nexartis bénéficie de la franchise en base de TVA (art. 293 B du CGI). La mention « TVA non applicable, art. 293 B du CGI » est portée sur l&apos;ensemble des factures émises.
            </li>
            <li>
              <strong>Téléphone</strong> : Non communiqué — pour toute demande, merci d&apos;utiliser l&apos;adresse email ci-dessous.
            </li>
            <li>
              <strong>Email de contact</strong> :{' '}
              <a
                href="mailto:contact.nexartis@gmail.com"
                className="text-sky underline-offset-4 hover:underline"
              >
                contact.nexartis@gmail.com
              </a>
            </li>
            <li>
              <strong>Activité</strong> : édition et exploitation d&apos;une plateforme SaaS de gestion (devis, factures, planning) à destination des artisans et professionnels du bâtiment.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            2. Directeur de la publication
          </h2>
          <p>
            Le directeur de la publication est : <strong>Jérémy SCHMITT</strong>, en qualité d&apos;exploitant de l&apos;entreprise individuelle Nexartis.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">3. Hébergement</h2>
          <p>Le site est hébergé par :</p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Hébergeur principal (frontal applicatif)</strong> : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Téléphone : +1 (559) 288-7060.{' '}
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                vercel.com
              </a>
              . Le contenu est servi depuis le réseau mondial de points de présence (PoP) de Vercel ; un PoP situé dans l&apos;Union européenne est utilisé pour les visiteurs européens.
            </li>
            <li>
              <strong>Base de données applicative et stockage</strong> : Supabase, exploité par Supabase Inc., 970 Toa Payoh North #07-04, Singapour.{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                supabase.com
              </a>
              . Le projet Nexartis est configuré sur la région européenne (Francfort, Allemagne), garantissant que les données utilisateurs sont stockées sur le territoire de l&apos;Union européenne.
            </li>
            <li>
              <strong>Traitement des paiements d&apos;abonnement</strong> : Stripe Payments Europe Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irlande. Téléphone : +353 1 905 2802.{' '}
              <a
                href="https://stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                stripe.com
              </a>
            </li>
            <li>
              <strong>Envoi des emails transactionnels</strong> : Brevo (anciennement Sendinblue), Sendinblue SAS, 7 rue de Madrid, 75008 Paris, France.{' '}
              <a
                href="https://www.brevo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                brevo.com
              </a>
            </li>
            <li>
              <strong>Reconnaissance vocale (option « Devis vocal »)</strong> : Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis, via l&apos;API Google Gemini. Cette fonctionnalité est utilisée uniquement lorsque l&apos;artisan choisit explicitement de dicter un devis ou une commande. Le flux audio est transmis le temps nécessaire au traitement, n&apos;est pas conservé par Nexartis et n&apos;est pas réutilisé pour entraîner les modèles de Google.{' '}
              <a
                href="https://ai.google.dev/gemini-api/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                Conditions d&apos;utilisation de l&apos;API Gemini
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            4. Propriété intellectuelle
          </h2>
          <p>
            L&apos;ensemble des contenus présents sur le site nexartis.fr (textes, images, logo, code source, design,
            charte graphique, fonctionnalités logicielles) sont la propriété exclusive de
            l&apos;éditeur ou ont fait l&apos;objet d&apos;une autorisation d&apos;utilisation. Toute reproduction, représentation,
            modification, publication, adaptation totale ou partielle des éléments du site, quel que soit le moyen
            ou le procédé utilisé, est interdite sans autorisation écrite préalable de l&apos;éditeur, sous peine
            de constituer une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">5. Nom commercial et logo</h2>
          <p>
            « Nexartis » est utilisé comme nom commercial par l&apos;entreprise individuelle Jérémy SCHMITT.
            Le logo associé constitue une œuvre originale protégée par le droit d&apos;auteur dès sa création
            (articles L.111-1 et suivants du Code de la propriété intellectuelle). Toute reproduction
            ou réutilisation du nom commercial ou du logo, dans des conditions de nature à créer une
            confusion avec l&apos;activité de Nexartis, est susceptible d&apos;engager la responsabilité
            de son auteur au titre de la concurrence déloyale.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">6. Liens hypertextes</h2>
          <p>
            Les liens hypertextes mis en place dans le cadre du présent site internet en direction d&apos;autres
            ressources présentes sur le réseau Internet ne sauraient engager la responsabilité de l&apos;éditeur.
            Les utilisateurs et visiteurs du site internet ne peuvent mettre en place un hyperlien en direction
            de ce site sans l&apos;autorisation expresse et préalable de l&apos;éditeur.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">7. Données personnelles</h2>
          <p>
            Les traitements de données personnelles effectués via le site nexartis.fr sont décrits dans notre{' '}
            <Link href="/rgpd" className="text-sky underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>
            . Pour exercer vos droits ou poser une question sur le traitement de vos données, contactez-nous à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">8. Cookies</h2>
          <p>
            Le site utilise des cookies à des fins de mesure d&apos;audience et de fonctionnement. Le détail de leur
            utilisation et les modalités de retrait du consentement sont décrits dans notre{' '}
            <Link href="/cookies" className="text-sky underline-offset-4 hover:underline">
              politique cookies
            </Link>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">9. Droit applicable</h2>
          <p>
            Le présent site et les présentes mentions légales sont soumis au droit français. Tout litige
            relatif à leur application sera de la compétence exclusive des tribunaux français.
          </p>
        </section>

        <section>
          <h2 className="font-syne text-2xl font-bold text-navy">10. Contact</h2>
          <p>
            Pour toute question ou demande relative au site nexartis.fr, vous pouvez nous contacter par email à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  )
}
