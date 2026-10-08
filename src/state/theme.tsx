import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { paletteById, resolveAppearance, type Appearance, type PaletteId } from '../lib/palettes';
import { saveProfile, useProfile } from './profile';
import { useStore } from './store';

export type Theme = 'light' | 'dark';
/** Device-level hint read before first paint (index.html), so a reload never flashes. */
export const BOOT_KEY = 'haven.boot';

interface Look {
  appearance: Appearance;
  palette: PaletteId;
}

interface ThemeValue {
  /** What's on screen now, light or dark. */
  theme: Theme;
  appearance: Appearance;
  palette: PaletteId;
  /** Saves the viewer's appearance. */
  setTheme: (t: Theme) => void;
  toggle: () => void;
  /** Shows a look without saving it (the settings preview). Pass null to stop. */
  preview: (look: Partial<Look> | null) => void;
  previewing: boolean;
  /** False while previewing as another member: their settings are theirs. */
  canEdit: boolean;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!m) return;
    const on = () => setDark(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return dark;
}

/**
 * Applies the current viewer's own appearance and palette. Each person's
 * choice lives in their profile, so it never changes anyone else's view or
 * the work itself. "Preview as" shows the previewed member's own look.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data, preview: previewAs } = useStore();
  const viewer = data.currentUserId;
  const profile = useProfile(viewer);
  const systemDark = useSystemDark();
  const [trial, setTrial] = useState<Partial<Look> | null>(null);

  const appearance = trial?.appearance ?? profile.appearance;
  const palette = trial?.palette ?? profile.palette;
  const theme = resolveAppearance(appearance, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    const tokens = paletteById(palette)[theme];
    root.dataset.theme = theme;
    root.dataset.palette = palette;
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--${k}`, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.canvas);
    if (!trial && !previewAs) {
      try {
        localStorage.setItem(BOOT_KEY, JSON.stringify({ theme, palette, vars: tokens }));
      } catch {
        /* storage blocked: the look still applies for this visit */
      }
    }
  }, [theme, palette, trial, previewAs]);

  // A different viewer starts without anyone else's trial.
  useEffect(() => setTrial(null), [viewer]);

  const canEdit = !previewAs;
  const setTheme = useCallback(
    (t: Theme) => {
      if (canEdit) saveProfile(viewer, { appearance: t });
    },
    [viewer, canEdit],
  );
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo<ThemeValue>(
    () => ({ theme, appearance, palette, setTheme, toggle, preview: setTrial, previewing: !!trial, canEdit }),
    [theme, appearance, palette, setTheme, toggle, trial, canEdit],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
