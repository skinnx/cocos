// AUTHORITATIVE list of sprite names. View code references these names verbatim;
// build-atlas fails if any is missing. Owner = which sprites/*.mjs module draws it.
// Naming: frames are suffixed _0.._n-1. Anchor (ax,ay) default = bottom-centre for
// units/buildings/props, top-left for tiles/ui. See docs/CONTRACT.md.
const out = [];
const add = (owner, kind, name, frames = 1) => {
  if (frames === 1) out.push({ owner, kind, name });
  else for (let i = 0; i < frames; i++) out.push({ owner, kind, name: `${name}_${i}` });
};

// ── tiles (owner: tiles) ──────────────────────────────────────────────────────
for (const [b, n] of [['grass', 4], ['grass_flower', 2], ['grass_dark', 3], ['dirt', 3], ['sand', 3], ['ruins', 3]])
  for (let i = 0; i < n; i++) add('tiles', 'tile', `tile_${b}_${i}`);
add('tiles', 'tile', 'tile_water', 2);
// edge overlays: <pair> = upper_lower biome; pieces = n e s w (edges), ne se sw nw (outer corners), ine ise isw inw (inner corners)
// Material stacking order (low → high): water < sand < dirt < grassdark (forest) < grass < ruins. One pair for every two
// land materials that MapGen can put side by side (assets/scripts/game/logic/edges.ts EDGE_PAIRS mirrors this list).
export const EDGE_PAIRS = ['grass_dirt', 'grass_sand', 'sand_water', 'grass_grassdark', 'ruins_grass', 'grassdark_dirt',
  'grassdark_sand', 'ruins_grassdark', 'dirt_sand', 'ruins_dirt', 'ruins_sand'];
