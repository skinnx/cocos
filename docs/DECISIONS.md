# Decisions
- 2026-11-12 lead: cocos-cli install blocked by the session's auto-mode permission policy ("Code from External"). Everything not depending on it is built; Cocos layer typechecks against a hand-written `cc` shim (types/cc-shim.d.ts).
- 2026-11-12 lead: added a Canvas2D web preview (tools/preview) that renders the same core + atlas, used for e2e screenshots and bot autoplay while the Cocos build is unavailable. It is a debug tool, not the shipping client.
