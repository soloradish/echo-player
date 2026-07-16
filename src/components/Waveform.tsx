import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { Segment } from "../types";
import { useI18n } from "../i18n";
import { formatPreciseTime, formatTime, nearestSnapPoint } from "../lib/segments";
import {
  clampViewStart,
  clientXToTime,
  overviewTimelineTicks,
  snapRadiusForView,
  timeToPercent,
  viewAround,
} from "./waveformMath";
import type { TimelineView } from "./waveformMath";

export interface SelectionRange {
  start: number;
  end: number;
}

interface WaveformProps {
  duration: number;
  peaks: number[];
  peaksPerSecond: number;
  currentTime: number;
  segments: Segment[];
  activeSegment: number;
  selection: SelectionRange | null;
  selectionLocked: boolean;
  onSeek: (time: number) => void;
  onSelect: (selection: SelectionRange | null) => void;
  onSelectionConfirm: (selection: SelectionRange) => void;
}

type DragMode = "new" | "start" | "end";

interface DragState {
  mode: DragMode;
  anchor: number;
  initial: SelectionRange | null;
  current: SelectionRange;
  startClientX: number;
  moved: boolean;
}

interface DetailWaveformProps extends Omit<WaveformProps, "onSelectionConfirm"> {
  view: TimelineView;
}

interface OverviewWaveformProps {
  duration: number;
  peaks: number[];
  peaksPerSecond: number;
  currentTime: number;
  view: TimelineView;
  locked: boolean;
  onNavigate: (time: number) => void;
}

const DETAIL_HEIGHT = 112;
const OVERVIEW_HEIGHT = 36;
const MIN_SELECTION_SECONDS = 0.12;
const POINTER_DRAG_THRESHOLD = 4;
const ZOOM_OPTIONS = [20, 40, 120] as const;
const OVERVIEW_TOOLTIP_HALF_WIDTH = 30;

function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function drawWaveform(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  peaks: number[],
  peaksPerSecond: number,
  view: TimelineView,
  color: string,
) {
  if (!canvas || width <= 0) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = color;

  const center = height / 2;
  const samplesPerSecond = peaksPerSecond > 0 ? peaksPerSecond : peaks.length / Math.max(view.duration, 0.01);
  const firstSample = Math.max(0, Math.floor(view.start * samplesPerSecond));
  const lastSample = Math.min(peaks.length, Math.ceil((view.start + view.duration) * samplesPerSecond));
  const visibleSamples = Math.max(1, lastSample - firstSample);

  for (let x = 0; x < Math.ceil(width); x += 1) {
    const start = Math.min(lastSample, firstSample + Math.floor((x / width) * visibleSamples));
    const end = Math.min(lastSample, Math.max(start + 1, firstSample + Math.ceil(((x + 1) / width) * visibleSamples)));
    let peak = 0.025;
    for (let index = start; index < end; index += 1) peak = Math.max(peak, peaks[index] ?? 0);
    const amplitude = Math.min(center - 5, Math.max(1.5, peak * (center - 4)));
    context.fillRect(x, center - amplitude, 1, amplitude * 2);
  }
}

