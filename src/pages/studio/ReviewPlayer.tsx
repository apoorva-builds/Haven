import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from 'react';
import type { Asset, Cut, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { useDismiss } from '../../components/ui';
import { useStore } from '../../state/store';
import { bookletSections, chaptersOf, earlierFeedback, lengthLabel, notesOf, parseTimecode, reviewProgress, sectionAtTime, timecode, type BookletSection } from '../../lib/videoStudio';
import { Booklet, type NoteDraft } from './Booklet';
import { NotesDocument } from './NotesDocument';
import { PublishChecklist } from './PublishChecklist';
import { useVideoClock } from './useVideoClock';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, useViewerSettings } from './useViewerSettings';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const BOOKLET_KEY = 'haven.studio.booklet';
const MARKERS_KEY = 'haven.studio.markers';

/** Session-only memory (per browser tab), safe when storage is blocked. */
function useSessionFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        sessionStorage.setItem(key, v ? '1' : '0');
      } catch {
        /* this page only */
      }
    },
    [key],
  );
  return [value, set];
}

/**
 * Watch and review one draft. The video is the focus; the booklet is an
 * optional companion beside it (a slide-over on small screens). Haven never
 * edits the video: changes happen in the editor, and the next draft is
 * uploaded here.
 */
export function ReviewPlayer({
  project,
  cut,
  asset,
  startAt,
  checklistRequest,
  onOpenCut,
}: {
  project: VideoProject;
  cut: Cut;
  asset?: Asset;
  startAt?: number;
  /** Bumped by the page to open the booklet at the publishing checklist. */
  checklistRequest?: number;
  onOpenCut: (cutId: string, sec: number) => void;
}) {
  const { data, allowed } = useStore();
  const clock = useVideoClock(asset?.durationSec ?? 0, asset?.videoUrl);
  const { t, duration, playing, seek, toggle, state, hasFile } = clock;
  const [view, setView] = useViewerSettings(data.currentUserId);
  const [bookletOpen, setBookletOpen] = useSessionFlag(BOOKLET_KEY, false);
  const [markers, setMarkers] = useSessionFlag(MARKERS_KEY, false);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [idle, setIdle] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const idleTimer = useRef(0);
  const narrow = useMedia('(max-width: 1099.98px)');

  const notes = notesOf(data, cut.id);
  const chapters = chaptersOf(data, cut.id);
  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const sections = useMemo(() => bookletSections(notes, chapters, idea?.plan?.sections, duration), [notes, chapters, idea, duration]);
  const earlier = earlierFeedback(data, cut);
  const now = sectionAtTime(sections, t);
  const progress = reviewProgress(notes);
  const open = progress.total - progress.done;
  const mayNote = allowed({ type: 'studio/note-add', note: { id: 'probe', cutId: cut.id, startSec: 0, text: '', resolved: false, authorId: data.currentUserId, createdAt: '' } });
  const fmt = (s: number) => timecode(s, duration);
  const second = Math.floor(t + 1e-6);
  const sample = asset?.mediaSource === 'bundled-sample';

  // Open at ?t= (e.g. "See it in Draft 1"); re-seek once the duration is known.
  useEffect(() => {
    if (startAt !== undefined) seek(startAt);
  }, [cut.id, startAt, duration > 0]);
  useEffect(() => {
    setDraft(null);
    setStarted(startAt !== undefined);
  }, [cut.id]);
  useEffect(() => {
    if (checklistRequest) setBookletOpen(true);
  }, [checklistRequest, setBookletOpen]);
  // Viewer-only settings reach this player element and nothing else.
  useEffect(() => {
    const v = clock.ref.current;
    if (!v) return;
    v.playbackRate = speed;
    v.volume = view.volume;
    v.muted = view.muted;
  }, [speed, view.volume, view.muted, clock.ref, asset?.videoUrl]);
  useEffect(() => {
    if (playing) setStarted(true);
  }, [playing]);

  // Fullscreen holds the player and, if open, the booklet beside it.
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => {});
  };

  // Controls fade while playing and the pointer is still.
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
  };
  useEffect(() => {
    if (!playing) setIdle(false);
    else wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [playing]);
  const controlsHidden = playing && idle && !menu && !scrubbing;

  const noteHere = () => {
    if (!mayNote) return;
    clock.pause();
    seek(second);
    setDraft({ start: second, section: now && sections.length > 1 ? now.title : '', text: '' });
    setBookletOpen(true);
  };
  const step = (by: number) => seek(Math.round(t) + by);

  // Keys: Space/K play · ←/→ 5 s · Shift+←/→ 1 s · J/L 10 s · N note · B booklet · F fullscreen · M mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], .modal, .rmenu') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.closest('[role="slider"]') && e.key.startsWith('Arrow')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ' && el.closest('button, a')) return;
      if (k === ' ' || k === 'k') toggle();
      else if (k === 'ArrowLeft') step(e.shiftKey ? -1 : -5);
      else if (k === 'ArrowRight') step(e.shiftKey ? 1 : 5);
      else if (k === 'j') step(-10);
      else if (k === 'l') step(10);
      else if (k === 'n') noteHere();
      else if (k === 'b') setBookletOpen(!bookletOpen);
      else if (k === 'f') toggleFullscreen();
      else if (k === 'm') setView({ muted: !view.muted });
      else return;
      e.preventDefault();
      wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // On small screens (outside fullscreen) the booklet is a sheet over the page.
  const sheet = narrow && !fullscreen;
  const bookletEl = (
    <>
          <button type="button" className="rv__scrim" aria-label="Close booklet" tabIndex={-1} onClick={() => setBookletOpen(false)} />
          <Booklet
            cut={cut}
            sections={sections}
            notes={notes}
            duration={duration}
            t={t}
            playing={playing}
            draft={draft}
            setDraft={setDraft}
            earlier={earlier}
            mayNote={mayNote}
            sample={sample}
            onSeek={seek}
            onOpenCut={onOpenCut}
            onExport={() => setExporting(true)}
            onClose={() => setBookletOpen(false)}
            top={cut.kind === 'final' ? <PublishChecklist project={project} cut={cut} /> : undefined}
            topRequest={checklistRequest}
          />
        </>
  );

  const busy = hasFile && (state === 'loading' || state === 'seeking' || state === 'buffering') && !scrubbing;
  const busyLabel = state === 'loading' ? 'Loading the video…' : state === 'buffering' ? 'Buffering…' : `Loading ${fmt(clock.target ?? t)}…`;
  const vertical = project.aspect === '9:16' || project.aspect === '4:5';

  return (
    <div
      ref={root}
      className={`rv ${bookletOpen ? 'rv--booklet' : ''} ${fullscreen ? 'rv--fs' : ''} ${vertical ? 'rv--vertical' : 'rv--wide'}`}
      data-testid="review"
      data-fullscreen={fullscreen ? 'true' : 'false'}
    >
      <div className={`rv__stage ${controlsHidden ? 'is-idle' : ''}`} onPointerMove={wake} onPointerDown={wake} data-state={hasFile ? state : 'placeholder'} data-testid="stage">
        {hasFile ? (
          <video
            ref={clock.ref}
            key={asset!.id}
            src={asset!.videoUrl}
            poster={asset!.art.image}
            playsInline
            preload="auto"
            onClick={toggle}
            onDoubleClick={toggleFullscreen}
            style={view.brightness !== 1 ? { filter: `brightness(${view.brightness})` } : undefined}
            aria-label={`${cut.label} of ${project.title}`}
            data-testid="studio-video"
          />
        ) : (
          <div className="rv__empty" role="note">
            <Icon name="film" size={22} />
            <p>
              <strong>{cut.label}</strong> is a placeholder in the preview, so there’s nothing to play. Choose a draft above to review it.
            </p>
          </div>
        )}
        {sample && <span className="rv__sample">Sample video</span>}
        {busy && (
          <p className="rv__status" role="status" data-testid="player-status">
            <span className="spinner" aria-hidden="true" /> {busyLabel}
          </p>
        )}
        {hasFile && state === 'error' && (
          <div className="rv__status rv__status--error" role="alert">
            <span>This video couldn’t be loaded.</span>
            <button type="button" className="btn btn--sm" onClick={() => clock.ref.current?.load()}>
              Try again
            </button>
          </div>
        )}
        {hasFile && !started && !playing && !busy && (
          <button type="button" className="rv__bigplay" onClick={toggle} aria-label={`Play ${cut.label}`}>
            <Icon name="play" size={30} />
          </button>
        )}

        <div className="rv__controls" onPointerDown={(e) => e.stopPropagation()}>
          <Scrubber
            duration={duration}
            t={t}
            buffered={clock.buffered}
            sections={sections}
            notes={markers ? notes : []}
            onSeek={seek}
            onScrub={(on) => {
              setScrubbing(on);
              if (on) clock.pause();
            }}
          />
          <div className="rv__bar">
            <button type="button" className="rv__btn rv__play" onClick={toggle} disabled={!hasFile} aria-label={playing ? 'Pause' : 'Play'} data-testid="play">
              {playing ? <span className="pause-glyph" aria-hidden="true" /> : <Icon name="play" size={18} />}
            </button>
            <div className="rv__volume">
              <button type="button" className="rv__btn" onClick={() => setView({ muted: !view.muted })} aria-label={view.muted ? 'Unmute' : 'Mute'} aria-pressed={view.muted}>
                <VolumeGlyph level={view.muted ? 0 : view.volume} />
              </button>
              <input type="range" min={0} max={1} step={0.05} value={view.muted ? 0 : view.volume} onChange={(e) => setView({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })} aria-label="Volume" />
            </div>
            <p className="rv__time" data-testid="timecode" aria-label={`At ${fmt(t)} of ${fmt(duration)}`}>
              <span>{fmt(t)}</span> / {fmt(duration)}
            </p>
            {sections.length > 1 && now && <p className="rv__section">{now.title}</p>}
            <span className="spacer" />
            {mayNote && (
              <button type="button" className="rv__note" onClick={noteHere} title="Add a note at this second (N)" data-testid="add-note">
                <Icon name="plus" size={14} /> {playing ? 'Add note' : `Add note at ${fmt(second)}`}
              </button>
            )}
            {fullscreen ? (
              <div className="rv__modes" role="radiogroup" aria-label="Fullscreen layout">
                <button type="button" role="radio" aria-checked={!bookletOpen} className={!bookletOpen ? 'is-on' : ''} onClick={() => setBookletOpen(false)}>
                  Video only
                </button>
                <button type="button" role="radio" aria-checked={bookletOpen} className={bookletOpen ? 'is-on' : ''} onClick={() => setBookletOpen(true)}>
                  Video + Booklet
                </button>
              </div>
            ) : (
              <button type="button" className={`rv__booklet ${bookletOpen ? 'is-on' : ''}`} onClick={() => setBookletOpen(!bookletOpen)} aria-pressed={bookletOpen} data-testid="booklet-toggle" title="Open or close the review booklet (B)">
                <Icon name="file" size={14} /> Booklet {open > 0 && <span className="rv__count">{open} open</span>}
              </button>
            )}
            <SettingsMenu
              open={menu}
              setOpen={setMenu}
              t={t}
              duration={duration}
              speed={speed}
              setSpeed={setSpeed}
              brightness={view.brightness}
              setBrightness={(b) => setView({ brightness: b })}
              markers={markers}
              setMarkers={setMarkers}
              onStep={step}
              onGo={seek}
              onExport={() => setExporting(true)}
              hasFile={hasFile}
            />
            <button type="button" className="rv__btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F)" data-testid="fullscreen">
              <FullscreenGlyph exit={fullscreen} />
            </button>
          </div>
        </div>
      </div>

      {bookletOpen && (sheet ? createPortal(
            <div className="booklet-sheet" onKeyDown={(e) => e.key === 'Escape' && !(e.target as HTMLElement).closest('textarea, input') && setBookletOpen(false)}>
              {bookletEl}
            </div>,
            document.body,
          ) : bookletEl)}

      {exporting && <NotesDocument project={project} cut={cut} duration={duration} onClose={() => setExporting(false)} />}
      {view.brightness !== 1 && !fullscreen && <p className="rv__hint">Brightness {Math.round(view.brightness * 100)}% is on your screen only. The file, other people’s view and the posted video are unchanged.</p>}
      {asset?.durationSec !== undefined && !hasFile && <p className="rv__hint">Sample length {lengthLabel(asset.durationSec)}.</p>}
    </div>
  );
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** A familiar progress bar: drag or click to the exact second; quiet section ticks. */
function Scrubber({
  duration,
  t,
  buffered,
  sections,
  notes,
  onSeek,
  onScrub,
}: {
  duration: number;
  t: number;
  buffered: [number, number][];
  sections: BookletSection[];
  notes: { id: string; startSec: number; text: string; resolved: boolean }[];
  onSeek: (sec: number) => void;
  onScrub: (on: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const frame = useRef(0);
  const [hover, setHover] = useState<{ sec: number; x: number } | null>(null);
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const d = Math.max(duration, 0.001);
  const shown = scrubAt ?? t;
  const pct = (s: number) => `${(Math.max(0, Math.min(d, s)) / d) * 100}%`;
  const fmt = (s: number) => timecode(s, d);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const secAt = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(Math.floor(d), Math.round(((x - r.left) / r.width) * d)));
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
    const r = track.current!.getBoundingClientRect();
    setHover({ sec: secAt(e.clientX), x: e.clientX - r.left });
    if (dragging.current) scrubTo(secAt(e.clientX));
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setScrubAt(null);
    onScrub(false);
  };
  const key = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? 1 : 5;
    if (e.key === 'ArrowLeft') onSeek(Math.round(t) - by);
    else if (e.key === 'ArrowRight') onSeek(Math.round(t) + by);
    else if (e.key === 'Home') onSeek(0);
    else if (e.key === 'End') onSeek(d);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const hoverSection = hover ? sections.find((s) => hover.sec >= s.start && hover.sec < s.end) : undefined;

  return (
    <div
      ref={track}
      className={`scrub ${scrubAt !== null ? 'is-scrubbing' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Seek. Arrow keys move 5 seconds; with Shift, 1 second."
      aria-valuemin={0}
      aria-valuemax={Math.round(d)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${fmt(shown)} of ${fmt(d)}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={() => setHover(null)}
      onKeyDown={key}
      data-testid="scrubber"
    >
      <div className="scrub__rail">
        {buffered.map(([a, b], i) => (
          <span key={i} className="scrub__buffered" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} />
        ))}
        <span className="scrub__played" style={{ width: pct(shown) }} />
        {sections.slice(1).map((s) => (
          <span key={s.id} className="scrub__tick" style={{ left: pct(s.start) }} />
        ))}
        {notes.map((n) => (
          <span key={n.id} className={`scrub__marker ${n.resolved ? 'is-done' : ''}`} style={{ left: pct(n.startSec) }} title={`${fmt(n.startSec)} · ${n.text}`} data-marker={n.id} />
        ))}
      </div>
      <span className="scrub__thumb" style={{ left: pct(shown) }} />
      {hover && (
        <span className="scrub__hover" style={{ left: hover.x }} aria-hidden="true">
          {hoverSection && sections.length > 1 && <em>{hoverSection.title}</em>}
          {fmt(hover.sec)}
        </span>
      )}
    </div>
  );
}

function SettingsMenu({
  open,
  setOpen,
  t,
  duration,
  speed,
  setSpeed,
  brightness,
  setBrightness,
  markers,
  setMarkers,
  onStep,
  onGo,
  onExport,
  hasFile,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  t: number;
  duration: number;
  speed: number;
  setSpeed: (s: number) => void;
  brightness: number;
  setBrightness: (b: number) => void;
  markers: boolean;
  setMarkers: (v: boolean) => void;
  onStep: (by: number) => void;
  onGo: (sec: number) => void;
  onExport: () => void;
  hasFile: boolean;
}) {
  const close = useCallback(() => setOpen(false), [setOpen]);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const [go, setGo] = useState('');
  const [error, setError] = useState('');
  const fmt = (s: number) => timecode(s, duration);
  const submit = () => {
    const sec = parseTimecode(go);
    if (sec === undefined) return setError('Use a time like 00:14:32, 14:32 or 872.');
    if (sec > duration) return setError(`This draft is ${fmt(duration)} long.`);
    setError('');
    onGo(sec);
  };
  return (
    <div className="rmenu-wrap" ref={ref}>
      <button type="button" className={`rv__btn ${open ? 'is-on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label="Player settings" data-testid="player-settings">
        <GearGlyph />
      </button>
      {open && (
        <div
          className="rmenu"
          role="dialog"
          aria-label="Player settings"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
        >
          <section>
            <h3>Exact position</h3>
            <div className="rmenu__step">
              <button type="button" onClick={() => onStep(-1)} aria-label="Back 1 second">
                −1s
              </button>
              <span className="mono" data-testid="exact-time">
                {fmt(Math.floor(t + 1e-6))}
              </span>
              <button type="button" onClick={() => onStep(1)} aria-label="Forward 1 second">
                +1s
              </button>
            </div>
            <form
              className="rmenu__go"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                className="mono"
                value={go}
                onChange={(e) => {
                  setGo(e.target.value);
                  setError('');
                }}
                placeholder={duration >= 3600 ? '00:14:32' : '0:14'}
                aria-label="Go to time"
                inputMode="numeric"
              />
              <button type="submit">Go</button>
            </form>
            {error && (
              <p className="rmenu__error" role="alert">
                {error}
              </p>
            )}
          </section>
          <section>
            <h3>Speed</h3>
            <div className="rmenu__seg" role="radiogroup" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={speed === s} className={speed === s ? 'is-on' : ''} onClick={() => setSpeed(s)} disabled={!hasFile}>
                  {s}×
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>Brightness · your screen only</h3>
            <div className="rmenu__row">
              <input type="range" min={BRIGHTNESS_MIN} max={BRIGHTNESS_MAX} step={0.05} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} aria-label="Brightness (your view only)" aria-valuetext={`${Math.round(brightness * 100)}%`} />
              <span className="mono">{Math.round(brightness * 100)}%</span>
              {brightness !== 1 && (
                <button type="button" className="rmenu__link" onClick={() => setBrightness(1)}>
                  Reset
                </button>
              )}
            </div>
            <p className="rmenu__hint">Never changes the file, anyone else’s view, or the posted video.</p>
          </section>
          <section>
            <label className="rmenu__toggle">
              <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} />
              <span>Show note markers on the progress bar</span>
            </label>
            <button type="button" className="rmenu__link" onClick={onExport}>
              Export the full note list
            </button>
          </section>
          <details className="rmenu__keys">
            <summary>Keyboard shortcuts</summary>
            <dl>
              <dt>Space / K</dt>
              <dd>Play or pause</dd>
              <dt>← →</dt>
              <dd>5 seconds</dd>
              <dt>Shift + ← →</dt>
              <dd>1 second</dd>
              <dt>J / L</dt>
              <dd>10 seconds</dd>
              <dt>N</dt>
              <dd>Add a note here</dd>
              <dt>B</dt>
              <dd>Booklet</dd>
              <dt>F</dt>
              <dd>Fullscreen</dd>
              <dt>M</dt>
              <dd>Mute</dd>
            </dl>
          </details>
        </div>
      )}
    </div>
  );
}

function VolumeGlyph({ level }: { level: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {level === 0 ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
      {level > 0.5 && <path d="M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

function FullscreenGlyph({ exit }: { exit: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}
