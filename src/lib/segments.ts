import type { Segment } from "../types";

export function currentSegmentIndex(segments: Segment[], time: number): number {
  if (!segments.length) return -1;
  const exact = segments.findIndex((segment) => time >= segment.start && time < segment.end);
  if (exact >= 0) return exact;

  let previous = -1;
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index].start <= time) previous = index;
    else break;
  }
  return previous < 0 ? 0 : previous;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatPreciseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.0";
  const totalTenths = Math.round(seconds * 10);
  const hours = Math.floor(totalTenths / 36000);
  const minutes = Math.floor((totalTenths % 36000) / 600);
  const secs = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  const secondsText = `${String(secs).padStart(2, "0")}.${tenths}`;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secondsText}`
    : `${String(minutes).padStart(2, "0")}:${secondsText}`;
}

export function clampRange(start: number, end: number, duration: number): [number, number] {
  const safeStart = Math.max(0, Math.min(start, duration));
  const safeEnd = Math.max(safeStart, Math.min(end, duration));
  return [safeStart, safeEnd];
}

export function nearestSnapPoint(
  time: number,
  segments: Segment[],
  options: { radius?: number; disabled?: boolean } = {},
): number {
  if (options.disabled) return time;
  const radius = options.radius ?? 0.25;
  const candidates = segments.flatMap((segment) => [segment.start, segment.end]);
  let nearest = time;
  let distance = radius;
  for (const candidate of candidates) {
    const nextDistance = Math.abs(candidate - time);
    if (nextDistance <= distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}
