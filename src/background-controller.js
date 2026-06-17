import { createDaySnapshot, reconcileDayState } from "./timer.js";

export function createBackgroundController({
  storage,
  getShouldCount,
  broadcast,
  now,
  getDateKey,
}) {
  let queue = Promise.resolve();

  function sync() {
    const nowMs = now();
    const dateKey = getDateKey(nowMs);

    const operation = queue.then(async () => {
      const [storedState, shouldCount] = await Promise.all([
        storage.read(),
        getShouldCount(),
      ]);
      const state = reconcileDayState(storedState, {
        nowMs,
        dateKey,
        shouldCount,
      });
      const snapshot = createDaySnapshot(state);

      await storage.write(state);
      await broadcast(snapshot);
      return snapshot;
    });

    queue = operation.catch(() => {});
    return operation;
  }

  return {
    sync,
    getSnapshot: sync,
  };
}