for (const pair of EDGE_PAIRS)
  for (const p of ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw', 'ine', 'ise', 'isw', 'inw']) add('tiles', 'tile', `edge_${pair}_${p}`);

// ── props (owner: props) ──────────────────────────────────────────────────────
for (const n of ['pine_0', 'pine_1', 'oak_0', 'oak_1', 'stump', 'bush_0', 'bush_1', 'rock_s', 'rock_m', 'rock_l', 'ore_0', 'ore_1',
  'ruin_pillar_0', 'ruin_pillar_1', 'ruin_wall', 'barrel', 'crate', 'cage', 'cage_broken', 'shrine', 'shrine_used',
  'chest_closed', 'chest_open', 'root', 'camp', 'shadow_s', 'shadow_m', 'shadow_l']) add('props', 'prop', `prop_${n}`);
add('props', 'prop', 'prop_rift', 4);

// ── buildings (owner: buildings) ──────────────────────────────────────────────
for (const lv of [1, 2, 3]) add('buildings', 'building', `bld_hearth_l${lv}`, 4);
for (let m = 0; m < 16; m++) { add('buildings', 'wall', `bld_wall_wood_${m}`); add('buildings', 'wall', `bld_wall_stone_${m}`); }
for (const o of ['h', 'v']) for (const s of ['closed', 'open']) add('buildings', 'building', `bld_gate_${o}_${s}`);
for (const lv of [1, 2]) { add('buildings', 'building', `bld_brazier_l${lv}`, 4); add('buildings', 'building', `bld_brazier_l${lv}_off`); }
for (const lv of [1, 2, 3]) {
  add('buildings', 'building', `bld_tower_arrow_l${lv}`);
  add('buildings', 'building', `bld_tower_ballista_l${lv}_base`);
  add('buildings', 'building', `bld_tower_frost_l${lv}`, 4);
  add('buildings', 'building', `bld_tower_mortar_l${lv}`);
  add('buildings', 'building', `bld_tower_spark_l${lv}`, 4);
  add('buildings', 'building', `bld_lumber_camp_l${lv}`);
  add('buildings', 'building', `bld_quarry_l${lv}`);
  add('buildings', 'building', `bld_barracks_l${lv}`);
  add('buildings', 'building', `bld_workshop_l${lv}`);
}
add('buildings', 'building', 'bld_ballista_head', 8); // 8 directions, 0 = east, counter-clockwise
add('buildings', 'building', 'bld_tavern_l1');
for (const lv of [1, 2]) { add('buildings', 'prop', `bld_trap_spikes_l${lv}_up`); add('buildings', 'prop', `bld_trap_spikes_l${lv}_down`); }
add('buildings', 'prop', 'bld_trap_tar'); add('buildings', 'fx', 'bld_trap_tar_burning', 3);
add('buildings', 'fx', 'bld_crack_1'); add('buildings', 'fx', 'bld_crack_2');
add('buildings', 'fx', 'bld_flame_tip', 2); add('buildings', 'fx', 'bld_rally_flag', 2); add('buildings', 'fx', 'bld_embed_base');

// ── units (owner: units) ──────────────────────────────────────────────────────
for (const h of ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue']) {
  add('units', 'unit', `hero_${h}_idle`, 2); add('units', 'unit', `hero_${h}_walk`, 4);
  add('units', 'unit', `hero_${h}_attack`, 3); add('units', 'unit', `hero_${h}_down`);
  add('units', 'icon', `portrait_${h}`);
}
for (const e of ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer', 'militia']) {
  add('units', 'unit', `enemy_${e}_move`, 4); add('units', 'unit', `enemy_${e}_attack`, 2);
}
add('units', 'fx', 'enemy_eyes_veiled', 2);
add('units', 'unit', 'boss_mossback_walk', 4); add('units', 'unit', 'boss_mossback_shell', 2);
add('units', 'unit', 'boss_unlit_float', 4); add('units', 'unit', 'boss_unlit_cast', 2);
add('units', 'unit', 'turret_mini');

// ── fx & projectiles (owner: fx) ──────────────────────────────────────────────
for (const p of ['arrow', 'bolt', 'frost_shard', 'mortar', 'spit', 'turret']) add('fx', 'fx', `proj_${p}`);
add('fx', 'fx', 'proj_fireball', 2); add('fx', 'fx', 'proj_spark_seg', 2);
for (const [n, f] of [['hit', 3], ['slash', 3], ['explosion', 5], ['dust', 3], ['heal', 2], ['levelup', 4], ['burn', 3], ['snow', 2],
  ['chip_wood', 2], ['chip_stone', 2], ['coin', 4], ['smoke', 3], ['frost_aura', 2], ['firewall', 3], ['sanctum', 2], ['stun', 2], ['blink', 3], ['shatter', 3]])
  add('fx', 'fx', `fx_${n}`, f);

// ── ui, icons, font, logo (owner: ui) ─────────────────────────────────────────
for (const n of ['panel_parchment', 'panel_stone', 'btn_up', 'btn_down', 'btn_disabled', 'tab_on', 'tab_off',
  'card_common', 'card_rare', 'card_legendary', 'bar_frame', 'bar_fill_red', 'bar_fill_green', 'bar_fill_blue', 'bar_fill_gold',
  'joy_base', 'joy_knob', 'build_ok', 'build_bad', 'grid_cell', 'range_dot', 'link_dot', 'arrow_edge', 'minimap_frame', 'blueprint_corner'])
  add('ui', 'ui', `ui_${n}`);
for (const n of ['wood', 'stone', 'gold', 'ember', 'heart', 'hammer', 'sword', 'moon', 'sun', 'pause', 'play', 'close', 'tick', 'lock',
  'upgrade', 'wrench', 'sell', 'horn', 'pin', 'undo', 'skull', 'shield', 'fire', 'frost', 'settings', 'music', 'sfx', 'vibrate'])
  add('ui', 'icon', `icon_${n}`);
for (const b of ['sharp', 'thick', 'swift', 'leech', 'horn', 'ally', 'cooldown', 'twin', 'mason', 'boulder', 'hawk', 'reload',
  'spikes', 'harvest', 'thorns', 'living', 'bigfire', 'embers', 'ash', 'farlight', 'mirror', 'spread', 'rebirth', 'falsedawn'])
  add('ui', 'icon', `boon_${b}`);
add('ui', 'ui', 'logo');
// Font: glyphs font5_<charCode> for 32..126 (5×7, line 9) and font7_<charCode> for digits 48..57, '+', '-', '!' (7×9).
for (let c = 32; c <= 126; c++) add('ui', 'font', `font5_${c}`);
for (const c of [...'0123456789+-!'].map((s) => s.charCodeAt(0))) add('ui', 'font', `font7_${c}`);

export const MANIFEST = out;
export const NAMES = new Set(out.map((e) => e.name));
// Boon id → icon name (boon ids are defined in core/data/boons.ts and MUST use these ids).
export const BOON_IDS = ['sharp', 'thick', 'swift', 'leech', 'horn', 'ally', 'cooldown', 'twin', 'mason', 'boulder', 'hawk', 'reload',
  'spikes', 'harvest', 'thorns', 'living', 'bigfire', 'embers', 'ash', 'farlight', 'mirror', 'spread', 'rebirth', 'falsedawn'];
