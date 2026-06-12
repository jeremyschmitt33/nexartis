// -------------------------------------------------------------------
// Brevo transactional email service for Nexartis
// Server-side only — do NOT import from client components
// -------------------------------------------------------------------

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const SENDER = { name: 'Nexartis', email: 'no-reply@nexartis.fr' }

// -------------------------------------------------------------------
// Core send function
// -------------------------------------------------------------------

interface SendEmailParams {
  to: { email: string; name?: string }
  subject: string
  html: string
  senderName?: string
}

export async function sendEmail({ to, subject, html, senderName }: SendEmailParams) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName || SENDER.name, email: SENDER.email },
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || `Brevo error ${res.status}`)
  }

  return res.json()
}

// -------------------------------------------------------------------
// Shared layout — style Obat
// -------------------------------------------------------------------

interface LayoutOptions {
  logoUrl?: string
  entrepriseNom?: string
}

function header(opts: LayoutOptions): string {
  const entName = opts.entrepriseNom || 'Nexartis'
  const logoImg = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${entName}" style="max-height:80px;max-width:250px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : ''

  return `<div style="padding:28px 32px;text-align:center;background:#ffffff;">
  ${logoImg}
  <div style="font-size:22px;font-weight:700;color:#1e293b;line-height:1.3;">${entName}</div>
</div>
<div style="height:1px;background:#e5e7eb;margin:0 32px;"></div>`
}

function footer(): string {
  return `<div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:11px;color:#9ca3af;">Envoyé via Nexartis — nexartis.fr</p>
</div>`
}

