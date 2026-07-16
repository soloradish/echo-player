// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { loadPlayerPreferences, usePlayerStore } from "./store";

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
  usePlayerStore.setState({ preferences: { volume: 0.85, speed: 1, loopGap: 0, language: "zh-CN" }, error: null });
  window.history.pushState({}, "", "/?demo=1");
});

afterEach(() => cleanup());

describe("settings modal", () => {
  it("keeps playback settings in a single immediate-apply dialog", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "加载字幕" })).toBeNull();
    expect(document.querySelector(".subtitle-card")).toBeNull();
    const settingsButton = screen.getByRole("button", { name: "设置" });
    fireEvent.click(settingsButton);

    const dialog = screen.getByRole("dialog", { name: "设置" });
    expect(within(dialog).queryByLabelText("音量")).toBeNull();
    expect(within(dialog).queryByLabelText("字幕偏移")).toBeNull();
    expect(within(dialog).queryByText("字幕")).toBeNull();
    expect(screen.getByLabelText("音量")).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByLabelText("显示语言"));

    fireEvent.change(within(dialog).getByLabelText("段间停顿"), { target: { value: "1" } });
    fireEvent.change(within(dialog).getByLabelText("播放倍速"), { target: { value: "1.25" } });

    expect(usePlayerStore.getState().preferences).toEqual({ volume: 0.85, speed: 1.25, loopGap: 1, language: "zh-CN" });
    expect((document.querySelector("video") as HTMLVideoElement).playbackRate).toBe(1.25);
    expect(JSON.parse(localStorage.getItem("echo-player-preferences") ?? "{}")).toMatchObject({ speed: 1.25, loopGap: 1 });

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭设置" }));
    expect(screen.queryByRole("dialog", { name: "设置" })).toBeNull();
    expect(document.activeElement).toBe(settingsButton);
  });

  it("closes with Escape or the backdrop and keeps keyboard focus inside", () => {
    render(<App />);
    const settingsButton = screen.getByRole("button", { name: "设置" });
    fireEvent.click(settingsButton);

    let dialog = screen.getByRole("dialog", { name: "设置" });
    const closeButton = within(dialog).getByRole("button", { name: "关闭设置" });
    const playbackSpeed = within(dialog).getByLabelText("播放倍速");
    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(playbackSpeed);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "设置" })).toBeNull();

    fireEvent.click(settingsButton);
    dialog = screen.getByRole("dialog", { name: "设置" });
    const backdrop = screen.getByTestId("settings-backdrop");
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog", { name: "设置" })).toBeNull();
    expect(document.activeElement).toBe(settingsButton);
  });

  it("loads older saved preferences with the default loop gap", () => {
    localStorage.setItem("echo-player-preferences", JSON.stringify({ volume: 0.4, speed: 1.5 }));
    usePlayerStore.setState({ preferences: loadPlayerPreferences(localStorage, ["zh-CN"]) });
    render(<App />);

    expect(usePlayerStore.getState().preferences).toEqual({ volume: 0.4, speed: 1.5, loopGap: 0, language: "zh-CN" });
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect((screen.getByLabelText("段间停顿") as HTMLSelectElement).value).toBe("0");
  });

  it("switches the whole interface language immediately and persists it", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    fireEvent.change(screen.getByLabelText("显示语言"), { target: { value: "fr" } });

    expect(screen.getByRole("dialog", { name: "Paramètres" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Liste de lecture · 3" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("fr");
    expect(JSON.parse(localStorage.getItem("echo-player-preferences") ?? "{}")).toMatchObject({ language: "fr" });

    fireEvent.change(screen.getByLabelText("Langue d’affichage"), { target: { value: "zh-Hant" } });
    expect(screen.getByRole("dialog", { name: "設定" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "播放清單 · 3" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("zh-Hant");
  });

  it("retranslates structured errors while preserving technical details", () => {
    render(<App />);
    act(() => usePlayerStore.getState().setError({ code: "ffmpeg_unavailable", detail: "spawn ENOENT" }));

    expect(screen.getByRole("alert").textContent).toContain("无法启动内置音频分析引擎");
    expect(screen.getByRole("alert").textContent).toContain("spawn ENOENT");

    act(() => usePlayerStore.getState().setPreferences({ language: "en" }));
    expect(screen.getByRole("alert").textContent).toContain("The bundled audio analysis engine could not be started");
    expect(screen.getByRole("alert").textContent).toContain("spawn ENOENT");
  });
});
