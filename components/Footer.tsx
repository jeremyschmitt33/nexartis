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
    <footer className="bg-[var(--navy)] text-white/60 border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10 py-[60px]">
        <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 — Logo & tagline */}
          <div>
            <span className="text-[22px] font-[800] text-white">Nexartis</span>
            <p className="mt-3 text-[13px] leading-relaxed">
              Solution de gestion pour tous les artisans — Développée à Bordeaux, Gironde.
            </p>
          </div>

          {/* Column 2 — Par métier */}
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/35 mb-4">
              Par métier
            </h4>
            <ul className="flex flex-col gap-1">
              {metierLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block text-[13px] text-white/55 py-1 transition-colors hover:text-[var(--orange)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Navigation */}
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/35 mb-4">
              Navigation
            </h4>
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block text-[13px] text-white/55 py-1 transition-colors hover:text-[var(--orange)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Legal & support */}
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/35 mb-4">
              Légal
            </h4>
            <ul className="flex flex-col gap-1 mb-6">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block text-[13px] text-white/55 py-1 transition-colors hover:text-[var(--orange)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {/* Bouton CNIL : permettre à l'utilisateur de modifier ses choix
                  cookies à tout moment, conformément à la recommandation 2020-091 */}
              <li>
                <CookieSettingsButton />
              </li>
            </ul>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/35 mb-4">
              Support
            </h4>
            <ul className="flex flex-col gap-1 text-[13px] text-white/55">
              <li>📧 contact.nexartis@gmail.com</li>
              <li>Lun-Ven 9h-18h</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-10 py-6">
          <p className="text-center text-[12px] text-white/30 leading-relaxed">
            &copy; 2026 Nexartis &mdash; Bordeaux, France &middot; Logiciel certifié conforme Factur-X &middot; Données hébergées en France
          </p>
        </div>
      </div>
    </footer>
  );
}
