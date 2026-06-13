'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { NumberTicker } from '@/components/ui/number-ticker';

const ease = [0.22, 1, 0.36, 1] as const;

const stats = [
  { value: 10, suffix: '×', label: 'faster shortlisting', sub: 'vs. resume + recruiter screen' },
  { value: 73, suffix: '%', label: 'less hiring bias*', sub: 'per internal audit, vs. resume-based screens' },
  { value: 8, suffix: '', label: 'behavioural dimensions', sub: 'observed continuously, not self-reported' },
];

function StatCard({ s, i }: { s: typeof stats[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1.04, 0.96]);
  return (
    <motion.div
      ref={ref}
      style={{ y, scale }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease, delay: i * 0.08 }}
      className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/45 p-8 text-center"
    >
      <div className="font-display text-6xl font-black tracking-tight text-[#0a0a0a] md:text-7xl">
        <NumberTicker value={s.value} suffix={s.suffix} />
      </div>
      <p className="mt-4 text-sm uppercase tracking-[0.18em] text-black/70">{s.label}</p>
      <p className="mt-2 text-xs text-black/45">{s.sub}</p>
    </motion.div>
  );
}

export function Proof() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {stats.map((s, i) => (
            <StatCard key={s.label} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
