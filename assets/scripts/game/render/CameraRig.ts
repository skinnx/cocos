// Pixel-perfect camera (SPEC §3): the world root node is scaled so 1 art px = n device px (n integer), positioned so
// the camera centre is at the screen centre, snapped to whole device pixels. Follows the leader with 1.5-tile
// look-ahead and 0.15 s smoothing, supports free pan (build mode), pinch zoom over 3 integer steps and shake.
import { screen, view, type Node } from 'cc';
import {
  basePixelScale, clampCamera, designPerArtPx, devicePerDesign, lookAhead, screenToTile, shakeOffset,
  smoothFactor, snapToDevice, tileToScreen, TILE, zoomSteps, type V2,
} from '../logic/camera';

export class CameraRig {
  /** camera centre in tiles (core space, y down) */
  cam: V2 = { x: 28, y: 28 };
  private target: V2 = { x: 28, y: 28 };
  zoomIndex = 1;
  n = 3;               // current device px per art px
  s = 1;               // design units per art px
  dpd = 1;             // device px per design unit
  visW = 720; visH = 1280;
  private shakeT = 0; private shakeDur = 0; private shakeAmp = 0; private t = 0;
  follow = true;
  mapSize = 56;

  constructor(readonly root: Node) {}

  /** Re-read the screen size; returns true when the view metrics changed. */
  measure(): boolean {
    const vis = view.getVisibleSize();
    const win = screen.windowSize;
    const devW = Math.max(1, win.width);
    const steps = zoomSteps(basePixelScale(devW));
    const n = steps[this.zoomIndex];
    const s = designPerArtPx(n, devW, vis.width);
    const changed = n !== this.n || Math.abs(s - this.s) > 1e-6 || vis.width !== this.visW || vis.height !== this.visH;
    this.n = n; this.s = s; this.dpd = devicePerDesign(devW, vis.width); this.visW = vis.width; this.visH = vis.height;
    return changed;
  }

  setZoom(index: number): void { this.zoomIndex = Math.max(0, Math.min(2, index)); this.measure(); }

  /** Visible size in tiles. */
  get viewTiles(): V2 { return { x: this.visW / (this.s * TILE), y: this.visH / (this.s * TILE) }; }

  /** Follow a world point (tiles) with look-ahead along `dir` (|dir| <= 1). */
  track(p: V2, dir: V2): void {
    const la = lookAhead(dir);
    this.target = { x: p.x + la.x, y: p.y + la.y };
  }
  /** Jump/aim to a point (tiles). */
  focus(p: V2, snap = false): void { this.target = { x: p.x, y: p.y }; if (snap) this.cam = { ...this.target }; }
  /** Free pan by a screen-space delta (design units). */
  panBy(dxDesign: number, dyDesign: number): void {
    this.cam = { x: this.cam.x - dxDesign / (this.s * TILE), y: this.cam.y + dyDesign / (this.s * TILE) };
    this.target = { ...this.cam };
  }
  panTiles(dx: number, dy: number): void {
    this.cam = { x: this.cam.x + dx, y: this.cam.y + dy };
    this.target = { ...this.cam };
  }

  shake(ampArtPx: number, seconds: number): void {
    if (ampArtPx >= this.shakeAmp * Math.min(1, this.shakeT / Math.max(0.001, this.shakeDur))) {
      this.shakeAmp = ampArtPx; this.shakeT = seconds; this.shakeDur = seconds;
    }
  }

  update(dt: number): void {
    this.t += dt;
    const k = smoothFactor(dt);
    this.cam = { x: this.cam.x + (this.target.x - this.cam.x) * k, y: this.cam.y + (this.target.y - this.cam.y) * k };
    const vt = this.viewTiles;
    this.cam = clampCamera(this.cam, this.mapSize, vt.x, vt.y, 3);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    const sh = shakeOffset(this.t, this.shakeT, this.shakeDur, this.shakeAmp);
    // root position: snapped so every art pixel lands on whole device pixels
    const px = -(this.cam.x * TILE) * this.s + sh.x * this.s;
    const py = (this.cam.y * TILE) * this.s + sh.y * this.s;
    this.root.setScale(this.s, this.s, 1);
    this.root.setPosition(snapToDevice(px, this.dpd), snapToDevice(py, this.dpd), 0);
  }

  /** Screen (UI location, origin bottom-left, design units) → tile coordinates. */
  toTile(sx: number, sy: number): V2 { return screenToTile(sx, sy, this.cam, this.s, this.visW, this.visH); }
  /** Tile coordinates → screen (design units, origin bottom-left). */
  toScreen(tx: number, ty: number): V2 { return tileToScreen(tx, ty, this.cam, this.s, this.visW, this.visH); }

  /** Inclusive tile range covering the view plus a margin. */
  tileRange(margin = 2): { x0: number; y0: number; x1: number; y1: number } {
    const vt = this.viewTiles;
    return {
      x0: Math.floor(this.cam.x - vt.x / 2) - margin, x1: Math.ceil(this.cam.x + vt.x / 2) + margin,
      y0: Math.floor(this.cam.y - vt.y / 2) - margin, y1: Math.ceil(this.cam.y + vt.y / 2) + margin,
    };
  }
}