function layout(body: string, opts: LayoutOptions = {}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f6f9;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      ${header(opts)}
      <div style="padding:32px;">
        ${body}
      </div>
      ${footer()}
    </div>
  </div>
</body>
</html>`
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function btn(text: string, url: string) {
  return `<div style="text-align:center;margin:28px 0;">
  <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 32px;border-radius:8px;">${text}</a>
</div>`
}

function signature(entrepriseNom: string) {
  return `<p style="font-size:15px;color:#1e293b;line-height:1.7;margin-top:24px;">Cordialement,<br><strong>${entrepriseNom}</strong></p>`
}

// -------------------------------------------------------------------
// Document email template builder (used by send-devis & send-facture routes)
// -------------------------------------------------------------------

export interface DocumentEmailParams {
  type: 'devis' | 'facture'
  numero: string
  clientNom: string
  montantTTC: number
  dateValidite?: string
  dateEcheance?: string
  messagePersonnalise?: string
  entreprise: {
    nom?: string
    logo_url?: string
  }
}

export function buildDocumentEmailHtml(params: DocumentEmailParams): string {
  const {
    type,
    numero,
    clientNom,
    montantTTC,
    dateValidite,
    dateEcheance,
    messagePersonnalise,
    entreprise,
  } = params

  const entNom = entreprise.nom || 'Nexartis'
  const isDevis = type === 'devis'
  const label = isDevis ? 'devis' : 'facture'
  const ctaLabel = isDevis ? 'Voir le devis' : 'Voir la facture'

  const defaultMessage = isDevis
    ? `Veuillez trouver ci-joint votre devis n° ${numero} d'un montant de ${fmt(montantTTC)}.${dateValidite ? ` Ce devis est valable jusqu'au ${dateValidite}.` : ''}`
    : `Veuillez trouver ci-joint votre facture n° ${numero} d'un montant de ${fmt(montantTTC)}${dateEcheance ? `, à régler avant le ${dateEcheance}` : ''}.`

  const body = `
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${clientNom},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      ${messagePersonnalise || defaultMessage}
    </p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">N'hésitez pas à nous contacter pour toute question relative à ce ${label}.</p>
    ${btn(ctaLabel, `https://nexartis.fr/dashboard/${isDevis ? 'devis' : 'factures'}`)}
    ${signature(entNom)}`

  return layout(body, {
    logoUrl: entreprise.logo_url,
    entrepriseNom: entNom,
  })
}

// -------------------------------------------------------------------
// 1. Welcome email
// -------------------------------------------------------------------

export async function sendWelcomeEmail(user: { email: string; name: string }) {
  const body = `
    <h2 style="margin:0 0 16px;font-size:26px;color:#0f1a3a;font-weight:800;letter-spacing:-0.01em;line-height:1.25;">Bienvenue sur Nexartis, ${user.name} 👋</h2>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 14px;">
      Merci d'avoir choisi Nexartis. Vous rejoignez une communauté d'artisans qui ont décidé d'arrêter de perdre du temps sur leurs devis, leurs factures et la paperasse — pour se concentrer sur ce qui compte vraiment : <strong>leur métier et leurs clients</strong>.
    </p>

    <!-- Encart période d'essai -->
    <div style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;border-radius:12px;padding:20px 22px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#9a3412;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Votre essai gratuit a démarré</p>
      <p style="margin:0 0 6px;font-size:30px;color:#0f1a3a;font-weight:800;line-height:1;">14 jours offerts</p>
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;">
        Sans carte bancaire, sans engagement.<br>Toutes les fonctionnalités sont débloquées.
      </p>
    </div>

    <!-- Étapes pour bien démarrer -->
    <h3 style="margin:30px 0 14px;font-size:17px;color:#0f1a3a;font-weight:700;">Vos 4 premières étapes</h3>

    <!-- Étape 1 : profil (PRIORITAIRE) -->
    <div style="background:#fff8f0;border:1px solid #f5c8a0;border-left:4px solid #e87a2a;border-radius:8px;padding:16px 20px;margin:12px 0;">
      <p style="margin:0 0 6px;font-size:14px;color:#9a3412;font-weight:700;">⚙️ 1. Remplissez votre profil entreprise <span style="font-size:12px;font-weight:600;color:#c2410c;">— étape clé</span></p>
      <p style="margin:0;font-size:13px;color:#5f4a3a;line-height:1.7;">
        <strong>C'est l'étape la plus importante.</strong> Renseignez votre SIRET, adresse, assurance décennale, médiateur, IBAN, logo et conditions de paiement dans <strong>Paramètres → Entreprise</strong>. Toutes ces informations alimenteront automatiquement vos devis et factures avec les mentions légales obligatoires. Sans cela, vos documents seront incomplets — avec, ils seront parfaitement conformes en une seule saisie.
      </p>
    </div>

    <!-- Étape 2 -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin:10px 0;">
      <p style="margin:0 0 4px;font-size:14px;color:#0f1a3a;font-weight:700;">✏️ 2. Ajoutez signature et logo</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Dans <strong>Paramètres → Ma signature</strong> et <strong>Paramètres → Entreprise</strong>. Ils s'afficheront sur tous vos documents pour un rendu professionnel sans rien faire.
      </p>
    </div>

    <!-- Étape 3 -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin:10px 0;">
      <p style="margin:0 0 4px;font-size:14px;color:#0f1a3a;font-weight:700;">👥 3. Créez votre premier client</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Menu <strong>Clients → Nouveau client</strong>. Saisi une fois, il sera réutilisable sur tous vos devis et factures futurs.
      </p>
    </div>

    <!-- Étape 4 -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin:10px 0;">
      <p style="margin:0 0 4px;font-size:14px;color:#0f1a3a;font-weight:700;">📄 4. Lancez votre premier devis</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Cliquez sur <strong>+ Créer</strong> en haut à gauche puis "Nouveau devis". Votre client reçoit un document propre, signable en ligne en deux clics.
      </p>
    </div>

    <!-- CTA principal -->
    <div style="text-align:center;margin:32px 0 28px;">
      <a href="https://nexartis.fr/dashboard/parametres" style="display:inline-block;background:#e87a2a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(232,122,42,0.35);">Commencer par mon profil →</a>
      <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Temps estimé : 5 minutes</p>
    </div>

    <!-- Encart accompagnement -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:18px 22px;margin:28px 0;">
      <p style="margin:0 0 8px;font-size:15px;color:#0c4a6e;font-weight:700;">💬 Une question ? Un blocage ? Une suggestion ?</p>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.7;">
        <strong>Nous sommes là pour vous accompagner.</strong> Que ce soit pour prendre en main l'outil, configurer une fonctionnalité ou nous remonter un bug, écrivez-nous directement à <a href="mailto:contact.nexartis@gmail.com" style="color:#2563eb;text-decoration:underline;font-weight:600;">contact.nexartis@gmail.com</a>. Vous pouvez aussi simplement répondre à cet email.
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Chaque message est lu et reçoit une réponse personnelle. Pas de chatbot, pas de ticket numéroté — juste un échange direct entre artisans.
      </p>
    </div>

    <!-- Encart utilisateur actif -->
    <div style="background:#fef9f3;border:1px solid #fde6c8;border-radius:8px;padding:14px 18px;margin:20px 0 28px;">
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.65;font-style:italic;">
        💡 Les utilisateurs qui participent activement à l'amélioration de Nexartis (retours, suggestions, signalements) bénéficient régulièrement d'avantages exclusifs sur leur abonnement.
      </p>
    </div>

    <p style="font-size:15px;color:#475569;line-height:1.7;margin:24px 0 8px;">
      Encore merci pour votre confiance. Bons chantiers et bienvenue dans l'équipe Nexartis 🚀
    </p>

    <p style="font-size:14px;color:#0f1a3a;line-height:1.6;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:20px;">
      <strong style="font-size:15px;">Jérémy Schmitt</strong><br/>
      <span style="color:#64748b;font-size:13px;">Fondateur — Nexartis</span>
    </p>`

  return sendEmail({
    to: { email: user.email, name: user.name },
    subject: 'Bienvenue sur Nexartis — votre essai de 14 jours a démarré 🎉',
    html: layout(body, {
      entrepriseNom: 'Nexartis',
      logoUrl: 'https://nexartis.fr/images/logo-nexartis.png',
    }),
  })
}

// -------------------------------------------------------------------
// 1bis. Subscription extended email (V3.0c.18)
// Envoye automatiquement lors d'une prolongation d'abonnement depuis l'admin.
// -------------------------------------------------------------------

export async function sendSubscriptionExtendedEmail(user: {
  email: string
  name: string
  newExpireAt: string // ISO date string
  abonnementType?: string // trial | actif | suspendu | lifetime
}) {
  const isLifetime = user.abonnementType === 'lifetime'
  const formattedDate = isLifetime
    ? ''
    : new Date(user.newExpireAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })

  const headline = isLifetime
    ? 'Votre abonnement Nexartis est désormais à vie 🎉'
    : 'Votre abonnement Nexartis a été prolongé ✨'

  const dateBlock = isLifetime
    ? `<p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
        Plus aucune date d'expiration. Vous pouvez utiliser Nexartis sans limite de temps.
      </p>`
    : `<p style="margin:0 0 6px;font-size:14px;color:#0c4a6e;font-weight:700;">Nouvelle date de validité</p>
      <p style="margin:0;font-size:18px;color:#1e293b;font-weight:700;line-height:1.4;">
        ${formattedDate}
      </p>`

  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1e293b;">${headline}</h2>

    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Bonjour ${user.name},
    </p>

    <p style="font-size:15px;color:#475569;line-height:1.7;">
      ${isLifetime
        ? 'Nous avons activé l\'accès à vie à votre compte Nexartis. Vous bénéficiez de toutes les fonctionnalités présentes et futures, sans engagement de durée.'
        : 'Bonne nouvelle : votre abonnement Nexartis vient d\'être prolongé. Vous pouvez continuer à utiliser toutes les fonctionnalités sans interruption.'}
    </p>

    <!-- Encart date -->
    <div style="background:#eff6ff;border-left:4px solid #5ab4e0;border-radius:8px;padding:14px 18px;margin:22px 0;">
      ${dateBlock}
    </div>

    ${btn('Accéder à mon espace', 'https://nexartis.fr/dashboard/abonnement')}

    <p style="font-size:14px;color:#475569;line-height:1.7;margin-top:24px;">
      Merci de votre confiance, et bons chantiers !
    </p>

    <p style="font-size:14px;color:#1e293b;line-height:1.6;margin-top:20px;">
      <strong>Jérémy Schmitt</strong><br/>
      <span style="color:#64748b;">Fondateur — Nexartis</span>
    </p>

    <!-- Encart contact discret -->
    <div style="background:#fef9f3;border:1px solid #fde6c8;border-radius:8px;padding:14px 18px;margin:24px 0 0;">
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
        Une question sur votre abonnement ou un bug à signaler ? Répondez à cet email ou écrivez à <a href="mailto:contact.nexartis@gmail.com" style="color:#2563eb;text-decoration:underline;font-weight:600;">contact.nexartis@gmail.com</a> — je lis chaque message.
      </p>
    </div>`

  return sendEmail({
    to: { email: user.email, name: user.name },
    subject: isLifetime
      ? 'Nexartis — Votre abonnement est désormais à vie'
      : 'Nexartis — Votre abonnement a été prolongé',
    html: layout(body, { entrepriseNom: 'Nexartis' }),
  })
}

