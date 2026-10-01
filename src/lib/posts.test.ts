import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import { scopeData } from './access';
import { addDays } from './dates';
import { activeDays, calendarEntries, entriesByDay, monthsOfWork, neighbours } from './posts';

const data = createDemoData();
const d = (n: number) => addDays(data.today, n);

describe('publishing calendar', () => {
  const entries = calendarEntries(data);
  const days = entriesByDay(entries);

  it('puts every post from a busy day together, posted before planned', () => {
    const busy = days.get(d(-20))!;
    expect(busy.map((e) => e.version.id)).toEqual(['v-ig-atlas-counter', 'v-ig-pine-evening', 'v-yt-pine-evening']);
    expect(busy.every((e) => e.posted && e.source === 'manual')).toBe(true);
  });

  it('keeps a late-night post on its local day, with its local time', () => {
    const late = entries.find((e) => e.version.id === 'v-yt-pine-evening')!;
    expect(late.day).toBe(d(-20));
    expect(late.time).toBe('11:40 PM');
  });

  it('includes posted work from archived ideas, but not their unposted plans', () => {
    expect(entries.some((e) => e.version.id === 'v-yt-pine-first')).toBe(true);
    const archived = new Set(data.ideas.filter((i) => i.archived).map((i) => i.id));
    expect(entries.filter((e) => archived.has(e.version.ideaId)).every((e) => e.posted)).toBe(true);
  });

  it('marks planned work as planned on its scheduled day', () => {
    const planned = entries.find((e) => e.version.id === 'v-ig-atlas')!;
    expect(planned.posted).toBe(false);
    expect(planned.source).toBe('planned');
    expect(planned.day).toBe(planned.version.scheduledFor);
  });

  it('steps between days that have something on them', () => {
    const list = activeDays(entries);
    const { prev, next } = neighbours(list, d(-10));
    expect(prev).toBe(d(-20));
    expect(next).toBe(d(-6));
    expect(neighbours(list, list[0]).prev).toBeUndefined();
  });

  it('summarises months with activity, from a year ago to what is planned', () => {
    const months = monthsOfWork(data, entries);
    expect(months[0].month).toBe(entries[0].day.slice(0, 7));
    expect(months.some((m) => m.month === data.today.slice(0, 7))).toBe(true);
    expect(months.reduce((n, m) => n + m.posted, 0)).toBe(entries.filter((e) => e.posted).length);
  });

  it('follows access: an account-only collaborator sees only their account', () => {
    const sam = calendarEntries(scopeData(data, 'sam').data);
    expect(sam.length).toBeGreaterThan(0);
    expect(sam.every((e) => e.version.accountId === 'tt-pine')).toBe(true);
    expect(sam.some((e) => e.posted)).toBe(false);
  });
});
