import { describe, expect, it } from 'vitest';
import { justify } from './justify';

describe('justify', () => {
  it('fills each row to the width at close to the target height', () => {
    const rows = justify([0.8, 0.5625, 0.5625, 0.5625, 0.5625, 1.78], 1000, 300, 20);
    for (const r of rows.slice(0, -1)) {
      expect(r.height).toBeGreaterThan(200);
      expect(r.height).toBeLessThan(420);
    }
    expect(rows.map((r) => r.end - r.start).reduce((a, b) => a + b)).toBe(6);
  });

  it('does not blow up a short last row', () => {
    const [row] = justify([0.5625], 1000, 300, 20);
    expect(row.height).toBe(300);
  });
});
