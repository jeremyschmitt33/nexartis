"use client";

import { useState } from "react";

const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    title: "Signature \u00e9lectronique",
    desc: "Vos clients signent directement sur leur t\u00e9l\u00e9phone. Valeur juridique assur\u00e9e.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: "TVA automatique (5.5/10/20%)",
    desc: "S\u00e9lectionnez le type de travaux, la TVA s\u2019applique toute seule.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Mentions l\u00e9gales conformes",
    desc: "Assurance d\u00e9cennale, RGE, Qualibat\u2026 Tout est pr\u00e9-rempli automatiquement.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Envoi par email",
    desc: "Envoyez vos devis et factures en un clic. Notification de lecture incluse.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: "Biblioth\u00e8que de prestations",
    desc: "Enregistrez vos prestations courantes. Cr\u00e9ez un devis en quelques clics.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Acomptes et situations",
    desc: "G\u00e9rez les acomptes, les situations de travaux et les retenues de garantie.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
      </svg>
    ),
    title: "Avoirs et rectifications",
    desc: "Cr\u00e9ez un avoir en 2 clics depuis n\u2019importe quelle facture.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Export comptable",
    desc: "Exportez vos donn\u00e9es en CSV ou PDF pour votre comptable en un clic.",
  },
];

const prestations = [
  { ref: "PLOMB-001", desc: "Installation chauffe-eau thermodynamique Atlantic 270L", qty: 1, unit: "forfait", price: 2450 },
  { ref: "PLOMB-002", desc: "Raccordement eau chaude/froide cuivre \u00d818", qty: 1, unit: "forfait", price: 380 },
  { ref: "PLOMB-003", desc: "D\u00e9pose ancien cumulus \u00e9lectrique 200L", qty: 1, unit: "forfait", price: 180 },
  { ref: "PLOMB-004", desc: "Mise en conformit\u00e9 \u00e9vacuation condensats", qty: 1, unit: "forfait", price: 220 },
  { ref: "ELEC-001", desc: "Fourniture et pose disjoncteur diff\u00e9rentiel 20A", qty: 1, unit: "u", price: 145 },
];

const faqItems = [
  {
    q: "Puis-je cr\u00e9er un devis depuis mon t\u00e9l\u00e9phone\u00a0?",
    a: "Oui, Nexartis est enti\u00e8rement responsive. Cr\u00e9ez, modifiez et envoyez vos devis directement depuis votre smartphone, m\u00eame sur chantier.",
  },
  {
    q: "La signature \u00e9lectronique a-t-elle une valeur juridique\u00a0?",
    a: "Absolument. Notre signature \u00e9lectronique est conforme au r\u00e8glement eIDAS. Elle a la m\u00eame valeur qu\u2019une signature manuscrite devant les tribunaux.",
  },
  {
    q: "Comment fonctionne la TVA automatique\u00a0?",
    a: "Lorsque vous cr\u00e9ez un devis, Nexartis d\u00e9tecte automatiquement le taux de TVA applicable (5.5% pour la r\u00e9novation \u00e9nerg\u00e9tique, 10% pour les travaux d\u2019am\u00e9lioration, 20% pour le neuf) en fonction du type de prestation.",
  },
  {
    q: "Puis-je importer mes anciens devis depuis un autre logiciel\u00a0?",
    a: "Oui, vous pouvez importer vos donn\u00e9es clients et prestations via un fichier CSV. Notre \u00e9quipe vous accompagne gratuitement pour la migration.",
  },
  {
    q: "Qu\u2019est-ce que la facturation \u00e9lectronique Factur-X 2026\u00a0?",
    a: "D\u00e8s septembre 2026, toutes les entreprises devront \u00e9mettre des factures au format \u00e9lectronique Factur-X. Nexartis est pr\u00eat pour la facturation \u00e9lectronique 2026.",
  },
];

