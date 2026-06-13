'use client';
import { cn } from '@/lib/utils';

export function AuroraBackground({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(1200px 800px at 15% 10%, rgba(139,92,246,0.35), transparent 60%),' +
            'radial-gradient(1000px 700px at 85% 20%, rgba(6,182,212,0.28), transparent 60%),' +
            'radial-gradient(900px 600px at 50% 100%, rgba(217,70,239,0.22), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-40 mix-blend-screen"
        style={{
          background:
            'conic-gradient(from 45deg at 50% 50%, #8b5cf644, transparent 40%, #06b6d433, transparent 70%, #d946ef44)',
          filter: 'blur(80px)',
          animation: 'aurora 60s linear infinite',
          backgroundSize: '200% 200%',
        }}
      />
      {children}
    </div>
  );
}
