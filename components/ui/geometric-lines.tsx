'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

export function GeometricLines({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const { scrollYProgress } = useScroll();

  const line1X = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const line2X = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const line3Y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const arcRotate = useTransform(scrollYProgress, [0, 1], [0, 15]);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      preserveAspectRatio="none"
      viewBox="0 0 1440 900"
    >
      {/* Diagonal sweep — top-left to bottom-right */}
      <motion.line
        style={{ x: line1X } as any}
        x1="-200" y1="200" x2="1800" y2="650"
        stroke="rgba(139,92,246,0.12)" strokeWidth="0.8"
      />
      {/* Counter-diagonal */}
      <motion.line
        style={{ x: line2X } as any}
        x1="-100" y1="700" x2="1600" y2="100"
        stroke="rgba(6,182,212,0.08)" strokeWidth="0.6"
      />
      {/* Tight diagonal near top */}
      <motion.line
        style={{ y: line3Y } as any}
        x1="300" y1="-50" x2="1600" y2="450"
        stroke="rgba(217,70,239,0.07)" strokeWidth="0.5"
      />

      {/* Large arc — like Gigantic's circle segments */}
      <motion.path
        style={{ rotate: arcRotate, transformOrigin: '720px 450px' } as any}
        d="M -200 900 Q 400 -100 1640 300"
        fill="none"
        stroke="rgba(139,92,246,0.09)" strokeWidth="1"
      />
      <motion.path
        style={{ rotate: arcRotate } as any}
        d="M 0 1100 Q 600 100 1440 500"
        fill="none"
        stroke="rgba(6,182,212,0.07)" strokeWidth="0.7"
      />

      {/* Cross-hair intersect dot — subtle */}
      <circle cx="680" cy="480" r="2.5" fill="rgba(217,70,239,0.35)" />

      {/* Small grid accent — top right corner */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`vg-${i}`}
          x1={1200 + i * 40} y1="0" x2={1200 + i * 40} y2="160"
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`hg-${i}`}
          x1="1160" y1={i * 40} x2="1360" y2={i * 40}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}
