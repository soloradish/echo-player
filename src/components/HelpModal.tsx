import { useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useI18n } from "../i18n";
import { BUG_REPORT_URL, FEATURE_REQUEST_URL } from "../lib/externalLinks";

interface HelpModalProps {
  appVersion: string | null;
  isDevelopmentBuild: boolean;
  projectUrl: string;
  onOpenUrl: (url: string) => void;
  onClose: () => void;
}

export function HelpModal({
  appVersion,
  isDevelopmentBuild,
  projectUrl,
  onOpenUrl,
  onClose,
}: HelpModalProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === panelRef.current) {
      event.preventDefault();
      first.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="help-modal-backdrop" data-testid="help-backdrop" onMouseDown={closeFromBackdrop}>
      <section
        className="help-modal"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        aria-describedby="help-description"
        onKeyDown={handleKeyDown}
      >
        <header className="help-modal-header">
          <div>
            <span>{t("help.kicker")}</span>
            <h2 id="help-title">{t("help.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("help.close")}>×</button>
        </header>

        <p id="help-description" className="help-modal-description">{t("help.description")}</p>
        <div className="help-feedback-notice">
          <strong>{t("help.beforeSubmitting")}</strong>
          <p>{t("help.reportDetails")}</p>
          <p>{t("help.privacyNotice")}</p>
        </div>

        <div className="help-actions">
          <article>
            <div>
              <strong>{t("help.reportProblem")}</strong>
              <p>{t("help.reportProblemDescription")}</p>
            </div>
            <button type="button" onClick={() => onOpenUrl(BUG_REPORT_URL)}>{t("help.reportProblemAction")} <span aria-hidden="true">↗</span></button>
          </article>
          <article>
            <div>
              <strong>{t("help.suggestFeature")}</strong>
              <p>{t("help.suggestFeatureDescription")}</p>
            </div>
            <button type="button" onClick={() => onOpenUrl(FEATURE_REQUEST_URL)}>{t("help.suggestFeatureAction")} <span aria-hidden="true">↗</span></button>
          </article>
          <article>
            <div>
              <strong>{t("help.projectPage")}</strong>
              <p>{t("help.projectPageDescription")}</p>
            </div>
            <button type="button" onClick={() => onOpenUrl(projectUrl)}>{t("help.projectPageAction")} <span aria-hidden="true">↗</span></button>
          </article>
        </div>

        <footer className="help-version">
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
