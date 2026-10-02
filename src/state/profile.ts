import { useSyncExternalStore } from 'react';
import { DEFAULT_PALETTE, type Appearance, type PaletteId } from '../lib/palettes';

/*
 * Personal preferences, one record per person: profile photo, appearance
 * (light, dark or match the device) and palette. They change only how that
 * person sees Haven. They never touch workspace content or another member's
 * view.
 *
 * Preview: records are kept in this browser's storage, keyed by person, so
 * they survive reloads and new sessions on this device. With real sign-in the
 * same record is the person's `profiles` row on the server (photo in private
 * storage), which is what carries it to their other devices.
 */

export interface Profile {
  /** A small square JPEG as a data URL, or none. */
  photo?: string;
  appearance: Appearance;
  palette: PaletteId;
  updatedAt?: string;
}

const KEY = (personId: string) => `haven.profile.${personId}`;
const LEGACY_PHOTO = (personId: string) => `haven.photo.${personId}`;
const DEFAULTS: Profile = { appearance: 'system', palette: DEFAULT_PALETTE };

const listeners = new Set<() => void>();
const cache = new Map<string, Profile>();

function read(personId: string): Profile {
  const cached = cache.get(personId);
  if (cached) return cached;
  let profile: Profile = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY(personId));
    if (raw) profile = { ...DEFAULTS, ...JSON.parse(raw) };
    else {
      // Carry over what the earlier preview stored: the Today photo, and the
      // browser-wide light/dark choice (for the owner who made it).
      const photo = localStorage.getItem(LEGACY_PHOTO(personId));
      if (photo) profile.photo = photo;
      const theme = localStorage.getItem('haven.theme');
      if (personId === 'me' && (theme === 'light' || theme === 'dark')) profile.appearance = theme;
    }
  } catch {
    /* storage blocked: defaults for this visit */
  }
  cache.set(personId, profile);
  return profile;
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

/** Save part of one person's profile. Other people's records are untouched. */
export function saveProfile(personId: string, patch: Partial<Profile>): SaveResult {
  const next: Profile = { ...read(personId), ...patch, updatedAt: new Date().toISOString() };
  if ('photo' in patch && !patch.photo) delete next.photo;
  try {
    localStorage.setItem(KEY(personId), JSON.stringify(next));
    localStorage.removeItem(LEGACY_PHOTO(personId));
  } catch {
    return { ok: false, reason: 'This browser couldn’t save it. If you chose a photo, try a smaller image.' };
  }
  cache.set(personId, next);
  listeners.forEach((l) => l());
  return { ok: true };
}

export function getProfile(personId: string): Profile {
  return read(personId);
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Another tab saved: refresh.
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('haven.profile.')) {
      cache.delete(e.key.slice('haven.profile.'.length));
      l();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

/** One person's profile, kept up to date. */
export function useProfile(personId: string): Profile {
  return useSyncExternalStore(subscribe, () => read(personId), () => DEFAULTS);
}

/** For tests: forget cached records. */
export function resetProfileCache() {
  cache.clear();
}

/** Shrinks a chosen image to a small square JPEG so it fits in browser storage. */
export async function toSquarePhoto(file: Blob, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('empty image');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const MAX_PHOTO_MB = 15;
