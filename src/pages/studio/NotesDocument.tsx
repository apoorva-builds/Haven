import { useMemo, useState } from 'react';
import type { Cut, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { chaptersOf, groupBySection, notesDocument, notesOf, timecode } from '../../lib/videoStudio';
import { useStore } from '../../state/store';

/** Every note on one cut as one organised document, ready to download or print. */
export function NotesDocument({ project, cut, duration, onClose }: { project: VideoProject; cut: Cut; duration: number; onClose: () => void }) {
  const { data } = useStore();
  const [copied, setCopied] = useState(false);
  const notes = notesOf(data, cut.id);
  const chapters = chaptersOf(data, cut.id);
  const text = useMemo(() => notesDocument(data, project, cut, duration), [data, project, cut, duration]);
  const fmt = (s: number) => timecode(s, duration);
  // Plain characters only: some browsers drop a download name with dashes like "—".
  const file = `${project.title} - ${cut.label} notes.md`.replace(/[—–]/g, '-').replace(/[^\w .()-]/g, '-');

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Modal
      title={`Notes document · ${cut.label}`}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted small">Timestamps refer to {cut.label} only.</span>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => setCopied(true));
            }}
          >
            <Icon name="copy" size={15} /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="btn btn--primary" onClick={download} data-testid="download-notes">
            <Icon name="download" size={15} /> Download .md
          </button>
        </>
      }
    >
      <article className="notesdoc" data-testid="notes-document">
        <p className="eyebrow">{project.title}</p>
        <h3 className="notesdoc__title">Notes on {cut.label}</h3>
        <p className="notesdoc__meta">
          {fmt(duration)} long · {notes.length} notes · {notes.filter((n) => !n.resolved).length} open
        </p>
        {chapters.length > 0 && (
          <section>
            <h4>Chapters</h4>
            <ol className="notesdoc__chapters">
              {chapters.map((c) => (
                <li key={c.id}>
                  <span className="mono">{fmt(c.startSec)}</span> {c.title}
                </li>
              ))}
            </ol>
          </section>
        )}
        {groupBySection(notes, chapters).map((g) => (
          <section key={g.section}>
            <h4>{g.section}</h4>
            <ul className="notesdoc__notes">
              {g.notes.map((n) => (
                <li key={n.id} className={n.resolved ? 'is-resolved' : ''}>
                  <span className="mono">
                    {fmt(n.startSec)}
                    {n.endSec !== undefined && `–${fmt(n.endSec)}`}
                  </span>
                  <span>
                    {n.text} <span className="muted">— {data.people.find((p) => p.id === n.authorId)?.name ?? 'Someone'}</span>
                    {n.resolved && <span className="tag tag--muted">Resolved</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {notes.length === 0 && <p className="muted">No notes on this cut yet.</p>}
      </article>
    </Modal>
  );
}
