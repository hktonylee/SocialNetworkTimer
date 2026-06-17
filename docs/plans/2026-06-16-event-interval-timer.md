# Event Interval Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rolling elapsed timer ownership with durable same-day completed intervals plus one open active interval.

**Architecture:** Pure timer logic normalizes interval state, applies browser-state transitions, and computes daily usage. The background service worker validates Chrome focused-window active-tab state and records only timestamp intervals. Content scripts wake the worker, receive timestamp-only day state, and render from intervals without URLs, hostnames, titles, tab IDs, or origins.

**Tech Stack:** Chrome Manifest V3, JavaScript ES modules, Shadow DOM, `chrome.storage.local`, Node built-in test runner

---

## File Structure

- Modify `src/timer.js`: add interval-state normalization, transition reconciliation, day snapshot validation, and daily usage projection. Keep supported-host and formatting helpers.
- Modify `test/timer.test.js`: cover interval state, transitions, privacy shape validation, and usage computation.
- Modify `src/background-controller.js`: replace elapsed-snapshot controller with timestamp-only day-state controller.
- Modify `test/background-controller.test.js`: cover start/stop transitions, dedupe, serialization, and timestamp-only broadcasts.
- Modify `src/background.js`: wire `SOCIAL_TIMER_SYNC`, Chrome event wakeups, local storage key, and timestamp-only broadcasts.
- Modify `src/content-view.js`: validate `SOCIAL_TIMER_DAY` and project interval state locally.
- Modify `src/content.js`: request/sync day state with the worker and render from returned interval data.
- Modify `test/content-view.test.js`: cover day-state projection and retry validation.
- Modify `README.md` and `PRIVACY.md`: update architecture/privacy wording to match timestamp-only interval storage.
- Modify `docs/specs/2026-06-09-daily-social-media-timer-design.md`: align older architecture notes with event intervals or point to the new spec.

## Task 1: Pure Interval Timer Logic

**Files:**
- Modify: `src/timer.js`
- Test: `test/timer.test.js`

- [ ] **Step 1: Add failing interval-state tests**

Add these tests to `test/timer.test.js`:

```js
import {
  computeDayElapsedMs,
  createDaySnapshot,
  normalizeDayState,
  reconcileDayState,
  shouldRetryDayResponse,
} from "../src/timer.js";

test("normalizes missing or corrupt day interval state", () => {
  assert.deepEqual(normalizeDayState(undefined, "2026-06-16"), {
    dateKey: "2026-06-16",
    intervals: [],
    active: null,
  });

  assert.deepEqual(
    normalizeDayState(
      {
        dateKey: "2026-06-16",
        intervals: [
          { startMs: 10, endMs: 30 },
          { startMs: 40, endMs: 35 },
          { startMs: Number.NaN, endMs: 50 },
        ],
        active: { startMs: 60 },
      },
      "2026-06-16",
    ),
    {
      dateKey: "2026-06-16",
      intervals: [{ startMs: 10, endMs: 30 }],
      active: { startMs: 60 },
    },
  );
});

test("resets interval state when local day changes", () => {
  assert.deepEqual(
    normalizeDayState(
      {
        dateKey: "2026-06-15",
        intervals: [{ startMs: 10, endMs: 30 }],
        active: { startMs: 40 },
      },
      "2026-06-16",
    ),
    {
      dateKey: "2026-06-16",
      intervals: [],
      active: null,
    },
  );
});

test("reconciles start and stop transitions without duplicate active intervals", () => {
  const started = reconcileDayState(undefined, {
    nowMs: 1_000,
    dateKey: "2026-06-16",
    shouldCount: true,
  });

  assert.deepEqual(started, {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000 },
  });

  const repeated = reconcileDayState(started, {
    nowMs: 2_000,
    dateKey: "2026-06-16",
    shouldCount: true,
  });

  assert.deepEqual(repeated, started);

  assert.deepEqual(
    reconcileDayState(repeated, {
      nowMs: 5_000,
      dateKey: "2026-06-16",
      shouldCount: false,
    }),
    {
      dateKey: "2026-06-16",
      intervals: [{ startMs: 1_000, endMs: 5_000 }],
      active: null,
    },
  );
});

test("computes daily usage from intervals and active interval", () => {
  assert.equal(
    computeDayElapsedMs(
      {
        dateKey: "2026-06-16",
        intervals: [
          { startMs: 1_000, endMs: 6_000 },
          { startMs: 9_000, endMs: 11_000 },
        ],
        active: { startMs: 20_000 },
      },
      { nowMs: 30_000, dateKey: "2026-06-16" },
    ),
    17_000,
  );
});

test("creates timestamp-only day snapshots and rejects private fields", () => {
  const snapshot = createDaySnapshot({
    dateKey: "2026-06-16",
    intervals: [{ startMs: 1_000, endMs: 2_000 }],
    active: { startMs: 3_000 },
  });

  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_DAY",
    dateKey: "2026-06-16",
    intervals: [{ startMs: 1_000, endMs: 2_000 }],
    active: { startMs: 3_000 },
  });

  assert.equal(shouldRetryDayResponse(snapshot), false);
  assert.equal(
    shouldRetryDayResponse({
      ...snapshot,
      url: "https://example.com",
    }),
    true,
  );
  assert.equal(
    shouldRetryDayResponse({
      ...snapshot,
      intervals: [{ startMs: 1_000, endMs: 2_000, tabId: 7 }],
    }),
    true,
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test test/timer.test.js
```

