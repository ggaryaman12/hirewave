'use client';
import { cn } from '@/lib/utils';

export function AnimatedGradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur',
        className,
      )}
    >
      <span className="animate-aurora bg-[length:300%_auto] bg-clip-text text-transparent [background-image:linear-gradient(90deg,#8b5cf6,#d946ef,#06b6d4,#10b981,#8b5cf6)]">
        {children}
      </span>
    </span>
  );
}
