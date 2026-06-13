'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export function SectionBg({
  children,
  to,
  className = '',
}: {
  children: React.ReactNode;
  to: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div
        aria-hidden
        style={{ opacity, background: to }}
        className="pointer-events-none absolute inset-0 -z-10"
      />
      {children}
    </div>
  );
}
