// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { usePlayerStore } from "./store";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(() => Promise.resolve()) });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
});

beforeEach(() => {
  localStorage.clear();
  usePlayerStore.setState({ preferences: { volume: 0.85, speed: 1, loopGap: 0, language: "zh-CN" } });
  window.history.pushState({}, "", "/?demo=1");
});

afterEach(() => cleanup());

describe("loop range selector", () => {
  it("defaults to the whole audio and switches between the two loop ranges", () => {
    render(<App />);

    const selector = screen.getByRole("group", { name: "循环范围" });
    const segment = within(selector).getByRole("button", { name: "循环当前片段" });
    const media = within(selector).getByRole("button", { name: "循环整个音频" });

    expect(within(selector).queryByRole("button", { name: "不循环" })).toBeNull();
    expect(media.getAttribute("aria-pressed")).toBe("true");
    expect(usePlayerStore.getState().loop).toEqual({
      mode: "media",
      start: 0,
      end: 12,
      completed: 0,
      gap: 0,
    });
    expect(segment.textContent).toContain("00:04–00:07");
    expect(media.textContent).toContain("00:12");

    fireEvent.click(segment);
    expect(segment.getAttribute("aria-pressed")).toBe("true");
    expect(usePlayerStore.getState().loop).toEqual({
      mode: "segment",
      start: 4.05,
      end: 7.1,
      completed: 0,
      gap: 0,
    });

    fireEvent.click(media);
    expect(media.getAttribute("aria-pressed")).toBe("true");
    expect(usePlayerStore.getState().loop).toEqual({
      mode: "media",
      start: 0,
      end: 12,
      completed: 0,
      gap: 0,
    });

  });

  it("keeps L as a direct current-segment shortcut without obscuring whole-media mode", () => {
    render(<App />);
    const selector = screen.getByRole("group", { name: "循环范围" });
    const media = within(selector).getByRole("button", { name: "循环整个音频" });

    expect(media.getAttribute("aria-pressed")).toBe("true");
    expect(usePlayerStore.getState().loop.mode).toBe("media");

    fireEvent.keyDown(window, { key: "l" });
    expect(usePlayerStore.getState().loop.mode).toBe("segment");

    fireEvent.keyDown(window, { key: "l" });
    expect(usePlayerStore.getState().loop.mode).toBe("media");
  });
});
