'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SectionHeading } from '@/components/sections/section-heading';
import { cn } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;

const tiers = [
  {
    name: 'Candidate',
    price: 'Free',
    sub: 'Always.',
    blurb: 'Take the assessment. Carry the score. See your full breakdown.',
    bullets: ['Universal assessment passport', 'Per-dimension feedback', 'Apply to any role on Hirewave', 'No card, no catch'],
    cta: 'Start the assessment',
    href: '#candidates',
  },
  {
    name: 'Team',
    price: '$499',
    sub: 'per month',
    featured: true,
    blurb: 'Everything a hiring team needs to run AI-native interviews.',
    bullets: [
      'Up to 10 calibrated roles',
      'Unlimited candidates',
      'Bias audit + evidence log',
      'ATS push (Greenhouse, Ashby, Lever)',
      'Slack + email reviewer hand-off',
    ],
    cta: 'Start free trial',
    href: '#cta',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    sub: 'Talk to us',
    blurb: 'For high-volume hiring with custom rubrics and on-prem audits.',
    bullets: ['Unlimited roles + seats', 'Custom rubric calibration', 'SSO, SCIM, audit export', 'Dedicated success engineer'],
    cta: 'Book a walkthrough',
    href: '#cta',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="Pricing"
          title={<>Priced for the people who do the work.</>}
          sub="Free for candidates. Forever. Teams pay only when they're hiring."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              className={cn(
                'relative overflow-hidden rounded-3xl border p-7',
                t.featured
                  ? 'border-[#f15a29]/40 bg-gradient-to-b from-[#f15a29]/[0.10] via-white/40 to-white/30 shadow-[0_18px_50px_-18px_rgba(241,90,41,0.4)]'
                  : 'border-black/10 bg-white/40',
              )}
            >
              {t.featured && (
                <div className="absolute right-5 top-5 rounded-full bg-[#0a0a0a] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-paper">
                  Most teams
                </div>
              )}
              <div className="text-sm font-semibold text-black/70">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-black tracking-tight text-[#0a0a0a]">{t.price}</span>
                <span className="text-sm text-black/50">{t.sub}</span>
              </div>
              <p className="mt-3 text-sm text-black/60">{t.blurb}</p>

              <ul className="mt-6 grid gap-2.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-black/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f15a29]" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <a
                  href={t.href}
                  className={cn(
                    'inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]',
                    t.featured
                      ? 'bg-[#0a0a0a] text-paper'
                      : 'border border-black/15 bg-white/60 text-[#0a0a0a] hover:bg-white',
                  )}
                >
                  {t.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
