"use client";

import Link from "next/link";

// V4 landing dark — Final CTA.
// Refonte : carte centree bg-bgdark-2/80 + double halo (blue top, accent bottom).
// Suppression du formulaire email (le design valide n'en a pas).
// Mentions corrigees : hebergement Europe (et non France).

export default function CtaSection() {
  return (
    <section className="landing-section bg-transparent py-[100px] px-5 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div
          className="reveal relative max-w-[1000px] mx-auto rounded-[30px] border border-white/12 bg-bgdark-2/80 px-[24px] sm:px-[40px] py-[60px] sm:py-[72px] text-center text-white overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,255,255,0.02), transparent 60%)",
          }}
        >
          {/* Halo bleu en haut */}
          <div
            aria-hidden
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, color-mix(in srgb, #3f7bff 30%, transparent) 0%, transparent 65%)",
            }}
          />
          {/* Halo accent en bas */}
          <div
            aria-hidden
            className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, color-mix(in srgb, #ff7a1a 28%, transparent) 0%, transparent 65%)",
            }}
          />

          <div className="relative z-[1]">
            <h2 className="landing-text-grad text-[30px] sm:text-[44px] font-[800] tracking-[-0.03em] mb-4">
              Prenez le controle de votre gestion d&apos;entreprise
            </h2>

            <p className="text-[17px] sm:text-[18px] text-ink-2 max-w-[480px] mx-auto mb-9">
              14 jours d&apos;acces complet, gratuit, sans carte bancaire requise.
            </p>

            <Link
              href="/register"
              className="btn-pricing inline-flex items-center justify-center h-[56px] px-8 text-[16px]"
            >
              Commencer gratuitement →
            </Link>

            <p className="mt-7 text-[13.5px] text-ink-3 font-medium">
              Vos donnees sont hebergees dans l&apos;Union europeenne et ne sont jamais partagees.
            </p>
            <p className="mt-2 text-[13.5px] text-ink-3 font-medium">
              Une question ?{" "}
              <a
                href="mailto:contact.nexartis@gmail.com"
                className="text-accent-ink hover:underline"
              >
                contact.nexartis@gmail.com
              </a>{" "}
              · Lun-Ven 9h-18h
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
