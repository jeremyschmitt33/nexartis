"use client";

import PlanningDemoSection from "@/components/PlanningDemoSection";

const avantPoints = [
  "Oublis de chantiers fr\u00e9quents",
  "Conflits de planning non d\u00e9tect\u00e9s",
  "Appels r\u00e9p\u00e9t\u00e9s pour pr\u00e9venir l\u2019\u00e9quipe",
  "Aucune vision globale de la semaine",
  "D\u00e9calages \u2192 facturation fauss\u00e9e",
];

const apresPoints = [
  "Vue claire de toute la semaine",
  "Alertes conflits automatiques en temps r\u00e9el",
  "Sync mobile instantan\u00e9e pour l\u2019\u00e9quipe",
  "Drag-and-drop pour r\u00e9organiser",
  "Facturation li\u00e9e au planning",
];

const miniPlanningData = [
  {
    day: "Lundi",
    am: { poseur: "Michel R.", client: "M. Dupont", objet: "Instal. chauffe-eau", color: "#5ab4e0" },
    pm: { poseur: "Michel R.", client: "M. Dupont", objet: "Instal. chauffe-eau", color: "#5ab4e0" },
  },
  {
    day: "Mardi",
    am: { poseur: "Thomas B.", client: "Mme Martin", objet: "R\u00e9nov. salle de bain", color: "#e87a2a" },
    pm: { poseur: "Thomas B.", client: "Mme Martin", objet: "R\u00e9nov. salle de bain", color: "#e87a2a" },
  },
  {
    day: "Mercredi",
    am: { poseur: "Michel R.", client: "M. Bernard", objet: "Pose carrelage", color: "#22c55e" },
    pm: { poseur: "Lucas D.", client: "Mme Moreau", objet: "Peinture fa\u00e7ade", color: "#8b5cf6" },
  },
];

