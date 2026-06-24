import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Nexartis',
  description:
    'Politique de confidentialité Nexartis : données collectées, finalités, durée de conservation, vos droits RGPD.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/rgpd',
  },
}

export default function RgpdPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <header className="mb-10">
        <p className="font-manrope text-sm font-semibold uppercase tracking-wider text-orange">
          Vos données, votre contrôle
        </p>
        <h1 className="mt-2 font-syne text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-navy/60">
          Dernière mise à jour : 24 juin 2026 — Conforme au Règlement (UE) 2016/679 (RGPD)
        </p>
      </header>

      <div className="prose prose-slate max-w-none font-manrope text-[15px] leading-relaxed text-navy">
        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">1. Préambule</h2>
          <p>
            La présente politique de confidentialité décrit la manière dont Nexartis traite vos données
            personnelles dans le cadre de la fourniture du service de gestion de devis, factures et chantiers
            accessible à l&apos;adresse nexartis.fr. Nous nous engageons à respecter le Règlement Général sur
            la Protection des Données (RGPD) et la loi française « Informatique et Libertés ».
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            2. Responsable du traitement
          </h2>
          <p>Le responsable du traitement des données est :</p>
          <ul className="list-disc pl-6">
            <li><strong>Nexartis</strong>, entreprise individuelle exploitée par Jérémy SCHMITT</li>
            <li>Siège : 144 avenue Pasteur, 33185 Le Haillan, France</li>
            <li>SIRET : 840 059 687 00029</li>
            <li>
              Contact RGPD :{' '}
              <a
                href="mailto:contact.nexartis@gmail.com"
                className="text-sky underline-offset-4 hover:underline"
              >
                contact.nexartis@gmail.com
              </a>
            </li>
          </ul>
          <p>
            Nexartis est responsable de traitement pour les traitements décrits dans la présente politique
            (compte, facturation, communication, mesure d&apos;audience, logs). En revanche, pour les données que
            l&apos;artisan enregistre sur ses propres clients et chantiers (y compris les photos, cf. section 3.6),
            Nexartis agit en qualité de <strong>sous-traitant</strong> au sens de l&apos;article 28 du RGPD,
            l&apos;artisan demeurant responsable de traitement (voir l&apos;article 7 bis des{' '}
            <Link href="/cgv" className="text-sky underline-offset-4 hover:underline">CGV</Link>).
          </p>
          <p>
            <strong>Délégué à la protection des données (DPO)</strong> : aucun DPO n&apos;a été désigné,
            la nomination d&apos;un DPO n&apos;étant pas légalement obligatoire pour Nexartis (article 37
            du RGPD). Toutes les demandes relatives au traitement de vos données peuvent être adressées
            directement à <strong>contact.nexartis@gmail.com</strong>, qui sera traitée personnellement
            par le responsable de traitement dans un délai maximum d&apos;un mois.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            3. Données collectées et finalités
          </h2>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.1. Création de compte</h3>
          <p><strong>Données collectées</strong> : email, mot de passe (chiffré), nom, prénom, raison sociale, SIRET, adresse postale, téléphone.</p>
          <p><strong>Finalité</strong> : permettre la création et la gestion du compte utilisateur.</p>
          <p><strong>Base légale</strong> : exécution du contrat (article 6.1.b du RGPD).</p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.2. Utilisation du service</h3>
          <p><strong>Données collectées</strong> : données de devis, factures, chantiers, clients, paiements saisies par l&apos;utilisateur ; logs de connexion ; adresse IP ; identifiant de session.</p>
          <p><strong>Finalité</strong> : fournir le service, maintenir la sécurité, assurer la traçabilité.</p>
          <p><strong>Base légale</strong> : exécution du contrat + obligations légales (conservation des factures pendant 10 ans, art. L.123-22 du Code de commerce).</p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.3. Paiement</h3>
          <p><strong>Données collectées</strong> : informations de carte bancaire (collectées et traitées directement par Stripe, jamais stockées par Nexartis), historique de paiement.</p>
          <p><strong>Finalité</strong> : encaisser l&apos;abonnement.</p>
          <p><strong>Base légale</strong> : exécution du contrat.</p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.4. Communication marketing (optionnelle)</h3>
          <p><strong>Données collectées</strong> : email, prénom, métier (si renseigné).</p>
          <p><strong>Finalité</strong> : envoi de la newsletter et d&apos;informations sur les nouveautés.</p>
          <p><strong>Base légale</strong> : consentement de l&apos;utilisateur (article 6.1.a du RGPD), révocable à tout moment.</p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.5. Mesure d&apos;audience</h3>
          <p><strong>Données collectées</strong> : pages visitées, durée des sessions, type d&apos;appareil, navigateur, identifiant de mesure, adresse IP, collectées via Google Analytics 4.</p>
          <p><strong>Finalité</strong> : améliorer le service, mesurer la fréquentation.</p>
          <p><strong>Base légale</strong> : consentement de l&apos;utilisateur, recueilli via la bannière cookies (Google Analytics 4 n&apos;étant pas considéré comme une mesure d&apos;audience anonyme).</p>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">3.6. Photos de chantier</h3>
          <p><strong>Données collectées</strong> : photographies prises ou importées par l&apos;artisan dans le cadre de ses chantiers (albums avant / pendant / après), pouvant être rattachées à un client, un devis, une facture ou un chantier. Ces photos peuvent contenir des données relatives à des tiers (clients de l&apos;artisan, biens, lieux). Les métadonnées techniques de géolocalisation (EXIF/GPS) sont supprimées au moment de l&apos;import ; un tampon de preuve (date et adresse du chantier) peut être incrusté à la demande de l&apos;artisan.</p>
          <p><strong>Finalité</strong> : documentation et traçabilité des chantiers, constitution de preuves d&apos;exécution.</p>
          <p><strong>Base légale</strong> : exécution du contrat (article 6.1.b du RGPD).</p>
          <p><strong>Rôle de Nexartis</strong> : pour les photos et données relatives aux clients finaux de l&apos;artisan, Nexartis agit en qualité de <strong>sous-traitant</strong> au sens de l&apos;article 28 du RGPD, l&apos;artisan demeurant responsable de traitement. Nexartis ne traite ces données que sur instruction de l&apos;artisan et pour la seule fourniture du service.</p>
          <p><strong>Hébergement</strong> : stockage chiffré sur Cloudflare R2 (bucket privé, région Union européenne). <strong>Durée de conservation</strong> : pendant la durée de l&apos;abonnement, puis 90 jours après résiliation pour permettre l&apos;export, avant suppression définitive.</p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">4. Durée de conservation</h2>
          <ul className="list-disc pl-6">
            <li><strong>Données de compte actif</strong> : pendant toute la durée de l&apos;abonnement.</li>
            <li><strong>Données après résiliation</strong> : 90 jours pour permettre l&apos;export, puis suppression complète.</li>
            <li><strong>Factures et données comptables</strong> : 10 ans (obligation légale, art. L.123-22 Code de commerce).</li>
            <li><strong>Logs techniques</strong> : 12 mois maximum.</li>
            <li><strong>Données marketing</strong> : 3 ans après le dernier contact ou dès retrait du consentement.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">5. Destinataires des données</h2>
          <p>Vos données ne sont jamais vendues ni partagées à des fins commerciales. Elles sont accessibles uniquement à :</p>
          <ul className="list-disc pl-6">
            <li>L&apos;équipe Nexartis (administration, support, développement) dans la limite stricte de la nécessité.</li>
            <li>Nos sous-traitants techniques, encadrés contractuellement :</li>
          </ul>

          <h3 className="font-syne text-lg font-bold text-navy mt-6">Sous-traitants techniques</h3>
          <ul className="list-disc pl-6">
            <li><strong>Vercel Inc.</strong> (340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis) — hébergement et diffusion du frontal applicatif via son réseau global de points de présence. Transfert hors UE encadré par les Clauses Contractuelles Types (CCT) européennes.</li>
            <li><strong>Supabase Inc.</strong> (970 Toa Payoh North #07-04, Singapour) — base de données PostgreSQL et stockage. Le projet Nexartis est configuré sur la région européenne (Francfort, Allemagne) ; les données utilisateurs sont stockées dans l&apos;Union européenne.</li>
            <li><strong>Cloudflare, Inc.</strong> (101 Townsend Street, San Francisco, CA 94107, États-Unis) — stockage objet (service R2) des photos de chantier importées par l&apos;artisan. Le bucket est privé et configuré en juridiction Union européenne (Francfort) ; les fichiers sont stockés dans l&apos;UE. Cloudflare adhère actuellement au Data Privacy Framework UE–États-Unis ; les Clauses Contractuelles Types s&apos;appliquent en complément, à titre de base de transfert autonome.</li>
            <li><strong>Stripe Payments Europe Ltd.</strong> (1 Grand Canal Street Lower, Dublin, Irlande) — encaissement de l&apos;abonnement et gestion du portail client.</li>
            <li><strong>Brevo (anciennement Sendinblue)</strong>, Sendinblue SAS (7 rue de Madrid, 75008 Paris, France) — envoi des emails transactionnels (envoi de devis, factures, notifications). Données traitées en France.</li>
            <li><strong>Google LLC (Google Analytics 4)</strong> (1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis) — mesure d&apos;audience, activée uniquement après consentement explicite via la bannière cookies.</li>
            <li><strong>Google LLC (API Google Gemini)</strong> (même adresse) — reconnaissance vocale pour la fonctionnalité optionnelle « Devis vocal » et « Commande vocale ». Le flux audio enregistré par l&apos;artisan est transmis à Google le temps strictement nécessaire à la transcription et à l&apos;extraction d&apos;informations structurées (nom de client, lignes de prestations). Selon les conditions d&apos;utilisation actuelles de l&apos;API Gemini, l&apos;audio n&apos;est pas utilisé pour entraîner les modèles de Google lorsqu&apos;une clé API gérée est utilisée. Voir{' '}
              <a
                href="https://ai.google.dev/gemini-api/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                ai.google.dev/gemini-api/terms
              </a>
              .
            </li>
          </ul>
          <p className="mt-4 text-sm text-navy/70">
            <strong>Information importante concernant la fonctionnalité vocale</strong> : l&apos;utilisation
            du micro est entièrement optionnelle. Le navigateur sollicite explicitement votre autorisation
            avant tout enregistrement audio. À aucun moment l&apos;audio n&apos;est conservé par Nexartis
            après traitement — seules les informations structurées extraites (texte) sont enregistrées
            sur votre compte.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            6. Transferts hors Union Européenne
          </h2>
          <p>
            Certains de nos sous-traitants traitent vos données depuis des juridictions situées hors
            de l&apos;Union européenne :
          </p>
          <ul className="list-disc pl-6">
            <li><strong>Vercel</strong> (États-Unis) — frontal applicatif et logs techniques.</li>
            <li><strong>Stripe</strong> (Irlande, donc UE) — flux de paiement.</li>
            <li><strong>Google LLC</strong> (États-Unis) — mesure d&apos;audience (avec consentement) et reconnaissance vocale optionnelle (avec consentement implicite par utilisation de la fonctionnalité micro).</li>
            <li><strong>Supabase</strong> (siège à Singapour, infrastructure utilisée pour Nexartis en Allemagne, donc UE).</li>
            <li><strong>Cloudflare</strong> (siège aux États-Unis ; stockage des photos de chantier configuré en juridiction UE, à Francfort).</li>
          </ul>
          <p>
            Ces transferts hors UE sont encadrés par les <strong>Clauses Contractuelles Types</strong>{' '}
            (CCT) approuvées par la Commission européenne (décision d&apos;exécution 2021/914), ainsi
            que, à titre complémentaire, par le <strong>Data Privacy Framework UE-États-Unis</strong> lorsque le
            sous-traitant y adhère actuellement (cas de Vercel, Google et Cloudflare). Les Clauses Contractuelles
            Types constituant une base de transfert autonome, l&apos;encadrement reste valable indépendamment de
            l&apos;évolution de ce dispositif. Vos données sont chiffrées en transit (TLS 1.3) et au
            repos (AES-256).
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">7. Vos droits</h2>
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc pl-6">
            <li><strong>Droit d&apos;accès</strong> : connaître les données que nous détenons sur vous.</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes.</li>
            <li><strong>Droit à l&apos;effacement</strong> (« droit à l&apos;oubli ») : demander la suppression de vos données, sous réserve des obligations légales de conservation.</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré lisible par machine (CSV, JSON).</li>
            <li><strong>Droit d&apos;opposition</strong> : vous opposer à un traitement pour motif légitime.</li>
            <li><strong>Droit à la limitation</strong> : demander la suspension du traitement en cas de contestation.</li>
            <li><strong>Droit de retirer votre consentement</strong> à tout moment pour les traitements basés sur le consentement.</li>
            <li><strong>Droit de définir des directives post-mortem</strong> sur le sort de vos données après votre décès.</li>
          </ul>
          <p className="mt-4">
            Pour exercer ces droits, contactez-nous à{' '}
            <a
              href="mailto:contact.nexartis@gmail.com"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact.nexartis@gmail.com
            </a>
            . Une réponse vous sera fournie dans un délai d&apos;un mois.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">
            8. Réclamation auprès de la CNIL
          </h2>
          <p>
            Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez
            adresser une réclamation à la Commission Nationale de l&apos;Informatique et des Libertés (CNIL) :
          </p>
          <ul className="list-disc pl-6">
            <li>Adresse : 3 place de Fontenoy, TSA 80715, 75334 Paris cedex 07</li>
            <li>Téléphone : 01 53 73 22 22</li>
            <li>
              Site web :{' '}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky underline-offset-4 hover:underline"
              >
                www.cnil.fr
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">9. Sécurité</h2>
          <p>
            Nexartis met en œuvre des mesures techniques et organisationnelles pour protéger vos données :
            chiffrement TLS en transit, chiffrement au repos, contrôles d&apos;accès stricts (Row Level Security),
            authentification avec mot de passe haché, sauvegarde régulière, journalisation des accès,
            limitation des autorisations à ce qui est strictement nécessaire.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-syne text-2xl font-bold text-navy">10. Cookies</h2>
          <p>
            L&apos;utilisation des cookies sur le site nexartis.fr est décrite dans notre{' '}
            <Link href="/cookies" className="text-sky underline-offset-4 hover:underline">
              politique cookies
            </Link>
            . Vous pouvez à tout moment modifier vos préférences via le lien « Gérer les cookies » présent
            en bas de page.
          </p>
        </section>

        <section>
          <h2 className="font-syne text-2xl font-bold text-navy">11. Modifications de la politique</h2>
          <p>
            Nous pouvons mettre à jour la présente politique pour refléter des changements légaux ou
            techniques. La date de la dernière mise à jour figure en haut du document. Toute modification
            substantielle vous sera notifiée par email.
          </p>
        </section>
      </div>
    </article>
  )
}
