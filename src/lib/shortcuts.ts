import type { ShortcutAction, ShortcutBindings } from "../types";

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [
  "playPause",
  "previousSegment",
  "nextSegment",
  "replaySegment",
  "toggleLoopRange",
];

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  playPause: "Space",
  previousSegment: "KeyA",
  nextSegment: "KeyD",
  replaySegment: "KeyR",
  toggleLoopRange: "KeyS",
};

const NAMED_CODES = new Set([
  "Space",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

function isAllowedCode(code: string): boolean {
  return NAMED_CODES.has(code) || /^Key[A-Z]$/.test(code) || /^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code);
}

export function shortcutFromKeyboardEvent(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "isComposing">): string | null {
  if (event.isComposing || event.metaKey || !isAllowedCode(event.code)) return null;
  return [
    event.ctrlKey ? "Ctrl" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    event.code,
  ].filter(Boolean).join("+");
}

export function isValidShortcut(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("+");
  const code = parts.pop();
  if (!code || !isAllowedCode(code)) return false;
  return parts.join("+") === ["Ctrl", "Alt", "Shift"].filter((modifier) => parts.includes(modifier)).join("+")
    && new Set(parts).size === parts.length;
}

export function loadShortcutBindings(value: unknown): ShortcutBindings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SHORTCUTS };
  const saved = value as Record<string, unknown>;
  const entries = SHORTCUT_ACTIONS.map((action) => [action, saved[action]] as const);
  const shortcuts = entries.map(([, shortcut]) => shortcut);
  if (shortcuts.some((shortcut) => !isValidShortcut(shortcut)) || new Set(shortcuts).size !== shortcuts.length) {
    return { ...DEFAULT_SHORTCUTS };
  }
  return Object.fromEntries(entries) as ShortcutBindings;
}

export function shortcutActionForEvent(bindings: ShortcutBindings, event: KeyboardEvent): ShortcutAction | null {
  const shortcut = shortcutFromKeyboardEvent(event);
  if (!shortcut) return null;
  return SHORTCUT_ACTIONS.find((action) => bindings[action] === shortcut) ?? null;
}

export function formatShortcut(shortcut: string): string {
  const labels: Record<string, string> = {
    Space: "Space",
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    PageUp: "Page Up",
    PageDown: "Page Down",
  };
  return shortcut.split("+").map((part) => {
    if (/^Key[A-Z]$/.test(part)) return part.slice(3);
    if (/^Digit[0-9]$/.test(part)) return part.slice(5);
    if (/^Numpad[0-9]$/.test(part)) return `Num ${part.slice(6)}`;
    return labels[part] ?? part;
  }).join("+");
}
