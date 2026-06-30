import Link from "next/link";

import Atmosphere from "@/components/landing/Atmosphere";
import ScrollReveal from "@/components/ScrollReveal";

/**
 * Page /tarifs — V2 (2026-06-30) refonte dark premium.
 *
 * - Style unifié landing dark (Atmosphere + ScrollReveal + classes globales).
 *   => corrige le bug V1 : <PricingSection/> utilisait .reveal mais ScrollReveal
 *      n'était monté que sur app/page.tsx, donc les cartes prix restaient invisibles.
 * - 2 offres : Essentiel 15 € (Démarrer) / Complet 25 € (Passer la vitesse supérieure).
 * - Promo "tarif de lancement -20 %" : prix barré 19/31 présenté comme prix à venir.
 * - FAQ native <details> + schema FAQPage JSON-LD.
 * - Maillage interne vers pages métier + outils.
 *
 * Anti-mensonge :
 *   - Le rapport d'intervention est marqué BIENTÔT (non encore livré).
 *   - La répartition des fonctions doit correspondre au gating réel de lib/plans.ts.
 *   - Aucune fausse promo barrée : 19/31 = "tarif de lancement, bientôt".
 */

type CompareValue = boolean | string;

interface CompareRow {
  label: string;
  badge?: string;
  essential: CompareValue;
  complete: CompareValue;
}

const ESSENTIAL_FEATURES: string[] = [
  "Devis & factures illimités",
  "Signature électronique sur smartphone",
  "Mentions BTP & TVA (5,5 / 10 / 20 %) automatiques",
  "Acomptes & attestations TVA rénovation",
  "Suivi des impayés & relances (email + SMS)",
  "Conforme facture électronique 2026 / 2027",
  "Tableau de bord du chiffre d'affaires",
  "Support par email (Lun–Ven)",
];

interface CompleteExtra {
  label: string;
  badge?: string;
}

const COMPLETE_EXTRA: CompleteExtra[] = [
  { label: "Devis vocal par IA — dictez votre devis depuis le chantier" },
  { label: "Planning chantier visuel + alertes de conflit" },
  { label: "Gestion d'équipe & intervenants" },
  { label: "Factures de situation (#1, #2, #3 avec cumul)" },
  { label: "Export comptable (Sage / EBP / FEC)" },
  { label: "Rapport d'intervention", badge: "BIENTÔT" },
  { label: "Bibliothèque de prestations illimitée" },
  { label: "Support prioritaire" },
];

const COMPARISON: CompareRow[] = [
  { label: "Devis & factures illimités", essential: true, complete: true },
  { label: "Signature & conformité e-facture 2026", essential: true, complete: true },
  { label: "Suivi impayés & relances (email + SMS)", essential: true, complete: true },
  { label: "Acomptes", essential: true, complete: true },
  { label: "Factures de situation (#1, #2, #3)", essential: false, complete: true },
  { label: "Devis vocal par IA", essential: false, complete: true },
  { label: "Planning chantier & alertes de conflit", essential: false, complete: true },
  { label: "Gestion d'équipe & intervenants", essential: false, complete: true },
  { label: "Rapport d'intervention", badge: "BIENTÔT", essential: false, complete: true },
  { label: "Export comptable (Sage / EBP / FEC)", essential: false, complete: true },
  { label: "Bibliothèque de prestations", essential: "50 max", complete: "Illimitée" },
  { label: "Support", essential: "Email", complete: "Prioritaire" },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Pourquoi le tarif est-il à −20 % en ce moment ?",
    a: "C'est un tarif de lancement. Les prix augmenteront prochainement (Essentiel à 19 €, Complet à 31 €). En vous abonnant maintenant, vous profitez du tarif réduit dès le départ.",
  },
  {
    q: "Quelle est la différence entre Essentiel et Complet ?",
    a: "L'Essentiel (15 €) couvre tout le métier de base : devis, factures, conformité, relances. Le Complet (25 €) ajoute de quoi gagner du temps et tout piloter : devis vocal par IA, planning, gestion d'équipe, factures de situation, export comptable et support prioritaire. Même en solo, le Complet vaut souvent le coup pour le temps gagné.",
  },
  {
    q: "L'essai de 14 jours demande-t-il une carte bancaire ?",
    a: "Non. Vous créez votre compte avec un simple email et vous testez toutes les fonctions du Complet pendant 14 jours. Aucune carte n'est demandée. Vous choisissez votre offre à la fin de l'essai.",
  },
  {
    q: "Y a-t-il des frais cachés ou des options payantes ?",
    a: "Aucun. Pas de surcoût par utilisateur, par catalogue ou par photo. Aucune limite de clients ni de chantiers. Le tarif affiché est définitif.",
  },
  {
    q: "Puis-je changer d'offre ou résilier à tout moment ?",
    a: "Oui. Vous passez de l'Essentiel au Complet (et inversement) en un clic depuis votre espace, et vous résiliez quand vous voulez, sans engagement. Vos données restent exportables à tout moment.",
  },
  {
    q: "Combien coûte un logiciel de devis et facture pour artisan ?",
    a: "Chez Nexartis, le logiciel de devis et facture coûte 15 €/mois HT (offre Essentiel) ou 25 €/mois HT (offre Complet), sans engagement. C'est l'un des meilleurs rapports prix/fonctions du marché pour un artisan du bâtiment, sans frais cachés ni surcoût par utilisateur.",
  },
  {
    q: "Nexartis est-il conforme à la facturation électronique 2026 / 2027 ?",
    a: "Oui, dans les deux offres. La réception des factures électroniques de vos fournisseurs (obligatoire dès 2026) et la préparation de l'émission de vos propres factures (échéance 2027) sont incluses, sans surcoût.",
  },
  {
    q: "Que deviennent mes données si je résilie ?",
    a: "Elles restent les vôtres. Vous exportez vos devis, factures et clients en PDF et CSV à tout moment, avant comme après la résiliation, sans limite. Vos données sont hébergées en Europe (RGPD).",
  },
  {
    q: "Proposez-vous un tarif annuel ?",
    a: "Pas encore. Nous préférons la simplicité d'un tarif mensuel unique, sans engagement. Si suffisamment d'artisans le demandent, nous étudierons une offre annuelle avec réduction.",
  },
];