Expected: FAIL with missing exports for `computeDayElapsedMs`, `createDaySnapshot`, `normalizeDayState`, `reconcileDayState`, and `shouldRetryDayResponse`.

- [ ] **Step 3: Implement interval helpers**

Add these exports to `src/timer.js`, keeping existing helpers:

```js
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeInterval(value) {
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, ["startMs", "endMs"]) ||
    !Number.isFinite(value.startMs) ||
    !Number.isFinite(value.endMs) ||
    value.endMs < value.startMs
  ) {
    return null;
  }

  return {
    startMs: value.startMs,
    endMs: value.endMs,
  };
}

function normalizeActive(value) {
  if (
    value === null ||
    value === undefined ||
    !isPlainObject(value) ||
    !hasOnlyKeys(value, ["startMs"]) ||
    !Number.isFinite(value.startMs)
  ) {
    return null;
  }

  return { startMs: value.startMs };
}

export function normalizeDayState(value, dateKey) {
  if (!isPlainObject(value) || value.dateKey !== dateKey) {
    return { dateKey, intervals: [], active: null };
  }

  const intervals = Array.isArray(value.intervals)
    ? value.intervals.map(normalizeInterval).filter(Boolean)
    : [];

  return {
    dateKey,
    intervals,
    active: normalizeActive(value.active),
  };
}

export function reconcileDayState(rawState, { nowMs, dateKey, shouldCount }) {
  const state = normalizeDayState(rawState, dateKey);

  if (shouldCount) {
    return state.active === null
      ? { ...state, active: { startMs: nowMs } }
      : state;
  }

  if (state.active === null) {
    return state;
  }

  return {
    dateKey,
    intervals: [
      ...state.intervals,
      {
        startMs: state.active.startMs,
        endMs: Math.max(state.active.startMs, nowMs),
      },
    ],
    active: null,
  };
}

export function computeDayElapsedMs(rawState, { nowMs, dateKey }) {
  const state = normalizeDayState(rawState, dateKey);
  const completedMs = state.intervals.reduce(
    (total, interval) => total + Math.max(0, interval.endMs - interval.startMs),
    0,
  );
  const activeMs =
    state.active === null ? 0 : Math.max(0, nowMs - state.active.startMs);

  return completedMs + activeMs;
}

export function createDaySnapshot(rawState) {
  const state = normalizeDayState(rawState, rawState?.dateKey);
  return {
    type: "SOCIAL_TIMER_DAY",
    dateKey: state.dateKey,
    intervals: state.intervals,
    active: state.active,
  };
}

export function shouldRetryDayResponse(response) {
  if (
    !isPlainObject(response) ||
    !hasOnlyKeys(response, ["type", "dateKey", "intervals", "active"]) ||
    response.type !== "SOCIAL_TIMER_DAY" ||
    typeof response.dateKey !== "string" ||
    !Array.isArray(response.intervals)
  ) {
    return true;
  }

  const normalized = normalizeDayState(response, response.dateKey);
  return (
    normalized.intervals.length !== response.intervals.length ||
    (response.active !== null && normalized.active === null)
  );
}
```

- [ ] **Step 4: Run timer tests**

Run:

```bash
node --test test/timer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit pure interval logic**

```bash
git add src/timer.js test/timer.test.js
git commit -m "feat: add interval timer logic"
```

## Task 2: Background Controller Interval State

**Files:**
- Modify: `src/background-controller.js`
- Test: `test/background-controller.test.js`

- [ ] **Step 1: Replace controller tests with interval-state behavior**

Update `test/background-controller.test.js` so the core tests assert day snapshots:

```js
test("starts and broadcasts one active interval", async () => {
  let nowMs = 1_000;
  let shouldCount = true;
  const storage = createStorage(undefined);
  const snapshots = [];
  const controller = createBackgroundController({
    storage,
    getShouldCount: async () => shouldCount,
    broadcast: async (snapshot) => snapshots.push(snapshot),
    now: () => nowMs,
    getDateKey: () => "2026-06-16",
  });

  const snapshot = await controller.sync();

  assert.deepEqual(storage.value(), {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000 },
  });
  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_DAY",
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000 },
  });
  assert.deepEqual(snapshots.at(-1), snapshot);
});

