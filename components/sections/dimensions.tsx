'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Boxes, Wand2, ShieldCheck, Bug, Zap, Layers, GitBranch, MessagesSquare,
} from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';
import { SectionHeading } from '@/components/sections/section-heading';

const dims = [
  { icon: Boxes, name: 'Problem Decomposition', body: 'Breaks realistic engineering work into tractable steps before reaching for the AI.' },
  { icon: ShieldCheck, name: 'First-Principles Thinking', body: 'Reasons from code, data flow, and constraints instead of pattern-matching a puzzle.' },
  { icon: Wand2, name: 'Creative Problem Solving', body: 'Uses the assistant to explore options while keeping judgment anchored in evidence.' },
  { icon: Zap, name: 'Iteration Quality', body: 'Improves each attempt with tests, logs, diffs, and concrete feedback.' },
  { icon: Bug, name: 'Debugging with AI', body: 'Verifies, rejects, or adapts model suggestions instead of accepting fluent guesses.' },
  { icon: Layers, name: 'Architecture Decisions', body: 'Keeps fixes aligned with existing boundaries, tradeoffs, and long-term maintainability.' },
  { icon: MessagesSquare, name: 'Communication Clarity', body: 'Explains intent, risk, and reviewer-relevant tradeoffs in a traceable way.' },
  { icon: GitBranch, name: 'Token Efficiency', body: 'Provides enough context to be effective without flooding the assistant or hiding signal.' },
];

const ease = [0.22, 1, 0.36, 1] as const;

function DimCard({ d, i }: { d: typeof dims[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);
  return (
    <motion.div
      ref={ref}
      style={{ y }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease, delay: i * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-cyan-400/15 text-violet-200">
        <d.icon className="h-5 w-5" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">0{i + 1}</div>
      <h3 className="mt-1 text-base font-semibold text-white">{d.name}</h3>
      <p className="mt-2 text-sm text-white/55">{d.body}</p>
      <BorderBeam
        size={140}
        duration={9}
        delay={i * 0.6}
        colorFrom="#8b5cf6"
        colorTo="#06b6d4"
        className="opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
    </motion.div>
  );
}

export function Dimensions() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="The 8 dimensions"
          title={<>The fixed <span className="gradient-text">ai-collaboration-v1 rubric</span>.</>}
          sub="Not algorithm puzzles alone: realistic engineering work with a real assistant, strict scoring controls, and evidence behind every score."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dims.map((d, i) => (
            <DimCard key={d.name} d={d} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
