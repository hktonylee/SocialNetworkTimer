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

test("starts and broadcasts one active interval", async () => {
  const nowMs = 1_000;
  const storage = createStorage(undefined);
  const snapshots = [];
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => true,
    broadcast: async (snapshot) => snapshots.push(snapshot),
    now: () => nowMs,
    getDateKey: () => "2026-06-16",
  });

  const snapshot = await controller.sync();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 1_000 },
  });
  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_DAY",
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 1_000 },
  });
  assert.deepEqual(snapshots.at(-1), snapshot);
});

test("uses caller-provided active state for sender-driven sync", async () => {
  const storage = createStorage(undefined);
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => false,
    broadcast: async () => {},
    now: () => 1_000,
    getDateKey: () => "2026-06-16",
  });

  await controller.sync({ shouldCount: true });

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 1_000 },
  });
});

test("closes active interval when counting stops", async () => {
  const nowMs = 5_000;
  const storage = createStorage({
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000 },
  });
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => false,
    broadcast: async () => {},
    now: () => nowMs,
    getDateKey: () => "2026-06-16",
  });

  const snapshot = await controller.sync();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [{ startMs: 1_000, endMs: 5_000 }],
    active: null,
  });
  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_DAY",
    dateKey: "2026-06-16",
    intervals: [{ startMs: 1_000, endMs: 5_000 }],
    active: null,
  });
});

test("does not duplicate active interval on repeated sync", async () => {
  const nowMs = 2_000;
  const storage = createStorage({
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000 },
  });
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => true,
    broadcast: async () => {},
    now: () => nowMs,
    getDateKey: () => "2026-06-16",
  });

  await controller.sync();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 2_000 },
  });
});

test("caps stale active interval and starts a fresh active interval", async () => {
  const storage = createStorage({
    dateKey: "2026-06-16",
    intervals: [{ startMs: 0, endMs: 500 }],
    active: { startMs: 1_000, lastHeartbeatMs: 10_000 },
  });
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => true,
    broadcast: async () => {},
    now: () => 200_000,
    getDateKey: () => "2026-06-16",
  });

  await controller.sync();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [
      { startMs: 0, endMs: 500 },
      { startMs: 1_000, endMs: 85_000 },
    ],
    active: { startMs: 200_000, lastHeartbeatMs: 200_000 },
  });
});

test("serializes overlapping sync requests", async () => {
  const nowMs = 1_000;
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
    getDateKey: () => "2026-06-16",
  });

  const first = controller.sync();
  const second = controller.sync();
  await started;
  releaseActivity();
  await Promise.all([first, second]);

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 1_000 },
  });
});

test("broadcast snapshot contains only timestamp day state", async () => {
  const snapshots = [];
  const controller = createBackgroundController({
    storage: createStorage(undefined),
    getShouldCount: async () => true,
    broadcast: async (snapshot) => snapshots.push(snapshot),
    now: () => 1_000,
    getDateKey: () => "2026-06-16",
  });

  await controller.sync();

  const serialized = JSON.stringify(snapshots.at(-1));
  assert.match(serialized, /SOCIAL_TIMER_DAY/);
  assert.doesNotMatch(serialized, /url|hostname|tabId|title|origin/i);
});
