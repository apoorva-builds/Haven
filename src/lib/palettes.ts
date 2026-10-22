/*
 * Personal Haven palettes. A palette recolours the surfaces and the action
 * colour only. Status colours (jade done, amber needs eyes, coral time
 * pressure) and platform marks never change, so they mean the same thing in
 * every palette. Each palette has a light and a dark set, checked for
 * contrast in palettes.test.ts.
 */

export type PaletteId = 'haven' | 'plum' | 'harbor' | 'graphite';
export type Appearance = 'light' | 'dark' | 'system';

/** CSS custom properties a palette sets (without the leading --). */
export type PaletteTokens = {
  canvas: string;
  'canvas-2': string;
  surface: string;
  'surface-2': string;
  'surface-3': string;
  ink: string;
  'ink-2': string;
  'ink-3': string;
  line: string;
  'line-2': string;
  hairline: string;
  /** The action colour family. */
  cobalt: string;
  'cobalt-fill': string;
  'cobalt-hover': string;
  'cobalt-soft': string;
  'accent-ink': string;
  /** Borders of inputs and other controls (at least 3:1 against the page). */
  'control-line': string;
  /** Keyboard focus ring (at least 3:1 against the page). */
  focus: string;
};

export interface Palette {
  id: PaletteId;
  name: string;
  mood: string;
  light: PaletteTokens;
  dark: PaletteTokens;
}

export const PALETTES: Palette[] = [
  {
    id: 'haven',
    name: 'Haven',
    mood: 'Porcelain cream, pale nude and mocha.',
    light: {
      canvas: '#fcf9f5', 'canvas-2': '#f9f0e5', surface: '#fffdfa', 'surface-2': '#f7efe6', 'surface-3': '#eee3d9',
      ink: '#433732', 'ink-2': '#5e4e47', 'ink-3': '#75635b', line: '#e6dad0', 'line-2': '#cfbfb5', hairline: '#efe6dd',
      cobalt: '#6f554d', 'cobalt-fill': '#6f554d', 'cobalt-hover': '#5b443d', 'cobalt-soft': '#f3e4d8', 'accent-ink': '#fffdfa',
      'control-line': '#9b8178', focus: '#805a48',
    },
    dark: {
      canvas: '#251f1c', 'canvas-2': '#2a2320', surface: '#302824', 'surface-2': '#3b302a', 'surface-3': '#463932',
      ink: '#f5ece3', 'ink-2': '#dccbbf', 'ink-3': '#cbb8ab', line: '#57453c', 'line-2': '#6b574c', hairline: '#3a2f2a',
      cobalt: '#edd7c7', 'cobalt-fill': '#edd7c7', 'cobalt-hover': '#f5e6da', 'cobalt-soft': '#4a3b33', 'accent-ink': '#302824',
      'control-line': '#a68d7d', focus: '#d7a58c',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    mood: 'Blush paper with deep aubergine.',
    light: {
      canvas: '#faf5f3', 'canvas-2': '#f4ece9', surface: '#fffbfa', 'surface-2': '#f3e9e6', 'surface-3': '#e8dbd7',
      ink: '#1f1820', 'ink-2': '#4a3f4b', 'ink-3': '#6d6170', line: '#e8dad6', 'line-2': '#d6c4bf', hairline: '#efe3df',
      cobalt: '#6b2f7a', 'cobalt-fill': '#6b2f7a', 'cobalt-hover': '#57256a', 'cobalt-soft': '#f1e4f3', 'accent-ink': '#ffffff',
      'control-line': '#957d8f', focus: '#6b2f7a',
    },
    dark: {
      canvas: '#151116', 'canvas-2': '#1b161c', surface: '#221c23', 'surface-2': '#2a232c', 'surface-3': '#352c37',
      ink: '#f5eef6', 'ink-2': '#d6c8d8', 'ink-3': '#a99cac', line: '#332a35', 'line-2': '#443947', hairline: '#2b232d',
      cobalt: '#ddb6ea', 'cobalt-fill': '#9150a8', 'cobalt-hover': '#8a48a0', 'cobalt-soft': '#3a2442', 'accent-ink': '#ffffff',
      'control-line': '#9a8a9d', focus: '#ddb6ea',
    },
  },
  {
    id: 'harbor',
    name: 'Harbor',
    mood: 'Sea fog and deep petrol.',
    light: {
      canvas: '#f3f6f6', 'canvas-2': '#e9eff0', surface: '#fbfdfd', 'surface-2': '#e8eff0', 'surface-3': '#dae4e6',
      ink: '#141b1e', 'ink-2': '#3c484d', 'ink-3': '#5b6a71', line: '#d9e3e5', 'line-2': '#c3d1d4', hairline: '#e3eaec',
      cobalt: '#165a6e', 'cobalt-fill': '#165a6e', 'cobalt-hover': '#104757', 'cobalt-soft': '#dcecf0', 'accent-ink': '#ffffff',
      'control-line': '#71878d', focus: '#165a6e',
    },
    dark: {
      canvas: '#0f1517', 'canvas-2': '#131b1e', surface: '#182226', 'surface-2': '#1f2b30', 'surface-3': '#29373d',
      ink: '#e9f1f2', 'ink-2': '#c3d1d4', 'ink-3': '#93a5ab', line: '#253237', 'line-2': '#344349', hairline: '#1f2a2e',
      cobalt: '#8fd0e0', 'cobalt-fill': '#1f6f85', 'cobalt-hover': '#277a91', 'cobalt-soft': '#16343d', 'accent-ink': '#ffffff',
      'control-line': '#7f9399', focus: '#8fd0e0',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    mood: 'Stone and ink. Quiet and editorial.',
    light: {
      canvas: '#f5f4f2', 'canvas-2': '#ecebe8', surface: '#fcfcfb', 'surface-2': '#ecebe8', 'surface-3': '#dfdedb',
      ink: '#171717', 'ink-2': '#3f3f3f', 'ink-3': '#636260', line: '#dedcd8', 'line-2': '#c9c6c1', hairline: '#e7e5e1',
      cobalt: '#1f1f1f', 'cobalt-fill': '#262626', 'cobalt-hover': '#000000', 'cobalt-soft': '#e4e3e0', 'accent-ink': '#ffffff',
      'control-line': '#83817e', focus: '#1f1f1f',
    },
    dark: {
      canvas: '#111111', 'canvas-2': '#161616', surface: '#1c1c1c', 'surface-2': '#242424', 'surface-3': '#2e2e2e',
      ink: '#f2f2f0', 'ink-2': '#cfcfcc', 'ink-3': '#a09f9c', line: '#2c2c2c', 'line-2': '#3a3a3a', hairline: '#242424',
      cobalt: '#f2f2f0', 'cobalt-fill': '#ecebe8', 'cobalt-hover': '#ffffff', 'cobalt-soft': '#303030', 'accent-ink': '#161616',
      'control-line': '#8c8b88', focus: '#f2f2f0',
    },
  },
];

export const DEFAULT_PALETTE: PaletteId = 'haven';

export const paletteById = (id: string | undefined): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Light or dark for an appearance choice, given the device setting. */
export const resolveAppearance = (a: Appearance, systemDark: boolean): 'light' | 'dark' => (a === 'system' ? (systemDark ? 'dark' : 'light') : a);

/* ------------------------------------------------------------------------
 * Contrast (WCAG 2.1 relative luminance), used by the tests and the picker.
 * ---------------------------------------------------------------------- */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
