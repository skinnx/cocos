# Progress — SPEC v2 upgrade (paused 2026-11-12, out of quota)

**Last fully working state: commit `302c5e6` (v1 game + SPEC v2 text).** `git checkout 302c5e6` to play/verify v1.
Everything after it is the v2 upgrade, **in progress and NOT building/green**:

| Workstream | State when stopped |
|---|---|
| Foundation (lead) | Done: api.ts v2 contract, manifest v2 (+778 sprites), docs/CONTRACT.md ownership |
| core-hold | Mid-way (was rewriting Enemies.ts for new enemies/bosses) |
| core-heroes | Mid-way (Roster/Forge/expedition started; Squad.ts rewrite not done) |
| art-terrain | Mostly drawn (finishing coal/frost/rubble/veil) |
| art-buildings | Helpers done; main module just started |
| art-units | Villagers/heroes/enemies in progress; bosses not done |
| art-ui + atlas | ui2 drawn; atlas packs 1432 sprites at 896×896 |
| Cocos view v2 | Many panels written; modal screens (title, away, fire gutters, expedition result) not done |
| preview/audio/e2e v2 | Preview panels in progress; e2e v2, new audio, video not done |

To resume: re-read SPEC.md v2, docs/CONTRACT.md, this file; run `npx tsc -p tsconfig.core.json --noEmit` and
`node tools/art/build-atlas.mjs --allow-missing` to see what's missing, then continue workstream by workstream
(core first, then art, then view/preview, then `npm run verify -- --allow-blocked`). PROMPT.md is the one-shot prompt for this.
