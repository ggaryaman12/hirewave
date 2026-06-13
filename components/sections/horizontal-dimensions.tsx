'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import {
  Boxes, Wand2, ShieldCheck, Bug, Zap, Layers, GitBranch, MessagesSquare,
} from 'lucide-react';

const dims = [
  { icon: Boxes, name: 'Problem decomposition', num: '01', body: 'Breaks fuzzy asks into sub-problems before reaching for the AI.' },
  { icon: Wand2, name: 'Prompt precision', num: '02', body: 'Gets useful output on the first try. Edits, doesn\u2019t restart.' },
  { icon: ShieldCheck, name: 'Verification instinct', num: '03', body: 'Tests, doesn\u2019t trust. Reads diffs. Runs the thing.' },
  { icon: Bug, name: 'Hallucination detection', num: '04', body: 'Catches when the model is wrong, even when it sounds right.' },
  { icon: Zap, name: 'Iteration velocity', num: '05', body: 'Each attempt gets sharper. No wheel-spinning.' },
  { icon: Layers, name: 'Context management', num: '06', body: 'Feeds the AI what it needs. Withholds what it doesn\u2019t.' },
  { icon: GitBranch, name: 'Override judgment', num: '07', body: 'Knows when the AI is the wrong tool. Drops it without ceremony.' },
  { icon: MessagesSquare, name: 'Communication', num: '08', body: 'Explains tradeoffs to a human reviewer in three sentences.' },
];

const CARD_W = 340;
const CARD_GAP = 24;
const TOTAL_W = dims.length * (CARD_W + CARD_GAP);

export function HorizontalDimensions() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 20, mass: 0.8 });

  const maxTranslate = -(TOTAL_W - (typeof window !== 'undefined' ? window.innerWidth : 1440) + 96);
  const x = useTransform(smooth, [0, 1], [48, maxTranslate]);

  const headingOpacity = useTransform(smooth, [0, 0.08], [0, 1]);
  const headingY = useTransform(smooth, [0, 0.08], [24, 0]);

  return (
    <div ref={containerRef} style={{ height: '180vh' }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden bg-[hsl(32,38%,90%)]">
        <motion.div
          style={{ opacity: headingOpacity, y: headingY }}
          className="mb-10 flex items-center gap-3 px-12"
        >
          <span className="h-px w-12 bg-black/40" />
          <span className="text-xs uppercase tracking-[0.2em] text-black/55">The 8 dimensions</span>
        </motion.div>

        <motion.div style={{ x }} className="flex gap-6 will-change-transform">
          {dims.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.35), ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex-shrink-0 overflow-hidden rounded-3xl border border-black/10 bg-white/55 p-7 transition-all hover:border-black/20 hover:shadow-[0_18px_40px_-18px_rgba(241,90,41,0.3)]"
              style={{ width: `${CARD_W}px` }}
            >
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0a0a0a] text-paper">
                    <d.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-4xl font-black tracking-tight text-black/12">
                    {d.num}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold leading-tight text-[#0a0a0a]">{d.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-black/60">{d.body}</p>
                <div className="mt-7 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-black/40 transition-colors group-hover:text-[#f15a29]">
                  <span className="h-px w-5 bg-current" />
                  <span>Scored live</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="absolute bottom-8 left-12 right-12 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/40">
            Scroll to explore
          </span>
          <div className="relative h-[1px] flex-1 bg-black/15">
            <motion.div
              style={{ scaleX: smooth, transformOrigin: 'left' }}
              className="absolute inset-0 bg-gradient-to-r from-[#f15a29] to-[#1c1b6f]"
            />
          </div>
          <span className="font-mono text-[10px] text-black/40">{dims.length} dimensions</span>
        </div>
      </div>
    </div>
  );
}
