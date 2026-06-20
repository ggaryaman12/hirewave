'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, type MotionValue } from 'framer-motion';
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
 * Real CSS-3D depth: the whole system sits on a perspective stage that tilts
 * toward the pointer, with each ring layered on its own Z plane (outer pushed
 * back, core lifted forward) so it reads as a 3D orbital instrument.
 */
export function OrbitalRings({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const rot = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const rotSmooth = useSpring(rot, { stiffness: 40, damping: 20 });
  const coreScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  const coreSmooth = useSpring(coreScale, { stiffness: 50, damping: 22 });

  // Pointer-driven 3D tilt. Base tilt gives a permanent "viewed at an angle"
  // orbital-disc feel; pointer adds parallax.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [26, 10]), { stiffness: 120, damping: 18 });
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), { stiffness: 120, damping: 18 });

  function onMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn('relative grid aspect-square w-full place-items-center [perspective:1200px]', className)}
    >
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
        className="absolute inset-0 h-full w-full [transform-style:preserve-3d]"
      >
        {/* Outer ring — dashed (pushed back) */}
        <div className="absolute inset-0 h-full w-full [transform:translateZ(-70px)]">
          <svg viewBox="-260 -260 520 520" className="absolute inset-0 h-full w-full animate-spin-slower" aria-hidden>
            <circle cx="0" cy="0" r="250" fill="none" stroke="rgba(13,13,13,0.22)" strokeWidth="1" strokeDasharray="2 6" />
          </svg>
        </div>

        {/* Middle ring — tick marks (mid plane) */}
        <div className="absolute inset-0 h-full w-full [transform:translateZ(-20px)]">
          <svg viewBox="-210 -210 420 420" className="absolute inset-0 h-full w-full animate-spin-reverse" aria-hidden>
            <circle cx="0" cy="0" r="205" fill="none" stroke="rgba(13,13,13,0.16)" strokeWidth="1" />
            {Array.from({ length: 48 }).map((_, i) => {
              const a = (i / 48) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 196} y1={Math.sin(a) * 196}
                  x2={Math.cos(a) * 205} y2={Math.sin(a) * 205}
                  stroke="rgba(13,13,13,0.42)" strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>

        {/* Inner ring with dimension labels (front plane) */}
        <motion.div
          style={{ rotate: rotSmooth, transform: 'translateZ(40px)' }}
          className="absolute inset-0 h-full w-full origin-center [transform-style:preserve-3d]"
        >
          <svg viewBox="-170 -170 340 340" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="0" cy="0" r="165" fill="none" stroke="rgba(13,13,13,0.38)" strokeWidth="1" />
          </svg>

          {DIMS.map((name, i) => (
            <OrbitLabel key={name} index={i} name={name} angle={(i / DIMS.length) * 360} rotation={rotSmooth} />
          ))}
        </motion.div>

        {/* Core — solid disc + crosshairs (lifted forward) */}
        <motion.div
          style={{ scale: coreSmooth }}
          className="absolute left-1/2 top-1/2 z-10 grid h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 place-items-center [transform:translate(-50%,-50%)_translateZ(90px)]"
        >
          <div className="absolute inset-[-26px] rounded-full bg-[#f15a29]/10 blur-2xl" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f15a29,#d12864_60%,#1c1b6f_100%)] shadow-[0_30px_60px_-15px_rgba(209,40,100,0.5)]" />
          <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),transparent_50%)]" />
          <div className="absolute inset-[-22px] rounded-full border border-black/30" />
          <div className="absolute left-1/2 top-0 h-[22px] w-[1px] -translate-x-1/2 -translate-y-full bg-black/40" />
          <div className="absolute left-1/2 bottom-0 h-[22px] w-[1px] -translate-x-1/2 translate-y-full bg-black/40" />
          <div className="absolute left-0 top-1/2 h-[1px] w-[22px] -translate-y-1/2 -translate-x-full bg-black/40" />
          <div className="absolute right-0 top-1/2 h-[1px] w-[22px] -translate-y-1/2 translate-x-full bg-black/40" />
        </motion.div>
      </motion.div>

      {/* Center label (flat, not tilted) */}
      <div className="pointer-events-none absolute left-1/2 top-[calc(50%+96px)] -translate-x-1/2 text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-black/50">Hirewave · Rubric</div>
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
      className="absolute left-1/2 top-1/2 h-0 w-0 [transform-style:preserve-3d]"
      style={{ transform: `translate(-50%,-50%) rotate(${angle}deg)` }}
    >
      <div className="absolute [transform:translate(-50%,-50%)_translateY(-165px)_translateZ(28px)]">
        <div className="relative flex items-center">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f15a29] shadow-[0_0_14px_rgba(241,90,41,0.7)]" />
          <motion.span
            style={{ rotate: counterRotate }}
            className="ml-2 whitespace-nowrap rounded-full bg-black/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#f4ebe2] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]"
          >
            {String(index + 1).padStart(2, '0')} {name}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
