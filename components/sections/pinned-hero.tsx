'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { OrbitalRings } from '@/components/ui/orbital-rings';
import { GeometricLines } from '@/components/ui/geometric-lines';

// Word-reveal tied to a MotionValue window [start,end]
function ScrollWord({
  word,
  progress,
  start,
  end,
  className = '',
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  className?: string;
}) {
  const opacity = useTransform(progress, [start, end], [0.10, 1]);
  const y = useTransform(progress, [start, end], [22, 0]);
  const filter = useTransform(progress, [start, end], ['blur(8px)', 'blur(0px)']);
  return (
    <motion.span
      style={{ opacity, y, filter }}
      className={`inline-block will-change-transform ${className}`}
    >
      {word}
    </motion.span>
  );
}

function ScrollLine({
  words,
  progress,
  windowStart,
  windowEnd,
  className = '',
}: {
  words: string[];
  progress: MotionValue<number>;
  windowStart: number;
  windowEnd: number;
  className?: string;
}) {
  const step = (windowEnd - windowStart) / words.length;
  return (
    <span className={`flex flex-wrap gap-x-[0.22em] ${className}`}>
      {words.map((w, i) => (
        <ScrollWord
          key={`${w}-${i}`}
          word={w}
          progress={progress}
          start={windowStart + i * step}
          end={windowStart + (i + 1) * step}
        />
      ))}
    </span>
  );
}

export function PinnedHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.5 });

  // Orbital spinner — appears + scales from compact to large
  const ringScale = useTransform(smooth, [0.05, 0.4, 0.85], [0.65, 1, 1.06]);
  const ringOpacity = useTransform(smooth, [0.0, 0.15, 0.85, 0.95], [0, 1, 1, 0.5]);
  const ringRotate = useTransform(smooth, [0, 1], [-12, 8]);

  // Sub headline + CTAs
  const subOpacity = useTransform(smooth, [0.55, 0.72], [0, 1]);
  const subY = useTransform(smooth, [0.55, 0.72], [24, 0]);
  const ctaOpacity = useTransform(smooth, [0.7, 0.85], [0, 1]);
  const ctaY = useTransform(smooth, [0.7, 0.85], [24, 0]);

  const scrollHintOpacity = useTransform(smooth, [0, 0.08], [1, 0]);

  return (
    <div ref={containerRef} className="relative" style={{ height: '220vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-paper">
        {/* Geometric diagonal lines (paper-friendly) */}
        <GeometricLines className="z-[1] opacity-40 [&_*]:!stroke-black/10" />

        {/* Orbital spinner — fills right half */}
        <motion.div
          style={{ opacity: ringOpacity, scale: ringScale, rotate: ringRotate }}
          className="absolute right-[-6%] top-1/2 z-[2] hidden h-[640px] w-[640px] -translate-y-1/2 lg:block"
        >
          <OrbitalRings />
        </motion.div>

        {/* Mobile spinner */}
        <motion.div
          style={{ opacity: ringOpacity, scale: ringScale }}
          className="absolute left-1/2 top-[58%] z-[2] block h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-60 lg:hidden"
        >
          <OrbitalRings />
        </motion.div>

        {/* Content stack */}
        <div className="absolute inset-0 z-[3] flex flex-col items-start justify-center px-8 md:px-16 lg:px-24">
          {/* Eyebrow */}
          <motion.div
            style={{ opacity: useTransform(smooth, [0.0, 0.04], [1, 0]) }}
            className="mb-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-black/45"
          >
            <span className="h-px w-10 bg-black/40" />
            <span>The 2026 hiring rubric</span>
          </motion.div>

          {/* Main headline — four lines */}
          <h1
            className="max-w-[18ch] font-display font-black leading-[0.94] tracking-[-0.045em] text-[#0a0a0a]"
            style={{ fontSize: 'clamp(3rem, 7.5vw, 8.5rem)' }}
          >
            <ScrollLine
              words={['Hire', 'for', 'how']}
              progress={smooth}
              windowStart={0.02}
              windowEnd={0.20}
              className="block"
            />
            <ScrollLine
              words={['they', 'work']}
              progress={smooth}
              windowStart={0.18}
              windowEnd={0.34}
              className="block"
            />
            <ScrollLine
              words={['with']}
              progress={smooth}
              windowStart={0.32}
              windowEnd={0.42}
              className="block"
            />
            <span className="block">
              <ScrollWord
                word="AI."
                progress={smooth}
                start={0.42}
                end={0.55}
                className="text-[#f15a29]"
              />
            </span>
          </h1>

          {/* Sub */}
          <motion.p
            style={{ opacity: subOpacity, y: subY }}
            className="mt-7 max-w-lg text-pretty text-base text-black/60 md:text-lg"
          >
            Hirewave evaluates candidates across <strong className="text-black/90">8 dimensions</strong> of AI collaboration — the only signal that predicts on-the-job performance.
          </motion.p>

          {/* CTAs */}
          <motion.div
            style={{ opacity: ctaOpacity, y: ctaY }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <a
              href="#employers"
              className="group inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-3.5 text-sm font-semibold text-paper transition-transform hover:scale-[1.02]"
            >
              I am hiring
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#candidates"
              className="group inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/40 px-7 py-3.5 text-sm font-semibold text-[#0a0a0a] backdrop-blur transition-transform hover:scale-[1.02] hover:bg-white/70"
            >
              I am looking
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            style={{ opacity: scrollHintOpacity }}
            className="absolute bottom-10 right-8 flex flex-col items-center gap-2 md:right-16"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="h-7 w-[1px] bg-gradient-to-b from-black/45 to-transparent"
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/40">scroll</span>
          </motion.div>
        </div>

        {/* Vertical scroll progress on left */}
        <div className="absolute left-4 top-1/2 z-[4] -translate-y-1/2 md:left-6">
          <div className="h-24 w-[1px] overflow-hidden rounded-full bg-black/10">
            <motion.div
              style={{ scaleY: smooth, transformOrigin: 'top' }}
              className="h-full w-full bg-gradient-to-b from-[#f15a29] to-[#1c1b6f]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
