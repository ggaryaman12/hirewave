'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const STYLES = `
.cinematic-footer-wrapper {
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  --pill-bg-1: rgba(0,0,0,0.04);
  --pill-bg-2: rgba(0,0,0,0.01);
  --pill-shadow: rgba(0,0,0,0.20);
  --pill-highlight: rgba(255,255,255,0.5);
  --pill-inset-shadow: rgba(0,0,0,0.06);
  --pill-border: rgba(0,0,0,0.10);
  --pill-bg-1-hover: rgba(0,0,0,0.08);
  --pill-bg-2-hover: rgba(0,0,0,0.02);
  --pill-border-hover: rgba(0,0,0,0.22);
  --pill-shadow-hover: rgba(0,0,0,0.28);
  --pill-highlight-hover: rgba(255,255,255,0.7);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.95; }
}
@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(241,90,41,0.45)); }
  15%, 45% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(241,90,41,0.7)); }
  30% { transform: scale(1); }
}

.animate-footer-breathe { animation: footer-breathe 8s ease-in-out infinite alternate; }
.animate-footer-scroll-marquee { animation: footer-scroll-marquee 40s linear infinite; }
.animate-footer-heartbeat { animation: footer-heartbeat 2s cubic-bezier(0.25,1,0.5,1) infinite; }

.footer-bg-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

.footer-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(241,90,41,0.30) 0%,
    rgba(28,27,111,0.18) 40%,
    transparent 70%
  );
}

.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow:
    0 10px 30px -10px var(--pill-shadow),
    inset 0 1px 1px var(--pill-highlight),
    inset 0 -1px 2px var(--pill-inset-shadow);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
  color: rgba(0,0,0,0.65);
}
.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow: 0 20px 40px -10px var(--pill-shadow-hover), inset 0 1px 1px var(--pill-highlight-hover);
  color: #0a0a0a;
}

.footer-giant-bg-text {
  font-size: 26vw;
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(0,0,0,0.07);
  background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
}

