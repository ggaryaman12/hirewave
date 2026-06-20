'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// WebGL is browser-only and heavy — load it client-side, and skip it entirely
// for users who prefer reduced motion (graceful: the CSS geometry remains).
const ThreeHero = dynamic(() => import('@/components/ui/three-hero'), { ssr: false });

export function ThreeHeroMount({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setEnabled(!reduced);
  }, []);

  if (!enabled) return null;
  return (
    <div className={className}>
      <ThreeHero />
    </div>
  );
}
