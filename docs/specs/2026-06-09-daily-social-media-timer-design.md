# Daily Social Media Timer Design

## Goal

Create Google Chrome Manifest V3 extension showing one shared daily social-media usage timer on supported sites.

## Supported Sites

- Facebook
- Instagram
- X / Twitter
- Reddit
- TikTok
- LinkedIn
- YouTube
- Threads
- Bluesky

## Counting Rules

- Count time only when supported social-media page is active tab in focused Chrome window.
- Count at most one second per elapsed second, regardless of open social tabs or windows.
- Stop counting when active tab is unsupported, Chrome window loses focus, or Chrome is suspended.
- Persist daily total across reloads, tab closures, and Chrome restarts.
- Reset total at local midnight.
- Use elapsed timestamps rather than interval tick count so service-worker suspension does not lose active usage time.
- Cap a single elapsed update to a short inactivity threshold. This prevents device sleep or delayed service-worker wakeups from adding long inactive periods.

## Architecture

### Background Service Worker

Owns timer state and is sole writer to persisted usage.

Responsibilities:

- Detect active-tab and focused-window changes through Chrome tab/window events.
- Determine whether current active URL belongs to supported site.
- Reconcile elapsed usage whenever relevant browser state changes or periodic alarm fires.
- Store current local date, accumulated milliseconds, and active-session start timestamp in `chrome.storage.local`.
- Reset stale state when stored local date differs from current local date.
- Broadcast updated total to supported tabs.

### Content Script

Runs on supported pages.

Responsibilities:

- Create isolated timer UI inside Shadow DOM.
- Request current daily total from background service worker.
- Receive timer updates and render shared total.
- Remove or recreate UI safely if page scripts modify DOM.

### Shared Timer Logic

Pure functions handle:

- Supported-host matching.
- Local date key generation.
- Elapsed-time reconciliation.
- Inactivity cap.
- `HH:MM:SS` formatting.

Pure logic remains independent from Chrome APIs for unit testing.

## Data Flow

1. Extension starts or browser activity changes.
2. Background worker loads persisted state and reconciles elapsed active usage.
3. Background worker queries focused window's active tab.
4. Supported active tab starts or continues active session; other state stops session.
5. Worker persists reconciled state and broadcasts total.
6. Content scripts render broadcast total.
7. Periodic Chrome alarm wakes worker, reconciles state, persists it, and refreshes visible timers.

## Timer UI

- Fixed at bottom center of viewport.
- Large red `HH:MM:SS` text.
- Frosted white/gray translucent background.
- Rounded top-left and top-right corners.
- Subtle border, shadow, and backdrop blur for glass effect.
- High `z-index`.
- Non-interactive (`pointer-events: none`) so page controls remain usable.
- Shadow DOM isolates styles from host page.
- Respect safe-area bottom inset.

## Error Handling

- Ignore unsupported or unreadable URLs.
- Treat missing/corrupt persisted state as zero usage for current local date.
- Retry display synchronization when service worker is temporarily unavailable.
- Avoid counting uncertain long gaps caused by sleep or suspended execution.

## Permissions

- `storage`: persist daily total.
- `tabs`: inspect active tab URL and send updates.
- `alarms`: periodically reconcile and refresh timer.
- Host permissions limited to supported social-media domains.

## Testing

Unit tests:

- Supported and unsupported host matching.
- Timer formatting, including totals over 24 hours.
- Active-session elapsed reconciliation.
- No counting while inactive.
- No double counting across state changes.
- Inactivity-gap cap.
- Local-date reset.
- Corrupt-state recovery.

Integration-oriented tests:

- Background controller responds to tab/window focus changes.
- Persisted total survives controller restart.
- Content timer renders shared updates.

Manual verification:

- Load unpacked extension in Chrome.
- Confirm timer appears on every supported site.
- Confirm one shared total across supported tabs.
- Confirm only focused active social tab advances total.
- Confirm unsupported tabs and unfocused Chrome stop total.
- Confirm reload and Chrome restart preserve total.
- Confirm local-day change resets total.

## Acceptance Criteria

- Supported pages show one bottom-center glass timer with large red digits.
- All supported pages display same daily total.
- Total advances only while supported page is active tab in focused Chrome window.
- Multiple social tabs/windows never increase counting rate.
- Total persists across reloads and Chrome restarts.
- Total resets at local midnight.
- Device sleep and long service-worker suspension do not add long inactive gaps.
- Automated tests cover core counting, reset, persistence, host matching, and formatting behavior.
