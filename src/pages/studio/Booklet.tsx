import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Cut, TimeNote } from '../../data/types';
import { Icon } from '../../components/Icon';
import { Avatar } from '../../components/ui';
import { parseTimecode, reviewProgress, sectionAtTime, timecode, type BookletSection } from '../../lib/videoStudio';
import { uid } from '../../state/reducer';
import { useStore } from '../../state/store';

export interface NoteDraft {
  start: number;
  end?: number;
  section: string;
  text: string;
  /** Editing an existing note rather than adding one. */
  editingId?: string;
}

/**
 * The review booklet: a calm companion to the player. Notes are organised by
 * section; each one is Open or Done. Done means the change was made outside
 * Haven. It never means Haven changed the footage.
 */
export function Booklet({
  cut,
  sections,
  notes,
  duration,
  t,
  playing,
  draft,
  setDraft,
  earlier,
  mayNote,
  sample,
  onSeek,
  onOpenCut,
  onExport,
  onClose,
  top,
  topRequest,
}: {
  cut: Cut;
  sections: BookletSection[];
  notes: TimeNote[];
  duration: number;
  t: number;
  playing: boolean;
  draft: NoteDraft | null;
  setDraft: (d: NoteDraft | null) => void;
  earlier: { note: TimeNote; from: Cut }[];
  mayNote: boolean;
  sample: boolean;
  onSeek: (sec: number) => void;
  onOpenCut: (cutId: string, sec: number) => void;
  onExport: () => void;
  onClose: () => void;
  /** Shown above the sections, e.g. the publishing checklist of a final. */
  top?: ReactNode;
  /** Bumped to bring the top (the checklist) into view. */
  topRequest?: number;
}) {
  const { data, dispatch } = useStore();
  const body = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fmt = (s: number) => timecode(s, duration);
  const now = sectionAtTime(sections, t);
  const progress = reviewProgress(notes);
  const ready = sections.filter((s) => s.notes.length && s.notes.every((n) => n.resolved)).length;
  const attention = sections.filter((s) => s.notes.some((n) => !n.resolved)).length;

  // Follow the current section, but never while someone is reading or writing.
  const scrollToNow = (smooth = true) => {
    const box = body.current;
    const el = box?.querySelector<HTMLElement>(`[data-section="${now?.id}"]`);
    if (box && el) box.scrollTo({ top: Math.max(0, el.offsetTop - box.offsetTop - 8), behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => {
    if (following && playing && !draft) scrollToNow();
    // Only when the section changes.
  }, [now?.id, following, playing]);
  useEffect(() => {
    if (draft) setFollowing(false);
  }, [draft]);
  useEffect(() => {
    if (!topRequest) return;
    setFollowing(false);
    body.current?.scrollTo({ top: 0 });
  }, [topRequest]);
  // Open at the current moment.
  useEffect(() => {
    // A final opens at its publishing checklist instead.
    if (!draft && !top) scrollToNow(false);
  }, [cut.id]);
  const stopFollowing = () => setFollowing(false);

  const flash = (text: string) => {
    setSaved(text);
    window.setTimeout(() => setSaved((s) => (s === text ? null : s)), 2600);
  };
  const toggle = (n: TimeNote) => {
    dispatch({ type: 'studio/note-update', noteId: n.id, patch: { resolved: !n.resolved } });
    flash(n.resolved ? 'Reopened. It’s back on the list.' : 'Marked done.');
  };

  return (
    <aside className="booklet" aria-label="Review booklet" data-testid="booklet">
      <header className="booklet__head">
        <div className="booklet__heading">
          <p className="booklet__eyebrow">
            Review booklet{sample && <span className="booklet__sample"> · Sample data</span>}
          </p>
          <h2 className="booklet__title">{cut.label}</h2>
        </div>
        <button type="button" className="icon-btn booklet__close" onClick={onClose} aria-label="Close booklet">
          <Icon name="close" size={18} />
        </button>
      </header>

      {progress.total > 0 && (
        <div className="booklet__progress" data-testid="booklet-progress">
          <p>
            <strong>
              {progress.done} of {progress.total}
            </strong>{' '}
            review items done
          </p>
          <span className="booklet__bar" aria-hidden="true">
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </span>
          <p className="booklet__sub">
            {ready > 0 && <span className="booklet__ok">{ready} section{ready === 1 ? '' : 's'} ready</span>}
            {ready > 0 && attention > 0 && ' · '}
            {attention > 0 && <span>{attention} need{attention === 1 ? 's' : ''} attention</span>}
          </p>
        </div>
      )}

      <div className="booklet__body" ref={body} onWheel={stopFollowing} onTouchMove={stopFollowing} onKeyDown={stopFollowing}>
        {top}
        {draft && <Composer draft={draft} setDraft={setDraft} sections={sections} duration={duration} cut={cut} onSaved={flash} />}

        {notes.length === 0 && !draft && (
          <div className="booklet__empty">
            <p className="booklet__empty-title">Nothing noted on {cut.label} yet.</p>
            <p>{mayNote ? 'Pause at any moment and choose “Add note” to say what should change in the next draft.' : 'Notes from the team will appear here.'}</p>
          </div>
        )}

        {sections.map((s) => {
          const isNow = s.id === now?.id;
          const open = s.notes.filter((n) => !n.resolved).length;
          const pct = isNow ? Math.min(1, Math.max(0, (t - s.start) / Math.max(1, s.end - s.start))) : 0;
          return (
            <section key={s.id} className={`bsec ${isNow ? 'is-now' : ''}`} data-section={s.id} aria-current={isNow ? 'true' : undefined}>
              <button type="button" className="bsec__head" onClick={() => onSeek(s.start)} aria-label={`Play from ${s.title}, ${fmt(s.start)}`}>
                <span className="bsec__time">{fmt(s.start)}</span>
                <span className="bsec__title">{s.title}</span>
                <span className={`bsec__state ${!s.notes.length ? '' : open ? 'is-open' : 'is-ready'}`}>{!s.notes.length ? '' : open ? `${open} open` : 'Ready'}</span>
              </button>
              {isNow && (
                <span className="bsec__progress" aria-hidden="true">
                  <span style={{ width: `${pct * 100}%` }} />
                </span>
              )}
              {s.notes.length > 0 && (
                <ul className="bsec__notes">
                  {s.notes.map((n) => {
                    const author = data.people.find((p) => p.id === n.authorId);
                    const live = t >= n.startSec && t < (n.endSec ?? n.startSec + 3);
                    return (
                      <li key={n.id} className={`bnote ${n.resolved ? 'is-done' : ''} ${live ? 'is-live' : ''}`} data-note={n.id}>
                        <button
                          type="button"
                          className="tick"
                          aria-pressed={n.resolved}
                          aria-label={n.resolved ? `Reopen: ${n.text}` : `Mark done: ${n.text}`}
                          title={n.resolved ? 'Done. Click to reopen if it still needs work.' : 'Mark done once the change is made in your editor'}
                          onClick={() => toggle(n)}
                          disabled={!mayNote}
                        >
                          <span className="tick__box" aria-hidden="true">
                            {n.resolved && <Icon name="check" size={12} />}
                          </span>
                        </button>
                        <div className="bnote__main">
                          <button type="button" className="bnote__time" onClick={() => onSeek(n.startSec)} aria-label={`Jump to ${fmt(n.startSec)}`}>
                            {fmt(n.startSec)}
                            {n.endSec !== undefined && <span>–{fmt(n.endSec)}</span>}
                          </button>
                          <p className="bnote__text">{n.text}</p>
                          <p className="bnote__meta">
                            {author && <Avatar person={author} size={16} />} {author?.name ?? 'Someone'}
                            <span className="bnote__state">{n.resolved ? 'Done' : 'Open'}</span>
                            {n.carriedFrom && <span className="bnote__from">from an earlier draft</span>}
                            {mayNote && (
                              <span className="bnote__tools">
                                <button type="button" onClick={() => setDraft({ start: n.startSec, end: n.endSec, section: n.section ?? '', text: n.text, editingId: n.id })} aria-label={`Edit note: ${n.text}`}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => setConfirmDelete(n.id)} aria-label={`Delete note: ${n.text}`}>
                                  Delete
                                </button>
                              </span>
                            )}
                          </p>
                          {confirmDelete === n.id && (
                            <p className="bnote__confirm" role="alert">
                              Delete this note? The video isn’t affected.
                              <button type="button" className="btn btn--ghost btn--xs" onClick={() => setConfirmDelete(null)}>
                                Keep
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger btn--xs"
                                onClick={() => {
                                  dispatch({ type: 'studio/note-delete', noteId: n.id });
                                  setConfirmDelete(null);
                                  flash('Note deleted.');
                                }}
                              >
                                Delete note
                              </button>
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        {earlier.length > 0 && (
          <details className="earlier2" data-testid="earlier-feedback">
            <summary>
              Open notes on earlier drafts <span className="count">{earlier.length}</span>
            </summary>
            <p className="earlier2__lede">Kept at their original times for comparison. Haven never moves them onto this draft.</p>
            {earlier.map(({ note: n, from }) => (
              <div key={n.id} className="earlier2__item">
                <p className="earlier2__origin">
                  {timecode(n.startSec, Math.max(duration, n.endSec ?? 0))}
                  {n.endSec !== undefined && `–${timecode(n.endSec, Math.max(duration, n.endSec))}`} in {from.label}
                </p>
                <p className="earlier2__text">{n.text}</p>
                <p className="earlier2__actions">
                  <button type="button" className="inline-link" onClick={() => onOpenCut(from.id, n.startSec)}>
                    See it in {from.label}
                  </button>
                  {mayNote && (
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => {
                        const at = Math.floor(t);
                        const len = n.endSec !== undefined ? n.endSec - n.startSec : undefined;
                        dispatch({ type: 'studio/note-carry', noteId: n.id, toCutId: cut.id, startSec: at, endSec: len !== undefined ? Math.min(Math.floor(duration), at + len) : undefined, newId: uid('note') });
                        flash(`Added to ${cut.label} at ${fmt(at)}.`);
                      }}
                    >
                      Add to {cut.label} at {fmt(Math.floor(t))}
                    </button>
                  )}
                </p>
              </div>
            ))}
          </details>
        )}

        <footer className="booklet__foot">
          <button type="button" className="inline-link" onClick={onExport} data-testid="export-notes">
            Export the full note list
          </button>
          <span>Done means the change was made in your editor. Haven never edits the footage.</span>
        </footer>
      </div>

      {!following && (
        <button
          type="button"
          className="booklet__follow"
          onClick={() => {
            setFollowing(true);
            scrollToNow();
          }}
        >
          <Icon name="play" size={12} /> Follow playback
        </button>
      )}
      <p className="booklet__toast" role="status" aria-live="polite">
        {saved}
      </p>
    </aside>
  );
}

function Composer({ draft, setDraft, sections, duration, cut, onSaved }: { draft: NoteDraft; setDraft: (d: NoteDraft | null) => void; sections: BookletSection[]; duration: number; cut: Cut; onSaved: (text: string) => void }) {
  const { data, dispatch } = useStore();
  const fmt = (s: number) => timecode(s, duration);
  const [start, setStart] = useState(fmt(draft.start));
  const [end, setEnd] = useState(draft.end !== undefined ? fmt(draft.end) : '');
  const [more, setMore] = useState(draft.end !== undefined || !!draft.editingId);
  const text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setStart(fmt(draft.start));
    setEnd(draft.end !== undefined ? fmt(draft.end) : '');
  }, [draft.start, draft.end]);
  useEffect(() => text.current?.focus({ preventScroll: true }), [draft.editingId, draft.start]);

  const startSec = parseTimecode(start);
  const endSec = end.trim() ? parseTimecode(end) : undefined;
  const error =
    startSec === undefined || startSec > duration + 0.5
      ? `Use a time within ${fmt(duration)}, like ${fmt(Math.min(198, Math.floor(duration)))}.`
      : end.trim() !== '' && (endSec === undefined || endSec <= startSec || endSec > duration + 0.5)
        ? 'The end of the range must come after the start.'
        : '';
  const save = () => {
    if (error || !draft.text.trim()) return;
    const fields = { startSec: startSec!, endSec, section: draft.section.trim() || undefined, text: draft.text.trim() };
    if (draft.editingId) dispatch({ type: 'studio/note-update', noteId: draft.editingId, patch: fields });
    else dispatch({ type: 'studio/note-add', note: { id: uid('note'), cutId: cut.id, resolved: false, authorId: data.currentUserId, createdAt: new Date().toISOString(), ...fields } });
    onSaved(`Saved to ${cut.label} at ${fmt(startSec!)}.`);
    setDraft(null);
  };

  return (
    <form
      className="bcomposer"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      aria-label={draft.editingId ? 'Edit note' : 'New note'}
      data-testid="note-composer"
    >
      <p className="bcomposer__at">
        {draft.editingId ? 'Edit note at' : 'Note at'}{' '}
        <input className="mono" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Note time" inputMode="numeric" />
        <span className="bcomposer__on">on {cut.label}</span>
      </p>
      <textarea
        ref={text}
        rows={3}
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          if (e.key === 'Escape') setDraft(null);
        }}
        placeholder="What should change in the next draft?"
        aria-label="What should change"
      />
      {more ? (
        <div className="bcomposer__more">
          <label>
            <span>Until (optional)</span>
            <input className="mono" value={end} placeholder="e.g. 3:42" onChange={(e) => setEnd(e.target.value)} aria-label="Until (optional)" inputMode="numeric" />
          </label>
          <label>
            <span>Section</span>
            <input list="booklet-sections" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} aria-label="Section" placeholder="Matched by time" />
            <datalist id="booklet-sections">
              {sections.map((s) => (
                <option key={s.id} value={s.title} />
              ))}
            </datalist>
          </label>
        </div>
      ) : (
        <button type="button" className="inline-link bcomposer__toggle" onClick={() => setMore(true)}>
          Add a time range or section
        </button>
      )}
      {error && <p className="bcomposer__error">{error}</p>}
      <div className="bcomposer__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={!!error || !draft.text.trim()}>
          {draft.editingId ? 'Save changes' : 'Save note'}
        </button>
      </div>
    </form>
  );
}
