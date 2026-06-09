"use client";

import RichText from "./RichText";

/**
 * MetierCasUsage — Section storytelling : raconte une scène concrète
 * où Nexartis sort l'artisan d'une galère typique de son métier.
 *
 * Fallback : si la prop n'est pas fournie, on génère un scénario générique
 * basé sur le nom du métier (pour rétrocompatibilité des 13 data files).
 *
 * Le texte `scene` est parsé via RichText (markdown inline : **bold** + liens).
 */
export default function MetierCasUsage({
  nom,
  casUsage,
}: {
  nom: string;
  casUsage?: { titre: string; scene: string } | string;
}) {
  // Rétrocompat : accepte forme objet historique OU simple string narrative
  const titreFromProp =
    typeof casUsage === "object" && casUsage !== null ? casUsage.titre : undefined;
  const sceneFromProp =
    typeof casUsage === "string"
      ? casUsage
      : typeof casUsage === "object" && casUsage !== null
        ? casUsage.scene
        : undefined;

  const titre =
    titreFromProp || `Une journée type d'un ${nom.toLowerCase()} avec Nexartis`;
  const scene =
    sceneFromProp ||
    `Lundi 8h, vous arrivez sur un chantier en urgence. Le client vous demande un devis pour des travaux supplémentaires. Avant Nexartis, vous auriez noté ça sur un carnet, rédigé le devis le soir sur Word, et envoyé un PDF deux jours plus tard. Avec Nexartis, vous sortez votre téléphone, vous dictez les prestations à la voix, le devis est généré en 2 minutes avec les bons taux de TVA, et votre client le signe électroniquement avant la fin de l'intervention. Vous repartez du chantier avec un accord ferme et un acompte versé.`;

  return (
    <section id="cas-usage" className="scroll-mt-24">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f7bff]/10 px-3 py-1">
        <span className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-[#2d5cd4]">
          Cas d&apos;usage
        </span>
      </div>
      <h2 className="font-hanken text-2xl font-extrabold leading-tight tracking-tight text-[#0f1a3a] md:text-3xl">
        {titre}
      </h2>

      {/* Bloc storytelling avec accent gauche orange */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#fef6ef] via-white to-white">
        <div className="relative p-6 md:p-8">
          <span
            aria-hidden="true"
            className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-[#ff7a1a]"
          />
          <div className="pl-4 md:pl-6">
            {scene.split("\n\n").filter((p) => p.trim().length > 0).map((para, i) => (
              <p
                key={i}
                className="mb-4 font-hanken text-base leading-relaxed text-[#0f1a3a]/85 last:mb-0 md:text-lg"
              >
                <RichText text={para} />
              </p>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 font-hanken text-sm italic text-gray-500">
        Scénario inspiré de retours d&apos;artisans clients.
      </p>
    </section>
  );
}
