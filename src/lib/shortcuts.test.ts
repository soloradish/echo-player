import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  formatShortcut,
  isValidShortcut,
  loadShortcutBindings,
  shortcutFromKeyboardEvent,
} from "./shortcuts";

describe("keyboard shortcut boundaries", () => {
  it("keeps the default controls in the left-hand keyboard area", () => {
    expect(DEFAULT_SHORTCUTS).toEqual({
      playPause: "Space",
      previousSegment: "KeyA",
      nextSegment: "KeyD",
      replaySegment: "KeyR",
      toggleLoopRange: "KeyS",
    });
  });

  it("normalizes supported Windows keyboard combinations", () => {
    expect(shortcutFromKeyboardEvent({
      code: "KeyK",
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
      isComposing: false,
    })).toBe("Ctrl+Shift+KeyK");
    expect(formatShortcut("Ctrl+Shift+KeyK")).toBe("Ctrl+Shift+K");
  });

  it("rejects reserved, malformed, and duplicate persisted bindings", () => {
    expect(isValidShortcut("Escape")).toBe(false);
    expect(isValidShortcut("Shift+Ctrl+KeyK")).toBe(false);
    expect(loadShortcutBindings({ ...DEFAULT_SHORTCUTS, nextSegment: "KeyA" })).toEqual(DEFAULT_SHORTCUTS);
    expect(loadShortcutBindings({ ...DEFAULT_SHORTCUTS, playPause: "Escape" })).toEqual(DEFAULT_SHORTCUTS);
  });

  it("preserves a complete unique customized binding set", () => {
    const customized = { ...DEFAULT_SHORTCUTS, playPause: "Ctrl+KeyK" };
    expect(loadShortcutBindings(customized)).toEqual(customized);
  });
});
