"use client";

import { useState } from "react";
import Link from "next/link";

import PricingSection from "@/components/PricingSection";

/**
 * Page /tarifs — 2 offres Essentiel (15 €) et Complet (25 €).
 *
 * Anti-mensonge / juridique :
 *   - Pas de comparatif nominatif avec les concurrents (Obat, Tolteck, Henrri)
 *     pour éviter tout risque de dénigrement ou de chiffre obsolète.
 *   - Comparatif uniquement Essentiel vs Complet.
 *   - FAQ orientée choix de l'offre, pas comparaison.
 */

const featuresComparison: Array<{
  label: string;
  essential: boolean | string;
  complete: boolean | string;
}> = [
  { label: "Devis illimités", essential: true, complete: true },
  { label: "Factures illimitées", essential: true, complete: true },
  { label: "Signature électronique sur smartphone", essential: true, complete: true },
  { label: "Mentions légales BTP françaises automatiques", essential: true, complete: true },
  { label: "TVA 5,5 % / 10 % / 20 % automatique", essential: true, complete: true },
  { label: "Autoliquidation BTP (sous-traitance)", essential: true, complete: true },
  { label: "Attestations TVA rénovation auto-générées", essential: true, complete: true },
  { label: "Acomptes et factures de situation (#1, #2, #3 avec cumul d'avancement)", essential: true, complete: true },
  { label: "Avoirs et rectifications", essential: true, complete: true },
  { label: "Tableau de bord chiffre d'affaires", essential: true, complete: true },
  { label: "Suivi des impayés et relance en 1 clic", essential: true, complete: true },
  { label: "Export PDF de chaque devis et facture", essential: true, complete: true },
  { label: "Export CSV comptable (Sage / EBP / FEC) — à venir", essential: true, complete: true },
  { label: "Mentions Factur-X 2026 incluses", essential: true, complete: true },
  { label: "Optimisé smartphone et tablette", essential: true, complete: true },
  { label: "Données hébergées en Europe (RGPD)", essential: true, complete: true },
  { label: "Support email Lun-Ven 9h-18h", essential: true, complete: true },
  { label: "Mises à jour continues incluses", essential: true, complete: true },
  { label: "Aucune limite de clients", essential: true, complete: true },
  { label: "Aucune limite de chantiers", essential: true, complete: true },
  { label: "Bibliothèque de prestations", essential: "50 max", complete: "Illimitée" },
  { label: "Planning chantier visuel", essential: false, complete: true },
  { label: "Alertes conflits d'affectation en temps réel", essential: false, complete: true },
  { label: "Gestion d'équipe et planning intervenants", essential: false, complete: true },
  { label: "Devis vocal par intelligence artificielle", essential: false, complete: true },
];

const faqItems = [
  {
    q: "Quelle offre est faite pour moi ?",
    a: "L'Essentiel à 15 € HT/mois convient à l'artisan solo qui chiffre, facture et n'a pas d'équipe à planifier. Le Complet à 25 € HT/mois ajoute le planning visuel, les alertes de conflit d'affectation, la gestion d'équipe et le devis vocal par IA. Si vous travaillez seul, Essentiel suffira amplement.",
  },
  {
    q: "Puis-je passer d'une offre à l'autre ?",
    a: "Oui, à tout moment, depuis votre espace abonnement. Le passage de l'Essentiel au Complet est instantané (vous récupérez l'accès au planning et à l'équipe). Le passage du Complet à l'Essentiel se fait à la fin de votre période payée en cours.",
  },
  {
    q: "Y a-t-il des frais cachés ou des options payantes ?",
    a: "Non, absolument aucun. Le tarif annoncé est définitif. Aucun module à acheter, aucun surcoût par utilisateur, aucune limite sur le nombre de clients ou de chantiers. Les mentions légales Factur-X 2026 sont incluses dans les deux offres.",
  },
  {
    q: "L'essai gratuit est-il vraiment sans carte bancaire ?",
    a: "Oui. Vous créez votre compte avec un email, et vous avez 14 jours pour tester toutes les fonctionnalités du Complet. Aucune carte bancaire n'est demandée à l'inscription. Vous choisissez votre offre Essentiel ou Complet à la fin de la période d'essai.",
  },
  {
    q: "Puis-je annuler mon abonnement à tout moment ?",
    a: "Oui, Nexartis est sans engagement. Vous pouvez résilier directement depuis votre espace, à tout moment. Vos données restent accessibles et exportables pendant 30 jours après l'annulation.",
  },
  {
    q: "Proposez-vous un tarif annuel ?",
    a: "Pas encore. Nous préférons la simplicité d'un tarif unique mensuel sans engagement. Si suffisamment de clients le demandent, nous étudierons une offre annuelle avec réduction.",
  },
  {
    q: "Que se passe-t-il si j'embauche un collaborateur en cours d'année ?",
    a: "Si vous êtes sur l'Essentiel, vous pourrez basculer vers le Complet en un clic depuis votre espace pour accéder à la gestion d'équipe et au planning. Le tarif s'ajuste immédiatement, sans démarche complexe.",
  },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 border border-gray-300">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  // Texte (limite numérique)
  return (
    <span className="text-sm font-semibold text-navy">{value}</span>
  );
}

