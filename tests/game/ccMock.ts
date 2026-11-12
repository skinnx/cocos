// Minimal in-memory stand-in for the 'cc' runtime used by tests/game/smoke.test.ts. It mirrors only the surface
// declared in types/cc-shim.d.ts so the whole view layer can be driven headless in Node (no rendering).
import { readFileSync, existsSync } from 'node:fs';

export type Constructor<T = unknown> = new (...args: any[]) => T;

export class Vec2 { static ZERO = new Vec2(); constructor(public x = 0, public y = 0) {} set(x = 0, y = 0) { this.x = x; this.y = y; return this; } }
export class Vec3 {
  static ZERO = new Vec3(); static ONE = new Vec3(1, 1, 1);
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this; }
}
export class Color {
  static WHITE = new Color(255, 255, 255, 255); static BLACK = new Color(0, 0, 0, 255);
  r: number; g: number; b: number; a: number;
  constructor(r: number | string = 255, g = 255, b = 255, a = 255) { this.r = typeof r === 'number' ? r : 255; this.g = g; this.b = b; this.a = a; }
  set(r = 255, g = 255, b = 255, a = 255) { this.r = r; this.g = g; this.b = b; this.a = a; return this; }
}
export class Rect { constructor(public x = 0, public y = 0, public width = 0, public height = 0) {} contains(p: Vec2) { return p.x >= this.x && p.y >= this.y && p.x <= this.x + this.width && p.y <= this.y + this.height; } }
export class Size { constructor(public width = 0, public height = 0) {} }

export class Asset { name = ''; addRef() { return this; } decRef() { return this; } }
export class ImageAsset extends Asset { data: unknown = null; width = 0; height = 0; }
const Filter = { NONE: 0, LINEAR: 1, NEAREST: 2 } as const;
const WrapMode = { REPEAT: 0, CLAMP_TO_EDGE: 1, MIRRORED_REPEAT: 2 } as const;
const PixelFormat = { RGB888: 0, RGBA8888: 1 } as const;
export class TextureBase extends Asset {
  static Filter = Filter; static WrapMode = WrapMode; static PixelFormat = PixelFormat;
  width = 0; height = 0; minFilter = -1; magFilter = -1; mipFilter = -1;
  setFilters(a: number, b: number) { this.minFilter = a; this.magFilter = b; }
  setMipFilter(m: number) { this.mipFilter = m; }
  setWrapMode() { /* noop */ }
}
export class SimpleTexture extends TextureBase {
  uploads = 0;
  data: Uint8Array | null = null;
  uploadData(src: ArrayBufferView) {
    if (src.byteLength < this.width * this.height * 4) throw new Error('uploadData: buffer too small');
    this.uploads++;
    this.data = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  }
}
export class Texture2D extends SimpleTexture {
  image: ImageAsset | null = null;
  reset(info: { width: number; height: number }) { this.width = info.width; this.height = info.height; }
}
export class SpriteFrame extends Asset {
  texture: TextureBase | null = null; rect = new Rect(); originalSize = new Size(); offset = new Vec2();
  insetTop = 0; insetBottom = 0; insetLeft = 0; insetRight = 0;
  get width() { return this.rect.width; } get height() { return this.rect.height; }
  reset(info: { texture?: TextureBase; rect?: Rect; originalSize?: Size; offset?: Vec2 } = {}) {
    if (info.texture) this.texture = info.texture; if (info.rect) this.rect = info.rect;
    if (info.originalSize) this.originalSize = info.originalSize; if (info.offset) this.offset = info.offset;
    if (this.texture && (this.rect.x + this.rect.width > this.texture.width + 1e-6 || this.rect.y + this.rect.height > this.texture.height + 1e-6) && this.texture.width > 0) {
      throw new Error(`SpriteFrame rect outside texture: ${JSON.stringify(this.rect)}`);
    }
  }
}
export class JsonAsset extends Asset { json: Record<string, any> | null = null; }
export class AudioClip extends Asset { getDuration() { return 0.2; } }

