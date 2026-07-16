import { useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { LANGUAGE_OPTIONS, useI18n } from "../i18n";
import type { AppLocale, CacheStats } from "../types";

const PLAYBACK_SPEEDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.5, 1.75, 2];

interface SettingsModalProps {
  appVersion: string | null;
  isDevelopmentBuild: boolean;
  language: AppLocale;
  speed: number;
  loopGap: number;
  cacheStats: CacheStats | null;
  cacheClearing: boolean;
  cacheDisabled: boolean;
  onLanguageChange: (language: AppLocale) => void;
  onSpeedChange: (speed: number) => void;
  onLoopGapChange: (gap: number) => void;
  onClearCache: () => void;
  onClose: () => void;
}

export function SettingsModal({
  appVersion,
  isDevelopmentBuild,
  language,
  speed,
  loopGap,
  cacheStats,
  cacheClearing,
  cacheDisabled,
  onLanguageChange,
  onSpeedChange,
  onLoopGapChange,
  onClearCache,
  onClose,
}: SettingsModalProps) {
  const { t, formatNumber, formatSeconds } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  const firstControlRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstControlRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), input:not([disabled])") ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="settings-modal-backdrop" data-testid="settings-backdrop" onMouseDown={closeFromBackdrop}>
      <section
        className="settings-modal"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        onKeyDown={handleKeyDown}
      >
        <header className="settings-modal-header">
          <div>
            <span>{t("settings.kicker")}</span>
            <h2 id="settings-title">{t("settings.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("settings.close")}>×</button>
        </header>
        <p id="settings-description" className="settings-modal-description">{t("settings.description")}</p>

        <div className="settings-groups">
          <fieldset className="settings-group">
            <legend>{t("settings.languageGroup")}</legend>
            <label htmlFor="settings-language">
              <span><strong>{t("settings.language")}</strong><small>{t("settings.languageDescription")}</small></span>
              <select
                id="settings-language"
                ref={firstControlRef}
                aria-label={t("settings.language")}
                value={language}
                onChange={(event) => onLanguageChange(event.target.value as AppLocale)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="settings-group">
            <legend>{t("settings.loopGroup")}</legend>
            <label htmlFor="settings-loop-gap">
              <span><strong>{t("settings.loopGap")}</strong><small>{t("settings.loopGapDescription")}</small></span>
              <select
                id="settings-loop-gap"
                aria-label={t("settings.loopGap")}
                value={loopGap}
                onChange={(event) => onLoopGapChange(Number(event.target.value))}
              >
                <option value="0">{t("settings.none")}</option>
                <option value="0.5">{formatSeconds(0.5)}</option>
                <option value="1">{formatSeconds(1)}</option>
                <option value="2">{formatSeconds(2)}</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="settings-group settings-cache-group">
            <legend>{t("settings.cacheGroup")}</legend>
            <div className="settings-cache-copy">
              <span>
                <strong>{t("settings.cacheTitle")}</strong>
                <small>{t("settings.cacheDescription")}</small>
              </span>
              <small className="settings-cache-usage">
                {cacheStats
                  ? t("settings.cacheUsage", {
                    used: formatNumber(cacheStats.usedBytes / 1024 / 1024, { maximumFractionDigits: 1 }),
                    limit: formatNumber(cacheStats.limitBytes / 1024 / 1024, { maximumFractionDigits: 0 }),
                    count: formatNumber(cacheStats.entryCount),
                  })
                  : t("settings.cacheUnavailable")}
              </small>
            </div>
            <button
              type="button"
              onClick={onClearCache}
              disabled={cacheDisabled || cacheClearing || !cacheStats}
              title={cacheDisabled ? t("settings.cacheDisabledAnalyzing") : undefined}
            >
              {cacheClearing ? t("settings.cacheClearing") : t("settings.cacheClear")}
            </button>
          </fieldset>

          <fieldset className="settings-group">
            <legend>{t("settings.playbackGroup")}</legend>
            <label htmlFor="settings-speed">
              <span><strong>{t("settings.speed")}</strong><small>{t("settings.speedDescription")}</small></span>
              <select id="settings-speed" aria-label={t("settings.speed")} value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>
                {PLAYBACK_SPEEDS.map((value) => (
                  <option key={value} value={value}>{formatNumber(value, { minimumFractionDigits: value % 1 ? 1 : 1, maximumFractionDigits: 2 })}×</option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
        <footer className="settings-version" data-testid="settings-version">
          {isDevelopmentBuild
            ? t("settings.developmentVersion")
            : appVersion
              ? t("settings.version", { version: appVersion })
              : t("settings.versionUnavailable")}
        </footer>
      </section>
    </div>
  );
}
