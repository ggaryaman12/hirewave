'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

export function FinalCTA() {
  return (
    <section id="cta" className="relative py-28 md:py-36">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="relative isolate mx-auto flex min-h-[420px] max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-black/10 bg-gradient-to-b from-[#f15a29]/[0.10] via-white/30 to-[#1c1b6f]/[0.08] px-6 py-16 text-center"
        >
          <h2 className="relative font-display text-4xl font-black tracking-[-0.03em] text-balance text-[#0a0a0a] md:text-6xl">
            Start hiring for <span className="gradient-text">2026</span>.
          </h2>
          <p className="relative mt-5 max-w-xl text-pretty text-black/70">
            Calibrate your first role in under an hour. No card. Cancel any time.
          </p>

          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/dashboard/assessments/new"
              className="group inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-3.5 text-sm font-semibold text-paper transition-transform hover:scale-[1.03]"
            >
              Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/60 px-7 py-3.5 text-sm font-semibold text-[#0a0a0a] backdrop-blur transition-transform hover:scale-[1.03] hover:bg-white"
            >
              See how it works
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