export const loaded: string[] = [];
export let atlasDecoder: (() => { data: Uint8Array }) | null = null;
export function setAtlasDecoder(f: () => { data: Uint8Array }): void { atlasDecoder = f; }
export namespace AssetManager {
  export class Bundle {
    load<T extends Asset>(path: string, type: Constructor<T> | null, cb?: ((err: Error | null, data: T) => void) | null): void {
      loaded.push(path);
      const done = (e: Error | null, d: unknown) => cb?.(e, d as T);
      if (type === (JsonAsset as unknown)) {
        const file = `assets/resources/${path}.json`;
        if (!existsSync(file)) { done(new Error(`missing ${file}`), null); return; }
        const j = new JsonAsset(); j.json = JSON.parse(readFileSync(file, 'utf8')); done(null, j); return;
      }
      if (type === (Texture2D as unknown)) {
        const t = new Texture2D();
        const a = JSON.parse(readFileSync('assets/resources/art/atlas.json', 'utf8'));
        t.width = a.size[0]; t.height = a.size[1];
        if (atlasDecoder) t.data = atlasDecoder().data;
        done(null, t); return;
      }
      if (type === (AudioClip as unknown)) { const c = new AudioClip(); c.name = path.split('/').pop()!; done(null, c); return; }
      done(new Error(`unsupported ${path}`), null);
    }
  }
}
export const resources = new AssetManager.Bundle();

export class Layers { static Enum = { NONE: 0, IGNORE_RAYCAST: 1 << 20, GIZMOS: 1 << 21, EDITOR: 1 << 22, UI_3D: 1 << 23, SCENE_GIZMO: 1 << 24, UI_2D: 1 << 25, PROFILER: 1 << 28, DEFAULT: 1 << 30, ALL: 0xffffffff }; }

export let nodeCount = 0;
export class Node {
  name: string; parent: Node | null = null; children: Node[] = []; private _active = true; layer = Layers.Enum.DEFAULT;
  position = new Vec3(); scale = new Vec3(1, 1, 1); angle = 0; isValid = true;
  private comps: Component[] = [];
  constructor(name = '') { this.name = name; nodeCount++; }
  get active() { return this._active; } set active(v: boolean) { this._active = v; }
  get activeInHierarchy(): boolean { return this._active && (!this.parent || this.parent.activeInHierarchy); }
  setPosition(x: number | Vec3, y = 0, z = 0) {
    if (typeof x !== 'number') { this.position = new Vec3(x.x, x.y, x.z); return; }
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`non-finite position on ${this.name}: ${x},${y}`);
    this.position = new Vec3(x, y, z);
  }
  setScale(x: number | Vec3, y = 1, z = 1) {
    if (typeof x !== 'number') { this.scale = new Vec3(x.x, x.y, x.z); return; }
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`non-finite scale on ${this.name}`);
    this.scale = new Vec3(x, y, z);
  }
  addChild(c: Node) { c.setParent(this); }
  removeChild(c: Node) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; }
  removeFromParent() { this.parent?.removeChild(this); }
  setParent(p: Node | null) { if (this.parent) this.parent.removeChild(this); this.parent = p; if (p) p.children.push(this); }
  getChildByName(n: string) { return this.children.find((c) => c.name === n) ?? null; }
  setSiblingIndex(i: number) { const p = this.parent; if (!p) return; p.children.splice(p.children.indexOf(this), 1); p.children.splice(Math.max(0, Math.min(i, p.children.length)), 0, this); }
  getSiblingIndex() { return this.parent ? this.parent.children.indexOf(this) : 0; }
  destroy() { this.isValid = false; this.removeFromParent(); return true; }
  destroyAllChildren() { for (const c of [...this.children]) c.destroy(); }
  addComponent<T extends Component>(cls: Constructor<T>): T {
    const c = new cls(); (c as any)._node = this; this.comps.push(c);
    if ((c instanceof UIRenderer) && !this.getComponent(UITransform)) this.addComponent(UITransform);
    return c;
  }
  getComponent<T extends Component>(cls: Constructor<T>): T | null { return (this.comps.find((c) => c instanceof cls) as T) ?? null; }
}
export class Scene extends Node {}
export class Component {
  _node!: Node; enabled = true; isValid = true;
  get node() { return this._node; }
  getComponent<T extends Component>(cls: Constructor<T>) { return this._node.getComponent(cls); }
  addComponent<T extends Component>(cls: Constructor<T>) { return this._node.addComponent(cls); }
}
export const _decorator = { ccclass: (_name?: string) => (t: unknown) => t };

