// Hand-written subset of the Cocos Creator 3.8 / COCOS 4 runtime API (module 'cc').
// ONLY the members the Emberhold view layer (assets/scripts/game/**) uses are declared, with signatures copied
// from the public engine typings. Delete the `paths` mapping in tsconfig.game.json to typecheck against the real
// engine declarations once the Cocos CLI/engine is installed (docs/CONTRACT.md).
declare module 'cc' {
  export type Constructor<T = unknown> = new (...args: any[]) => T;

  // ── math ─────────────────────────────────────────────────────────────────────
  export class Vec2 {
    static ZERO: Readonly<Vec2>;
    x: number; y: number;
    constructor(x?: number, y?: number);
    set(x?: number, y?: number): Vec2;
  }
  export class Vec3 {
    static ZERO: Readonly<Vec3>;
    static ONE: Readonly<Vec3>;
    x: number; y: number; z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x?: number, y?: number, z?: number): Vec3;
  }
  export class Color {
    static WHITE: Readonly<Color>;
    static BLACK: Readonly<Color>;
    r: number; g: number; b: number; a: number;
    constructor(r?: number, g?: number, b?: number, a?: number);
    constructor(hexString: string);
    set(r?: number, g?: number, b?: number, a?: number): Color;
  }
  export class Rect {
    x: number; y: number; width: number; height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
    contains(point: Vec2): boolean;
  }
  export class Size {
    width: number; height: number;
    constructor(width?: number, height?: number);
  }

  // ── assets ───────────────────────────────────────────────────────────────────
  export class Asset {
    name: string;
    addRef(): Asset;
    decRef(autoRelease?: boolean): Asset;
  }
  export class ImageAsset extends Asset {
    get data(): ArrayBufferView | HTMLCanvasElement | HTMLImageElement | ImageBitmap | null;
    get width(): number;
    get height(): number;
  }
  enum TexFilter { NONE, LINEAR, NEAREST }
  enum TexWrapMode { REPEAT, CLAMP_TO_EDGE, MIRRORED_REPEAT }
  enum TexPixelFormat { RGB888, RGBA8888 }
  export class TextureBase extends Asset {
    static Filter: typeof TexFilter;
    static WrapMode: typeof TexWrapMode;
    static PixelFormat: typeof TexPixelFormat;
    get width(): number;
    get height(): number;
    setFilters(minFilter: TexFilter, magFilter: TexFilter): void;
    setMipFilter(mipFilter: TexFilter): void;
    setWrapMode(wrapS: TexWrapMode, wrapT: TexWrapMode, wrapR?: TexWrapMode): void;
  }
  export class SimpleTexture extends TextureBase {
    uploadData(source: HTMLCanvasElement | HTMLImageElement | ArrayBufferView | ImageBitmap, level?: number, arrayIndex?: number): void;
  }
  export interface ITexture2DCreateInfo {
    width: number; height: number; format?: TexPixelFormat; mipmapLevel?: number; baseLevel?: number; maxLevel?: number;
  }
  export class Texture2D extends SimpleTexture {
    get image(): ImageAsset | null;
    set image(value: ImageAsset | null);
    reset(info: ITexture2DCreateInfo): void;
  }
  export interface ISpriteFrameInitInfo {
    texture?: TextureBase; originalSize?: Size; rect?: Rect; offset?: Vec2; isRotate?: boolean;
    borderTop?: number; borderBottom?: number; borderLeft?: number; borderRight?: number; isFlipUv?: boolean;
  }
  export class SpriteFrame extends Asset {
    get texture(): TextureBase;
    set texture(value: TextureBase);
    get rect(): Rect;
    set rect(value: Rect);
    get originalSize(): Size;
    set originalSize(value: Size);
    get offset(): Vec2;
    set offset(value: Vec2);
    get width(): number;
    get height(): number;
    insetTop: number; insetBottom: number; insetLeft: number; insetRight: number;
    reset(info?: ISpriteFrameInitInfo, clearData?: boolean): void;
  }
  export class JsonAsset extends Asset {
    json: Record<string, any> | null;
  }
  export class AudioClip extends Asset {
    getDuration(): number;
  }
  export namespace AssetManager {
    class Bundle {
      load<T extends Asset>(paths: string, type: Constructor<T> | null, onComplete?: ((err: Error | null, data: T) => void) | null): void;
    }
  }
  export const resources: AssetManager.Bundle;

  // ── scene graph ──────────────────────────────────────────────────────────────
  export class Layers {
    static Enum: {
      readonly NONE: number; readonly IGNORE_RAYCAST: number; readonly GIZMOS: number; readonly EDITOR: number;
      readonly UI_3D: number; readonly SCENE_GIZMO: number; readonly UI_2D: number; readonly PROFILER: number;
      readonly DEFAULT: number; readonly ALL: number;
    };
  }
  export class Node {
    constructor(name?: string);
    name: string;
    get isValid(): boolean;
    get parent(): Node | null;
    set parent(value: Node | null);
    get children(): Node[];
    get active(): boolean;
    set active(isActive: boolean);
    get activeInHierarchy(): boolean;
    get layer(): number;
    set layer(l: number);
    get position(): Readonly<Vec3>;
    set position(val: Readonly<Vec3>);
    get scale(): Readonly<Vec3>;
    set scale(val: Readonly<Vec3>);
    get angle(): number;
    set angle(val: number);
    setPosition(position: Readonly<Vec3>): void;
    setPosition(x: number, y: number, z?: number): void;
    setScale(scale: Readonly<Vec3>): void;
    setScale(x: number, y: number, z?: number): void;
    addChild(child: Node): void;
    removeChild(child: Node): void;
    removeFromParent(): void;
    setParent(value: Node | null, keepWorldTransform?: boolean): void;
    getChildByName(name: string): Node | null;
    setSiblingIndex(index: number): void;
    getSiblingIndex(): number;
    destroy(): boolean;
    destroyAllChildren(): void;
    addComponent<T extends Component>(classConstructor: Constructor<T>): T;
    getComponent<T extends Component>(classConstructor: Constructor<T>): T | null;
  }
  export class Scene extends Node {}

  export class Component {
    get node(): Node;
    get enabled(): boolean;
    set enabled(value: boolean);
    get isValid(): boolean;
    getComponent<T extends Component>(classConstructor: Constructor<T>): T | null;
    addComponent<T extends Component>(classConstructor: Constructor<T>): T;
    protected onLoad?(): void;
    protected start?(): void;
    protected update?(dt: number): void;
    protected lateUpdate?(dt: number): void;
    protected onEnable?(): void;
    protected onDisable?(): void;
    protected onDestroy?(): void;
  }

  export namespace _decorator {
    function ccclass(name?: string): ClassDecorator;
  }

  // ── 2D rendering ─────────────────────────────────────────────────────────────
  export class UITransform extends Component {
    get contentSize(): Readonly<Size>;
    set contentSize(value: Readonly<Size>);
    get width(): number;
    set width(value: number);
    get height(): number;
    set height(value: number);
    get anchorX(): number;
    set anchorX(value: number);
    get anchorY(): number;
    set anchorY(value: number);
    setContentSize(size: Size): void;
    setContentSize(width: number, height: number): void;
    setAnchorPoint(point: Vec2 | Readonly<Vec2> | number, y?: number): void;
  }
  export class UIRenderer extends Component {
    get color(): Readonly<Color>;
    set color(value: Readonly<Color>);
  }
  export class Sprite extends UIRenderer {
    get spriteFrame(): SpriteFrame | null;
    set spriteFrame(value: SpriteFrame | null);
    get type(): Sprite.Type;
    set type(value: Sprite.Type);
    get sizeMode(): Sprite.SizeMode;
    set sizeMode(value: Sprite.SizeMode);
    get trim(): boolean;
    set trim(value: boolean);
    get fillType(): Sprite.FillType;
    set fillType(value: Sprite.FillType);
    get fillCenter(): Vec2;
    set fillCenter(value: Vec2);
    get fillStart(): number;
    set fillStart(value: number);
    get fillRange(): number;
    set fillRange(value: number);
  }
  export namespace Sprite {
    enum Type { SIMPLE, SLICED, TILED, FILLED }
    enum SizeMode { CUSTOM, TRIMMED, RAW }
    enum FillType { HORIZONTAL, VERTICAL, RADIAL }
  }
  export class UIOpacity extends Component {
    get opacity(): number;
    set opacity(value: number);
  }

  // ── audio ────────────────────────────────────────────────────────────────────
  export class AudioSource extends Component {
    get clip(): AudioClip | null;
    set clip(val: AudioClip | null);
    get loop(): boolean;
    set loop(val: boolean);
    get playOnAwake(): boolean;
    set playOnAwake(val: boolean);
    get volume(): number;
    set volume(val: number);
    get playing(): boolean;
    play(): void;
    pause(): void;
    stop(): void;
    playOneShot(clip: AudioClip, volumeScale?: number): void;
  }

  // ── director / platform ──────────────────────────────────────────────────────
  export class Director {
    static readonly EVENT_AFTER_SCENE_LAUNCH: string;
    on(type: string, callback: (...args: any[]) => void, target?: unknown): void;
    getScene(): Scene | null;
  }
  export const director: Director;

  export class ResolutionPolicy {
    static EXACT_FIT: number;
    static NO_BORDER: number;
    static SHOW_ALL: number;
    static FIXED_HEIGHT: number;
    static FIXED_WIDTH: number;
  }
  export class View {
    setDesignResolutionSize(width: number, height: number, resolutionPolicy: ResolutionPolicy | number): void;
    getDesignResolutionSize(): Size;
    getVisibleSize(): Size;
    getVisibleOrigin(): Vec2;
  }
  export const view: View;

  export const screen: {
    get windowSize(): Size;
    get devicePixelRatio(): number;
  };

  export const sys: {
    localStorage: Storage;
    isBrowser: boolean;
    isMobile: boolean;
    getSafeAreaRect(): Rect;
    now(): number;
  };

  // ── input ────────────────────────────────────────────────────────────────────
  export class Touch {
    getID(): number;
    getUILocation(out?: Vec2): Vec2;
  }
  export class Event {
    type: string;
  }
  export class EventTouch extends Event {
    touch: Touch | null;
    getID(): number | null;
    getUILocation(out?: Vec2): Vec2;
    getTouches(): Touch[];
    getAllTouches(): Touch[];
  }
  export class EventMouse extends Event {
    static BUTTON_LEFT: number;
    static BUTTON_RIGHT: number;
    getButton(): number;
    getUILocation(out?: Vec2): Vec2;
    getScrollY(): number;
  }
  export enum KeyCode {
    SPACE, ESCAPE, ARROW_LEFT, ARROW_UP, ARROW_RIGHT, ARROW_DOWN,
    KEY_A, KEY_B, KEY_D, KEY_H, KEY_S, KEY_W, KEY_Z,
  }
  export class EventKeyboard extends Event {
    keyCode: KeyCode;
  }
  enum InputEventType {
    TOUCH_START = 'touch-start', TOUCH_MOVE = 'touch-move', TOUCH_END = 'touch-end', TOUCH_CANCEL = 'touch-cancel',
    MOUSE_DOWN = 'mouse-down', MOUSE_MOVE = 'mouse-move', MOUSE_UP = 'mouse-up', MOUSE_WHEEL = 'mouse-wheel',
    KEY_DOWN = 'keydown', KEY_UP = 'keyup',
  }
  export class Input {
    static EventType: typeof InputEventType;
    on(eventType: InputEventType.TOUCH_START | InputEventType.TOUCH_MOVE | InputEventType.TOUCH_END | InputEventType.TOUCH_CANCEL,
      callback: (event: EventTouch) => void, target?: any): (event: EventTouch) => void;
    on(eventType: InputEventType.MOUSE_DOWN | InputEventType.MOUSE_MOVE | InputEventType.MOUSE_UP | InputEventType.MOUSE_WHEEL,
      callback: (event: EventMouse) => void, target?: any): (event: EventMouse) => void;
    on(eventType: InputEventType.KEY_DOWN | InputEventType.KEY_UP,
      callback: (event: EventKeyboard) => void, target?: any): (event: EventKeyboard) => void;
    off(eventType: InputEventType, callback?: (...args: any[]) => void, target?: any): void;
  }
  export const input: Input;
}
