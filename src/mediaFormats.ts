export const MEDIA_EXTENSIONS = ["mp4", "m4v", "webm", "mp3", "m4a", "aac", "wav", "flac", "ogg"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm"] as const;

export function extensionOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedMediaPath(path: string): boolean {
  return (MEDIA_EXTENSIONS as readonly string[]).includes(extensionOf(path));
}

export function isVideoPath(path: string): boolean {
  return (VIDEO_EXTENSIONS as readonly string[]).includes(extensionOf(path));
}
