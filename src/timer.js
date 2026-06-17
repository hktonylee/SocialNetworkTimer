export const enabledSocialSitesStorageKey = "enabledSocialSites";

export const socialSites = [
  { id: "facebook", label: "Facebook", domains: ["facebook.com"] },
  { id: "instagram", label: "Instagram", domains: ["instagram.com"] },
  { id: "x", label: "X / Twitter", domains: ["x.com", "twitter.com"] },
  { id: "reddit", label: "Reddit", domains: ["reddit.com"] },
  { id: "tiktok", label: "TikTok", domains: ["tiktok.com"] },
  { id: "linkedin", label: "LinkedIn", domains: ["linkedin.com"] },
  { id: "youtube", label: "YouTube", domains: ["youtube.com"] },
  { id: "threads", label: "Threads", domains: ["threads.com", "threads.net"] },
  { id: "bluesky", label: "Bluesky", domains: ["bsky.app"] },
];

function isHostOrSubdomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function defaultEnabledSiteIds() {
  return socialSites.map((site) => site.id);
}

export function normalizeEnabledSiteIds(value) {
  if (!Array.isArray(value)) {
    return defaultEnabledSiteIds();
  }

  const enabled = new Set(value.filter((id) => typeof id === "string"));
  return socialSites
    .filter((site) => enabled.has(site.id))
    .map((site) => site.id);
}

export function getSiteForUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return socialSites.find((site) =>
      site.domains.some((domain) => isHostOrSubdomain(url.hostname, domain)),
    ) ?? null;
  } catch {
    return null;
  }
}

export function isSupportedUrl(value, enabledSiteIds = defaultEnabledSiteIds()) {
  const site = getSiteForUrl(value);
  if (site === null) {
    return false;
  }

  return new Set(normalizeEnabledSiteIds(enabledSiteIds)).has(site.id);
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
  const dateKey = typeof rawState?.dateKey === "string" ? rawState.dateKey : "";
  const state = normalizeDayState(rawState, dateKey);
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
