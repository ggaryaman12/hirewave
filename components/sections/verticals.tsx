'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useScroll } from 'framer-motion';
import { ArrowRight, Building2, Code2, Trophy, LineChart, Cpu, Users } from 'lucide-react';

// Two-vertical CTA with pointer-driven 3D tilt cards + scroll parallax. Real
// redirects into each product surface (students -> /signup + /dsa, companies ->
// /dashboard). Lightweight 3D (CSS perspective) so it pairs with the WebGL hero
// without a second canvas.

function TiltCard({
  accent,
  icon: Icon,
  kicker,
  title,
  blurb,
  bullets,
  primary,
  secondary,
}: {
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  blurb: string;
  bullets: { icon: React.ComponentType<{ className?: string }>; label: string }[];
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 18 });

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-8 backdrop-blur transition-shadow hover:shadow-2xl md:p-10"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity group-hover:opacity-80"
          style={{ background: accent, opacity: 0.35 }}
        />
        <div style={{ transform: 'translateZ(40px)' }} className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
            <Icon className="h-3.5 w-3.5" /> {kicker}
          </span>
          <h3 className="mt-5 font-display text-3xl font-black tracking-[-0.03em] text-[#0a0a0a] md:text-4xl">{title}</h3>
          <p className="mt-3 max-w-md text-base text-black/60">{blurb}</p>

          <ul className="mt-6 grid gap-2.5">
            {bullets.map((b) => (
              <li key={b.label} className="flex items-center gap-2.5 text-sm font-medium text-black/70">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 bg-white/70">
                  <b.icon className="h-3.5 w-3.5" />
                </span>
                {b.label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={primary.href}
              className="group/btn inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-sm font-semibold text-paper transition-transform hover:scale-[1.03]"
            >
              {primary.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </a>
            {secondary && (
              <a
                href={secondary.href}
                className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/50 px-6 py-3 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-white"
              >
                {secondary.label}
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function Verticals() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const ySmooth = useSpring(y, { stiffness: 60, damping: 20 });

  return (
    <section ref={ref} id="verticals" className="relative bg-paper px-6 py-28 md:px-16 lg:px-24">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          style={{ y: ySmooth }}
          className="max-w-3xl font-display text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[#0a0a0a] md:text-6xl"
        >
          One platform. <span className="text-[#8b5cf6]">Two</span> ways in.
        </motion.h2>
        <p className="mt-4 max-w-xl text-lg text-black/55">
          Students sharpen real skills and prove them. Companies hire for how people actually work with AI.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <TiltCard
            accent="#8b5cf6"
            icon={Code2}
            kicker="For students"
            title="Practice. Track. Get ranked."
            blurb="Solve real interview problems in a true coding environment, watch your progress, and see exactly where you're strong."
            bullets={[
              { icon: Code2, label: 'LeetCode-style problems with real test suites' },
              { icon: LineChart, label: 'Progress, strengths, and AI analysis' },
              { icon: Trophy, label: 'Climb the leaderboard' },
            ]}
            primary={{ href: '/signup', label: 'Start practicing free' }}
            secondary={{ href: '/dsa', label: 'Browse problems' }}
          />
          <TiltCard
            accent="#22d3ee"
            icon={Building2}
            kicker="For companies"
            title="Hire for AI collaboration."
            blurb="Run assessments that score candidates across 8 dimensions of working with AI — the signal that predicts on-the-job performance."
            bullets={[
              { icon: Cpu, label: 'AI-native, real-world assessments' },
              { icon: Users, label: 'Candidate sessions, scoped to your workspace' },
              { icon: LineChart, label: 'Evidence-backed reports' },
            ]}
            primary={{ href: '/dashboard', label: 'Open the dashboard' }}
          />
        </div>
      </div>
    </section>
  );
}
