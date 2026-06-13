'use client';
import { cn } from '@/lib/utils';

export function Marquee({
  children,
  reverse = false,
  pauseOnHover = false,
  className,
  vertical = false,
  repeat = 4,
}: {
  children: React.ReactNode;
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
  vertical?: boolean;
  repeat?: number;
}) {
  return (
    <div
      style={{ '--duration': '30s', '--gap': '2rem' } as React.CSSProperties}
      className={cn(
        'group flex overflow-hidden p-2 [gap:var(--gap)]',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 justify-around [gap:var(--gap)]',
            'animate-marquee',
            vertical ? 'flex-col' : 'flex-row',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
