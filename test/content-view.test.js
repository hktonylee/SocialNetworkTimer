import test from "node:test";
import assert from "node:assert/strict";

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
        dateKey: "2026-06-09",
        intervals: [{ startMs: 1_000, endMs: 6_000 }],
        active: { startMs: 10_000, lastHeartbeatMs: 10_000 },
      },
      {
        nowMs: 15_000,
        dateKey: "2026-06-09",
      },
    ),
    "00:00:10",
  );
});

test("does not project inactive day state forward", () => {
  assert.equal(
    projectDayState(
      {
        type: "SOCIAL_TIMER_DAY",
        dateKey: "2026-06-09",
        intervals: [{ startMs: 1_000, endMs: 11_000 }],
        active: null,
      },
      {
        nowMs: 20_000,
        dateKey: "2026-06-09",
      },
    ),
    "00:00:10",
  );
});

test("resets display when local day changes", () => {
  assert.equal(
    projectDayState(
      {
        type: "SOCIAL_TIMER_DAY",
        dateKey: "2026-06-08",
        intervals: [{ startMs: 1_000, endMs: 3_601_000 }],
        active: { startMs: 4_000, lastHeartbeatMs: 4_000 },
      },
      {
        nowMs: 20_000,
        dateKey: "2026-06-09",
      },
    ),
    "00:00:00",
  );
});

test("renders zero for malformed day state", () => {
  assert.equal(
    projectDayState(null, {
      nowMs: 20_000,
      dateKey: "2026-06-09",
    }),
    "00:00:00",
  );
});

test("retries page-load day state requests until valid response arrives", () => {
  assert.equal(shouldRetryDayResponse(null), true);
  assert.equal(shouldRetryDayResponse({ type: "OTHER" }), true);
  assert.equal(
    shouldRetryDayResponse({ type: "SOCIAL_TIMER_DAY" }),
    true,
  );
  assert.equal(
    shouldRetryDayResponse({
      type: "SOCIAL_TIMER_DAY",
      dateKey: "2026-06-09",
      intervals: [],
      active: null,
    }),
    false,
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

test("aligns first timer tick to next wall clock second", () => {
  assert.equal(getDelayToNextWallClockSecond(1_234), 766);
  assert.equal(getDelayToNextWallClockSecond(1_999), 1);
  assert.equal(getDelayToNextWallClockSecond(2_000), 1_000);
});

test("creates one-minute collapse expiry", () => {
  assert.equal(collapseUntil(1_000), 61_000);
});

test("hides panel only while stored expiry is in future", () => {
  assert.equal(isPanelHidden("61000", 1_000), true);
  assert.equal(isPanelHidden("61000", 61_000), false);
  assert.equal(isPanelHidden("bad", 1_000), false);
  assert.equal(isPanelHidden(null, 1_000), false);
});
