import { describe, expect, it } from 'vitest';
import { zonedDay, zonedInstant, zonedTime } from './time';

describe('time zones', () => {
  it('keeps a late-night post on its local day even when UTC has moved on', () => {
    const iso = zonedInstant('2026-09-11', '23:40', 'America/Los_Angeles');
    expect(iso.slice(0, 10)).toBe('2026-09-12'); // already tomorrow in UTC
    expect(zonedDay(iso, 'America/Los_Angeles')).toBe('2026-09-11');
    expect(zonedTime(iso, 'America/Los_Angeles')).toBe('11:40 PM');
  });

  it('the same instant can fall on different days in different zones', () => {
    const iso = zonedInstant('2026-09-11', '23:40', 'America/Los_Angeles');
    expect(zonedDay(iso, 'Asia/Tokyo')).toBe('2026-09-12');
    expect(zonedDay(iso, 'Europe/London')).toBe('2026-09-12');
  });

  it('round-trips across a daylight-saving change', () => {
    for (const [date, time] of [['2026-03-08', '09:30'], ['2026-11-01', '01:30'], ['2026-07-04', '12:00']] as const) {
      const iso = zonedInstant(date, time, 'America/Los_Angeles');
      expect(zonedDay(iso, 'America/Los_Angeles')).toBe(date);
    }
  });
});
