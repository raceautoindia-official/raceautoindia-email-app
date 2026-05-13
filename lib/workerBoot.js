// Boot the worker exactly once per Node process.
// Imported lazily by API routes so it starts on first admin hit.
import { startWorker } from "./worker";

if (!global.__emailWorkerBooted) {
  global.__emailWorkerBooted = true;
  try {
    startWorker();
  } catch (e) {
    console.error("worker boot failed:", e);
  }
}

export default true;
