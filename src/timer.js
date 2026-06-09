const supportedHosts = [
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "threads.com",
  "threads.net",
  "bsky.app",
];

function isHostOrSubdomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isSupportedUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      supportedHosts.some((domain) => isHostOrSubdomain(url.hostname, domain))
    );
  } catch {
    return false;
  }
}

export function formatDuration(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function getLocalDateKey(nowMs = Date.now()) {
  const date = new Date(nowMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeState(value, dateKey) {
  const valid =
    value !== null &&
    typeof value === "object" &&
    typeof value.dateKey === "string" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    (value.activeSinceMs === null || Number.isFinite(value.activeSinceMs));

  if (!valid) {
    return { dateKey, elapsedMs: 0, activeSinceMs: null };
  }

  return {
    dateKey: value.dateKey,
    elapsedMs: value.elapsedMs,
    activeSinceMs: value.activeSinceMs,
  };
}

function localMidnightMs(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function reconcileState(
  rawState,
  { nowMs, dateKey, shouldCount, maxGapMs },
) {
  const state = normalizeState(rawState, dateKey);
  const dateChanged = state.dateKey !== dateKey;
  let elapsedMs = dateChanged ? 0 : state.elapsedMs;

  if (state.activeSinceMs !== null) {
    const activeStartMs = dateChanged
      ? Math.max(state.activeSinceMs, localMidnightMs(dateKey))
      : state.activeSinceMs;
    const activeGapMs = Math.max(0, nowMs - activeStartMs);
    elapsedMs += Math.min(activeGapMs, maxGapMs);
  }

  return {
    dateKey,
    elapsedMs,
    activeSinceMs: shouldCount ? nowMs : null,
  };
}