// -------------------------------------------------------------------
// 1ter. Geste commercial — mois offerts (V3.0c.20)
// Envoye automatiquement quand l'admin clique sur "+1 mois" / "+3 mois offerts".
// -------------------------------------------------------------------

export async function sendGesteCommercialEmail(user: {
  email: string
  name: string
  moisOfferts: number // 1 ou 3
  newExpireAt: string // ISO date string
}) {
  const formattedDate = new Date(user.newExpireAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const sMois = user.moisOfferts > 1 ? 's' : ''

  const body = `
    <h2 style="margin:0 0 16px;font-size:26px;color:#0f1a3a;font-weight:800;letter-spacing:-0.01em;line-height:1.25;">Un petit cadeau pour vous 🎁</h2>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 14px;">
      Bonjour ${user.name},
    </p>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 14px;">
      Vous bénéficiez aujourd'hui d'un <strong>geste commercial</strong> de notre part. Considérez cela comme un merci pour votre confiance et votre engagement à nos côtés.
    </p>

    <!-- Encart mois offerts -->
    <div style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;border-radius:12px;padding:24px 22px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#9a3412;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Cadeau de bienvenue</p>
      <p style="margin:0 0 8px;font-size:36px;color:#0f1a3a;font-weight:800;line-height:1;">+${user.moisOfferts} mois offert${sMois}</p>
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;">
        Nouvelle validité de votre abonnement<br>
        <strong style="font-size:15px;color:#0f1a3a;">jusqu'au ${formattedDate}</strong>
      </p>
    </div>

    <!-- Encart nouveautés -->
    <h3 style="margin:30px 0 12px;font-size:17px;color:#0f1a3a;font-weight:700;">✨ Profitez-en pour découvrir les nouveautés</h3>

    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 14px;">
      Nous venons de pousser une grosse mise à jour qui change la donne sur le rendu de vos documents :
    </p>

    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:12px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:#0f1a3a;font-weight:700;">📄 Vos devis et factures, version pro</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.65;">
        Refonte visuelle complète : nouveau bandeau navy + orange, cartes émetteur / destinataire modernisées, tableau hiérarchisé avec pastilles, Net à payer en évidence, mentions légales automatiques. Vos clients verront tout de suite la différence.
      </p>
    </div>

    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:12px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:#0f1a3a;font-weight:700;">📊 Facturation de situation enfin disponible</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.65;">
        Pour vos chantiers longs, vous pouvez désormais facturer en plusieurs tranches (Situation #1, #2, #3…) directement depuis le formulaire de nouvelle facture. Plus besoin de tout recopier.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://nexartis.fr/dashboard/devis" style="display:inline-block;background:#e87a2a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(232,122,42,0.35);">Découvrir les nouveautés →</a>
    </div>

    <!-- Encart traction -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:18px 22px;margin:28px 0;">
      <p style="margin:0 0 8px;font-size:15px;color:#0c4a6e;font-weight:700;">🚀 De plus en plus d'artisans nous rejoignent</p>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
        Chaque semaine, de nouveaux artisans rejoignent Nexartis. Électriciens, plombiers, paysagistes, maçons, couvreurs… Tous trouvent enfin un outil <strong>simple, rapide et conforme</strong>, pensé par et pour des artisans français. Bonne nouvelle : vous y êtes déjà.
      </p>
    </div>

    <p style="font-size:15px;color:#475569;line-height:1.7;margin:24px 0 8px;">
      Profitez bien de votre cadeau, et continuez à nous faire vos retours — c'est grâce à vous que Nexartis devient meilleur chaque semaine.
    </p>

    <p style="font-size:14px;color:#0f1a3a;line-height:1.6;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:20px;">
      <strong style="font-size:15px;">Jérémy Schmitt</strong><br/>
      <span style="color:#64748b;font-size:13px;">Fondateur — Nexartis</span>
    </p>

    <!-- Encart contact discret -->
    <div style="background:#fef9f3;border:1px solid #fde6c8;border-radius:8px;padding:14px 18px;margin:20px 0 0;">
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
        Une question ? Un bug ? Répondez à cet email ou écrivez à <a href="mailto:contact.nexartis@gmail.com" style="color:#2563eb;text-decoration:underline;font-weight:600;">contact.nexartis@gmail.com</a> — je lis chaque message personnellement.
      </p>
    </div>`

  return sendEmail({
    to: { email: user.email, name: user.name },
    subject: `🎁 ${user.moisOfferts} mois offert${sMois} sur Nexartis + nouveautés à découvrir`,
    html: layout(body, {
      entrepriseNom: 'Nexartis',
      logoUrl: 'https://nexartis.fr/images/logo-nexartis.png',
    }),
  })
}

// -------------------------------------------------------------------
// 2. Quote sent email
// -------------------------------------------------------------------

export async function sendQuoteEmail(
  client: { email: string; name: string },
  quote: { number: string; totalAmount: number; pdfUrl?: string },
  entreprise?: { nom?: string; logo_url?: string },
) {
  const entNom = entreprise?.nom || 'Nexartis'
  const body = `
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${client.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Veuillez trouver ci-joint votre devis n° ${quote.number} d'un montant de ${fmt(quote.totalAmount)}.
    </p>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Numéro</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${quote.number}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Montant TTC</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${fmt(quote.totalAmount)}</td>
        </tr>
      </table>
    </div>
    ${btn('Voir le devis', quote.pdfUrl || 'https://nexartis.fr/dashboard/devis')}
    ${signature(entNom)}`

  return sendEmail({
    to: { email: client.email, name: client.name },
    subject: `Devis n° ${quote.number} — ${entNom}`,
    html: layout(body, { logoUrl: entreprise?.logo_url, entrepriseNom: entNom }),
    senderName: entNom,
  })
}

// -------------------------------------------------------------------
// 3. Invoice sent email
// -------------------------------------------------------------------

export async function sendInvoiceEmail(
  client: { email: string; name: string },
  invoice: { number: string; totalAmount: number; dueDate: string; pdfUrl?: string },
  entreprise?: { nom?: string; logo_url?: string },
) {
  const entNom = entreprise?.nom || 'Nexartis'
  const dueDateFmt = new Date(invoice.dueDate).toLocaleDateString('fr-FR')

  const body = `
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${client.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Veuillez trouver ci-joint votre facture n° ${invoice.number} d'un montant de ${fmt(invoice.totalAmount)}, à régler avant le ${dueDateFmt}.
    </p>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Numéro</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${invoice.number}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Montant TTC</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${fmt(invoice.totalAmount)}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Échéance</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${dueDateFmt}</td>
        </tr>
      </table>
    </div>
    ${btn('Voir la facture', invoice.pdfUrl || 'https://nexartis.fr/dashboard/factures')}
    ${signature(entNom)}`

  return sendEmail({
    to: { email: client.email, name: client.name },
    subject: `Facture n° ${invoice.number} — ${entNom}`,
    html: layout(body, { logoUrl: entreprise?.logo_url, entrepriseNom: entNom }),
    senderName: entNom,
  })
}

// -------------------------------------------------------------------
// 4. Quote accepted notification (to artisan)
// -------------------------------------------------------------------

export async function sendQuoteAcceptedEmail(
  artisan: { email: string; name: string },
  client: { name: string },
  quote: { number: string },
) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Devis accepté !</h2>
    <p style="font-size:15px;color:#475569;line-height:1.7;">Bonjour ${artisan.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Bonne nouvelle ! <strong>${client.name}</strong> a accepté votre devis n° <strong>${quote.number}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:16px;color:#16a34a;font-weight:700;">Devis n° ${quote.number} — Accepté</p>
      <p style="margin:6px 0 0;font-size:14px;color:#15803d;">Client : ${client.name}</p>
    </div>
    ${btn('Voir le devis', 'https://nexartis.fr/dashboard/devis')}
    <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
      Vous pouvez maintenant convertir ce devis en facture depuis votre espace Nexartis.
    </p>`

  return sendEmail({
    to: { email: artisan.email, name: artisan.name },
    subject: `Devis n° ${quote.number} accepté par ${client.name}`,
    html: layout(body, { entrepriseNom: 'Nexartis' }),
  })
}

// -------------------------------------------------------------------
// 5. Payment received confirmation
// -------------------------------------------------------------------

export async function sendPaymentReceivedEmail(
  client: { email: string; name: string },
  invoice: { number: string; amount: number },
  entreprise?: { nom?: string; logo_url?: string },
) {
  const entNom = entreprise?.nom || 'Nexartis'
  const body = `
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${client.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Nous confirmons la bonne réception de votre paiement.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#16a34a;">Facture n° ${invoice.number}</p>
      <p style="margin:8px 0 0;font-size:22px;color:#15803d;font-weight:700;">${fmt(invoice.amount)}</p>
    </div>
    ${signature(entNom)}`

  return sendEmail({
    to: { email: client.email, name: client.name },
    subject: `Paiement reçu — Facture n° ${invoice.number}`,
    html: layout(body, { logoUrl: entreprise?.logo_url, entrepriseNom: entNom }),
    senderName: entNom,
  })
}

// -------------------------------------------------------------------
// 6. Payment reminder
// -------------------------------------------------------------------

export async function sendPaymentReminderEmail(
  client: { email: string; name: string },
  invoice: { number: string; totalAmount: number; dueDate: string; daysPastDue: number },
  entreprise?: { nom?: string; logo_url?: string },
) {
  const entNom = entreprise?.nom || 'Nexartis'
  const dueDateFmt = new Date(invoice.dueDate).toLocaleDateString('fr-FR')

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Rappel de paiement</h2>
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${client.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Nous nous permettons de vous rappeler que la facture ci-dessous est en attente de règlement
      depuis <strong>${invoice.daysPastDue} jour${invoice.daysPastDue > 1 ? 's' : ''}</strong>.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Facture</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">n° ${invoice.number}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Montant</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">${fmt(invoice.totalAmount)}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Échéance</td>
          <td style="font-size:14px;color:#dc2626;font-weight:600;text-align:right;padding:6px 0;">${dueDateFmt}</td>
        </tr>
      </table>
    </div>
    <p style="font-size:15px;color:#475569;line-height:1.7;">
      Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce message.
    </p>
    ${signature(entNom)}`

  return sendEmail({
    to: { email: client.email, name: client.name },
    subject: `Rappel — Facture n° ${invoice.number} en attente`,
    html: layout(body, { logoUrl: entreprise?.logo_url, entrepriseNom: entNom }),
    senderName: entNom,
  })
}

// -------------------------------------------------------------------
// 6bis. Relances automatiques factures impayees J+7 / J+15 / J+30
// -------------------------------------------------------------------
// Envoyees par /api/cron/relances-auto-factures, un seul email par
// palier et par facture. Tons gradues : courtois > ferme > strict.
// Footer rappelle a l'artisan qu'il peut desactiver dans Parametres.
// -------------------------------------------------------------------

interface RelanceFacture {
  id: string
  numero: string
  montant_ttc: number
  date_echeance: string // ISO date
}

interface RelanceEntreprise {
  nom?: string
  logo_url?: string
  email?: string
}

interface RelanceClient {
  email: string
  nom: string
}

type RelanceNiveau = 'j7' | 'j15' | 'j30'

function buildRelanceEmail(
  niveau: RelanceNiveau,
  facture: RelanceFacture,
  entreprise: RelanceEntreprise,
  client: RelanceClient,
): { subject: string; html: string } {
  const entNom = entreprise.nom || 'Nexartis'
  const dueDateFmt = new Date(facture.date_echeance).toLocaleDateString('fr-FR')
  // Lien vers le dashboard artisan (les factures n'ont pas de token public)
  const ctaUrl = 'https://nexartis.fr/dashboard/factures'

  let subject = ''
  let titre = ''
  let intro = ''
  let messageCorps = ''
  let cardTone = '' // couleur du bloc recap
  let cardBorder = ''
  let cardLabel = ''
  let mentionFin = ''
  let ctaLabel = ''

  if (niveau === 'j7') {
    subject = `Petit rappel - Facture n° ${facture.numero}`
    titre = 'Petit rappel sur votre facture'
    intro = `Nous esperons que vous allez bien. Sauf erreur de notre part, votre facture n&deg; <strong>${facture.numero}</strong> arrivee a echeance le <strong>${dueDateFmt}</strong> n'a pas encore ete reglee.`
    messageCorps = "Il s'agit peut-etre simplement d'un oubli. Si le reglement a deja ete effectue ces derniers jours, merci de ne pas tenir compte de ce message."
    cardTone = '#fffbeb'
    cardBorder = '#fde68a'
    cardLabel = "Echeance depassee depuis 7 jours"
    mentionFin = 'Nous restons a votre disposition pour toute question concernant cette facture.'
    ctaLabel = 'Voir la facture'
  } else if (niveau === 'j15') {
    subject = `Rappel - Facture n° ${facture.numero} impayee depuis 15 jours`
    titre = 'Rappel - facture impayee depuis 15 jours'
    intro = `Malgre notre precedent message, votre facture n&deg; <strong>${facture.numero}</strong> echue le <strong>${dueDateFmt}</strong> demeure impayee a ce jour.`
    messageCorps = "Nous vous remercions de bien vouloir proceder au reglement dans les meilleurs delais. Si vous rencontrez une difficulte, n'hesitez pas a nous contacter pour convenir d'un echeancier."
    cardTone = '#fff7ed'
    cardBorder = '#fdba74'
    cardLabel = "Echeance depassee depuis 15 jours"
    mentionFin = "A defaut de reglement sous 15 jours, des penalites de retard pourront s'appliquer conformement a nos conditions generales."
    ctaLabel = 'Regler la facture'
  } else {
    subject = `Dernier rappel avant mise en demeure - Facture n° ${facture.numero}`
    titre = 'Dernier rappel avant mise en demeure'
    intro = `Votre facture n&deg; <strong>${facture.numero}</strong> echue le <strong>${dueDateFmt}</strong> reste impayee malgre nos relances precedentes (J+7 et J+15).`
    messageCorps = 'Nous vous demandons de regulariser votre situation <strong>sous 8 jours</strong>. A defaut, nous serons contraints d&apos;engager une procedure de recouvrement (mise en demeure par lettre recommandee, frais de recouvrement forfaitaires de 40 euros et penalites de retard).'
    cardTone = '#fef2f2'
    cardBorder = '#fecaca'
    cardLabel = "Echeance depassee depuis 30 jours - URGENT"
    mentionFin = "Si un reglement est intervenu dans les dernieres 48h, merci de nous transmettre une preuve de paiement pour que nous puissions cloturer ce dossier."
    ctaLabel = 'Regler immediatement'
  }

  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1e293b;font-weight:700;">${titre}</h2>
    <p style="font-size:15px;color:#1e293b;line-height:1.7;">Bonjour ${client.nom},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">${intro}</p>

    <div style="background:${cardTone};border:1px solid ${cardBorder};border-radius:8px;padding:16px 20px;margin:22px 0;">
      <p style="margin:0 0 10px;font-size:12px;color:#92400e;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${cardLabel}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Facture</td>
          <td style="font-size:14px;color:#1e293b;font-weight:600;text-align:right;padding:6px 0;">n&deg; ${facture.numero}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Montant TTC</td>
          <td style="font-size:14px;color:#1e293b;font-weight:700;text-align:right;padding:6px 0;">${fmt(facture.montant_ttc)}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#64748b;padding:6px 0;">Echeance</td>
          <td style="font-size:14px;color:#dc2626;font-weight:600;text-align:right;padding:6px 0;">${dueDateFmt}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:15px;color:#475569;line-height:1.7;">${messageCorps}</p>

    ${btn(ctaLabel, ctaUrl)}

    <p style="font-size:14px;color:#64748b;line-height:1.7;font-style:italic;">${mentionFin}</p>

    ${signature(entNom)}

    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        Cet email a ete envoye automatiquement par Nexartis pour le compte de ${entNom}.
        L'artisan peut desactiver ces relances dans ses parametres Nexartis.
      </p>
    </div>`

  return {
    subject,
    html: layout(body, { logoUrl: entreprise.logo_url, entrepriseNom: entNom }),
  }
}

export async function sendRelanceJ7(
  facture: RelanceFacture,
  entreprise: RelanceEntreprise,
  client: RelanceClient,
): Promise<boolean> {
  try {
    const { subject, html } = buildRelanceEmail('j7', facture, entreprise, client)
    await sendEmail({
      to: { email: client.email, name: client.nom },
      subject,
      html,
      senderName: entreprise.nom || 'Nexartis',
    })
    return true
  } catch (err) {
    console.error('[sendRelanceJ7] error', err)
    return false
  }
}

export async function sendRelanceJ15(
  facture: RelanceFacture,
  entreprise: RelanceEntreprise,
  client: RelanceClient,
): Promise<boolean> {
  try {
    const { subject, html } = buildRelanceEmail('j15', facture, entreprise, client)
    await sendEmail({
      to: { email: client.email, name: client.nom },
      subject,
      html,
      senderName: entreprise.nom || 'Nexartis',
    })
    return true
  } catch (err) {
    console.error('[sendRelanceJ15] error', err)
    return false
  }
}

export async function sendRelanceJ30(
  facture: RelanceFacture,
  entreprise: RelanceEntreprise,
  client: RelanceClient,
): Promise<boolean> {
  try {
    const { subject, html } = buildRelanceEmail('j30', facture, entreprise, client)
    await sendEmail({
      to: { email: client.email, name: client.nom },
      subject,
      html,
      senderName: entreprise.nom || 'Nexartis',
    })
    return true
  } catch (err) {
    console.error('[sendRelanceJ30] error', err)
    return false
  }
}

// -------------------------------------------------------------------
// 6ter. Invitation d'un membre d'équipe (multi-utilisateur — Phase 2b)
// -------------------------------------------------------------------
// Envoyé par POST /api/equipe/inviter quand un dirigeant invite un
// collaborateur (commercial ou ouvrier) à rejoindre son entreprise.
// Le bouton pointe vers la page d'activation publique (création du
// mot de passe). Le lien expire au bout de 7 jours.
// -------------------------------------------------------------------

interface InvitationEmailParams {
  to: string
  entrepriseNom: string
  /** Libellé humain du rôle (déjà résolu via ROLE_LABELS côté route). */
  role: string
  /** URL absolue d'activation (ex : https://nexartis.fr/auth/invitation/<token>). */
  inviteUrl: string
  /** Nom de la personne qui invite (facultatif). */
  inviterName?: string
  /** Date d'expiration de l'invitation (ISO ou Date). */
  expiresAt: string | Date
}

export async function sendInvitationEmail(params: InvitationEmailParams) {
  const { to, entrepriseNom, role, inviteUrl, inviterName, expiresAt } = params
  // Échappement HTML (anti-injection / anti-phishing) : entrepriseNom et
  // inviterName sont saisis par l'utilisateur → on ne les injecte JAMAIS bruts
  // dans le HTML de l'email. role vient de ROLE_LABELS (déjà sûr) mais on
  // l'échappe aussi par principe de défense en profondeur.
  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  const entNom = entrepriseNom || 'votre entreprise' // brut : sujet + nom d'expéditeur (texte simple, pas HTML)
  const entNomSafe = escapeHtml(entNom) // pour le corps HTML
  const roleSafe = escapeHtml(role)
  const expiresFmt = new Date(expiresAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const invitedByLine = inviterName
    ? `<strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre`
    : `Vous êtes invité(e) à rejoindre`

  const body = `
    <h2 style="margin:0 0 16px;font-size:24px;color:#0f1a3a;font-weight:800;letter-spacing:-0.01em;line-height:1.25;">Vous êtes invité(e) sur Nexartis</h2>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 14px;">
      Bonjour,
    </p>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 14px;">
      ${invitedByLine} l'espace de travail de <strong>${entNomSafe}</strong> sur Nexartis,
      l'outil de gestion pensé pour les artisans.
    </p>

    <!-- Encart rôle -->
    <div style="background:#fff8f0;border:1px solid #f5c8a0;border-left:4px solid #e87a2a;border-radius:8px;padding:16px 20px;margin:22px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#9a3412;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Votre accès</p>
      <p style="margin:0;font-size:16px;color:#0f1a3a;font-weight:700;line-height:1.4;">${roleSafe}</p>
    </div>

    <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 8px;">
      Pour activer votre compte, cliquez sur le bouton ci-dessous et choisissez votre mot de passe.
    </p>

    ${btn('Activer mon compte', inviteUrl)}

    <!-- Lien de secours en clair : certains clients mail (mobile, pro) bloquent
         les boutons. On donne le lien copiable-collable. inviteUrl est généré
         côté serveur (UUID), pas une saisie utilisateur → href brut sûr. -->
    <p style="font-size:13px;color:#64748b;line-height:1.7;margin:4px 0 0;word-break:break-all;">
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/>
      <a href="${inviteUrl}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(inviteUrl)}</a>
    </p>

    <p style="font-size:13px;color:#94a3b8;line-height:1.7;margin:20px 0 0;">
      Cette invitation expire le <strong>${expiresFmt}</strong>.<br/>
      Si vous n'êtes pas concerné(e) par cette invitation, vous pouvez ignorer cet email.
    </p>`

  return sendEmail({
    to: { email: to, name: to },
    // L'employé voit « [Entreprise] via Nexartis » comme expéditeur → confiance
    // accrue, moins de risque spam (P0-6).
    senderName: `${entNom} via Nexartis`,
    subject: `Invitation à rejoindre ${entNom} sur Nexartis`,
    html: layout(body, {
      entrepriseNom: 'Nexartis',
      logoUrl: 'https://nexartis.fr/images/logo-nexartis.png',
    }),
  })
}

// -------------------------------------------------------------------
// 7. Alerte admin : nouvelle inscription
// -------------------------------------------------------------------

interface NewSignupAlertParams {
  email: string
  prenom?: string
  nom?: string
  entreprise?: string
  metier?: string
  telephone?: string
  ville?: string
}

export async function sendNewSignupAlert(params: NewSignupAlertParams) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'contact.nexartis@gmail.com'
  const fullName = [params.prenom, params.nom].filter(Boolean).join(' ') || '—'
  const dateFmt = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const row = (label: string, value: string | undefined) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#64748b;width:140px;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:600;">${value || '<span style="color:#cbd5e1;font-weight:400;">non renseigné</span>'}</td>
    </tr>`

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Nouvelle inscription Nexartis</h2>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:20px;">
      Un nouvel utilisateur vient de s'inscrire sur la plateforme.
    </p>

    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:8px 0 20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row('Date', dateFmt)}
        ${row('Email', params.email)}
        ${row('Nom complet', fullName)}
        ${row('Entreprise', params.entreprise)}
        ${row('Métier', params.metier)}
        ${row('Téléphone', params.telephone)}
        ${row('Ville', params.ville)}
      </table>
    </div>

    ${btn('Voir dans le panneau admin', 'https://nexartis.fr/dashboard/admin')}

    <p style="font-size:12px;color:#94a3b8;margin-top:24px;line-height:1.6;">
      Vous recevez cet email automatique parce que vous êtes administrateur de Nexartis.
    </p>`

  return sendEmail({
    to: { email: adminEmail, name: 'Admin Nexartis' },
    subject: `Nouvelle inscription : ${fullName !== '—' ? fullName : params.email}`,
    html: layout(body, { entrepriseNom: 'Nexartis' }),
  })
}
