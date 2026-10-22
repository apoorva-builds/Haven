import { beforeEach, describe, expect, it } from 'vitest';
import { getProfile, resetProfileCache, saveProfile } from './profile';

/** A minimal in-memory localStorage for the node test environment. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetProfileCache();
});

describe('personal profiles', () => {
  it('start with an initials fallback, Haven palette and the device’s appearance', () => {
    expect(getProfile('me')).toEqual({ appearance: 'system', palette: 'haven' });
  });

  it('belong to one person: saving mine never changes anyone else’s', () => {
    saveProfile('me', { palette: 'plum', appearance: 'dark', photo: 'data:image/jpeg;base64,AAA' });
    expect(getProfile('me')).toMatchObject({ palette: 'plum', appearance: 'dark', photo: 'data:image/jpeg;base64,AAA' });
    expect(getProfile('jonah')).toEqual({ appearance: 'system', palette: 'haven' });
  });

  it('survive a new session (stored, not just cached)', () => {
    saveProfile('me', { palette: 'harbor' });
    resetProfileCache();
    expect(getProfile('me').palette).toBe('harbor');
  });

  it('replace and remove the photo; removing keeps the rest', () => {
    saveProfile('me', { photo: 'data:a', palette: 'graphite' });
    saveProfile('me', { photo: 'data:b' });
    expect(getProfile('me').photo).toBe('data:b');
    saveProfile('me', { photo: undefined });
    expect(getProfile('me').photo).toBeUndefined();
    expect(getProfile('me').palette).toBe('graphite');
  });

  it('carry over the earlier preview’s photo and light/dark choice', () => {
    localStorage.setItem('haven.photo.me', 'data:old');
    localStorage.setItem('haven.theme', 'dark');
    expect(getProfile('me')).toMatchObject({ photo: 'data:old', appearance: 'dark' });
    // The owner's old browser-wide theme is not applied to other people.
    expect(getProfile('jonah').appearance).toBe('system');
  });

  it('report a failure honestly when storage is full', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    resetProfileCache();
    const r = saveProfile('me', { photo: 'data:big' });
    expect(r.ok).toBe(false);
    expect(getProfile('me').photo).toBeUndefined();
  });
});
