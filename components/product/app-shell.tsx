import Link from 'next/link';
import { Code2, LayoutDashboard, LibraryBig, LogOut, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5efe7] text-[#101010]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/10 bg-white/55 px-5 py-6 backdrop-blur md:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#111] text-paper">
            <Code2 className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-base font-black">Hirewave</span>
            <span className="block text-xs text-black/45">Assessment OS</span>
          </span>
        </Link>

        <nav className="mt-10 grid gap-1">
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/dashboard/assessments/new" icon={PlusCircle} label="New assessment" />
          <NavItem href="/dashboard/assessments/new#catalog" icon={LibraryBig} label="Challenge catalog" />
        </nav>

        <div className="absolute bottom-6 left-5 right-5 rounded-lg border border-black/10 bg-white/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">MVP mode</p>
          <p className="mt-2 text-sm text-black/65">
            Simulated runner and demo auth are enabled. Telemetry and reports are persisted locally.
          </p>
        </div>
      </aside>

      <main className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f5efe7]/85 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black tracking-tight md:text-2xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-black/55">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {action}
              <Link
                href="/"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 text-sm font-semibold text-black/65 hover:bg-white"
              >
                <LogOut className="h-4 w-4" />
                Landing
              </Link>
            </div>
          </div>
        </header>
        <div className="px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-black/65 hover:bg-black/5 hover:text-black',
        active && 'bg-black text-paper hover:bg-black hover:text-paper',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