function DetailWaveform({
  duration,
  peaks,
  peaksPerSecond,
  currentTime,
  segments,
  activeSegment,
  selection,
  selectionLocked,
  onSeek,
  onSelect,
  view,
}: DetailWaveformProps) {
  const { t } = useI18n();
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hostRef, width] = useMeasuredWidth<HTMLDivElement>();
  const dragRef = useRef<DragState | null>(null);
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const viewEnd = view.start + view.duration;

  useEffect(() => {
    drawWaveform(baseCanvasRef.current, width, DETAIL_HEIGHT, peaks, peaksPerSecond, view, "#75806c");
    drawWaveform(progressCanvasRef.current, width, DETAIL_HEIGHT, peaks, peaksPerSecond, view, "#d9f99d");
  }, [peaks, peaksPerSecond, view.start, view.duration, width]);

  const visibleSegments = useMemo(() => segments.flatMap((segment, index) => {
    if (segment.end <= view.start || segment.start >= viewEnd) return [];
    const start = Math.max(segment.start, view.start);
    const end = Math.min(segment.end, viewEnd);
    return [{
      id: segment.id,
      active: index === activeSegment,
      left: timeToPercent(start, view),
      width: ((end - start) / view.duration) * 100,
    }];
  }), [activeSegment, segments, view.start, view.duration, viewEnd]);

  const rawTimeFromEvent = (event: ReactPointerEvent): number => {
    const rect = hostRef.current!.getBoundingClientRect();
    return clientXToTime(event.clientX, rect, view);
  };

  const snapTime = (raw: number, altKey: boolean): number => {
    const measuredWidth = width || hostRef.current?.getBoundingClientRect().width || 0;
    const snapped = nearestSnapPoint(raw, segments, {
      radius: snapRadiusForView(view.duration, measuredWidth),
      disabled: altKey,
    });
    setSnapGuide(Math.abs(snapped - raw) > 0.0001 ? snapped : null);
    return snapped;
  };

  const beginDrag = (event: ReactPointerEvent, mode: DragMode) => {
    if (selectionLocked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const raw = rawTimeFromEvent(event);
    const time = snapTime(raw, event.altKey);
    const anchor = mode === "new" ? time : mode === "start" ? selection?.end ?? time : selection?.start ?? time;
    const current = mode === "new" ? { start: time, end: time } : selection ?? { start: time, end: time };
    dragRef.current = {
      mode,
      anchor,
      initial: selection,
      current,
      startClientX: event.clientX,
      moved: mode !== "new",
    };
  };

  const moveDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || selectionLocked) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startClientX) < POINTER_DRAG_THRESHOLD) return;
    drag.moved = true;
    const raw = rawTimeFromEvent(event);
    const snapped = snapTime(raw, event.altKey);
    const { mode, anchor } = drag;
    const next = mode === "start"
      ? { start: Math.max(0, Math.min(snapped, anchor - MIN_SELECTION_SECONDS)), end: anchor }
      : mode === "end"
        ? { start: anchor, end: Math.min(duration, Math.max(snapped, anchor + MIN_SELECTION_SECONDS)) }
        : { start: Math.min(anchor, snapped), end: Math.max(anchor, snapped) };
    drag.current = next;
    onSelect(next);
  };

  const endDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setSnapGuide(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.mode === "new" && (!drag.moved || drag.current.end - drag.current.start < MIN_SELECTION_SECONDS)) {
      onSelect(drag.initial);
      onSeek(rawTimeFromEvent(event));
    }
  };

  const cancelDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setSnapGuide(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onSelect(drag.initial);
  };

  const adjustHandleWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, mode: "start" | "end") => {
    if (!selection || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const step = event.shiftKey ? 1 : 0.1;
    const raw = selection[mode] + direction * step;
    const measuredWidth = width || hostRef.current?.getBoundingClientRect().width || 0;
    const snapped = nearestSnapPoint(raw, segments, {
      radius: snapRadiusForView(view.duration, measuredWidth),
      disabled: event.altKey,
    });
    onSelect(mode === "start"
      ? { start: Math.max(0, Math.min(snapped, selection.end - MIN_SELECTION_SECONDS)), end: selection.end }
      : { start: selection.start, end: Math.min(duration, Math.max(snapped, selection.start + MIN_SELECTION_SECONDS)) });
  };

  const handleSeekKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (selectionLocked) return;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = currentTime - (event.shiftKey ? 0.1 : 1);
    else if (event.key === "ArrowRight") next = currentTime + (event.shiftKey ? 0.1 : 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = duration;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onSeek(Math.max(0, Math.min(duration, next)));
  };

  const progressPercent = Math.max(0, Math.min(100, timeToPercent(currentTime, view)));
  const playheadVisible = currentTime >= view.start && currentTime <= viewEnd;
  const selectionVisible = selection && selection.end > view.start && selection.start < viewEnd;
  const selectionLeft = selectionVisible ? Math.max(0, timeToPercent(selection.start, view)) : 0;
  const selectionRight = selectionVisible ? Math.min(100, timeToPercent(selection.end, view)) : 0;

  return (
    <div
      className={selectionLocked ? "detail-waveform locked" : "detail-waveform"}
      ref={hostRef}
      onPointerDown={(event) => beginDrag(event, "new")}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onKeyDown={handleSeekKey}
      role="slider"
      aria-label={t("waveform.detailAria")}
      aria-valuemin={view.start}
      aria-valuemax={viewEnd}
      aria-valuenow={Math.max(view.start, Math.min(viewEnd, currentTime))}
      aria-disabled={selectionLocked}
      tabIndex={selectionLocked ? -1 : 0}
    >
      <div className="segment-layer" aria-hidden="true">
        {visibleSegments.map((position) => (
          <span
            key={position.id}
            className={position.active ? "segment-mark active" : "segment-mark"}
            style={{ left: `${position.left}%`, width: `${position.width}%` }}
          />
        ))}
      </div>
      <canvas ref={baseCanvasRef} aria-hidden="true" />
      <div className="wave-progress-layer" style={{ width: `${progressPercent}%` }} aria-hidden="true">
        <canvas ref={progressCanvasRef} />
      </div>
      {playheadVisible && (
        <span className="playhead" style={{ left: `${timeToPercent(currentTime, view)}%` }} aria-hidden="true" />
      )}
      {snapGuide !== null && snapGuide >= view.start && snapGuide <= viewEnd && (
        <span className="snap-guide" style={{ left: `${timeToPercent(snapGuide, view)}%` }} aria-hidden="true" />
      )}
      {selectionVisible && selectionRight > selectionLeft && (
        <div
          className="wave-selection"
          style={{ left: `${selectionLeft}%`, width: `${selectionRight - selectionLeft}%` }}
          aria-label={t("waveform.selectedRange")}
        >
          {!selectionLocked && (
            <>
              <button
                type="button"
                className="range-handle start"
                aria-label={t("waveform.adjustStart")}
                onKeyDown={(event) => adjustHandleWithKeyboard(event, "start")}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  beginDrag(event, "start");
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              />
              <button
                type="button"
                className="range-handle end"
                aria-label={t("waveform.adjustEnd")}
                onKeyDown={(event) => adjustHandleWithKeyboard(event, "end")}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  beginDrag(event, "end");
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewWaveform({
  duration,
  peaks,
  peaksPerSecond,
  currentTime,
  view,
  locked,
  onNavigate,
}: OverviewWaveformProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hostRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const pointerRef = useRef<{ startClientX: number; canceled: boolean } | null>(null);
  const fullView = useMemo<TimelineView>(() => ({ start: 0, duration }), [duration]);
  const timelineTicks = useMemo(() => overviewTimelineTicks(duration, width), [duration, width]);

  useEffect(() => {
    drawWaveform(canvasRef.current, width, OVERVIEW_HEIGHT, peaks, peaksPerSecond, fullView, "#75806c");
  }, [duration, fullView, peaks, peaksPerSecond, width]);

  useEffect(() => {
    if (locked) setPreviewTime(null);
  }, [locked]);

  const timeFromEvent = (event: ReactPointerEvent) => (
    clientXToTime(event.clientX, hostRef.current!.getBoundingClientRect(), fullView)
  );

  const updatePreview = (event: ReactPointerEvent) => {
    if (locked) return;
    const rect = hostRef.current!.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.left + rect.width) {
      setPreviewTime(null);
      return;
    }
    setPreviewTime(clientXToTime(event.clientX, rect, fullView));
  };

  const pointerDown = (event: ReactPointerEvent) => {
    if (locked) return;
    updatePreview(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { startClientX: event.clientX, canceled: false };
  };

  const pointerMove = (event: ReactPointerEvent) => {
    updatePreview(event);
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (Math.abs(event.clientX - pointer.startClientX) >= POINTER_DRAG_THRESHOLD) pointer.canceled = true;
  };

  const pointerUp = (event: ReactPointerEvent) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pointer.canceled) onNavigate(timeFromEvent(event));
  };

  const pointerCancel = (event: ReactPointerEvent) => {
    pointerRef.current = null;
    setPreviewTime(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const pointerLeave = () => {
    setPreviewTime(null);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = currentTime - 1;
    else if (event.key === "ArrowRight") next = currentTime + 1;
    else if (event.key === "PageUp") next = currentTime - view.duration;
    else if (event.key === "PageDown") next = currentTime + view.duration;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = duration;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigate(Math.max(0, Math.min(duration, next)));
  };

  const previewPercent = previewTime === null ? 0 : (previewTime / duration) * 100;
  const previewLabelLeft = width <= OVERVIEW_TOOLTIP_HALF_WIDTH * 2
    ? width / 2
    : Math.max(
      OVERVIEW_TOOLTIP_HALF_WIDTH,
      Math.min(width - OVERVIEW_TOOLTIP_HALF_WIDTH, (previewPercent / 100) * width),
    );

  return (
    <>
      <div
        className={locked ? "overview-waveform locked" : "overview-waveform"}
        ref={hostRef}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onPointerLeave={pointerLeave}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label={t("waveform.overviewAria")}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={formatTime(currentTime)}
        aria-disabled={locked}
        tabIndex={locked ? -1 : 0}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        <span
          className="overview-window"
          style={{ left: `${(view.start / duration) * 100}%`, width: `${(view.duration / duration) * 100}%` }}
          aria-hidden="true"
        />
        <span className="overview-playhead" style={{ left: `${(currentTime / duration) * 100}%` }} aria-hidden="true" />
        {previewTime !== null && (
          <>
            <span className="overview-hover-guide" style={{ left: `${previewPercent}%` }} aria-hidden="true" />
            <span className="overview-hover-time" style={{ left: `${previewLabelLeft}px` }} aria-hidden="true">
              {formatTime(previewTime)}
            </span>
          </>
        )}
      </div>
      <div className="overview-wave-scale" aria-hidden="true">
        {timelineTicks.map((time, index) => (
          <span
            key={time}
            className={index === 0
              ? "overview-scale-tick start"
              : index === timelineTicks.length - 1
                ? "overview-scale-tick end"
                : "overview-scale-tick"}
            style={{ left: `${(time / duration) * 100}%` }}
          >
            {formatTime(time)}
          </span>
        ))}
      </div>
    </>
  );
}

export function Waveform({
  duration,
  peaks,
  peaksPerSecond,
  currentTime,
  segments,
  activeSegment,
  selection,
  selectionLocked,
  onSeek,
  onSelect,
  onSelectionConfirm,
}: WaveformProps) {
  const { t, formatMinutes, formatSeconds } = useI18n();
  const [requestedViewDuration, setRequestedViewDuration] = useState<number>(40);
  const initialView = viewAround(currentTime, requestedViewDuration, duration);
  const [viewStart, setViewStart] = useState(initialView.start);
  const viewDuration = Math.max(0.01, Math.min(requestedViewDuration, duration));
  const view = useMemo<TimelineView>(() => ({
    start: clampViewStart(viewStart, viewDuration, duration),
    duration: viewDuration,
  }), [duration, viewDuration, viewStart]);

  useEffect(() => {
    if (selection || selectionLocked) return;
    const followStart = view.start + view.duration * 0.2;
    const followEnd = view.start + view.duration * 0.8;
    if (currentTime < followStart || currentTime > followEnd) {
      setViewStart(viewAround(currentTime, view.duration, duration).start);
    }
  }, [currentTime, duration, selection, selectionLocked, view.start, view.duration]);

  const changeZoom = (nextDuration: number) => {
    const center = selection ? (selection.start + selection.end) / 2 : currentTime;
    setRequestedViewDuration(nextDuration);
    setViewStart(viewAround(center, nextDuration, duration).start);
  };

  const navigateOverview = useCallback((time: number) => {
    if (selectionLocked) return;
    onSelect(null);
    setViewStart(viewAround(time, view.duration, duration).start);
    onSeek(time);
  }, [duration, onSeek, onSelect, selectionLocked, view.duration]);

  const selectionLength = selection ? selection.end - selection.start : 0;
  const showOverview = duration > view.duration + 0.001;
  const helperText = selectionLocked
    ? t("waveform.helperLocked")
    : selection
      ? t("waveform.helperDraft")
      : t("waveform.helperIdle");

  return (
    <section className="waveform-timeline" aria-label={t("waveform.sectionAria")}>
      <div className="wave-section-heading detail-heading">
        <div className="wave-section-copy">
          <span className="wave-section-icon" aria-hidden="true">↻</span>
          <span><strong>{t("waveform.replayTitle")}</strong><small>{helperText}</small></span>
        </div>
        <div className="wave-heading-actions">
          <label className="wave-zoom-control">
            <span>{t("waveform.displayRange")}</span>
            <select
              aria-label={t("waveform.displayRangeAria")}
              value={requestedViewDuration}
              disabled={selectionLocked}
              onChange={(event) => changeZoom(Number(event.target.value))}
            >
              {ZOOM_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds} disabled={selectionLength > seconds}>
                  {seconds < 60 ? formatSeconds(seconds) : formatMinutes(seconds / 60)}
                </option>
              ))}
            </select>
          </label>
          <span className="wave-action-tag">{selectionLocked ? t("waveform.locked") : t("waveform.dragToSelect")}</span>
        </div>
      </div>

      <DetailWaveform
        duration={duration}
        peaks={peaks}
        peaksPerSecond={peaksPerSecond}
        currentTime={currentTime}
        segments={segments}
        activeSegment={activeSegment}
        selection={selection}
        selectionLocked={selectionLocked}
        onSeek={onSeek}
        onSelect={onSelect}
        view={view}
      />
      <div className="detail-wave-scale" aria-hidden="true">
        <span>{formatTime(view.start)}</span>
        <span>{formatTime(view.start + view.duration)}</span>
      </div>

      {selection && !selectionLocked && (
        <section className="selection-draft-bar" aria-label={t("waveform.pendingRange")}>
          <div>
            <span>{t("waveform.pending")}</span>
            <strong>{formatPreciseTime(selection.start)} — {formatPreciseTime(selection.end)}</strong>
            <small>{formatSeconds(Number((selection.end - selection.start).toFixed(1)))}</small>
          </div>
          <div className="selection-draft-actions">
            <button type="button" onClick={() => onSelect(null)}>{t("waveform.cancel")}</button>
            <button type="button" className="confirm-selection" onClick={() => onSelectionConfirm(selection)}>{t("waveform.startLoop")}</button>
          </div>
        </section>
      )}

      {showOverview && (
        <div className="overview-section">
          <div className="wave-section-heading overview-heading">
            <div className="wave-section-copy">
              <span className="wave-section-icon" aria-hidden="true">⌖</span>
              <span><strong>{t("waveform.quickSeek")}</strong><small>{t("waveform.quickSeekDescription")}</small></span>
            </div>
            <span className="wave-action-tag">{t("waveform.clickToSeek")}</span>
          </div>
          <OverviewWaveform
            duration={duration}
            peaks={peaks}
            peaksPerSecond={peaksPerSecond}
            currentTime={currentTime}
            view={view}
            locked={selectionLocked}
            onNavigate={navigateOverview}
          />
        </div>
      )}
    </section>
  );
}
