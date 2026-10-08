import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Aspect } from '../../data/types';
import { Cover } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { AddStorageModal, StorageMeter } from '../../components/Storage';
import { useToast } from '../../components/Toast';
import { DemoTag, EmptyState, PageHeader, PlatformGlyph } from '../../components/ui';
import { formatSize } from '../../lib/dates';
import { cutsOf, lengthLabel, notesOf, projectStorageMB, STUDIO_STEPS, stepsDone } from '../../lib/videoStudio';
import { uid } from '../../state/reducer';
import { useStore } from '../../state/store';

/** Video Studio: every video being made, from plan to posted. */
export function StudioPage() {
  const { data, allowed } = useStore();
  const [planning, setPlanning] = useState<{ ideaId?: string } | null>(null);
  const [addStorage, setAddStorage] = useState(false);
  const mayPlan = data.accounts.some((a) => allowed({ type: 'studio/plan', projectId: 'p', ideaId: 'i', existingIdea: false, title: 'x', spaceId: a.brandId, accountIds: [a.id], aspect: '9:16' }));

  return (
    <div className="page studio-index">
      <PageHeader
        eyebrow="Video Studio"
        title="Watch it, note it, get it right"
        lede="Watch each draft, pause on any second, and note what should change in the next one. Edits happen in your editor; Haven keeps the drafts and notes together."
        actions={
          mayPlan ? (
            <button type="button" className="btn btn--primary" onClick={() => setPlanning({})} data-testid="plan-video">
              <Icon name="plus" size={16} /> Plan a video
            </button>
          ) : undefined
        }
      />

      {data.projects.length === 0 ? (
        <EmptyState icon="film" title="No videos shared with you yet">
          Videos appear here when they’re made for an account or Space you can open.
        </EmptyState>
      ) : (
        <ol className="vlist" aria-label="Videos">
          {data.projects.map((p) => {
            const idea = data.ideas.find((i) => i.id === p.ideaId);
            const cuts = cutsOf(data, p.id);
            const current = cuts.find((c) => c.id === p.currentCutId) ?? cuts[cuts.length - 1];
            const asset = current && data.assets.find((a) => a.id === current.assetId);
            const open = current ? notesOf(data, current.id).filter((n) => !n.resolved).length : 0;
            const steps = stepsDone(data, p);
            const next = STUDIO_STEPS.find((s) => !steps[s]);
            const versions = data.versions.filter((v) => p.versionIds.includes(v.id));
            return (
              <li key={p.id} className={`vidrow vidrow--${p.aspect === '16:9' ? 'wide' : 'tall'}`}>
                <Link to={`/studio/${p.id}`} className="vidrow__still" aria-hidden="true" tabIndex={-1}>
                  <Cover art={asset?.art ?? idea?.art ?? { motif: 'grain', hue: 30, hue2: 200 }} ratio={p.aspect.replace(':', ' / ')} />
                </Link>
                <div className="vidrow__text">
                  <p className="eyebrow">{idea?.title}</p>
                  <h2 className="vidrow__title">
                    <Link to={`/studio/${p.id}`}>{p.title}</Link>
                  </h2>
                  <p className="vidrow__meta">
                    {current ? (
                      <>
                        {current.label} · {asset?.durationSec !== undefined ? lengthLabel(asset.durationSec) : 'length unknown'} · {cuts.length} cut{cuts.length === 1 ? '' : 's'} ·{' '}
                        {formatSize(projectStorageMB(data, p.id))}
                      </>
                    ) : (
                      'Planned · no footage yet'
                    )}
                  </p>
                  <p className="vidrow__accounts">
                    {versions.map((v) => {
                      const a = data.accounts.find((x) => x.id === v.accountId);
                      const pl = a && data.platforms.find((x) => x.id === a.platform);
                      return pl ? <PlatformGlyph key={v.id} platform={pl} size="sm" /> : null;
                    })}
                  </p>
                </div>
                <div className="vidrow__state">
                  <ol className="dots" aria-label={`Path: ${STUDIO_STEPS.filter((s) => steps[s]).length} of ${STUDIO_STEPS.length} steps done`}>
                    {STUDIO_STEPS.map((s) => (
                      <li key={s} className={steps[s] ? 'is-done' : s === next ? 'is-next' : ''} title={s} />
                    ))}
                  </ol>
                  <p className="vidrow__next">{next ? <>Next: {next}</> : 'Posted'}</p>
                  {open > 0 && <p className="vidrow__open">{open} open note{open === 1 ? '' : 's'}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="studio-foot" aria-labelledby="sf-h">
        <div>
          <h2 id="sf-h" className="h3">
            Storage <DemoTag title="Bundled samples use sample sizes; files you add use their real size.">Sample sizes</DemoTag>
          </h2>
          <p className="muted small">Keep as many drafts as storage allows. A file used in several places counts once; archived drafts still count.</p>
        </div>
        <StorageMeter onAdd={allowed({ type: 'workspace/storage-add', gb: 1 }) ? () => setAddStorage(true) : undefined} />
      </section>

      {planning && <PlanVideoModal ideaId={planning.ideaId} onClose={() => setPlanning(null)} />}
      {addStorage && <AddStorageModal onClose={() => setAddStorage(false)} />}
    </div>
  );
}

/**
 * Start a video. A title is enough; the rest of the plan can come later.
 * It can start from an existing idea, so Ideas and the Studio stay one thing.
 */
export function PlanVideoModal({ ideaId, onClose }: { ideaId?: string; onClose: () => void }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const ideas = data.ideas.filter((i) => !i.archived);
  const [from, setFrom] = useState<string>(ideaId ?? 'new');
  const idea = ideas.find((i) => i.id === from);
  const [title, setTitle] = useState('');
  const [spaceId, setSpaceId] = useState(idea?.spaceId ?? data.brands[0]?.id ?? '');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [concept, setConcept] = useState('');
  const [hook, setHook] = useState('');
  const [audience, setAudience] = useState('');
  const space = idea?.spaceId ?? spaceId;
  const accounts = data.accounts.filter((a) => a.brandId === space);
  const effectiveTitle = title.trim() || (idea ? `${idea.title} — ${aspect === '16:9' ? 'long cut' : 'vertical'}` : '');

  const action = {
    type: 'studio/plan' as const,
    projectId: uid('proj'),
    ideaId: idea?.id ?? uid('idea'),
    existingIdea: !!idea,
    title: effectiveTitle,
    spaceId: space,
    accountIds,
    aspect,
    concept: concept.trim() || undefined,
    plan: hook || audience ? { hook: hook.trim() || undefined, audience: audience.trim() || undefined, outline: [], sections: [] } : undefined,
  };
  const may = !!effectiveTitle && allowed(action);

  return (
    <Modal
      title="Plan a video"
      onClose={onClose}
      footer={
        <>
          <DemoTag>Session only</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!may}
            onClick={() => {
              dispatch(action);
              toast('Plan started. Upload footage or a first draft whenever it’s ready.', 'ok');
              onClose();
              navigate(`/studio/${action.projectId}/plan`);
            }}
            data-testid="create-plan"
          >
            Start planning
          </button>
        </>
      }
    >
      <label className="field">
        <span>Start from</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Start from">
          <option value="new">A new idea</option>
          {ideas.map((i) => (
            <option key={i.id} value={i.id}>
              Idea: {i.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={idea ? effectiveTitle : 'e.g. A slow Sunday reset'} aria-label="Video title" autoFocus />
      </label>
      {!idea && data.brands.length > 1 && (
        <label className="field">
          <span>Space</span>
          <select
            value={spaceId}
            onChange={(e) => {
              setSpaceId(e.target.value);
              setAccountIds([]);
            }}
          >
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="field">
        <legend>Shape</legend>
        <div className="seg-row">
          {(['9:16', '16:9'] as Aspect[]).map((a) => (
            <label key={a} className={`chip ${aspect === a ? 'is-on' : ''}`}>
              <input type="radio" name="aspect" checked={aspect === a} onChange={() => setAspect(a)} className="sr-only" />
              {a === '9:16' ? 'Short · vertical 9:16' : 'Long · wide 16:9'}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Made for (optional)</legend>
        <div className="seg-row">
          {accounts.map((a) => {
            const p = data.platforms.find((x) => x.id === a.platform)!;
            const on = accountIds.includes(a.id);
            return (
              <label key={a.id} className={`chip ${on ? 'is-on' : ''}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setAccountIds(on ? accountIds.filter((x) => x !== a.id) : [...accountIds, a.id])} />
                <PlatformGlyph platform={p} size="sm" /> {p.name} {a.handle}
              </label>
            );
          })}
        </div>
      </fieldset>
      {!more ? (
        <button type="button" className="inline-link" onClick={() => setMore(true)}>
          Add concept, audience and hook now (optional)
        </button>
      ) : (
        <>
          <label className="field">
            <span>Concept</span>
            <textarea rows={2} value={concept} onChange={(e) => setConcept(e.target.value)} />
          </label>
          <label className="field">
            <span>Audience</span>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} />
          </label>
          <label className="field">
            <span>Hook</span>
            <input value={hook} onChange={(e) => setHook(e.target.value)} />
          </label>
        </>
      )}
      {effectiveTitle && !may && (
        <p className="access-note">
          <Icon name="shield" size={14} /> You need Edit on the accounts you choose, or on the whole Space.
        </p>
      )}
      <p className="muted small">Outline, script, shot list, references and sections can be added in the plan at any time.</p>
    </Modal>
  );
}
