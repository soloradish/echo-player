import path from "node:path";

const fixture = path.resolve("e2e/fixtures/generated/sample.wav");
const normalizeWindowsPath = (value: string) => value.replace(/^\\\\\?\\/, "").toLowerCase();

describe("Echo Player Windows application", () => {
  it("starts with the expected empty state and bundled analyzer", async () => {
    await expect($("h1")).toHaveText("Echo Player");

    const capability = await browser.tauri.execute(({ core }) =>
      core.invoke<{ available: boolean; source: string; version: string | null }>("get_analysis_capability"),
    );
    expect(capability.available).toBe(true);
    expect(capability.source).toBe("bundled");
    expect(capability.version).toMatch(/8\.1\.2/);
  });

  it("opens a scoped local file through the app boundary and analyzes it", async () => {
    await browser.tauri.execute(({ core }) => core.invoke("clear_analysis_cache"));
    await browser.execute(async (mediaPath) => {
      if (!window.__ECHO_PLAYER_E2E_OPEN_PATH__) throw new Error("E2E open hook is unavailable");
      await window.__ECHO_PLAYER_E2E_OPEN_PATH__(mediaPath);
    }, fixture);
    await expect($(".file-title")).toHaveText("sample.wav");
    await expect($(".player-shell")).toBeDisplayed();

    await browser.waitUntil(async () => {
      const stats = await browser.tauri.execute(({ core }) =>
        core.invoke<{ entryCount: number }>("get_analysis_cache_stats"),
      );
      return stats.entryCount > 0;
    }, { timeout: 30_000, timeoutMsg: "audio analysis did not complete" });

    const context = await browser.tauri.execute(({ core }, mediaPath) =>
      core.invoke<{ selected: { path: string }; playlist: Array<{ path: string }> }>("open_media_context", { path: mediaPath }),
      fixture,
    );
    expect(normalizeWindowsPath(context.selected.path)).toBe(normalizeWindowsPath(fixture));
    expect(context.playlist.some((item) => normalizeWindowsPath(item.path) === normalizeWindowsPath(fixture))).toBe(true);
  });

  it("shows explicit file and support entry points without launching an external browser", async () => {
    const wordmark = $(".wordmark");
    expect(await wordmark.getTagName()).toBe("span");
    await expect($(".open-file-button")).toBeDisplayed();

    await $(".help-button").click();
    await expect($(".help-modal")).toBeDisplayed();
    expect(await $$(".help-actions button").length).toBe(3);

    await $(".help-modal-header button").click();
    await expect($(".help-modal")).not.toBeDisplayed();
  });
});
