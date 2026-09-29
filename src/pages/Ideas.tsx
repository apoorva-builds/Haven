import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { IDEA_STATUSES, type Idea } from '../data/types';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { QuickAddModal } from '../components/Shell';
import { EmptyState, Segmented, SelectField, StatusPill, useDismiss, useSimulatedLoad } from '../components/ui';
import { daysBetween, formatDay, relativeDay } from '../lib/dates';
import { platformOf } from '../state/selectors';
import { useStore } from '../state/store';

type Sort = 'due' | 'recent' | 'title';

/** Ideas: a quiet planning list. Visual browsing lives in the Creation Gallery. */
export function IdeasPage() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);

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

  const activeFilters = [status !== 'all', campaign !== 'all', account !== 'all', sort !== 'due'].filter(Boolean).length;
  const filtered = activeFilters > 0 || q !== '';

  return (
    <div className="page ideas-page">
      <header className="page-title">
        <span className="with-info">
          <h1 className="page-title__h">Ideas</h1>
          <InfoButton k="ideas" />
        </span>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> New idea
        </button>
      </header>

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
        <span className="spacer" />
        <Segmented
          label="Active or archived"
          value={view}
          onChange={(v) => set('view', v, 'active')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
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
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
                Capture an idea
              </button>
            )
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
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => {
              const versions = data.versions.filter((v) => v.ideaId === i.id);
              const platforms = [...new Set(versions.map((v) => data.accounts.find((a) => a.id === v.accountId)?.platform))].filter(Boolean);
              const context = data.campaigns.find((c) => c.id === i.campaignId)?.name ?? i.series;
              const overdue = daysBetween(data.today, i.due) < 0 && i.status !== 'Posted';
              return (
                <tr key={i.id} className="idea-row" onClick={() => navigate(`/ideas/${i.id}`)}>
                  <th scope="row" className="idea-row__title">
                    <Link to={`/ideas/${i.id}`} onClick={(e) => e.stopPropagation()}>
                      {i.title}
                    </Link>
                    {context && <span className="idea-row__context">{context}</span>}
                  </th>
                  <td>
                    <StatusPill status={i.status} />
                  </td>
                  <td className={overdue ? 'is-overdue' : ''}>
                    <span className="idea-row__due">{relativeDay(i.due, data.today)}</span>
                    {relativeDay(i.due, data.today) !== formatDay(i.due) && <span className="idea-row__date">{formatDay(i.due)}</span>}
                  </td>
                  <td>
                    <span className="idea-row__versions">
                      {versions.length === 0 ? (
                        <span className="muted">None yet</span>
                      ) : (
                        <>
                          {versions.length} version{versions.length === 1 ? '' : 's'}
                          <span className="idea-row__platforms" aria-hidden="true">
                            {platforms.map((p) => (
                              <span key={p} className="pmark" style={{ ['--hue' as string]: platformOf(data, p!).hue }} title={platformOf(data, p!).name} />
                            ))}
                          </span>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {adding && <QuickAddModal onClose={() => setAdding(false)} />}
    </div>
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
      <button type="button" className={`btn btn--ghost btn--sm ${count ? 'is-active' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
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
