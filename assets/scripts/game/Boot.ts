// Self-bootstrap (SPEC §13.2a): every script under assets/ is loaded at startup, so this module attaches GameRoot to
// the scene's Canvas after launch — Main.scene stays an empty 2D template (Canvas + Camera).
import { director, Director } from 'cc';
import { EDITOR } from 'cc/env';
import { GameRoot } from './GameRoot';

if (!EDITOR) director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
  const canvas = director.getScene()!.getChildByName('Canvas')!;
  if (!canvas.getComponent(GameRoot)) canvas.addComponent(GameRoot);
});
