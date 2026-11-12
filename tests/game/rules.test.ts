// Static rules for the Cocos view layer (SPEC §9.4, §9.6, §13.3).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NAMES } from '../../tools/art/manifest.mjs';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
}
const GAME = files('assets/scripts/game');

describe('view layer source rules', () => {
  it('no Graphics (outside a debug file), no system-font Label, no TODO/stub markers', () => {
    for (const f of GAME) {
      const src = readFileSync(f, 'utf8');
      if (!/debug/i.test(f)) expect(/\bGraphics\b/.test(src), `${f} uses Graphics`).toBe(false);
      expect(/\b(Label|RichText)\b/.test(src.replace(/\/\/.*$/gm, '')), `${f} uses a system-font Label`).toBe(false);
      expect(/\b(TODO|FIXME|stub|placeholder)\b/i.test(src), `${f} has a TODO/stub marker`).toBe(false);
    }
  });
  it('pure logic modules never import cc', () => {
    for (const f of GAME.filter((p) => p.includes(`${join('game', 'logic')}`))) expect(/from 'cc'/.test(readFileSync(f, 'utf8')), f).toBe(false);
  });
  it('every literal sprite name in the view code exists in the manifest', () => {
    const bad: string[] = [];
    const audio = new Set(Object.keys(JSON.parse(readFileSync('assets/resources/audio/audio.json', 'utf8')).files ?? {}));
    for (const f of GAME.filter((p) => !p.endsWith('atlasData.ts'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/'((?:ui|icon|bld|prop|fx|proj|tile|edge|hero|enemy|boss|portrait|boon|font5|font7)_[a-z0-9_]+|logo|turret_mini)'/g)) {
        const name = m[1];
        if (/_$/.test(name) || audio.has(name)) continue;
        if (!NAMES.has(name) && !NAMES.has(`${name}_0`)) bad.push(`${f}: ${name}`); // animation bases name <base>_0..n
      }
    }
    expect(bad).toEqual([]);
  });
});
