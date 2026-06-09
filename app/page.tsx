import Atmosphere from '@/components/landing/Atmosphere'
import IntroOverlay from '@/components/landing/IntroOverlay'
import LandingNav from '@/components/landing/LandingNav'
import HeroOrbital from '@/components/landing/HeroOrbital'
import TrustBar from '@/components/TrustBar'
import ProblemSection from '@/components/ProblemSection'
import FeaturesSection from '@/components/FeaturesSection'
import ForcesSection from '@/components/ForcesSection'
import PlanningDemoSection from '@/components/PlanningDemoSection'
import PricingSection from '@/components/PricingSection'
import MobileSection from '@/components/landing/MobileSection'
import FaqSection from '@/components/FaqSection'
import CtaSection from '@/components/CtaSection'
import ScrollReveal from '@/components/ScrollReveal'

/**
 * V4.2 (2026-06-08) — Refonte landing dark premium complète.
 *
 * Architecture :
 *  - <IntroOverlay />   : animation cinématique 4,3s, 1×/session (z-200)
 *  - <LandingNav />     : nav transparent → scrolled blur 18px (z-100)
 *  - <Atmosphere />     : fond fixe décoratif (grille + 3 blobs + noise) z-0
 *  - sections           : par-dessus, z-1 via .landing-section
 *
 * Le Header marketing global est masqué sur "/" via ConditionalLayout
 * (cf HEADER_ONLY_HIDDEN_ROUTES). LandingNav prend le relais.
 * Le Footer marketing reste affiché pour le maillage SEO (10 pages métier).
 *
 * Toutes les sections ont été adaptées en mode dark + anti-mensonge
 * (Factur-X "Prêt pour 2026", Données "Europe RGPD", pas de SMS,
 * web responsive optimisé, suivi des impayés simplifié, etc.).
 */
export default function HomePage() {
  return (
    <div className="bg-bgdark min-h-screen text-ink font-hanken">
      <IntroOverlay />
      <ScrollReveal />
      <Atmosphere />
      <LandingNav />
      <div className="landing-section">
        <HeroOrbital />
        <TrustBar />
        <ProblemSection />
        <FeaturesSection />
        <ForcesSection />
        <PlanningDemoSection />
        <PricingSection />
        <MobileSection />
        <FaqSection />
        <CtaSection />
      </div>
    </div>
  )
}
