// Pure persistence helpers (no 'cc'). SPEC §13.7: one Hold save under `emberhold.hold.v2` (JSON with `version`),
// written through a temporary key then "renamed" (localStorage has no rename: write tmp → verify → rotate the
// previous save to `.bak` → write main → drop tmp). Loading tries main, then the backup, then a leftover tmp; if
// every copy is unreadable the player is told and a new Hold starts — never a crash. Settings live separately.
export const HOLD_KEY = 'emberhold.hold.v2';
export const HOLD_BAK_KEY = 'emberhold.hold.v2.bak';
export const HOLD_TMP_KEY = 'emberhold.hold.v2.tmp';
export const SETTINGS_KEY = 'emberhold.settings.v1';
export const LEGACY_META_KEY = 'emberhold.meta.v1';
export const LEGACY_RUN_KEY = 'emberhold.run.v1';
/** Autosave cadence in PEACE (§13.7). */
export const PEACE_SAVE_SEC = 20;

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

/** Atomic-ish write with one backup generation. Returns false (and leaves the previous save intact) on failure. */
export function writeHold(kv: KV | null, json: string): boolean {
  if (!kv || !json) return false;
  if (!safeSet(kv, HOLD_TMP_KEY, json) || safeGet(kv, HOLD_TMP_KEY) !== json) { safeRemove(kv, HOLD_TMP_KEY); return false; }
  const prev = safeGet(kv, HOLD_KEY);
  if (prev && prev !== json) safeSet(kv, HOLD_BAK_KEY, prev);
  if (!safeSet(kv, HOLD_KEY, json)) return false; // tmp stays as the newest readable copy
  safeRemove(kv, HOLD_TMP_KEY);
  return true;
}

export type HoldSource = 'main' | 'bak' | 'tmp';
export interface HoldLoad<T> { value: T | null; from: HoldSource | null; corrupt: boolean; tried: HoldSource[] }
/**
 * Open the newest readable Hold. `open(raw)` must throw on unreadable data (the core's createHold does). `corrupt`
 * is true when at least one stored copy failed, so the view can tell the player.
 */
export function loadHold<T>(kv: KV | null, open: (raw: string) => T): HoldLoad<T> {
  const tried: HoldSource[] = [];
  let corrupt = false;
  for (const [from, key] of [['main', HOLD_KEY], ['bak', HOLD_BAK_KEY], ['tmp', HOLD_TMP_KEY]] as Array<[HoldSource, string]>) {
    const raw = safeGet(kv, key);
    if (!raw) continue;
    tried.push(from);
    try {
      if (!looksLikeJsonObject(raw)) throw new Error('not json');
      return { value: open(raw), from, corrupt, tried };
    } catch { corrupt = true; }
  }
  return { value: null, from: null, corrupt, tried };
}

export function looksLikeJsonObject(raw: string | null): boolean {
  if (!raw) return false;
  try { const j = JSON.parse(raw); return !!j && typeof j === 'object' && !Array.isArray(j); } catch { return false; }
}

/** Normalise a pasted export string (whitespace, wrapping quotes, a leading "EH2:" tag). Null when not a JSON object. */
export function normalizeImport(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  let s = text.trim();
  if (s.startsWith('EH2:')) s = s.slice(4).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { const inner = JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1)}"` : s); if (typeof inner === 'string') s = inner.trim(); } catch { return null; }
  }
  return looksLikeJsonObject(s) ? s : null;
}
/** Export string shown / copied in Settings. */
export function exportString(json: string): string { return `EH2:${json}`; }

/** When the view may persist the Hold (§13.7: never mid-night; the dusk save stands; not during an expedition). */
export function canSave(phase: string, expedition: boolean): boolean { return phase !== 'night' && !expedition; }

/** Seed for a brand-new Hold: time-based unless forced (debug hook). */
export function newSeed(force?: number): number {
  if (typeof force === 'number' && Number.isFinite(force)) return force >>> 0;
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

/** Rare resources whose spending triggers an immediate save (§13.7). */
export const RARE_RES = ['gold', 'iron', 'essence', 'lore', 'resin', 'frost', 'coal'] as const;
export function spentRare(prev: Record<string, number> | null, cur: Record<string, number>, prevEmber: number, ember: number): boolean {
  if (!prev) return false;
  if (ember < prevEmber) return true;
  for (const k of RARE_RES) if ((cur[k] ?? 0) < (prev[k] ?? 0) - 1e-6) return true;
  return false;
}
