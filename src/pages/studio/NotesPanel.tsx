import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, Cut, TimeNote } from '../../data/types';
import { Icon } from '../../components/Icon';
import { Avatar } from '../../components/ui';
import { groupBySection, parseTimecode, timecode } from '../../lib/videoStudio';
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

type Filter = 'all' | 'open' | 'resolved';

export function NotesPanel({
  cut,
  notes,
  chapters,
  duration,
  t,
  playing,
  focus,
  sections,
  draft,
  setDraft,
  earlier,
  mayNote,
  onSeek,
  onOpenCut,
  onExport,
}: {
  cut: Cut;
  notes: TimeNote[];
  chapters: Chapter[];
  duration: number;
  t: number;
  playing: boolean;
  focus: { note?: TimeNote; current: boolean; progress: number };
  sections: string[];
  draft: NoteDraft | null;
  setDraft: (d: NoteDraft | null) => void;
  earlier: { note: TimeNote; from: Cut }[];
  mayNote: boolean;
  onSeek: (sec: number) => void;
  onOpenCut: (cutId: string, sec: number) => void;
  onExport: () => void;
}) {
  const { data, dispatch } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const fmt = (s: number) => timecode(s, duration);
  const shown = notes.filter((n) => (filter === 'all' ? true : filter === 'open' ? !n.resolved : n.resolved));
  const groups = useMemo(() => groupBySection(shown, chapters), [shown, chapters]);
  const open = notes.filter((n) => !n.resolved).length;

  // Follow the playing note inside the panel (never scrolls the page).
  const focusId = focus.note?.id;
  useEffect(() => {
    const box = list.current;
    const el = focusId ? box?.querySelector<HTMLElement>(`[data-note="${focusId}"]`) : null;
    if (!box || !el || !playing) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
  }, [focusId, playing]);

  const person = (id: string) => data.people.find((p) => p.id === id);

  return (
    <aside className="npanel" aria-labelledby="notes-h" data-testid="notes-panel">
      <header className="npanel__head">
        <div>
          <h2 id="notes-h" className="npanel__title">
            Notes <span className="npanel__on">on {cut.label}</span>
          </h2>
          <p className="npanel__count">
            {open} open · {notes.length - open} resolved
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExport} data-testid="export-notes">
          <Icon name="file" size={14} /> Notes document
        </button>
      </header>

      <div className="npanel__filters" role="radiogroup" aria-label="Show notes">
        {(['all', 'open', 'resolved'] as Filter[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Resolved'}
          </button>
        ))}
      </div>

      {draft && <Composer draft={draft} setDraft={setDraft} sections={sections} duration={duration} cut={cut} />}

      <div className="npanel__list" ref={list}>
        {notes.length === 0 && !draft && (
          <p className="npanel__empty">
            No notes on {cut.label} yet. {mayNote ? 'Press M to mark a moment, or drag across the timeline to mark a range.' : 'You can watch and read notes here.'}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.section} className="ngroup">
            <h3 className="ngroup__title">{g.section}</h3>
            {g.notes.map((n) => {
              const isFocus = focus.note?.id === n.id;
              const author = person(n.authorId);
              return (
                <article
                  key={n.id}
                  data-note={n.id}
                  className={`tnote ${n.resolved ? 'is-resolved' : ''} ${isFocus && focus.current ? 'is-now' : ''} ${isFocus && !focus.current ? 'is-next' : ''}`}
                  aria-current={isFocus && focus.current ? 'true' : undefined}
                >
                  <button type="button" className="tnote__time" onClick={() => onSeek(n.startSec)} aria-label={`Jump to ${fmt(n.startSec)}`}>
                    {fmt(n.startSec)}
                    {n.endSec !== undefined && <span>–{fmt(n.endSec)}</span>}
                  </button>
                  {isFocus && <span className="tnote__flag">{focus.current ? 'Now' : 'Up next'}</span>}
                  <p className="tnote__text" onClick={() => onSeek(n.startSec)}>
                    {n.text}
                  </p>
                  {isFocus && focus.current && n.endSec !== undefined && (
                    <span className="tnote__progress" role="progressbar" aria-label="Through this range" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focus.progress * 100)}>
                      <span style={{ width: `${focus.progress * 100}%` }} />
                    </span>
                  )}
                  <footer className="tnote__foot">
                    {author && <Avatar person={author} size={18} />}
                    <span className="tnote__who">{author?.name ?? 'Someone'}</span>
                    {n.carriedFrom && <span className="tnote__carried">Carried forward</span>}
                    <span className="spacer" />
                    {mayNote && confirmDelete !== n.id && (
                      <>
                        <label className="tnote__resolve">
                          <input type="checkbox" checked={n.resolved} onChange={() => dispatch({ type: 'studio/note-update', noteId: n.id, patch: { resolved: !n.resolved } })} />
                          Resolved
                        </label>
                        <button type="button" className="icon-btn icon-btn--sm" aria-label="Edit note" onClick={() => setDraft({ start: n.startSec, end: n.endSec, section: n.section ?? '', text: n.text, editingId: n.id })}>
                          <Icon name="comment" size={14} />
                        </button>
                        <button type="button" className="icon-btn icon-btn--sm" aria-label="Delete note" onClick={() => setConfirmDelete(n.id)}>
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    )}
                    {!mayNote && n.resolved && <span className="tnote__resolved-tag">Resolved</span>}
                  </footer>
                  {confirmDelete === n.id && (
                    <div className="tnote__confirm" role="alert">
                      <span>Delete this note? The video isn’t affected.</span>
                      <button type="button" className="btn btn--ghost btn--xs" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--xs"
                        onClick={() => {
                          dispatch({ type: 'studio/note-delete', noteId: n.id });
                          setConfirmDelete(null);
                        }}
                      >
                        Delete note
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}

        {earlier.length > 0 && (
          <section className="earlier" aria-labelledby="earlier-h" data-testid="earlier-feedback">
            <h3 id="earlier-h" className="earlier__title">
              Earlier feedback
            </h3>
            <p className="earlier__lede">
              Open notes from earlier cuts. Their times refer to that cut, not this one. Carry a note forward at the right moment here, or resolve it where it was left.
            </p>
            {earlier.map(({ note: n, from }) => (
              <article key={n.id} className="tnote tnote--earlier" data-earlier={n.id}>
                <p className="tnote__origin">
                  {timecode(n.startSec, Math.max(duration, n.endSec ?? 0))}
                  {n.endSec !== undefined && `–${timecode(n.endSec, Math.max(duration, n.endSec))}`} in {from.label}
                </p>
                <p className="tnote__text">{n.text}</p>
                <div className="tnote__actions">
                  {mayNote && (
                    <button
                      type="button"
                      className="btn btn--primary btn--xs"
                      onClick={() => {
                        const len = n.endSec !== undefined ? n.endSec - n.startSec : undefined;
                        dispatch({ type: 'studio/note-carry', noteId: n.id, toCutId: cut.id, startSec: t, endSec: len !== undefined ? Math.min(duration, t + len) : undefined, newId: uid('note') });
                      }}
                    >
                      Carry to {fmt(t)}
                    </button>
                  )}
                  {mayNote && (
                    <button type="button" className="btn btn--ghost btn--xs" onClick={() => dispatch({ type: 'studio/note-update', noteId: n.id, patch: { resolved: true } })}>
                      Resolve on {from.label}
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost btn--xs" onClick={() => onOpenCut(from.id, n.startSec)}>
                    See it in {from.label}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}

function Composer({ draft, setDraft, sections, duration, cut }: { draft: NoteDraft; setDraft: (d: NoteDraft | null) => void; sections: string[]; duration: number; cut: Cut }) {
  const { data, dispatch } = useStore();
  const fmt = (s: number) => timecode(s, duration);
  const [start, setStart] = useState(fmt(draft.start));
  const [end, setEnd] = useState(draft.end !== undefined ? fmt(draft.end) : '');
  const text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setStart(fmt(draft.start));
    setEnd(draft.end !== undefined ? fmt(draft.end) : '');
  }, [draft.start, draft.end]);
  useEffect(() => text.current?.focus(), [draft.editingId]);

  const startSec = parseTimecode(start);
  const endSec = end.trim() ? parseTimecode(end) : undefined;
  const bad = startSec === undefined || startSec > duration + 0.5 || (end.trim() !== '' && (endSec === undefined || endSec <= startSec! || endSec > duration + 0.5));
  const save = () => {
    if (bad || !draft.text.trim()) return;
    const fields = { startSec: startSec!, endSec, section: draft.section.trim() || undefined, text: draft.text.trim() };
    if (draft.editingId) dispatch({ type: 'studio/note-update', noteId: draft.editingId, patch: fields });
    else dispatch({ type: 'studio/note-add', note: { id: uid('note'), cutId: cut.id, resolved: false, authorId: data.currentUserId, createdAt: new Date().toISOString(), ...fields } });
    setDraft(null);
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      aria-label={draft.editingId ? 'Edit note' : 'New note'}
      data-testid="note-composer"
    >
      <div className="composer__times">
        <label>
          <span>From</span>
          <input className="mono" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" inputMode="numeric" />
        </label>
        <label>
          <span>To</span>
          <input className="mono" value={end} placeholder="moment" onChange={(e) => setEnd(e.target.value)} aria-label="End time (optional)" inputMode="numeric" />
        </label>
        <label className="composer__section">
          <span>Section</span>
          <input list="note-sections" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} aria-label="Section name" placeholder="e.g. Opening" />
          <datalist id="note-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>
      <textarea
        ref={text}
        rows={3}
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
          if (e.key === 'Escape') setDraft(null);
        }}
        placeholder="What should change here?"
        aria-label="Note"
      />
      {bad && <p className="composer__error">Times must be within {fmt(duration)}, and the end after the start.</p>}
      <div className="composer__actions">
        <span className="muted small">Saved with {cut.label} · this session</span>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={bad || !draft.text.trim()}>
          {draft.editingId ? 'Save note' : 'Add note'}
        </button>
      </div>
    </form>
  );
}