const exclusiveFeatures = [
  {
    title: "Drag-and-drop intuitif",
    desc: "D\u00e9placez vos chantiers d\u2019un jour \u00e0 l\u2019autre en un geste. Pas besoin de formation, c\u2019est aussi simple qu\u2019un agenda t\u00e9l\u00e9phone.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    title: "Alertes conflits en temps r\u00e9el",
    desc: "Un artisan d\u00e9j\u00e0 affect\u00e9 ailleurs\u00a0? Nexartis vous pr\u00e9vient imm\u00e9diatement avec une alerte visuelle. Fini les surprises.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: "Sync mobile pour l\u2019\u00e9quipe",
    desc: "Vos \u00e9quipiers re\u00e7oivent leur planning mis \u00e0 jour sur leur t\u00e9l\u00e9phone. Plus besoin d\u2019appeler chacun le soir.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Facturation li\u00e9e au planning",
    desc: "Un chantier d\u00e9cal\u00e9\u00a0? La facture se met \u00e0 jour automatiquement. Planning et comptabilit\u00e9 restent toujours synchronis\u00e9s.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function PlanningChantierPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy to-[#0d1525] py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <div
            className="mb-6 flex justify-center"
          >
            <span
              className="inline-block rounded-full bg-gold px-5 py-2 font-syne text-sm font-bold text-navy"
            >
              &#9733; EXCLUSIF
            </span>
          </div>

          <h1
            className="font-syne text-3xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl"
          >
            Planning chantier avec
            <br />
            <span className="text-sky">alertes conflits</span>
            <br />
            <span className="text-gold">&mdash; Exclusif Nexartis</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl font-manrope text-lg leading-relaxed text-gray-300"
          >
            Le seul logiciel artisan qui d&eacute;tecte automatiquement les
            conflits de planning. Fini les oublis, les doubles r&eacute;servations
            et les appels le soir pour pr&eacute;venir l&apos;&eacute;quipe.
          </p>

          <div
            className="mt-8"
          >
            <button className="h-16 rounded-xl bg-orange px-8 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover">
              Essayer le planning intelligent &rarr;
            </button>
            <p className="mt-3 font-manrope text-sm text-gray-400">
              14 jours gratuits. Sans carte bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* ── Avant / Apr\u00e8s ── */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2
            className="mb-14 text-center font-syne text-2xl font-extrabold text-navy md:text-3xl lg:text-4xl"
          >
            Avant vs Apr&egrave;s Nexartis
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Avant */}
            <div
              className="rounded-2xl border border-gray-200 bg-gray-100 p-8"
            >
              <div className="mb-6 inline-block rounded-full bg-gray-300 px-4 py-1.5">
                <span className="font-syne text-sm font-bold text-gray-600">
                  AVANT
                </span>
              </div>

              {/* Fake Excel table mockup */}
              <div className="mb-4 overflow-hidden rounded-lg border border-gray-300 bg-[#fffde6]">
                <table className="w-full border-collapse font-mono text-[10px]">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-left text-gray-500" />
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-center text-gray-600">Lundi</th>
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-center text-gray-600">Mardi</th>
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-center text-gray-600">Mercredi</th>
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-center text-gray-600">Jeudi</th>
                      <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-center text-gray-600">Vendredi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 bg-gray-100 px-2 py-1 text-gray-500">Matin</td>
                      <td className="border border-gray-300 px-2 py-1 bg-yellow-100">chantier dupont</td>
                      <td className="border border-gray-300 px-2 py-1" />
                      <td className="border border-gray-300 px-2 py-1 bg-green-100">martin? bernard?</td>
                      <td className="border border-gray-300 px-2 py-1 text-red-500 font-bold">???</td>
                      <td className="border border-gray-300 px-2 py-1">girard elec</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 bg-gray-100 px-2 py-1 text-gray-500">Apr&egrave;s-midi</td>
                      <td className="border border-gray-300 px-2 py-1">chantier dupont</td>
                      <td className="border border-gray-300 px-2 py-1 bg-yellow-100">michel ou thomas?</td>
                      <td className="border border-gray-300 px-2 py-1 text-red-500">RDV 14h??</td>
                      <td className="border border-gray-300 px-2 py-1 bg-red-100 line-through text-gray-400">ANNUL&Eacute;</td>
                      <td className="border border-gray-300 px-2 py-1 text-red-400">?</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mb-6 text-center font-manrope text-xs italic text-red-500">
                Planning Excel &mdash; conflits invisibles, partage par photo, oublis fr&eacute;quents
              </p>

              <ul className="space-y-3">
                {avantPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 text-red-400">&#10005;</span>
                    <span className="font-manrope text-sm text-gray-600">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Apr\u00e8s */}
            <div
              className="rounded-2xl border-2 border-sky/30 bg-white p-8 shadow-lg shadow-sky/5"
            >
              <div className="mb-6 inline-block rounded-full bg-sky/10 px-4 py-1.5">
                <span className="font-syne text-sm font-bold text-sky">
                  APR&Egrave;S Nexartis
                </span>
              </div>

              {/* Mini planning mockup with real data */}
              <div className="mb-4 rounded-xl border border-sky/20 bg-navy p-4">
                {/* Day headers */}
                <div className="mb-2 grid grid-cols-[50px_repeat(3,1fr)] gap-1">
                  <div />
                  {miniPlanningData.map((d) => (
                    <div
                      key={d.day}
                      className="text-center font-manrope text-[10px] font-semibold text-gray-400"
                    >
                      {d.day}
                    </div>
                  ))}
                </div>
                {/* Matin row */}
                <div className="mb-1 grid grid-cols-[50px_repeat(3,1fr)] gap-1">
                  <div className="flex items-center font-manrope text-[9px] text-gray-500">Matin</div>
                  {miniPlanningData.map((d) => (
                    <div
                      key={d.day}
                      className="rounded-md p-1.5 text-left"
                      style={{ backgroundColor: d.am.color }}
                    >
                      <p className="text-[9px] text-white/70">{d.am.poseur}</p>
                      <p className="text-[10px] font-bold text-white">{d.am.client}</p>
                      <p className="text-[9px] italic text-white/80">{d.am.objet}</p>
                    </div>
                  ))}
                </div>
                {/* Apres-midi row */}
                <div className="grid grid-cols-[50px_repeat(3,1fr)] gap-1">
                  <div className="flex items-center font-manrope text-[9px] text-gray-500">Apr.-midi</div>
                  {miniPlanningData.map((d) => (
                    <div
                      key={d.day}
                      className="rounded-md p-1.5 text-left"
                      style={{ backgroundColor: d.pm.color }}
                    >
                      <p className="text-[9px] text-white/70">{d.pm.poseur}</p>
                      <p className="text-[10px] font-bold text-white">{d.pm.client}</p>
                      <p className="text-[9px] italic text-white/80">{d.pm.objet}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mb-6 text-center font-manrope text-xs italic text-emerald-500">
                Planning Nexartis &mdash; conflits d&eacute;tect&eacute;s, &eacute;quipe notifi&eacute;e, planning toujours &agrave; jour
              </p>

              <ul className="space-y-3">
                {apresPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 text-emerald-400">&#10003;</span>
                    <span className="font-manrope text-sm text-gray-700">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Planning Demo (imported component) ── */}
      <PlanningDemoSection />

      {/* ── 4 Exclusive Features ── */}
      <section className="bg-gradient-to-b from-navy to-navy-mid py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2
            className="mb-4 text-center font-syne text-2xl font-extrabold text-white md:text-3xl lg:text-4xl"
          >
            4 fonctionnalit&eacute;s que vous ne trouverez nulle part ailleurs
          </h2>
          <p
            className="mx-auto mb-14 max-w-xl text-center font-manrope text-lg text-gray-400"
          >
            Nous avons con&ccedil;u le planning qu&apos;aucun concurrent ne
            propose.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {exclusiveFeatures.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.06]"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-sky/10 text-sky">
                  {f.icon}
                </div>
                <h3 className="mb-3 font-syne text-lg font-bold text-white">
                  {f.title}
                </h3>
                <p className="font-manrope text-sm leading-relaxed text-gray-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial masqué en attendant de vrais avis */}

      {/* ── CTA ── */}
      <section className="bg-navy py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div
          >
            <h2 className="mb-4 font-syne text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
              Organisez vos chantiers sans stress
            </h2>
            <p className="mx-auto mb-8 max-w-lg font-manrope text-lg text-gray-400">
              Essayez le seul planning artisan avec alertes conflits.
              14&nbsp;jours gratuits, sans carte bancaire.
            </p>
            <button className="h-16 rounded-xl bg-orange px-10 font-syne text-lg font-bold text-white transition-colors hover:bg-orange-hover">
              Essayer le planning intelligent &rarr;
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
