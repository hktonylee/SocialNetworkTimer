# Event Interval Timer Design

## Goal

Rework the timer architecture so Chrome Manifest V3 background service-worker lifetime does not control timer correctness. The background worker records browser activity transitions. Pages render from persisted same-day intervals and one optional active interval with a heartbeat.

## Problem

The current background worker owns a rolling elapsed counter. Chrome can suspend the worker at arbitrary times, so delayed wakeups can make elapsed-time reconciliation depend on gap caps and alarm timing. The timer should instead be derived from durable start and stop records.

## Architecture

### Background Service Worker

The worker becomes an event recorder and browser-state arbiter.

Responsibilities:

- Wake on content-script messages, tab activation, tab updates, tab removal, window focus changes, startup, install, and periodic alarms.
- Validate the current focused-window active tab with Chrome APIs before recording any active interval.
- Start a new active interval when the focused active tab is supported and no matching active interval exists.
- Refresh the active interval heartbeat while counting continues.
- Close the active interval when Chrome loses focus, the active tab becomes unsupported, the tab changes, or the active tab closes.
- Store only timing data in `chrome.storage.local`.
- Return only timing data to content scripts.

The worker may inspect a tab URL transiently to determine whether a page is supported. It must not store URLs, return URLs, store hostnames, or return hostnames.

### Content Script

The content script remains the page UI owner.

Responsibilities:

- Create the Shadow DOM timer UI.
- On supported page load, visibility changes, and periodic sync, request today's timer data.
- Send a page-active sync message that wakes the worker.
- Render the timer by computing today's usage from returned intervals.
- Tick locally once per second while an active interval is open.

The content script may wake the worker, but it is not trusted as the source of browser activity truth. The worker validates active/focused tab state before mutating storage.

### Shared Timer Logic

Pure functions remain independent from Chrome APIs.

Responsibilities:

- Supported-host matching.
- Local date key generation.
- State normalization.
- Transition reconciliation.
- Daily usage calculation from completed intervals and one open interval.
- `HH:MM:SS` formatting.

## Storage Model

Use one local-only storage key, replacing the rolling elapsed state:

```js
{
  dateKey: "2026-06-16",
  intervals: [
    { startMs: 1718560000000, endMs: 1718560030000 }
  ],
  active: {
    startMs: 1718560100000,
    lastHeartbeatMs: 1718560160000
  }
}
```

Rules:

- `intervals` contains completed intervals for the current local day.
- `active` is either `null` or one open interval with its latest heartbeat timestamp.
- No URL, hostname, title, tab id, or origin is persisted.
- If stored `dateKey` differs from current local date, reset to an empty current-day state.
- Ignore invalid intervals where timestamps are non-finite or `endMs < startMs`.
- Treat legacy active intervals without `lastHeartbeatMs` as if their heartbeat equals `startMs`.

## Message Contract

Content script requests:

```js
{ type: "SOCIAL_TIMER_SYNC" }
```

Worker responses:

```js
{
  type: "SOCIAL_TIMER_DAY",
  dateKey: "2026-06-16",
  intervals: [{ startMs: 1718560000000, endMs: 1718560030000 }],
  active: { startMs: 1718560100000, lastHeartbeatMs: 1718560160000 }
}
```

Rules:

- Response contains only timestamps and date key.
- `active` is `null` when counting is stopped.
- Broadcasts use the same `SOCIAL_TIMER_DAY` shape.
- Invalid or unavailable responses cause the content script to retry.

## Transition Rules

On each worker wake:

1. Load current-day state from storage.
2. Query focused Chrome window and active tab.
3. Determine `shouldCount` from focused state and supported URL.
4. If `shouldCount` is true and `active` is null, set `active = { startMs: nowMs, lastHeartbeatMs: nowMs }`.
5. If `shouldCount` is true and `active` exists, refresh `active.lastHeartbeatMs = nowMs`.
6. If the active heartbeat is stale by more than 75 seconds, close the old interval at `active.lastHeartbeatMs + 75_000` and start a fresh active interval if `shouldCount` is true.
7. If `shouldCount` is false and `active` exists, append `{ startMs: active.startMs, endMs: min(nowMs, active.lastHeartbeatMs + 75_000) }` to `intervals` and clear `active`.
8. Persist state.
9. Return or broadcast the day state.

This makes worker suspension safe: a killed worker does not need to tick. The next wake either keeps the open interval active, closes it at the observed transition time, or caps a stale interval at the last heartbeat plus 75 seconds.

## Daily Usage Calculation

Initial calculation:

- Sum every completed interval's `endMs - startMs`.
- If `active` exists and date key is current day, add `min(nowMs, active.lastHeartbeatMs + 75_000) - active.startMs`.
- Clamp negative durations to zero.

The calculation lives behind one pure function so future scoring rules can change without changing storage or message contracts.

## Privacy

The extension stores and returns local timing data only.

Disallowed persisted or returned fields:

- URL
- hostname
- tab id
- page title
- origin
- account identifiers

Chrome tab URLs are only read inside the worker to decide whether the active page is supported.

## Testing

Unit tests:

- Starting an interval when a supported focused tab becomes active.
- Closing an interval when focus or supported status is lost.
- No duplicate active interval from repeated sync messages.
- Refreshing the active heartbeat while counting continues.
- Capping stale active intervals at the last heartbeat plus 75 seconds.
- Resetting stored state on local day change.
- Rejecting malformed interval state.
- Computing daily usage from intervals plus open active interval.
- Snapshot validation rejects URL, hostname, and tab id fields.

Integration-oriented tests:

- Content sync wakes worker and receives timestamp-only day state.
- Broadcast shape contains no URL-like fields.
- Existing timer UI projects active interval locally.

## Acceptance Criteria

- Background worker no longer stores a rolling elapsed counter.
- Timer display derives from current-day intervals and optional active interval heartbeat.
- Background worker may be suspended without losing active timing continuity.
- Browser-closed active time is capped at the last heartbeat plus 75 seconds.
- Storage and content responses contain no URL, hostname, title, tab id, or origin.
- Multiple tabs/windows still cannot double-count.
- Existing timer UI behavior remains visually unchanged.
