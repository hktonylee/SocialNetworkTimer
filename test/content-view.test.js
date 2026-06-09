import test from "node:test";
import assert from "node:assert/strict";

import { projectSnapshot } from "../src/content-view.js";

test("projects active snapshot forward for smooth local display", () => {
  assert.equal(
    projectSnapshot(
      {
        dateKey: "2026-06-09",
        elapsedMs: 10_000,
        isCounting: true,
        syncedAtMs: 1_000,
      },
      {
        nowMs: 6_900,
        dateKey: "2026-06-09",
        maxLocalGapMs: 60_000,
      },
    ),
    "00:00:15",
  );
});

test("does not project inactive snapshot forward", () => {
  assert.equal(
    projectSnapshot(
      {
        dateKey: "2026-06-09",
        elapsedMs: 10_000,
        isCounting: false,
        syncedAtMs: 1_000,
      },
      {
        nowMs: 20_000,
        dateKey: "2026-06-09",
        maxLocalGapMs: 60_000,
      },
    ),
    "00:00:10",
  );
});

test("resets display when local day changes", () => {
  assert.equal(
    projectSnapshot(
      {
        dateKey: "2026-06-08",
        elapsedMs: 3_600_000,
        isCounting: true,
        syncedAtMs: 1_000,
      },
      {
        nowMs: 20_000,
        dateKey: "2026-06-09",
        maxLocalGapMs: 60_000,
      },
    ),
    "00:00:00",
  );
});

test("caps local projection after uncertain long gap", () => {
  assert.equal(
    projectSnapshot(
      {
        dateKey: "2026-06-09",
        elapsedMs: 0,
        isCounting: true,
        syncedAtMs: 1_000,
      },
      {
        nowMs: 600_000,
        dateKey: "2026-06-09",
        maxLocalGapMs: 60_000,
      },
    ),
    "00:01:00",
  );
});

test("renders zero for malformed snapshots", () => {
  assert.equal(
    projectSnapshot(null, {
      nowMs: 20_000,
      dateKey: "2026-06-09",
      maxLocalGapMs: 60_000,
    }),
    "00:00:00",
  );
});
