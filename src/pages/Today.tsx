import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoData, Task } from '../data/types';
import { useAccountName } from '../components/AccountSelector';
import { Cover } from '../components/Cover';
import { InfoButton } from '../components/InfoButton';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AccountBadge, Avatar, EmptyState, LoadingGrid, PlatformGlyph, SelectField, StatusPill, TextLink, useSimulatedLoad } from '../components/ui';
import { addDays, formatDay, formatLongDate, relativeDay } from '../lib/dates';
import { accountOf, ideaOf, personOf, platformOf, taskMatchesFocus, versionMatchesFocus, type Focus } from '../state/selectors';
import { useStore } from '../state/store';

type TaskTab = 'mine' | 'others' | 'upcoming';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function parseFocus(v: string): Focus {
  if (v.startsWith('account:')) return { kind: 'account', id: v.slice(8) };
  if (v.startsWith('campaign:')) return { kind: 'campaign', id: v.slice(9) };
  return { kind: 'all' };
}

export function bucketTasks(data: DemoData, focus: Focus) {
  const open = data.tasks.filter((t) => taskMatchesFocus(data, t, focus));
  const soon = (t: Task) => t.due <= addDays(data.today, 1);
  const byDue = (a: Task, b: Task) => a.due.localeCompare(b.due) || Number(a.done) - Number(b.done);
  return {
    mine: open.filter((t) => t.ownerId === data.currentUserId && soon(t)).sort(byDue),
    others: open.filter((t) => t.ownerId !== data.currentUserId && soon(t)).sort(byDue),
    upcoming: open.filter((t) => !soon(t)).sort(byDue),
  };
}

