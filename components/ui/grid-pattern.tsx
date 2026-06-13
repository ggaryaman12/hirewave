'use client';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = '0',
  numSquares = 48,
  className,
  maxOpacity = 0.5,
  duration = 4,
  ...props
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: string;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
}) {
  const id = useId();
  const [squares, setSquares] = useState<{ id: number; pos: readonly [number, number] }[]>([]);
  useEffect(() => {
    setSquares(
      Array.from({ length: numSquares }).map((_, i) => ({
        id: i,
        pos: [Math.floor(Math.random() * 40), Math.floor(Math.random() * 20)] as const,
      })),
    );
  }, [numSquares]);
  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-white/10 stroke-white/10',
        '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]',
        className,
      )}
      {...props}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [sx, sy], id: sid }, i) => (
          <rect
            key={`${sid}-${sx}-${sy}`}
            strokeWidth="0"
            width={width - 1}
            height={height - 1}
            x={sx * width + 1}
            y={sy * height + 1}
            style={{
              animation: `fade ${duration}s linear ${(i * 0.15).toFixed(2)}s infinite`,
            }}
          />
        ))}
      </svg>
      <style>{`
        @keyframes fade { 0%, 100% { opacity: 0; } 50% { opacity: ${maxOpacity}; } }
      `}</style>
    </svg>
  );
}
