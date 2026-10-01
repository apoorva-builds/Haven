import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CutKind } from '../../data/types';
import { Icon } from '../../components/Icon';
import { NotShared } from '../../components/NotShared';
import { useToast } from '../../components/Toast';
import { EmptyState } from '../../components/ui';
import { cutsOf, notesOf } from '../../lib/videoStudio';
import { useStore } from '../../state/store';
import { CompareCuts } from './CompareCuts';
import { CutHistory } from './CutHistory';
import { PlanEditor } from './PlanEditor';
import { ReviewPlayer } from './ReviewPlayer';
import { UploadCut } from './UploadCut';

const TABS = [
  { key: 'review', label: 'Review' },
  { key: 'drafts', label: 'Drafts & final' },
  { key: 'plan', label: 'Plan' },
] as const;
type Tab = (typeof TABS)[number]['key'] | 'compare';

export function StudioProjectPage() {
  const { projectId = '', tab = 'review' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, allowed, preview } = useStore();
  const toast = useToast();
  const [uploading, setUploading] = useState<CutKind | null>(null);
  const [checklistRequest, setChecklistRequest] = useState(0);
  const navigate = useNavigate();
  const project = data.projects.find((p) => p.id === projectId);

  if (!project && preview?.hidden.projects.has(projectId)) return <NotShared kind="video" personId={preview.personId} />;
  if (!project) {
    return (
      <div className="page">
        <EmptyState icon="film" title="This video isn’t here" action={<Link className="btn btn--primary" to="/studio">Back to the Studio</Link>}>
          It may have been removed in this session, or the link is out of date.
        </EmptyState>
      </div>
    );
  }

  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const cuts = cutsOf(data, project.id);
  const active: Tab = tab === 'compare' ? 'compare' : ((TABS.some((t) => t.key === tab) ? tab : 'review') as Tab);
  const cut = cuts.find((c) => c.id === params.get('cut')) ?? cuts.find((c) => c.id === project.currentCutId) ?? cuts[cuts.length - 1];
  const asset = cut && data.assets.find((a) => a.id === cut.assetId);
  const startAt = params.get('t') !== null ? Number(params.get('t')) : undefined;
  const finals = cuts.filter((c) => c.kind === 'final');
  const mayAdd = allowed({ type: 'studio/cut-add', cut: { id: 'probe', projectId: project.id, label: '', kind: 'draft', assetId: 'probe', addedAt: '', addedById: '' }, asset: { id: 'probe' } as never, makeCurrent: false });

  const openCut = (cutId: string, sec?: number) => {
    const p = new URLSearchParams();
    p.set('cut', cutId);
    if (sec !== undefined) p.set('t', String(sec));
    if (active === 'review') setParams(p);
    else navigate(`/studio/${project.id}?${p}`);
  };
  const tabHref = (k: Tab) => `/studio/${project.id}${k === 'review' ? '' : `/${k}`}`;

  // The one next step worth showing.
  const latestFinal = finals[finals.length - 1];
  const nextAction = (() => {
    if (latestFinal?.checklist?.readyAt) return { kind: 'ready' as const };
    if (latestFinal) return { kind: 'checklist' as const };
    if (mayAdd && cuts.length) return { kind: 'final' as const };
    return null;
  })();

  return (
    <div className="page studio-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/studio">Video Studio</Link>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">{project.title}</span>
      </nav>

      <header className="vhead">
        <div className="vhead__text">
          <p className="eyebrow">
            {idea ? (
              <Link to={`/ideas/${idea.id}`} className="inline-link">
                {idea.title}
              </Link>
            ) : (
              'Video'
            )}
          </p>
          <h1 className="display vhead__title">{project.title}</h1>
        </div>
        <div className="vhead__next">
          {nextAction?.kind === 'final' && (
            <button type="button" className="btn btn--primary" onClick={() => setUploading('final')} data-testid="upload-final">
              <Icon name="upload" size={15} /> Upload final video
            </button>
          )}
          {nextAction?.kind === 'checklist' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                if (active !== 'review' || cut?.id !== latestFinal.id) navigate(`/studio/${project.id}?cut=${latestFinal.id}`);
                setChecklistRequest((n) => n + 1);
              }}
              data-testid="open-checklist"
            >
              Finish the publishing checklist
            </button>
          )}
          {nextAction?.kind === 'ready' && (
            <p className="vhead__ready" data-testid="ready-badge">
              <Icon name="check" size={14} /> {latestFinal.label} is ready to publish <span>· not posted yet</span>
            </p>
          )}
        </div>
      </header>

      <div className="vtabs">
        {cuts.length > 0 && (active === 'review' || active === 'compare') ? (
          <div className="drafts" role="radiogroup" aria-label="Draft">
            {cuts
              .filter((c) => !c.archived || c.id === cut?.id)
              .map((c) => {
                const notes = notesOf(data, c.id);
                const open = notes.filter((n) => !n.resolved).length;
                const sub = c.kind === 'final' ? (c.checklist?.readyAt ? 'Ready' : 'Checklist') : c.kind === 'footage' ? 'Footage' : notes.length ? (open ? `${open} open` : 'All done') : 'No notes';
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={c.id === cut?.id}
                    className={`drafts__item ${c.id === cut?.id ? 'is-active' : ''} ${c.kind === 'final' ? 'drafts__item--final' : ''}`}
                    onClick={() => openCut(c.id)}
                  >
                    <span className="drafts__label">{c.label}</span>
                    <span className="drafts__sub">{sub}</span>
                  </button>
                );
              })}
            {mayAdd && (
              <button type="button" className="drafts__add" onClick={() => setUploading('draft')} data-testid="add-cut" aria-label="Upload a new draft">
                <Icon name="plus" size={14} /> Draft
              </button>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="tabs tabs--underline vtabs__tabs" role="tablist" aria-label="Studio sections">
          {TABS.map((t) => (
            <NavLink key={t.key} to={tabHref(t.key)} end role="tab" aria-selected={active === t.key} className={active === t.key ? 'is-active' : ''}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <section className="studio-body" role="tabpanel" aria-label={active === 'compare' ? 'Compare' : TABS.find((t) => t.key === active)!.label}>
        {active === 'review' &&
          (cut ? (
            <ReviewPlayer key={project.id} project={project} cut={cut} asset={asset} startAt={startAt} checklistRequest={checklistRequest} onOpenCut={openCut} />
          ) : (
            <EmptyState
              icon="upload"
              title="No footage or drafts yet"
              action={
                mayAdd ? (
                  <button type="button" className="btn btn--primary" onClick={() => setUploading('draft')}>
                    <Icon name="upload" size={15} /> Upload a first draft
                  </button>
                ) : undefined
              }
            >
              Drafts, their review booklets and the final video stay together here. Edits happen in your editor.
            </EmptyState>
          ))}
        {active === 'plan' && idea && <PlanEditor key={idea.id} project={project} idea={idea} />}
        {active === 'drafts' && (
          <CutHistory
            project={project}
            onUpload={() => setUploading('draft')}
            onUploadFinal={() => setUploading('final')}
            onOpen={(id) => navigate(`/studio/${project.id}?cut=${id}`)}
            onCompare={(a, b) => navigate(`/studio/${project.id}/compare?a=${a}&b=${b}`)}
          />
        )}
        {active === 'compare' && <CompareCuts key={`${params.get('a')}-${params.get('b')}`} project={project} left={params.get('a') ?? undefined} right={params.get('b') ?? undefined} />}
      </section>

      {uploading && (
        <UploadCut
          project={project}
          initialKind={uploading}
          onClose={() => setUploading(null)}
          onAdded={(c) => {
            toast(c.kind === 'final' ? `${c.label} uploaded. Drafts and their booklets are kept.` : `${c.label} added. Earlier drafts are kept.`, 'ok');
            navigate(`/studio/${project.id}?cut=${c.id}`);
            if (c.kind === 'final') setChecklistRequest((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
