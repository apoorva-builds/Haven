import type { DemoData, ISODate, Version } from '../data/types';
import { zonedDay, zonedTime } from './time';

/*
 * The publishing calendar's model. Every creation appears on one day:
 * - posted work on the day it went live, in the workspace time zone;
 * - planned work on the day it's scheduled for.
 * Posted work from archived ideas stays in the history; planned work from
 * archived ideas does not. The data passed in is already scoped to the
 * viewer, so collaborators only ever get permitted posts.
 */

export type EntrySource = 'manual' | 'connected' | 'planned';

export interface DayEntry {
  version: Version;
  day: ISODate;
  posted: boolean;
  /** Local time it went live, e.g. "11:40 PM" (posted work with a recorded time). */
  time?: string;
  source: EntrySource;
}

export const SOURCE_LABEL: Record<EntrySource, string> = {
  manual: 'Recorded in Haven',
  connected: 'Imported from a connected account',
  planned: 'Planned in Haven',
};

export function calendarEntries(data: DemoData): DayEntry[] {
  const tz = data.workspace.timeZone;
  return data.versions
    .flatMap((v): DayEntry[] => {
      const idea = data.ideas.find((i) => i.id === v.ideaId);
      if (!idea || !data.accounts.some((a) => a.id === v.accountId)) return [];
      if (v.status === 'Posted') {
        return [
          {
            version: v,
            day: v.postedAt ? zonedDay(v.postedAt, tz) : v.scheduledFor,
            posted: true,
            time: v.postedAt ? zonedTime(v.postedAt, tz) : undefined,
            source: v.postSource ?? 'manual',
          },
        ];
      }
      if (idea.archived) return [];
      return [{ version: v, day: v.scheduledFor, posted: false, source: 'planned' }];
    })
    .sort((a, b) => a.day.localeCompare(b.day) || Number(b.posted) - Number(a.posted) || (a.version.postedAt ?? '').localeCompare(b.version.postedAt ?? '') || a.version.id.localeCompare(b.version.id));
}

export function entriesByDay(entries: DayEntry[]): Map<ISODate, DayEntry[]> {
  const map = new Map<ISODate, DayEntry[]>();
  for (const e of entries) map.set(e.day, [...(map.get(e.day) ?? []), e]);
  return map;
}

/** Days with anything on them, oldest first. */
export function activeDays(entries: DayEntry[]): ISODate[] {
  return [...new Set(entries.map((e) => e.day))].sort();
}

/** The nearest earlier and later days that have something on them. */
export function neighbours(days: ISODate[], day: ISODate): { prev?: ISODate; next?: ISODate } {
  return { prev: [...days].reverse().find((d) => d < day), next: days.find((d) => d > day) };
}

export interface MonthSummary {
  month: string; // "2026-09"
  posted: number;
  planned: number;
  covers: string[];
}

/** Months with activity (plus the current month), for moving through years of work quickly. */
export function monthsOfWork(data: DemoData, entries: DayEntry[]): MonthSummary[] {
  const months = new Map<string, MonthSummary>();
  const touch = (m: string) => months.get(m) ?? months.set(m, { month: m, posted: 0, planned: 0, covers: [] }).get(m)!;
  touch(data.today.slice(0, 7));
  for (const e of entries) {
    const s = touch(e.day.slice(0, 7));
    if (e.posted) s.posted += 1;
    else s.planned += 1;
    const still = stillOf(data, e.version);
    if (e.posted && still && s.covers.length < 3 && !s.covers.includes(still)) s.covers.push(still);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** A cover image for a creation: its video poster, first photo or chosen cover. */
export function stillOf(data: DemoData, v: Version): string | undefined {
  for (const id of [v.mediaAssetId, ...(v.photoAssetIds ?? []), v.coverAssetId]) {
    const image = id ? data.assets.find((a) => a.id === id)?.art.image : undefined;
    if (image) return image;
  }
  return undefined;
}
