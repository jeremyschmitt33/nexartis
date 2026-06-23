"use client";

import { useMemo, useState } from "react";

/**
 * Calculateur de taux horaire artisan — composant interactif (client).
 * Méthode alignée sur l'article /blog/taux-horaire-artisan-batiment :
 *   Coût de revient horaire = (revenu net souhaité + charges + frais pro) / heures facturables
 *   Taux de vente HT        = coût de revient × (1 + marge%)
 *   Prix à la journée        = taux de vente × heures facturables/jour
 * Aimant à backlinks + page outil SEO. Aucune dépendance externe.
 */

type Metier =
  | "general"
  | "macon"
  | "plombier"
  | "electricien"
  | "peintre"
  | "carreleur";

// Fourchettes indicatives 2026 (HT/h) — source article Nexartis (CAPEB / FFB / Ootravaux)
const FOURCHETTES: Record<Metier, { label: string; min: number; max: number }> = {
  general: { label: "Tous métiers (moyenne)", min: 35, max: 70 },
  macon: { label: "Maçon", min: 35, max: 70 },
  plombier: { label: "Plombier", min: 40, max: 70 },
  electricien: { label: "Électricien", min: 35, max: 50 },
  peintre: { label: "Peintre", min: 30, max: 40 },
  carreleur: { label: "Carreleur", min: 40, max: 60 },
};

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const euro2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

function Field({
  label,
  value,
  onChange,
  suffix,
  help,
  min = 0,
  step = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  help?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-navy mb-1">{label}</span>
      {help && <span className="block text-xs text-navy/60 mb-2">{help}</span>}
      <div className="flex items-center rounded-xl border-2 border-navy/15 bg-white focus-within:border-orange transition-colors overflow-hidden">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full px-4 py-3 text-navy font-semibold outline-none bg-transparent"
          aria-label={label}
        />
        <span className="px-4 py-3 text-navy/50 text-sm font-semibold bg-cream/60 whitespace-nowrap">
          {suffix}
        </span>
      </div>
    </label>
  );
}

