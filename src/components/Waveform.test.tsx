// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SelectionRange } from "./Waveform";
import { Waveform } from "./Waveform";

beforeAll(() => {
  class PointerEventMock extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("PointerEvent", PointerEventMock);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
});

afterEach(() => cleanup());

function setRect(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }),
  });
}

function renderWaveform(overrides: Partial<React.ComponentProps<typeof Waveform>> = {}) {
  const props: React.ComponentProps<typeof Waveform> = {
    duration: 10,
    peaks: [0.1, 0.4, 0.2],
    peaksPerSecond: 50,
    currentTime: 3,
    segments: [],
    activeSegment: -1,
    selection: null,
    selectionLocked: false,
    onSeek: vi.fn(),
    onSelect: vi.fn(),
    onSelectionConfirm: vi.fn(),
    ...overrides,
  };
  render(<Waveform {...props} />);
  const detail = screen.getByRole("slider", { name: "拖动选择要重复听的内容" });
  setRect(detail, 100, 112);
  const overview = screen.queryByRole("slider", { name: "点击整段音频进行快速定位" });
  if (overview) setRect(overview, 100, 36);
  return { detail, overview, props };
}

function SelectionHarness({ onConfirm }: { onConfirm: (selection: SelectionRange) => void }) {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  return (
    <Waveform
      duration={10}
      peaks={[0.1, 0.4, 0.2]}
      peaksPerSecond={50}
      currentTime={3}
      segments={[]}
      activeSegment={-1}
      selection={selection}
      selectionLocked={false}
      onSeek={vi.fn()}
      onSelect={setSelection}
      onSelectionConfirm={onConfirm}
    />
  );
}

