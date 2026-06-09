import { formatDuration } from "./timer.js";

export function getDelayToNextWallClockSecond(nowMs = Date.now()) {
  const remainderMs = Math.max(0, Math.floor(nowMs)) % 1_000;
  return remainderMs === 0 ? 1_000 : 1_000 - remainderMs;
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
