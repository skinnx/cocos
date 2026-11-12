# Contract & ownership (v2 parallel workstreams)

Single source of truth: `assets/scripts/core/api.ts` (game API v2) and `tools/art/manifest.mjs` (sprite names; v2 block at the end).
Do not edit files owned by another workstream. Contract changes: smallest additive change + one line in `docs/DECISIONS.md`.

| Workstream | Owns (write access) |
|---|---|
| core-hold | `assets/scripts/core/sim/**` EXCEPT the core-heroes files below; `assets/scripts/core/data/**` EXCEPT heroes.ts, gear.ts, expedition.ts; `assets/scripts/core/bots/**`; `tests/core/**` except heroes*/expedition*; `tests/balance/**`; `api.ts` (additive) |
| core-heroes | `core/sim/Squad.ts`, `core/sim/Roster.ts`, `core/sim/Forge.ts`, `core/sim/expedition/**`, `core/data/heroes.ts`, `core/data/gear.ts`, `core/data/expedition.ts`, `tests/core/heroes*.test.ts`, `tests/core/expedition*.test.ts`; additive blocks marked `// roster:` in World.ts / Game.ts |
| art-terrain | `tools/art/sprites/world2_terrain.mjs` (+ `_terrain_helpers.mjs`) — world2 tiles, edges, veil, props |
| art-buildings | `tools/art/sprites/world2_buildings.mjs` (+ `_bld2_helpers.mjs`) — world2 buildings, hearth tiers, walls/skins, banners, modules, flames |
| art-units | `tools/art/sprites/units2.mjs` (+ helpers) |
| art-ui | `tools/art/sprites/ui2.mjs` (+ helpers), `tools/art/build-atlas.mjs`, `tests/art/**` |
| game (Cocos) | `assets/scripts/game/**`, `types/*.d.ts`, `tests/game/**` |
| preview+verify+audio | `tools/preview/**`, `tools/verify/**`, `tools/audio/**`, `assets/resources/audio/**`, `docs/shots/**`, `docs/video/**` |
| lead | `package.json`, tsconfig*, vitest*, SPEC.md, PROMPT.md, README.md, docs/*.md, `tools/art/manifest.mjs`, `tools/art/sprites/world2.mjs` |

## Core split (core-hold ↔ core-heroes)
core-hold owns the world, the hold loop, economy, enemies, towers, map, save, offline, daily layer, research, bots.
core-heroes owns everything about heroes (10 heroes' combat in Squad.ts, roster progression, stars/skills/gear/forge/modules
crafting, garrison effects, dispatch, tavern recruit) and the expedition world. Integration surface — core-heroes exports from
`core/sim/Roster.ts`:
- `initRoster(state)`, `rosterCommand(w, cmd): boolean` (handles setSquad/garrison/dispatch/starUp/pickSkill/equip/craft/salvage/craftModule/setModule/recruit),
- `heroStats(state, id) → { hpMul, dmgMul, rateMul, rangeAdd, critAdd, ... }`, `garrisonTowerMods(w, building) → { dmgMul, rateMul, rangeAdd, pierceAdd, ... }`,
- `grantHeroXp(w, id, xp)`, `grantShards(state, id, n)`, `rosterOnDawn(w)`, `rosterTick(state, now)` (dispatch completion → loot), `settleDispatches(state, now)` (used by offline settle),
- `moduleMods(module) → {...}` for towers.
And from `core/sim/expedition/index.ts`: `startExpedition(w, cmd)`, `stepExpedition(w)`, `expeditionCommand(w, cmd): boolean`, `rollIslands(seed, dayKey, regionsOpen)`.
core-hold calls these from Game.ts/Towers.ts/Phases.ts. Until core-heroes lands them, core-hold may use a local fallback but must switch to the real
exports before finishing. core-heroes may make small additive edits in World.ts/Game.ts inside `// roster:` blocks only.

## Sprite module contract
Unchanged from v1: each sprite module exports `default function build()` returning `[{ name, px, kind, ax?, ay?, slice?, advance?, alias? }]`.
Names must come from `manifest.mjs`. `world2.mjs` aggregates `world2_terrain.mjs` + `world2_buildings.mjs`.

## Coordinates
Core: tile units, +y down. One tile = 16 art px. Building (x,y) = top-left tile of footprint.

## Cocos `cc` types
Still blocked: the game layer typechecks against `types/cc-shim.d.ts` (hand-written subset of the real API).
