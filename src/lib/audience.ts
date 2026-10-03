import type { AudienceSeries, AudienceSnapshot } from '../data/types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const latestSnapshot = (s: AudienceSeries): AudienceSnapshot | undefined => s.snapshots.at(-1);

/** The last snapshot taken at or before `time`, if any. */
export function snapshotAt(s: AudienceSeries, time: number): AudienceSnapshot | undefined {
  let found: AudienceSnapshot | undefined;
  for (const snap of s.snapshots) {
    if (Date.parse(snap.at) <= time) found = snap;
    else break;
  }
  return found;
}

export interface Change {
  days: number;
  delta: number;
  /** Fraction, e.g. 0.012 for +1.2%. */
  ratio: number;
}

/**
 * Change over the `days` before the latest snapshot. Returns null when there
 * is no snapshot old enough to compare against — never a guessed figure.
 */
export function changeOver(s: AudienceSeries, days: number): Change | null {
  const latest = latestSnapshot(s);
  if (!latest) return null;
  const base = snapshotAt(s, Date.parse(latest.at) - days * DAY);
  if (!base || base === latest) return null;
  const delta = latest.count - base.count;
  return { days, delta, ratio: base.count ? delta / base.count : 0 };
}

/** Counts for the trend line: one per snapshot in the last `days` before the latest. */
export function trend(s: AudienceSeries, days = 30): number[] {
  const latest = latestSnapshot(s);
  if (!latest) return [];
  const from = Date.parse(latest.at) - days * DAY;
  return s.snapshots.filter((x) => Date.parse(x.at) >= from).map((x) => x.count);
}

export interface Freshness {
  /** True when the latest count is older than the series allows; show it as out of date. */
  stale: boolean;
  ageMs: number;
  latestAt?: string;
}

export function freshness(s: AudienceSeries, now: number = Date.now()): Freshness {
  const latest = latestSnapshot(s);
  if (!latest) return { stale: true, ageMs: Infinity };
  const ageMs = Math.max(0, now - Date.parse(latest.at));
  return { stale: ageMs > s.staleAfterHours * HOUR, ageMs, latestAt: latest.at };
}

/** 605,000 → "605K"; 48,213 → "48.2K"; 1,240,000 → "1.24M". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).format(n);
}

export function formatSigned(n: number): string {
  const s = formatCount(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : '0';
}

export function formatAge(ms: number): string {
  if (!Number.isFinite(ms)) return 'never';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(ms / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Builds deterministic daily sample snapshots ending `latestAgeHours` before `now`.
 * Used only for the demo; real series come from API refreshes or manual entry.
 */
export function sampleSnapshots(opts: { now: number; latestAgeHours: number; endCount: number; dailyGrowth: number; days?: number; seed: number }): AudienceSnapshot[] {
  const { now, latestAgeHours, endCount, dailyGrowth, days = 45, seed } = opts;
  const end = now - latestAgeHours * HOUR;
  let x = seed;
  const noise = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280 - 0.5;
  };
  const out: AudienceSnapshot[] = [];
  let count = endCount;
  for (let i = 0; i <= days; i++) {
    out.push({ at: new Date(end - i * DAY).toISOString(), count: Math.round(count) });
    count -= dailyGrowth * (1 + noise() * 1.2);
  }
  return out.reverse();
}
