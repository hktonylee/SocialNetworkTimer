import test from "node:test";
import assert from "node:assert/strict";

import { createBackgroundController } from "../src/background-controller.js";

function createStorage(initialValue) {
  let value = structuredClone(initialValue);
  return {
    async read() {
      return structuredClone(value);
    },
    async write(nextValue) {
      value = structuredClone(nextValue);
    },
    value() {
      return structuredClone(value);
    },
  };
}

test("persists and broadcasts one shared active timer snapshot", async () => {
  let nowMs = 1_000;
  let shouldCount = true;
  const storage = createStorage(undefined);
  const snapshots = [];
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => shouldCount,
    broadcast: async (snapshot) => snapshots.push(snapshot),
    now: () => nowMs,
    getDateKey: () => "2026-06-09",
    maxGapMs: 120_000,
  });

  await controller.reconcile();
  nowMs = 11_000;
  await controller.reconcile();
  shouldCount = false;
  nowMs = 16_000;
  const snapshot = await controller.reconcile();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-09",
    elapsedMs: 15_000,
    activeSinceMs: null,
  });
  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_SNAPSHOT",
    dateKey: "2026-06-09",
    elapsedMs: 15_000,
    isCounting: false,
    syncedAtMs: 16_000,
  });
  assert.deepEqual(snapshots.at(-1), snapshot);
});

test("continues persisted active timer after controller restart", async () => {
  let nowMs = 20_000;
  const storage = createStorage({
    dateKey: "2026-06-09",
    elapsedMs: 7_000,
    activeSinceMs: 10_000,
  });
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => true,
    broadcast: async () => {},
    now: () => nowMs,
    getDateKey: () => "2026-06-09",
    maxGapMs: 120_000,
  });

  const snapshot = await controller.getSnapshot();

  assert.equal(snapshot.elapsedMs, 17_000);
  assert.equal(snapshot.isCounting, true);
  assert.equal(storage.value().activeSinceMs, nowMs);
});

test("serializes overlapping reconciliation requests", async () => {
  let nowMs = 1_000;
  let releaseActivity;
  let activityStarted;
  const started = new Promise((resolve) => {
    activityStarted = resolve;
  });
  let activityCalls = 0;
  const storage = createStorage(undefined);
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => {
      activityCalls += 1;
      if (activityCalls === 1) {
        activityStarted();
        await new Promise((resolve) => {
          releaseActivity = resolve;
        });
      }
      return true;
    },
    broadcast: async () => {},
    now: () => nowMs,
    getDateKey: () => "2026-06-09",
    maxGapMs: 120_000,
  });

  const first = controller.reconcile();
  nowMs = 11_000;
  const second = controller.reconcile();
  await started;
  releaseActivity();
  await Promise.all([first, second]);

  assert.equal(storage.value().elapsedMs, 10_000);
  assert.equal(storage.value().activeSinceMs, 11_000);
});