const METIER_LINKS: Array<{ href: string; label: string }> = [
  { href: "/logiciel-devis-electricien", label: "Logiciel devis électricien" },
  { href: "/logiciel-devis-plombier", label: "Plombier" },
  { href: "/logiciel-devis-maconnerie", label: "Maçon" },
  { href: "/logiciel-devis-peintre", label: "Peintre" },
  { href: "/logiciel-devis-menuisier", label: "Menuisier" },
  { href: "/logiciel-devis-carreleur", label: "Carreleur" },
  { href: "/logiciel-devis-chauffagiste", label: "Chauffagiste" },
  { href: "/logiciel-artisan-auto-entrepreneur", label: "Auto-entrepreneur" },
];

const ORANGE_CELL = "color-mix(in srgb, #ff7a1a 6%, transparent)";

function CheckMark() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#2fd6a0" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
      className="mt-0.5 flex-shrink-0" aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CompareCell({ value, accent }: { value: CompareValue; accent?: boolean }) {
  if (value === true) {
    return <span className={accent ? "text-accent-2" : "text-mint"} aria-hidden="true">✓</span>;
  }
  if (value === false) {
    return <span className="text-ink-3" aria-hidden="true">—</span>;
  }
  return (
    <span className={accent ? "text-accent-2 text-xs font-bold" : "text-ink-2 text-xs font-semibold"}>
      {value}
    </span>
  );
}

