// Real-time clock for the view (no 'cc'). SPEC §13.7: the core never reads Date — the view passes `now` (ms since
// epoch) and a local calendar `dayKey` with the 04:00 rollover into resume()/tick(). DST and timezone changes are
// handled by computing the key from the *local wall time* at that instant, so a 23 h or 25 h day still rolls over
// exactly once, at 04:00 local.
export const DAY_MS = 86_400_000;
export const RESET_HOUR = 4;
/** How often the open game calls game.tick(now, dayKey) (SPEC: ~1/s). */
export const TICK_SEC = 1;

/**
 * Day index (days since 1970-01-01) of the local "game day" containing `nowMs`, where a game day starts at
 * RESET_HOUR local time. `offsetMin` is Date#getTimezoneOffset() at that instant (minutes, UTC − local).
 */
export function dayKeyAt(nowMs: number, offsetMin: number, resetHour = RESET_HOUR): number {
  if (!Number.isFinite(nowMs)) return 0;
  const localMs = nowMs - (Number.isFinite(offsetMin) ? offsetMin : 0) * 60_000;
  return Math.floor((localMs - resetHour * 3_600_000) / DAY_MS);
}

/** Day key for the host's local timezone (the only place the view touches Date for the day boundary). */
export function localDayKey(nowMs: number, resetHour = RESET_HOUR): number {
  let off = 0;
  try { off = new Date(nowMs).getTimezoneOffset(); } catch { off = 0; }
  return dayKeyAt(nowMs, off, resetHour);
}

/** Milliseconds until the next 04:00 rollover (for countdown labels such as "new bounties in 3h"). */
export function msUntilRollover(nowMs: number, offsetMin: number, resetHour = RESET_HOUR): number {
  const localMs = nowMs - offsetMin * 60_000 - resetHour * 3_600_000;
  const into = ((localMs % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - into;
}

/** Throttle for the ~1/s tick: returns how many whole ticks are due and the leftover accumulator. */
export function dueTicks(acc: number, dt: number, interval = TICK_SEC): { ticks: number; acc: number } {
  const a = Math.max(0, acc + Math.max(0, dt));
  if (a < interval) return { ticks: 0, acc: a };
  // never burst: a long frame (tab hidden) produces one tick; core computes elapsed time from `now` itself
  return { ticks: 1, acc: a % interval };
}

/** A real-time source the view can swap in tests and in the debug hook (`__EH.resume(now)`). */
export interface ClockSource { now(): number; dayKey(now: number): number }
export const systemClock: ClockSource = {
  now: () => Date.now(),
  dayKey: (now) => localDayKey(now),
};

/** Fixed clock for tests / debug (advance manually). */
export class ManualClock implements ClockSource {
  constructor(public t: number, public offsetMin = 0) {}
  now(): number { return this.t; }
  dayKey(now: number): number { return dayKeyAt(now, this.offsetMin); }
  advance(ms: number): number { this.t += ms; return this.t; }
}
