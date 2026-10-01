import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoData, ISODate, Task } from '../data/types';
import { useAccountName } from '../components/AccountSelector';
import { InfoButton } from '../components/InfoButton';
import { Icon } from '../components/Icon';
import { PersonalPhoto } from '../components/PersonalPhoto';
import { QuickAddModal, useCanCreateIdea } from '../components/Shell';
import { useToast } from '../components/Toast';
import { TypeCover } from '../components/TypeCover';
import { AccountBadge, Avatar, EmptyState, PlatformGlyph, SelectField, StatusPill, TextLink, useSimulatedLoad } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { DayCollage, DayView, dayLabel, useDayParam } from '../components/DayView';
import { calendarEntries, entriesByDay } from '../lib/posts';
import { creationLabel } from '../lib/creations';
import { addDays, daysBetween, formatDay, formatLongDate, fromISODate, relativeDay } from '../lib/dates';
import { memoriesFor, rotateMemories, type Memory } from '../lib/memories';
import { ideaImage, toneOf } from '../lib/studio';
import { accountOf, assetOf, ideaOf, personOf, platformOf, taskMatchesFocus, versionMatchesFocus, type Focus } from '../state/selectors';
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
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const ready = useSimulatedLoad();
  const canCreate = useCanCreateIdea();
  const [adding, setAdding] = useState(false);
  const [focusValue, setFocusValue] = useState('all');
  const [tab, setTab] = useState<TaskTab>('mine');
  const focus = parseFocus(focusValue);
  const me = personOf(data, data.currentUserId)!;
  const accountName = useAccountName();

  const buckets = useMemo(() => bucketTasks(data, focus), [data, focus]);
  const nextTask = buckets.mine.find((t) => !t.done) ?? buckets.upcoming.find((t) => !t.done && t.ownerId === data.currentUserId);
  const nextIdea = ideaOf(data, nextTask?.ideaId);
  const memories = useMemo(() => rotateMemories(memoriesFor(data), data.today), [data]);

  const week = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const recent = [...data.ideas].filter((i) => !i.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const todaysAccounts = data.accounts.filter((a) => a.usedToday);
  const shown = buckets[tab];

  // Honest numbers from the viewer's own data.
  const postedRecently = data.versions.filter((v) => v.status === 'Posted' && daysBetween(v.scheduledFor, data.today) <= 30 && v.scheduledFor <= data.today).length;
  const readyToGo = data.versions.filter((v) => v.status === 'Ready to post').length;
  const { day: dayOpen, open: openDay, close: closeDay } = useDayParam();

  if (!ready) {
    return (
      <div className="page today today--loading" role="status" aria-label="Loading today">
        <div className="t-skeleton t-skeleton--hero" />
        <div className="t-skeleton t-skeleton--strip" />
      </div>
    );
  }

  return (
    <div className="page today">
      <header className="t-top t-rise" style={{ ['--i' as string]: 0 }}>
        <Wordmark />
        <p className="t-top__date">{formatLongDate(data.today)}</p>
      </header>

      <section className="t-hero" aria-labelledby="hello-h">
        <div className="t-hello">
          <div className="t-hello__who t-rise" style={{ ['--i' as string]: 1 }}>
            <PersonalPhoto person={me} />
            <div>
              <h1 id="hello-h" className="t-hello__h">
                {greeting()}, {me.name.split(' ')[0]}.
              </h1>
              <p className="t-hello__lede">
                {postedRecently > 0 ? (
                  <>
                    Look what you’ve made: <strong>{postedRecently} posted</strong> in the last 30 days
                    {readyToGo > 0 && (
                      <>
                        , <strong>{readyToGo} ready to go</strong>
                      </>
                    )}
                    . Keep doing what you love.
                  </>
                ) : readyToGo > 0 ? (
                  <>
                    <strong>{readyToGo} ready to go</strong>. Keep doing what you love.
                  </>
                ) : (
                  <>Keep doing what you love. Here’s what’s next.</>
                )}
              </p>
            </div>
          </div>

          <div className="t-next t-rise" style={{ ['--i' as string]: 2 }}>
            <p className="t-next__eyebrow">
              <span className={nextTask && nextTask.due <= data.today ? 'is-due' : ''}>{nextTask ? `Next · ${relativeDay(nextTask.due, data.today)}` : 'Next'}</span>
            </p>
            {nextTask && nextIdea ? (
              <>
                <div className="t-next__row">
                  <IdeaThumb data={data} ideaId={nextIdea.id} />
                  <div>
                    <p className="t-next__task">{nextTask.title}</p>
                    <p className="t-next__idea">{nextIdea.title}</p>
                  </div>
                </div>
                <div className="t-next__actions">
                  <Link className="btn btn--primary" to={`/ideas/${nextIdea.id}/${nextTask.versionId ? 'versions' : 'tasks'}`}>
                    Continue “{nextIdea.title}”
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </>
            ) : (
              <p className="t-next__task">Nothing needs you right now. A good moment to start something new.</p>
            )}
            <div className="t-quick" role="group" aria-label="Quick actions">
              {canCreate && (
                <button type="button" className="t-quick__item" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={16} /> New idea
                </button>
              )}
              <Link className="t-quick__item" to="/gallery">
                <Icon name="grid" size={16} /> Creation Gallery
              </Link>
              <Link className="t-quick__item" to="/calendar">
                <Icon name="calendar" size={16} /> Calendar
              </Link>
            </div>
          </div>
        </div>

        <MemoryCard memories={memories} />
      </section>

      <LifeRibbon onOpen={openDay} />

      <div className="today-grid">
        <section className="panel tasks-panel" aria-labelledby="tasks-h">
          <div className="panel__head">
            <span className="with-info">
              <h2 id="tasks-h" className="h2">
                Needs attention
              </h2>
              <InfoButton k="work" />
            </span>
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
                      disabled={!allowed({ type: 'task/toggle', taskId: t.id })}
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
                        <span className="tag" data-stage={t.stage}>
                          {t.stage}
                        </span>
                      </p>
                    </div>
                    <span className={`task__due ${overdue ? 'is-overdue' : ''}`}>{relativeDay(t.due, data.today)}</span>
                    {t.ownerId !== data.currentUserId && owner && <Avatar person={owner} size={26} />}
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
                Coming up
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

          {todaysAccounts.length > 0 && (
            <section className="panel" aria-labelledby="accts-h">
              <div className="panel__head">
                <h2 id="accts-h" className="h2">
                  Accounts today
                </h2>
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
          )}
        </aside>
      </div>

      <section className="t-continue" aria-labelledby="continue-h">
        <div className="t-section-head">
          <h2 id="continue-h" className="t-section-h">
            Pick up where you left off
          </h2>
          <TextLink to="/ideas">All ideas</TextLink>
        </div>
        <ul className="t-continue__list">
          {recent.map((i) => (
            <li key={i.id}>
              <Link to={`/ideas/${i.id}`} className="t-idea">
                <IdeaThumb data={data} ideaId={i.id} />
                <span className="t-idea__text">
                  <span className="t-idea__title">{i.title}</span>
                  <span className="t-idea__meta">
                    <StatusPill status={i.status} /> <span className="muted">{relativeDay(i.updatedAt, data.today)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {canCreate && (
            <li>
              <button type="button" className="t-idea t-idea--new" onClick={() => setAdding(true)}>
                <span className="t-idea__plus">
                  <Icon name="plus" size={20} />
                </span>
                <span className="t-idea__text">
                  <span className="t-idea__title">Start something new</span>
                  <span className="t-idea__meta muted">Capture an idea in seconds</span>
                </span>
              </button>
            </li>
          )}
        </ul>
      </section>
      {adding && <QuickAddModal onClose={() => setAdding(false)} />}
      {dayOpen && <DayView day={dayOpen} onClose={closeDay} onDay={(d) => openDay(d, true)} />}
    </div>
  );
}

/**
 * The life of your work: the last four weeks and the week ahead, each day
 * showing its real covers. Opens any day; the full Calendar is one click away.
 */
function LifeRibbon({ onOpen }: { onOpen: (day: ISODate) => void }) {
  const { data } = useStore();
  const scroller = useRef<HTMLOListElement>(null);
  const entries = useMemo(() => calendarEntries(data), [data]);
  const byDay = useMemo(() => entriesByDay(entries), [entries]);
  const days = Array.from({ length: 35 }, (_, i) => addDays(data.today, i - 27));
  const postedRecently = entries.filter((e) => e.posted && e.day >= days[0] && e.day <= data.today).length;
  const plannedSoon = entries.filter((e) => !e.posted && e.day >= data.today && e.day <= days[days.length - 1]).length;
  const firstPosted = entries.find((e) => e.posted);

  // Keep today in view, with the past to its left.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('.ribbon__day.is-today');
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - scroller.current.clientWidth * 0.62;
  }, []);

  return (
    <section className="ribbon t-rise" style={{ ['--i' as string]: 3 }} aria-labelledby="ribbon-h">
      <div className="t-section-head">
        <div>
          <h2 id="ribbon-h" className="t-section-h">
            Look what you’ve made
          </h2>
          <p className="ribbon__sum">
            {postedRecently ? `${postedRecently} posted in the last four weeks` : 'Nothing posted in the last four weeks'}
            {plannedSoon > 0 && ` · ${plannedSoon} planned this week`}
            {firstPosted && ` · posting since ${formatDay(firstPosted.day, { month: 'long', year: 'numeric' })}`}
          </p>
        </div>
        <TextLink to="/calendar">Open calendar</TextLink>
      </div>
      <ol className="ribbon__days" ref={scroller} aria-label="Your last four weeks and the week ahead">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? [];
          const date = fromISODate(day);
          const monthStart = i === 0 || date.getDate() === 1;
          return (
            <li key={day} className={`ribbon__day ${day === data.today ? 'is-today' : ''} ${day > data.today ? 'is-future' : ''} ${items.length ? 'has-items' : ''}`}>
              {monthStart && <span className="ribbon__month">{date.toLocaleDateString('en-US', { month: 'short' })}</span>}
              <button type="button" className="ribbon__btn" onClick={() => onOpen(day)} aria-label={`Open ${dayLabel(day, items)}`}>
                <span className="ribbon__dow" aria-hidden="true">
                  {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span className="ribbon__num" aria-hidden="true">
                  {date.getDate()}
                </span>
                {items.length ? <DayCollage data={data} entries={items} /> : <span className="ribbon__empty" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function IdeaThumb({ data, ideaId, large = false }: { data: DemoData; ideaId: string; large?: boolean }) {
  const idea = ideaOf(data, ideaId);
  if (!idea) return null;
  const image = ideaImage(data, idea);
  return (
    <span className={`t-thumb ${large ? 't-thumb--large' : ''} tone--${toneOf(idea)}`} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" /> : large ? <TypeCover title={idea.title} ratio="4 / 5" /> : <span className="t-thumb__type">{idea.title.charAt(0)}</span>}
    </span>
  );
}

const MEMORY_EYEBROW: Record<Memory['kind'], (ago: string) => string> = {
  'on-this-day': (ago) => `On this day · ${ago}`,
  recent: (ago) => `A memory · posted ${ago}`,
  revisit: (ago) => `Worth revisiting · ${ago}`,
};

/** The creator's own posted work, brought back. Rotates daily; never invented. */
function MemoryCard({ memories }: { memories: Memory[] }) {
  const { data } = useStore();
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState(0);

  if (memories.length === 0) {
    return (
      <section className="memory memory--empty t-rise" style={{ ['--i' as string]: 2 }} aria-labelledby="memory-h">
        <div className="memory__body">
          <p className="memory__eyebrow">Memories</p>
          <h2 id="memory-h" className="memory__title">
            Your posted work comes back here
          </h2>
          <p className="memory__meta">Once a creation is marked as posted, Haven can bring it back on days worth remembering. Nothing has been posted that you can see yet.</p>
          <TextLink to="/gallery">Open the Creation Gallery</TextLink>
        </div>
      </section>
    );
  }

  const m = memories[index % memories.length];
  const v = m.version;
  const account = accountOf(data, v.accountId)!;
  const platform = platformOf(data, account.platform);
  const media = assetOf(data, v.mediaAssetId);
  const photos = (v.photoAssetIds ?? []).map((id) => assetOf(data, id)).filter((a) => !!a);
  const shown = photos[photo % Math.max(1, photos.length)];
  const title = v.title ?? ideaOf(data, v.ideaId)?.title ?? '';

  return (
    <section className={`memory memory--${m.kind} t-rise`} style={{ ['--i' as string]: 2 }} aria-labelledby="memory-h" aria-live="polite">
      <div className="memory__media" key={v.id}>
        {m.playable && media ? (
          <video src={media.videoUrl} poster={media.art.image} controls playsInline preload="metadata" aria-label={`Play ${title}`} />
        ) : shown ? (
          <>
            <img src={shown.art.image} alt={`${title}: ${shown.name}`} />
            {photos.length > 1 && (
              <div className="memory__dots" role="group" aria-label="Photos">
                {photos.map((p, i) => (
                  <button key={p.id} type="button" aria-label={`Photo ${i + 1} of ${photos.length}`} aria-pressed={i === photo % photos.length} onClick={() => setPhoto(i)} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      <div className="memory__body" key={`b-${v.id}`}>
        <p className="memory__eyebrow with-info">
          {MEMORY_EYEBROW[m.kind](m.ago)}
          <InfoButton k="memories" />
        </p>
        <h2 id="memory-h" className="memory__title">
          {title}
        </h2>
        <p className="memory__meta">
          <PlatformGlyph platform={platform} size="sm" /> {creationLabel(v, account, platform)} · {account.handle}
        </p>
        {Object.values(v.captions).find((c) => c.trim()) && <blockquote className="memory__caption">“{Object.values(v.captions).find((c) => c.trim())}”</blockquote>}
        <p className="memory__when">Posted {formatDay(v.scheduledFor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="memory__actions">
          <Link className="btn btn--ghost btn--sm" to={`/gallery/${v.id}`}>
            Open creation <Icon name="arrowRight" size={14} />
          </Link>
          {memories.length > 1 && (
            <button
              type="button"
              className="memory__next"
              onClick={() => {
                setIndex((i) => (i + 1) % memories.length);
                setPhoto(0);
              }}
            >
              <Icon name="refresh" size={14} /> Another memory
              <span className="memory__count">
                {(index % memories.length) + 1} of {memories.length}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
