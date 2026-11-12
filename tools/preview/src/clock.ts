// Real time for the Hold (SPEC §13.7): the core never reads Date — the view passes `now` (ms since epoch) and the
// local calendar day index with the 04:00 rollover (`dayKey`) into resume()/tick(). Day-key math is the client's
// pure helper (game/logic/clock.ts). The debug hook can shift the clock (__EH.resume(now)) and pin the day key
// (__EH.dayKey(n)) to simulate absences.
import { localDayKey } from '../../../assets/scripts/game/logic/clock';

export class Clock {
  /** added to Date.now() (debug time travel) */
  offset = 0;
  /** forced day key (debug), null = derived from local time */
  dayOverride: number | null = null;

  now(): number { return Date.now() + this.offset; }
  dayKeyAt(ms: number): number { return this.dayOverride !== null ? this.dayOverride : localDayKey(ms); }
  dayKey(): number { return this.dayKeyAt(this.now()); }
  /** Jumps the clock so that now() returns `ms` from here on (time keeps running after it). */
  travelTo(ms: number) { this.offset = ms - Date.now(); }
}
