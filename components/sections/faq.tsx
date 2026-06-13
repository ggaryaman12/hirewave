'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { SectionHeading } from '@/components/sections/section-heading';
import { cn } from '@/lib/utils';

const items = [
  {
    q: 'How is this different from LeetCode-style screens?',
    a: 'LeetCode tests memorised algorithms. Hirewave tests how you collaborate with an AI to solve real, multi-step problems — the actual work of 2026 engineering.',
  },
  {
    q: 'Can candidates cheat by using an AI?',
    a: 'They\u2019re supposed to. The AI pair is part of the test. We score how they prompt, verify, and override the model — the things that distinguish good and bad collaborators.',
  },
  {
    q: 'How long is the assessment?',
    a: '45 to 90 minutes, depending on the role. Candidates can pause and resume within a 24-hour window.',
  },
  {
    q: 'Is the rubric bias-audited?',
    a: 'Yes. We run quarterly internal audits against EEOC-aligned criteria and surface per-dimension demographic deltas to every team using Hirewave.',
  },
  {
    q: 'What does it integrate with?',
    a: 'Greenhouse, Ashby, and Lever today. Slack and email hand-offs to reviewers out of the box. Custom webhooks on Team and above.',
  },
  {
    q: 'Do you store candidate code?',
    a: 'Yes, encrypted at rest, with per-candidate redaction on request. Candidates own their submissions and can delete them at any time.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative py-24 md:py-32">
      <div className="container max-w-3xl">
        <SectionHeading eyebrow="FAQ" title={<>Questions, answered tightly.</>} />

        <div className="mt-12 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white/40">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/40"
                >
                  <span className="text-base font-bold text-[#0a0a0a]">{it.q}</span>
                  <Plus
                    className={cn(
                      'h-4 w-4 shrink-0 text-black/55 transition-transform duration-300',
                      isOpen && 'rotate-45 text-[#f15a29]',
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm text-black/70">{it.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
