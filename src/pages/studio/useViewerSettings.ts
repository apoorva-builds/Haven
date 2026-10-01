import { useEffect, useState } from 'react';

export interface ViewerSettings {
  volume: number;
  muted: boolean;
  /** 0.5–1.5. Applied to this person's player only, as a display filter. */
  brightness: number;
}

const DEFAULTS: ViewerSettings = { volume: 1, muted: false, brightness: 1 };

export const BRIGHTNESS_MIN = 0.5;
export const BRIGHTNESS_MAX = 1.5;

/**
 * Comfortable-viewing settings for one viewer. They are remembered in this
 * browser per person and never touch the file, other people's view, or the
 * posted video. If storage is blocked they simply last for the page.
 */
export function useViewerSettings(personId: string): [ViewerSettings, (patch: Partial<ViewerSettings>) => void] {
  const key = `haven.viewing.${personId}`;
  const read = (): ViewerSettings => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  };
  const [settings, setSettings] = useState<ViewerSettings>(read);
  // A different viewer (e.g. "Preview as") gets their own settings.
  useEffect(() => setSettings(read()), [key]);
  const update = (patch: Partial<ViewerSettings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      next.volume = Math.max(0, Math.min(1, next.volume));
      next.brightness = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, next.brightness));
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep for this page only */
      }
      return next;
    });
  return [settings, update];
}