test("closes active interval when counting stops", async () => {
  let nowMs = 5_000;
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
  assert.deepEqual(snapshot.active, null);
});

test("does not duplicate active interval on repeated sync", async () => {
  let nowMs = 2_000;
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
    active: { startMs: 1_000 },
  });
});
```

Keep the existing overlapping-request serialization test, but call `controller.sync()` and assert interval state:

```js
assert.deepEqual(storage.value(), {
  dateKey: "2026-06-16",
  intervals: [],
  active: { startMs: 1_000 },
});
```

- [ ] **Step 2: Run background-controller tests to verify failure**

Run:

```bash
node --test test/background-controller.test.js
```

Expected: FAIL because `sync()` does not exist and controller still returns elapsed snapshots.

- [ ] **Step 3: Implement interval controller**

Replace `src/background-controller.js` with:

```js
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
```

- [ ] **Step 4: Run background-controller tests**

Run:

```bash
node --test test/background-controller.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit controller changes**

```bash
git add src/background-controller.js test/background-controller.test.js
git commit -m "feat: record timer intervals in background controller"
```

## Task 3: Background Service Worker Wiring

**Files:**
- Modify: `src/background.js`
- Test: `test/background-controller.test.js`

- [ ] **Step 1: Add privacy regression test for broadcast snapshots**

Add this test to `test/background-controller.test.js`:

```js
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
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
node --test test/background-controller.test.js
```

Expected: PASS after Task 2 implementation, confirming snapshot privacy shape.

- [ ] **Step 3: Update worker message and sync names**

Modify `src/background.js`:

```js
const storageKey = "dailySocialTimerIntervals";
const alarmName = "social-timer-sync";
const alarmPeriodMinutes = 0.5;
```

Replace `reconcile()` with:

```js
function sync() {
  return controller.sync().catch((error) => {
    console.error("Social timer synchronization failed", error);
  });
}
```

Update all event listeners to call `sync`:

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void sync();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void sync();
});
chrome.tabs.onActivated.addListener(sync);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") {
    void sync();
  }
});
chrome.tabs.onRemoved.addListener(sync);
chrome.windows.onFocusChanged.addListener(sync);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    void sync();
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SOCIAL_TIMER_SYNC") {
    return false;
  }

  controller.getSnapshot().then(sendResponse).catch(() => sendResponse(null));
  return true;
});

void sync();
```

Remove `maxGapMs` from the controller constructor.

- [ ] **Step 4: Validate syntax**

Run:

```bash
npm run validate
```

Expected: PASS.

- [ ] **Step 5: Commit worker wiring**

```bash
git add src/background.js test/background-controller.test.js
git commit -m "feat: sync timer intervals from service worker"
```

## Task 4: Content Day-State Projection

**Files:**
- Modify: `src/content-view.js`
- Modify: `src/content.js`
- Test: `test/content-view.test.js`

- [ ] **Step 1: Add failing content projection tests**

Update `test/content-view.test.js` imports and tests:

```js
import {
  collapseUntil,
  getDelayToNextWallClockSecond,
  isPanelHidden,
  projectDayState,
  shouldRetryDayResponse,
} from "../src/content-view.js";

test("projects active day state forward for smooth local display", () => {
  assert.equal(
    projectDayState(
      {
        type: "SOCIAL_TIMER_DAY",
        dateKey: "2026-06-16",
        intervals: [{ startMs: 1_000, endMs: 6_000 }],
        active: { startMs: 10_000 },
      },
      { nowMs: 15_000, dateKey: "2026-06-16" },
    ),
    "00:00:10",
  );
});

test("does not render private fields in day responses", () => {
  assert.equal(
    shouldRetryDayResponse({
      type: "SOCIAL_TIMER_DAY",
      dateKey: "2026-06-16",
      intervals: [],
      active: null,
      url: "https://example.com",
    }),
    true,
  );
});
```

Replace existing `projectSnapshot` and `shouldRetrySnapshotResponse` references with `projectDayState` and `shouldRetryDayResponse`.

- [ ] **Step 2: Run content-view tests to verify failure**

Run:

```bash
node --test test/content-view.test.js
```

Expected: FAIL with missing exports or old snapshot shape mismatch.

- [ ] **Step 3: Update content-view pure helpers**

Replace snapshot projection exports in `src/content-view.js` with:

```js
import {
  computeDayElapsedMs,
  formatDuration,
  shouldRetryDayResponse as shouldRetryTimerDayResponse,
} from "./timer.js";

