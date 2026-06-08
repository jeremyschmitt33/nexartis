/**
 * V4 (2026-06-08) — Atmosphere de fond de la landing.
 *
 * Composant purement décoratif (server component, aucun JS client) :
 *   - une grille subtile masquée par radial-gradient
 *   - 3 blobs flous (electric, accent, violet) en mode color-mix
 *   - un calque de bruit SVG en overlay
 *
 * Doit être monté en tout premier dans app/page.tsx (avant <main>) avec
 * position: fixed; inset: 0; z-index: 0; pour rester en arrière-plan
 * pendant tout le scroll de la landing.
 *
 * Sur mobile (<= 980px), les blobs 2 et 3 ainsi que le noise sont
 * masqués (cf. globals.css) pour économiser la GPU des téléphones bas
 * de gamme.
 */
export default function Atmosphere() {
  return (
    <div className="landing-atmosphere" aria-hidden="true">
      <div className="landing-grid" />
      <div className="landing-blob b1" />
      <div className="landing-blob b2" />
      <div className="landing-blob b3" />
      <div className="landing-noise" />
    </div>
  )
}
