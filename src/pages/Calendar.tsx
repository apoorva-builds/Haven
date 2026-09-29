import { useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { VERSION_STATUSES, type DemoData, type ISODate, type Version } from '../data/types';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { DemoTag, EmptyState, PageHeader, PlatformGlyph, Segmented, SelectField, StatusPill } from '../components/ui';
import { addDays, formatDay, fromISODate, monthGrid, toISODate } from '../lib/dates';
import { accountOf, ideaOf, platformOf } from '../state/selectors';
import { useStore } from '../state/store';

type Perspective = 'content' | 'marketing';

interface Filters {
  account: string;
  platform: string;
  campaign: string;
  status: string;
  person: string;
}

export function filterVersions(data: DemoData, f: Filters): Version[] {
  return data.versions.filter((v) => {
    const account = accountOf(data, v.accountId);
    const idea = ideaOf(data, v.ideaId);
    if (!account || !idea || idea.archived) return false;
    if (f.account !== 'all' && v.accountId !== f.account) return false;
    if (f.platform !== 'all' && account.platform !== f.platform) return false;
    if (f.campaign !== 'all' && idea.campaignId !== f.campaign) return false;
    if (f.status !== 'all' && v.status !== f.status) return false;
    if (f.person !== 'all') {
      const owns = data.tasks.some((t) => t.ownerId === f.person && (t.versionId === v.id || (t.ideaId === idea.id && !t.versionId)));
      if (!owns && !idea.peopleIds.includes(f.person)) return false;
    }
    return true;
  });
}

export function CalendarPage() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [anchor, setAnchor] = useState<ISODate>(data.today);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<ISODate | null>(null);
  const perspective = (params.get('view') ?? 'content') as Perspective;
  const filters: Filters = {
    account: params.get('account') ?? 'all',
    platform: params.get('platform') ?? 'all',
    campaign: params.get('campaign') ?? 'all',
    status: params.get('status') ?? 'all',
    person: params.get('person') ?? 'all',
  };
  const set = (key: string, value: string, fallback = 'all') => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const versions = filterVersions(data, filters);
  const marketing = data.marketing.filter((m) => filters.campaign === 'all' || m.campaignId === filters.campaign);
  const weeks = monthGrid(anchor);
  const month = fromISODate(anchor).getMonth();
  const monthLabel = fromISODate(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const anyFilter = Object.values(filters).some((v) => v !== 'all');

  const hueFor = (v: Version) => {
    if (perspective === 'marketing') {
      const c = data.campaigns.find((c) => c.id === ideaOf(data, v.ideaId)?.campaignId);
      return c?.hue ?? 250;
    }
    return platformOf(data, accountOf(data, v.accountId)!.platform).hue;
  };

  const legend =
    perspective === 'content'
      ? data.platforms.filter((p) => data.accounts.some((a) => a.platform === p.id)).map((p) => ({ key: p.id, label: p.name, hue: p.hue }))
      : [...data.campaigns.map((c) => ({ key: c.id, label: c.name, hue: c.hue })), { key: 'none', label: 'No campaign', hue: 250 }];

  const onDrop = (e: DragEvent, day: ISODate) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragging;
    setDragging(null);
    setOver(null);
    const v = data.versions.find((x) => x.id === id);
    if (!v || v.scheduledFor === day) return;
    dispatch({ type: 'version/reschedule', versionId: v.id, date: day });
    toast(`Moved to ${formatDay(day)} with its open tasks — this session only.`, 'demo');
  };

  const agendaDays = Array.from({ length: 21 }, (_, i) => addDays(data.today, i));

  return (
    <div className="page calendar-page">
      <PageHeader
        eyebrow="Calendar"
        title={monthLabel}
        lede={
          perspective === 'content' ? (
            <>
              Every planned version, coloured by platform.<span className="hide-phone"> Drag a post to another day to reschedule it.</span>
            </>
          ) : (
            'The same work, coloured by campaign, with launches, emails and deadlines.'
          )
        }
        actions={
          <Segmented<Perspective>
            label="Calendar perspective"
            value={perspective}
            onChange={(v) => set('view', v, 'content')}
            options={[
              { value: 'content', label: 'Content' },
              { value: 'marketing', label: 'Marketing' },
            ]}
          />
        }
      />

      <div className="filters" role="group" aria-label="Filter calendar">
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setAnchor(toISODate(new Date(fromISODate(anchor).getFullYear(), month - 1, 1)))}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAnchor(data.today)}>
            Today
          </button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setAnchor(toISODate(new Date(fromISODate(anchor).getFullYear(), month + 1, 1)))}>
            <Icon name="chevronRight" />
          </button>
        </div>
        <SelectField label="Account" value={filters.account} onChange={(v) => set('account', v)}>
          <option value="all">All accounts</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {platformOf(data, a.platform).name} · {a.handle}
            </option>
          ))}
        </SelectField>
        <SelectField label="Platform" value={filters.platform} onChange={(v) => set('platform', v)}>
          <option value="all">All platforms</option>
          {data.platforms
            .filter((p) => data.accounts.some((a) => a.platform === p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>
        <SelectField label="Campaign" value={filters.campaign} onChange={(v) => set('campaign', v)}>
          <option value="all">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(v) => set('status', v)}>
          <option value="all">All statuses</option>
          {VERSION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <SelectField label="Person" value={filters.person} onChange={(v) => set('person', v)}>
          <option value="all">Everyone</option>
          {data.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        {anyFilter && (
          <button type="button" className="link-btn" onClick={() => setParams(perspective === 'content' ? {} : { view: perspective }, { replace: true })}>
            Clear filters
          </button>
        )}
      </div>

      <ul className="legend" aria-label="Colour legend">
        {legend.map((l) => (
          <li key={l.key} style={{ ['--hue' as string]: l.hue }}>
            <span className="legend__swatch" aria-hidden="true" />
            {l.label}
          </li>
        ))}
        {perspective === 'marketing' && (
          <li className="legend__mk">
            <Icon name="campaigns" size={13} /> Marketing moment
          </li>
        )}
        <li className="legend__demo">
          <DemoTag>Rescheduling is session-only</DemoTag>
        </li>
      </ul>

      {versions.length === 0 && marketing.length === 0 ? (
        <EmptyState icon="calendar" title="Nothing on the calendar for these filters" />
      ) : null}

      <div className="month" role="grid" aria-label={monthLabel}>
        <div className="month__head" role="row">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span key={d} role="columnheader">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="month__week" role="row">
            {week.map((day) => {
              const items = versions.filter((v) => v.scheduledFor === day);
              const mk = perspective === 'marketing' ? marketing.filter((m) => m.date === day) : [];
              const outside = fromISODate(day).getMonth() !== month;
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}
                  className={`month__day ${outside ? 'is-outside' : ''} ${day === data.today ? 'is-today' : ''} ${over === day ? 'is-over' : ''} ${day < data.today ? 'is-past' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(day);
                  }}
                  onDragLeave={() => setOver((o) => (o === day ? null : o))}
                  onDrop={(e) => onDrop(e, day)}
                  data-date={day}
                >
                  <span className="month__num">{fromISODate(day).getDate()}</span>
                  {mk.map((m) => (
                    <span key={m.id} className="cal-mk" style={{ ['--hue' as string]: data.campaigns.find((c) => c.id === m.campaignId)?.hue ?? 250 }}>
                      <Icon name="campaigns" size={12} /> {m.title}
                    </span>
                  ))}
                  {items.map((v) => {
                    const account = accountOf(data, v.accountId)!;
                    return (
                      <Link
                        key={v.id}
                        to={`/ideas/${v.ideaId}/versions?v=${v.id}`}
                        className={`cal-item cal-item--${v.status.replace(/\s+/g, '-').toLowerCase()} ${dragging === v.id ? 'is-dragging' : ''}`}
                        style={{ ['--hue' as string]: hueFor(v) }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', v.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging(v.id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        title={`${ideaOf(data, v.ideaId)?.title} — ${account.handle} (${v.status})`}
                        data-version={v.id}
                      >
                        <span className="cal-item__acct">
                          {platformOf(data, account.platform).glyph} {account.handle}
                        </span>
                        <span className="cal-item__title">{ideaOf(data, v.ideaId)?.title}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section className="agenda" aria-label="Agenda for the next three weeks">
        {agendaDays.map((day) => {
          const items = versions.filter((v) => v.scheduledFor === day);
          const mk = marketing.filter((m) => m.date === day);
          if (!items.length && !mk.length) return null;
          return (
            <div key={day} className="agenda__day">
              <p className="agenda__date">
                {day === data.today ? 'Today' : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <ul>
                {mk.map((m) => (
                  <li key={m.id} className="agenda__mk">
                    <Icon name="campaigns" size={14} /> {m.title}
                  </li>
                ))}
                {items.map((v) => {
                  const account = accountOf(data, v.accountId)!;
                  return (
                    <li key={v.id}>
                      <Link to={`/ideas/${v.ideaId}/versions?v=${v.id}`} className="agenda__item" style={{ ['--hue' as string]: hueFor(v) }}>
                        <PlatformGlyph platform={platformOf(data, account.platform)} size="sm" />
                        <span>
                          <strong>{ideaOf(data, v.ideaId)?.title}</strong>
                          <span className="muted"> {account.handle}</span>
                        </span>
                        <StatusPill status={v.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
