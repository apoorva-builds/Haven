import { useEffect, useMemo, useState } from 'react';
import type { Asset, Cut, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { uid } from '../../state/reducer';
import { useStore } from '../../state/store';
import { chapterAt, chaptersOf, earlierFeedback, focusAt, lengthLabel, notesOf, timecode } from '../../lib/videoStudio';
import { NotesPanel, type NoteDraft } from './NotesPanel';
import { Timeline, zoomLevels, type Range } from './Timeline';
import { useVideoClock } from './useVideoClock';
import { NotesDocument } from './NotesDocument';

const SPEEDS = [1, 1.5, 2];

export function StudioCanvas({ project, cut, asset, startAt, onOpenCut }: { project: VideoProject; cut: Cut; asset?: Asset; startAt?: number; onOpenCut: (cutId: string, sec: number) => void }) {
  const { data, dispatch, allowed } = useStore();
  const hasFile = !!asset?.videoUrl;
  const clock = useVideoClock(asset?.durationSec ?? 0, asset?.videoUrl);
  const { t, duration, playing, seek, toggle } = clock;
  const notes = notesOf(data, cut.id);
  const chapters = chaptersOf(data, cut.id);
  const earlier = earlierFeedback(data, cut);
  const focus = focusAt(notes, t);
  const [notesOpen, setNotesOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<Range | undefined>();
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [speed, setSpeed] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [chapterTitle, setChapterTitle] = useState<string | null>(null);
  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const mayNote = allowed({ type: 'studio/note-add', note: { id: 'probe', cutId: cut.id, startSec: 0, text: '', resolved: false, authorId: data.currentUserId, createdAt: '' } });
  const mayEdit = allowed({ type: 'studio/chapter-add', chapter: { id: 'probe', cutId: cut.id, title: '', startSec: 0 } });
  const fmt = (s: number) => timecode(s, duration);
  const levels = zoomLevels(duration);
  const nowChapter = chapterAt(chapters, t);

  // Open at a time from the link (?t=), e.g. "See it in Draft 1".
  useEffect(() => {
    if (startAt !== undefined) seek(startAt);
  }, [cut.id, startAt, duration > 0]);
  useEffect(() => {
    setDraft(null);
    setSelection(undefined);
    setZoom(1);
  }, [cut.id]);
  useEffect(() => {
    if (clock.ref.current) clock.ref.current.playbackRate = speed;
  }, [speed, clock.ref]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    chapters.forEach((c) => s.add(c.title));
    idea?.plan?.sections.forEach((p) => s.add(p.title));
    data.notes.forEach((n) => n.section && s.add(n.section));
    return [...s];
  }, [chapters, idea, data.notes]);

  const sectionAt = (sec: number) => chapterAt(chapters, sec)?.title ?? notes.filter((n) => n.startSec <= sec && n.section).pop()?.section ?? '';
  const markMoment = () => {
    if (!mayNote) return;
    clock.ref.current?.pause();
    setSelection({ start: t });
    setDraft({ start: t, section: sectionAt(t), text: '' });
    setNotesOpen(true);
  };
  const markRange = (r: Range) => {
    if (!mayNote) {
      seek(r.start);
      return;
    }
    clock.ref.current?.pause();
    setSelection(r);
    setDraft({ start: r.start, end: r.end, section: sectionAt(r.start), text: '' });
    setNotesOpen(true);
  };
  // I marks the in point only; O (or the button) completes the range and opens the note.
  const setIn = () => {
    if (!mayNote) return;
    setSelection({ start: t });
  };
  const setOut = () => {
    const start = selection?.start ?? 0;
    if (t <= start) return;
    markRange({ start, end: t });
  };
  const jumpChapter = (dir: 1 | -1) => {
    if (!chapters.length) return;
    const i = chapters.findIndex((c) => c.id === nowChapter?.id);
    const target = dir === 1 ? chapters[i + 1] : t - (nowChapter?.startSec ?? 0) > 2 ? nowChapter : chapters[Math.max(0, i - 1)];
    if (target) seek(target.startSec);
  };

  // Keyboard: Space/K play, J/L ±5 s, M moment, I/O range, N notes, [ ] chapters.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], .modal') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ' && el.closest('button, [role="slider"]')) return;
      if (k === ' ' || k === 'k') toggle();
      else if (k === 'j') seek(t - 5);
      else if (k === 'l') seek(t + 5);
      else if (k === 'm') markMoment();
      else if (k === 'i') setIn();
      else if (k === 'o') setOut();
      else if (k === 'n') setNotesOpen((o) => !o);
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

  return (
    <div className={`canvas ${notesOpen ? 'canvas--notes' : ''} ${vertical ? 'canvas--vertical' : 'canvas--wide'}`}>
      <div className="canvas__main">
        <div className="sstage" style={{ ['--ratio' as string]: ratio }}>
          {hasFile ? (
            <video
              ref={clock.ref}
              key={asset!.id}
              src={asset!.videoUrl}
              poster={asset!.art.image}
              playsInline
              preload="metadata"
              onClick={toggle}
              aria-label={`${cut.label} of ${project.title}`}
              data-testid="studio-video"
            />
          ) : (
            <div className="sstage__empty" role="tnote">
              <Icon name="film" size={20} />
              <p>
                <strong>{cut.label}</strong> is a placeholder in the preview: there’s no playable file. Its length ({lengthLabel(duration)}) is a sample figure, so you can still place notes on the timeline.
              </p>
            </div>
          )}
          {focus.current && focus.note && notesOpen && (
            <p className="sstage__caption" aria-hidden="true">
              <span>{focus.note.section ?? 'Note'}</span> {focus.note.text}
            </p>
          )}
        </div>

        <div className="transport" role="group" aria-label="Playback">
          <button type="button" className="transport__play" onClick={toggle} disabled={!hasFile} aria-label={playing ? 'Pause' : 'Play'} data-testid="play">
            {playing ? <span className="pause-glyph" aria-hidden="true" /> : <Icon name="play" size={18} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => seek(t - 5)} aria-label="Back 5 seconds">
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => seek(t + 5)} aria-label="Forward 5 seconds">
            <Icon name="chevronRight" size={18} />
          </button>
          <p className="transport__time mono" aria-live="off" data-testid="timecode">
            <strong>{fmt(t)}</strong> <span>/ {fmt(duration)}</span>
          </p>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}×`} disabled={!hasFile}>
            {speed}×
          </button>
          {mayNote && (
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={markMoment} title="Mark this moment (M)" data-testid="mark-moment">
                <span className="kbd">M</span> Moment
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={selection && selection.end === undefined && t > selection.start ? setOut : setIn} title="Set in (I), then out (O)" data-testid="mark-range">
                <span className="kbd">{selection && selection.end === undefined && t > selection.start ? 'O' : 'I'}</span> {selection && selection.end === undefined && t > selection.start ? `Range from ${fmt(selection.start)}` : 'Range'}
              </button>
            </>
          )}
          <button type="button" className={`btn btn--sm ${notesOpen ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen} title="Show or hide notes (N)" data-testid="toggle-notes">
            <Icon name="comment" size={14} /> Notes {notes.length > 0 && <span className="count">{notes.filter((n) => !n.resolved).length}</span>}
          </button>
        </div>

        <Timeline duration={duration} t={t} notes={notes} chapters={chapters} zoom={zoom} selection={selection} focusId={focus.note?.id} onSeek={seek} onSelect={markRange} />

        <div className="tlbar">
          <div className="zoom" role="radiogroup" aria-label="Timeline zoom">
            <span className="zoom__label">Zoom</span>
            {levels.map((z) => (
              <button key={z} type="button" role="radio" aria-checked={zoom === z} className={zoom === z ? 'is-active' : ''} onClick={() => setZoom(z)}>
                {z === 1 ? 'Fit' : `${z}×`}
              </button>
            ))}
          </div>
          <p className="tlbar__span muted small" data-testid="zoom-span">
            {zoom === 1 ? `Whole video · ${lengthLabel(duration)}` : `About ${lengthLabel(duration / zoom)} across`}
          </p>
        </div>

        {(chapters.length > 0 || mayEdit) && (
          <nav className="chapters" aria-label="Chapters">
            <div className="chapters__head">
              <h2 className="chapters__title">Chapters</h2>
              {nowChapter && <p className="chapters__now">{nowChapter.title}</p>}
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
              <span className="spacer" />
              {mayEdit && chapterTitle === null && (
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setChapterTitle('')}>
                  <Icon name="plus" size={13} /> Chapter at {fmt(t)}
                </button>
              )}
            </div>
            {chapterTitle !== null && (
              <form
                className="chapters__add"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chapterTitle.trim()) return;
                  dispatch({ type: 'studio/chapter-add', chapter: { id: uid('ch'), cutId: cut.id, title: chapterTitle.trim(), startSec: Math.floor(t) } });
                  setChapterTitle(null);
                }}
              >
                <span className="mono">{fmt(t)}</span>
                <input autoFocus value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="Chapter name" aria-label="Chapter name" />
                <button type="submit" className="btn btn--primary btn--xs">
                  Add
                </button>
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setChapterTitle(null)}>
                  Cancel
                </button>
              </form>
            )}
            {chapters.length > 0 ? (
              <ol className="chapters__list">
                {chapters.map((c) => (
                  <li key={c.id} className={nowChapter?.id === c.id ? 'is-now' : ''}>
                    <button type="button" onClick={() => seek(c.startSec)} aria-current={nowChapter?.id === c.id ? 'true' : undefined}>
                      <span className="mono">{fmt(c.startSec)}</span>
                      <span>{c.title}</span>
                    </button>
                    {mayEdit && (
                      <button type="button" className="chapters__remove" aria-label={`Remove chapter ${c.title}`} onClick={() => dispatch({ type: 'studio/chapter-delete', chapterId: c.id })}>
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">No chapters yet. Long videos are easier to review with a few named chapters.</p>
            )}
          </nav>
        )}
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
          setDraft={(d) => {
            setDraft(d);
            if (!d) setSelection(undefined);
            else setSelection({ start: d.start, end: d.end });
          }}
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
