// Pure (no 'cc') view logic shared with the Cocos client (assets/scripts/game/logic/**), so the preview places
// edges, light texels, minimap pixels and build gestures exactly like the shipping client.
export { edgeOverlays, materialOf, tileSprite } from '../../../assets/scripts/game/logic/edges';
export type { Material } from '../../../assets/scripts/game/logic/edges';
export { fillLight, TEXELS_PER_TILE } from '../../../assets/scripts/game/logic/light';
export { fillMinimap } from '../../../assets/scripts/game/logic/minimap';
export { classifyDrag, paintCells, ringPoints, dottedLine, isTap } from '../../../assets/scripts/game/logic/gestures';
export type { LineMode, Cell } from '../../../assets/scripts/game/logic/gestures';
export { basePixelScale, smoothFactor, lookAhead, clampCamera, edgeScroll, pinchStep, zoomSteps } from '../../../assets/scripts/game/logic/camera';
export { heroSprite, enemySprite, buildingSprites, isFloorBuilding, nodeSprite, nodeShadow, poiSprite, projectileSprite, unitShadow, lerpPos, statusIcons, crackOverlay, isBoss, animFrame, ANIM_FPS } from '../../../assets/scripts/game/logic/sprites';
export { layoutText, toAscii, fmtNum } from '../../../assets/scripts/game/logic/text';
