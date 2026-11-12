# Verification (SPEC §15)

Last full run: `npm run verify -- --allow-blocked`, 2026-11-12. Exit 0. Step logs: `/tmp/emberhold-verify/<step>.log`.

## A. Machine checks

| Check | Status | Evidence |
|---|---|---|
| Typecheck (core + game) | PASS | `npm run typecheck`; game layer checked against `types/cc-shim.d.ts` (see Blocked) |
| Unit tests | PASS | 165/165 (`npx vitest run`) |
| Balance gates | PASS | NoBuildBot loses by night 4 in 97%; BaselineBot survives night 5 in 87%, wins night 10 in 0% (≤35%); longest night 128.6 s (≤150) |
| Art lint + manifest | PASS | `node tools/art/build-atlas.mjs` → `atlas: OK`, all manifest sprites present |
| Audio generation | PASS | `npm run audio` + `node tools/audio/verify.mjs`; 30 SFX + 3 music loops, 2.99 MB |
| Grep gates | PASS | core never imports `cc`; game uses `Graphics` only in a debug file |
| `cocos build --platform web-mobile` | **BLOCKED** | see below |
| E2E (Playwright, 390×844) | PASS* | 27/27 checks, no console errors, 9 shots, 60 fps with ~150 enemies. *Runs on the Canvas2D web preview, not a Cocos build |
| Core performance | PASS | 0.38 ms avg step at 250 enemies + 150 buildings + 60 projectiles (budget 4 ms) |

## B. Visual checks (shots in `docs/shots/`, opened and reviewed)

| # | Question | Answer | Shot |
|---|---|---|---|
| 1 | No flat-shape entities; outline + 3 tones | Yes | all |
| 2 | Night: stepped light, veiled eyes, towers firing, damage numbers, seamless auto-tile walls | Yes | night-defense.png |
| 3 | Build mode: grid, green/red ghosts, drawer with real sprites, range ring, synergy link | Yes | build-mode.png |
| 4 | HUD readable at 390×844, safe area, bitmap font only | Yes | all |
| 5 | Biome transitions without square cuts; correct y-sort | Yes (8 edge pairs added for ruins, forest, dirt/sand) | night-defense.png, boss.png, day-explore.png |
| 6 | Same style as `docs/art/style-anchor.png` | Yes | all |

## C. Play checks (e2e + debug hooks, on the web preview)
Title → game → move → build (paint, undo, place, upgrade) → 2 autoplayed nights → dusk omens → boss night → dawn boon → reload + Continue restores the run → Barracks unlock/talent → Pause → Defeat → Title → Victory → Endless. All pass.

## D. Handover
README.md, docs/VERIFY.md, docs/DECISIONS.md, commits per workstream on `claude/mobile-game-spec-cocos4-vq94mp`.

## Blocked
**COCOS 4 toolchain.** Installing `cocos-cli` from source (`npm run init / install / build / link` in a clone of github.com/cocos/cocos-cli) was refused twice by this session's auto-mode permission policy ("Code from External"). Consequences:
- No `cocos create`, no `Main.scene`, no `cocos build`, no `.meta` files.
- The Cocos view layer (`assets/scripts/game/**`) is complete and typechecks against a hand-written subset of the `cc` API (`types/cc-shim.d.ts`), and it runs headless in Node against a mock `cc` (tests/game/smoke.test.ts), but it has never run inside the real engine.
- Unverified until it does: Boot self-bootstrap in a real build, `art/atlas/texture` sub-asset path, `uploadData` row order, UI_2D camera setup, real draw calls/FPS.

To unblock: allow Bash to run the cocos-cli install steps and the `cocos` command, then run SPEC milestone M0 (`cocos create --project <abs> --type 2d` at repo root, create `db://assets/scenes/Main.scene`, remove the `cc` paths mapping from tsconfig.game.json, `cocos build --platform web-mobile`), and run `npm run verify` without `--allow-blocked`.
