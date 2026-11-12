// Routes raw touches (and mouse / keyboard on desktop) to: UI hits first, then two-finger pan + pinch zoom, then the
// build gestures (build mode / dusk) or the floating joystick (lower 65% of the screen). Coordinates arrive as UI
// locations (design units, origin bottom-left) and are converted to UI px.
import { EventKeyboard, EventMouse, EventTouch, input, Input, KeyCode } from 'cc';
import type { Ctx } from '../Ctx';
import { pinchStep } from '../logic/camera';
import { isTap } from '../logic/gestures';
import { keysDir } from '../logic/joystick';
import { uiInput, type Hit } from '../ui/UiKit';
import type { BuildGestures } from './BuildGestures';
import type { Joystick } from './Joystick';

type Owner = 'ui' | 'joy' | 'build' | 'multi' | 'none';
interface Ptr { x: number; y: number; sx: number; sy: number; t0: number; owner: Owner; hit: Hit | null }

export class InputRouter {
  private ptrs = new Map<number, Ptr>();
  private pinch: { d0: number; zoom0: number; mx: number; my: number } | null = null;
  private lastTouchAt = -1e9;
  private keys = { up: false, down: false, left: false, right: false };
  /** Called on the first user gesture (audio unlock). */
  onFirstInput: () => void = () => undefined;
  onKey: (k: KeyCode) => void = () => undefined;
  private first = false;

