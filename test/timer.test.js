import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultEnabledSiteIds,
  computeDayElapsedMs,
  createDaySnapshot,
  formatDuration,
  isSupportedUrl,
  normalizeDayState,
  normalizeEnabledSiteIds,
  normalizeState,
  reconcileDayState,
  reconcileState,
  socialSites,
  shouldRetryDayResponse,
} from "../src/timer.js";

const minute = 60_000;

test("recognizes supported social domains and subdomains", () => {
  assert.equal(isSupportedUrl("https://www.facebook.com/feed"), true);
  assert.equal(isSupportedUrl("https://old.reddit.com/r/test"), true);
  assert.equal(isSupportedUrl("https://x.com/home"), true);
  assert.equal(isSupportedUrl("https://www.threads.com/"), true);
  assert.equal(isSupportedUrl("https://bsky.app/"), true);
});

test("rejects lookalike, unsupported, and invalid URLs", () => {
  assert.equal(isSupportedUrl("https://facebook.com.example.com"), false);
  assert.equal(isSupportedUrl("https://example.com/?next=reddit.com"), false);
  assert.equal(isSupportedUrl("chrome://extensions"), false);
  assert.equal(isSupportedUrl(undefined), false);
});

test("enables every social site when no setting is stored", () => {
  assert.deepEqual(
    normalizeEnabledSiteIds(undefined),
    socialSites.map((site) => site.id),
  );
  assert.deepEqual(defaultEnabledSiteIds(), socialSites.map((site) => site.id));
  assert.equal(isSupportedUrl("https://www.youtube.com/watch"), true);
});

test("filters supported URLs through enabled site ids", () => {
  const enabledSiteIds = defaultEnabledSiteIds().filter((id) => id !== "youtube");

  assert.equal(
    isSupportedUrl("https://www.youtube.com/watch", enabledSiteIds),
    false,
  );
  assert.equal(
    isSupportedUrl("https://old.reddit.com/r/test", enabledSiteIds),
    true,
  );
});

test("keeps an empty enabled site list disabled instead of defaulting it", () => {
  assert.deepEqual(normalizeEnabledSiteIds([]), []);
  assert.equal(isSupportedUrl("https://www.facebook.com/feed", []), false);
});

test("formats duration without wrapping after 24 hours", () => {
  assert.equal(formatDuration(0), "00:00:00");
  assert.equal(formatDuration(3_661_900), "01:01:01");
  assert.equal(formatDuration(90_061_000), "25:01:01");
});

test("normalizes missing or corrupt state", () => {
  assert.deepEqual(normalizeState(undefined, "2026-06-09"), {
    dateKey: "2026-06-09",
    elapsedMs: 0,
    activeSinceMs: null,
  });
  assert.deepEqual(
    normalizeState(
      { dateKey: 4, elapsedMs: -2, activeSinceMs: "bad" },
      "2026-06-09",
    ),
    {
      dateKey: "2026-06-09",
      elapsedMs: 0,
      activeSinceMs: null,
    },
  );
});

test("counts active elapsed time once and starts next active period", () => {
  const state = {
    dateKey: "2026-06-09",
    elapsedMs: 5_000,
    activeSinceMs: 1_000,
  };

  assert.deepEqual(
    reconcileState(state, {
      nowMs: 11_000,
      dateKey: "2026-06-09",
      shouldCount: true,
      maxGapMs: 2 * minute,
    }),
    {
      dateKey: "2026-06-09",
      elapsedMs: 15_000,
      activeSinceMs: 11_000,
    },
  );
});

test("stops counting while inactive", () => {
  assert.deepEqual(
    reconcileState(
      {
        dateKey: "2026-06-09",
        elapsedMs: 5_000,
        activeSinceMs: 1_000,
      },
      {
        nowMs: 11_000,
        dateKey: "2026-06-09",
        shouldCount: false,
        maxGapMs: 2 * minute,
      },
    ),
    {
      dateKey: "2026-06-09",
      elapsedMs: 15_000,
      activeSinceMs: null,
    },
  );
});

test("caps uncertain long active gaps", () => {
  assert.deepEqual(
    reconcileState(
      {
        dateKey: "2026-06-09",
        elapsedMs: 0,
        activeSinceMs: 1_000,
      },
      {
        nowMs: 10 * minute + 1_000,
        dateKey: "2026-06-09",
        shouldCount: true,
        maxGapMs: 2 * minute,
      },
    ),
    {
      dateKey: "2026-06-09",
      elapsedMs: 2 * minute,
      activeSinceMs: 10 * minute + 1_000,
    },
  );
});

test("resets current-day total after local midnight", () => {
  assert.deepEqual(
    reconcileState(
      {
        dateKey: "2026-06-08",
        elapsedMs: 30 * minute,
        activeSinceMs: Date.parse("2026-06-08T23:59:50"),
      },
      {
        nowMs: Date.parse("2026-06-09T00:00:10"),
        dateKey: "2026-06-09",
        shouldCount: true,
        maxGapMs: 2 * minute,
      },
    ),
    {
      dateKey: "2026-06-09",
      elapsedMs: 10_000,
      activeSinceMs: Date.parse("2026-06-09T00:00:10"),
    },
  );
});

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
      active: { startMs: 60, lastHeartbeatMs: 60 },
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
    active: { startMs: 1_000, lastHeartbeatMs: 1_000 },
  });

  const repeated = reconcileDayState(started, {
    nowMs: 2_000,
    dateKey: "2026-06-16",
    shouldCount: true,
  });

  assert.deepEqual(repeated, {
    dateKey: "2026-06-16",
    intervals: [],
    active: { startMs: 1_000, lastHeartbeatMs: 2_000 },
  });

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

test("refreshes active heartbeat while counting continues", () => {
  assert.deepEqual(
    reconcileDayState(
      {
        dateKey: "2026-06-16",
        intervals: [],
        active: { startMs: 1_000, lastHeartbeatMs: 2_000 },
      },
      {
        nowMs: 30_000,
        dateKey: "2026-06-16",
        shouldCount: true,
      },
    ),
    {
      dateKey: "2026-06-16",
      intervals: [],
      active: { startMs: 1_000, lastHeartbeatMs: 30_000 },
    },
  );
});

test("caps stale active intervals at last heartbeat plus grace", () => {
  assert.deepEqual(
    reconcileDayState(
      {
        dateKey: "2026-06-16",
        intervals: [{ startMs: 0, endMs: 500 }],
        active: { startMs: 1_000, lastHeartbeatMs: 10_000 },
      },
      {
        nowMs: 200_000,
        dateKey: "2026-06-16",
        shouldCount: true,
      },
    ),
    {
      dateKey: "2026-06-16",
      intervals: [
        { startMs: 0, endMs: 500 },
        { startMs: 1_000, endMs: 85_000 },
      ],
      active: { startMs: 200_000, lastHeartbeatMs: 200_000 },
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
        active: { startMs: 20_000, lastHeartbeatMs: 25_000 },
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
    active: { startMs: 3_000, lastHeartbeatMs: 3_000 },
  });

  assert.deepEqual(snapshot, {
    type: "SOCIAL_TIMER_DAY",
    dateKey: "2026-06-16",
    intervals: [{ startMs: 1_000, endMs: 2_000 }],
    active: { startMs: 3_000, lastHeartbeatMs: 3_000 },
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
