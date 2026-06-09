import { formatDuration } from "./timer.js";

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

export function projectSnapshot(
  snapshot,
  { nowMs, dateKey, maxLocalGapMs },
) {
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    snapshot.dateKey !== dateKey ||
    !Number.isFinite(snapshot.elapsedMs) ||
    snapshot.elapsedMs < 0 ||
    !Number.isFinite(snapshot.syncedAtMs)
  ) {
    return formatDuration(0);
  }

  const projectedMs = snapshot.isCounting
    ? Math.min(Math.max(0, nowMs - snapshot.syncedAtMs), maxLocalGapMs)
    : 0;
  return formatDuration(snapshot.elapsedMs + projectedMs);
}