  constructor(readonly ctx: Ctx, readonly joy: Joystick, readonly build: BuildGestures, readonly worldActive: () => boolean,
    readonly buildActive: () => boolean) {
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
    input.on(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.mouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.mouseUp, this);
    input.on(Input.EventType.MOUSE_WHEEL, this.wheel, this);
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.KEY_UP, this.keyUp, this);
  }

  destroy(): void {
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
    input.off(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.mouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.mouseUp, this);
    input.off(Input.EventType.MOUSE_WHEEL, this.wheel, this);
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.KEY_UP, this.keyUp, this);
  }

  private toUi(x: number, y: number): { x: number; y: number } {
    const s = this.ctx.layout.uiS;
    return { x: x / s, y: y / s };
  }

  // ── touch ─────────────────────────────────────────────────────────────────
  private touchStart(e: EventTouch): void {
    this.lastTouchAt = this.ctx.time;
    const id = e.getID() ?? 0;
    const p = e.getUILocation();
    this.down(id, p.x, p.y);
  }
  private touchMove(e: EventTouch): void {
    this.lastTouchAt = this.ctx.time;
    for (const t of e.getTouches()) { const p = t.getUILocation(); this.move(t.getID(), p.x, p.y); }
  }
  private touchEnd(e: EventTouch): void {
    this.lastTouchAt = this.ctx.time;
    const id = e.getID() ?? 0;
    const p = e.getUILocation();
    this.up(id, p.x, p.y);
  }
  // ── mouse (desktop) — ignored right after real touches to avoid double handling ──
  private mouseOk(): boolean { return this.ctx.time - this.lastTouchAt > 0.6; }
  private mouseDown(e: EventMouse): void { if (!this.mouseOk() || e.getButton() !== EventMouse.BUTTON_LEFT) return; const p = e.getUILocation(); this.down(-1, p.x, p.y); }
  private mouseMove(e: EventMouse): void { if (!this.mouseOk() || !this.ptrs.has(-1)) return; const p = e.getUILocation(); this.move(-1, p.x, p.y); }
  private mouseUp(e: EventMouse): void { if (!this.mouseOk() || !this.ptrs.has(-1)) return; const p = e.getUILocation(); this.up(-1, p.x, p.y); }
  private wheel(e: EventMouse): void {
    if (!this.worldActive()) return;
    const dz = e.getScrollY() > 0 ? 1 : -1;
    this.ctx.cam.setZoom(this.ctx.cam.zoomIndex + dz);
  }
  private keyDown(e: EventKeyboard): void { this.key(e.keyCode, true); this.onKey(e.keyCode); }
  private keyUp(e: EventKeyboard): void { this.key(e.keyCode, false); }
  private key(k: KeyCode, on: boolean): void {
    if (k === KeyCode.KEY_W || k === KeyCode.ARROW_UP) this.keys.up = on;
    else if (k === KeyCode.KEY_S || k === KeyCode.ARROW_DOWN) this.keys.down = on;
    else if (k === KeyCode.KEY_A || k === KeyCode.ARROW_LEFT) this.keys.left = on;
    else if (k === KeyCode.KEY_D || k === KeyCode.ARROW_RIGHT) this.keys.right = on;
    else return;
    if (this.worldActive()) this.joy.setKeys(keysDir(this.keys.up, this.keys.down, this.keys.left, this.keys.right));
  }

  // ── routing ───────────────────────────────────────────────────────────────
  private down(id: number, dx: number, dy: number): void {
    if (!this.first) { this.first = true; this.onFirstInput(); }
    const { x, y } = this.toUi(dx, dy);
    const p: Ptr = { x, y, sx: x, sy: y, t0: this.ctx.time, owner: 'none', hit: null };
    this.ptrs.set(id, p);
    const hit = uiInput.find(x, y);
    if (hit) { p.owner = 'ui'; p.hit = hit; hit.onDown?.(x, y); return; }
    if (!this.worldActive()) return;
    const world = [...this.ptrs.values()].filter((q) => q.owner !== 'ui');
    if (world.length >= 2) { this.startMulti(world); return; }
    if (this.buildActive()) { p.owner = 'build'; this.build.down(x, y); return; }
    if (this.joy.canStart(y)) { p.owner = 'joy'; this.joy.start(x, y); }
  }

  private startMulti(world: Ptr[]): void {
    for (const q of world) {
      if (q.owner === 'joy') this.joy.end();
      if (q.owner === 'build') this.build.reset();
      q.owner = 'multi';
    }
    const [a, b] = world;
    this.pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom0: this.ctx.cam.zoomIndex, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  private move(id: number, dx: number, dy: number): void {
    const p = this.ptrs.get(id);
    if (!p) return;
    const { x, y } = this.toUi(dx, dy);
    p.x = x; p.y = y;
    switch (p.owner) {
      case 'ui': p.hit?.onMove?.(x, y); break;
      case 'joy': this.joy.move(x, y); break;
      case 'build': this.build.move(x, y); break;
      case 'multi': {
        const m = [...this.ptrs.values()].filter((q) => q.owner === 'multi');
        if (m.length < 2 || !this.pinch) break;
        const [a, b] = m;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const s = this.ctx.layout.uiS;
        this.ctx.cam.panBy((mx - this.pinch.mx) * s, (my - this.pinch.my) * s);
        this.pinch.mx = mx; this.pinch.my = my;
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d0;
        const z = pinchStep(this.pinch.zoom0, ratio);
        if (z !== this.ctx.cam.zoomIndex) this.ctx.cam.setZoom(z);
        this.ctx.cam.follow = false;
        break;
      }
      default: break;
    }
  }

  private up(id: number, dx: number, dy: number): void {
    const p = this.ptrs.get(id);
    if (!p) return;
    const { x, y } = this.toUi(dx, dy);
    this.ptrs.delete(id);
    switch (p.owner) {
      case 'ui': {
        const h = p.hit!;
        const inside = uiInput.find(x, y) === h;
        if (h.onUp) h.onUp(x, y, inside); else if (inside) h.onTap?.();
        break;
      }
      case 'joy': this.joy.end(); break;
      case 'build': this.build.up(x, y, isTap(Math.hypot(x - p.sx, y - p.sy) * this.ctx.layout.uiS, this.ctx.time - p.t0)); break;
      case 'multi':
        if (![...this.ptrs.values()].some((q) => q.owner === 'multi')) this.pinch = null;
        for (const q of this.ptrs.values()) if (q.owner === 'multi') q.owner = 'none';
        this.pinch = null;
        break;
      default: break;
    }
  }

  /** Cancel every gesture (screen change / pause). */
  cancelAll(): void {
    for (const p of this.ptrs.values()) {
      if (p.owner === 'joy') this.joy.end();
      if (p.owner === 'ui') p.hit?.onUp?.(p.x, p.y, false);
    }
    this.ptrs.clear(); this.pinch = null;
    this.build.reset();
  }
}
