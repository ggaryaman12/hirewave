'use client';
import { cn } from '@/lib/utils';

export function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 8,
  className,
}: {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 select-none [mask-image:linear-gradient(to_bottom,white,transparent)]',
        className,
      )}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70;
        const opacity = Math.max(mainCircleOpacity - i * 0.03, 0);
        const animationDelay = `${i * 0.08}s`;
        const borderStyle = i === numCircles - 1 ? 'dashed' : 'solid';
        const borderOpacity = 5 + i * 5;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 animate-ripple rounded-full bg-foreground/10 shadow-xl border"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animationDelay,
              borderStyle,
              borderWidth: '1px',
              borderColor: `hsl(263 70% 70% / ${borderOpacity}%)`,
              transform: 'translate(-50%, -50%) scale(1)',
            }}
          />
        );
      })}
    </div>
  );
}
