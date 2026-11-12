# Contract & ownership (parallel workstreams)

Single source of truth for interfaces: `assets/scripts/core/api.ts` (game API) and `tools/art/manifest.mjs` (sprite names).
Do not edit files owned by another workstream. If you need a contract change, make the smallest additive change and note it in `docs/DECISIONS.md`.

| Workstream | Owns (write access) |
|---|---|
| core | `assets/scripts/core/**` (except api.ts: additive only), `tests/core/**`, `tests/balance/**` |
| art-world | `tools/art/sprites/tiles.mjs`, `props.mjs`, `buildings.mjs` |
| art-units | `tools/art/sprites/units.mjs`, `fx.mjs` |
| art-ui | `tools/art/sprites/ui.mjs`, `tools/art/build-atlas.mjs`, `tests/art/**` |
| audio | `tools/audio/**`, `assets/resources/audio/**` |
| game (Cocos view) | `assets/scripts/game/**`, `types/cc-shim.d.ts`, `types/cc-env-shim.d.ts`, `tests/game/**` |
| preview + verify | `tools/preview/**`, `tools/verify/**`, `docs/shots/**` |
| lead | `package.json`, tsconfig*, vitest*, SPEC.md, PROMPT.md, README.md, docs/*.md |

## Sprite module contract
Each `tools/art/sprites/<group>.mjs` exports `export default function build(): Array<{ name, px, kind, ax?, ay? }>`
(`px` is a `Px` from `../pixel.mjs`; `ax, ay` anchor in art px from the sprite's top-left; default: bottom-centre for
unit/building/prop/wall, top-left for tile/ui/icon/font/fx-centre). Names must come from `manifest.mjs`.
`build-atlas.mjs` imports all groups, packs `assets/resources/art/atlas.png` + `atlas.json`
(`{ frames: { [name]: { x, y, w, h, ax, ay } }, size: [W, H] }`), lints, and writes `docs/art/contact-<group>.png`.

## Coordinates
Core: tile units, +y = DOWN (row index), tile (x,y) covers [x,x+1)×[y,y+1). One tile = 16 art px.
Cocos view converts: worldPx = (x*16, -y*16) (Cocos +y up). Building (x,y) = top-left tile of footprint.

## Cocos `cc` types
The Cocos 4 CLI/engine could not be installed in this environment (permission policy). The game layer typechecks
against `types/cc-shim.d.ts`, a hand-written subset of the Cocos Creator 3.8/4 public API covering only what the game
uses. When the real engine is available, delete the `paths` mapping in tsconfig.game.json and typecheck against it.
