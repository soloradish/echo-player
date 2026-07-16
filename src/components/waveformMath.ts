export interface TimelineView {
  start: number;
  duration: number;
}

const TIME_STEP_CANDIDATES = [
  1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 900, 1800,
  3600, 7200, 10800, 21600, 43200, 86400,
] as const;

export function overviewTimelineTicks(
  duration: number,
  width: number,
  minimumSpacing = 64,
): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  if (!Number.isFinite(width) || width <= 0 || width < minimumSpacing * 2) return [0, duration];

  const maximumIntervals = Math.max(1, Math.floor(width / minimumSpacing));
  const minimumStep = duration / maximumIntervals;
  const step = TIME_STEP_CANDIDATES.find((candidate) => candidate >= minimumStep)
    ?? Math.ceil(minimumStep / 86400) * 86400;
  const ticks = [0];

  for (let time = step; time < duration; time += step) {
    const position = (time / duration) * width;
    if (position >= minimumSpacing && width - position >= minimumSpacing) ticks.push(time);
  }

  ticks.push(duration);
  return ticks;
}

export function clampViewStart(start: number, viewDuration: number, mediaDuration: number): number {
  return Math.max(0, Math.min(start, Math.max(0, mediaDuration - viewDuration)));
}

export function viewAround(center: number, requestedDuration: number, mediaDuration: number): TimelineView {
  const duration = Math.max(0.01, Math.min(requestedDuration, mediaDuration));
  return {
    start: clampViewStart(center - duration / 2, duration, mediaDuration),
    duration,
  };
}

export function timeToPercent(time: number, view: TimelineView): number {
  return ((time - view.start) / view.duration) * 100;
}

export function clientXToTime(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">,
  view: TimelineView,
): number {
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  return view.start + Math.max(0, Math.min(1, ratio)) * view.duration;
}

export function snapRadiusForView(viewDuration: number, width: number): number {
  if (width <= 0) return 0.25;
  return Math.max(0.08, Math.min(0.35, (viewDuration * 8) / width));
}