describe("dual waveform timeline", () => {
  it("creates an editable draft without starting the loop on pointer up", () => {
    const onSelect = vi.fn();
    const onSelectionConfirm = vi.fn();
    const { detail } = renderWaveform({ onSelect, onSelectionConfirm });

    fireEvent.pointerDown(detail, { pointerId: 1, clientX: 20 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 60 });
    fireEvent.pointerUp(detail, { pointerId: 1, clientX: 60 });

    expect(onSelect).toHaveBeenLastCalledWith({ start: 2, end: 6 });
    expect(onSelectionConfirm).not.toHaveBeenCalled();
  });

  it("keeps an existing draft when the detail waveform is clicked to seek", () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    const selection = { start: 2, end: 6 };
    const { detail } = renderWaveform({ selection, onSeek, onSelect });

    fireEvent.pointerDown(detail, { pointerId: 2, clientX: 40 });
    fireEvent.pointerUp(detail, { pointerId: 2, clientX: 41 });

    expect(onSeek).toHaveBeenCalledOnce();
    expect(onSeek.mock.calls[0][0]).toBeCloseTo(4.1);
    expect(onSelect).toHaveBeenLastCalledWith(selection);
    expect(onSelect).not.toHaveBeenCalledWith(null);
  });

  it("confirms a controlled draft only from the explicit action", () => {
    const onConfirm = vi.fn();
    render(<SelectionHarness onConfirm={onConfirm} />);
    const detail = screen.getByRole("slider", { name: "拖动选择要重复听的内容" });
    setRect(detail, 100, 112);

    fireEvent.pointerDown(detail, { pointerId: 3, clientX: 20 });
    fireEvent.pointerMove(detail, { pointerId: 3, clientX: 60 });
    fireEvent.pointerUp(detail, { pointerId: 3, clientX: 60 });

    expect(screen.getByRole("region", { name: "待确认的重复范围" })).toBeTruthy();
    expect(screen.getByText("00:02.0 — 00:06.0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "开始循环" }));
    expect(onConfirm).toHaveBeenCalledWith({ start: 2, end: 6 });
  });

  it("uses smart snapping and lets Alt bypass it", () => {
    const onSelect = vi.fn();
    const segments = [{ id: "one", start: 1, end: 3, replayStart: 0.85 }];
    const { detail } = renderWaveform({ segments, onSelect });

    fireEvent.pointerDown(detail, { pointerId: 4, clientX: 12 });
    fireEvent.pointerMove(detail, { pointerId: 4, clientX: 32 });
    expect(onSelect).toHaveBeenLastCalledWith({ start: 1, end: 3 });

    fireEvent.pointerMove(detail, { pointerId: 4, clientX: 32, altKey: true });
    expect(onSelect).toHaveBeenLastCalledWith({ start: 1, end: 3.2 });
  });

  it("lets the overview click seek and clear a draft", () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    const { overview } = renderWaveform({
      duration: 120,
      currentTime: 60,
      selection: { start: 50, end: 55 },
      onSeek,
      onSelect,
    });
    expect(overview).toBeTruthy();
    expect(screen.getByText("快速定位")).toBeTruthy();
    expect(screen.getByText("点击跳转")).toBeTruthy();

    fireEvent.pointerDown(overview!, { pointerId: 5, clientX: 63 });
    fireEvent.pointerUp(overview!, { pointerId: 5, clientX: 63 });

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onSeek).toHaveBeenCalledOnce();
    expect(onSeek.mock.calls[0][0]).toBeCloseTo(75.6);
  });

  it("previews the exact overview time under the pointer and clears it on leave", () => {
    const { overview } = renderWaveform({ duration: 120, currentTime: 60 });

    fireEvent.pointerMove(overview!, { pointerId: 8, clientX: 75 });
    expect(screen.getByText("01:30")).toBeTruthy();

    fireEvent.pointerLeave(overview!, { pointerId: 8, clientX: 75 });
    expect(screen.queryByText("01:30")).toBeNull();
  });

  it("provides keyboard navigation and prevents zoom levels smaller than the draft", () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    const { overview } = renderWaveform({
      duration: 120,
      currentTime: 60,
      selection: { start: 5, end: 55 },
      onSeek,
      onSelect,
    });

    expect((screen.getByRole("option", { name: "20 秒" }) as HTMLOptionElement).disabled).toBe(true);
    expect((screen.getByRole("option", { name: "40 秒" }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.keyDown(overview!, { key: "PageDown" });
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onSeek).toHaveBeenCalledWith(100);
  });

  it("ignores drag gestures on the overview", () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    const { overview } = renderWaveform({ duration: 120, currentTime: 60, onSeek, onSelect });

    fireEvent.pointerDown(overview!, { pointerId: 6, clientX: 20 });
    fireEvent.pointerMove(overview!, { pointerId: 6, clientX: 40 });
    fireEvent.pointerUp(overview!, { pointerId: 6, clientX: 40 });

    expect(onSeek).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("locks both waveforms and hides the draft handles during a selection loop", () => {
    const onSelect = vi.fn();
    const { detail, overview } = renderWaveform({
      duration: 120,
      currentTime: 50,
      selection: { start: 48, end: 52 },
      selectionLocked: true,
      onSelect,
    });

    expect(screen.queryByRole("button", { name: "调整选区起点" })).toBeNull();
    expect(detail.getAttribute("aria-disabled")).toBe("true");
    expect(overview?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.pointerDown(detail, { pointerId: 7, clientX: 10 });
    fireEvent.pointerMove(detail, { pointerId: 7, clientX: 80 });
    fireEvent.pointerUp(detail, { pointerId: 7, clientX: 80 });
    fireEvent.pointerMove(overview!, { pointerId: 8, clientX: 75 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByText("01:30")).toBeNull();
  });

  it("shows task-oriented names and hides navigation when the whole media already fits", () => {
    renderWaveform();
    expect(screen.getByText("重复听")).toBeTruthy();
    expect(screen.getByText("拖动选择")).toBeTruthy();
    expect(screen.queryByText("快速定位")).toBeNull();
  });
});
