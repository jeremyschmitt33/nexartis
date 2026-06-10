import Link from "next/link";
import CookieSettingsButton from "./CookieSettingsButton";

const metierLinks = [
  { label: "Plombier", href: "/logiciel-devis-plombier" },
  { label: "Électricien", href: "/logiciel-devis-electricien" },
  { label: "Maçon", href: "/logiciel-devis-maconnerie" },
  { label: "Menuisier", href: "/logiciel-devis-menuisier" },
  { label: "Peintre", href: "/logiciel-devis-peintre" },
  { label: "Paysagiste", href: "/logiciel-devis-paysagiste" },
  { label: "Carreleur", href: "/logiciel-devis-carreleur" },
  { label: "Couvreur", href: "/logiciel-devis-couvreur" },
  { label: "Chauffagiste", href: "/logiciel-devis-chauffagiste" },
  { label: "Auto-entrepreneur", href: "/logiciel-artisan-auto-entrepreneur" },
];

const navLinks = [
  { label: "Tarifs", href: "/tarifs" },
  { label: "Blog", href: "/blog" },
  { label: "À propos", href: "/a-propos" },
  { label: "Se connecter", href: "/login" },
  { label: "Essai gratuit", href: "/register" },
];

const legalLinks = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGV", href: "/cgv" },
  { label: "Politique de confidentialité", href: "/rgpd" },
  { label: "Cookies", href: "/cookies" },
];

export default function Footer() {
  return (
    <footer
      aria-label="Pied de page"
      className="relative bg-bgdark text-ink-2 font-hanken border-t border-white/[0.06] overflow-hidden"
    >
      {/* Halo radial decoratif (atmosphere landing V4) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(63, 123, 255, 0.05) 0%, rgba(63, 123, 255, 0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-10 py-[60px]">
        <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 - Logo & tagline */}
          <div>
            <span className="landing-text-grad text-[22px] font-[800] tracking-tight">
              Nexartis
            </span>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2 max-w-[30ch]">
              Logiciel pensé pour les artisans. Conçu en Gironde &middot; Pour la France entière.
            </p>
          </div>

          {/* Column 2 - Par metier */}
          <div>
            <h4
              id="footer-heading-metier"
              className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-3"
            >
              Par métier
            </h4>
            <ul
              aria-labelledby="footer-heading-metier"
              className="flex flex-col gap-1"
            >
              {metierLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1 text-[13px] text-ink-3 transition-colors hover:text-ink hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 - Navigation */}
          <div>
            <h4
              id="footer-heading-nav"
              className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-3"
            >
              Navigation
            </h4>
            <ul
              aria-labelledby="footer-heading-nav"
              className="flex flex-col gap-1"
            >
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1 text-[13px] text-ink-3 transition-colors hover:text-ink hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 - Legal & support */}
          <div>
            <h4
              id="footer-heading-legal"
              className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-3"
            >
              Légal
            </h4>
            <ul
              aria-labelledby="footer-heading-legal"
              className="flex flex-col gap-1 mb-6"
            >
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1 text-[13px] text-ink-3 transition-colors hover:text-ink hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {/* Bouton CNIL : permettre a l'utilisateur de modifier ses choix
                  cookies a tout moment, conformement a la recommandation 2020-091 */}
              <li>
                <CookieSettingsButton />
              </li>
            </ul>
            <h4
              id="footer-heading-support"
              className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-3"
            >
              Support
            </h4>
            <ul
              aria-labelledby="footer-heading-support"
              className="flex flex-col gap-1 text-[13px] text-ink-3"
            >
              <li>
                <a
                  href="mailto:contact.nexartis@gmail.com"
                  className="transition-colors hover:text-ink hover:underline underline-offset-4"
                >
                  contact.nexartis@gmail.com
                </a>
              </li>
              <li>Lun-Ven 9h-18h</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar : copyright a gauche, contact a droite */}
        <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[12px] text-ink-3 leading-relaxed">
            &copy; 2026 Nexartis &middot; Bordeaux, France &middot; Mentions Factur-X 2026 incluses &middot; Données hébergées en Europe
          </p>
          <p className="text-[12px] text-ink-3 leading-relaxed">
            contact.nexartis@gmail.com &middot; Lun-Ven 9h-18h
          </p>
        </div>
      </div>
    </footer>
  );
}
