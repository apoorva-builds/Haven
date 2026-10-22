import { describe, expect, it } from 'vitest';
import type { AudienceSeries } from '../data/types';
import { changeOver, formatAge, formatCount, formatSigned, freshness, sampleSnapshots, trend } from './audience';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 8, 29, 12);
const at = (daysAgo: number) => new Date(now - daysAgo * 24 * HOUR).toISOString();

const series = (snapshots: AudienceSeries['snapshots'], staleAfterHours = 48): AudienceSeries => ({
  accountId: 'a',
  metric: 'followers',
  source: { kind: 'sample', plannedUpdate: 'platform-api' },
  staleAfterHours,
  snapshots,
});

describe('audience pulse', () => {
  const s = series([
    { at: at(40), count: 900 },
    { at: at(30), count: 1000 },
    { at: at(7), count: 1100 },
    { at: at(3), count: 1150 },
    { at: at(0), count: 1210 },
  ]);

  it('measures change against the snapshot at or before the window start', () => {
    expect(changeOver(s, 7)).toMatchObject({ delta: 110 }); // vs 1100 seven days back
    expect(changeOver(s, 30)).toMatchObject({ delta: 210 });
    expect(changeOver(s, 30)!.ratio).toBeCloseTo(0.21);
  });

  it('refuses to invent a change without enough history', () => {
    const short = series([{ at: at(2), count: 10 }, { at: at(0), count: 12 }]);
    expect(changeOver(short, 7)).toBeNull();
    expect(changeOver(series([]), 7)).toBeNull();
  });

  it('trends only the last 30 days', () => {
    expect(trend(s, 30)).toEqual([1000, 1100, 1150, 1210]);
  });

  it('never treats an old count as current', () => {
    expect(freshness(s, now).stale).toBe(false);
    expect(freshness(series([{ at: at(3), count: 5 }], 48), now).stale).toBe(true);
    expect(freshness(series([]), now).stale).toBe(true);
  });

  it('formats compact, signed and relative values', () => {
    expect(formatCount(612_400)).toBe('612K');
    expect(formatCount(48_213)).toBe('48.2K');
    expect(formatSigned(2040)).toBe('+2.04K');
    expect(formatSigned(-80)).toBe('−80');
    expect(formatAge(3 * HOUR)).toBe('3 hours ago');
    expect(formatAge(9 * 24 * HOUR)).toBe('9 days ago');
  });

  it('builds sample series ending at the chosen age, oldest first', () => {
    const snaps = sampleSnapshots({ now, latestAgeHours: 5, endCount: 5000, dailyGrowth: 10, seed: 1 });
    expect(snaps.at(-1)!.count).toBe(5000);
    expect(Date.parse(snaps.at(-1)!.at)).toBe(now - 5 * HOUR);
    expect(Date.parse(snaps[0].at)).toBeLessThan(Date.parse(snaps[1].at));
  });
});
