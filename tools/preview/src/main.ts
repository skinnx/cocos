// Emberhold Canvas2D web preview — a debug/verification renderer of the SAME deterministic core and SAME sprite
// atlas as the Cocos client (docs/DECISIONS.md). Not the shipping client.
import { App } from './app';
import { installDebug } from './debug';

const app = new App();
const debug = /[?&]debug=1/.test(location.search);
window.addEventListener('error', (e) => app.reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => app.reportError(e.reason));
if (debug) installDebug(app);
app.installInput();
app.resize();
requestAnimationFrame(app.frame);
app.boot().then(() => {
  if (/[?&]autostart=1/.test(location.search)) app.enterHold();
}).catch((e) => app.reportError(e));
