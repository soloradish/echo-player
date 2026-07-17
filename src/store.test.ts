import { beforeEach, describe, expect, it } from "vitest";
import { loadPlayerPreferences, usePlayerStore } from "./store";
import { DEFAULT_SHORTCUTS } from "./lib/shortcuts";

describe("player store boundaries", () => {
  beforeEach(() => usePlayerStore.getState().clearMedia());

  it("rejects malformed or out-of-range persisted preferences", () => {
    const storage = {
      getItem: () => JSON.stringify({ volume: 4, speed: 0.1, loopGap: 99, language: "invalid" }),
    };
    expect(loadPlayerPreferences(storage, ["en-US"])).toEqual({
      volume: 0.85,
      speed: 1,
      loopGap: 0,
      language: "en",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("clearMedia removes playback and playlist state", () => {
    const store = usePlayerStore.getState();
    store.setPlaylist([{ path: "C:\\lesson.mp3", name: "lesson.mp3", kind: "audio" }]);
    store.setMedia("C:\\lesson.mp3", "asset://lesson.mp3");
    store.setPlayback({ duration: 12, currentTime: 4, isPlaying: true });
    store.clearMedia();

    expect(usePlayerStore.getState()).toMatchObject({
      mediaPath: null,
      mediaUrl: null,
      duration: 0,
      currentTime: 0,
      isPlaying: false,
      playlist: [],
      currentPlaylistIndex: -1,
    });
  });
});
