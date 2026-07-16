// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaybackIcon } from "./PlaybackIcon";

describe("PlaybackIcon", () => {
  it("draws a centered triangle while paused", () => {
    const view = render(<PlaybackIcon playing={false} />);
    expect(view.getByTestId("play-icon").tagName.toLowerCase()).toBe("path");
    expect(view.queryByTestId("pause-icon")).toBeNull();
  });

  it("draws two equal pause bars with a clear gap", () => {
    const view = render(<PlaybackIcon playing />);
    const bars = view.getByTestId("pause-icon").querySelectorAll("rect");
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute("width")).toBe(bars[1].getAttribute("width"));
    const firstEnd = Number(bars[0].getAttribute("x")) + Number(bars[0].getAttribute("width"));
    const gap = Number(bars[1].getAttribute("x")) - firstEnd;
    expect(gap).toBeGreaterThanOrEqual(3.5);
  });
});
