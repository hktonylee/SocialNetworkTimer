# Social Network Daily Timer

Chrome extension showing one shared daily social-media usage timer at bottom center of supported pages.

![Social Network Daily Timer showing a red glass timer at bottom center](docs/images/social-network-daily-timer.png)

## Behavior

- Counts only active social tab in focused Chrome window.
- Never double-counts multiple tabs or windows.
- Persists total across reloads and Chrome restarts.
- Resets at local midnight.
- Stops counting on unsupported pages or when Chrome loses focus.
- Limits uncertain long gaps caused by device sleep.
- Circular collapse button hides timer in current tab for one minute.

Supported sites:

- Facebook
- Instagram
- X / Twitter
- Reddit
- TikTok
- LinkedIn
- YouTube
- Threads
- Bluesky

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select this project folder.

## Development

```bash
npm test
npm run validate
```

No build step or third-party dependencies required.

## Permissions

- `storage`: save current day's total.
- `tabs`: identify active supported page and synchronize visible timers.
- `alarms`: reconcile persisted time while extension service worker is suspended.
- Supported-site host permissions: inject timer UI only on listed sites.
