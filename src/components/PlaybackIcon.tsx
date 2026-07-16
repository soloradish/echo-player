interface PlaybackIconProps {
  playing: boolean;
}

export function PlaybackIcon({ playing }: PlaybackIconProps) {
  return (
    <svg className="playback-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {playing ? (
        <g data-testid="pause-icon">
          <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.4" />
          <rect x="14" y="4.5" width="4.5" height="15" rx="1.4" />
        </g>
      ) : (
        <path data-testid="play-icon" d="M8 5.25v13.5L19 12 8 5.25Z" />
      )}
    </svg>
  );
}
