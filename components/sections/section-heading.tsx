'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center mx-auto max-w-2xl' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow && (
        <span className="inline-flex rounded-full border border-black/15 bg-white/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-black/60">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl font-black tracking-[-0.03em] text-balance text-[#0a0a0a] md:text-5xl">
        {title}
      </h2>
      {sub && <p className="text-pretty text-base text-black/60 md:text-lg">{sub}</p>}
    </motion.div>
  );
}
