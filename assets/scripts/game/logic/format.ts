// Number / time / cost formatting for the HUD and panels (no 'cc'). SPEC §10.5: every progress number uses the short
// form (1.2k, 34k); countdowns read like a clock.
import type { Cost, ResKey } from '../../core/api';

/** 999 → "999", 1234 → "1.2k", 34_000 → "34k", 1_250_000 → "1.3M". Negative numbers keep their sign. */
export function abbrev(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const v = Math.floor(Math.abs(n));
  const one = (x: number, unit: string) => {
    const s = x.toFixed(1);
    return `${sign}${s.endsWith('.0') ? s.slice(0, -2) : s}${unit}`;
  };
  if (v >= 1_000_000_000) return v >= 10_000_000_000 ? `${sign}${Math.floor(v / 1_000_000_000)}B` : one(Math.floor(v / 100_000_000) / 10, 'B');
  if (v >= 1_000_000) return v >= 10_000_000 ? `${sign}${Math.floor(v / 1_000_000)}M` : one(Math.floor(v / 100_000) / 10, 'M');
  if (v >= 10_000) return `${sign}${Math.floor(v / 1000)}k`;
  if (v >= 1000) return one(Math.floor(v / 100) / 10, 'k');
  return `${sign}${v}`;
}

/** Away / duration text: "45s", "12m", "2h 05m", "3d 4h". Negative or NaN → "0s". */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  const s = Math.floor(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? `${h}h ${String(mm).padStart(2, '0')}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

/** Clock countdown: 185 → "3:05", 3725 → "1:02:05". Rounds up so "0:00" only shows at the end. */
export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export const RES_ORDER: ResKey[] = ['wood', 'stone', 'gold', 'iron', 'food', 'essence', 'lore', 'resin', 'frost', 'coal'];
/** One-letter cost codes (colour is never the only cue, §10.4): w s g i f e l r c o. */
export const RES_CODE: Record<ResKey, string> = {
  wood: 'w', stone: 's', gold: 'g', iron: 'i', food: 'f', essence: 'e', lore: 'l', resin: 'r', frost: 'c', coal: 'o',
};
export function resIcon(k: ResKey | 'ember' | 'deeds' | 'shards'): string {
  switch (k) {
    case 'wood': case 'stone': case 'gold': case 'ember': return `icon_${k}`;
    case 'deeds': return 'icon_chronicle';
    case 'shards': return 'icon_shard';
    default: return `icon_${k}`;
  }
}

/** Non-zero entries of a cost in display order. */
export function costParts(c: Cost | null | undefined): Array<{ res: ResKey; amount: number }> {
  const out: Array<{ res: ResKey; amount: number }> = [];
  if (!c) return out;
  for (const k of RES_ORDER) { const v = c[k]; if (v && v > 0) out.push({ res: k, amount: v }); }
  return out;
}

/** Compact cost text, e.g. "20w 10s 1.2kg". */
export function costText(c: Cost | null | undefined): string {
  const p = costParts(c);
  return p.length ? p.map((q) => `${abbrev(q.amount)}${RES_CODE[q.res]}`).join(' ') : '0';
}

/** Whether `have` covers every part of `c`. */
export function affordable(have: Partial<Record<ResKey, number>>, c: Cost | null | undefined): boolean {
  for (const q of costParts(c)) if ((have[q.res] ?? 0) < q.amount) return false;
  return true;
}

/** Sum of costs. */
export function addCost(a: Cost, b: Cost | null | undefined, mul = 1): Cost {
  const out: Cost = { ...a };
  if (b) for (const k of RES_ORDER) { const v = b[k]; if (v) out[k] = (out[k] ?? 0) + v * mul; }
  return out;
}

/** "x/y" progress with abbreviations. */
export function fmtProgress(cur: number, goal: number): string { return `${abbrev(Math.min(cur, goal))}/${abbrev(goal)}`; }

/** Clip text to `n` characters with a trailing "..." (single-line strips; the bitmap font is ~5 px per glyph). */
export function clip(s: string, n: number): string {
  if (n <= 3) return s.slice(0, Math.max(0, n));
  return s.length <= n ? s : `${s.slice(0, n - 3).trimEnd()}...`;
}
