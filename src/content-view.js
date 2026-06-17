import {
  computeDayElapsedMs,
  formatDuration,
  shouldRetryDayResponse as shouldRetryTimerDayResponse,
} from "./timer.js";

export function getDelayToNextWallClockSecond(nowMs = Date.now()) {
  const remainderMs = Math.max(0, Math.floor(nowMs)) % 1_000;
  return remainderMs === 0 ? 1_000 : 1_000 - remainderMs;
}

const collapseDurationMs = 60_000;

export function collapseUntil(nowMs) {
  return nowMs + collapseDurationMs;
}

export function isPanelHidden(storedExpiry, nowMs) {
  if (typeof storedExpiry !== "string" || storedExpiry.trim() === "") {
    return false;
  }

  const expiryMs = Number(storedExpiry);
  return Number.isFinite(expiryMs) && expiryMs > nowMs;
}

export function projectDayState(dayState, { nowMs, dateKey }) {
  if (shouldRetryDayResponse(dayState) || dayState.dateKey !== dateKey) {
    return formatDuration(0);
  }

  return formatDuration(computeDayElapsedMs(dayState, { nowMs, dateKey }));
}

export function shouldRetryDayResponse(response) {
  return shouldRetryTimerDayResponse(response);
}
