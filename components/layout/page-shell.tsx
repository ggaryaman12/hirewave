'use client';
import { useState } from 'react';
import { SmoothScroll } from '@/components/layout/smooth-scroll';
import { CinematicIntro } from '@/components/ui/motion-footer';
import { Navbar } from '@/components/sections/navbar';
import { PinnedHero } from '@/components/sections/pinned-hero';
import { LogosMarquee } from '@/components/sections/logos-marquee';
import { HowItWorks } from '@/components/sections/how-it-works';
import { HorizontalDimensions } from '@/components/sections/horizontal-dimensions';
import { ForCandidatesForEmployers } from '@/components/sections/for-candidates-for-employers';
import { Verticals } from '@/components/sections/verticals';
import { Proof } from '@/components/sections/proof';
import { Pricing } from '@/components/sections/pricing';
import { FAQ } from '@/components/sections/faq';
import { FinalCTA } from '@/components/sections/final-cta';
import { Footer } from '@/components/sections/footer';
import { ScrollProgress } from '@/components/ui/scroll-progress';

export function PageShell() {
  const [entered, setEntered] = useState(false);

  return (
    <>
      {!entered && <CinematicIntro onEnter={() => setEntered(true)} />}

      {entered && (
        <SmoothScroll>
          <ScrollProgress />
          <Navbar />
          <main>
            <PinnedHero />
            <LogosMarquee />
            <HowItWorks />
            <HorizontalDimensions />
            <Verticals />
            <ForCandidatesForEmployers />
            <Proof />
            <Pricing />
            <FAQ />
            <FinalCTA />
          </main>
          <Footer />
        </SmoothScroll>
      )}
    </>
  );
}
