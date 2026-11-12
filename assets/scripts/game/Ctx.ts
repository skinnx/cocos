// Shared context handed to every view/UI module by GameRoot (no globals besides the atlas).
import type { Command, Game, GameState, Settings } from '../core/api';
import type { CameraRig } from './render/CameraRig';
import type { EntityView } from './render/EntityView';
import type { FxPool } from './render/FxPool';

export type ScreenId = 'loading' | 'title' | 'game';
/** Full-screen panels opened from the bottom bar / HUD (one at a time). */
export type PanelId = 'hero' | 'village' | 'book' | 'map' | 'dock' | 'building' | 'settings' | 'pause';

export interface Layout {
  /** UI size in UI px (origin bottom-left) */
  W: number; H: number;
  /** safe-area insets in UI px */
  top: number; bottom: number; left: number; right: number;
  /** design units per UI px */
  uiS: number;
}

export interface Ctx {
  game: Game | null;
  settings: Settings;
  readonly layout: Layout;
  cam: CameraRig;
  fx: FxPool;
  ents: EntityView;
  /** view clock (s since boot) */
  time: number;
  state(): GameState;
  cmd(c: Command): void;
  /** Play the first available SFX among `names`. */
  sfx(names: string | readonly string[], priority?: number): void;
  vibrate(ms: number): void;
  toast(text: string): void;
  saveSettings(): void;
  /** Persist the Hold now if the phase allows it (§13.7). */
  requestSave(): void;
  go(s: ScreenId): void;
  open(p: PanelId, section?: string): void;
  closePanel(): void;
  readonly panel: PanelId | null;
  /** tile → UI px */
  tileToUi(tx: number, ty: number): { x: number; y: number };
  /** UI px → tile */
  uiToTile(x: number, y: number): { x: number; y: number };
  /** real time (ms since epoch) — the only clock the view hands to the core */
  now(): number;
  enterHold(): void;
  quitToTitle(): void;
  pause(on: boolean): void;
  readonly paused: boolean;
  exportSave(): void;
  importSave(): void;
  eraseAll(): void;
  /** Building panel → Move: enter build mode with this building picked up. */
  startRelocate(uid: number): void;
  /** Camera jump to a tile point (map panel, goal strip). */
  focusWorld(x: number, y: number): void;
}
