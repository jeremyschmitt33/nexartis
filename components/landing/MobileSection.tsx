'use client';

/**
 * MobileSection — Landing V4 dark premium.
 *
 * Section "Disponible sur mobile" : présente la PWA Nexartis installable
 * et expose un QR code dynamique pointant vers nexartis.fr.
 *
 * Pattern d'acquisition moderne :
 *   visiteur desktop → scan QR avec son téléphone → arrive sur nexartis.fr
 *   → bouton "Installer l'app" (composant InstallPrompt) → PWA installée.
 *
 * Position dans app/page.tsx : entre <PricingSection /> et <FaqSection />.
 *
 * Conventions respectées :
 *  - Tokens V4 uniquement (bgdark/bgdark-2/bgdark-3, ink/ink-2/ink-3,
 *    accent/accent-2, electric, mint, violet)
 *  - font-hanken pour titres + corps, font-spline-mono pour l'URL
 *  - Animations .reveal / .reveal-delay-X (gérées par <ScrollReveal />)
 *  - .landing-section pour rester par-dessus l'Atmosphere (z-1)
 *  - Mobile-first responsive 375px → desktop 1200px
 *  - Pas de hex hardcodés hors palette
 */

import { QRCodeSVG } from 'qrcode.react';

// URL ciblée par le QR code. utm_* permet de tracker dans GA4 les visiteurs
// arrivés via scan depuis la landing (canal d'acquisition propre).
const QR_TARGET_URL =
  'https://nexartis.fr?utm_source=qr&utm_medium=landing&utm_campaign=install';

interface Benefit {
  icon: string;
  title: string;
  text: string;
  tone: 'accent' | 'electric' | 'mint' | 'violet';
}

// Couleurs par tonalité (gradient + border + texte icône). On définit ça
// statiquement pour que Tailwind JIT capte bien toutes les classes au build.
const TONE_CLASSES: Record<Benefit['tone'], string> = {
  accent:
    'from-accent/15 to-accent-2/10 border-accent/25 text-accent',
  electric:
    'from-electric/15 to-electric/10 border-electric/25 text-electric',
  mint:
    'from-mint/15 to-mint/10 border-mint/25 text-mint',
  violet:
    'from-violet/15 to-violet/10 border-violet/25 text-violet',
};

const BENEFITS: Benefit[] = [
  {
    icon: '📱',
    tone: 'accent',
    title: 'Aucun téléchargement Play Store',
    text: "Installation directe depuis votre navigateur. Pas de compte Google obligatoire, pas de validation à attendre.",
  },
  {
    icon: '⚡',
    tone: 'electric',
    title: 'Ouverture en 1 seconde',
    text: "Icône sur votre écran d'accueil. Lancement direct sans passer par Chrome. Mode plein écran natif.",
  },
  {
    icon: '🔄',
    tone: 'mint',
    title: 'Toujours à jour automatiquement',
    text: "Nexartis se met à jour en arrière-plan. Une notification vous prévient quand une nouvelle version est prête.",
  },
  {
    icon: '🔒',
    tone: 'violet',
    title: 'Vos données restent en Europe',
    text: 'Hébergement Europe RGPD strict. Connexion sécurisée HTTPS bout-en-bout.',
  },
];

export default function MobileSection() {
  return (
    <section
      id="mobile"
      className="landing-section relative py-24 lg:py-32 px-5 sm:px-7 lg:px-10"
      aria-label="Disponible sur mobile"
    >
      <div className="mx-auto max-w-container">
        {/* ---------------- Eyebrow + titre + sous-titre ---------------- */}
        <div className="text-center mb-16">
          <span className="reveal inline-block px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-[12.5px] font-hanken font-bold uppercase tracking-wider">
            ★ Disponible sur mobile
          </span>
          <h2 className="reveal reveal-delay-1 mt-6 font-hanken font-extrabold text-[34px] sm:text-[42px] lg:text-[52px] text-ink leading-[1.1] tracking-[-0.02em]">
            Nexartis dans votre poche.
            <span className="landing-text-grad block">Toujours avec vous.</span>
          </h2>
          <p className="reveal reveal-delay-2 mt-5 max-w-2xl mx-auto text-[16px] sm:text-[17px] text-ink-2 leading-[1.55] font-hanken">
            Installez Nexartis comme une vraie application sur votre téléphone.
            Devis, factures, planning, équipe — tout reste accessible en 1 clic
            depuis votre écran d&apos;accueil.
          </p>
        </div>

        {/* ---------------- Grille 2 colonnes : QR + bénéfices ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-center">
          {/* COLONNE 1 — QR code dans carte glass dark */}
          <div className="reveal reveal-delay-3 relative">
            <div className="relative bg-gradient-to-br from-bgdark-2 to-bgdark-3 border border-white/[0.08] rounded-[28px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* Liseré accent en haut (signature visuelle V4) */}
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px] bg-gradient-to-r from-accent via-accent-2 to-accent" />

              <p className="text-center text-ink-3 text-[12px] font-hanken font-bold uppercase tracking-[0.15em] mb-4">
                Scannez avec votre téléphone
              </p>

              {/* Carte blanche QR — aspect carré, max 260px (lisible par
                  toutes les apps caméra à 30-50 cm de distance écran). */}
              <div className="bg-white rounded-2xl p-4 mb-4 mx-auto max-w-[260px] aspect-square flex items-center justify-center">
                <QRCodeSVG
                  value={QR_TARGET_URL}
                  size={228}
                  level="M"
                  fgColor="#060912"
                  bgColor="#ffffff"
                />
              </div>

              <p className="text-center text-ink-2 font-spline-mono font-semibold text-[14px] tracking-[0.5px]">
                nexartis.fr
              </p>

              {/* CTA secondaire — pour les visiteurs déjà sur leur téléphone
                  (lecture mobile), on leur évite la friction du scan inutile. */}
              <a
                href="/dashboard"
                className="mt-6 block text-center text-ink-3 hover:text-ink text-[13px] font-hanken font-medium underline decoration-ink-3/40 underline-offset-4 transition-colors"
              >
                Ou installez directement sur cet appareil →
              </a>
            </div>
          </div>

          {/* COLONNE 2 — Liste des bénéfices */}
          <div className="reveal reveal-delay-4 space-y-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div
                  className={[
                    'flex-none w-11 h-11 rounded-xl border flex items-center justify-center',
                    'bg-gradient-to-br',
                    TONE_CLASSES[b.tone],
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <span className="text-[18px]">{b.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-hanken font-extrabold text-[17px] text-ink mb-1 tracking-tight">
                    {b.title}
                  </h3>
                  <p className="text-ink-2 font-hanken text-[14.5px] leading-relaxed">
                    {b.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