export function projectDayState(dayState, { nowMs, dateKey }) {
  if (shouldRetryDayResponse(dayState) || dayState.dateKey !== dateKey) {
    return formatDuration(0);
  }

  return formatDuration(computeDayElapsedMs(dayState, { nowMs, dateKey }));
}

export function shouldRetryDayResponse(response) {
  return shouldRetryTimerDayResponse(response);
}
```

Keep collapse and wall-clock helper exports unchanged.

- [ ] **Step 4: Update content script message flow**

In `src/content.js`, rename local `snapshot` state to `dayState`, request `SOCIAL_TIMER_SYNC`, and render with `projectDayState`:

```js
const syncRetryDelayMs = 1_000;
let dayState = null;
let syncRetryTimer;
```

```js
function render() {
  const nowMs = Date.now();
  timer.textContent = projectDayState(dayState, {
    nowMs,
    dateKey: localDateKey(nowMs),
  });
}
```

```js
async function requestSync() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SOCIAL_TIMER_SYNC",
    });

    if (shouldRetryDayResponse(response)) {
      scheduleSyncRetry();
      return;
    }

    dayState = response;
    clearSyncRetry();
    render();
  } catch {
    scheduleSyncRetry();
  }
}
```

Update message listener:

```js
chrome.runtime.onMessage.addListener((message) => {
  if (!shouldRetryDayResponse(message)) {
    dayState = message;
    clearSyncRetry();
    render();
  }
});
```

Replace calls to `requestSnapshot` with `requestSync`, and retry helpers with `clearSyncRetry` / `scheduleSyncRetry`.

- [ ] **Step 5: Run content tests**

Run:

```bash
node --test test/content-view.test.js test/content-style.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit content sync changes**

```bash
git add src/content-view.js src/content.js test/content-view.test.js
git commit -m "feat: render timer from interval day state"
```

## Task 5: Docs, Privacy, and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `docs/specs/2026-06-09-daily-social-media-timer-design.md`

- [ ] **Step 1: Update docs wording**

In `README.md`, update behavior/privacy wording to say:

```markdown
- Persists timestamp-only completed intervals and one active interval across reloads and Chrome restarts.
- Stores no URL, hostname, page title, tab id, origin, or account identifier.
```

In `PRIVACY.md`, ensure the data storage section says:

```markdown
The extension stores timestamp-only timer intervals in `chrome.storage.local`. Stored timer data contains the local date, completed interval start/end timestamps, and one optional active start timestamp. It does not store URLs, hostnames, page titles, tab IDs, origins, account identifiers, browsing history, or remote analytics data.
```

In `docs/specs/2026-06-09-daily-social-media-timer-design.md`, update architecture notes to reference:

```markdown
Current implementation note: later architecture stores timestamp-only same-day intervals plus one optional active interval. See `docs/specs/2026-06-16-event-interval-timer-design.md`.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run validate
```

Expected: both commands PASS.

- [ ] **Step 3: Inspect privacy-sensitive diff**

Run:

```bash
git diff -- src test README.md PRIVACY.md docs/specs
```

Expected:

- No persisted or returned state shape includes `url`, `hostname`, `tabId`, `title`, or `origin`.
- URL access remains only in manifest host matching, `isSupportedUrl`, and worker active-tab validation.
- Timer UI remains visually unchanged.

- [ ] **Step 4: Commit docs and verification changes**

```bash
git add README.md PRIVACY.md docs/specs/2026-06-09-daily-social-media-timer-design.md
git commit -m "docs: describe timestamp-only timer storage"
```

## Task 6: Final Integration Check

**Files:**
- No direct edits unless verification reveals a bug.

- [ ] **Step 1: Run complete suite from clean branch state**

Run:

```bash
npm test
npm run validate
git status --short
```

Expected:

- `npm test`: PASS
- `npm run validate`: PASS
- `git status --short`: empty

- [ ] **Step 2: Summarize commits**

Run:

```bash
git log --oneline --max-count=6
```

Expected recent commits include:

```text
docs: describe timestamp-only timer storage
feat: render timer from interval day state
feat: sync timer intervals from service worker
feat: record timer intervals in background controller
feat: add interval timer logic
docs: design event interval timer architecture
```

- [ ] **Step 3: Hand off for branch finishing**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch` to integrate or preserve the worktree branch according to user choice.
