'use client';
import { Marquee } from '@/components/ui/marquee';

const rowA = ['Northwind', 'Acme Labs', 'Helix', 'Lumen', 'Parallel', 'Voltaic', 'Stratosphere', 'Cobalt'];
const rowB = ['Mercury', 'Quartz', 'Beacon', 'Foundry', 'Ironclad', 'Cipher', 'Marble', 'Vertex'];

function LogoText({ name }: { name: string }) {
  return (
    <span className="mx-6 whitespace-nowrap text-2xl font-bold tracking-tight text-black/35 transition-colors hover:text-black/75">
      {name}
    </span>
  );
}

export function LogosMarquee() {
  return (
    <section className="relative py-20 md:py-24">
      <div className="container">
        <p className="mb-10 text-center text-xs uppercase tracking-[0.18em] text-black/45">
          Trusted by teams hiring the next wave
        </p>

        <div className="relative [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]">
          <Marquee className="[--duration:42s]" pauseOnHover>
            {rowA.map((n) => (
              <LogoText key={n} name={n} />
            ))}
          </Marquee>
          <Marquee reverse className="[--duration:50s] mt-2" pauseOnHover>
            {rowB.map((n) => (
              <LogoText key={n} name={n} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
