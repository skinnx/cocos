// Pure camera / pixel-perfect math (no 'cc'). SPEC §3: 1 art px = n device px, n = max(2, round(deviceW/180)),
// pinch zoom over 3 integer steps (n-1, n, n+1), look-ahead 1.5 tiles, smoothing 0.15 s, shake <= 4 art px.
export const DESIGN_W = 720;
export const DESIGN_H = 1280;
export const TILE = 16;
export const LOOK_AHEAD_TILES = 1.5;
export const SMOOTH_SECONDS = 0.15;
export const MAX_SHAKE_ART_PX = 4;

/** Base integer device-px-per-art-px for a device width in physical pixels. */
export function basePixelScale(deviceWidthPx: number): number {
  return Math.max(2, Math.round(deviceWidthPx / 180));
}

/** The three integer zoom steps around n (never below 1). */
export function zoomSteps(n: number): [number, number, number] {
  return [Math.max(1, n - 1), n, n + 1];
}

/** Device pixels per design unit with FIXED_WIDTH fit. */
export function devicePerDesign(deviceWidthPx: number, designWidth = DESIGN_W): number {
  return deviceWidthPx / designWidth;
}

/** Design units per art pixel so that one art pixel covers exactly `n` device pixels. */
export function designPerArtPx(n: number, deviceWidthPx: number, designWidth = DESIGN_W): number {
  return (n * designWidth) / deviceWidthPx;
}

/** Snap a design-unit coordinate onto the device pixel grid. */
export function snapToDevice(v: number, dpd: number): number {
  return Math.round(v * dpd) / dpd;
}

/** Snap an art-px coordinate to an integer art pixel (sprite positions, §3). */
export function snapArt(v: number): number {
  return Math.round(v);
}

/** Frame-rate independent exponential smoothing factor. */
export function smoothFactor(dt: number, tau = SMOOTH_SECONDS): number {
  if (tau <= 0) return 1;
  return 1 - Math.exp(-dt / tau);
}

export interface V2 { x: number; y: number }

/** Look-ahead offset (tile units) in the direction of travel; dir magnitude <= 1. */
export function lookAhead(dir: V2, tiles = LOOK_AHEAD_TILES): V2 {
  const m = Math.hypot(dir.x, dir.y);
  if (m < 1e-4) return { x: 0, y: 0 };
  const k = Math.min(1, m) / m;
  return { x: dir.x * k * tiles, y: dir.y * k * tiles };
}

/**
 * Converts between tile space (core: +y down) and screen design space (origin bottom-left, +y up) given the camera
 * centre in tiles and the world scale s (design units per art px).
 */
export function tileToScreen(tx: number, ty: number, cam: V2, s: number, visW: number, visH: number): V2 {
  return { x: (tx - cam.x) * TILE * s + visW / 2, y: -(ty - cam.y) * TILE * s + visH / 2 };
}
export function screenToTile(sx: number, sy: number, cam: V2, s: number, visW: number, visH: number): V2 {
  return { x: cam.x + (sx - visW / 2) / (TILE * s), y: cam.y - (sy - visH / 2) / (TILE * s) };
}

/** World root node position (design units, relative to the canvas centre) for a camera centre, snapped to device px. */
export function worldRootPosition(cam: V2, s: number, dpd: number): V2 {
  return { x: snapToDevice(-cam.x * TILE * s, dpd), y: snapToDevice(cam.y * TILE * s, dpd) };
}

/** Clamp the camera so the view stays over the map (with a margin of water around the island). */
export function clampCamera(cam: V2, mapSize: number, viewTilesW: number, viewTilesH: number, margin = 2): V2 {
  const clampAxis = (c: number, half: number) => {
    const lo = -margin + half, hi = mapSize + margin - half;
    return lo > hi ? mapSize / 2 : Math.min(hi, Math.max(lo, c));
  };
  return { x: clampAxis(cam.x, viewTilesW / 2), y: clampAxis(cam.y, viewTilesH / 2) };
}

/** Deterministic pseudo-random shake offset in art px, amplitude decays linearly over its duration. */
export function shakeOffset(t: number, remaining: number, duration: number, amp: number): V2 {
  if (remaining <= 0 || duration <= 0) return { x: 0, y: 0 };
  const a = Math.min(MAX_SHAKE_ART_PX, amp) * Math.min(1, remaining / duration);
  const x = Math.sin(t * 91.7) * 0.6 + Math.sin(t * 37.3 + 1.3) * 0.4;
  const y = Math.sin(t * 77.1 + 2.1) * 0.6 + Math.sin(t * 43.9 + 0.4) * 0.4;
  return { x: Math.round(x * a), y: Math.round(y * a) };
}

/** Edge auto-scroll velocity (tiles/s) when a drag is near a screen edge in build mode. */
export function edgeScroll(sx: number, sy: number, visW: number, visH: number, band: number, speed: number,
  bottomBand = band): V2 {
  let vx = 0, vy = 0;
  if (sx < band) vx = -(1 - sx / band);
  else if (sx > visW - band) vx = (sx - (visW - band)) / band;
  if (sy > visH - band) vy = -(sy - (visH - band)) / band;
  else if (sy < bottomBand) vy = 1 - sy / bottomBand;
  return { x: vx * speed, y: vy * speed };
}

/** Pinch: choose the zoom step index from the pinch distance ratio, relative to the index at pinch start. */
export function pinchStep(startIndex: number, ratio: number): number {
  let i = startIndex;
  if (ratio > 1.35) i = startIndex + 1;
  if (ratio > 1.9) i = startIndex + 2;
  if (ratio < 0.74) i = startIndex - 1;
  if (ratio < 0.52) i = startIndex - 2;
  return Math.max(0, Math.min(2, i));
}
