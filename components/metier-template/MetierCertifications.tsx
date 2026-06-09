"use client";

/**
 * MetierCertifications — Badges des certifications/labels reconnus du métier
 * (Qualibat, RGE, etc.). Affiché en ligne dans le flux article.
 */
export default function MetierCertifications({
  certifications,
}: {
  certifications?: string[];
}) {
  if (!certifications || certifications.length === 0) return null;

  return (
    <section className="scroll-mt-24">
      <div className="rounded-2xl border border-gray-200 bg-[#f6f8fb] p-6 md:p-8">
        <p className="font-hanken text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Certifications & labels reconnus du métier
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {certifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-hanken text-sm font-bold text-[#0f1a3a] shadow-sm"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#ff7a1a]"
              />
              {cert}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
