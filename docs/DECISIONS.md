# Decisions
- 2026-11-12 lead: cocos-cli install blocked by the session's auto-mode permission policy ("Code from External"). Everything not depending on it is built; Cocos layer typechecks against a hand-written `cc` shim (types/cc-shim.d.ts).
- 2026-11-12 lead: added a Canvas2D web preview (tools/preview) that renders the same core + atlas, used for e2e screenshots and bot autoplay while the Cocos build is unavailable. It is a debug tool, not the shipping client.
- 2026-11-12 art-ui: atlas.json frames may carry two additive fields: `slice: [l,t,r,b]` (9-slice insets, art px) and `advance` (font glyph pen advance). `font.json` repeats glyph advances per font (font5 lineHeight 10, font7 lineHeight 12; glyphs are white `w` with a 1px `k` outline, anchor (1,1) = cell top-left, so tint by multiply). build-atlas lint exemptions: 9-slice sprites and font glyphs skip the "fills its bounding box" check; the space glyph may be empty. A sprite module's declared `kind` wins over the manifest kind (lint + default anchor); differences are printed as warnings.
- 2026-11-12 game: UI laid out in a ~240px-wide UI pixel space scaled by an integer device-px factor; big-text mode scales text ×1.5 (may produce mixels).
- 2026-11-12 game: drawer cards show cost as icon + short text (e.g. `20w 10s`).
- 2026-11-12 game: light overlay snaps to tile light level → discrete alpha with 4px stair-step edges; flicker ±0.25 tile.
- 2026-11-12 game: run snapshot saved at dawn and at each new day.
- 2026-11-12 game: unverified without the real engine — Boot bootstrap in a real build, `art/atlas/texture` sub-asset path (ImageAsset fallback), uploadData row order, UI_2D camera, real draw calls/FPS.
