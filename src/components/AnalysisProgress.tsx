import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface AnalysisProgressProps {
  fileName: string;
  progress: number | null;
  onCancel: () => void;
}

export function AnalysisProgress({ fileName, progress, onCancel }: AnalysisProgressProps) {
  const { t, formatNumber } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  const percent = progress === null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <aside className="analysis-progress" role="status" aria-live="polite">
      <div className="analysis-progress-copy">
        <span>{t("analysis.progressKicker")}</span>
        <strong title={fileName}>{fileName}</strong>
        <small>
          {percent === null
            ? t("analysis.progressIndeterminate")
            : t("analysis.progressPercent", { percent: formatNumber(percent) })}
        </small>
      </div>
      <progress
        aria-label={t("analysis.progressAria")}
        max={100}
        {...(percent === null ? {} : { value: percent })}
      />
      <button type="button" onClick={onCancel}>{t("analysis.cancel")}</button>
    </aside>
  );
}
