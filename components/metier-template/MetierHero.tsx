"use client";
import Link from "next/link";

interface MetierHeroProps {
  nom: string;
  icon: string;
  h1: string;
  specificite: string;
  longueIntro?: string;
}

export default function MetierHero({ nom, icon, h1, specificite, longueIntro }: MetierHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#0f1a3a] py-20 lg:py-28">
      <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-[#ff7a1a]/10 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-[#ff7a1a]/5 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 sm:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-10 font-hanken text-sm text-white/60">
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/" className="hover:text-white/90 transition-colors">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true" className="mx-1.5">/</li>
            <li>
              <Link href="/#metiers" className="hover:text-white/90 transition-colors">
                Métiers
              </Link>
            </li>
            <li aria-hidden="true" className="mx-1.5">/</li>
            <li>
              <span className="font-semibold text-white/90">{nom}</span>
            </li>
          </ol>
        </nav>

        <div className="text-center">
          <span className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-5xl ring-1 ring-white/10">
            {icon}
          </span>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a1a]" />
            <span className="font-hanken text-xs font-medium uppercase tracking-wider text-white/70">
              Logiciel BTP français
            </span>
          </div>

          <h1 className="font-hanken text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            {h1}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-hanken text-lg leading-relaxed text-white/75">
            {specificite}
          </p>

          {longueIntro && (
            <p className="mx-auto mt-4 max-w-2xl font-hanken text-base leading-relaxed text-white/60">
              {longueIntro}
            </p>
          )}

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-14 items-center rounded-xl bg-[#ff7a1a] px-8 font-hanken text-base font-bold text-white shadow-lg shadow-[#ff7a1a]/20 transition-all hover:bg-[#f09050] hover:shadow-xl hover:shadow-[#ff7a1a]/30"
            >
              Essai gratuit 14 jours
              <span aria-hidden="true" className="ml-2">&rarr;</span>
            </Link>
            <Link
              href="/tarifs"
              className="inline-flex h-14 items-center rounded-xl border border-white/15 bg-white/5 px-8 font-hanken text-base font-semibold text-white/90 transition-all hover:border-white/30 hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>

          <p className="mt-5 font-hanken text-sm text-white/45">
            Sans carte bancaire · Annulation en 1 clic
          </p>
        </div>
      </div>
    </section>
  );
}
