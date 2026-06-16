'use client'

// ---------------------------------------------------------------------------
// DocumentMockup
//
// Miniature WYSIWYG du devis Nexartis (pleine largeur du conteneur) avec
// 7 zones cliquables qui reproduisent visuellement les zones colorees du vrai
// document. Les couleurs sont passees en props et les clics remontent
// l'identifiant de la zone pour ouvrir le color picker correspondant.
//
// V3.3 : pleine largeur (plus de plafond max-w). Les zones cliquables ne sont
// plus des overlays absolus poses par-dessus (qui se desalignaient quand la
// largeur changeait) : chaque VRAI div de zone est lui-meme interactif
// (role="button" + onClick + onKeyDown), donc la zone cliquable epouse
// toujours exactement la zone coloree, quelle que soit la taille.
//
// En-tete fidele au CSS reel (document.css .dv-headD) :
//   - diagonale CENTREE : zone droite clipPath polygon(61.5% 0,100% 0,100% 100%,52% 100%)
//     et barre accent polygon(57.5% 0,61.5% 0,52% 100%,48% 100%)
//   - les clip-path limitent AUSSI le hit-test : un clic a gauche tombe sur le
//     fond bandeauHaut, un clic sur la barre fine sur accent, un clic a droite
//     sur bandeauHautDroite. stopPropagation() sur les couches enfants evite
//     le double declenchement vers le fond parent.
//   - GAUCHE : carte logo + nom EN PETIT centre SOUS le logo
//   - DROITE : DEVIS + pastille numero + dates sur UNE seule ligne.
//
// Aucune donnee reelle : placeholders ("Designation 1", "100,00 EUR").
// ---------------------------------------------------------------------------

import { isLight } from '@/lib/document-theme'
import type { DocumentTheme } from '@/lib/document-theme'

export type ThemeZone =
  | 'bandeauHaut'
  | 'bandeauHautDroite'
  | 'accent'
  | 'cadreEmetteur'
  | 'cadreAdresse'
  | 'netPayer'
  | 'footer'

interface Props {
  theme: DocumentTheme
  activeZone: ThemeZone | null
  onZoneClick: (zone: ThemeZone) => void
}

// Label en francais pour aria-label des zones cliquables (accessibilite).
const ZONE_LABELS: Record<ThemeZone, string> = {
  bandeauHaut: "Modifier la couleur de la zone GAUCHE du bandeau (logo + nom)",
  bandeauHautDroite: "Modifier la couleur de la zone DROITE du bandeau (DEVIS + numero)",
  accent: "Modifier la couleur d'accent",
  cadreEmetteur: 'Modifier la couleur de la carte Emetteur',
  cadreAdresse: 'Modifier la couleur de la carte Adresse a',
  netPayer: "Modifier la couleur de l'encadre Net a payer",
  footer: 'Modifier la couleur du bandeau de pied',
}

// Construit les attributs communs qui rendent un div de zone interactif :
// role bouton, focusable au clavier, clic + Enter/Espace, aria-label, et un
// anneau visuel quand la zone est active (sinon halo leger au hover).
// `stopChildPropagation` evite que le clic d'une couche enfant (clip-path)
// bulle vers le fond parent et double-declenche.
function zoneInteractive(
  zone: ThemeZone,
  activeZone: ThemeZone | null,
  onZoneClick: (z: ThemeZone) => void,
  opts?: { stopPropagation?: boolean }
) {
  const isActive = activeZone === zone
  const stop = opts?.stopPropagation ?? false
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': ZONE_LABELS[zone],
    'aria-pressed': isActive,
    onClick: (e: React.MouseEvent) => {
      if (stop) e.stopPropagation()
      onZoneClick(zone)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        if (stop) e.stopPropagation()
        onZoneClick(zone)
      }
    },
    // cursor + transition + halo hover + anneau actif (focus clavier inclus)
    className: `cursor-pointer outline-none transition-all duration-150 hover:shadow-[0_0_0_2px_rgba(232,122,42,0.45)] focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-1 ${
      isActive ? 'ring-2 ring-orange ring-offset-1' : ''
    }`,
  }
}

