"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const featureItems = [
  {
    icon: "📄",
    title: "Devis & Factures",
    desc: "Créez vos documents en quelques minutes",
    href: "/logiciel-devis-factures",
  },
  {
    icon: "📅",
    title: "Planning intelligent",
    desc: "Alertes conflits automatiques",
    badge: "★ Exclusif",
    href: "/planning-chantier-intelligent",
  },
  {
    icon: "📊",
    title: "Tableau de bord",
    desc: "Suivez votre chiffre d\u2019affaires en temps réel",
    href: "/#fonctionnalites",
  },
  {
    icon: "🔔",
    title: "Relances impayés",
    desc: "Récupérez votre argent sans effort",
    href: "/#fonctionnalites",
  },
  {
    icon: "⚡",
    title: "Facture électronique",
    desc: "Prêt pour Factur-X 2026",
    href: "/#fonctionnalites",
  },
  {
    icon: "📱",
    title: "Mobile et terrain",
    desc: "Optimisé pour smartphone et tablette",
    href: "/#fonctionnalites",
  },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSubOpen, setMobileSubOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  // Scroll shadow effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-[72px] flex items-center justify-between px-5 lg:px-10 bg-white/[0.92] backdrop-blur-[20px] border-b border-black/[0.04] transition-shadow duration-300 ${
        scrolled ? "shadow-[0_2px_20px_rgba(15,26,58,0.06)]" : ""
      }`}
    >
      {/* Logo (image contient deja le wordmark Nexartis - fond transparent) */}
      <Link href="/" className="flex items-center no-underline" aria-label="Nexartis - Accueil">
        <Image
          src="/images/logo-nexartis.png"
          alt="Nexartis"
          width={400}
          height={200}
          quality={100}
          priority
          sizes="(max-width: 640px) 200px, 280px"
          className="h-16 sm:h-20 w-auto object-contain"
        />
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-8 md:flex">
        {/* Fonctionnalites dropdown */}
        <div
          ref={dropdownRef}
          className="relative"
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--navy)]"
          >
            Fonctionnalités
            <svg
              className={`h-4 w-4 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Mega menu */}
          <div
            className={`absolute left-1/2 top-full z-50 w-[560px] -translate-x-1/2 pt-2 transition-all duration-150 ${
              dropdownOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-hover)]">
              <div className="grid grid-cols-2 gap-2">
                {featureItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--bg)]"
                  >
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--navy)]">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                        {item.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/tarifs"
          className="text-sm font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--navy)]"
        >
          Tarifs
        </Link>
        <Link
          href="/blog"
          className="text-sm font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--navy)]"
        >
          Blog
        </Link>
      </nav>

      {/* Desktop right side */}
      <div className="hidden items-center gap-3 md:flex">
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="text-sm font-bold text-[var(--navy)] px-5 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg)]"
        >
          {isLoggedIn ? "Mon espace" : "Se connecter"}
        </Link>
        <Link
          href="/register"
          className="text-sm font-bold text-white bg-[var(--orange)] px-6 py-2.5 rounded-xl transition-all hover:bg-[var(--orange-light)] hover:shadow-[0_4px_16px_rgba(232,122,42,0.25)]"
        >
          Essai gratuit
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Toggle menu"
        className="flex flex-col items-center justify-center gap-[5px] md:hidden"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span
          className={`block h-[2px] w-6 bg-[var(--navy)] transition-transform duration-200 ${
            menuOpen ? "translate-y-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`block h-[2px] w-6 bg-[var(--navy)] transition-opacity duration-200 ${
            menuOpen ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block h-[2px] w-6 bg-[var(--navy)] transition-transform duration-200 ${
            menuOpen ? "-translate-y-[7px] -rotate-45" : ""
          }`}
        />
      </button>

      {/* Mobile full-screen overlay menu */}
      <div
        className={`fixed inset-0 top-[72px] z-50 bg-white transition-all duration-200 md:hidden ${
          menuOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0"
        }`}
      >
        <nav className="flex h-full flex-col px-5 py-4">
          {/* Fonctionnalites expandable */}
          <button
            type="button"
            onClick={() => setMobileSubOpen((v) => !v)}
            className="flex h-[56px] items-center justify-between text-lg font-bold text-[var(--navy)]"
          >
            Fonctionnalités
            <svg
              className={`h-5 w-5 transition-transform duration-150 ${mobileSubOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Sub-items */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              mobileSubOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-1 pb-2 pl-2">
              {featureItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => { setMenuOpen(false); setMobileSubOpen(false); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg)]"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--navy)]">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/tarifs"
            onClick={() => setMenuOpen(false)}
            className="flex h-[56px] items-center text-lg font-bold text-[var(--navy)]"
          >
            Tarifs
          </Link>
          <Link
            href="/blog"
            onClick={() => setMenuOpen(false)}
            className="flex h-[56px] items-center text-lg font-bold text-[var(--navy)]"
          >
            Blog
          </Link>

          <hr className="my-3 border-[var(--border)]" />

          {/* Mobile CTAs at bottom */}
          <div className="mt-auto flex flex-col gap-3 pb-8">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              onClick={() => setMenuOpen(false)}
              className="flex h-12 items-center justify-center rounded-xl border border-[var(--border)] font-bold text-[var(--navy)] transition-colors hover:bg-[var(--bg)]"
            >
              {isLoggedIn ? "Mon espace" : "Se connecter"}
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="flex h-12 items-center justify-center rounded-xl bg-[var(--orange)] font-bold text-white transition-colors hover:bg-[var(--orange-light)]"
            >
              Essai gratuit
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
