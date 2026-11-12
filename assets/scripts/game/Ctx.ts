// Shared context handed to every view/UI module by GameRoot (no globals besides the atlas).
import type { Command, Game, GameState, MetaState } from '../core/api';
import type { CameraRig } from './render/CameraRig';
import type { EntityView } from './render/EntityView';
import type { FxPool } from './render/FxPool';

export type ScreenId = 'loading' | 'title' | 'barracks' | 'settings' | 'game';

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
  meta: MetaState;
  readonly layout: Layout;
  cam: CameraRig;
  fx: FxPool;
  ents: EntityView;
  time: number;
  state(): GameState;
  cmd(c: Command): void;
  sfx(name: string, priority?: number): void;
  vibrate(ms: number): void;
  saveMeta(): void;
  go(s: ScreenId): void;
  /** tile → UI px */
  tileToUi(tx: number, ty: number): { x: number; y: number };
  /** UI px → tile */
  uiToTile(x: number, y: number): { x: number; y: number };
  startRun(cont: boolean): void;
  hasRunSave(): boolean;
  quitToTitle(): void;
  pause(on: boolean): void;
  readonly paused: boolean;
}
