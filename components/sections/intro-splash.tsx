'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useAnimationFrame } from 'framer-motion';

const LINES = [
  'Hiring is shifting.',
  'The signal has changed.',
  'Hirewave.',
];

export function IntroSplash({ onEnter }: { onEnter: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<number>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((i) => {
        if (i < LINES.length - 1) return i + 1;
        clearInterval(id);
        return i;
      });
    }, 950);
    return () => clearInterval(id);
  }, []);

  const handleEnter = () => {
    setVisible(false);
    setTimeout(onEnter, 700);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[hsl(222,47%,4%)]"
        >
          {/* Noise grain overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '256px 256px',
            }}
          />

          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(800px 600px at 30% 40%, rgba(139,92,246,0.14), transparent 60%),' +
                'radial-gradient(600px 500px at 70% 60%, rgba(6,182,212,0.10), transparent 60%)',
            }}
          />

          <div className="relative flex flex-col items-center gap-8 text-center">
            {/* Animated lines */}
            <div className="h-[4.5rem] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={lineIndex}
                  initial={{ y: 60, opacity: 0, filter: 'blur(12px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -40, opacity: 0, filter: 'blur(8px)' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className={
                    lineIndex === LINES.length - 1
                      ? 'font-display text-5xl font-semibold tracking-[-0.04em] gradient-text md:text-7xl'
                      : 'text-2xl font-light tracking-tight text-white/70 md:text-3xl'
                  }
                >
                  {LINES[lineIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Enter button — only appears after last line */}
            <AnimatePresence>
              {lineIndex === LINES.length - 1 && (
                <motion.button
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                  onClick={handleEnter}
                  className="group relative mt-2 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/[0.04] px-8 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/35 hover:bg-white/[0.08]"
                >
                  <span>Enter the experience</span>
                  <svg
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="absolute inset-0 -z-10 rounded-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.12),transparent)] bg-[length:200%_100%] animate-shimmer" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Scroll hint dot */}
            <AnimatePresence>
              {lineIndex === LINES.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="flex flex-col items-center gap-2 pt-2"
                >
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="h-4 w-[1px] bg-gradient-to-b from-white/50 to-transparent"
                  />
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/30">Then scroll</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Corner wordmark */}
          <div className="absolute bottom-7 left-8 text-xs font-semibold tracking-[0.18em] text-white/25">
            HIREWAVE
          </div>
          <div className="absolute bottom-7 right-8 text-[10px] text-white/25">
            AI-native hiring
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
