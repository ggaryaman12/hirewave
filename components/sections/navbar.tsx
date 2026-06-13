'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ShinyButton } from '@/components/ui/shiny-button';
import { cn } from '@/lib/utils';

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#candidates', label: 'For candidates' },
  { href: '#employers', label: 'For employers' },
  { href: '#pricing', label: 'Pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();

  // Logo: full size → compact as user scrolls past hero
  const logoScale = useTransform(scrollYProgress, [0, 0.12], [1.18, 1]);
  const logoGap = useTransform(scrollYProgress, [0, 0.12], [10, 6]);
  const wordmarkOpacity = useTransform(scrollYProgress, [0, 0.06, 0.12], [0, 0.6, 1]);
  const smoothLogoScale = useSpring(logoScale, { stiffness: 120, damping: 22 });

  // Nav links fade in after hero scroll starts
  const navOpacity = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  const smoothNavOpacity = useSpring(navOpacity, { stiffness: 100, damping: 22 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'glass border-b border-black/10' : 'bg-transparent',
      )}
    >
      <nav className="container flex h-16 items-center justify-between">
        {/* Logo — scales down like Gigantic wordmark */}
        <Link href="/" className="flex items-center">
          <motion.div
            style={{ scale: smoothLogoScale, gap: logoGap }}
            className="flex items-center"
          >
            <span className="relative inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#0a0a0a] text-[10px] font-black text-paper">
              HW
            </span>
            <motion.span
              style={{ opacity: wordmarkOpacity }}
              className="text-lg font-bold tracking-tight text-[#0a0a0a]"
            >
              Hirewave
            </motion.span>
          </motion.div>
        </Link>

        {/* Nav links fade in after scroll starts */}
        <motion.ul
          style={{ opacity: smoothNavOpacity }}
          className="hidden items-center gap-8 md:flex"
        >
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm text-black/60 transition-colors hover:text-black"
              >
                {l.label}
              </a>
            </li>
          ))}
        </motion.ul>

        <motion.div
          style={{ opacity: smoothNavOpacity }}
          className="flex items-center gap-2"
        >
          <a
            href="/dashboard"
            className="hidden rounded-full px-3 py-2 text-sm text-black/65 transition-colors hover:text-black md:inline-flex"
          >
            Sign in
          </a>
          <a
            href="/dashboard/assessments/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-paper transition-transform hover:scale-[1.03]"
          >
            Get started
          </a>
        </motion.div>
      </nav>
    </motion.header>
  );
}
