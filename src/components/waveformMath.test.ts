import { describe, expect, it } from "vitest";
import {
  clampViewStart,
  clientXToTime,
  overviewTimelineTicks,
  snapRadiusForView,
  timeToPercent,
  viewAround,
} from "./waveformMath";

describe("waveform viewport math", () => {
  it("centers and clamps a detail view at both media edges", () => {
    expect(viewAround(5, 40, 120)).toEqual({ start: 0, duration: 40 });
    expect(viewAround(115, 40, 120)).toEqual({ start: 80, duration: 40 });
    expect(clampViewStart(40, 40, 120)).toBe(40);
  });

  it("maps time and pointer positions inside the active view", () => {
    const view = { start: 40, duration: 20 };
    expect(timeToPercent(45, view)).toBe(25);
    expect(clientXToTime(75, { left: 25, width: 100 }, view)).toBe(50);
  });

  it("keeps snapping near eight pixels while applying time limits", () => {
    expect(snapRadiusForView(40, 800)).toBeCloseTo(0.35);
    expect(snapRadiusForView(20, 2000)).toBe(0.08);
    expect(snapRadiusForView(120, 200)).toBe(0.35);
  });

  it("builds readable overview ticks from the media duration and available width", () => {
    expect(overviewTimelineTicks(120, 400)).toEqual([0, 30, 60, 90, 120]);
    expect(overviewTimelineTicks(7200, 400)).toEqual([0, 1800, 3600, 5400, 7200]);
  });

  it("keeps endpoints and removes interior ticks that would collide with them", () => {
    expect(overviewTimelineTicks(125, 400)).toEqual([0, 30, 60, 90, 125]);
    expect(overviewTimelineTicks(120, 100)).toEqual([0, 120]);
  });
});
