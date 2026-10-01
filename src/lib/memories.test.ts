import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import { addDays } from './dates';
import { scopeData } from './access';
import { isOnThisDay, memoriesFor, rotateMemories } from './memories';

const data = createDemoData();

describe('memories', () => {
  it('come only from posted creations with media', () => {
    const ms = memoriesFor(data);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.version.status).toBe('Posted');
    expect(ms.map((m) => m.version.id).sort()).toEqual(['v-ig-atlas-cafe', 'v-ig-atlas-packing', 'v-yt-pine-spots']);
  });

  it('mark a post from this day in an earlier year as on this day, and lead with it', () => {
    const ms = memoriesFor(data);
    const packing = ms.find((m) => m.version.id === 'v-ig-atlas-packing')!;
    expect(packing.kind).toBe('on-this-day');
    expect(packing.ago).toBe('1 year ago');
    expect(rotateMemories(ms, data.today)[0].version.id).toBe('v-ig-atlas-packing');
    expect(isOnThisDay('2025-10-01', '2026-10-01')).toBe(true);
    expect(isOnThisDay('2026-10-01', '2026-10-01')).toBe(false);
    expect(isOnThisDay('2025-10-02', '2026-10-01')).toBe(false);
  });

  it('rotate daily through every memory before repeating, keeping all of them', () => {
    const ms = memoriesFor({ ...data, versions: data.versions.filter((v) => v.id !== 'v-ig-atlas-packing') });
    const firsts = new Set<string>();
    for (let i = 0; i < ms.length; i++) {
      const order = rotateMemories(ms, addDays(data.today, i));
      expect(order).toHaveLength(ms.length);
      firsts.add(order[0].version.id);
    }
    expect(firsts.size).toBe(ms.length);
  });

  it('follow access: a collaborator only gets memories they can open', () => {
    expect(memoriesFor(scopeData(data, 'sam').data)).toEqual([]);
    const jonah = memoriesFor(scopeData(data, 'jonah').data).map((m) => m.version.id).sort();
    expect(jonah).toEqual(['v-ig-atlas-cafe', 'v-ig-atlas-packing', 'v-yt-pine-spots']);
  });

  it('are empty when nothing is posted, instead of inventing activity', () => {
    expect(memoriesFor({ ...data, versions: data.versions.map((v) => ({ ...v, status: v.status === 'Posted' ? 'Ready to post' : v.status })) })).toEqual([]);
  });
});
