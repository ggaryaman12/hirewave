'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const [styles, setStyles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const s = new Array(number).fill(0).map(() => ({
      top: Math.random() * 100 + '%',
      left: Math.random() * 100 + '%',
      animationDelay: Math.random() * 5 + 's',
      animationDuration: 3 + Math.random() * 7 + 's',
    }));
    setStyles(s);
  }, [number]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {styles.map((style, idx) => (
        <span
          key={idx}
          className={cn(
            'absolute h-0.5 w-0.5 rotate-[215deg] rounded-full bg-white shadow-[0_0_0_1px_#ffffff10] animate-meteor',
            "before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:h-[1px] before:w-[60px]",
            "before:bg-gradient-to-r before:from-white before:to-transparent",
          )}
          style={style}
        />
      ))}
    </div>
  );
}