.footer-text-glow {
  background: linear-gradient(180deg, #0a0a0a 0%, rgba(10,10,10,0.4) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 24px rgba(241,90,41,0.18));
}
`;

export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { as?: React.ElementType };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = 'button', ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const el = localRef.current;
      if (!el) return;
      const ctx = gsap.context(() => {
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const h = r.width / 2;
          const w = r.height / 2;
          const x = e.clientX - r.left - h;
          const y = e.clientY - r.top - w;
          gsap.to(el, { x: x * 0.4, y: y * 0.4, rotationX: -y * 0.15, rotationY: x * 0.15, scale: 1.05, ease: 'power2.out', duration: 0.4 });
        };
        const onLeave = () => gsap.to(el, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, ease: 'elastic.out(1,0.3)', duration: 1.2 });
        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        return () => {
          el.removeEventListener('mousemove', onMove);
          el.removeEventListener('mouseleave', onLeave);
        };
      }, el);
      return () => ctx.revert();
    }, []);
    return (
      <Component
        ref={(node: HTMLElement) => {
          (localRef as any).current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) (forwardedRef as any).current = node;
        }}
        className={cn('cursor-pointer', className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);
MagneticButton.displayName = 'MagneticButton';

const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Hire for how they work with AI</span> <span className="text-[#f15a29]/70">✦</span>
    <span>8 dimensions of AI collaboration</span> <span className="text-[#1c1b6f]/70">✦</span>
    <span>Bias-audited rubric</span> <span className="text-[#f15a29]/70">✦</span>
    <span>Universal candidate passport</span> <span className="text-[#1c1b6f]/70">✦</span>
    <span>Calibrated to your role</span> <span className="text-[#f15a29]/70">✦</span>
  </div>
);

/**
 * The cinematic intro screen. Used at the top of the page instead
 * of a plain "Enter the experience" splash. Calls `onEnter` when the
 * user clicks one of the primary CTAs. Stays mounted under the hero
 * so its background text + grid + aurora persist as decorative depth.
 */
export function CinematicIntro({ onEnter }: { onEnter: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: '6vh', scale: 0.92, opacity: 0 },
        { y: '0vh', scale: 1, opacity: 1, ease: 'power2.out', duration: 1.4 },
      );
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.18, ease: 'power3.out', duration: 1.0, delay: 0.3 },
      );
    }, wrapperRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        ref={wrapperRef}
        className="cinematic-footer-wrapper relative z-[80] flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[hsl(32,36%,92%)] text-[#0a0a0a]"
      >
        {/* Aurora glow */}
        <div className="footer-aurora pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px]" />

        {/* Grid */}
        <div className="footer-bg-grid pointer-events-none absolute inset-0 z-0" />

        {/* Giant background wordmark */}
        <div
          ref={giantTextRef}
          className="footer-giant-bg-text pointer-events-none absolute -bottom-[2vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
        >
          HIREWAVE
        </div>

        {/* Diagonal marquee */}
        <div className="absolute left-0 top-12 z-10 -rotate-2 scale-110 overflow-hidden border-y border-black/10 bg-white/40 py-4 backdrop-blur-md shadow-2xl w-full">
          <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-bold tracking-[0.3em] text-black/55 uppercase">
            <MarqueeItem />
            <MarqueeItem />
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 mx-auto mt-20 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6">
          <div className="mb-4 text-[10px] uppercase tracking-[0.32em] text-black/45">
            01 / Hirewave Labs · 2026
          </div>
          <h2
            ref={headingRef}
            className="footer-text-glow mb-12 text-center text-5xl md:text-8xl font-black tracking-tighter"
          >
            Ready to hire for 2026?
          </h2>

          <div ref={linksRef} className="flex w-full flex-col items-center gap-6">
            <div className="flex w-full flex-wrap justify-center gap-4">
              <MagneticButton
                as="button"
                onClick={onEnter}
                className="footer-glass-pill flex items-center gap-3 rounded-full px-10 py-5 text-sm md:text-base font-bold"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f15a29] text-[10px] font-black text-white">→</span>
                I am hiring
              </MagneticButton>

              <MagneticButton
                as="button"
                onClick={onEnter}
                className="footer-glass-pill flex items-center gap-3 rounded-full px-10 py-5 text-sm md:text-base font-bold"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1c1b6f] text-[10px] font-black text-white">→</span>
                I am looking
              </MagneticButton>
            </div>

            <div className="mt-2 flex w-full flex-wrap justify-center gap-3 md:gap-6">
              <MagneticButton as="button" onClick={onEnter} className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">
                How it works
              </MagneticButton>
              <MagneticButton as="button" onClick={onEnter} className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">
                The 8 dimensions
              </MagneticButton>
              <MagneticButton as="button" onClick={onEnter} className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">
                Pricing
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative z-20 flex w-full flex-col items-center justify-between gap-6 px-6 pb-8 md:flex-row md:px-12">
          <div className="order-2 text-[10px] md:text-xs font-semibold uppercase tracking-widest text-black/55 md:order-1">
            © 2026 Hirewave Labs · AI-native hiring
          </div>

          <div className="footer-glass-pill order-1 flex cursor-default items-center gap-2 rounded-full border-black/10 px-6 py-3 md:order-2">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-black/55">Crafted with</span>
            <span className="animate-footer-heartbeat text-sm md:text-base text-[#f15a29]">❤</span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-black/55">by</span>
            <span className="ml-1 text-xs md:text-sm font-black text-[#0a0a0a]">Hirewave</span>
          </div>

          <MagneticButton
            as="button"
            onClick={onEnter}
            className="footer-glass-pill order-3 flex h-12 w-12 items-center justify-center rounded-full"
          >
            <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-y-1.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </MagneticButton>
        </div>
      </div>
    </>
  );
}

/**
 * Original CinematicFooter export — kept available for use as the
 * actual footer at the bottom of pages.
 */
export function CinematicFooter() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: '10vh', scale: 0.8, opacity: 0 },
        {
          y: '0vh', scale: 1, opacity: 1, ease: 'power1.out',
          scrollTrigger: { trigger: wrapperRef.current, start: 'top 80%', end: 'bottom bottom', scrub: 1 },
        },
      );
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: wrapperRef.current, start: 'top 40%', end: 'bottom bottom', scrub: 1 },
        },
      );
    }, wrapperRef);
    return () => ctx.revert();
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div ref={wrapperRef} className="relative h-screen w-full" style={{ clipPath: 'polygon(0% 0, 100% 0%, 100% 100%, 0 100%)' }}>
        <footer className="cinematic-footer-wrapper fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-[hsl(32,36%,92%)] text-[#0a0a0a]">
          <div className="footer-aurora pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px]" />
          <div className="footer-bg-grid pointer-events-none absolute inset-0 z-0" />
          <div ref={giantTextRef} className="footer-giant-bg-text pointer-events-none absolute -bottom-[5vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap">
            HIREWAVE
          </div>
          <div className="absolute left-0 top-12 z-10 -rotate-2 scale-110 overflow-hidden border-y border-black/10 bg-white/40 py-4 backdrop-blur-md shadow-2xl w-full">
            <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-bold tracking-[0.3em] text-black/55 uppercase">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>
          <div className="relative z-10 mx-auto mt-20 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6">
            <h2 ref={headingRef} className="footer-text-glow mb-12 text-center text-5xl md:text-8xl font-black tracking-tighter">
              Start hiring for 2026.
            </h2>
            <div ref={linksRef} className="flex w-full flex-col items-center gap-6">
              <div className="flex w-full flex-wrap justify-center gap-4">
                <MagneticButton as="a" href="#cta" className="footer-glass-pill flex items-center gap-3 rounded-full px-10 py-5 text-sm md:text-base font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f15a29] text-[10px] font-black text-white">→</span>
                  Get started
                </MagneticButton>
                <MagneticButton as="a" href="#how" className="footer-glass-pill flex items-center gap-3 rounded-full px-10 py-5 text-sm md:text-base font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1c1b6f] text-[10px] font-black text-white">→</span>
                  See how it works
                </MagneticButton>
              </div>
              <div className="mt-2 flex w-full flex-wrap justify-center gap-3 md:gap-6">
                <MagneticButton as="a" href="/privacy" className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">Privacy Policy</MagneticButton>
                <MagneticButton as="a" href="/terms" className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">Terms of Service</MagneticButton>
                <MagneticButton as="a" href="/support" className="footer-glass-pill rounded-full px-6 py-3 text-xs md:text-sm font-medium">Support</MagneticButton>
              </div>
            </div>
          </div>
          <div className="relative z-20 flex w-full flex-col items-center justify-between gap-6 px-6 pb-8 md:flex-row md:px-12">
            <div className="order-2 text-[10px] md:text-xs font-semibold uppercase tracking-widest text-black/55 md:order-1">
              © 2026 Hirewave Labs. All rights reserved.
            </div>
            <div className="footer-glass-pill order-1 flex cursor-default items-center gap-2 rounded-full border-black/10 px-6 py-3 md:order-2">
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-black/55">Crafted with</span>
              <span className="animate-footer-heartbeat text-sm md:text-base text-[#f15a29]">❤</span>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-black/55">by</span>
              <span className="ml-1 text-xs md:text-sm font-black text-[#0a0a0a]">Hirewave</span>
            </div>
            <MagneticButton as="button" onClick={scrollToTop} className="footer-glass-pill group order-3 flex h-12 w-12 items-center justify-center rounded-full">
              <svg className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  );
}
