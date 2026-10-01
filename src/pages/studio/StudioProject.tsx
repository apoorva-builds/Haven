import { useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { NotShared } from '../../components/NotShared';
import { useToast } from '../../components/Toast';
import { EmptyState, PlatformGlyph, StatusPill } from '../../components/ui';
import { cutsOf, lengthLabel, STUDIO_STEPS, stepsDone } from '../../lib/videoStudio';
import { useStore } from '../../state/store';
import { CompareCuts } from './CompareCuts';
import { CutHistory } from './CutHistory';
import { PlanEditor } from './PlanEditor';
import { StudioCanvas } from './StudioCanvas';
import { UploadCut } from './UploadCut';

const TABS = [
  { key: 'review', label: 'Review' },
  { key: 'plan', label: 'Plan' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'compare', label: 'Compare' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function StudioProjectPage() {
  const { projectId = '', tab = 'review' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, dispatch, allowed, preview } = useStore();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
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
  const active: Tab = (TABS.some((t) => t.key === tab) ? tab : 'review') as Tab;
  const cut = cuts.find((c) => c.id === params.get('cut')) ?? cuts.find((c) => c.id === project.currentCutId) ?? cuts[cuts.length - 1];
  const asset = cut && data.assets.find((a) => a.id === cut.assetId);
  const startAt = params.get('t') !== null ? Number(params.get('t')) : undefined;
  const steps = stepsDone(data, project);
  const next = STUDIO_STEPS.find((s) => !steps[s]);
  const versions = data.versions.filter((v) => project.versionIds.includes(v.id));
  const approved = cuts.find((c) => c.id === project.approvedCutId);
  const approvedAsset = approved && data.assets.find((a) => a.id === approved.assetId);
  const mayApprove = !!cut && allowed({ type: 'studio/approve', cutId: cut.id, approved: true });
  const mayAdd = allowed({ type: 'studio/cut-add', cut: { id: 'probe', projectId: project.id, label: '', kind: 'draft', assetId: 'probe', addedAt: '', addedById: '' }, asset: { id: 'probe' } as never, makeCurrent: false });
  const unlinked = approvedAsset ? versions.filter((v) => v.mediaAssetId !== approvedAsset.id && allowed({ type: 'version/media', versionId: v.id, assetId: approvedAsset.id })) : [];

  const openCut = (cutId: string, sec?: number) => {
    const p = new URLSearchParams();
    p.set('cut', cutId);
    if (sec !== undefined) p.set('t', String(sec));
    setParams(p);
  };
  const tabHref = (k: Tab) => `/studio/${project.id}${k === 'review' ? '' : `/${k}`}`;

  return (
    <div className="page studio-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/studio">Video Studio</Link>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">{project.title}</span>
      </nav>

      <header className="shead">
        <div className="shead__text">
          <p className="eyebrow">
            {idea && (
              <Link to={`/ideas/${idea.id}`} className="inline-link">
                {idea.title}
              </Link>
            )}{' '}
            · {project.aspect === '16:9' ? 'Wide' : 'Vertical'} {project.aspect}
            {asset?.durationSec !== undefined && <> · {lengthLabel(asset.durationSec)}</>}
          </p>
          <h1 className="display shead__title">{project.title}</h1>
          <p className="shead__accounts">
            {versions.map((v) => {
              const a = data.accounts.find((x) => x.id === v.accountId);
              const p = a && data.platforms.find((x) => x.id === a.platform);
              return a && p ? (
                <Link key={v.id} to={`/gallery/${v.id}`} className="shead__account" title={`${p.name} ${a.handle} · ${v.status}`}>
                  <PlatformGlyph platform={p} size="sm" /> {a.handle}
                </Link>
              ) : null;
            })}
          </p>
        </div>
        <ol className="path" aria-label="Path for this video">
          {STUDIO_STEPS.map((s, i) => (
            <li key={s} className={`${steps[s] ? 'is-done' : ''} ${s === next ? 'is-next' : ''}`} aria-current={s === next ? 'step' : undefined}>
              <span className="path__n">{steps[s] ? <Icon name="check" size={11} /> : i + 1}</span>
              <span className="path__label">{s}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="stabs">
        <div className="tabs tabs--underline" role="tablist" aria-label="Studio sections">
          {TABS.map((t) => (
            <NavLink key={t.key} to={tabHref(t.key)} end role="tab" aria-selected={active === t.key} className={active === t.key ? 'is-active' : ''}>
              {t.label}
              {t.key === 'drafts' && <span className="count">{cuts.length}</span>}
            </NavLink>
          ))}
        </div>
        {active === 'review' && cuts.length > 0 && (
          <div className="cutbar" role="radiogroup" aria-label="Draft">
            {cuts
              .filter((c) => !c.archived || c.id === cut?.id)
              .map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === cut?.id} className={`cutbar__item ${c.id === cut?.id ? 'is-active' : ''}`} onClick={() => openCut(c.id)}>
                  {c.label}
                  {c.id === project.currentCutId && <span className="cutbar__dot" title="Current version" aria-label="(current)" />}
                </button>
              ))}
            {mayAdd && (
              <button type="button" className="cutbar__add" onClick={() => setUploading(true)} data-testid="add-cut">
                <Icon name="plus" size={14} /> Draft
              </button>
            )}
          </div>
        )}
      </div>

      {active === 'review' && cut && (
        <div className="approve" role="region" aria-label="Approval">
          {approved ? (
            <p>
              <Icon name="check" size={15} /> <strong>{approved.label}</strong> is approved.
              {unlinked.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--primary btn--xs"
                  onClick={() => {
                    unlinked.forEach((v) => dispatch({ type: 'version/media', versionId: v.id, assetId: approvedAsset!.id }));
                    toast(`${approved.label} is now the video for ${unlinked.length} creation${unlinked.length > 1 ? 's' : ''}. Post them from each platform.`, 'ok');
                  }}
                >
                  Use it for {unlinked.length} creation{unlinked.length > 1 ? 's' : ''}
                </button>
              ) : (
                <span className="muted"> Every creation uses it. Posting stays manual: open a creation, post on the platform, then add the live link.</span>
              )}
            </p>
          ) : (
            <p className="muted">Nothing approved yet.</p>
          )}
          <span className="spacer" />
          {versions.map((v) => {
            const a = data.accounts.find((x) => x.id === v.accountId);
            const pl = a && data.platforms.find((x) => x.id === a.platform);
            return (
              <Link key={v.id} to={`/gallery/${v.id}`} className="approve__creation" title={`Open the ${pl?.name ?? ''} creation`}>
                {pl && <PlatformGlyph platform={pl} size="sm" />}
                <StatusPill status={v.status} />
              </Link>
            );
          })}
          {mayApprove && cut.id !== project.approvedCutId && asset?.videoUrl && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                dispatch({ type: 'studio/approve', cutId: cut.id, approved: true });
                toast(`${cut.label} approved for this session.`, 'ok');
              }}
              data-testid="approve"
            >
              Approve {cut.label}
            </button>
          )}
        </div>
      )}

      <section className="studio-body" role="tabpanel" aria-label={TABS.find((t) => t.key === active)!.label}>
        {active === 'review' &&
          (cut ? (
            <StudioCanvas project={project} cut={cut} asset={asset} startAt={startAt} onOpenCut={openCut} />
          ) : (
            <EmptyState
              icon="upload"
              title="No footage or drafts yet"
              action={
                mayAdd ? (
                  <button type="button" className="btn btn--primary" onClick={() => setUploading(true)}>
                    <Icon name="upload" size={15} /> Upload footage or a first draft
                  </button>
                ) : undefined
              }
            >
              Uploads stay connected to this plan: original footage, every draft, the final cut, and where it was posted.
            </EmptyState>
          ))}
        {active === 'plan' && idea && <PlanEditor key={idea.id} project={project} idea={idea} />}
        {active === 'drafts' && (
          <CutHistory
            project={project}
            onUpload={() => setUploading(true)}
            onOpen={(id) => navigate(`/studio/${project.id}?cut=${id}`)}
            onCompare={(a, b) => navigate(`/studio/${project.id}/compare?a=${a}&b=${b}`)}
          />
        )}
        {active === 'compare' && <CompareCuts key={`${params.get('a')}-${params.get('b')}`} project={project} left={params.get('a') ?? undefined} right={params.get('b') ?? undefined} />}
      </section>

      {uploading && (
        <UploadCut
          project={project}
          onClose={() => setUploading(false)}
          onAdded={(c) => {
            toast(`${c.label} added. Earlier drafts are kept.`, 'ok');
            if (active === 'review') openCut(c.id);
          }}
        />
      )}
    </div>
  );
}