export default function TarifsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="bg-bgdark min-h-screen text-ink font-hanken">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ScrollReveal />
      <Atmosphere />

      <div className="landing-section">

        {/* HERO */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-14 text-center">
          <h2 className="sr-only">Nos offres et tarifs</h2>
          <span className="landing-eyebrow landing-eyebrow--accent reveal">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", boxShadow: "0 0 10px currentColor" }} />
            Tarif de lancement —20 %
          </span>
          <h1 className="font-hanken text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-[-0.03em] mt-6 reveal reveal-delay-1">
            Le prix d&apos;un logiciel de devis et facture pour artisan,{" "}
            <span className="landing-text-grad">clair et sans surprise.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-ink-2 max-w-2xl mx-auto leading-relaxed reveal reveal-delay-2">
            Deux offres simples, sans engagement. Vous changez quand vous voulez, en un clic.{" "}
            <span className="font-semibold text-ink">14 jours d&apos;essai, sans carte bancaire.</span>
          </p>
        </section>

        {/* CARTES */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-stretch">

            {/* ESSENTIEL */}
            <div className="reveal rounded-3xl p-[1px] bg-white/[0.08]">
              <div className="rounded-[23px] bg-bgdark-2 p-8 lg:p-10 h-full flex flex-col border border-white/[0.04]">
                <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-electric-2">Démarrer</span>
                <h3 className="font-hanken text-2xl font-extrabold mt-2">Essentiel</h3>
                <p className="text-ink-2 mt-1 text-sm leading-snug">Tout pour chiffrer, facturer et être payé. Carré et conforme dès le premier jour.</p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-ink-3 line-through text-2xl font-bold">19€</span>
                  <span className="font-hanken text-6xl font-black leading-none tabular-nums">15€</span>
                  <span className="text-ink-2 font-semibold mb-1.5">/mois HT</span>
                </div>
                <p className="text-xs text-accent-ink font-bold mt-1">Tarif de lancement · bientôt 19 €</p>
                <p className="text-xs text-ink-3 mt-0.5">Sans engagement · Résiliation à tout moment</p>

                <Link href="/register?plan=essential" className="mt-6 block text-center rounded-2xl py-3.5 font-bold border border-white/[0.16] text-ink hover:bg-white/[0.06] transition">
                  Démarrer l&apos;essai gratuit
                </Link>
                <p className="text-center text-xs text-ink-3 mt-2">14 jours · sans carte bancaire</p>

                <div className="h-px bg-white/[0.08] my-7" />

                <ul className="space-y-3 text-sm text-ink-2">
                  {ESSENTIAL_FEATURES.map((f) => (
                    <li key={f} className="flex gap-2.5"><CheckMark />{f}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* COMPLET */}
            <div
              className="reveal reveal-delay-1 rounded-3xl p-[1.5px] overflow-hidden"
              style={{ background: "linear-gradient(135deg, color-mix(in srgb,#3f7bff 65%,transparent) 0%, color-mix(in srgb,#ff7a1a 80%,transparent) 100%)" }}
            >
              <div className="rounded-[22px] bg-bgdark-2 p-8 lg:p-10 h-full flex flex-col relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, color-mix(in srgb,#ff7a1a 26%,transparent) 0%, transparent 65%)", filter: "blur(30px)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-accent-ink">Passer la vitesse supérieure</span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-full"
                      style={{ color: "#ffc79a", background: "color-mix(in srgb,#ff7a1a 14%,transparent)", border: "1px solid color-mix(in srgb,#ff7a1a 38%,transparent)" }}
                    >
                      ★ Recommandé
                    </span>
                  </div>
                  <h3 className="font-hanken text-2xl font-extrabold mt-2">Complet</h3>
                  <p className="text-ink-2 mt-1 text-sm leading-snug">Tout l&apos;Essentiel, plus de quoi gagner un temps fou et tout piloter — même en solo.</p>

                  <div className="mt-6 flex items-end gap-2">
                    <span className="text-ink-3 line-through text-2xl font-bold">31€</span>
                    <span className="font-hanken text-6xl font-black leading-none tabular-nums text-accent-2">25€</span>
                    <span className="text-ink-2 font-semibold mb-1.5">/mois HT</span>
                  </div>
                  <p className="text-xs text-gold font-bold mt-1">Tarif de lancement · bientôt 31 €</p>
                  <p className="text-xs text-ink-3 mt-0.5">Sans engagement · Aucune limite</p>

                  <Link href="/register?plan=complete" className="mt-6 block text-center rounded-2xl py-3.5 font-bold text-bgdark bg-gradient-to-br from-accent-2 to-accent shadow-[0_8px_30px_rgba(255,122,26,0.35)] hover:-translate-y-0.5 transition">
                    Essayer le Complet — 14 jours
                  </Link>
                  <p className="text-center text-xs text-ink-3 mt-2">14 jours · sans carte bancaire</p>

                  <div className="h-px bg-white/[0.10] my-7" />

                  <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-accent-2 mb-3">Tout l&apos;Essentiel, et en plus :</p>
                  <ul className="space-y-3 text-sm text-ink">
                    {COMPLETE_EXTRA.map((f) => (
                      <li key={f.label} className="flex gap-2.5">
                        <span className="text-gold mt-0.5" aria-hidden="true">★</span>
                        <span>
                          {f.label}
                          {f.badge ? <span className="ml-1.5 text-[10px] bg-white/15 px-1.5 py-0.5 rounded font-bold align-middle">{f.badge}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-ink-2 mt-8 reveal">Vous passez de l&apos;Essentiel au Complet (et inversement) à tout moment depuis votre espace.</p>
        </section>

        {/* RÉASSURANCE */}
        <section className="border-y border-white/[0.07] bg-bgdark-2/40 py-7">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm font-semibold text-center text-ink-2">
            <span>Sans carte bancaire</span>
            <span>Sans engagement</span>
            <span>Hébergé en Europe</span>
            <span>Données exportables à vie</span>
          </div>
        </section>

        {/* DIFFÉRENCIATION */}
        <section className="max-w-5xl mx-auto px-6 py-20 lg:py-28">
          <div className="text-center mb-14 reveal">
            <span className="landing-eyebrow mb-5">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", boxShadow: "0 0 10px currentColor" }} />
              Comment choisir
            </span>
            <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-[-0.03em] mt-5">Quelle version est faite pour vous ?</h2>
            <p className="text-ink-2 mt-3 max-w-2xl mx-auto text-lg">Ce n&apos;est pas une question de taille d&apos;entreprise. C&apos;est une question d&apos;ambition.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Démarrer */}
            <div className="reveal rounded-3xl p-[1px] bg-white/[0.08]">
              <div className="rounded-[23px] bg-bgdark-2 p-8 lg:p-10 h-full border border-white/[0.04]">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "color-mix(in srgb,#3f7bff 14%,transparent)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6aa0ff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-electric-2">Démarrer · Essentiel</span>
                <h3 className="font-hanken text-2xl font-extrabold mt-2 mb-3">Vous voulez être carré, tout de suite.</h3>
                <p className="text-ink-2 leading-relaxed mb-5">Des devis pros en 2 minutes, des factures conformes, vos relances qui partent toutes seules, et vous êtes payé plus vite. L&apos;essentiel du métier, sans prise de tête.</p>
                <ul className="space-y-2.5 text-sm text-ink-2">
                  <li className="flex gap-2.5"><CheckMark />Je chiffre et je facture proprement</li>
                  <li className="flex gap-2.5"><CheckMark />Je suis en règle avec la loi française</li>
                  <li className="flex gap-2.5"><CheckMark />Je relance mes impayés sans y penser</li>
                </ul>
              </div>
            </div>

            {/* Vitesse supérieure */}
            <div className="reveal reveal-delay-1 rounded-3xl p-[1.5px] overflow-hidden" style={{ background: "linear-gradient(135deg, color-mix(in srgb,#3f7bff 55%,transparent) 0%, color-mix(in srgb,#f5c842 70%,transparent) 100%)" }}>
              <div className="rounded-[22px] bg-bgdark-2 p-8 lg:p-10 h-full relative overflow-hidden">
                <div aria-hidden="true" className="absolute -top-16 -right-16 w-60 h-60 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, color-mix(in srgb,#f5c842 22%,transparent), transparent 65%)", filter: "blur(28px)" }} />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "color-mix(in srgb,#f5c842 18%,transparent)" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-accent-ink">Passer la vitesse supérieure · Complet</span>
                  <h3 className="font-hanken text-2xl font-extrabold mt-2 mb-3">Vous voulez gagner du temps et tout piloter.</h3>
                  <p className="text-ink-2 leading-relaxed mb-5">Dictez vos devis à la voix depuis le chantier, visualisez tout sur un planning, sortez vos rapports et vos exports compta en un clic. Vous arrêtez de gérer : vous pilotez.</p>
                  <ul className="space-y-2.5 text-sm text-ink">
                    <li className="flex gap-2.5"><span className="text-gold" aria-hidden="true">★</span>Je gagne des heures sur mes devis (vocal IA)</li>
                    <li className="flex gap-2.5"><span className="text-gold" aria-hidden="true">★</span>Je vois tous mes chantiers d&apos;un coup d&apos;œil</li>
                    <li className="flex gap-2.5"><span className="text-gold" aria-hidden="true">★</span>Je pilote mon équipe quand je grandis</li>
                  </ul>
                  <p className="mt-6 text-sm bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-ink-2">
                    <span className="text-ink font-bold">Même seuls</span>, beaucoup d&apos;artisans choisissent le Complet — pour le devis vocal et le planning, le temps gagné est payé en une journée.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABLEAU COMPARATIF */}
        <section className="max-w-4xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-center mb-12 reveal">
            <h2 className="font-hanken text-3xl md:text-4xl font-extrabold tracking-[-0.02em]">Tout est sur la table, ligne par ligne</h2>
            <p className="text-ink-2 mt-3 max-w-xl mx-auto">Ce que vous voyez ici, c&apos;est exactement ce que vous aurez. Rien de caché.</p>
          </div>
          <div className="reveal rounded-2xl border border-white/[0.08] overflow-x-auto bg-bgdark-2">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-4" />
                  <th className="p-4 font-hanken text-ink">Essentiel<span className="block text-xs text-electric-2 font-bold mt-0.5">15 €</span></th>
                  <th className="p-4 font-hanken text-ink" style={{ background: ORANGE_CELL }}>Complet<span className="block text-xs text-accent-2 font-bold mt-0.5">25 €</span></th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={i < COMPARISON.length - 1 ? "border-b border-white/[0.05]" : ""}>
                    <td className="text-left p-4 text-ink-2">
                      {row.label}
                      {row.badge ? <span className="ml-1.5 text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-bold">{row.badge}</span> : null}
                    </td>
                    <td className="text-center p-4"><CompareCell value={row.essential} /></td>
                    <td className="text-center p-4" style={{ background: ORANGE_CELL }}><CompareCell value={row.complete} accent /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ZÉRO FRAIS CACHÉ */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center reveal">
          <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-[-0.03em] mb-4"><span className="landing-text-grad">15 €, c&apos;est 15 €.</span></h2>
          <p className="text-ink-2 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">Pas de surcoût par utilisateur. Pas de catalogue à acheter. Pas de frais par photo. Pas de limite de clients ni de chantiers. Le tarif annoncé est le tarif final.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl p-6 bg-bgdark-2 border border-white/[0.07]"><div className="font-hanken text-3xl font-black text-accent-2">0 €</div><p className="text-sm text-ink-3 mt-1">de frais cachés</p></div>
            <div className="rounded-2xl p-6 bg-bgdark-2 border border-white/[0.07]"><div className="font-hanken text-3xl font-black text-accent-2">∞</div><p className="text-sm text-ink-3 mt-1">clients &amp; chantiers</p></div>
            <div className="rounded-2xl p-6 bg-bgdark-2 border border-white/[0.07]"><div className="font-hanken text-3xl font-black text-accent-2">14 j</div><p className="text-sm text-ink-3 mt-1">d&apos;essai sans CB</p></div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-16 lg:py-20">
          <h2 className="text-center font-hanken text-3xl md:text-4xl font-extrabold mb-12 reveal">Questions fréquentes sur les tarifs</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group reveal bg-bgdark-2 rounded-xl border border-white/[0.08] overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                  <span className="font-hanken font-bold pr-4 group-open:text-accent-2 transition-colors">{item.q}</span>
                  <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <div className="px-6 pb-5 text-sm text-ink-2 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* MAILLAGE INTERNE */}
        <section className="max-w-5xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-center mb-10 reveal">
            <h2 className="font-hanken text-2xl md:text-3xl font-extrabold tracking-[-0.02em]">Découvrez Nexartis selon votre métier</h2>
            <p className="text-ink-2 mt-3 max-w-xl mx-auto">Un logiciel pensé pour chaque corps de métier du bâtiment.</p>
          </div>
          <div className="reveal flex flex-wrap justify-center gap-3 text-sm font-semibold">
            {METIER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="px-4 py-2.5 rounded-full bg-bgdark-2 border border-white/[0.08] text-ink-2 hover:text-ink hover:border-white/20 transition">{l.label}</Link>
            ))}
          </div>
          <div className="reveal reveal-delay-1 mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2">
            <Link href="/planning-chantier-intelligent" className="hover:text-accent-2 underline underline-offset-2 transition">Planning chantier intelligent</Link>
            <Link href="/calculateur-taux-horaire-artisan" className="hover:text-accent-2 underline underline-offset-2 transition">Calculer votre taux horaire</Link>
            <Link href="/blog" className="hover:text-accent-2 underline underline-offset-2 transition">Comparatifs &amp; conseils sur le blog</Link>
            <Link href="/a-propos" className="hover:text-accent-2 underline underline-offset-2 transition">Qui est derrière Nexartis</Link>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="max-w-3xl mx-auto px-6 py-20 text-center reveal">
          <h2 className="font-hanken text-3xl md:text-5xl font-extrabold tracking-[-0.03em] mb-4">Faites votre premier devis ce soir.</h2>
          <p className="text-ink-2 text-lg mb-8 max-w-lg mx-auto">14 jours gratuits, toutes les fonctions du Complet, sans carte bancaire. Vous annulez quand vous voulez.</p>
          <Link href="/register?plan=complete" className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-bgdark font-bold text-lg px-10 h-16 hover:-translate-y-0.5 transition shadow-[0_10px_40px_rgba(255,122,26,0.4)]">
            Démarrer mon essai gratuit — 14 jours
          </Link>
        </section>

      </div>
    </div>
  );
}
