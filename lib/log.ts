import crypto from 'crypto';

// Minimal structured (JSON) logger. One line per event so logs are queryable
// (grep by correlationId / event) instead of free-text. This is the Phase-0
// observability seam: the counters/latencies it emits are how we'll know when
// real scale work (async queue, Postgres) is actually triggered.
//
// Intentionally console-based for now — a log shipper / collector slots in
// later without touching call sites.

type Fields = Record<string, unknown>;

export function log(event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields });
  // eslint-disable-next-line no-console
  console.log(line);
}

// Correlation id threads one logical request across hops (api -> judge -> db),
// turning a multi-step flow into a single greppable timeline.
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
