// Balance worker: runs bot games from the esbuild-bundled core (path in workerData.bundle).
import { parentPort, workerData } from 'node:worker_threads';

const mod = await import(workerData.bundle);
const bots = { nobuild: mod.NoBuildBot, baseline: mod.BaselineBot, autoplay: mod.AutoplayBot };
parentPort.on('message', (job) => {
  if (job === null) { parentPort.close(); return; }
  const r = mod.runBot(job.seed, bots[job.bot], { maxNight: job.maxNight ?? 10 });
  parentPort.postMessage({ ...job, ...r });
});
parentPort.postMessage({ ready: true });
