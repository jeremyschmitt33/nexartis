"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function Hero() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (barRef.current) barRef.current.style.width = "66%";
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-hero-gradient pt-[140px] pb-[80px] px-5 lg:px-10">
      {/* Decorative radial gradients */}
      <div className="absolute -top-[200px] -right-[100px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(90,180,224,0.08)_0%,transparent_70%)]" />
      <div className="absolute -bottom-[150px] -left-[50px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(232,122,42,0.06)_0%,transparent_70%)]" />

      <div className="relative z-[1] mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-[60px] items-center">
        {/* Left — Text */}
        <div className="lg:text-left text-center">
          {/* Badge */}
          <div className="reveal inline-flex items-center gap-2 bg-[rgba(245,200,66,0.12)] border border-[rgba(245,200,66,0.2)] text-[var(--gold)] text-[13px] font-bold px-[18px] py-2 rounded-full mb-7 tracking-[0.02em]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Conçu en Gironde · Pour les artisans de toute la France
          </div>

          <h1 className="reveal reveal-delay-1 text-[30px] sm:text-[38px] lg:text-[52px] font-[800] text-white tracking-[-0.035em] leading-[1.1] mb-2">
            Tous vos outils artisan.
            <br />
            Un seul prix.
            <br />
            <span className="text-[var(--sky)]">Dès 15€/mois.</span>
          </h1>

          <p className="reveal reveal-delay-2 text-[18px] text-white/60 font-medium leading-[1.65] max-w-[480px] mt-5 mx-auto lg:mx-0">
            Devis, factures, planning et suivi financier — réunis dans une seule application, pensée pour tous les artisans.
          </p>

          <div className="reveal reveal-delay-3 flex flex-wrap gap-3.5 mt-9 justify-center lg:justify-start">
            <Link href="/register" className="btn-hero-primary">
              Essayer gratuitement 14 jours
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          <p className="reveal reveal-delay-4 text-[13px] text-white/35 mt-4 font-medium">
            Sans carte bancaire · Sans engagement
          </p>
        </div>

        {/* Right — Dashboard Mockup */}
        <div className="reveal reveal-delay-3 animate-float max-w-[500px] mx-auto lg:max-w-none">
          <div className="bg-[rgba(26,45,90,0.6)] border border-white/[0.08] rounded-[20px] overflow-hidden backdrop-blur-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Window bar */}
            <div className="h-10 bg-black/15 flex items-center px-4 gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[12px] text-white/35 font-semibold">nexartis.fr/dashboard</span>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* KPI Row */}
              <div className="grid grid-cols-2 gap-3 mb-3.5">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--sky)] mb-2.5" />
                  <div className="text-2xl font-[800] text-white tracking-[-0.03em] tabular-nums">6 620 €</div>
                  <div className="text-[11px] text-white/40 font-semibold mt-1">CA Facturé</div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--green)] mb-2.5" />
                  <div className="text-2xl font-[800] text-white tracking-[-0.03em] tabular-nums">2 110 €</div>
                  <div className="text-[11px] text-white/40 font-semibold mt-1">Encaissé</div>
                </div>
              </div>

              {/* Planning card */}
              <div className="bg-white/[0.05] border border-white/[0.06] rounded-[14px] p-5 mb-3.5 transition-all hover:bg-white/[0.08] hover:border-white/[0.12]">
                <div className="text-[12px] text-white/40 font-semibold mb-3">Planning de la semaine</div>
                {[
                  { color: "var(--sky)", bg: "rgba(90,180,224,0.1)", title: "Installation tableau", sub: "M. Dupont · Lun 08:30" },
                  { color: "var(--orange)", bg: "rgba(232,122,42,0.1)", title: "Rénovation cuisine", sub: "M. Martin · Jeu 09:00" },
                  { color: "var(--green)", bg: "rgba(34,197,94,0.1)", title: "Pose carrelage", sub: "M. Bernard · Ven 14:00" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] mb-2 transition-transform hover:translate-x-[3px]"
                    style={{ background: item.bg }}
                  >
                    <div className="w-[3px] h-7 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <div>
                      <div className="text-[13px] text-white font-semibold">{item.title}</div>
                      <div className="text-[11px] text-white/40 font-medium mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="bg-white/[0.05] border border-white/[0.06] rounded-[14px] p-5 transition-all hover:bg-white/[0.08] hover:border-white/[0.12]">
                <div className="text-[12px] text-white/40 font-semibold mb-1.5">Objectif du mois</div>
                <div className="text-[18px] font-[800] text-white mb-3">Suivi en temps réel</div>
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    ref={barRef}
                    className="h-full rounded-full bg-[var(--green)] transition-[width] duration-[1.5s] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
