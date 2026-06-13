'use client';
import Link from 'next/link';

const cols = [
  { head: 'Product', items: [['Dashboard', '/dashboard'], ['Create assessment', '/dashboard/assessments/new'], ['How it works', '#how'], ['Pricing', '#pricing']] },
  { head: 'For candidates', items: [['Demo invite', '/invite/demo-invite'], ['How scoring works', '#how'], ['Your data', '#pricing'], ['Help center', '#cta']] },
  { head: 'For employers', items: [['Calibrate a role', '/dashboard/assessments/new'], ['Reports', '/dashboard'], ['Templates', '/dashboard/assessments/new'], ['Book a walkthrough', '#cta']] },
  { head: 'Company', items: [['About', '#how'], ['Hiring philosophy', '#candidates'], ['Security', '#pricing'], ['Contact', '#cta']] },
];

export function Footer() {
  return (
    <footer className="relative border-t border-black/10 bg-white/40 pt-20 pb-10">
      <div className="container">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#0a0a0a] text-[11px] font-black text-paper">
                HW
              </span>
              <span className="text-xl font-bold tracking-tight text-[#0a0a0a]">Hirewave</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-black/60">
              Hire for how they work with AI, not how they work without it.
            </p>
            <p className="mt-6 text-xs text-black/45">
              Hirewave commits to EEOC-aligned, bias-audited assessments. Per-dimension demographic deltas published quarterly.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.head}>
              <p className="mb-3 text-xs uppercase tracking-[0.18em] text-black/45">{c.head}</p>
              <ul className="space-y-2">
                {c.items.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-black/65 transition-colors hover:text-[#0a0a0a]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-black/10 pt-6 text-xs text-black/45 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Hirewave Labs. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="/dashboard" className="hover:text-[#0a0a0a]">Dashboard</a>
            <a href="/dashboard/assessments/new" className="hover:text-[#0a0a0a]">Create assessment</a>
            <a href="#how" className="hover:text-[#0a0a0a]">Rubric</a>
            <a href="#cta" className="hover:text-[#0a0a0a]">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
