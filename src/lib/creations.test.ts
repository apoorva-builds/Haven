import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import { finishedVideos, rawLibrary } from '../state/selectors';
import { creationLabel, groupByDay, postedLinkLabel } from './creations';

const data = createDemoData(new Date(2026, 8, 29));
const label = (versionId: string) => {
  const v = data.versions.find((x) => x.id === versionId)!;
  const a = data.accounts.find((x) => x.id === v.accountId)!;
  return creationLabel(v, a, data.platforms.find((p) => p.id === a.platform)!);
};

describe('creations', () => {
  it('labels tiles by platform and format', () => {
    expect(label('v-ig-atlas')).toBe('Instagram · Reel');
    expect(label('v-ig-pine-desk')).toBe('Instagram · Carousel');
    expect(label('v-yt-pine')).toBe('YouTube · Long video');
    expect(label('v-yt-atlas-short')).toBe('YouTube · Short');
    expect(label('v-tt-pine')).toBe('TikTok · Video');
  });

  it('names the posted link by what you open', () => {
    expect(postedLinkLabel(data.versions.find((v) => v.id === 'v-yt-pine-spots')!)).toBe('Open posted video');
    expect(postedLinkLabel(data.versions.find((v) => v.id === 'v-ig-atlas-cafe')!)).toBe('Open posted post');
  });

  it('groups by day, newest first, keeping an idea’s versions together', () => {
    const days = groupByDay(data.versions);
    const keys = days.map((d) => d.day);
    expect(keys).toEqual([...keys].sort().reverse());
    expect(groupByDay(data.versions, 'oldest')[0].day).toBe(keys.at(-1));
    const fromToday = groupByDay(data.versions, 'from-today', data.today).map((d) => d.day);
    expect(fromToday[0]).toBe(data.today);
    const firstPast = fromToday.findIndex((d) => d < data.today);
    expect(fromToday.slice(0, firstPast)).toEqual([...fromToday.slice(0, firstPast)].sort());
    expect(fromToday.slice(firstPast)).toEqual([...fromToday.slice(firstPast)].sort().reverse());
    for (const { items } of days) {
      const ideas = items.map((v) => v.ideaId);
      // Each idea's versions are contiguous within a day.
      expect(ideas.filter((id, i) => i > 0 && ideas[i - 1] !== id && ideas.slice(0, i).includes(id))).toEqual([]);
    }
  });

  it('keeps the Raw Library and finished videos apart', () => {
    expect(rawLibrary(data).some((a) => a.kind === 'final')).toBe(false);
    expect(finishedVideos(data).map((a) => a.id).sort()).toEqual(['a-evening-short', 'a-first-wide', 'a-market-vertical', 'a-morning-vertical', 'a-morning-wide', 'a-spots-vertical']);
  });
});
