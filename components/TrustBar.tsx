"use client";

// V4 landing dark — fond transparent qui laisse passer l'atmosphere globale.
// Textes corriges (anti-mensonge) :
// - "Conforme Factur-X 2026" -> "Pret pour Factur-X 2026"
// - "Certifie anti-fraude TVA" -> "Mentions legales BTP francaises completes"
// - "Donnees hebergees en France" -> "Donnees hebergees en Europe . RGPD strict"
// - "Support reactif par email" (inchange, vrai)
const items = [
  "Pret pour Factur-X 2026",
  "Mentions legales BTP francaises completes",
  "Donnees hebergees en Europe · RGPD strict",
  "Support reactif par email",
];

export default function TrustBar() {
  return (
    <section className="landing-section bg-transparent border-y border-white/5 py-7 px-5 lg:px-10">
      <div className="mx-auto max-w-[1200px] flex items-center justify-center flex-wrap gap-x-8 gap-y-4">
        {items.map((item) => (
          <div
            key={item}
            className="reveal flex items-center gap-2 text-[13.5px] font-semibold text-ink-2"
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-mint"
              style={{ background: "color-mix(in srgb, #2fd6a0 14%, transparent)" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
