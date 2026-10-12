import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChecklistItem, Idea, PlannedSection, Reference, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { AccountBadge } from '../../components/ui';
import { lengthLabel, parseTimecode, timecode } from '../../lib/videoStudio';
import { uid } from '../../state/reducer';
import { useStore } from '../../state/store';

/**
 * The plan behind a video. Only the title is needed; everything else can be
 * filled in as it becomes clear. Saved to the idea, so Ideas and the Studio
 * show the same plan.
 */
export function PlanEditor({ project, idea }: { project: VideoProject; idea: Idea }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const may = allowed({ type: 'studio/plan-update', ideaId: idea.id, patch: {} });
  const [title, setTitle] = useState(idea.title);
  const [concept, setConcept] = useState(idea.concept);
  const [audience, setAudience] = useState(idea.plan?.audience ?? '');
  const [hook, setHook] = useState(idea.plan?.hook ?? '');
  const [outline, setOutline] = useState((idea.plan?.outline ?? []).join('\n'));
  const [script, setScript] = useState(idea.script);
  const [shots, setShots] = useState<ChecklistItem[]>(idea.shotList);
  const [newShot, setNewShot] = useState('');
  const [refs, setRefs] = useState<Reference[]>(idea.references);
  const [refLabel, setRefLabel] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [sections, setSections] = useState<PlannedSection[]>(idea.plan?.sections ?? []);
  const versions = data.versions.filter((v) => project.versionIds.includes(v.id));
  const long = project.aspect === '16:9';

  const save = () => {
    dispatch({
      type: 'studio/plan-update',
      ideaId: idea.id,
      patch: {
        title: title.trim() || idea.title,
        concept,
        script,
        shotList: shots,
        references: refs,
        plan: { audience: audience.trim() || undefined, hook: hook.trim() || undefined, outline: outline.split('\n').map((l) => l.trim()).filter(Boolean), sections },
      },
    });
    toast('Plan saved for this session.', 'ok');
  };

  const plannedTotal = sections.reduce((s, x) => s + (x.targetSec ?? 0), 0);

  return (
    <form
      className="plan"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      aria-label="Video plan"
    >
      <fieldset disabled={!may} className="plan__cols">
        <div className="plan__col">
          <label className="pfield pfield--title">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="pfield">
            <span>Concept</span>
            <textarea rows={3} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="What is this video, in a sentence or two?" />
          </label>
          <div className="plan__pair">
            <label className="pfield">
              <span>Audience</span>
              <textarea rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who is it for?" />
            </label>
            <label className="pfield">
              <span>Hook</span>
              <textarea rows={2} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="The first line or image" />
            </label>
          </div>
          <label className="pfield">
            <span>Outline · one beat per line</span>
            <textarea rows={5} value={outline} onChange={(e) => setOutline(e.target.value)} />
          </label>
          <label className="pfield">
            <span>Script</span>
            <textarea rows={6} value={script} onChange={(e) => setScript(e.target.value)} className="plan__script" />
          </label>
        </div>

        <div className="plan__col plan__col--side">
          <section className="pblock">
            <h3 className="pblock__title">Made for</h3>
            {versions.length ? (
              <p className="plan__accounts">
                {versions.map((v) => {
                  const a = data.accounts.find((x) => x.id === v.accountId);
                  return a ? <AccountBadge key={v.id} account={a} showHandle /> : null;
                })}
              </p>
            ) : (
              <p className="muted small">No accounts chosen yet.</p>
            )}
            <Link className="inline-link small" to={`/ideas/${idea.id}/versions`}>
              Manage creations in the idea
            </Link>
          </section>

          <section className="pblock">
            <h3 className="pblock__title">
              Planned sections <span className="muted small">optional</span>
            </h3>
            <ol className="plan__sections">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <input value={s.title} aria-label={`Section ${i + 1} name`} onChange={(e) => setSections(sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
                  <input
                    className="mono"
                    aria-label={`Section ${i + 1} target length`}
                    placeholder="length"
                    defaultValue={s.targetSec !== undefined ? timecode(s.targetSec, long ? 3600 : 0) : ''}
                    onBlur={(e) => setSections(sections.map((x) => (x.id === s.id ? { ...x, targetSec: parseTimecode(e.target.value) } : x)))}
                  />
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove section ${s.title}`} onClick={() => setSections(sections.filter((x) => x.id !== s.id))}>
                    <Icon name="close" size={13} />
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => setSections([...sections, { id: uid('ps'), title: `Section ${sections.length + 1}` }])}>
              <Icon name="plus" size={13} /> Add a section
            </button>
            {plannedTotal > 0 && <p className="muted small">Planned length about {lengthLabel(plannedTotal)}. Section names are offered when you write notes.</p>}
          </section>

          <section className="pblock">
            <h3 className="pblock__title">Shot list</h3>
            <ul className="plan__shots">
              {shots.map((s) => (
                <li key={s.id}>
                  <label className="check-row">
                    <input type="checkbox" checked={s.done} onChange={() => setShots(shots.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                    <span>{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="plan__inline">
              <input value={newShot} onChange={(e) => setNewShot(e.target.value)} placeholder="Add a shot" aria-label="New shot" />
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => {
                  if (!newShot.trim()) return;
                  setShots([...shots, { id: uid('shot'), label: newShot.trim(), done: false }]);
                  setNewShot('');
                }}
              >
                Add
              </button>
            </div>
          </section>

          <section className="pblock">
            <h3 className="pblock__title">References</h3>
            <ul className="plan__refs">
              {refs.map((r) => (
                <li key={r.id}>
                  <a className="inline-link" href={r.url} target="_blank" rel="noreferrer">
                    {r.label}
                  </a>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove reference ${r.label}`} onClick={() => setRefs(refs.filter((x) => x.id !== r.id))}>
                    <Icon name="close" size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="plan__inline">
              <input value={refLabel} onChange={(e) => setRefLabel(e.target.value)} placeholder="Label" aria-label="Reference label" />
              <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://…" aria-label="Reference link" type="url" />
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => {
                  if (!refUrl.trim()) return;
                  setRefs([...refs, { id: uid('ref'), label: refLabel.trim() || refUrl.trim(), url: refUrl.trim() }]);
                  setRefLabel('');
                  setRefUrl('');
                }}
              >
                Add
              </button>
            </div>
            <p className="muted small">Removing a reference removes only the link.</p>
          </section>
        </div>
      </fieldset>
      <div className="plan__save">
        {may ? (
          <button type="submit" className="btn btn--primary">
            Save plan
          </button>
        ) : (
          <p className="access-note">
            <Icon name="shield" size={14} /> The plan belongs to the idea’s Space. You can read it; changing it needs Edit on the whole Space.
          </p>
        )}
        <span className="muted small">Saved for this browser session only.</span>
      </div>
    </form>
  );
}
