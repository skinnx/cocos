// Floating virtual joystick (SPEC §3): appears under the thumb anywhere in the lower 65% of the screen; the leader
// walks in the drag direction with speed proportional to deflection (12% dead-zone). Sends `move` commands only when
// the direction changes noticeably, and {0,0} on release.
import type { Node } from 'cc';
import type { Ctx } from '../Ctx';
import { inJoystickZone, joystickDir, knobOffset } from '../logic/joystick';
import { mkNode, SpriteHandle } from '../render/Nodes';

export class Joystick {
  readonly node: Node;
  private base: SpriteHandle;
  private knob: SpriteHandle;
  private origin: { x: number; y: number } | null = null;
  private last = { x: 0, y: 0 };
  private keys = { x: 0, y: 0 };
  radius = 26;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('joystick', parent);
    this.base = new SpriteHandle('base', this.node, 'ui_joy_base').anchor(0.5, 0.5).alpha(200);
    this.knob = new SpriteHandle('knob', this.node, 'ui_joy_knob').anchor(0.5, 0.5);
    this.radius = Math.max(16, Math.round(this.base.w / 2));
    this.node.active = false;
  }

  get active(): boolean { return !!this.origin; }
  canStart(y: number): boolean { return inJoystickZone(y, this.ctx.layout.H); }

  start(x: number, y: number): void {
    this.origin = { x, y };
    this.node.active = true;
    this.base.pos(Math.round(x), Math.round(y));
    this.knob.pos(Math.round(x), Math.round(y));
  }
  move(x: number, y: number): void {
    if (!this.origin) return;
    const dx = x - this.origin.x, dy = y - this.origin.y;
    const k = knobOffset(dx, dy, this.radius);
    this.knob.pos(Math.round(this.origin.x + k.x), Math.round(this.origin.y + k.y));
    this.send(joystickDir(dx, dy, this.radius));
  }
  end(): void {
    this.origin = null;
    this.node.active = false;
    this.send(this.keys);
  }
  /** Keyboard direction for desktop testing (WASD / arrows). */
  setKeys(d: { x: number; y: number }): void {
    this.keys = d;
    if (!this.origin) this.send(d);
  }
  private send(d: { x: number; y: number }): void {
    if (Math.abs(d.x - this.last.x) < 0.04 && Math.abs(d.y - this.last.y) < 0.04 && !(d.x === 0 && d.y === 0 && (this.last.x || this.last.y))) return;
    this.last = { x: d.x, y: d.y };
    this.ctx.cmd({ t: 'move', dir: { x: d.x, y: d.y } });
  }
  /** Current direction (camera look-ahead). */
  get dir(): { x: number; y: number } { return this.last; }
  reset(): void { this.origin = null; this.node.active = false; this.last = { x: 0, y: 0 }; }
}
