import { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Cut, TimeNote, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { useStore } from '../../state/store';
import { chapterAt, chaptersOf, earlierFeedback, focusAt, lengthLabel, notesOf, parseTimecode, timecode } from '../../lib/videoStudio';
import { NotesPanel, type NoteDraft } from './NotesPanel';
import { NotesDocument } from './NotesDocument';
import { Timeline, zoomLevels } from './Timeline';
import { useVideoClock } from './useVideoClock';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, useViewerSettings } from './useViewerSettings';

const SPEEDS = [0.5, 1, 1.5, 2];

/**
 * Watch and review one draft. Haven doesn't edit video: the editor makes
 * changes elsewhere and uploads the next draft. Here you play, scrub, jump to
 * an exact second, and leave timestamped notes for the next draft.
 */
export function StudioCanvas({ project, cut, asset, startAt, onOpenCut }: { project: VideoProject; cut: Cut; asset?: Asset; startAt?: number; onOpenCut: (cutId: string, sec: number) => void }) {
  const { data, allowed } = useStore();
  const clock = useVideoClock(asset?.durationSec ?? 0, asset?.videoUrl);
  const { t, duration, playing, seek, toggle, state, hasFile } = clock;
  const [view, setView] = useViewerSettings(data.currentUserId);
  const notes = notesOf(data, cut.id);
  const chapters = chaptersOf(data, cut.id);
  const earlier = earlierFeedback(data, cut);
  const focus = focusAt(notes, t);
  const [notesOpen, setNotesOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [speed, setSpeed] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [goto, setGoto] = useState('');
  const [gotoError, setGotoError] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const gotoRef = useRef<HTMLInputElement>(null);
  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const mayNote = allowed({ type: 'studio/note-add', note: { id: 'probe', cutId: cut.id, startSec: 0, text: '', resolved: false, authorId: data.currentUserId, createdAt: '' } });
  const fmt = (s: number) => timecode(s, duration);
  const second = Math.floor(t + 1e-6);
  const nowChapter = chapterAt(chapters, t);

  // Open at a time from the link (?t=), e.g. "See it in Draft 1".
  useEffect(() => {
    if (startAt !== undefined) seek(startAt);
    // Re-seek once the real duration is known.
  }, [cut.id, startAt, duration > 0]);
  useEffect(() => {
    setDraft(null);
    setZoom(1);
  }, [cut.id]);
  // Viewer-only settings go to this player element and nowhere else.
  useEffect(() => {
    const v = clock.ref.current;
    if (!v) return;
    v.playbackRate = speed;
    v.volume = view.volume;
    v.muted = view.muted;
  }, [speed, view.volume, view.muted, clock.ref, asset?.videoUrl]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    chapters.forEach((c) => s.add(c.title));
    idea?.plan?.sections.forEach((p) => s.add(p.title));
    data.notes.forEach((n) => n.section && s.add(n.section));
    return [...s];
  }, [chapters, idea, data.notes]);

  const sectionAt = (sec: number) => chapterAt(chapters, sec)?.title ?? notes.filter((n) => n.startSec <= sec && n.section).pop()?.section ?? '';
  /** Pause and write a note at the exact second on screen. */
  const noteHere = () => {
    if (!mayNote) return;
    clock.pause();
    seek(second);
    setDraft({ start: second, section: sectionAt(second), text: '' });
    setNotesOpen(true);
  };
  const jumpToNote = (n: TimeNote) => seek(n.startSec);
  const step = (by: number) => seek(Math.round(t) + by);
  const go = () => {
    const sec = parseTimecode(goto);
    if (sec === undefined) return setGotoError('Use a time like 00:14:32, 14:32 or 872.');
    if (sec > duration) return setGotoError(`This draft is ${fmt(duration)} long.`);
    setGotoError('');
    seek(sec);
  };
  const jumpChapter = (dir: 1 | -1) => {
    if (!chapters.length) return;
    const i = chapters.findIndex((c) => c.id === nowChapter?.id);
    const target = dir === 1 ? chapters[i + 1] : t - (nowChapter?.startSec ?? 0) > 2 ? nowChapter : chapters[Math.max(0, i - 1)];
    if (target) seek(target.startSec);
  };

  // Space/K play · ←/→ one second (Shift: ten) · N note · M mute · G go to · [ ] chapters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], .modal') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.closest('[role="slider"]') && e.key.startsWith('Arrow')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ' && el.closest('button')) return;
      if (k === ' ' || k === 'k') toggle();
      else if (k === 'ArrowLeft') step(e.shiftKey ? -10 : -1);
      else if (k === 'ArrowRight') step(e.shiftKey ? 10 : 1);
      else if (k === 'n') noteHere();
      else if (k === 'm') setView({ muted: !view.muted });
      else if (k === 'g') gotoRef.current?.focus();
      else if (k === '[') jumpChapter(-1);
      else if (k === ']') jumpChapter(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ratio = project.aspect.replace(':', ' / ');
  const vertical = project.aspect === '9:16' || project.aspect === '4:5';
  const busy = hasFile && (state === 'loading' || state === 'seeking' || state === 'buffering') && !scrubbing;
  const busyLabel = state === 'loading' ? 'Loading the video…' : state === 'buffering' ? 'Buffering…' : `Loading ${fmt(clock.target ?? t)}…`;
  const brightnessPct = Math.round(view.brightness * 100);

  return (
    <div className={`canvas ${notesOpen ? 'canvas--notes' : ''} ${vertical ? 'canvas--vertical' : 'canvas--wide'}`}>
      <div className="canvas__main">
        <div className="sstage" style={{ ['--ratio' as string]: ratio }} data-state={hasFile ? state : 'placeholder'} data-testid="stage">
          {hasFile ? (
            <video
              ref={clock.ref}
              key={asset!.id}
              src={asset!.videoUrl}
              poster={asset!.art.image}
              playsInline
              preload="auto"
              onClick={toggle}
              style={view.brightness !== 1 ? { filter: `brightness(${view.brightness})` } : undefined}
              aria-label={`${cut.label} of ${project.title}`}
              data-testid="studio-video"
            />
          ) : (
            <div className="sstage__empty" role="note">
              <Icon name="film" size={20} />
              <p>
                <strong>{cut.label}</strong> is a placeholder in the preview: there’s no playable file. Its length ({lengthLabel(duration)}) is a sample figure, so notes can still be placed on the timeline.
              </p>
            </div>
          )}
          {busy && (
            <p className="sstage__status" role="status" data-testid="player-status">
              <span className="spinner" aria-hidden="true" /> {busyLabel}
            </p>
          )}
          {hasFile && state === 'error' && (
            <div className="sstage__status sstage__status--error" role="alert">
              <span>This video couldn’t be loaded.</span>
              <button type="button" className="btn btn--sm" onClick={() => clock.ref.current?.load()}>
                Try again
              </button>
            </div>
          )}
          {focus.current && focus.note && notesOpen && !busy && (
            <p className="sstage__caption" aria-hidden="true">
              <span>{fmt(focus.note.startSec)} · {focus.note.section ?? 'Note'}</span> {focus.note.text}
            </p>
          )}
        </div>

        <div className="transport" role="group" aria-label="Playback">
          <button type="button" className="transport__play" onClick={toggle} disabled={!hasFile} aria-label={playing ? 'Pause' : 'Play'} data-testid="play">
            {playing ? <span className="pause-glyph" aria-hidden="true" /> : <Icon name="play" size={18} />}
          </button>
          <button type="button" className="transport__step" onClick={() => step(-1)} aria-label="Back 1 second" title="Back 1 second (←)">
            −1s
          </button>
          <button type="button" className="transport__step" onClick={() => step(1)} aria-label="Forward 1 second" title="Forward 1 second (→)">
            +1s
          </button>
          <p className="transport__time mono" data-testid="timecode" aria-label={`At ${fmt(t)} of ${fmt(duration)}`}>
            <strong>{fmt(t)}</strong> <span>/ {fmt(duration)}</span>
          </p>
          <form
            className={`goto ${gotoError ? 'has-error' : ''}`}
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <input
              ref={gotoRef}
              className="mono"
              value={goto}
              onChange={(e) => {
                setGoto(e.target.value);
                setGotoError('');
              }}
              placeholder={duration >= 3600 ? '00:14:32' : '0:14'}
              aria-label="Go to time"
              aria-describedby={gotoError ? 'goto-error' : undefined}
              inputMode="numeric"
              title="Go to a time (G)"
            />
            <button type="submit" className="btn btn--ghost btn--sm">
              Go
            </button>
            {gotoError && (
              <span id="goto-error" className="goto__error" role="alert">
                {gotoError}
              </span>
            )}
          </form>
          <span className="spacer" />
          {mayNote && (
            <button type="button" className="btn btn--primary btn--sm transport__note" onClick={noteHere} title="Pause and add a note at this second (N)" data-testid="add-note">
              <Icon name="plus" size={14} /> Note at {fmt(second)}
            </button>
          )}
        </div>

        <Timeline
          duration={duration}
          t={t}
          notes={notes}
          chapters={chapters}
          zoom={zoom}
          buffered={clock.buffered}
          pending={draft && !draft.editingId ? draft.start : undefined}
          focusId={focus.note?.id}
          onSeek={seek}
          onScrub={(on) => {
            setScrubbing(on);
            if (on) clock.pause();
          }}
          onNote={jumpToNote}
        />

        <div className="viewbar">
          <div className="zoom" role="radiogroup" aria-label="Timeline zoom">
            <span className="zoom__label">Zoom</span>
            {zoomLevels(duration).map((z) => (
              <button key={z} type="button" role="radio" aria-checked={zoom === z} className={zoom === z ? 'is-active' : ''} onClick={() => setZoom(z)}>
                {z === 1 ? 'Fit' : `${z}×`}
              </button>
            ))}
          </div>
          <p className="viewbar__span" data-testid="zoom-span">
            {zoom === 1 ? `Whole draft · ${lengthLabel(duration)}` : `About ${lengthLabel(duration / zoom)} across`}
          </p>
          <span className="spacer" />
          <button type="button" className="viewbar__btn" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}×`} disabled={!hasFile}>
            {speed}×
          </button>
          <div className="viewbar__ctl">
            <button type="button" className="viewbar__btn" onClick={() => setView({ muted: !view.muted })} aria-label={view.muted ? 'Unmute' : 'Mute'} aria-pressed={view.muted} title="Mute (M)">
              <VolumeGlyph level={view.muted ? 0 : view.volume} />
            </button>
            <input type="range" min={0} max={1} step={0.05} value={view.muted ? 0 : view.volume} onChange={(e) => setView({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })} aria-label="Volume" />
          </div>
          <div className="viewbar__ctl" title="Brightness on your screen only. The file, other people’s view and the posted video don’t change.">
            <span className="viewbar__btn" aria-hidden="true">
              <Icon name="sun" size={15} />
            </span>
            <input type="range" min={BRIGHTNESS_MIN} max={BRIGHTNESS_MAX} step={0.05} value={view.brightness} onChange={(e) => setView({ brightness: Number(e.target.value) })} aria-label="Brightness (your view only)" aria-valuetext={`${brightnessPct}%`} />
            <span className="viewbar__value mono">{brightnessPct}%</span>
            {view.brightness !== 1 && (
              <button type="button" className="viewbar__reset" onClick={() => setView({ brightness: 1 })}>
                Reset
              </button>
            )}
          </div>
          <button type="button" className={`viewbar__btn viewbar__notes ${notesOpen ? 'is-on' : ''}`} onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen} data-testid="toggle-notes">
            <Icon name="comment" size={14} /> Notes {notes.length > 0 && <span className="count">{notes.filter((n) => !n.resolved).length}</span>}
          </button>
        </div>
        {view.brightness !== 1 && <p className="viewbar__hint">Brightness {brightnessPct}% is only on your screen. The file, other people’s view and the posted video are unchanged.</p>}

        {chapters.length > 0 && (
          <nav className="chapters" aria-label="Chapters">
            <div className="chapters__head">
              <h2 className="chapters__title">Chapters</h2>
              {nowChapter && <p className="chapters__now">{nowChapter.title}</p>}
              <span className="spacer" />
              {chapters.length > 1 && (
                <span className="chapters__step">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => jumpChapter(-1)} aria-label="Previous chapter">
                    <Icon name="chevronLeft" size={15} />
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => jumpChapter(1)} aria-label="Next chapter">
                    <Icon name="chevronRight" size={15} />
                  </button>
                </span>
              )}
            </div>
            <ol className="chapters__list">
              {chapters.map((c) => (
                <li key={c.id} className={nowChapter?.id === c.id ? 'is-now' : ''}>
                  <button type="button" onClick={() => seek(c.startSec)} aria-current={nowChapter?.id === c.id ? 'true' : undefined}>
                    <span className="mono">{fmt(c.startSec)}</span>
                    <span>{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="canvas__keys">
          <span className="kbd">Space</span> play · <span className="kbd">←</span>
          <span className="kbd">→</span> 1 s (Shift 10 s) · <span className="kbd">N</span> note · <span className="kbd">G</span> go to · <span className="kbd">M</span> mute
        </p>
      </div>

      {notesOpen && (
        <NotesPanel
          cut={cut}
          notes={notes}
          chapters={chapters}
          duration={duration}
          t={t}
          playing={playing}
          focus={focus}
          sections={sections}
          draft={draft}
          setDraft={setDraft}
          earlier={earlier}
          mayNote={mayNote}
          onSeek={(s) => seek(s)}
          onOpenCut={onOpenCut}
          onExport={() => setExporting(true)}
        />
      )}

      {exporting && <NotesDocument project={project} cut={cut} duration={duration} onClose={() => setExporting(false)} />}
    </div>
  );
}

function VolumeGlyph({ level }: { level: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {level === 0 ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
      {level > 0.5 && <path d="M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}
