import { describe, expect, it } from 'vitest';
import { STRINGS_EN, STRINGS_VI, t } from '../../assets/scripts/core/data/i18n';
import { BUILDING_IDS } from '../../assets/scripts/core/data/buildings';
import { HERO_IDS } from '../../assets/scripts/core/data/heroes';
import { ENEMIES } from '../../assets/scripts/core/data/enemies';
import { BOONS } from '../../assets/scripts/core/data/boons';
import { TALENTS } from '../../assets/scripts/core/data/talents';

describe('strings (en + vi)', () => {
  it('every content id has a name/description in English and Vietnamese', () => {
    const keys = [
      ...BUILDING_IDS.flatMap((id) => [`bld.${id}.name`, `bld.${id}.desc`]),
      ...HERO_IDS.flatMap((id) => [`hero.${id}.name`, `hero.${id}.skill`, `hero.${id}.skillDesc`, `hero.${id}.passive`]),
      ...Object.keys(ENEMIES).map((id) => `enemy.${id}.name`),
      ...BOONS.flatMap((b) => [`boon.${b.id}.name`, `boon.${b.id}.desc`]),
      ...TALENTS.flatMap((x) => [`talent.${x.id}.name`, `talent.${x.id}.desc`]),
      ...[0, 1, 2, 3, 4].map((i) => `tutorial.${i}`),
      'omen.title', 'hud.callNight', 'hud.startNight',
    ];
    for (const k of keys) { expect(STRINGS_EN[k], k).toBeTruthy(); expect(STRINGS_VI[k], k).toBeTruthy(); }
    expect(Object.keys(STRINGS_VI).sort()).toEqual(Object.keys(STRINGS_EN).sort());
  });
  it('t() substitutes params and falls back', () => {
    expect(t('hud.night', 'en', { n: 3 })).toBe('Night 3/10');
    expect(t('hud.night', 'vi', { n: 3 })).toBe('Đêm 3/10');
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
