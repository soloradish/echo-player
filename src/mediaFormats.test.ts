import { describe, expect, it } from "vitest";
import { extensionOf, isSupportedMediaPath, isVideoPath, MEDIA_EXTENSIONS } from "./mediaFormats";

describe("media format policy", () => {
  it("uses one case-insensitive allowlist for picker and validation", () => {
    expect(MEDIA_EXTENSIONS).toEqual(["mp4", "m4v", "webm", "mp3", "m4a", "aac", "wav", "flac", "ogg"]);
    expect(extensionOf("C:\\Media\\LESSON.M4A")).toBe("m4a");
    expect(isSupportedMediaPath("C:\\Media\\LESSON.M4A")).toBe(true);
    expect(isSupportedMediaPath("C:\\Media\\notes.txt")).toBe(false);
    expect(isSupportedMediaPath("C:\\Media\\no-extension")).toBe(false);
  });

  it("classifies only the supported video formats as video", () => {
    expect(isVideoPath("lesson.M4V")).toBe(true);
    expect(isVideoPath("lesson.webm")).toBe(true);
    expect(isVideoPath("lesson.wav")).toBe(false);
  });
});
