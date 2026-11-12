// Persistence through sys.localStorage (SPEC §11.3): emberhold.meta.v1 (saved on every change) and emberhold.run.v1
// (snapshot at each dawn). Corrupt or foreign data never crashes: the run is dropped, meta falls back to defaults.
import { sys } from 'cc';
import type { MetaState } from '../core/api';
import { isValidRun } from '../core/sim/Game';
import { loadMeta, saveMeta as metaJson } from '../core/sim/Meta';
import { META_KEY, RUN_KEY, safeGet, safeRemove, safeSet, type KV } from './logic/save';

function store(): KV | null {
  try { return sys.localStorage ?? null; } catch { return null; }
}

export const Save = {
  loadMeta(): MetaState { return loadMeta(safeGet(store(), META_KEY)); },
  saveMeta(meta: MetaState): void { safeSet(store(), META_KEY, metaJson(meta)); },
  loadRun(): string | null {
    const raw = safeGet(store(), RUN_KEY);
    if (raw && !isValidRun(raw)) { safeRemove(store(), RUN_KEY); return null; }
    return raw;
  },
  hasRun(): boolean { return isValidRun(safeGet(store(), RUN_KEY)); },
  saveRun(json: string): void { safeSet(store(), RUN_KEY, json); },
  clearRun(): void { safeRemove(store(), RUN_KEY); },
  eraseAll(): void { safeRemove(store(), RUN_KEY); safeRemove(store(), META_KEY); },
};
