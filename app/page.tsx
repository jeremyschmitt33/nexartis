import Atmosphere from '@/components/landing/Atmosphere'
import HeroOrbital from '@/components/landing/HeroOrbital'
import TrustBar from '@/components/TrustBar'
import ProblemSection from '@/components/ProblemSection'
import FeaturesSection from '@/components/FeaturesSection'
import PlanningDemoSection from '@/components/PlanningDemoSection'
import PricingSection from '@/components/PricingSection'
import FaqSection from '@/components/FaqSection'
import CtaSection from '@/components/CtaSection'
import ScrollReveal from '@/components/ScrollReveal'

/**
 * V4 (2026-06-08) — Refonte landing dark premium.
 *
 * Architecture :
 *  - <Atmosphere /> : fond fixe décoratif (grille + 3 blobs + noise) z-0
 *  - sections : par-dessus, z-1 via .landing-section
 *
 * Pour cette première itération (commit L1+L2+L3), seul le Hero passe
 * en "scène orbitale" V4. Les autres sections (TrustBar, ProblemSection,
 * etc.) gardent leur look actuel sombre — elles seront refondues dans
 * les commits suivants (L4, L5).
 */
export default function HomePage() {
  return (
    <div className="bg-bgdark min-h-screen text-ink font-hanken">
      <ScrollReveal />
      <Atmosphere />
      <div className="landing-section">
        <HeroOrbital />
        <TrustBar />
        <ProblemSection />
        <FeaturesSection />
        <PlanningDemoSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </div>
    </div>
  )
}
