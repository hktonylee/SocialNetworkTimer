import { reconcileState } from "./timer.js";

export function createBackgroundController({
  storage,
  getShouldCount,
  broadcast,
  now,
  getDateKey,
  maxGapMs,
}) {
  let queue = Promise.resolve();

  function reconcile() {
    const nowMs = now();
    const dateKey = getDateKey(nowMs);

    const operation = queue.then(async () => {
      const [storedState, shouldCount] = await Promise.all([
        storage.read(),
        getShouldCount(),
      ]);
      const state = reconcileState(storedState, {
        nowMs,
        dateKey,
        shouldCount,
        maxGapMs,
      });
      const snapshot = {
        type: "SOCIAL_TIMER_SNAPSHOT",
        dateKey: state.dateKey,
        elapsedMs: state.elapsedMs,
        isCounting: state.activeSinceMs !== null,
        syncedAtMs: nowMs,
      };

      await storage.write(state);
      await broadcast(snapshot);
      return snapshot;
    });

    queue = operation.catch(() => {});
    return operation;
  }

  return {
    reconcile,
    getSnapshot: reconcile,
  };
}
