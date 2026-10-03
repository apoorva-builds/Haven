import { describe, expect, it } from 'vitest';
import { contrast, PALETTES, resolveAppearance } from './palettes';

/** Text must stay readable in every palette, light and dark (WCAG AA). */
describe('palettes keep text and controls readable', () => {
  for (const p of PALETTES) {
    for (const mode of ['light', 'dark'] as const) {
      const t = p[mode];
      it(`${p.name} ${mode}`, () => {
        for (const bg of [t.canvas, t['canvas-2'], t.surface, t['surface-2']]) {
          expect(contrast(t.ink, bg), 'body text').toBeGreaterThanOrEqual(7);
          expect(contrast(t['ink-2'], bg), 'secondary text').toBeGreaterThanOrEqual(4.5);
          expect(contrast(t['ink-3'], bg), 'quiet text').toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.cobalt, bg), 'links and selected items').toBeGreaterThanOrEqual(4.5);
        }
        // Selected navigation: accent text on its soft tint.
        expect(contrast(t.cobalt, t['cobalt-soft']), 'selected item').toBeGreaterThanOrEqual(4.5);
        // Primary buttons: label on the fill, at rest and hovered.
        expect(contrast(t['accent-ink'], t['cobalt-fill']), 'button label').toBeGreaterThanOrEqual(4.5);
        expect(contrast(t['accent-ink'], t['cobalt-hover']), 'hovered button label').toBeGreaterThanOrEqual(4.5);
        // Controls stand off the page: a filled button is distinguishable from the canvas.
        expect(contrast(t['cobalt-fill'], t.canvas), 'button against page').toBeGreaterThanOrEqual(3);
      });
    }
  }

  it('a small, curated set', () => {
    expect(PALETTES.map((p) => p.id)).toEqual(['haven', 'plum', 'harbor', 'graphite']);
  });

  it('“Match system” follows the device', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
    expect(resolveAppearance('light', true)).toBe('light');
  });
});
