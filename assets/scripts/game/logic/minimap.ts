// Pure minimap + edge-arrow math (no 'cc').
import type { Biome } from '../../core/api';

export interface V2 { x: number; y: number }

/** Tile (y down) → minimap local px (origin bottom-left, +y up), for a square minimap of `px` size. */
export function projectToMinimap(tx: number, ty: number, mapSize: number, px: number): V2 {
  return { x: (tx / mapSize) * px, y: px - (ty / mapSize) * px };
}
/** Minimap local px → tile. */
export function unprojectMinimap(mx: number, my: number, mapSize: number, px: number): V2 {
  return { x: (mx / px) * mapSize, y: ((px - my) / px) * mapSize };
}

/** Palette colours (tools/art/pixel.mjs) used for the minimap texels, RGB. */
export const MINI_COLORS = {
  water: [0x2a, 0x4a, 0x8a], shore: [0xb9, 0x8a, 0x56], meadow: [0x4c, 0x9a, 0x4a], forest: [0x2f, 0x6b, 0x3a],
  quarry: [0x8a, 0x5a, 0x3c], ruins: [0x73, 0x79, 0x8c], fog: [0x1b, 0x1b, 0x2f], lit: [0xf7, 0xa9, 0x3b],
  building: [0xd6, 0xda, 0xe3], hearth: [0xff, 0xe2, 0x7a], rift: [0xd0, 0x8b, 0xe8], hero: [0xf6, 0xf2, 0xe6],
  leader: [0xff, 0xe2, 0x7a], enemy: [0xd1, 0x4b, 0x4b], poi: [0xf2, 0xc6, 0x9a],
} as const;

export interface MiniInput {
  size: number; biome: ArrayLike<Biome | string>; explored: ArrayLike<number>; light: ArrayLike<number>;
  night: boolean;
  buildings: ReadonlyArray<{ x: number; y: number; w: number; h: number; id: string }>;
  rifts: ReadonlyArray<{ x: number; y: number; active: boolean }>;
  pois: ReadonlyArray<{ x: number; y: number }>;
  heroes: ReadonlyArray<{ x: number; y: number; leader: boolean }>;
  enemies: ReadonlyArray<{ x: number; y: number }>;
}

function put(buf: Uint8Array, size: number, x: number, y: number, c: readonly number[], a = 255): void {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
  const o = (iy * size + ix) * 4;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a;
}

/** Fill an RGBA8 buffer (size×size, row 0 = north/top) with the minimap picture. */
export function fillMinimap(buf: Uint8Array, m: MiniInput): void {
  const n = m.size;
  for (let i = 0; i < n * n; i++) {
    const o = i * 4;
    let c: readonly number[];
    if (!m.explored[i]) c = MINI_COLORS.fog;
    else {
      const b = m.biome[i] as keyof typeof MINI_COLORS;
      c = MINI_COLORS[b] ?? MINI_COLORS.meadow;
      if (m.light[i] === 2 && b !== 'water') {
        // lit tiles get a warm tint so the light territory reads on the minimap
        c = [Math.min(255, (c[0] * 3 + MINI_COLORS.lit[0]) >> 2), Math.min(255, (c[1] * 3 + MINI_COLORS.lit[1]) >> 2), Math.min(255, (c[2] * 3 + MINI_COLORS.lit[2]) >> 2)];
      } else if (m.night && m.light[i] === 0) {
        c = [c[0] >> 1, c[1] >> 1, c[2] >> 1];
      }
    }
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
  }
  for (const p of m.pois) if (m.explored[Math.floor(p.y) * n + Math.floor(p.x)]) put(buf, n, p.x, p.y, MINI_COLORS.poi);
  for (const b of m.buildings) for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) put(buf, n, b.x + x, b.y + y, b.id === 'hearth' ? MINI_COLORS.hearth : MINI_COLORS.building);
  for (const r of m.rifts) if (r.active) { put(buf, n, r.x, r.y, MINI_COLORS.rift); put(buf, n, r.x + 1, r.y, MINI_COLORS.rift); put(buf, n, r.x, r.y + 1, MINI_COLORS.rift); put(buf, n, r.x + 1, r.y + 1, MINI_COLORS.rift); }
  if (m.night) for (const e of m.enemies) put(buf, n, e.x, e.y, MINI_COLORS.enemy);
  for (const h of m.heroes) put(buf, n, h.x, h.y, h.leader ? MINI_COLORS.leader : MINI_COLORS.hero);
}

export interface EdgeArrow { x: number; y: number; angle: number; onScreen: boolean }
/**
 * Place an arrow on the screen edge pointing at a target given in screen space (origin bottom-left).
 * `inset` = rect inside which arrows are drawn (safe area minus margins). angle in degrees, 0 = pointing right (+x).
 */
export function edgeArrow(target: V2, inset: { x: number; y: number; w: number; h: number }): EdgeArrow {
  const cx = inset.x + inset.w / 2, cy = inset.y + inset.h / 2;
  const dx = target.x - cx, dy = target.y - cy;
  const onScreen = target.x >= inset.x && target.x <= inset.x + inset.w && target.y >= inset.y && target.y <= inset.y + inset.h;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (onScreen) return { x: target.x, y: target.y, angle, onScreen };
  const sx = dx === 0 ? Infinity : (inset.w / 2) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (inset.h / 2) / Math.abs(dy);
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k, angle, onScreen };
}
