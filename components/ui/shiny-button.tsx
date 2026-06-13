'use client';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const ShinyButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' | 'a'; href?: string }
>(({ className, children, as = 'button', href, ...props }, ref) => {
  const classes = cn(
    'group relative inline-flex items-center justify-center overflow-hidden rounded-full',
    'border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white',
    'backdrop-blur-sm transition-all duration-200',
    'hover:bg-white/[0.08] hover:border-white/25',
    'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
    className,
  );
  const inner = (
    <>
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.25),transparent)] bg-[length:200%_100%] animate-shimmer" />
      {children}
    </>
  );
  if (as === 'a') {
    return (
      <a href={href} className={classes} {...(props as object)}>
        {inner}
      </a>
    );
  }
  return (
    <button ref={ref} className={classes} {...props}>
      {inner}
    </button>
  );
});
ShinyButton.displayName = 'ShinyButton';