export default function CalculateurClient() {
  const [revenuNet, setRevenuNet] = useState(28000); // salaire net souhaité / an
  const [charges, setCharges] = useState(12000); // cotisations sociales + impôts
  const [fraisPro, setFraisPro] = useState(9000); // assurance, véhicule, matériel, compta...
  const [heuresFacturables, setHeuresFacturables] = useState(1200);
  const [marge, setMarge] = useState(25);
  const [heuresJour, setHeuresJour] = useState(7);
  const [metier, setMetier] = useState<Metier>("general");

  const r = useMemo(() => {
    const totalAnnuel = revenuNet + charges + fraisPro;
    const heures = heuresFacturables > 0 ? heuresFacturables : 1;
    const coutRevient = totalAnnuel / heures;
    const tauxVente = coutRevient * (1 + marge / 100);
    const prixJournee = tauxVente * (heuresJour > 0 ? heuresJour : 0);
    const f = FOURCHETTES[metier];
    let position: "sous" | "dans" | "au-dessus" = "dans";
    if (tauxVente < f.min) position = "sous";
    else if (tauxVente > f.max) position = "au-dessus";
    return { totalAnnuel, coutRevient, tauxVente, prixJournee, f, position };
  }, [revenuNet, charges, fraisPro, heuresFacturables, marge, heuresJour, metier]);

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* ───── Colonne saisie ───── */}
      <div className="rounded-2xl bg-cream/50 border-2 border-navy/10 p-6 sm:p-8 space-y-5">
        <h2 className="font-syne text-xl font-extrabold text-navy">
          Vos chiffres
        </h2>

        <Field
          label="Revenu net que vous voulez vous verser"
          help="Ce que vous voulez gagner pour vivre, sur l'année."
          value={revenuNet}
          onChange={setRevenuNet}
          suffix="€ / an"
          step={1000}
        />
        <Field
          label="Charges sociales et impôts"
          help="Cotisations (URSSAF), impôts liés à l'activité, sur l'année."
          value={charges}
          onChange={setCharges}
          suffix="€ / an"
          step={500}
        />
        <Field
          label="Frais professionnels annuels"
          help="Assurance décennale, véhicule, carburant, outillage, comptable, téléphone, logiciels..."
          value={fraisPro}
          onChange={setFraisPro}
          suffix="€ / an"
          step={500}
        />
        <Field
          label="Heures réellement facturables par an"
          help="Pas vos heures de présence ! Un artisan seul ne facture souvent que 1 000 à 1 200 h (60-70 % de son temps : devis, déplacements et administratif ne se facturent pas)."
          value={heuresFacturables}
          onChange={setHeuresFacturables}
          suffix="h / an"
          step={50}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-navy mb-1">
              Marge souhaitée
            </span>
            <span className="block text-xs text-navy/60 mb-2">
              20 à 30 % recommandé dans le bâtiment.
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={marge}
                onChange={(e) => setMarge(parseInt(e.target.value))}
                className="w-full accent-orange"
                aria-label="Marge souhaitée en pourcentage"
              />
              <span className="font-bold text-navy w-12 text-right">{marge} %</span>
            </div>
          </label>

          <Field
            label="Heures travaillées par jour"
            help="Pour calculer un prix à la journée."
            value={heuresJour}
            onChange={setHeuresJour}
            suffix="h / jour"
            step={1}
          />
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-navy mb-1">
            Votre métier (pour situer votre taux)
          </span>
          <select
            value={metier}
            onChange={(e) => setMetier(e.target.value as Metier)}
            className="w-full px-4 py-3 rounded-xl border-2 border-navy/15 bg-white text-navy font-semibold outline-none focus:border-orange"
            aria-label="Métier"
          >
            {Object.entries(FOURCHETTES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ───── Colonne résultat ───── */}
      <div className="lg:sticky lg:top-24 space-y-5">
        <div className="rounded-2xl bg-navy text-white p-6 sm:p-8 shadow-xl">
          <p className="text-sky font-bold text-sm uppercase tracking-wide mb-2">
            Votre taux horaire de vente conseillé
          </p>
          <p className="font-syne text-5xl sm:text-6xl font-extrabold text-orange leading-none">
            {euro2(r.tauxVente)}
            <span className="text-2xl text-white/70 font-bold"> HT / h</span>
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-white/60 text-xs font-semibold mb-1">
                Coût de revient horaire
              </p>
              <p className="font-syne text-2xl font-extrabold">
                {euro2(r.coutRevient)}
              </p>
              <p className="text-white/50 text-xs mt-1">
                Votre seuil : ne descendez jamais en dessous.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-white/60 text-xs font-semibold mb-1">
                Prix à la journée
              </p>
              <p className="font-syne text-2xl font-extrabold">
                {euro(r.prixJournee)}
              </p>
              <p className="text-white/50 text-xs mt-1">
                {heuresJour} h facturables × votre taux.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/5 p-4">
            <p className="text-white/60 text-xs font-semibold mb-1">
              Total à couvrir sur l'année
            </p>
            <p className="font-syne text-xl font-extrabold">
              {euro(r.totalAnnuel)}
            </p>
          </div>
        </div>

        {/* Situation vs fourchette métier */}
        <div className="rounded-2xl border-2 border-navy/10 bg-white p-6">
          <p className="text-sm font-bold text-navy mb-2">
            Repère marché — {r.f.label} :{" "}
            <span className="text-orange">
              {r.f.min} à {r.f.max} € HT / h
            </span>
          </p>
          {r.position === "dans" && (
            <p className="text-sm text-navy/70">
              ✅ Votre taux calculé est <strong>dans la fourchette</strong> de votre
              métier. Bon signe : il est cohérent avec le marché tout en couvrant vos
              charges réelles.
            </p>
          )}
          {r.position === "sous" && (
            <p className="text-sm text-navy/70">
              ⚠️ Votre taux est <strong>sous la fourchette</strong> du métier. Ce
              n'est pas forcément une erreur (zone rurale, faibles charges), mais
              vérifiez que vous n'avez pas sous-estimé vos frais ou surestimé vos
              heures facturables.
            </p>
          )}
          {r.position === "au-dessus" && (
            <p className="text-sm text-navy/70">
              ℹ️ Votre taux est <strong>au-dessus de la fourchette</strong>. Cela
              peut refléter une spécialité, une zone tendue ou un haut niveau de
              finition. Assurez-vous que votre positionnement le justifie auprès des
              clients.
            </p>
          )}
          <p className="text-xs text-navy/50 mt-3">
            Fourchettes indicatives 2026 (sources CAPEB, FFB, Ootravaux). À ajuster
            selon votre région et votre spécialité.
          </p>
        </div>

        <a
          href="/register"
          className="block text-center rounded-xl bg-orange hover:bg-orange-hover text-white font-bold px-6 py-4 transition-colors shadow-lg"
        >
          Appliquer ce taux dans mes devis → Essai gratuit 14 jours
        </a>
        <p className="text-center text-xs text-navy/50">
          Sans carte bancaire. Enregistrez votre taux une fois, Nexartis l'applique
          automatiquement sur chaque devis.
        </p>
      </div>
    </div>
  );
}
