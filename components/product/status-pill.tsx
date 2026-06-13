import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  started: 'bg-blue-100 text-blue-800 border-blue-200',
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  report_ready: 'bg-violet-100 text-violet-800 border-violet-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize',
        styles[status] || 'border-black/10 bg-white text-black/60',
        className,
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
