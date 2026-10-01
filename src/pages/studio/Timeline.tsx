import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Chapter, TimeNote } from '../../data/types';
import { noteEnd, timecode } from '../../lib/videoStudio';

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];

/** Zoom levels that make sense for a video of this length. */
export function zoomLevels(duration: number): number[] {
  const levels = [1, 2, 4, 8, 16, 32, 64];
  // Stop once the visible span would be under ~4 seconds.
  return levels.filter((z, i) => i === 0 || duration / z >= 4);
}

/** Put overlapping range notes into lanes so none hides another. */
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

/**
 * The scrubber. Click or drag anywhere to move the playhead to that exact
 * second (seeks are coalesced to one per frame while dragging). Notes are
 * markers; clicking one jumps to its second.
 */
export function Timeline({
  duration,
  t,
  notes,
  chapters,
  zoom,
  buffered,
  pending,
  focusId,
  onSeek,
  onScrub,
  onNote,
}: {
  duration: number;
  t: number;
  notes: TimeNote[];
  chapters: Chapter[];
  zoom: number;
  buffered: [number, number][];
  /** Where a note is being written, if one is. */
  pending?: number;
  focusId?: string;
  onSeek: (sec: number) => void;
  onScrub: (scrubbing: boolean) => void;
  onNote: (note: TimeNote) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const frame = useRef(0);
  const [hover, setHover] = useState<{ sec: number; x: number } | null>(null);
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const d = Math.max(duration, 0.001);
  const pct = (sec: number) => `${(Math.max(0, Math.min(d, sec)) / d) * 100}%`;
  const laneOf = useMemo(() => lanes(notes), [notes]);
  const fmt = (s: number) => timecode(s, d);
  const shownT = scrubAt ?? t;

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
    if (!el || zoom === 1 || dragging.current) return;
    const x = (t / d) * el.scrollWidth;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [t, d, zoom]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** Whole seconds: what you see on the timecode is where you land. */
  const secAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(Math.floor(d), Math.round(((clientX - rect.left) / rect.width) * d)));
  };
  const scrubTo = (sec: number) => {
    setScrubAt(sec);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onSeek(sec));
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    track.current?.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    onScrub(true);
    scrubTo(secAt(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const rect = track.current!.getBoundingClientRect();
    setHover({ sec: secAt(e.clientX), x: e.clientX - rect.left });
    if (dragging.current) scrubTo(secAt(e.clientX));
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setScrubAt(null);
    onScrub(false);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') onSeek(Math.round(t) - by);
    else if (e.key === 'ArrowRight') onSeek(Math.round(t) + by);
    else if (e.key === 'Home') onSeek(0);
    else if (e.key === 'End') onSeek(d);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="tl" data-zoom={zoom}>
      <div className="tl__scroll" ref={scroller}>
        <div
          className={`tl__track ${scrubAt !== null ? 'is-scrubbing' : ''}`}
          ref={track}
          style={{ width: `${zoom * 100}%` }}
          role="slider"
          tabIndex={0}
          aria-label="Timeline. Click or drag to move the playhead; arrow keys move one second, with Shift ten."
          aria-valuemin={0}
          aria-valuemax={Math.round(d)}
          aria-valuenow={Math.round(shownT)}
          aria-valuetext={`${fmt(shownT)} of ${fmt(d)}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={() => setHover(null)}
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
                  <span key={c.id} className={`tl__chapter ${shownT >= c.startSec && shownT < end ? 'is-now' : ''}`} style={{ left: pct(c.startSec), width: `calc(${pct(end)} - ${pct(c.startSec)})` }} title={c.title}>
                    <span>{c.title}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="tl__bar" aria-hidden="true">
            {buffered.map(([a, b], i) => (
              <span key={i} className="tl__buffered" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} />
            ))}
            <span className="tl__played" style={{ width: pct(shownT) }} />
          </div>

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
                  onClick={() => onNote(n)}
                  aria-label={`Note at ${fmt(n.startSec)}: ${n.text}`}
                  title={`${fmt(n.startSec)} · ${n.text}`}
                  data-marker={n.id}
                />
              );
            })}
          </div>

          {pending !== undefined && <span className="tl__pending" style={{ left: pct(pending) }} aria-hidden="true" data-testid="tl-pending" />}
          <div className="tl__playhead" style={{ left: pct(shownT) }} aria-hidden="true" />
          {hover && (
            <span className="tl__hover" style={{ left: hover.x }} aria-hidden="true">
              {fmt(hover.sec)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
