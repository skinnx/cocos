// Debug hook (SPEC §13.4), installed only in --debug builds or with ?debug=1:
//   window.__EH = { state(), cmd(c), goto(phase, {night}), grant({wood,stone,gold}), autoplay(on), speed(x), seed(n),
//                   fps(), errors[] } (+ screen(), start(continue?) for e2e convenience).
import { DEBUG } from 'cc/env';
import type { Command, GameState, Phase, Resources } from '../core/api';

export interface DebugHost {
  state(): GameState | null;
  cmd(c: Command): void;
  goto(phase: Phase, night?: number): void;
  grant(r: Partial<Resources>): void;
  setAutoplay(on: boolean): void;
  setSpeed(x: number): void;
  setSeed(n: number): void;
  fps(): number;
  screen(): string;
  start(cont?: boolean): void;
}

export function debugEnabled(): boolean {
  if (DEBUG) return true;
  try {
    const loc = (globalThis as { location?: { search?: string } }).location;
    return !!loc && typeof loc.search === 'string' && /(^|[?&])debug=1(&|$)/.test(loc.search);
  } catch { return false; }
}

export const debugErrors: string[] = [];

export function installDebug(host: DebugHost): void {
  const g = globalThis as Record<string, unknown> & { addEventListener?: (t: string, cb: (e: any) => void) => void };
  if (typeof g.addEventListener === 'function') {
    g.addEventListener('error', (e: { message?: string }) => { debugErrors.push(String(e?.message ?? e)); });
    g.addEventListener('unhandledrejection', (e: { reason?: unknown }) => { debugErrors.push(String(e?.reason ?? e)); });
  }
  if (!debugEnabled()) return;
  g.__EH = {
    state: () => host.state(),
    cmd: (c: Command) => host.cmd(c),
    goto: (phase: Phase, opts?: { night?: number }) => host.goto(phase, opts?.night),
    grant: (r: Partial<Resources>) => host.grant(r),
    autoplay: (on: boolean) => host.setAutoplay(on !== false),
    speed: (x: number) => host.setSpeed(x),
    seed: (n: number) => host.setSeed(n),
    fps: () => host.fps(),
    screen: () => host.screen(),
    start: (cont?: boolean) => host.start(!!cont),
    errors: debugErrors,
  };
}
