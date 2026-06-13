'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

const DIMS = [
  'Decomposition',
  'Prompt precision',
  'Verification',
  'Hallucination detection',
  'Iteration',
  'Context',
  'Override',
  'Communication',
];

/**
 * Orbital rings with the 8 dimensions rotating around the core.
 * The whole system rotates slowly, and rotation speeds up with scroll.
 * Inspired by Gigantic's concentric circle service spinner.
 */
export function OrbitalRings({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const rot = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const rotSmooth = useSpring(rot, { stiffness: 40, damping: 20 });
  const coreScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  const coreSmooth = useSpring(coreScale, { stiffness: 50, damping: 22 });

  return (
    <div
      ref={containerRef}
      className={cn('relative grid aspect-square w-full place-items-center', className)}
    >
      {/* Outer ring — dashed */}
      <svg
        viewBox="-260 -260 520 520"
        className="absolute inset-0 h-full w-full animate-spin-slower"
        aria-hidden
      >
        <circle cx="0" cy="0" r="250" fill="none" stroke="rgba(13,13,13,0.25)" strokeWidth="1" strokeDasharray="2 6" />
      </svg>

      {/* Middle ring — with tick marks */}
      <svg
        viewBox="-210 -210 420 420"
        className="absolute inset-0 h-full w-full animate-spin-reverse"
        aria-hidden
      >
        <circle cx="0" cy="0" r="205" fill="none" stroke="rgba(13,13,13,0.18)" strokeWidth="1" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const x1 = Math.cos(a) * 196;
          const y1 = Math.sin(a) * 196;
          const x2 = Math.cos(a) * 205;
          const y2 = Math.sin(a) * 205;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(13,13,13,0.45)"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {/* Inner ring with dimension labels orbiting */}
      <motion.div
        style={{ rotate: rotSmooth }}
        className="absolute inset-0 h-full w-full origin-center"
      >
        <svg viewBox="-170 -170 340 340" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="0" cy="0" r="165" fill="none" stroke="rgba(13,13,13,0.4)" strokeWidth="1" />
        </svg>

        {DIMS.map((name, i) => {
          const angle = (i / DIMS.length) * 360;
          return (
            <OrbitLabel
              key={name}
              index={i}
              name={name}
              angle={angle}
              rotation={rotSmooth}
            />
          );
        })}
      </motion.div>

      {/* Core — solid disc + crosshairs */}
      <motion.div
        style={{ scale: coreSmooth }}
        className="relative z-10 grid h-[120px] w-[120px] place-items-center"
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f15a29,#d12864_60%,#1c1b6f_100%)]" />
        <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_50%)]" />
        <div className="absolute inset-[-22px] rounded-full border border-black/30" />
        {/* crosshair */}
        <div className="absolute left-1/2 top-0 h-[22px] w-[1px] -translate-x-1/2 -translate-y-full bg-black/40" />
        <div className="absolute left-1/2 bottom-0 h-[22px] w-[1px] -translate-x-1/2 translate-y-full bg-black/40" />
        <div className="absolute left-0 top-1/2 h-[1px] w-[22px] -translate-y-1/2 -translate-x-full bg-black/40" />
        <div className="absolute right-0 top-1/2 h-[1px] w-[22px] -translate-y-1/2 translate-x-full bg-black/40" />
      </motion.div>

      {/* Center label */}
      <div className="absolute left-1/2 top-[calc(50%+90px)] -translate-x-1/2 text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-black/50">
          Hirewave · Rubric
        </div>
      </div>
    </div>
  );
}

function OrbitLabel({
  index,
  name,
  angle,
  rotation,
}: {
  index: number;
  name: string;
  angle: number;
  rotation: MotionValue<number>;
}) {
  const counterRotate = useTransform(rotation, (v) => -v - angle);

  return (
    <div
      className="absolute left-1/2 top-1/2 h-0 w-0"
      style={{
        transform: `translate(-50%,-50%) rotate(${angle}deg)`,
      }}
    >
      <div
        className="absolute"
        style={{ transform: 'translate(-50%, -50%) translateY(-165px)' }}
      >
        <div className="relative flex items-center">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f15a29] shadow-[0_0_10px_rgba(241,90,41,0.6)]" />
          <motion.span
            style={{ rotate: counterRotate }}
            className="ml-2 whitespace-nowrap rounded-full bg-black/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#f4ebe2]"
          >
            {String(index + 1).padStart(2, '0')} {name}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
