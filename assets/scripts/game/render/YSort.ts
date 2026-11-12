// Y-sorting by tile-row buckets (SPEC §13.3): one parent node per map row inside the entity layer, in ascending
// row order; an entity is re-parented when its feet cross into another row. Rows further down the screen draw later.
import type { Node } from 'cc';
import { mkNode } from './Nodes';
import { rowOf } from '../logic/sprites';

export class YSort {
  readonly rows: Node[] = [];
  constructor(readonly layer: Node, readonly mapSize: number) {
    // one extra row above/below for things standing on the island rim
    for (let r = 0; r < mapSize; r++) this.rows.push(mkNode(`row${r}`, layer));
  }
  /** Put `node` into the bucket of the row containing feetY (tile units). */
  place(node: Node, feetY: number): void {
    const row = this.rows[rowOf(feetY, this.mapSize)];
    if (node.parent !== row) node.setParent(row, false);
  }
}
