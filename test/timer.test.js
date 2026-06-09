import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDuration,
  isSupportedUrl,
  normalizeState,
  reconcileState,
} from "../src/timer.js";

const minute = 60_000;

test("recognizes supported social domains and subdomains", () => {
  assert.equal(isSupportedUrl("https://www.facebook.com/feed"), true);
  assert.equal(isSupportedUrl("https://old.reddit.com/r/test"), true);
  assert.equal(isSupportedUrl("https://x.com/home"), true);
  assert.equal(isSupportedUrl("https://bsky.app/"), true);
});

test("rejects lookalike, unsupported, and invalid URLs", () => {
  assert.equal(isSupportedUrl("https://facebook.com.example.com"), false);
  assert.equal(isSupportedUrl("https://example.com/?next=reddit.com"), false);
  assert.equal(isSupportedUrl("chrome://extensions"), false);
  assert.equal(isSupportedUrl(undefined), false);
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
