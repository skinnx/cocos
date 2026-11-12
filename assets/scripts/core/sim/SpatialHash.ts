// Uniform-grid spatial hash over unit positions (rebuilt every step). Stores indices into a source array.
export class SpatialHash {
  readonly cell: number; readonly n: number;
  head: Int32Array; next: Int32Array;
  constructor(size: number, cell = 2, cap = 1024) {
    this.cell = cell; this.n = Math.ceil(size / cell);
    this.head = new Int32Array(this.n * this.n).fill(-1);
    this.next = new Int32Array(cap);
  }
  rebuild(items: ReadonlyArray<{ x: number; y: number }>): void {
    this.head.fill(-1);
    if (this.next.length < items.length) this.next = new Int32Array(items.length * 2);
    const n = this.n, c = this.cell;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      let cx = Math.floor(it.x / c), cy = Math.floor(it.y / c);
      if (cx < 0) cx = 0; else if (cx >= n) cx = n - 1;
      if (cy < 0) cy = 0; else if (cy >= n) cy = n - 1;
      const k = cy * n + cx;
      this.next[i] = this.head[k]; this.head[k] = i;
    }
  }
  /** Calls fn(index) for every item whose cell intersects the query circle's bounding box (caller filters by distance). */
  query(x: number, y: number, r: number, fn: (i: number) => void): void {
    const n = this.n, c = this.cell;
    const x0 = Math.max(0, Math.floor((x - r) / c)), x1 = Math.min(n - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)), y1 = Math.min(n - 1, Math.floor((y + r) / c));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = this.head[cy * n + cx]; i !== -1; i = this.next[i]) fn(i);
    }
  }
}
