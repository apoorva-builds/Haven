import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import type { DemoData, ISODate } from '../data/types';
import { creationLabel, creationMedia } from '../lib/creations';
import { daysBetween, formatDay } from '../lib/dates';
import { SOURCE_LABEL, activeDays, calendarEntries, entriesByDay, neighbours, stillOf, type DayEntry } from '../lib/posts';
import { zoneCity } from '../lib/time';
import { assetOf, ideaOf, platformOf } from '../state/selectors';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { TypeCover } from './TypeCover';
import { ExternalLink, PlatformGlyph } from './ui';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The open Day View lives in the URL (?day=YYYY-MM-DD), so a day can be
 * linked, opened from Today or the Calendar, and closed with Back.
 */
export function useDayParam() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('day');
  const day = raw && ISO.test(raw) ? (raw as ISODate) : null;
  // Functional updates, so quick successive moves build on the latest URL.
  const open = useCallback(
    (d: ISODate, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('day', d);
          return next;
        },
        { replace },
      ),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('day');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { day, open, close };
}

/** A day's covers as a small collage, with the post count. Planned-only days look like outlines. */
export function DayCollage({ data, entries, compact = false }: { data: DemoData; entries: DayEntry[]; compact?: boolean }) {
  const posted = entries.filter((e) => e.posted);
  const shown = (posted.length ? posted : entries).slice(0, 4);
  const stills = shown.map((e) => stillOf(data, e.version));
  const planned = posted.length === 0;
  return (
    <span className={`collage collage--n${Math.min(shown.length, 4)} ${planned ? 'is-planned' : 'is-posted'} ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      {stills.map((src, i) => (
        <span key={i} className="collage__cell">
          {src ? <img src={src} alt="" loading="lazy" /> : <span className="collage__blank" />}
        </span>
      ))}
      {planned ? (
        <span className="collage__count collage__count--planned">
          <Icon name="clock" size={11} /> {entries.length}
        </span>
      ) : (
        posted.length > 1 && <span className="collage__count">{posted.length}</span>
      )}
    </span>
  );
}

/** "Oct 1", or "Oct 1, 2025" outside the current year. */
function shortDay(day: ISODate, today: ISODate): string {
  return formatDay(day, day.slice(0, 4) === today.slice(0, 4) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Today", "Yesterday", "20 days ago", "In 3 days", "1 year ago". */
function howLongAgo(day: ISODate, today: ISODate): string {
  const n = daysBetween(day, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n === -1) return 'Tomorrow';
  if (n < 0) return `In ${-n} days`;
  if (n < 60) return `${n} days ago`;
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  const years = Math.floor(n / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/** Spoken summary of a day, e.g. "Friday, September 11: 3 posts". */
export function dayLabel(day: ISODate, entries: DayEntry[]): string {
  const posted = entries.filter((e) => e.posted).length;
  const planned = entries.length - posted;
  const bits = [posted && `${posted} post${posted === 1 ? '' : 's'}`, planned && `${planned} planned`].filter(Boolean);
  return `${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${bits.length ? `: ${bits.join(', ')}` : ''}`;
}

/** Every post from one date: play it, browse it, open it, and move between days. */
export function DayView({ day, onClose, onDay }: { day: ISODate; onClose: () => void; onDay: (d: ISODate) => void }) {
  const { data } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const entries = useMemo(() => calendarEntries(data), [data]);
  const byDay = useMemo(() => entriesByDay(entries), [entries]);
  const days = useMemo(() => activeDays(entries), [entries]);
  const items = byDay.get(day) ?? [];
  const { prev, next } = neighbours(days, day);
  const posted = items.filter((e) => e.posted).length;
  const tz = data.workspace.timeZone;
  const isFuture = day > data.today;

  // Nearby days with something on them, for jumping around.
  const nearby = useMemo(() => {
    const i = days.findIndex((d) => d >= day);
    const at = i < 0 ? days.length : i;
    return days.slice(Math.max(0, at - 4), at + 5);
  }, [days, day]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('.dayview__close')?.focus();
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
      before?.focus();
    };
  }, []);

  useEffect(() => {
    ref.current?.querySelector('.dayview__scroll')?.scrollTo({ top: 0 });
  }, [day]);

  // Track the shown day here too, so quick repeated arrow presses each move one day.
  const current = useRef(day);
  const shown = useRef(day);
  if (shown.current !== day) {
    shown.current = day;
    current.current = day;
  }
  useEffect(() => {
    const step = (dir: 'prev' | 'next') => {
      const target = neighbours(days, current.current)[dir];
      if (!target) return;
      current.current = target;
      onDay(target);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, video');
      if (e.key === 'Escape') onClose();
      else if (!typing && e.key === 'ArrowLeft') step('prev');
      else if (!typing && e.key === 'ArrowRight') step('next');
      else if (e.key === 'Tab' && ref.current) {
        const all = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), video[controls]');
        if (!all.length) return;
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all[all.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === all[all.length - 1]) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onDay, days]);

  return createPortal(
    <div className="dayview-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dayview" role="dialog" aria-modal="true" aria-labelledby="dayview-title" ref={ref}>
        <header className="dayview__head">
          <div className="dayview__when">
            <p className="dayview__eyebrow">{howLongAgo(day, data.today)}</p>
            <h2 id="dayview-title" className="dayview__title">
              {formatDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <p className="dayview__sum">
              {items.length === 0
                ? 'Nothing here'
                : [posted && `${posted} posted`, items.length - posted && `${items.length - posted} planned`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="dayview__nav">
            <button type="button" className="icon-btn" onClick={() => prev && onDay(prev)} disabled={!prev} aria-label={prev ? `Previous day with posts: ${formatDay(prev, { month: 'long', day: 'numeric' })}` : 'No earlier posts'}>
              <Icon name="chevronLeft" />
            </button>
            <button type="button" className="icon-btn" onClick={() => next && onDay(next)} disabled={!next} aria-label={next ? `Next day with posts: ${formatDay(next, { month: 'long', day: 'numeric' })}` : 'Nothing later'}>
              <Icon name="chevronRight" />
            </button>
            <button type="button" className="icon-btn dayview__close" onClick={onClose} aria-label="Close day">
              <Icon name="close" />
            </button>
          </div>
        </header>

        {nearby.length > 1 && (
          <nav className="dayview__strip" aria-label="Nearby days with posts">
            {nearby.map((d) => (
              <button key={d} type="button" className={`dayview__chip ${d === day ? 'is-current' : ''} ${d > data.today ? 'is-future' : ''}`} aria-current={d === day ? 'date' : undefined} aria-label={dayLabel(d, byDay.get(d) ?? [])} onClick={() => onDay(d)}>
                <DayCollage data={data} entries={byDay.get(d) ?? []} compact />
                <span>{shortDay(d, data.today)}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="dayview__scroll">
          {items.length === 0 ? (
            <div className="dayview__empty">
              <p className="dayview__empty-title">{isFuture ? 'Nothing planned for this day yet.' : 'Nothing posted on this day.'}</p>
              <p className="muted">Only posts you can open are shown.</p>
              <div className="dayview__jump">
                {prev && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDay(prev)}>
                    <Icon name="chevronLeft" size={14} /> {formatDay(prev, { month: 'short', day: 'numeric' })}
                  </button>
                )}
                {next && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDay(next)}>
                    {formatDay(next, { month: 'short', day: 'numeric' })} <Icon name="chevronRight" size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ol className="dayview__posts">
              {items.map((e) => (
                <li key={e.version.id}>
                  <DayPost data={data} entry={e} />
                </li>
              ))}
            </ol>
          )}
          <p className="dayview__foot">
            Days and times in {zoneCity(tz)} time ({tz}). Preview: no social accounts are connected, so only posts recorded in Haven appear here.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DayPost({ data, entry }: { data: DemoData; entry: DayEntry }) {
  const v = entry.version;
  const account = data.accounts.find((a) => a.id === v.accountId)!;
  const platform = platformOf(data, account.platform);
  const idea = ideaOf(data, v.ideaId);
  const space = data.brands.find((b) => b.id === account.brandId);
  const media = assetOf(data, v.mediaAssetId);
  const photos = (v.photoAssetIds ?? []).map((id) => assetOf(data, id)).filter((a) => !!a);
  const [photo, setPhoto] = useState(0);
  const title = v.title ?? idea?.title ?? '';
  const caption = Object.values(v.captions).find((c) => c.trim());
  const kind = creationMedia(v);
  const ratio = kind === 'video' && v.aspect === '16:9' ? '16 / 9' : kind === 'video' ? '9 / 16' : '4 / 5';
  const late = entry.posted && entry.time && daysBetween(entry.day, data.today) >= 0;

  return (
    <article className={`dpost ${entry.posted ? 'is-posted' : 'is-planned'}`} aria-label={`${title}, ${creationLabel(v, account, platform)}, ${entry.posted ? 'posted' : 'planned'}`}>
      <div className="dpost__media" style={{ aspectRatio: ratio }}>
        {kind === 'video' && media?.videoUrl ? (
          <video src={media.videoUrl} poster={media.art.image} controls playsInline preload="metadata" aria-label={`Play ${title}`} />
        ) : photos.length ? (
          <>
            <img src={photos[photo].art.image} alt={`${title}: photo ${photo + 1} of ${photos.length}`} />
            {photos.length > 1 && (
              <div className="dpost__pager">
                <button type="button" aria-label="Previous photo" disabled={photo === 0} onClick={() => setPhoto(photo - 1)}>
                  <Icon name="chevronLeft" size={16} />
                </button>
                <span>
                  {photo + 1} / {photos.length}
                </span>
                <button type="button" aria-label="Next photo" disabled={photo === photos.length - 1} onClick={() => setPhoto(photo + 1)}>
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <TypeCover title={title} kicker="No media yet" />
        )}
      </div>
      <div className="dpost__body">
        <p className={`dpost__state ${entry.posted ? 'is-posted' : 'is-planned'}`}>
          {entry.posted ? (
            <>
              <Icon name="check" size={13} /> Posted{late ? ` at ${entry.time}` : ''}
            </>
          ) : (
            <>
              <Icon name="clock" size={13} /> Planned · {v.status}
            </>
          )}
        </p>
        <h3 className="dpost__title">{title}</h3>
        <p className="dpost__where">
          <PlatformGlyph platform={platform} size="sm" />
          <span>
            {creationLabel(v, account, platform)} · {account.handle}
            {space && <span className="muted"> · {space.name}</span>}
          </span>
        </p>
        {caption && <p className="dpost__caption">“{caption}”</p>}
        <p className="dpost__source">{SOURCE_LABEL[entry.source]}</p>
        <div className="dpost__actions">
          <Link className="btn btn--ghost btn--sm" to={entry.posted ? `/gallery/${v.id}` : `/ideas/${v.ideaId}/versions?v=${v.id}`}>
            Open in Haven <Icon name="arrowRight" size={14} />
          </Link>
          {entry.posted && v.liveUrl ? (
            <ExternalLink href={v.liveUrl} className="btn btn--ghost btn--sm">
              View live post
            </ExternalLink>
          ) : entry.posted ? (
            <span className="muted dpost__nolink">No live link saved</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
