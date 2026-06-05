'use client'

// ---------------------------------------------------------------------------
// DocumentMockup
//
// Miniature WYSIWYG du devis Nexartis (~320px de large) avec 6 zones
// cliquables qui reproduisent visuellement les zones colorées du vrai document.
// Les couleurs sont passées en props et les clics remontent l'identifiant
// de la zone pour ouvrir le color picker correspondant dans le parent.
//
// Aucune donnée réelle : on affiche des placeholders ("Désignation 1", "100,00 €")
// pour que l'artisan voie la structure sans confusion avec un vrai devis.
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

// Label en français pour aria-label des zones cliquables (accessibilité).
const ZONE_LABELS: Record<ThemeZone, string> = {
  bandeauHaut: "Modifier la couleur de la zone GAUCHE du bandeau (logo + nom)",
  bandeauHautDroite: "Modifier la couleur de la zone DROITE du bandeau (DEVIS + numero)",
  accent: 'Modifier la couleur d\'accent',
  cadreEmetteur: 'Modifier la couleur de la carte Émetteur',
  cadreAdresse: 'Modifier la couleur de la carte Adressé à',
  netPayer: 'Modifier la couleur de l\'encadré Net à payer',
  footer: 'Modifier la couleur du bandeau de pied',
}

// Composant : encadré cliquable transparent posé en absolute sur une zone.
// Au hover : halo léger + curseur pointer. Au focus clavier : ring orange.
function ZoneOverlay({
  zone,
  isActive,
  onZoneClick,
  className,
  style,
}: {
  zone: ThemeZone
  isActive: boolean
  onZoneClick: (z: ThemeZone) => void
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={() => onZoneClick(zone)}
      aria-label={ZONE_LABELS[zone]}
      className={`absolute z-10 cursor-pointer rounded-md transition-all duration-150 hover:bg-white/10 hover:shadow-[0_0_0_2px_rgba(232,122,42,0.6)] focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-1 ${
        isActive ? 'shadow-[0_0_0_2px_rgba(232,122,42,0.9)] bg-white/5' : ''
      } ${className ?? ''}`}
      style={style}
    />
  )
}

