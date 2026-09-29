import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IDEA_STATUSES, type Idea } from '../data/types';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { QuickAddModal } from '../components/Shell';
import { AccountBadge, EmptyState, LoadingGrid, PageHeader, Segmented, SelectField, StatusPill, useSimulatedLoad } from '../components/ui';
import { daysBetween, relativeDay } from '../lib/dates';
import { accountsForIdea, platformOf } from '../state/selectors';
import { useStore } from '../state/store';

type Sort = 'due' | 'recent' | 'title';

export function IdeasPage() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
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

  const filtered = status !== 'all' || campaign !== 'all' || account !== 'all' || q !== '';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ideas"
        title="Every idea, every version"
        lede="One tile per idea. Each carries its source media and the versions planned for your accounts."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> New idea
          </button>
        }
      />

      <div className="filters" role="group" aria-label="Filter ideas">
        <label className="filter-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Filter by title or concept" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Filter ideas by text" />
        </label>
        <SelectField label="Status" value={status} onChange={(v) => set('status', v, 'all')}>
          <option value="all">All statuses</option>
          {IDEA_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <SelectField label="Campaign" value={campaign} onChange={(v) => set('campaign', v, 'all')}>
          <option value="all">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Account" value={account} onChange={(v) => set('account', v, 'all')}>
          <option value="all">All accounts</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {platformOf(data, a.platform).name} · {a.handle}
            </option>
          ))}
        </SelectField>
        <SelectField label="Sort" value={sort} onChange={(v) => set('sort', v, 'due')}>
          <option value="due">Due soonest</option>
          <option value="recent">Recently active</option>
          <option value="title">Title</option>
        </SelectField>
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
        <LoadingGrid count={6} label="Loading ideas" />
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
          {filtered ? 'Try widening the status, campaign, or account.' : 'Archived ideas keep their media, versions, and live links for reuse.'}
        </EmptyState>
      ) : (
        <ul className="idea-grid" aria-label={`${ideas.length} ideas`}>
          {ideas.map((i, idx) => {
            const accounts = accountsForIdea(data, i.id);
            const campaignName = data.campaigns.find((c) => c.id === i.campaignId)?.name;
            const dueIn = daysBetween(data.today, i.due);
            return (
              <li key={i.id} className={idx === 0 && sort === 'due' && view === 'active' && !filtered ? 'idea-grid__feature' : ''}>
                <Link to={`/ideas/${i.id}`} className="idea-tile">
                  <Cover art={i.art} ratio={idx === 0 && sort === 'due' && view === 'active' && !filtered ? '16 / 10' : '4 / 3'}>
                    <span className="idea-tile__status">
                      <StatusPill status={i.status} />
                    </span>
                  </Cover>
                  <span className="idea-tile__body">
                    <span className="idea-tile__eyebrow">{campaignName ?? i.series ?? 'No campaign'}</span>
                    <span className="idea-tile__title">{i.title}</span>
                    <span className="idea-tile__foot">
                      <span className="idea-tile__badges">
                        {accounts.length === 0 ? <span className="muted">No versions planned</span> : accounts.map((a) => <AccountBadge key={a.id} account={a} />)}
                      </span>
                      <span className={`idea-tile__due ${dueIn < 0 && i.status !== 'Posted' ? 'is-overdue' : ''}`}>
                        <Icon name="clock" size={13} /> {relativeDay(i.due, data.today)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {adding && <QuickAddModal onClose={() => setAdding(false)} />}
    </div>
  );
}
