import { describe, expect, it } from "vitest";
import type { Segment } from "../types";
import { currentSegmentIndex, formatPreciseTime, nearestSnapPoint } from "./segments";

describe("segment navigation", () => {
  const segments: Segment[] = [
    { id: "silence-0", start: 1, end: 3, replayStart: 0.85 },
    { id: "silence-1", start: 4, end: 6, replayStart: 3.85 },
  ];

  it("keeps the analysis preroll available for replay", () => {
    expect(segments[0].replayStart).toBeCloseTo(0.85);
    expect(segments[1].replayStart).toBeCloseTo(3.85);
  });

  it("keeps the previous segment active in a gap", () => {
    expect(currentSegmentIndex(segments, 3.5)).toBe(0);
    expect(currentSegmentIndex(segments, 4.5)).toBe(1);
  });

  it("snaps a selection handle to a nearby boundary", () => {
    expect(nearestSnapPoint(3.12, segments)).toBe(3);
    expect(nearestSnapPoint(3.4, segments)).toBe(3.4);
    expect(nearestSnapPoint(3.12, segments, { disabled: true })).toBe(3.12);
  });

  it("formats draft selection times to tenths of a second", () => {
    expect(formatPreciseTime(62.34)).toBe("01:02.3");
    expect(formatPreciseTime(3661.96)).toBe("1:01:02.0");
  });
});
