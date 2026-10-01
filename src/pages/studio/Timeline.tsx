import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Chapter, TimeNote } from '../../data/types';
import { noteEnd, timecode } from '../../lib/videoStudio';

export interface Range {
  start: number;
  end?: number;
}

const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];

/** Zoom levels that make sense for a video of this length. */
export function zoomLevels(duration: number): number[] {
  const levels = [1, 2, 4, 8, 16, 32, 64];
  // Stop once the visible span would be under ~4 seconds.
  return levels.filter((z, i) => i === 0 || duration / z >= 4);
}

/** Put notes into lanes so overlapping ranges don't hide each other. */
function lanes(notes: TimeNote[]): Map<string, number> {
  const ends: number[] = [];
  const out = new Map<string, number>();
  for (const n of [...notes].sort((a, b) => a.startSec - b.startSec)) {
    let lane = ends.findIndex((e) => e <= n.startSec);
    if (lane === -1) lane = ends.length;
    ends[lane] = noteEnd(n);
    out.set(n.id, Math.min(lane, 2));
  }
  return out;
}

export function Timeline({
  duration,
  t,
  notes,
  chapters,
  zoom,
  selection,
  focusId,
  onSeek,
  onSelect,
}: {
  duration: number;
  t: number;
  notes: TimeNote[];
  chapters: Chapter[];
  zoom: number;
  selection?: Range;
  focusId?: string;
  onSeek: (sec: number) => void;
  onSelect: (range: Range) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; sec: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<Range | null>(null);
  const d = Math.max(duration, 0.001);
  const pct = (sec: number) => `${(Math.max(0, Math.min(d, sec)) / d) * 100}%`;
  const laneOf = useMemo(() => lanes(notes), [notes]);

  // Ticks spaced for the visible span.
  const visible = d / zoom;
  const step = TICK_STEPS.find((s) => visible / s <= 10) ?? 3600;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let s = 0; s <= d + 0.001; s += step) out.push(s);
    return out;
  }, [d, step]);

  // Keep the playhead in view when zoomed in.
  useEffect(() => {
    const el = scroller.current;
    if (!el || zoom === 1) return;
    const x = (t / d) * el.scrollWidth;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [t, d, zoom]);

  const secAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(d, ((clientX - rect.left) / rect.width) * d));
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, sec: secAt(e.clientX), moved: false };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g) return;
    if (Math.abs(e.clientX - g.x) > 4) g.moved = true;
    if (g.moved) {
      const now = secAt(e.clientX);
      setGhost({ start: Math.min(g.sec, now), end: Math.max(g.sec, now) });
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    drag.current = null;
    setGhost(null);
    if (!g) return;
    const now = secAt(e.clientX);
    if (g.moved && Math.abs(now - g.sec) >= 0.25) onSelect({ start: Math.min(g.sec, now), end: Math.max(g.sec, now) });
    else onSeek(now);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = d >= 600 ? 60 : 5;
    if (e.key === 'ArrowLeft') onSeek(t - (e.shiftKey ? big : 1));
    else if (e.key === 'ArrowRight') onSeek(t + (e.shiftKey ? big : 1));
    else if (e.key === 'Home') onSeek(0);
    else if (e.key === 'End') onSeek(d);
    else return;
    e.preventDefault();
  };

  const shown = ghost ?? selection;
  const fmt = (s: number) => timecode(s, d);

  return (
    <div className="tl" data-zoom={zoom}>
      <div className="tl__scroll" ref={scroller}>
        <div
          className="tl__track"
          ref={track}
          style={{ width: `${zoom * 100}%` }}
          role="slider"
          tabIndex={0}
          aria-label="Timeline. Click to jump, drag to mark a range."
          aria-valuemin={0}
          aria-valuemax={Math.round(d)}
          aria-valuenow={Math.round(t)}
          aria-valuetext={`${fmt(t)} of ${fmt(d)}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            drag.current = null;
            setGhost(null);
          }}
          onKeyDown={key}
          data-testid="timeline"
        >
          <div className="tl__ruler" aria-hidden="true">
            {ticks.map((s) => (
              <span key={s} className="tl__tick" style={{ left: pct(s) }}>
                {fmt(s)}
              </span>
            ))}
          </div>

          {chapters.length > 0 && (
            <div className="tl__chapters" aria-hidden="true">
              {chapters.map((c, i) => {
                const end = chapters[i + 1]?.startSec ?? d;
                return (
                  <span key={c.id} className={`tl__chapter ${t >= c.startSec && t < end ? 'is-now' : ''}`} style={{ left: pct(c.startSec), width: `calc(${pct(end)} - ${pct(c.startSec)})` }} title={c.title}>
                    <span>{c.title}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="tl__notes">
            {notes.map((n) => {
              const lane = laneOf.get(n.id) ?? 0;
              const range = n.endSec !== undefined;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`tl__note ${range ? 'tl__note--range' : 'tl__note--moment'} ${n.resolved ? 'is-resolved' : ''} ${focusId === n.id ? 'is-focus' : ''}`}
                  style={{ left: pct(n.startSec), width: range ? `calc(${pct(n.endSec!)} - ${pct(n.startSec)})` : undefined, top: `${lane * 12}px` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onSeek(n.startSec)}
                  aria-label={`Note at ${fmt(n.startSec)}${range ? ` to ${fmt(n.endSec!)}` : ''}: ${n.text}`}
                  tabIndex={-1}
                />
              );
            })}
          </div>

          {shown && (
            <div className="tl__selection" style={{ left: pct(shown.start), width: shown.end !== undefined ? `calc(${pct(shown.end)} - ${pct(shown.start)})` : undefined }} aria-hidden="true" data-testid="tl-selection" />
          )}
          <div className="tl__playhead" style={{ left: pct(t) }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