export function TodayPage() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const ready = useSimulatedLoad();
  const [focusValue, setFocusValue] = useState('all');
  const [tab, setTab] = useState<TaskTab>('mine');
  const focus = parseFocus(focusValue);
  const me = personOf(data, data.currentUserId)!;
  const accountName = useAccountName();

  const buckets = useMemo(() => bucketTasks(data, focus), [data, focus]);
  const nextTask = buckets.mine.find((t) => !t.done) ?? buckets.upcoming.find((t) => !t.done && t.ownerId === data.currentUserId);
  const nextIdea = ideaOf(data, nextTask?.ideaId);

  const week = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const recent = [...data.ideas].filter((i) => !i.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const todaysAccounts = data.accounts.filter((a) => a.usedToday);
  const shown = buckets[tab];

  if (!ready) {
    return (
      <div className="page">
        <div className="today-hero today-hero--loading" aria-hidden="true" />
        <LoadingGrid count={3} label="Loading today" />
      </div>
    );
  }

  return (
    <div className="page today">
      <section className="today-hero">
        <div className="today-hero__text">
          <p className="eyebrow">{formatLongDate(data.today)}</p>
          <h1 className="display display--xl">
            {greeting()}, {me.name.split(' ')[0]}.
          </h1>
          {nextTask ? (
            <p className="lede">
              One thing first: <strong>{nextTask.title.charAt(0).toLowerCase() + nextTask.title.slice(1)}</strong>
              {nextIdea && <> for “{nextIdea.title}”</>}.
            </p>
          ) : (
            <p className="lede">Nothing needs you right now. A good morning to capture something new.</p>
          )}
          <div className="today-hero__actions">
            {nextTask && nextIdea && (
              <Link className="btn btn--primary btn--lg" to={`/ideas/${nextIdea.id}/${nextTask.versionId ? 'versions' : 'tasks'}`}>
                Continue “{nextIdea.title}”
                <Icon name="arrowRight" size={16} />
              </Link>
            )}
            <SelectField label="Focus" value={focusValue} onChange={setFocusValue}>
              <option value="all">Everything</option>
              <optgroup label="Account">
                {data.accounts.map((a) => (
                  <option key={a.id} value={`account:${a.id}`}>
                    {platformOf(data, a.platform).name} · {a.handle}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Campaign">
                {data.campaigns.map((c) => (
                  <option key={c.id} value={`campaign:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </SelectField>
          </div>
        </div>
        {nextIdea && (
          <Link to={`/ideas/${nextIdea.id}`} className="today-hero__media" aria-label={`Open ${nextIdea.title}`}>
            <Cover art={nextIdea.art} ratio="4 / 5">
              <span className="cover__caption">
                <StatusPill status={nextIdea.status} />
                <span>{nextIdea.title}</span>
              </span>
            </Cover>
          </Link>
        )}
      </section>

      <div className="today-grid">
        <section className="panel tasks-panel" aria-labelledby="tasks-h">
          <div className="panel__head">
            <span className="with-info">
              <h2 id="tasks-h" className="h2">
                Work
              </h2>
              <InfoButton k="work" />
            </span>
            <div className="tabs tabs--pill" role="tablist" aria-label="Task groups">
              {(
                [
                  ['mine', 'Needs you', buckets.mine],
                  ['others', 'Assigned to others', buckets.others],
                  ['upcoming', 'Upcoming', buckets.upcoming],
                ] as const
              ).map(([key, label, list]) => (
                <button key={key} role="tab" type="button" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
                  {label} <span className="count">{list.filter((t) => !t.done).length}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon="check" title="Clear for now">
              {focus.kind === 'all' ? 'No tasks in this group.' : 'No tasks match this focus. Switch focus to see everything.'}
            </EmptyState>
          ) : (
            <ul className="task-list" role="tabpanel">
              {shown.map((t) => {
                const idea = ideaOf(data, t.ideaId);
                const version = data.versions.find((v) => v.id === t.versionId);
                const account = accountOf(data, version?.accountId);
                const owner = personOf(data, t.ownerId)!;
                const overdue = !t.done && t.due < data.today;
                return (
                  <li key={t.id} className={`task ${t.done ? 'is-done' : ''}`}>
                    <button
                      type="button"
                      className="check"
                      aria-pressed={t.done}
                      aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                      onClick={() => {
                        dispatch({ type: 'task/toggle', taskId: t.id });
                        if (!t.done) toast('Nice — marked done for this session.', 'ok');
                      }}
                    >
                      <Icon name="check" size={14} />
                    </button>
                    <div className="task__body">
                      <p className="task__title">{t.title}</p>
                      <p className="task__meta">
                        {idea && (
                          <Link to={`/ideas/${idea.id}/${t.versionId ? 'versions' : 'tasks'}`} className="task__idea">
                            {idea.title}
                          </Link>
                        )}
                        {account && <AccountBadge account={account} showHandle />}
                        {t.recurring && (
                          <span className="tag">
                            <Icon name="refresh" size={12} /> {t.recurring}
                          </span>
                        )}
                        <span className="tag" data-stage={t.stage}>{t.stage}</span>
                      </p>
                    </div>
                    <span className={`task__due ${overdue ? 'is-overdue' : ''}`}>{relativeDay(t.due, data.today)}</span>
                    {t.ownerId !== data.currentUserId && <Avatar person={owner} size={26} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="today-side">
          <section className="panel" aria-labelledby="week-h">
            <div className="panel__head">
              <h2 id="week-h" className="h2">
                Next seven days
              </h2>
              <TextLink to="/calendar">Calendar</TextLink>
            </div>
            <ol className="week">
              {week.map((day) => {
                const items = data.versions.filter((v) => v.scheduledFor === day && versionMatchesFocus(data, v, focus));
                const marketing = data.marketing.filter((m) => m.date === day);
                return (
                  <li key={day} className={`week__day ${day === data.today ? 'is-today' : ''}`}>
                    <span className="week__date">
                      <span>{formatDay(day, { weekday: 'short' })}</span>
                      <strong>{formatDay(day, { day: 'numeric' })}</strong>
                    </span>
                    <span className="week__items">
                      {items.length === 0 && marketing.length === 0 && <span className="week__none">—</span>}
                      {items.map((v) => {
                        const a = accountOf(data, v.accountId)!;
                        return (
                          <Link key={v.id} to={`/ideas/${v.ideaId}/versions?v=${v.id}`} className="week__item" style={{ ['--hue' as string]: platformOf(data, a.platform).hue }}>
                            <PlatformGlyph platform={platformOf(data, a.platform)} size="sm" />
                            <span>{ideaOf(data, v.ideaId)?.title}</span>
                          </Link>
                        );
                      })}
                      {marketing.map((m) => (
                        <span key={m.id} className="week__item week__item--mk">
                          <Icon name="campaigns" size={13} /> {m.title}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="panel" aria-labelledby="accts-h">
            <div className="panel__head">
              <h2 id="accts-h" className="h2">
                Accounts today
              </h2>
              <TextLink to="/gallery">Creation Gallery</TextLink>
            </div>
            <ul className="acct-quick">
              {todaysAccounts.map((a) => (
                <li key={a.id}>
                  <Link to={`/gallery?account=${a.id}`} className="acct-quick__main">
                    <PlatformGlyph platform={platformOf(data, a.platform)} />
                    <span>
                      <strong>{accountName(a.id)}</strong>
                      <span className="muted">{data.brands.find((b) => b.id === a.brandId)?.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <section className="recent" aria-labelledby="recent-h">
        <div className="panel__head">
          <h2 id="recent-h" className="h2">
            Recently active ideas
          </h2>
          <TextLink to="/ideas">All ideas</TextLink>
        </div>
        <div className="strip">
          {recent.map((i) => (
            <Link key={i.id} to={`/ideas/${i.id}`} className="strip__item">
              <Cover art={i.art} ratio="3 / 4" />
              <span className="strip__title">{i.title}</span>
              <span className="strip__meta">
                <StatusPill status={i.status} /> <span className="muted">{relativeDay(i.updatedAt, data.today)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
