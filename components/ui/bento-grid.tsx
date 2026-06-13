'use client';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BentoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-4', className)}>
      {children}
    </div>
  );
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
}: {
  name: string;
  className?: string;
  background?: React.ReactNode;
  Icon?: React.ComponentType<{ className?: string }>;
  description: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div
      className={cn(
        'group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-2xl',
        'border border-black/10 bg-white/45',
        'transform-gpu transition-all duration-300 hover:bg-white/70 hover:border-black/20',
        'shadow-[0_2px_0_0_rgba(0,0,0,0.02)] hover:shadow-[0_18px_40px_-18px_rgba(241,90,41,0.35)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">{background}</div>
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-10">
        {Icon && (
          <Icon className="h-10 w-10 origin-left transform-gpu text-[#0a0a0a]/85 transition-all duration-300 ease-in-out group-hover:scale-90" />
        )}
        <h3 className="mt-2 text-xl font-bold text-[#0a0a0a]">{name}</h3>
        <p className="max-w-lg text-sm text-black/60">{description}</p>
      </div>
      <div
        className={cn(
          'pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100',
        )}
      >
        {cta && (
          <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[#0a0a0a] px-3 py-1 text-xs text-paper">
            {cta} <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
