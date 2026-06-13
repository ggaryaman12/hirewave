'use client';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, BookOpen, Clock, Gauge, Scale, Users } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

function Bullet({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/5 text-[#0a0a0a]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-bold text-[#0a0a0a]">{title}</p>
        <p className="text-sm text-black/60">{body}</p>
      </div>
    </li>
  );
}

export function ForCandidatesForEmployers() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          id="candidates"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-br from-[#1c1b6f]/[0.06] via-white/30 to-white/10 p-8 md:p-10"
        >
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#1c1b6f]">For candidates</span>
          <h3 className="mt-3 max-w-md font-display text-3xl font-black tracking-tight text-[#0a0a0a] md:text-4xl">
            One assessment. <span className="gradient-text">Every door.</span>
          </h3>
          <p className="mt-3 max-w-md text-black/65">
            Take it once. Carry your score with you. Get full per-dimension feedback even when you do not get the role.
          </p>

          <ul className="mt-7 grid gap-4">
            <Bullet icon={Clock} title="45–90 minutes, async" body="Do it on your time. No live whiteboard. No surprises." />
            <Bullet icon={BadgeCheck} title="Universal passport" body="Apply to dozens of companies without redoing the work." />
            <Bullet icon={BookOpen} title="Real feedback" body="See where you scored, where you did not, and why." />
          </ul>

          <div className="mt-8">
            <a
              href="#cta"
              className="group inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/60 px-6 py-3 text-sm font-semibold text-[#0a0a0a] backdrop-blur transition-transform hover:scale-[1.02] hover:bg-white"
            >
              Take the assessment <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>

        <motion.div
          id="employers"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-br from-[#f15a29]/[0.10] via-white/30 to-white/10 p-8 md:p-10"
        >
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#f15a29]">For employers</span>
          <h3 className="mt-3 max-w-md font-display text-3xl font-black tracking-tight text-[#0a0a0a] md:text-4xl">
            500 applicants. <span className="gradient-text">15 worth talking to.</span>
          </h3>
          <p className="mt-3 max-w-md text-black/65">
            Calibrated to your role. Bias-audited rubric. Per-candidate evidence so your bar holds up to scrutiny.
          </p>

          <ul className="mt-7 grid gap-4">
            <Bullet icon={Gauge} title="Calibrated to your role" body="Define the bar; we score against it. Not a generic leaderboard." />
            <Bullet icon={Scale} title="Defensible by design" body="Per-dimension evidence. EEOC-aligned audit log on every decision." />
            <Bullet icon={Users} title="Plugs into your ATS" body="Greenhouse, Ashby, Lever — push the shortlist with one click." />
          </ul>

          <div className="mt-8">
            <a
              href="#cta"
              className="group inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-sm font-semibold text-paper transition-transform hover:scale-[1.02]"
            >
              Book a walkthrough <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