export class UITransform extends Component {
  contentSize = new Size(); anchorX = 0.5; anchorY = 0.5;
  get width() { return this.contentSize.width; } get height() { return this.contentSize.height; }
  setContentSize(w: number | Size, h = 0) {
    const s = typeof w === 'number' ? new Size(w, h) : w;
    if (!Number.isFinite(s.width) || !Number.isFinite(s.height)) throw new Error('non-finite content size');
    this.contentSize = s;
  }
  setAnchorPoint(x: number | Vec2, y = 0) { if (typeof x === 'number') { this.anchorX = x; this.anchorY = y; } else { this.anchorX = x.x; this.anchorY = x.y; } }
}
export class UIRenderer extends Component {
  private _color = new Color();
  get color(): Color { return this._color; }
  set color(c: Color) { this._color = new Color(c.r, c.g, c.b, c.a); } // engine copies the value
}
export class Sprite extends UIRenderer {
  static Type = { SIMPLE: 0, SLICED: 1, TILED: 2, FILLED: 3 }; static SizeMode = { CUSTOM: 0, TRIMMED: 1, RAW: 2 };
  static FillType = { HORIZONTAL: 0, VERTICAL: 1, RADIAL: 2 };
  spriteFrame: SpriteFrame | null = null; type = 0; sizeMode = 1; trim = true; fillType = 0; fillCenter = new Vec2(); fillStart = 0; fillRange = 0;
}
export class UIOpacity extends Component { opacity = 255; }
export const audioLog: string[] = [];
export class AudioSource extends Component {
  clip: AudioClip | null = null; loop = false; playOnAwake = true; volume = 1; playing = false;
  play() { this.playing = true; if (this.clip && !this.loop) audioLog.push(this.clip.name); }
  pause() { this.playing = false; } stop() { this.playing = false; }
  playOneShot(c: AudioClip) { audioLog.push(c.name); }
}

type Cb = (...a: any[]) => void;
export class Director {
  static EVENT_AFTER_SCENE_LAUNCH = 'director_after_scene_launch';
  scene: Scene | null = null; private h = new Map<string, Cb[]>();
  on(t: string, cb: Cb) { this.h.set(t, [...(this.h.get(t) ?? []), cb]); }
  emit(t: string) { for (const cb of this.h.get(t) ?? []) cb(); }
  getScene() { return this.scene; }
}
export const director = new Director();
export class ResolutionPolicy { static EXACT_FIT = 0; static NO_BORDER = 1; static SHOW_ALL = 2; static FIXED_HEIGHT = 3; static FIXED_WIDTH = 4; }
export const deviceCfg = { w: 1170, h: 2532 };
export class View {
  design = new Size(720, 1280);
  setDesignResolutionSize(w: number, h: number) { this.design = new Size(w, h); }
  getDesignResolutionSize() { return this.design; }
  getVisibleSize() { return new Size(720, (720 * deviceCfg.h) / deviceCfg.w); }
  getVisibleOrigin() { return new Vec2(); }
}
export const view = new View();
export const screen = { get windowSize() { return new Size(deviceCfg.w, deviceCfg.h); }, get devicePixelRatio() { return 3; } };
const mem = new Map<string, string>();
export const sys = {
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } } as unknown as Storage,
  isBrowser: false, isMobile: true,
  getSafeAreaRect() { const v = view.getVisibleSize(); return new Rect(0, 60, v.width, v.height - 150); },
  now: () => Date.now(),
};

export class Touch { constructor(public id: number, public x: number, public y: number) {} getID() { return this.id; } getUILocation() { return new Vec2(this.x, this.y); } }
export class Event { type = ''; }
export class EventTouch extends Event {
  touch: Touch | null;
  constructor(public t: Touch, public all: Touch[] = [t]) { super(); this.touch = t; }
  getID() { return this.t.id; } getUILocation() { return new Vec2(this.t.x, this.t.y); }
  getTouches() { return [this.t]; } getAllTouches() { return this.all; }
}
export class EventMouse extends Event { static BUTTON_LEFT = 0; static BUTTON_RIGHT = 2; getButton() { return 0; } getUILocation() { return new Vec2(); } getScrollY() { return 0; } }
export enum KeyCode { SPACE = 32, ESCAPE = 27, ARROW_LEFT = 37, ARROW_UP = 38, ARROW_RIGHT = 39, ARROW_DOWN = 40, KEY_A = 65, KEY_B = 66, KEY_D = 68, KEY_H = 72, KEY_S = 83, KEY_W = 87, KEY_Z = 90 }
export class EventKeyboard extends Event { keyCode: KeyCode = KeyCode.SPACE; }
export class Input {
  static EventType = {
    TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel',
    MOUSE_DOWN: 'mouse-down', MOUSE_MOVE: 'mouse-move', MOUSE_UP: 'mouse-up', MOUSE_WHEEL: 'mouse-wheel', KEY_DOWN: 'keydown', KEY_UP: 'keyup',
  };
  private h = new Map<string, Array<[Cb, unknown]>>();
  on(t: string, cb: Cb, target?: unknown) { this.h.set(t, [...(this.h.get(t) ?? []), [cb, target]]); return cb; }
  off(t: string, cb?: Cb) { this.h.set(t, (this.h.get(t) ?? []).filter(([c]) => c !== cb)); }
  emit(t: string, e: unknown) { for (const [cb, target] of this.h.get(t) ?? []) cb.call(target, e); }
}
export const input = new Input();
