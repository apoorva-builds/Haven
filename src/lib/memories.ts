import type { DemoData, ISODate, Version } from '../data/types';
import { creationMedia } from './creations';
import { daysBetween, fromISODate } from './dates';

/**
 * Memories bring a creator's own posted work back on Today. They come only
 * from creations marked Posted that have media the viewer can open (the data
 * passed in is already scoped to the viewer). Nothing is invented: with no
 * posted media there are no memories.
 */
export type MemoryKind = 'on-this-day' | 'recent' | 'revisit';

export interface Memory {
  version: Version;
  kind: MemoryKind;
  /** e.g. "1 year ago", "6 days ago". */
  ago: string;
  playable: boolean;
}

function agoLabel(from: ISODate, today: ISODate): string {
  const days = daysBetween(from, today);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const a = fromISODate(from);
  const b = fromISODate(today);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0);
  if (months < 12) return months <= 1 ? 'a month ago' : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/** Same month and day in an earlier year. */
export function isOnThisDay(date: ISODate, today: ISODate): boolean {
  return date.slice(5) === today.slice(5) && date.slice(0, 4) < today.slice(0, 4);
}

export function memoriesFor(data: DemoData): Memory[] {
  const today = data.today;
  return data.versions
    .filter((v) => v.status === 'Posted' && v.scheduledFor <= today)
    .map((v) => {
      const kind = creationMedia(v);
      const media = data.assets.find((a) => a.id === v.mediaAssetId);
      const photos = (v.photoAssetIds ?? []).filter((id) => data.assets.some((a) => a.id === id));
      const playable = kind === 'video' && !!media?.videoUrl;
      const hasMedia = playable || (kind === 'photos' && photos.length > 0);
      if (!hasMedia) return null;
      const age = daysBetween(v.scheduledFor, today);
      const memoryKind: MemoryKind = isOnThisDay(v.scheduledFor, today) ? 'on-this-day' : age >= 30 ? 'revisit' : 'recent';
      return { version: v, kind: memoryKind, ago: agoLabel(v.scheduledFor, today), playable } satisfies Memory;
    })
    .filter((m): m is Memory => m !== null)
    .sort((a, b) => a.version.scheduledFor.localeCompare(b.version.scheduledFor) || a.version.id.localeCompare(b.version.id));
}

/**
 * Today's order: an "on this day" memory always leads when one exists.
 * Otherwise the starting memory rotates by date, so the page changes daily
 * and walks through every memory before any repeats.
 */
export function rotateMemories(memories: Memory[], today: ISODate): Memory[] {
  if (memories.length === 0) return [];
  const onThisDay = memories.filter((m) => m.kind === 'on-this-day');
  const rest = memories.filter((m) => m.kind !== 'on-this-day');
  const [y, m, d] = today.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const start = rest.length ? ((day % rest.length) + rest.length) % rest.length : 0;
  return [...onThisDay, ...rest.slice(start), ...rest.slice(0, start)];
}
