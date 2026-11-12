// Spatial queries over enemies (via the spatial hash rebuilt each step).
import { type World, type EnemyX } from './World';

export function forEnemiesInRange(w: World, x: number, y: number, r: number, fn: (e: EnemyX) => void): void {
  const arr = w.s.enemies as EnemyX[];
  const r2 = r * r;
  w.ehash.query(x, y, r + 1.2, (i) => {
    const e = arr[i];
    if (!e || e.dead) return;
    const rr = r + e.radius;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy <= Math.max(r2, rr * rr)) fn(e);
  });
}

export function nearestEnemy(w: World, x: number, y: number, r: number, pred?: (e: EnemyX) => boolean): EnemyX | null {
  let best: EnemyX | null = null, bd = Infinity;
  forEnemiesInRange(w, x, y, r, (e) => {
    if (pred && !pred(e)) return;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd || (d === bd && best && e.uid < best.uid)) { bd = d; best = e; }
  });
  return best;
}

export function anyEnemyNear(w: World, x: number, y: number, r: number): boolean {
  let found = false;
  forEnemiesInRange(w, x, y, r, () => { found = true; });
  return found;
}
