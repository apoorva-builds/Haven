import type { Account, ISODate, Platform, Version } from '../data/types';

/** Whether a creation is watched, swiped through, or read. */
export type CreationMedia = 'video' | 'photos' | 'text';

export function creationMedia(v: Version): CreationMedia {
  if (v.format === 'Carousel' || v.photoAssetIds?.length) return 'photos';
  if (v.format === 'Post' || v.format === 'Issue') return 'text';
  return 'video';
}

/** Human format name, e.g. YouTube 16:9 "Video" → "Long video", 9:16 → "Short". */
export function formatName(v: Version, account: Account): string {
  if (account.platform === 'youtube') return v.aspect === '9:16' || v.format === 'Short' ? 'Short' : 'Long video';
  if (account.platform === 'tiktok') return 'Video';
  if (account.platform === 'newsletter') return 'Issue';
  return v.format;
}

/** Top label for a gallery tile, e.g. "Instagram · Reel". */
export function creationLabel(v: Version, account: Account, platform: Platform): string {
  return `${platform.name} · ${formatName(v, account)}`;
}

/** "Open posted video" for things you watch, "Open posted post" otherwise. */
export function postedLinkLabel(v: Version): string {
  return creationMedia(v) === 'video' ? 'Open posted video' : 'Open posted post';
}

export interface DayGroup<T> {
  day: ISODate;
  items: T[];
}

export type GalleryOrder = 'from-today' | 'newest' | 'oldest';

/**
 * Groups versions by scheduled/posted day; within a day, versions of the same
 * idea sit together. "from-today" starts at today and runs forward, then
 * continues with earlier days, most recent first.
 */
export function groupByDay(versions: Version[], order: GalleryOrder = 'newest', today?: ISODate): DayGroup<Version>[] {
  const map = new Map<ISODate, Version[]>();
  for (const v of versions) map.set(v.scheduledFor, [...(map.get(v.scheduledFor) ?? []), v]);
  let days = [...map.keys()].sort();
  if (order === 'newest') days.reverse();
  if (order === 'from-today' && today) {
    days = [...days.filter((d) => d >= today), ...days.filter((d) => d < today).reverse()];
  }
  return days.map((day) => ({
    day,
    items: map.get(day)!.slice().sort((a, b) => a.ideaId.localeCompare(b.ideaId) || a.accountId.localeCompare(b.accountId)),
  }));
}
