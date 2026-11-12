// Pure save-slot helpers (no 'cc'). SPEC §11.3: localStorage keys emberhold.meta.v1 / emberhold.run.v1, JSON with
// `version`; corrupt / wrong-version data is ignored (run dropped, meta kept if readable), never crashes.
export const META_KEY = 'emberhold.meta.v1';
export const RUN_KEY = 'emberhold.run.v1';

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export function safeGet(kv: KV | null, key: string): string | null {
  try { return kv ? kv.getItem(key) : null; } catch { return null; }
}
export function safeSet(kv: KV | null, key: string, value: string): boolean {
  try { if (!kv) return false; kv.setItem(key, value); return true; } catch { return false; }
}
export function safeRemove(kv: KV | null, key: string): void {
  try { kv?.removeItem(key); } catch { /* storage unavailable */ }
}

/** A run snapshot is usable when it parses as JSON with version 1. */
export function validRunSnapshot(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const j = JSON.parse(raw);
    return !!j && typeof j === 'object' && j.version === 1;
  } catch { return false; }
}

/** Seed for a new run: time-based unless forced (debug hook). */
export function newSeed(force?: number): number {
  if (typeof force === 'number' && Number.isFinite(force)) return force >>> 0;
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}
