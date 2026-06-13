'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { Terminal, Radar, ListChecks } from 'lucide-react';

const STEPS = [
  {
    num: '01',
    label: 'Create',
    title: 'Create a Challenge',
    body: 'Design timed coding challenges in minutes. Choose from templates or create custom assessments tailored to your role.',
    icon: Terminal,
  },
  {
    num: '02',
    label: 'Share',
    title: 'Share One Link',
    body: 'Send a single assessment link to all candidates. They enter their details and begin immediately, no account setup required.',
    icon: Radar,
  },
  {
    num: '03',
    label: 'Report',
    title: 'Get AI-Scored Reports',
    body: 'Every interaction is captured and analyzed. Receive detailed scoring across 8 dimensions with side-by-side candidate comparisons.',
    icon: ListChecks,
  },
];

// Spinner: ENTIRE spinner rotates with scroll (in addition to inner CSS spins)
function Spinner({
  rotate,
  activeIndex,
  size = 640,
}: {
  rotate: MotionValue<number>;
  activeIndex: number;
  size?: number;
}) {
  // Inner ring radius (in px) where stops sit
  const stopRadius = (size / 2) * (210 / 220); // ≈ 305 for size=640
  const counterRotate = useTransform(rotate, (v) => -v);

  return (
    <motion.div
      style={{ width: size, height: size, rotate }}
      className="relative"
    >
      {/* Outer dashed ring — also CSS-spins independently */}
      <div className="absolute inset-0 animate-spin-slower">
        <svg viewBox="-340 -340 680 680" className="h-full w-full">
          <circle cx="0" cy="0" r="330" fill="none" stroke="rgba(0,0,0,0.20)" strokeWidth="0.8" strokeDasharray="2 8" />
        </svg>
      </div>

      {/* Middle tick ring — counter-spins */}
      <div className="absolute inset-0 animate-spin-reverse">
        <svg viewBox="-280 -280 560 560" className="h-full w-full">
          <circle cx="0" cy="0" r="270" fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="0.8" />
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = i % 5 === 0 ? 256 : 262;
            const x1 = Math.cos(a) * r1;
            const y1 = Math.sin(a) * r1;
            const x2 = Math.cos(a) * 270;
            const y2 = Math.sin(a) * 270;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.40)" strokeWidth="0.7" />;
          })}
        </svg>
      </div>

      {/* Inner ring */}
      <svg
        viewBox="-220 -220 440 440"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <circle cx="0" cy="0" r="210" fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1" />
      </svg>

      {/* 3 stops on the inner ring (top, 4-o'clock, 8-o'clock) */}
      {STEPS.map((s, i) => {
        const angleDeg = (i / STEPS.length) * 360 - 90; // -90 starts at top
        const a = (angleDeg * Math.PI) / 180;
        const x = Math.cos(a) * stopRadius;
        const y = Math.sin(a) * stopRadius;
        return (
          <motion.div
            key={s.num}
            // Counter-rotate so chip stays upright while the parent rotates
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              rotate: counterRotate,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className={`block rounded-full transition-all ${
                  activeIndex === i
                    ? 'h-4 w-4 bg-[#f15a29] shadow-[0_0_22px_rgba(241,90,41,0.75)]'
                    : 'h-3 w-3 bg-black/35'
                }`}
              />
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-all ${
                  activeIndex === i
                    ? 'bg-[#0a0a0a] text-paper'
                    : 'bg-white/70 text-black/55 backdrop-blur'
                }`}
              >
                {s.num} · {s.label}
              </span>
            </div>
          </motion.div>
        );
      })}

      {/* Core orb */}
      <div className="absolute left-1/2 top-1/2 grid h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 place-items-center">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f15a29,#d12864_55%,#1c1b6f_100%)]" />
        <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="absolute inset-[-22px] rounded-full border border-black/25" />
        <div className="absolute left-1/2 top-0 h-[20px] w-[1px] -translate-x-1/2 -translate-y-full bg-black/40" />
        <div className="absolute left-1/2 bottom-0 h-[20px] w-[1px] -translate-x-1/2 translate-y-full bg-black/40" />
        <div className="absolute left-0 top-1/2 h-[1px] w-[20px] -translate-y-1/2 -translate-x-full bg-black/40" />
        <div className="absolute right-0 top-1/2 h-[1px] w-[20px] -translate-y-1/2 translate-x-full bg-black/40" />
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 22, mass: 0.5 });

  // Whole spinner rotates 240° across the section — labels stay upright via counter-rotate
  const rotate = useTransform(smooth, [0, 1], [0, 240]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    const unsub = smooth.on('change', (v) => {
      setActive(v < 0.36 ? 0 : v < 0.66 ? 1 : 2);
    });
    return () => unsub();
  }, [smooth]);

  const op1 = useTransform(smooth, [0, 0.28, 0.36], [1, 1, 0]);
  const op2 = useTransform(smooth, [0.30, 0.44, 0.62, 0.70], [0, 1, 1, 0]);
  const op3 = useTransform(smooth, [0.66, 0.80, 1], [0, 1, 1]);
  const y1 = useTransform(smooth, [0, 0.36], [0, -30]);
  const y2 = useTransform(smooth, [0.30, 0.70], [30, -30]);
  const y3 = useTransform(smooth, [0.66, 1], [30, 0]);

  return (
    <section id="how" ref={ref} style={{ height: '320vh' }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Top label */}
        <div className="absolute left-1/2 top-12 z-20 flex -translate-x-1/2 items-center gap-3 text-xs uppercase tracking-[0.22em] text-black/55">
          <span className="h-px w-8 bg-black/40" />
          How it works
          <span className="h-px w-8 bg-black/40" />
        </div>

        {/* Spinner — center */}
        <div className="absolute inset-0 grid place-items-center">
          <Spinner rotate={rotate} activeIndex={active} size={640} />
        </div>

        {/* Step card — fixed-width left column */}
        <div className="absolute inset-y-0 left-0 z-10 flex items-center px-8 md:px-16 lg:px-24">
          <div className="relative h-[360px] w-[420px] max-w-[40vw]">
            {STEPS.map((s, i) => {
              const op = i === 0 ? op1 : i === 1 ? op2 : op3;
              const y = i === 0 ? y1 : i === 1 ? y2 : y3;
              return (
                <motion.div
                  key={s.num}
                  style={{ opacity: op, y }}
                  className="absolute inset-0 rounded-2xl border border-black/10 bg-white/70 p-7 backdrop-blur-sm shadow-[0_22px_60px_-22px_rgba(0,0,0,0.20)]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#0a0a0a] text-paper">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45">
                      Step {s.num}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl font-black leading-[1.05] tracking-tight text-[#0a0a0a] md:text-4xl">
                    {s.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-black/65 md:text-base">{s.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Step counter — right side */}
        <div className="absolute right-8 top-1/2 z-10 -translate-y-1/2 md:right-16 lg:right-24">
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-4xl font-bold text-[#0a0a0a]">{String(active + 1).padStart(2, '0')}</span>
            <span className="text-xs text-black/40">/ {String(STEPS.length).padStart(2, '0')}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.num}
                className={`block h-[2px] w-12 transition-all ${
                  i <= active ? 'bg-[#f15a29]' : 'bg-black/15'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom progress track */}
        <div className="absolute bottom-8 left-12 right-12 z-20 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/40">
            How it works
          </span>
          <div className="relative h-[1px] flex-1 bg-black/15">
            <motion.div
              style={{ scaleX: smooth, transformOrigin: 'left' }}
              className="absolute inset-0 bg-gradient-to-r from-[#f15a29] to-[#1c1b6f]"
            />
          </div>
          <span className="font-mono text-[10px] text-black/40">3 steps</span>
        </div>
      </div>
    </section>
  );
}
