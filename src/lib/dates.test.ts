import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthGrid, relativeDay } from './dates';

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(daysBetween('2026-09-29', '2026-10-02')).toBe(3);
  });

  it('builds Monday-start month grids covering the month', () => {
    const weeks = monthGrid('2026-09-15');
    expect(weeks[0][0]).toBe('2026-08-31');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat()).toContain('2026-09-30');
    expect(weeks.at(-1)!.at(-1)! >= '2026-09-30').toBe(true);
  });

  it('describes relative days', () => {
    expect(relativeDay('2026-09-29', '2026-09-29')).toBe('Today');
    expect(relativeDay('2026-09-30', '2026-09-29')).toBe('Tomorrow');
    expect(relativeDay('2026-10-02', '2026-09-29')).toBe('In 3 days');
    expect(relativeDay('2026-09-27', '2026-09-29')).toBe('2 days ago');
  });
});