export default function DocumentMockup({ theme, activeZone, onZoneClick }: Props) {
  // Couleurs de texte calculées en live à partir des fonds choisis.
  const bandeauInk = isLight(theme.bandeauHaut) ? '#1c1304' : '#ffffff'
  const emetteurInk = isLight(theme.cadreEmetteur) ? '#0f1a3a' : '#ffffff'
  const adresseInk = isLight(theme.cadreAdresse) ? '#0f1a3a' : '#ffffff'
  const netPayerInk = isLight(theme.netPayer) ? '#1c1304' : '#ffffff'
  const footerInk = isLight(theme.footer) ? '#1c1304' : '#ffffff'

  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none">
      {/* Mini ombre + bordure pour donner l'illusion d'une feuille A4 */}
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
        {/* ===== BANDEAU D'EN-TÊTE - V3.1 : 2 zones distinctes ===== */}
        {/* Zone GAUCHE (background) - sert aussi de fallback en cas de bug */}
        <div
          className="relative px-3 pt-3 pb-7 overflow-hidden"
          style={{ background: theme.bandeauHaut, color: bandeauInk }}
        >
          {/* Zone DROITE : commence APRES la barre doree (identique au CSS reel document.css) */}
          <div
            className="absolute inset-0"
            style={{
              background: theme.bandeauHautDroite,
              clipPath: 'polygon(54% 0, 100% 0, 100% 100%, 46% 100%)',
            }}
            aria-hidden="true"
          />
          {/* Barre doree (accent) - fine, centree sur 50% du bandeau (identique au CSS reel) */}
          <div
            className="absolute inset-0"
            style={{
              background: theme.accent,
              clipPath: 'polygon(50% 0, 54% 0, 46% 100%, 42% 100%)',
            }}
            aria-hidden="true"
          />

          {/* Logo + nom artisan */}
          <div className="relative z-[2] flex items-center gap-2">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold"
              style={{ color: theme.bandeauHaut }}
            >
              N
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-syne text-[11px] font-bold" style={{ color: bandeauInk }}>
                Mon Entreprise
              </span>
              {/* V3.1.4 : metier retire du bandeau (idem rendu reel) */}
            </div>
          </div>

          {/* Bloc titre droite : DEVIS + N° + date */}
          <div className="relative z-[2] mt-2 text-right">
            <div
              className="font-syne text-[14px] font-extrabold uppercase leading-none"
              style={{ color: bandeauInk }}
            >
              DEVIS
            </div>
            <div
              className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[7px] font-semibold"
              style={{
                background: theme.accent,
                color: isLight(theme.accent) ? '#1c1304' : '#ffffff',
              }}
            >
              N° 2026-001
            </div>
            <div className="mt-1 text-[7px] opacity-70" style={{ color: bandeauInk }}>
              Émis le <strong>04/06/2026</strong>
            </div>
          </div>
        </div>

        {/* ===== CARTES PARTIES (zones 3 et 4) — chevauchent le bandeau ===== */}
        <div className="relative z-[3] -mt-5 grid grid-cols-2 gap-2 px-3">
          {/* Émetteur (zone 3) */}
          <div
            className="relative overflow-hidden rounded-lg border border-slate-200 p-2 shadow-sm"
            style={{ background: theme.cadreEmetteur, color: emetteurInk }}
          >
            {/* Trait vertical accent à gauche (rappel zone 2) */}
            <div
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ background: theme.accent }}
              aria-hidden="true"
            />
            <div
              className="mb-1 inline-block rounded px-1 py-[1px] text-[6px] font-bold uppercase tracking-widest"
              style={{ background: theme.bandeauHaut, color: bandeauInk }}
            >
              Émetteur
            </div>
            <div className="text-[8px] font-bold leading-tight" style={{ color: emetteurInk }}>
              Mon Entreprise
            </div>
            <div className="mt-0.5 text-[6.5px] leading-snug opacity-70" style={{ color: emetteurInk }}>
              12 rue de la Paix<br />
              33000 Bordeaux<br />
              SIRET 000 000 000 00000
            </div>
          </div>

          {/* Adressé à (zone 4) */}
          <div
            className="rounded-lg p-2 shadow-sm"
            style={{ background: theme.cadreAdresse, color: adresseInk }}
          >
            <div
              className="mb-1 inline-block rounded px-1 py-[1px] text-[6px] font-bold uppercase tracking-widest"
              style={{
                background: theme.accent,
                color: isLight(theme.accent) ? '#1c1304' : '#ffffff',
              }}
            >
              Adressé à
            </div>
            <div className="text-[8px] font-bold leading-tight" style={{ color: adresseInk }}>
              M. Dupont
            </div>
            <div className="mt-0.5 text-[6.5px] leading-snug opacity-70" style={{ color: adresseInk }}>
              5 av. des Lilas<br />
              33800 Bordeaux<br />
              06 12 34 56 78
            </div>
          </div>
        </div>

        {/* ===== CORPS : objet + lignes fictives ===== */}
        <div className="px-3 pb-2 pt-3">
          {/* Objet */}
          <div
            className="mb-2 rounded-sm border-l-[2px] bg-[#f0f7fc] px-2 py-1"
            style={{ borderLeftColor: theme.accent }}
          >
            <div className="text-[6px] font-semibold uppercase tracking-wider text-slate-500">
              Objet
            </div>
            <div className="text-[8px] font-bold text-slate-800">Rénovation électrique</div>
          </div>

          {/* Mini-table fictive */}
          <div className="border-t border-b border-slate-200 py-1">
            <div className="flex items-center justify-between border-b border-slate-100 py-[3px] text-[6.5px]">
              <span className="text-slate-600">1.1 Désignation 1</span>
              <span className="font-semibold text-slate-800">100,00 €</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 py-[3px] text-[6.5px]">
              <span className="text-slate-600">1.2 Désignation 2</span>
              <span className="font-semibold text-slate-800">250,00 €</span>
            </div>
            <div className="flex items-center justify-between py-[3px] text-[6.5px]">
              <span className="text-slate-600">2.1 Désignation 3</span>
              <span className="font-semibold text-slate-800">75,00 €</span>
            </div>
          </div>

          {/* Récap stone + Net à payer (zone 5) */}
          <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
            <div className="text-[6.5px] text-slate-400">
              <div className="font-semibold uppercase tracking-wider">Conditions</div>
              <div className="mt-0.5 leading-snug">Paiement à 30 jours fin de mois.</div>
            </div>
            <div className="overflow-hidden rounded-sm border border-[#e2ddd1] bg-[#f5f3ee]">
              <div className="flex justify-between border-b border-[#e2ddd1] px-2 py-[3px] text-[6.5px] text-slate-600">
                <span>Total HT</span>
                <span>425,00 €</span>
              </div>
              <div className="flex justify-between px-2 py-[3px] text-[6.5px] font-semibold text-slate-800">
                <span>Total TTC</span>
                <span>510,00 €</span>
              </div>
              {/* Net à payer (zone 5) */}
              <div
                className="flex items-baseline justify-between px-2 py-1.5"
                style={{ background: theme.netPayer, color: netPayerInk }}
              >
                <span className="text-[7px] font-bold">Net à payer</span>
                <strong className="text-[11px] font-extrabold">510,00 €</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FOOTER (zone 6) ===== */}
        <div
          className="border-t-[3px] px-3 py-2 text-center"
          style={{
            background: theme.footer,
            color: footerInk,
            borderTopColor: theme.accent,
          }}
        >
          <div className="text-[6px] leading-tight opacity-90">
            Mon Entreprise — 12 rue de la Paix, 33000 Bordeaux — SIRET 000 000 000 00000
          </div>
          <div className="mt-0.5 text-[5.5px] leading-tight opacity-65">
            RCS Bordeaux — APE 4321A
          </div>
        </div>

        {/* ============================================================ */}
        {/* OVERLAYS CLIQUABLES — positionnés en absolute sur les zones    */}
        {/* ============================================================ */}

        {/* V3.1 - Zone bandeau GAUCHE (logo + nom) - aligne sur le clip-path reel */}
        <ZoneOverlay
          zone="bandeauHaut"
          isActive={activeZone === 'bandeauHaut'}
          onZoneClick={onZoneClick}
          className=""
          style={{ top: 0, left: 0, width: '44%', height: '64px' }}
        />

        {/* V3.1 - Zone ACCENT : la barre doree fine centree (identique geometrie reelle) */}
        <ZoneOverlay
          zone="accent"
          isActive={activeZone === 'accent'}
          onZoneClick={onZoneClick}
          style={{ top: 0, left: '44%', width: '12%', height: '64px' }}
        />

        {/* V3.1 - Zone bandeau DROITE (DEVIS + numero) - aligne sur le clip-path reel */}
        <ZoneOverlay
          zone="bandeauHautDroite"
          isActive={activeZone === 'bandeauHautDroite'}
          onZoneClick={onZoneClick}
          style={{ top: 0, right: 0, width: '44%', height: '64px' }}
        />

        {/* Zone 3 — Carte Émetteur (gauche, chevauche le bandeau) */}
        <ZoneOverlay
          zone="cadreEmetteur"
          isActive={activeZone === 'cadreEmetteur'}
          onZoneClick={onZoneClick}
          style={{ top: '58px', left: '12px', width: 'calc(50% - 16px)', height: '64px' }}
        />

        {/* Zone 4 — Carte Adressé à (droite, chevauche le bandeau) */}
        <ZoneOverlay
          zone="cadreAdresse"
          isActive={activeZone === 'cadreAdresse'}
          onZoneClick={onZoneClick}
          style={{ top: '58px', right: '12px', width: 'calc(50% - 16px)', height: '64px' }}
        />

        {/* Zone 5 — Net à payer (en bas de la mini-table) */}
        <ZoneOverlay
          zone="netPayer"
          isActive={activeZone === 'netPayer'}
          onZoneClick={onZoneClick}
          style={{ bottom: '38px', right: '12px', width: '110px', height: '22px' }}
        />

        {/* Zone 6 — Footer (en bas) */}
        <ZoneOverlay
          zone="footer"
          isActive={activeZone === 'footer'}
          onZoneClick={onZoneClick}
          style={{ bottom: 0, left: 0, right: 0, height: '34px' }}
        />
      </div>

      {/* Légende discrète sous le mockup */}
      <p className="mt-2 text-center text-[10px] italic text-slate-400 font-manrope">
        Aperçu — clique sur une zone pour la personnaliser
      </p>
    </div>
  )
}
