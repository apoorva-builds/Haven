import type { ISODate } from '../data/types';

/*
 * Time zones. A post's calendar day is the day it went live in the
 * workspace's time zone, not in UTC and not on the server's clock, so a post
 * at 11:40 pm in Los Angeles stays on that day even though it's already
 * tomorrow in UTC.
 */

function parts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const get = (t: string) => Number(fmt.formatToParts(instant).find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** The calendar day of an instant in a time zone, e.g. "2026-09-11". */
export function zonedDay(iso: string, timeZone: string): ISODate {
  const p = parts(new Date(iso), timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Local clock time of an instant in a time zone, e.g. "11:40 PM". */
export function zonedTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

/** The instant (UTC ISO string) for a wall-clock date and time in a time zone. */
export function zonedInstant(date: ISODate, time: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wanted = Date.UTC(y, m - 1, d, h, min);
  // Correct twice so DST transitions settle.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), timeZone);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}

/** A short, readable name for a time zone, e.g. "Los Angeles". */
export function zoneCity(timeZone: string): string {
  return timeZone.split('/').pop()!.replace(/_/g, ' ');
}
