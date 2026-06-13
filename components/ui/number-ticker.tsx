'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  suffix = '',
  prefix = '',
}: {
  value: number;
  direction?: 'up' | 'down';
  delay?: number;
  className?: string;
  decimalPlaces?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
  const motionValue = useMotionValue(direction === 'down' ? value : 0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 90 });
  const [display, setDisplay] = useState(direction === 'down' ? value : 0);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => motionValue.set(direction === 'down' ? 0 : value), delay * 1000);
      return () => clearTimeout(t);
    }
  }, [motionValue, isInView, delay, value, direction]);

  useEffect(() => {
    const unsub = springValue.on('change', (latest) => {
      setDisplay(Number(latest.toFixed(decimalPlaces)));
    });
    return () => unsub();
  }, [springValue, decimalPlaces]);

  return (
    <span ref={ref} className={cn('inline-block tabular-nums', className)}>
      {prefix}
      {Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(display)}
      {suffix}
    </span>
  );
}