export default function LogicielDevisFacturesPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const subtotal = prestations.reduce((s, p) => s + p.price * p.qty, 0);
  const tva = Math.round(subtotal * 0.1);
  const total = subtotal + tva;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy to-[#0d1525] py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <h1
            className="font-syne text-3xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl"
          >
            Cr&eacute;ez vos devis et factures
            <br />
            <span className="text-sky">rapidement</span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-2xl font-manrope text-lg leading-relaxed text-gray-300"
          >
            Fini les soir&eacute;es perdues &agrave; remplir des devis sur Excel.
            Nexartis g&eacute;n&egrave;re vos documents professionnels en quelques
            clics, avec signature &eacute;lectronique et TVA automatique.
          </p>
          <div
            className="mt-8"
          >
            <button className="h-16 rounded-xl bg-orange px-8 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover">
              Essayer gratuitement 14 jours &rarr;
            </button>
            <p className="mt-3 font-manrope text-sm text-gray-400">
              Sans carte bancaire requise · Sans engagement
            </p>
          </div>
        </div>
      </section>

      {/* ── Devis Mockup ── */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <h2
            className="mb-12 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Voici &agrave; quoi ressemble un devis Nexartis
          </h2>

          <div
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/10"
          >
            {/* Document header */}
            <div className="border-b border-gray-100 px-8 py-6 md:px-10">
              <div className="flex flex-col justify-between gap-6 md:flex-row">
                <div>
                  <h3 className="font-syne text-xl font-extrabold text-navy">
                    SARL Durand Plomberie
                  </h3>
                  <p className="mt-1 font-manrope text-sm text-gray-500">
                    12 rue des Acacias, 33000 Bordeaux
                  </p>
                  <p className="font-manrope text-sm text-gray-500">
                    SIRET : 842 156 789 00012
                  </p>
                  <p className="font-manrope text-sm text-gray-500">
                    Assurance d&eacute;cennale : MAAF n&deg;4521897
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <div className="inline-block rounded-lg bg-sky/10 px-4 py-2">
                    <p className="font-syne text-lg font-bold text-navy">
                      DEVIS N&deg; D-2026-0047
                    </p>
                    <p className="font-manrope text-sm text-gray-500">
                      Date : 07/04/2026
                    </p>
                    <p className="font-manrope text-sm text-gray-500">
                      Validit&eacute; : 30 jours
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Client info */}
            <div className="border-b border-gray-100 px-8 py-4 md:px-10">
              <p className="font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                Client
              </p>
              <p className="mt-1 font-manrope text-sm font-semibold text-navy">
                M. et Mme Lef&egrave;vre
              </p>
              <p className="font-manrope text-sm text-gray-500">
                45 avenue du Mar&eacute;chal Foch, 33200 Bordeaux
              </p>
              <p className="font-manrope text-sm text-gray-500">
                Chantier : Remplacement chauffe-eau — m&ecirc;me adresse
              </p>
            </div>

            {/* Prestations table */}
            <div className="overflow-x-auto px-8 py-6 md:px-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-navy/10">
                    <th className="pb-3 font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                      R&eacute;f.
                    </th>
                    <th className="pb-3 font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                      D&eacute;signation
                    </th>
                    <th className="pb-3 text-center font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Qt&eacute;
                    </th>
                    <th className="pb-3 text-right font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Prix HT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {prestations.map((p, i) => (
                    <tr
                      key={p.ref}
                      className={i < prestations.length - 1 ? "border-b border-gray-50" : ""}
                    >
                      <td className="py-3 font-manrope text-xs text-gray-400">
                        {p.ref}
                      </td>
                      <td className="py-3 font-manrope text-sm text-navy">
                        {p.desc}
                      </td>
                      <td className="py-3 text-center font-manrope text-sm text-gray-600">
                        {p.qty} {p.unit}
                      </td>
                      <td className="py-3 text-right font-manrope text-sm font-semibold text-navy">
                        {p.price.toLocaleString("fr-FR")}&nbsp;&euro;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 px-8 py-6 md:px-10">
              <div className="ml-auto max-w-xs space-y-2">
                <div className="flex justify-between font-manrope text-sm text-gray-600">
                  <span>Total HT</span>
                  <span className="font-semibold text-navy">
                    {subtotal.toLocaleString("fr-FR")}&nbsp;&euro;
                  </span>
                </div>
                <div className="flex justify-between font-manrope text-sm text-gray-600">
                  <span>TVA 10%</span>
                  <span>{tva.toLocaleString("fr-FR")}&nbsp;&euro;</span>
                </div>
                <div className="h-px bg-navy/10" />
                <div className="flex justify-between font-syne text-lg font-bold text-navy">
                  <span>Total TTC</span>
                  <span>{total.toLocaleString("fr-FR")}&nbsp;&euro;</span>
                </div>
              </div>
            </div>

            {/* Signature zone */}
            <div className="border-t border-gray-100 bg-gray-50/50 px-8 py-6 md:px-10">
              <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                <div className="flex-1">
                  <p className="font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Bon pour accord &mdash; Signature client
                  </p>
                  <div className="mt-3 flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-sky/30 bg-sky/5">
                    <span className="font-manrope text-sm italic text-sky">
                      Zone de signature &eacute;lectronique
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-manrope text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Signature entreprise
                  </p>
                  <div className="mt-3 flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
                    <span className="font-syne text-lg font-bold italic text-navy/30">
                      P. Durand
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2
            className="mb-4 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Tout ce qu&apos;il faut pour facturer sereinement
          </h2>
          <p
            className="mx-auto mb-14 max-w-xl text-center font-manrope text-lg text-gray-500"
          >
            8 fonctionnalit&eacute;s essentielles, incluses dans votre abonnement
            d&egrave;s 15&euro;/mois.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 bg-cream/40 p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky/10 text-sky transition-colors group-hover:bg-sky/20">
                  {f.icon}
                </div>
                <h3 className="mb-2 font-syne text-base font-bold text-navy">
                  {f.title}
                </h3>
                <p className="font-manrope text-sm leading-relaxed text-gray-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Factur-X Legal Section ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div
            className="overflow-hidden rounded-2xl border border-navy/10 bg-gradient-to-br from-navy to-navy-mid p-8 md:p-12"
          >
            <div className="mb-6 inline-block rounded-full bg-gold/20 px-4 py-1.5">
              <span className="font-syne text-sm font-bold text-gold">
                Obligation l&eacute;gale 2026
              </span>
            </div>
            <h2 className="mb-6 font-syne text-2xl font-extrabold text-white md:text-3xl">
              Factur-X 2026 : ce que &ccedil;a change pour vous
            </h2>
            <div className="space-y-4 font-manrope text-base leading-relaxed text-gray-300">
              <p>
                &Agrave; partir du <strong className="text-white">1er septembre 2026</strong>, toutes
                les entreprises fran&ccedil;aises, y compris les artisans et
                micro-entreprises, devront &eacute;mettre leurs factures au{" "}
                <strong className="text-white">format &eacute;lectronique Factur-X</strong>.
              </p>
              <p>
                Factur-X est un format hybride : un PDF lisible par l&apos;humain,
                embarquant un fichier XML structur&eacute; lisible par les
                machines. Cela permet la transmission automatique &agrave;
                l&apos;administration fiscale via une plateforme de
                d&eacute;mat&eacute;rialisation partenaire (PDP).
              </p>
              <p>
                <strong className="text-sky">
                  Nexartis est pr&ecirc;t pour la facturation &eacute;lectronique 2026.
                </strong>{" "}
                Vos factures contiennent toutes les mentions l&eacute;gales BTP fran&ccedil;aises
                requises et le format Factur-X sera d&eacute;ploy&eacute; avant l&apos;entr&eacute;e
                en vigueur de l&apos;obligation, sans manipulation de votre part.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Format", value: "Factur-X / EN 16931" },
                { label: "Transmission", value: "PDP \u00e0 venir" },
                { label: "Mentions BTP", value: "Compl\u00e8tes" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                >
                  <p className="font-manrope text-xs font-medium uppercase tracking-wider text-gray-400">
                    {item.label}
                  </p>
                  <p className="mt-1 font-syne text-sm font-bold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <h2
            className="mb-12 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Questions fr&eacute;quentes sur la facturation
          </h2>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="pr-4 font-syne text-base font-bold text-navy">
                    {item.q}
                  </span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy transition-transform ${
                      openFaq === i ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                    <p className="font-manrope text-sm leading-relaxed text-gray-600">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-navy py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div
          >
            <h2 className="mb-4 font-syne text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
              Essayez Nexartis gratuitement
            </h2>
            <p className="mx-auto mb-8 max-w-lg font-manrope text-lg text-gray-400">
              14 jours gratuits pour cr&eacute;er vos devis et factures
              professionnels. Sans carte bancaire.
            </p>
            <button className="h-16 rounded-xl bg-orange px-10 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover">
              D&eacute;marrer mon essai gratuit &mdash; 14 jours
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