export default function DocumentMockup({ theme, activeZone, onZoneClick }: Props) {
  // Couleurs de texte calculees en live a partir des fonds choisis.
  const bandeauInk = isLight(theme.bandeauHaut) ? '#1c1304' : '#ffffff'
  const droiteInk = isLight(theme.bandeauHautDroite) ? '#1c1304' : '#ffffff'
  const accentInk = isLight(theme.accent) ? '#1c1304' : '#ffffff'
  const emetteurInk = isLight(theme.cadreEmetteur) ? '#0f1a3a' : '#ffffff'
  const adresseInk = isLight(theme.cadreAdresse) ? '#0f1a3a' : '#ffffff'
  const netPayerInk = isLight(theme.netPayer) ? '#1c1304' : '#ffffff'
  const footerInk = isLight(theme.footer) ? '#1c1304' : '#ffffff'

  return (
    <div className="relative w-full select-none">
      {/* Ombre + bordure pour donner l'illusion d'une feuille A4 */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        {/* ===== BANDEAU D'EN-TETE : diagonale centree, logo a gauche / DEVIS a droite ===== */}
        {/* Zone GAUCHE (background plein) = elle-meme cliquable (zone bandeauHaut). */}
        <div
          {...zoneInteractive('bandeauHaut', activeZone, onZoneClick)}
          className={`relative flex items-start justify-between overflow-hidden px-6 pt-6 pb-12 ${
            zoneInteractive('bandeauHaut', activeZone, onZoneClick).className
          }`}
          style={{ background: theme.bandeauHaut, color: bandeauInk }}
        >
          {/* Zone DROITE (bleue) : diagonale identique au CSS reel + cliquable.
              clip-path limite le hit-test a la forme visible. z-[1] au-dessus du fond. */}
          <div
            {...zoneInteractive('bandeauHautDroite', activeZone, onZoneClick, { stopPropagation: true })}
            className={`absolute inset-0 z-[1] ${
              zoneInteractive('bandeauHautDroite', activeZone, onZoneClick).className
            }`}
            style={{
              background: theme.bandeauHautDroite,
              clipPath: 'polygon(61.5% 0, 100% 0, 100% 100%, 52% 100%)',
            }}
          />
          {/* Barre ACCENT (orange) : fine, oblique, centree + cliquable.
              z-[2] au-dessus du bleu pour capter le clic sur la barre fine. */}
          <div
            {...zoneInteractive('accent', activeZone, onZoneClick, { stopPropagation: true })}
            className={`absolute inset-0 z-[2] ${
              zoneInteractive('accent', activeZone, onZoneClick).className
            }`}
            style={{
              background: theme.accent,
              clipPath: 'polygon(57.5% 0, 61.5% 0, 52% 100%, 48% 100%)',
            }}
          />

          {/* GAUCHE : carte logo + nom (decoratif, ne bloque pas les clics de zone) */}
          <div className="pointer-events-none relative z-[3] flex max-w-[44%] flex-col items-center gap-2 self-center">
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white text-xl font-bold shadow-md"
              style={{ color: theme.bandeauHaut }}
            >
              N
            </div>
            <span
              className="max-w-full truncate text-center font-syne text-[12px] font-bold leading-tight"
              style={{ color: bandeauInk }}
            >
              Mon Entreprise
            </span>
          </div>

          {/* DROITE : DEVIS + pastille numero + dates (decoratif, ne bloque pas les clics) */}
          <div className="pointer-events-none relative z-[3] text-right">
            <div
              className="font-syne text-[26px] font-extrabold uppercase leading-none"
              style={{ color: droiteInk }}
            >
              DEVIS
            </div>
            <div
              className="mt-2.5 inline-block rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold"
              style={{
                background: theme.accent,
                color: accentInk,
              }}
            >
              N&deg; 2026-001
            </div>
            <div
              className="mt-2.5 whitespace-nowrap text-[9px] opacity-75"
              style={{ color: droiteInk }}
            >
              Emis le <strong>04/06/2026</strong> &middot; Valable jusqu&apos;au <strong>04/07/2026</strong>
            </div>
          </div>
        </div>

        {/* ===== CARTES PARTIES (zones 3 et 4) - chevauchent le bandeau ===== */}
        <div className="relative z-[4] -mt-8 grid grid-cols-2 gap-3 px-6">
          {/* Emetteur (zone 3) = carte elle-meme cliquable */}
          <div
            {...zoneInteractive('cadreEmetteur', activeZone, onZoneClick)}
            className={`relative overflow-hidden rounded-xl border border-slate-200 p-3.5 shadow-md ${
              zoneInteractive('cadreEmetteur', activeZone, onZoneClick).className
            }`}
            style={{ background: theme.cadreEmetteur, color: emetteurInk }}
          >
            {/* Trait vertical accent a gauche (rappel zone accent) */}
            <div
              className="pointer-events-none absolute left-0 top-0 h-full w-[5px]"
              style={{ background: theme.accent }}
              aria-hidden="true"
            />
            <div
              className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
              style={{ background: theme.bandeauHaut, color: bandeauInk }}
            >
              Emetteur
            </div>
            <div className="text-[12px] font-bold leading-tight" style={{ color: emetteurInk }}>
              Mon Entreprise
            </div>
            <div className="mt-1 text-[9.5px] leading-snug opacity-70" style={{ color: emetteurInk }}>
              12 rue de la Paix<br />
              33000 Bordeaux<br />
              SIRET 000 000 000 00000
            </div>
          </div>

          {/* Adresse a (zone 4) = carte elle-meme cliquable */}
          <div
            {...zoneInteractive('cadreAdresse', activeZone, onZoneClick)}
            className={`rounded-xl p-3.5 shadow-md ${
              zoneInteractive('cadreAdresse', activeZone, onZoneClick).className
            }`}
            style={{ background: theme.cadreAdresse, color: adresseInk }}
          >
            <div
              className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
              style={{
                background: theme.accent,
                color: accentInk,
              }}
            >
              Adresse a
            </div>
            <div className="text-[12px] font-bold leading-tight" style={{ color: adresseInk }}>
              M. Dupont
            </div>
            <div className="mt-1 text-[9.5px] leading-snug opacity-70" style={{ color: adresseInk }}>
              5 av. des Lilas<br />
              33800 Bordeaux<br />
              06 12 34 56 78
            </div>
          </div>
        </div>

        {/* ===== CORPS : objet + lignes fictives ===== */}
        <div className="px-6 pb-3 pt-5">
          {/* Objet */}
          <div
            className="mb-3 rounded-md border-l-[3px] bg-[#f0f7fc] px-3 py-1.5"
            style={{ borderLeftColor: theme.accent }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Objet
            </div>
            <div className="text-[12px] font-bold text-slate-800">Renovation electrique</div>
          </div>

          {/* Mini-table fictive */}
          <div className="border-t border-b border-slate-200 py-1.5">
            <div className="flex items-center justify-between border-b border-slate-100 py-1 text-[10px]">
              <span className="text-slate-600">1.1 Designation 1</span>
              <span className="font-semibold text-slate-800">100,00 EUR</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 py-1 text-[10px]">
              <span className="text-slate-600">1.2 Designation 2</span>
              <span className="font-semibold text-slate-800">250,00 EUR</span>
            </div>
            <div className="flex items-center justify-between py-1 text-[10px]">
              <span className="text-slate-600">2.1 Designation 3</span>
              <span className="font-semibold text-slate-800">75,00 EUR</span>
            </div>
          </div>

          {/* Recap + Net a payer (zone 5) */}
          <div className="mt-3 grid grid-cols-[1fr_170px] gap-3">
            <div className="text-[10px] text-slate-400">
              <div className="font-semibold uppercase tracking-wider">Conditions</div>
              <div className="mt-1 leading-snug">Paiement a 30 jours fin de mois.</div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#e2ddd1] bg-[#f5f3ee]">
              <div className="flex justify-between border-b border-[#e2ddd1] px-3 py-1 text-[10px] text-slate-600">
                <span>Total HT</span>
                <span>425,00 EUR</span>
              </div>
              <div className="flex justify-between px-3 py-1 text-[10px] font-semibold text-slate-800">
                <span>Total TTC</span>
                <span>510,00 EUR</span>
              </div>
              {/* Net a payer (zone 5) = bloc lui-meme cliquable */}
              <div
                {...zoneInteractive('netPayer', activeZone, onZoneClick)}
                className={`flex items-baseline justify-between px-3 py-2.5 ${
                  zoneInteractive('netPayer', activeZone, onZoneClick).className
                }`}
                style={{ background: theme.netPayer, color: netPayerInk }}
              >
                <span className="text-[10px] font-bold">Net a payer</span>
                <strong className="text-[16px] font-extrabold">510,00 EUR</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FOOTER (zone 6) = bandeau lui-meme cliquable ===== */}
        <div
          {...zoneInteractive('footer', activeZone, onZoneClick)}
          className={`border-t-[4px] px-6 py-3 text-center ${
            zoneInteractive('footer', activeZone, onZoneClick).className
          }`}
          style={{
            background: theme.footer,
            color: footerInk,
            borderTopColor: theme.accent,
          }}
        >
          <div className="text-[9px] leading-tight opacity-90">
            Mon Entreprise &mdash; 12 rue de la Paix, 33000 Bordeaux &mdash; SIRET 000 000 000 00000
          </div>
          <div className="mt-1 text-[8px] leading-tight opacity-65">
            RCS Bordeaux &mdash; APE 4321A
          </div>
        </div>
      </div>

      {/* Legende discrete sous le mockup */}
      <p className="mt-3 text-center text-[11px] italic text-slate-400 font-manrope">
        Apercu &mdash; clique sur une zone pour la personnaliser
      </p>
    </div>
  )
}