export default function TarifsPage() {
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy to-[#0d1525] py-20 lg:py-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <h1 className="font-syne text-3xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl">
            Deux offres.
            <br />
            <span className="text-sky">Aucun compromis sur la conformité.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-manrope text-lg leading-relaxed text-gray-300">
            Que vous chiffriez seul ou que vous gériez une équipe, votre logiciel
            est conforme à la réglementation française, sans option cachée.
          </p>
        </div>
      </section>

      {/* ── PricingSection (2 cartes) ── */}
      <PricingSection />

      {/* ── Comparatif détaillé Essentiel vs Complet ── */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl">
            Tout ce qui est inclus, ligne par ligne
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center font-manrope text-lg text-gray-500">
            Comparez les deux offres en détail. Aucune surprise au moment de souscrire.
          </p>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 text-left font-manrope text-sm font-normal text-gray-400" />
                    <th className="bg-sky/5 p-4 font-syne text-sm font-bold text-navy">
                      Essentiel
                      <div className="mt-1 font-manrope text-xs font-semibold text-sky">
                        15 € HT/mois
                      </div>
                    </th>
                    <th className="bg-orange/10 p-4 font-syne text-sm font-bold text-navy">
                      Complet
                      <div className="mt-1 font-manrope text-xs font-semibold text-orange">
                        25 € HT/mois
                      </div>
                      <div className="mt-1 inline-block rounded-full bg-orange/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange">
                        ★ Recommandé
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {featuresComparison.map((row, i) => (
                    <tr
                      key={row.label}
                      className={
                        i < featuresComparison.length - 1
                          ? "border-b border-gray-50"
                          : ""
                      }
                    >
                      <td className="p-4 text-left font-manrope text-sm text-gray-700">
                        {row.label}
                      </td>
                      <td className="bg-sky/5 p-4">
                        <ComparisonCell value={row.essential} />
                      </td>
                      <td className="bg-orange/5 p-4">
                        <ComparisonCell value={row.complete} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-6 text-center font-manrope text-xs text-gray-400 italic">
            * Les deux offres incluent les mises à jour à vie et les mentions
            légales Factur-X 2026 sans surcoût.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-12 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl">
            Questions sur les tarifs
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
          <div>
            <h2 className="mb-4 font-syne text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
              Prêt à essayer ?
            </h2>
            <p className="mx-auto mb-8 max-w-lg font-manrope text-lg text-gray-400">
              14 jours gratuits, toutes les fonctionnalités du Complet, sans
              carte bancaire. Annulez quand vous voulez.
            </p>
            <Link
              href="/register"
              className="inline-flex h-16 items-center justify-center rounded-xl bg-orange px-10 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover"
            >
              Démarrer mon essai gratuit — 14 jours
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
