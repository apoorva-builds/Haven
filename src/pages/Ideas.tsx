import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { IDEA_STATUSES, type DemoData, type Idea } from '../data/types';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { QuickAddModal, useCanCreateIdea } from '../components/Shell';
import { EmptyState, SelectField, useDismiss, useSimulatedLoad } from '../components/ui';
import { daysBetween, formatDay, relativeDay } from '../lib/dates';
import { formatName } from '../lib/creations';
import { STAGES, ideaImage, toneOf, upNextIdea } from '../lib/studio';
import { platformOf } from '../state/selectors';
import { useStore } from '../state/store';

type Sort = 'due' | 'recent' | 'title';

/** Ideas: one Up next feature, then every idea as a composed planning row. */
export function IdeasPage() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const canCreate = useCanCreateIdea();

  const status = params.get('status') ?? 'all';
  const campaign = params.get('campaign') ?? 'all';
  const account = params.get('account') ?? 'all';
  const view = (params.get('view') ?? 'active') as 'active' | 'archived';
  const sort = (params.get('sort') ?? 'due') as Sort;
  const q = params.get('q') ?? '';

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const ideas = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = data.ideas.filter((i) => {
      if (view === 'archived' ? !i.archived : i.archived) return false;
      if (status !== 'all' && i.status !== status) return false;
      if (campaign !== 'all' && i.campaignId !== campaign) return false;
      if (account !== 'all' && !data.versions.some((v) => v.ideaId === i.id && v.accountId === account)) return false;
      if (term && !`${i.title} ${i.concept} ${i.series ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Idea, b: Idea) => number> = {
      due: (a, b) => Number(a.status === 'Posted') - Number(b.status === 'Posted') || a.due.localeCompare(b.due),
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(cmp[sort]);
  }, [data, status, campaign, account, view, sort, q]);

  const activeCount = data.ideas.filter((i) => !i.archived).length;
  const archivedCount = data.ideas.length - activeCount;
  const activeFilters = [status !== 'all', campaign !== 'all', account !== 'all', sort !== 'due'].filter(Boolean).length;
  const filtered = activeFilters > 0 || q !== '';
  const next = view === 'active' ? upNextIdea(data) : undefined;

  return (
    <div className="page ideas-page">
      <header className="studio-head">
        <div className="studio-head__title">
          <span className="with-info">
            <h1 className="studio-head__h">Ideas</h1>
            <InfoButton k="ideas" />
          </span>
          <p className="studio-head__count">
            {activeCount} active{archivedCount > 0 && <> · {archivedCount} archived</>}
          </p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> New idea
          </button>
        )}
      </header>

      {!ready ? (
        <div className="upnext upnext--loading" aria-hidden="true" />
      ) : (
        next && <UpNext data={data} idea={next} />
      )}

      <section className="idea-section" aria-labelledby="all-ideas">
        <div className="idea-section__head">
          <h2 id="all-ideas" className="idea-section__h">
            {view === 'archived' ? 'Archived ideas' : 'All ideas'}
          </h2>
          <div className="list-toolbar" role="group" aria-label="Find ideas">
            <label className="filter-search">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Search ideas" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Filter ideas by text" />
            </label>
            <FiltersControl count={activeFilters} onReset={() => setParams(q ? { q } : {}, { replace: true })}>
              <SelectField label="Status" value={status} onChange={(v) => set('status', v, 'all')} compact={false}>
                <option value="all">All statuses</option>
                {IDEA_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
              <SelectField label="Campaign" value={campaign} onChange={(v) => set('campaign', v, 'all')} compact={false}>
                <option value="all">All campaigns</option>
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Account" value={account} onChange={(v) => set('account', v, 'all')} compact={false}>
                <option value="all">All accounts</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {platformOf(data, a.platform).name} · {a.handle}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Sort" value={sort} onChange={(v) => set('sort', v, 'due')} compact={false}>
                <option value="due">Due soonest</option>
                <option value="recent">Recently active</option>
                <option value="title">Title</option>
              </SelectField>
            </FiltersControl>
            <button type="button" className="archive-toggle" aria-pressed={view === 'archived'} onClick={() => set('view', view === 'archived' ? 'active' : 'archived', 'active')}>
              <Icon name="archive" size={15} />
              {view === 'archived' ? 'Back to active' : `Archived · ${archivedCount}`}
            </button>
          </div>
        </div>

        {!ready ? (
          <div className="idea-list idea-list--loading" role="status" aria-label="Loading ideas">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="idea-list__skeleton" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={view === 'archived' ? 'archive' : 'ideas'}
            title={filtered ? 'No ideas match these filters' : view === 'archived' ? 'Nothing archived' : 'No ideas yet'}
            action={
              filtered ? (
                <button type="button" className="btn btn--ghost" onClick={() => setParams(view === 'archived' ? { view } : {}, { replace: true })}>
                  Clear filters
                </button>
              ) : canCreate ? (
                <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
                  Capture an idea
                </button>
              ) : undefined
            }
          >
            {filtered ? 'Try a broader search or fewer filters.' : 'Archived ideas keep their media, versions and live links for reuse.'}
          </EmptyState>
        ) : (
          <table className="idea-list">
            <caption className="sr-only">
              {ideas.length} {view === 'archived' ? 'archived' : 'active'} ideas
            </caption>
            <thead>
              <tr>
                <th scope="col">Idea</th>
                <th scope="col">Stage</th>
                <th scope="col">Due</th>
                <th scope="col">Versions</th>
                <td aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {ideas.map((i) => {
                const versions = data.versions.filter((v) => v.ideaId === i.id);
                const context = data.campaigns.find((c) => c.id === i.campaignId)?.name ?? i.series;
                const overdue = daysBetween(data.today, i.due) < 0 && i.status !== 'Posted';
                const rel = relativeDay(i.due, data.today);
                const platforms = [...new Set(versions.map((v) => data.accounts.find((a) => a.id === v.accountId)?.platform))].filter(Boolean) as string[];
                return (
                  <tr key={i.id} className="idea-row" onClick={() => navigate(`/ideas/${i.id}`)}>
                    <th scope="row" className="idea-row__title">
                      <span className="idea-row__main">
                        <IdeaThumb data={data} idea={i} />
                        <span className="idea-row__text">
                          <Link to={`/ideas/${i.id}`} onClick={(e) => e.stopPropagation()}>
                            {i.title}
                          </Link>
                          <span className="idea-row__context">{[context, `Updated ${relativeDay(i.updatedAt, data.today).toLowerCase()}`].filter(Boolean).join(' · ')}</span>
                        </span>
                      </span>
                    </th>
                    <td>
                      <StageMeter status={i.status} />
                    </td>
                    <td className={overdue ? 'is-overdue' : ''}>
                      <span className="idea-row__due">{rel}</span>
                      {rel !== formatDay(i.due) && <span className="idea-row__sub">{formatDay(i.due, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
                    </td>
                    <td>
                      {versions.length === 0 ? (
                        <span className="idea-row__sub">None yet</span>
                      ) : (
                        <>
                          <span className="idea-row__due">
                            {versions.length} version{versions.length === 1 ? '' : 's'}
                          </span>
                          <span className="idea-row__sub">{platforms.map((p) => platformOf(data, p).name).join(', ')}</span>
                        </>
                      )}
                    </td>
                    <td className="idea-row__go" aria-hidden="true">
                      <Icon name="arrowRight" size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {adding && <QuickAddModal onClose={() => setAdding(false)} />}
    </div>
  );
}

/** The page's single focal point: the idea that most needs attention. */
function UpNext({ data, idea }: { data: DemoData; idea: Idea }) {
  const versions = data.versions.filter((v) => v.ideaId === idea.id);
  const image = ideaImage(data, idea);
  const collection = data.campaigns.find((c) => c.id === idea.campaignId)?.name ?? idea.series;
  const rel = relativeDay(idea.due, data.today);
  return (
    <section className={`upnext tone--${toneOf(idea)}`} aria-labelledby="up-next-title">
      <div className="upnext__media">
        {image && <img className="upnext__glow" src={image} alt="" aria-hidden="true" />}
        {image ? <img className="upnext__img" src={image} alt="" /> : <span className="upnext__type">{idea.title}</span>}
      </div>
      <div className="upnext__body">
        <p className="upnext__eyebrow">
          Up next{collection && <span> · {collection}</span>}
        </p>
        <h2 id="up-next-title" className="upnext__title">
          {idea.title}
        </h2>
        <dl className="upnext__facts">
          <div>
            <dt>Due</dt>
            <dd>
              {rel}
              {rel !== formatDay(idea.due) && <span> · {formatDay(idea.due, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
            </dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>
              <StageMeter status={idea.status} />
            </dd>
          </div>
          <div className="upnext__versions">
            <dt>{versions.length} account versions</dt>
            <dd>
              <ul>
                {versions.map((v) => {
                  const acct = data.accounts.find((a) => a.id === v.accountId)!;
                  return (
                    <li key={v.id}>
                      <span>{platformOf(data, acct.platform).name} {formatName(v, acct)}</span>
                      <span className="upnext__handle">{acct.handle}</span>
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
        </dl>
        <Link className="upnext__cta" to={`/ideas/${idea.id}/versions`}>
          Continue <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </section>
  );
}

/** Stage as words plus a six-step hairline meter. */
function StageMeter({ status }: { status: Idea['status'] }) {
  const step = STAGES.indexOf(status);
  return (
    <span className="stage-meter">
      <span className="stage-meter__label">{status}</span>
      <span className="stage-meter__track" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s} className={i <= step ? 'is-on' : ''} />
        ))}
      </span>
    </span>
  );
}

function IdeaThumb({ data, idea }: { data: DemoData; idea: Idea }) {
  const image = ideaImage(data, idea);
  return (
    <span className={`idea-thumb tone--${toneOf(idea)}`} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" /> : <span className="idea-thumb__type">{idea.title.charAt(0)}</span>}
    </span>
  );
}

/** One "Filters" button that reveals the less-used controls. */
function FiltersControl({ count, onReset, children }: { count: number; onReset: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  return (
    <div className="filters-control" ref={ref}>
      <button type="button" className={`quiet-btn ${count ? 'is-active' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="list" size={15} /> Filters
        {count > 0 && <span className="filters-control__count">{count}</span>}
      </button>
      {open && (
        <div id={id} className="popover filters-control__panel" role="group" aria-label="Filters">
          {children}
          <div className="filters-control__foot">
            <button type="button" className="link-btn" onClick={onReset} disabled={!count}>
              Reset
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={close}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
