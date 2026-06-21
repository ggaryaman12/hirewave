import { useEffect, useRef } from 'react';
import type { Language } from '@/lib/constants';

// Local-first write-behind autosave for the DSA editor.
//   - localStorage (debounced ~500ms): instant, free, survives reload + offline.
//   - server PUT (debounced ~5s, only if changed): durable + cross-device.
//   - sendBeacon on page-hide: flushes the final buffer during unload (a normal
//     fetch would be cancelled).
// On mount it recovers the newest of {local, server} per (slug, language) and
// hands it back via onRecover; the caller applies it only to a pristine buffer.

const LOCAL_DEBOUNCE_MS = 500;
const SERVER_DEBOUNCE_MS = 5000;

const localKey = (slug: string, language: string) => `hw-dsa-draft:${slug}:${language}`;

function safeParse(raw: string): { source: string; t: number } | null {
  try {
    const v = JSON.parse(raw) as { source?: unknown; t?: unknown };
    return typeof v.source === 'string' ? { source: v.source, t: Number(v.t) || 0 } : null;
  } catch {
    return null;
  }
}

export function useDraftAutosave(params: {
  slug: string;
  language: Language;
  source: string;
  // Server persistence only runs for signed-in users; anonymous users keep their
  // draft in localStorage only (an anon server write would just 401).
  authed: boolean;
  onRecover: (language: Language, source: string) => void;
}) {
  const { slug, language, source, authed } = params;

  const lastServerSource = useRef<string | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep latest values + callback in refs so the beacon listener (registered
  // once) and the recover effect don't churn on every keystroke.
  const onRecoverRef = useRef(params.onRecover);
  onRecoverRef.current = params.onRecover;
  const latest = useRef({ slug, language, source });
  latest.current = { slug, language, source };

  // Recover the newest saved draft on mount / language switch. (No "already
  // recovered" ref guard: under React StrictMode the first run is cancelled by
  // its cleanup, so a ref guard would make the second run early-return and the
  // draft would never be restored. The `cancelled` flag handles real unmounts;
  // the caller's pristine-buffer check prevents clobbering live edits.)
  useEffect(() => {
    let cancelled = false;
    const localRaw = typeof window !== 'undefined' ? window.localStorage.getItem(localKey(slug, language)) : null;
    const local = localRaw ? safeParse(localRaw) : null;

    void (async () => {
      let server: { source: string; updatedAt: string } | null = null;
      // Anonymous users have no server draft; skip the fetch entirely.
      if (authed) {
        try {
          const res = await fetch(`/api/dsa/problems/${slug}/draft?language=${language}`);
          if (res.ok) server = (await res.json()).draft;
        } catch {
          /* offline -> fall back to localStorage */
        }
      }
      if (cancelled) return;
      const localT = local?.t ?? 0;
      const serverT = server ? Date.parse(server.updatedAt) : 0;
      const winner = serverT > localT ? server?.source : local?.source;
      lastServerSource.current = server?.source ?? null;
      if (winner != null) onRecoverRef.current(language, winner);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, language, authed]);

  // Debounced save: fast localStorage always; server only for signed-in users
  // and only when the content actually changed.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      window.localStorage.setItem(localKey(slug, language), JSON.stringify({ source, t: Date.now() }));
    }, LOCAL_DEBOUNCE_MS);

    clearTimeout(serverTimer.current);
    if (authed) {
      serverTimer.current = setTimeout(() => {
        if (source === lastServerSource.current) return;
        lastServerSource.current = source;
        void fetch(`/api/dsa/problems/${slug}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language, source }),
        }).catch(() => {
          lastServerSource.current = null; // allow a retry on the next change
        });
      }, SERVER_DEBOUNCE_MS);
    }

    return () => {
      clearTimeout(localTimer.current);
      clearTimeout(serverTimer.current);
    };
  }, [slug, language, source, authed]);

  // Flush on exit — sendBeacon delivers even as the page unloads (signed-in only).
  useEffect(() => {
    const onHide = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
      if (!authed) return;
      const current = latest.current;
      if (current.source === lastServerSource.current) return;
      const blob = new Blob([JSON.stringify({ language: current.language, source: current.source })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`/api/dsa/problems/${current.slug}/draft`, blob);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [authed]);
}
