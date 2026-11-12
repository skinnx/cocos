// Pure juice curves (no 'cc'). SPEC §9.8.
export const HIT_FLASH_SEC = 0.08;
export const HIT_STOP_SEC = 0.04;
export const DMG_NUMBER_SEC = 0.8;
export const BOUNCE_SEC = 0.25;
export const FLY_SEC = 0.7;

/** Placement bounce: scale 1.2 → 1.0 with a small overshoot. */
export function bounceScale(t: number, dur = BOUNCE_SEC): number {
  if (t >= dur) return 1;
  const k = Math.max(0, t / dur);
  return 1 + 0.2 * (1 - k) * Math.cos(k * Math.PI * 1.5);
}

/** Damage number: rises with a hop, then fades during the last 40%. Returns offset (art px, +y up) and alpha 0..1. */
export function damageNumber(t: number, dur = DMG_NUMBER_SEC): { dy: number; alpha: number; scale: number } {
  const k = Math.max(0, Math.min(1, t / dur));
  const dy = 14 * (1 - (1 - k) * (1 - k)) + (k < 0.2 ? 4 * Math.sin((k / 0.2) * Math.PI) : 0);
  const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  const scale = k < 0.12 ? 1 + 0.5 * (1 - k / 0.12) : 1;
  return { dy: Math.round(dy), alpha, scale };
}

/** Quadratic Bézier for resource icons flying to the HUD (curved path). */
export function flyPath(t: number, x0: number, y0: number, x1: number, y1: number, bend = 0.35): { x: number; y: number } {
  const k = Math.max(0, Math.min(1, t));
  const e = k * k * (3 - 2 * k); // smoothstep
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
  const a = 1 - e;
  return { x: a * a * x0 + 2 * a * e * mx + e * e * x1, y: a * a * y0 + 2 * a * e * my + e * e * y1 };
}

/** HUD counter bump when a resource arrives. */
export function hudBump(t: number, dur = 0.18): number {
  if (t >= dur || t < 0) return 1;
  return 1 + 0.3 * Math.sin((t / dur) * Math.PI);
}

/** Tree shake offset (art px) while ResourceNode.shakeT > 0. */
export function treeShake(shakeT: number, t: number): number {
  if (shakeT <= 0) return 0;
  return Math.round(Math.sin(t * 60) * Math.min(1, shakeT * 6) * 1.5);
}

/** Debris particle: ballistic arc with gravity (art px). */
export function debris(t: number, vx: number, vy: number, g = 220): { x: number; y: number } {
  return { x: vx * t, y: vy * t - 0.5 * g * t * t };
}

/** Red vignette pulse alpha when the Hearth is under 30% HP. */
export function lowHearthAlpha(hpFrac: number, t: number): number {
  if (hpFrac >= 0.3) return 0;
  const sev = 1 - hpFrac / 0.3;
  return Math.max(0, Math.min(1, 0.25 + 0.35 * sev + 0.15 * Math.sin(t * 5)));
}

/** Screen fade alpha for transitions (fade out to black then back in). */
export function fadeAlpha(t: number, dur: number): number {
  if (dur <= 0) return 0;
  const k = t / dur;
  if (k <= 0 || k >= 1) return 0;
  return k < 0.5 ? k * 2 : (1 - k) * 2;
}
