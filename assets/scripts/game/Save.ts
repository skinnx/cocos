// Persistence through sys.localStorage (SPEC §13.7): the Hold under emberhold.hold.v2 (+ .bak, written through a tmp
// key), settings under emberhold.settings.v1, the v1 meta (emberhold.meta.v1) handed to createHold once for
// migration. Corrupt or foreign data never crashes: main → backup → tmp, else a new Hold and a notice.
import { sys } from 'cc';
import type { Game, Settings } from '../core/api';
import { createHold, defaultSettings, loadSettings, saveSettings } from '../core/sim/Game';
import {
  HOLD_BAK_KEY, HOLD_KEY, HOLD_TMP_KEY, LEGACY_META_KEY, LEGACY_RUN_KEY, SETTINGS_KEY, loadHold, newSeed, safeGet, safeRemove, safeSet, writeHold,
  type HoldSource, type KV,
} from './logic/save';

function store(): KV | null {
  try { return sys.localStorage ?? null; } catch { return null; }
}

export interface OpenResult { game: Game; from: HoldSource | 'new'; corrupt: boolean }

export const Save = {
  loadSettings(): Settings {
    try { return loadSettings(safeGet(store(), SETTINGS_KEY)); } catch { return defaultSettings(); }
  },
  saveSettings(s: Settings): void {
    try { safeSet(store(), SETTINGS_KEY, saveSettings(s)); } catch { /* storage unavailable */ }
  },
  hasHold(): boolean { return !!(safeGet(store(), HOLD_KEY) || safeGet(store(), HOLD_BAK_KEY) || safeGet(store(), HOLD_TMP_KEY)); },
  /** Open the stored Hold (main → backup → tmp) or start a new one (migrating v1 meta when present). */
  openHold(now: number, dayKey: number, seed?: number): OpenResult {
    const kv = store();
    const r = loadHold(kv, (raw) => createHold({ seed: newSeed(seed), saved: raw, now, dayKey }));
    if (r.value) return { game: r.value, from: r.from!, corrupt: r.corrupt };
    const legacy = safeGet(kv, LEGACY_META_KEY);
    const game = createHold({ seed: newSeed(seed), now, dayKey, legacyMeta: legacy });
    if (legacy) { safeRemove(kv, LEGACY_RUN_KEY); }
    return { game, from: 'new', corrupt: r.corrupt };
  },
  /** Open a pasted save string; throws when it is not a readable Hold. */
  openString(raw: string, now: number, dayKey: number): Game { return createHold({ seed: newSeed(), saved: raw, now, dayKey }); },
  writeHold(json: string): boolean {
    const ok = writeHold(store(), json);
    // v1 meta is only migrated once: after the first v2 save it is no longer needed
    if (ok && safeGet(store(), LEGACY_META_KEY)) { safeRemove(store(), LEGACY_META_KEY); safeRemove(store(), LEGACY_RUN_KEY); }
    return ok;
  },
  eraseAll(): void {
    const kv = store();
    for (const k of [HOLD_KEY, HOLD_BAK_KEY, HOLD_TMP_KEY, LEGACY_META_KEY, LEGACY_RUN_KEY]) safeRemove(kv, k);
  },
};
